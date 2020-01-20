const createError = require('http-errors')
const _ = require('lodash')
const { transaction } = require('objection')

const { logError } = require('../../server/logger')
const { getModels } = require('../models')

const {
  getCurrentUserId
} = require('../util/user')

const { getObjectId } = require('stelace-util-keys')

const { performListQuery } = require('../util/listQueryBuilder')

let responder
let subscriber
let publisher
let transactionRequester

function start ({ communication }) {
  const {
    getResponder,
    getSubscriber,
    getRequester,
    getPublisher,
    COMMUNICATION_ID
  } = communication

  responder = getResponder({
    name: 'Assessment Responder',
    key: 'assessment'
  })

  subscriber = getSubscriber({
    name: 'Assessment subscriber',
    key: 'assessment',
    namespace: COMMUNICATION_ID,
    subscribesTo: [
      'assessmentCreated',
      'assessmentDraftUpdated',
      'assessmentSigned',
      'assessmentReverted',
      'assessmentDeleted'
    ]
  })

  publisher = getPublisher({
    name: 'Assessment publisher',
    key: 'assessment',
    namespace: COMMUNICATION_ID
  })

  transactionRequester = getRequester({
    name: 'Assessement service > Transaction Requester',
    key: 'transaction'
  })

  responder.on('list', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Assessment } = await getModels({ platformId, env })

    const {
      order,

      page,
      nbResultsPerPage,

      assetId
    } = req

    const orderBy = 'assessmentDate'

    const queryBuilder = Assessment.query()

    const paginationMeta = await performListQuery({
      queryBuilder,
      filters: {
        assetId: {
          dbField: 'assetId',
          value: assetId
        }
      },
      paginationActive: true,
      paginationConfig: {
        page,
        nbResultsPerPage
      },
      orderConfig: {
        orderBy,
        order
      }
    })

    paginationMeta.results = paginationMeta.results.map(assessment => {
      const exposedAssessment = Assessment.expose(assessment, { req })

      return Object.assign({}, exposedAssessment, {
        signCodes: {}
      })
    })

    return paginationMeta
  })

  responder.on('read', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Assessment } = await getModels({ platformId, env })

    const {
      assessmentId
    } = req

    const assessment = await Assessment.query().findById(assessmentId)
    if (!assessment) {
      throw createError(404)
    }

    const currentUserId = getCurrentUserId(req)

    const isSelf = Assessment.isSelf(assessment, currentUserId)
    if (!req._matchedPermissions['assessment:read:all'] && !isSelf) {
      throw createError(403)
    }

    const exposedSignCodes = getExposedSignCodes({
      assessment,
      isSelf,
      currentUserId,
      req
    })

    assessment.signCodes = exposedSignCodes

    return Assessment.expose(assessment, { req })
  })

  responder.on('create', async (req) => {
    const fields = [
      'assetId',
      'status',
      'statement',
      'transactionId',
      'ownerId',
      'takerId',
      'emitterId',
      'receiverId',
      'signers',
      'nbSigners',
      'expirationDate',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const platformId = req.platformId
    const env = req.env
    const {
      Assessment,
      Asset
    } = await getModels({ platformId, env })

    const createAttrs = Object.assign({
      id: await getObjectId({ prefix: Assessment.idPrefix, platformId, env })
    }, payload)

    if (!createAttrs.status) {
      createAttrs.status = 'draft'
    }

    const {
      assetId,
      transactionId,
      signers,
      signCodes
    } = payload
    let {
      ownerId,
      takerId
    } = payload

    const [
      asset,
      transaction
    ] = await Promise.all([
      Asset.query().findById(assetId),
      transactionId ? transactionRequester.send({
        type: '_getTransaction',
        transactionId,
        platformId,
        env
      }) : null
    ])

    if (!asset) {
      throw createError(422, 'Asset not found')
    }
    if (transactionId && !transaction) {
      throw createError(422, 'Transaction not found')
    }
    if (ownerId && asset.ownerId !== ownerId) {
      throw createError(422, `The provided owner (ID ${ownerId}) doesn't match with the asset owner (ID ${asset.ownerId})`)
    }
    if (transaction) {
      if (transaction.assetId !== assetId) {
        throw createError(422, `The transaction (asset ID ${transaction.assetId}) and the asset (ID ${assetId}) does not match`)
      }
      if (takerId && transaction.takerId !== takerId) {
        throw createError(422, `The provided taker (ID ${takerId}) doesn't match with the transaction taker (ID ${transaction.takerId})`)
      }
    }

    // automatically set the ownerId if not provided
    if (!ownerId) {
      ownerId = asset.ownerId
      createAttrs.ownerId = ownerId
    }

    // automatically set the takerId if not provided
    if (!takerId && transaction) {
      takerId = transaction.takerId
      createAttrs.takerId = transaction.takerId
    }

    let signersIds
    if (signers) {
      signersIds = Object.keys(signers)
    } else {
      signersIds = []
    }

    if (signersIds.length) {
      const transformedSigners = {}
      const transformedSignCodes = {}

      // transform signers and signCodes objects depending on the create params
      // and the hook config
      signersIds.forEach((signerId, index) => {
        const signerObj = signers[signerId]

        transformedSigners[signerId] = Object.assign({}, {
          comment: null,
          statement: null,
          signedDate: null
        }, signerObj)

        if (signCodes && typeof signCodes[signerId] !== 'undefined') {
          transformedSignCodes[signerId] = signCodes[signerId]
        } else {
          transformedSignCodes[signerId] = null
        }
      })

      createAttrs.signers = transformedSigners
      createAttrs.signCodes = transformedSignCodes
    }

    // associate a date with the assessment
    createAttrs.assessmentDate = new Date().toISOString()

    const assessment = await Assessment.query().insert(createAttrs)

    publisher.publish('assessmentCreated', {
      assessment,
      eventDate: assessment.createdDate,
      platformId,
      env
    })

    return Assessment.expose(assessment, { req })
  })

  responder.on('update', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Assessment } = await getModels({ platformId, env })

    const assessmentId = req.assessmentId

    const fields = [
      'status',
      'statement',
      'emitterId',
      'receiverId',
      'signers',
      'signCodes',
      'nbSigners',
      'expirationDate',
      'metadata',
      'platformData'
    ]

    const payload = _.pick(req, fields)

    const {
      signers,
      signCodes,
      metadata,
      platformData
    } = payload

    const now = new Date().toISOString()

    const knex = Assessment.knex()

    const currentUserId = getCurrentUserId(req)

    let isSelf
    let assessment
    let newAssessment
    let updateAttrsBeforeFullDataMerge

    await transaction(knex, async (trx) => {
      assessment = await Assessment.query(trx).forUpdate()
        .findById(assessmentId)
      if (!assessment) {
        throw createError(404)
      }

      isSelf = Assessment.isSelf(assessment, currentUserId)
      if (!req._matchedPermissions['assessment:edit:all'] && !isSelf) {
        throw createError(403)
      }

      const updatingAssessmentConfig = isUpdatingAssessmentConfig({
        assessment,
        currentUserId,
        payload
      })
      const canUpdateConfig = isAllowedToUpdateConfig({ isSelf, req })

      if (updatingAssessmentConfig && !canUpdateConfig) {
        throw createError(403)
      }

      // a normal signer cannot update an assessment if it is signed or expired
      if (!canUpdateConfig) {
        if (assessment.signedDate) {
          throw createError(422, 'Cannot update a signed assessment')
        }
        if (assessment.expirationDate && assessment.expirationDate < now) {
          throw createError(422, 'Assessment expired')
        }
      }

      const updateAttrs = _.omit(payload, ['signers', 'signCodes', 'metadata', 'platformData'])

      const transformedSignCodes = Object.assign({}, assessment.signCodes, signCodes)

      let newSignersIds
      if (signers) {
        newSignersIds = Object.keys(signers)
      } else {
        newSignersIds = []
      }

      if (newSignersIds.length) {
        const currentSigners = assessment.signers

        const transformedSigners = _.cloneDeep(assessment.signers)

        // transform signers and signCodes objects depending on the update params
        // and the hook config
        newSignersIds.forEach((signerId, index) => {
          const currentSigner = currentSigners[signerId]
          if (currentSigner && currentSigner.signedDate) {
            throw createError(422,
              'Cannot update a signer’s config after own signature on ' +
              new Date(currentSigner.signedDate).toGMTString(), {
                public: { signerId }
              })
          }

          const signerObj = signers[signerId]

          if (signerObj === null) {
            delete transformedSigners[signerId]
            delete transformedSignCodes[signerId]
          } else {
            transformedSigners[signerId] = Object.assign({}, {
              comment: null,
              statement: null,
              signedDate: null
            }, signerObj)

            if (typeof transformedSignCodes[signerId] === 'undefined') {
              if (signCodes && typeof signCodes[signerId] !== 'undefined') {
                transformedSignCodes[signerId] = signCodes[signerId]
              } else {
                transformedSignCodes[signerId] = null
              }
            }
          }

          updateAttrs.signers = transformedSigners
        })
      }

      // save the sign codes only if different than the previous version
      if (!_.isEqual(transformedSignCodes, assessment.signCodes)) {
        updateAttrs.signCodes = transformedSignCodes
      }

      updateAttrsBeforeFullDataMerge = Object.assign({}, updateAttrs, {
        metadata,
        platformData
      })

      if (metadata) {
        updateAttrs.metadata = Assessment.rawJsonbMerge('metadata', metadata)
      }
      if (platformData) {
        updateAttrs.platformData = Assessment.rawJsonbMerge('platformData', platformData)
      }

      newAssessment = await Assessment.query(trx).patchAndFetchById(assessmentId, updateAttrs)
    })

    publisher.publish('assessmentDraftUpdated', {
      assessmentId,
      assessment,
      newAssessment,
      updateAttrs: updateAttrsBeforeFullDataMerge,
      eventDate: newAssessment.updatedDate,
      platformId,
      env
    })

    const exposedSignCodes = getExposedSignCodes({
      assessment: newAssessment,
      isSelf,
      currentUserId,
      req
    })

    newAssessment.signCodes = exposedSignCodes

    return Assessment.expose(newAssessment, { req })
  })

  responder.on('sign', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Assessment } = await getModels({ platformId, env })

    const {
      assessmentId,
      signCode
    } = req

    const currentUserId = getCurrentUserId(req)
    // must be logged as a user
    if (!currentUserId) {
      throw createError(403)
    }

    const now = new Date().toISOString()

    const knex = Assessment.knex()

    let assessment
    let isSelf
    let updateAttrs

    await transaction(knex, async (trx) => {
      assessment = await Assessment.query(trx).forUpdate()
        .findById(assessmentId)
      if (!assessment) {
        throw createError(404)
      }

      isSelf = Assessment.isSelf(assessment, currentUserId)
      if (!isSelf) {
        throw createError(403)
      }

      if (assessment.signedDate) {
        throw createError(422, `Assessment already signed on ${
          new Date(assessment.signedDate).toGMTString()
        }`)
      }
      if (assessment.expirationDate && assessment.expirationDate < now) {
        throw createError(403, `Assessment expired on ${
          new Date(assessment.expirationDate).toGMTString()
        }`)
      }

      const signerObj = assessment.signers[currentUserId]
      const checkSignCode = assessment.signCodes[currentUserId]

      if (signerObj && signerObj.signedDate) {
        throw createError(422, 'User already signed')
      }
      if (checkSignCode) {
        if (!signCode) {
          throw createError(403, 'Missing sign code')
        } else if (checkSignCode !== signCode) {
          throw createError(403, 'Invalid sign code')
        }
      }

      const newSigners = _.cloneDeep(assessment.signers)
      newSigners[currentUserId].signedDate = now

      updateAttrs = {
        signers: newSigners
      }

      const newSignInformation = getAssessmentNewSignInformation(assessment, currentUserId)

      updateAttrs.status = newSignInformation.status
      updateAttrs.statement = newSignInformation.statement

      if (newSignInformation.signal === 'all') { // if all parties signed
        updateAttrs.signedDate = now // set the assessment signed date
      }

      assessment = await Assessment.query(trx).patchAndFetchById(assessmentId, updateAttrs)
    })

    publisher.publish('assessmentSigned', {
      assessmentId,
      assessment,
      updateAttrs,
      eventDate: now,
      platformId,
      env
    })

    const exposedSignCodes = getExposedSignCodes({
      assessment,
      isSelf,
      currentUserId,
      req
    })

    assessment.signCodes = exposedSignCodes

    return Assessment.expose(assessment, { req })
  })

  responder.on('remove', async (req) => {
    const platformId = req.platformId
    const env = req.env
    const { Assessment } = await getModels({ platformId, env })

    const {
      assessmentId
    } = req

    const assessment = await Assessment.query().findById(assessmentId)
    if (!assessment) {
      return { id: assessmentId }
    }

    if (!req._matchedPermissions['assessment:remove:all']) {
      throw createError(403)
    }
    if (assessment.signedDate) {
      throw createError(422, 'Signed assessment cannot be deleted')
    }

    await Assessment.query().deleteById(assessmentId)

    publisher.publish('assessmentDeleted', {
      assessmentId,
      assessment,
      eventDate: new Date().toISOString(),
      platformId,
      env
    })

    return { id: assessmentId }
  })

  // EVENTS

  subscriber.on('assessmentCreated', async ({ assessment, eventDate, platformId, env } = {}) => {
    try {
      const { Assessment, Event } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'assessment__created',
        objectId: assessment.id,
        object: Assessment.expose(assessment, { namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { assessmentId: assessment.id },
        message: 'Fail to create event assessment__created'
      })
    }
  })

  subscriber.on('assessmentDraftUpdated', async ({
    assessmentId,
    // assessment,
    newAssessment,
    updateAttrs,
    eventDate,
    platformId,
    env
  } = {}) => {
    try {
      const { Assessment, Event } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'assessment__draft_updated',
        objectId: assessmentId,
        object: Assessment.expose(newAssessment, { namespaces: ['*'] }),
        changesRequested: Assessment.expose(updateAttrs, { namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { assessmentId },
        message: 'Fail to create event assessment__draft_updated'
      })
    }
  })

  subscriber.on('assessmentSigned', async ({ assessmentId, assessment, updateAttrs, eventDate, platformId, env } = {}) => {
    let eventType

    try {
      const { Assessment, Event } = await getModels({ platformId, env })

      eventType = assessment.signedDate ? 'assessment__signed' : 'assessment__signed_once'

      await Event.createEvent({
        createdDate: eventDate,
        type: eventType,
        objectId: assessmentId,
        object: Assessment.expose(assessment, { namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { assessmentId },
        message: `Fail to create event ${eventType || 'assessment__signed'}`
      })
    }
  })

  subscriber.on('assessmentDeleted', async ({
    assessmentId,
    assessment,
    eventDate,
    platformId,
    env
  } = {}) => {
    try {
      const { Event, Assessment } = await getModels({ platformId, env })

      await Event.createEvent({
        createdDate: eventDate,
        type: 'assessment__deleted',
        objectId: assessmentId,
        object: Assessment.expose(assessment, { namespaces: ['*'] })
      }, { platformId, env })
    } catch (err) {
      logError(err, {
        platformId,
        env,
        custom: { assessmentId },
        message: 'Fail to create event assessment__deleted'
      })
    }
  })
}

function getExposedSignCodes ({ assessment, isSelf, currentUserId, req }) {
  let exposedSignCodes = {} // show no codes by default

  // has config on this object
  if (req._matchedPermissions['assessment:config:all'] ||
    (req._matchedPermissions['assessment:config'] && isSelf)
  ) {
    // show all codes
    exposedSignCodes = assessment.signCodes
  // is only signers to this object
  } else if (isSelf) {
    // show only own code
    exposedSignCodes = {
      [currentUserId]: assessment.signCodes[currentUserId]
    }
  }

  return exposedSignCodes
}

function isUpdatingAssessmentConfig ({ assessment, currentUserId, payload }) {
  const {
    status,
    statement,
    emitterId,
    receiverId,
    signers,
    signCodes,
    nbSigners,
    expirationDate
  } = payload

  const updateSigners = !!signers
  let updateSelfSigner = false

  if (currentUserId && updateSigners) {
    const signersIds = Object.keys(signers)

    if (signersIds.length === 1 &&
      signersIds.includes(currentUserId) &&
      typeof signers[currentUserId] === 'object' &&
      signers[currentUserId] // prevents null value
    ) {
      updateSelfSigner = true
    }
  }

  return !!(status ||
    statement ||
    emitterId ||
    receiverId ||
    signCodes ||
    typeof nbSigners !== 'undefined' ||
    typeof expirationDate !== 'undefined' ||
    (updateSigners && !updateSelfSigner))
}

function isAllowedToUpdateConfig ({ isSelf, req }) {
  if (req._matchedPermissions['assessment:config:all']) {
    return true
  }
  if (req._matchedPermissions['assessment:config'] && isSelf) {
    return true
  }

  return false
}

/**
 * Determine if the assessment is not signed at all, partial signed or signed
 * and the updated statement and status
 * @param {Object} assessment
 * @param {String} currentUserId
 * @return {Object} result
 * @return {String} result.signal - can have the following values: "none", "partial", "all"
 * @return {String} result.status - can have the following values: "draft", "accept", "reject", null
 * @return {String} result.statement - can have the following values: "pass", "challenge", null
 */
function getAssessmentNewSignInformation (assessment, currentUserId) {
  let nbSignatures = 0

  let currentSignerInfo

  _.forEach(assessment.signers, (signer, signerId) => {
    const isSigningRightNow = signerId === currentUserId

    if (isSigningRightNow) currentSignerInfo = signer
    if (isSigningRightNow || signer.signedDate) nbSignatures += 1
  })

  if (!currentSignerInfo) {
    throw new Error('The user is not authorized to sign')
  }

  let signal = 'none'

  if (assessment.nbSigners <= nbSignatures) {
    signal = 'all'
  } else if (nbSignatures > 0) {
    signal = 'partial'
  }

  // order by importance (from negative to positive to neutral)
  const statusLevels = [
    'reject',
    'accept',
    'draft',
    null
  ]

  // order by importance (from negative to positive to neutral)
  const statementLevels = [
    'challenge',
    'pass',
    null
  ]

  let status
  let statement

  const currentStatusLevel = statusLevels.indexOf(assessment.status)
  const currentStatementLevel = statementLevels.indexOf(assessment.statement)

  const signerStatementLevel = statementLevels.indexOf(currentSignerInfo.statement || 'pass')
  let signerStatusLevel

  // if the current signer statement has higher importance than the current statement
  // replace the current statement by it
  if (signerStatementLevel < currentStatementLevel) {
    statement = statementLevels[signerStatementLevel]
  }

  // if the current signer status has higher importance than the current status
  // replace the current status by it
  if (signal === 'all' &&
    assessment.statement !== 'challenge' &&
    currentSignerInfo.statement !== 'challenge'
  ) {
    signerStatusLevel = statusLevels.indexOf('accept') // set to "accept" if there is no problem
  } else {
    signerStatusLevel = statusLevels.indexOf('draft')
  }

  if (signerStatusLevel < currentStatusLevel) {
    status = statusLevels[signerStatusLevel]
  }

  return {
    signal,
    statement,
    status
  }
}

function stop () {
  responder.close()
  responder = null

  subscriber.close()
  subscriber = null

  publisher.close()
  publisher = null

  transactionRequester.close()
  transactionRequester = null
}

module.exports = {
  start,
  stop
}
