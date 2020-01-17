const createError = require('http-errors')
const redisAdapter = require('socket.io-redis')
const _ = require('lodash')
const debug = require('debug')('stelace:api')
const apm = require('elastic-apm-node')

const { parseKey } = require('stelace-util-keys')

const User = require('../models/User')

const { getRedisClient } = require('../redis')
const { isValidObjectId } = require('../util/validation')
const { checkAuthToken } = require('../auth')
const { logError } = require('../../server/logger')

let isServiceActive

let responder
let publisher
let sockend
let apiKeyRequester
let userRequester

let redisPubClient
let redisSubClient

const maxNbClientsPerPlatform = 1000

function start ({ communication, stelaceIO }) {
  const {
    getResponder,
    getRequester,
    getPublisher,
    getSockend,
    COMMUNICATION_ID
  } = communication

  if (!stelaceIO) return
  else isServiceActive = true

  debug('Signal service enabled')

  sockend = getSockend(stelaceIO, {
    name: 'Sockend',
    key: `${COMMUNICATION_ID}_signal` // Avoids connecting to all publishers
    // https://github.com/dashersw/cote/blob/master/src/components/sockend.js
  })

  apiKeyRequester = getRequester({
    name: 'Signal service > Api key Requester',
    key: 'api-key'
  })

  userRequester = getRequester({
    name: 'Signal service > User Requester',
    key: 'user'
  })

  redisPubClient = getRedisClient({ exclusive: true })
  redisSubClient = getRedisClient({ exclusive: true })

  stelaceIO.adapter(redisAdapter({
    key: 'signal',
    pubClient: redisPubClient,
    subClient: redisSubClient
  }))

  stelaceIO
    .of('/signal')
    .on('connection', function (socket) {
      const authenticationDelay = 2000
      let disconnectReason
      socket.auth = false
      socket.tooMany = false

      socket.emit('authentication', socket.client.id, authenticationCallback)

      /**
       * Authentication callback must be called from client.
       * Client will be disconnected if no valid publishable apiKey is sent back quickly,
       * as well as `authToken` if including a userId or organizationId(s) in channel.
       * @param {String} data.publishableKey
       * @param {String|Array<String>} [data.channels]
       * @param {String} [data.authToken] - Required if any orgId or userId is included in channel.
       *   Client will also automatically join matching userId channel if provided.
       */
      async function authenticationCallback (data) {
        const name = 'Socket: Signal authentication'
        apm.startTransaction(name)

        const rawApiKey = _.get(data, 'publishableKey')
        // channels can be array of strings or single string
        const channels = _.flatten([_.get(data, 'channels', '')])
        const authToken = _.get(data, 'authToken')

        const organizationIds = [] // to be extracted from channels
        const userIds = [] // there should be a single one at most
        let otherChannels = []
        let platformId
        let env
        let userId
        let hasInternalUserId

        const disconnect = reason => {
          disconnectReason = reason
          apm.endTransaction()
        }

        if (channels.some(c => typeof c !== 'string')) {
          return disconnect('channels must be a String or an Array of Strings.')
        }

        if (typeof rawApiKey !== 'string') {
          return disconnect('Missing publishable API key')
        }

        try {
          const parsedApiKey = parseKey(rawApiKey)
          let apiKey

          if (_.get(parsedApiKey, 'hasValidFormat')) {
            platformId = parsedApiKey.platformId
            env = parsedApiKey.env

            apm.setUserContext({ id: platformId })
            apm.addLabels({ platformId, env })

            apiKey = await apiKeyRequester.send({
              type: '_getApiKey',
              key: rawApiKey,
              platformId,
              env
            })
          }

          if (!env || !platformId || !apiKey) throw new Error()
        } catch (err) {
          return disconnect('Invalid API key')
        }

        const channelsToJoin = [
          platformChannel({ platformId, env }),
          prefixChannel(socket.client.id, { platformId, env })
        ]

        // Ensure authentication when subscribing to user or organization channel
        const channelsRequiringAuth = channels.filter(id => {
          let isUserChannel = id.startsWith(User.idPrefix)
          let isOrgChannel = id.startsWith(User.organizationIdPrefix)

          if (isUserChannel) {
            isUserChannel = isValidObjectId({ id, prefix: User.idPrefix, platformId, env })
            isUserChannel && userIds.push(id)
          } else if (isOrgChannel) {
            isOrgChannel = isValidObjectId({ id, prefix: User.organizationIdPrefix, platformId, env })
            isOrgChannel && organizationIds.push(id)
          }
          return isUserChannel || isOrgChannel
        })

        if (userIds.length > 1) return disconnect('Can only subscribe to own user channel')

        const needsAuthToken = !!(authToken || channelsRequiringAuth.length)

        if (needsAuthToken) {
          if (!authToken) return disconnect('Missing authentication token')
          else if (typeof authToken !== 'string') return disconnect('String authentication token expected')

          try {
            const { decodedToken, isTokenExpired } = await checkAuthToken({
              authToken,
              platformId,
              env,
              apmLabel: 'Signal authToken check'
            })

            if (!isTokenExpired) {
              userId = decodedToken.sub || decodedToken.userId
              hasInternalUserId = isValidObjectId({
                id: userId,
                prefix: User.idPrefix,
                platformId,
                env
              })
              if (hasInternalUserId) channelsToJoin.push(prefixChannel(userId, { platformId, env }))
            }
          } catch (err) {
            return disconnect('Invalid authentication token')
          }
        }

        if (hasInternalUserId && organizationIds.length) {
          await Promise.all(organizationIds.map(async (orgId) => {
            const { isOrgMember } = await userRequester.send({
              type: '_isOrganizationMember',
              platformId,
              env,
              userId,
              organizationId: orgId
            })
            // Not disconnecting to let user subscribe to other (org) channels
            if (!isOrgMember) socket.emit('warning', `${userId} was not granted access to ${orgId}.`)
            else channelsToJoin.push(prefixChannel(orgId, { platformId, env }))
          }))
        }

        socket.auth = true

        const nbClients = await getNbClients({ stelaceIO, platformId, env })

        if (nbClients >= maxNbClientsPerPlatform) { // hard-coded limit for now
          socket.tooMany = true
          const reason = env === 'test' ? `Having ${
            nbClients + 1
          } connected Signal clients is above API plan limit.`
            : 'Can’t add more clients.'

          logError(new Error('Too many Signal clients'), {
            platformId,
            env,
            message: `${nbClients} Signal clients exceeding plan limit of ${maxNbClientsPerPlatform}.`,
            custom: {
              nbClientsSignal: nbClients,
              maxNbClients: maxNbClientsPerPlatform
            }
          })

          return disconnect(reason)
        }

        otherChannels = channels.filter(c => ![...organizationIds, ...userIds].includes(c))
        if (otherChannels.length) {
          channelsToJoin.push(...otherChannels.map(c => prefixChannel(c, { platformId, env })))
        }

        debug(`WebSocket ${socket.client.id} subscribing to ${channelsToJoin.join(' ')}`)
        socket.join(channelsToJoin)

        apm.endTransaction()
      }

      setTimeout(function () {
        if (socket.auth && !socket.tooMany) return

        socket.emit('willDisconnect', {
          error: disconnectReason || `Authentication timeout after ${authenticationDelay}ms`
        })
        socket.disconnect(true)

        debug(`WebSocket ${socket.client.id} disconnected due to ${
          !socket.auth ? 'invalid authentication' : 'too many clients'
        }`)
      }, authenticationDelay)
    })

  responder = getResponder({
    name: 'Signal Responder',
    namespace: 'signal', // need to use namespace rather than usual key, for socket.io
    key: `${COMMUNICATION_ID}_signal` // mostly to prevent broadcast between devs
    /* respondsTo: [ // Be careful: client can use this to execute available logic in responder or broadcast
      'logicExecutedFromWebSocketClient'
    ] */
  })

  publisher = getPublisher({
    name: 'Signal publisher',
    namespace: 'signal',
    key: `${COMMUNICATION_ID}_signal`,
    broadcasts: [
      'signal::*'
    ]
  })

  responder.on('stelaceSignal', async (req) => {
    const platformId = req.platformId
    const env = req.env

    const {
      message,
      destination,
      event = 'signal'
    } = req

    if (!platformId || !env) throw createError(401)

    // Can’t broadcast to all users without appropriate permission
    if (!destination && !req._matchedPermissions['signal:create:all']) throw createError(403)

    return new Promise((resolve, reject) => {
      stelaceIO.of('/signal').adapter.allRooms((err, rooms) => {
        debug('existing rooms %o', rooms)

        if (err) {
          logError(err, {
            platformId,
            env,
            message: 'Fails to get socket.io rooms from redis adapter'
          })
          return reject(createError(500, err))
        }

        const channel = destination
          ? prefixChannel(destination, { platformId, env })
          : platformChannel({ platformId, env })

        if (destination && (!rooms || !rooms.includes(channel))) {
          return reject(createError(404, `Signal destination '${destination}' not found`))
        }

        const signal = {
          message,
          event,
          env,
          __room: channel // used and removed by côte
        }

        publisher.publish(`signal::${event}`, signal)
        debug(`Emitting %o to ${channel} channel`, signal)

        resolve({
          message,
          destination,
          event,
          env
          // success: true // can’t use acknowledgement when broadcasting
        })
      })
    })
  })
}

// Prefix channel with platformId and env to avoid any conflict between customers
function prefixChannel (channel, { platformId, env }) {
  if (!platformId || !env) throw new Error('Missing platformId/env')
  return `${platformId}_${env}__${channel}`
}

// Regrouping all sockets of a given customer env
// Thanks to prefixChannel we know any non-number/platformId prefix is available
function platformChannel ({ platformId, env }) {
  if (!platformId || !env) throw new Error('Missing platformId/env')
  return `stelaceId__${platformId}_${env}`
}

// If channel is not provided, returns total number of clients for platformId & env
function getNbClients ({ stelaceIO, platformId, env, channel }) {
  return new Promise((resolve, reject) => {
    const c = channel || platformChannel({ platformId, env })

    stelaceIO.of('/signal').adapter.clients([c], function (err, clients) {
      const nbClients = clients.length
      debug(`Currently ${nbClients} clients in ${c} channel`)

      if (err) {
        logError(err, {
          platformId,
          env,
          custom: { channel: c },
          message: `Fails to get number clients in ${c} channel from redis adapter`
        })
        return reject(createError(500, err))
      }

      resolve(nbClients)
    })
  })
}

function stop () {
  if (!isServiceActive) return

  responder.close()
  responder = null

  publisher.close()
  publisher = null

  sockend.close()
  sockend = null

  apiKeyRequester.close()
  apiKeyRequester = null

  userRequester.close()
  userRequester = null

  redisPubClient.quit()
  redisSubClient.quit()
}

module.exports = {
  start,
  stop
}
