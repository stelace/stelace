const createError = require('http-errors')

let requester

function init (server, { middlewares, helpers } = {}) {
  const {
    allowSystem
  } = middlewares
  const {
    wrapAction
  } = helpers

  // ///////// //
  // PLATFORMS //
  // ///////// //

  server.get({
    name: 'store.listPlatforms',
    path: '/store/platforms'
  }, allowSystem, wrapAction(async (req, res) => {
    return requester.send({ type: 'listPlatforms' })
  }))

  server.post({
    name: 'store.createPlatform',
    path: '/store/platforms'
  }, allowSystem, wrapAction(async (req, res) => {
    const platformId = req.body && req.body.platformId

    return requester.send({ type: 'createPlatform', platformId })
  }))

  server.del({
    name: 'store.removePlatform',
    path: '/store/platforms/:id'
  }, allowSystem, wrapAction(async (req, res) => {
    const { id: platformId } = req.params

    return requester.send({ type: 'removePlatform', platformId })
  }))

  server.post({
    name: 'store.initPlatform',
    path: '/store/platforms/:id/init'
  }, allowSystem, wrapAction(async (req, res) => {
    const {
      id: platformId
    } = req.params

    const result = await requester.send({
      type: 'initPlatform',
      platformId
    })

    return result
  }))

  server.get({
    name: 'store.checkPlatform',
    path: '/store/platforms/:id/check'
  }, allowSystem, wrapAction(async (req, res) => {
    const {
      id: platformId
    } = req.params

    const result = await requester.send({
      type: 'checkPlatform',
      platformId
    })

    return result
  }))

  // //////// //
  // ENV DATA //
  // //////// //

  server.get({
    name: 'store.getPlatformEnvData',
    path: '/store/platforms/:id/data/:env'
  }, allowSystem, wrapAction(async (req, res) => {
    const {
      id: platformId,
      env,
      key
    } = req.params

    const result = await requester.send({
      type: 'getPlatformEnvData',
      platformId,
      env,
      key
    })

    return result
  }))

  server.put({
    name: 'store.setPlatformEnvData',
    path: '/store/platforms/:id/data/:env'
  }, allowSystem, wrapAction(async (req, res) => {
    const {
      id: platformId,
      env,
      key
    } = req.params
    const payload = req.body

    const result = await requester.send({
      type: 'setPlatformEnvData',
      platformId,
      env,
      key,
      data: payload
    })

    return result
  }))

  server.del({
    name: 'store.removePlatformEnvData',
    path: '/store/platforms/:id/data/:env'
  }, allowSystem, wrapAction(async (req, res) => {
    const {
      id: platformId,
      env,
      key
    } = req.params

    const result = await requester.send({
      type: 'removePlatformEnvData',
      platformId,
      env,
      key
    })

    return result
  }))

  server.get({
    name: 'store.getPlatformEnvDataByKey',
    path: '/store/platforms/:id/data/:env/:key'
  }, allowSystem, wrapAction(async (req, res) => {
    const {
      id: platformId,
      env,
      key
    } = req.params

    const result = await requester.send({
      type: 'getPlatformEnvDataByKey',
      platformId,
      env,
      key
    })

    return result
  }))

  server.put({
    name: 'store.setPlatformEnvDataByKey',
    path: '/store/platforms/:id/data/:env/:key'
  }, allowSystem, wrapAction(async (req, res) => {
    const {
      id: platformId,
      env,
      key
    } = req.params
    const payload = req.body

    const result = await requester.send({
      type: 'setPlatformEnvDataByKey',
      platformId,
      env,
      key,
      data: payload
    })

    return result
  }))

  server.del({
    name: 'store.removePlatformEnvDataByKey',
    path: '/store/platforms/:id/data/:env/:key'
  }, allowSystem, wrapAction(async (req, res) => {
    const {
      id: platformId,
      env,
      key
    } = req.params

    const result = await requester.send({
      type: 'removePlatformEnvDataByKey',
      platformId,
      env,
      key
    })

    return result
  }))

  server.post({
    name: 'store.migrateDatabase',
    path: '/store/platforms/:id/database/migrate'
  }, allowSystem, wrapAction(async (req, res) => {
    const {
      id: platformId
    } = req.params
    const {
      dataVersion
    } = req.query
    const env = req.env

    if (!env) throw createError(400, 'Missing environment')

    const result = await requester.send({
      type: 'migrateDatabase',
      platformId,
      env,
      dataVersion
    })

    return result
  }))

  server.post({
    name: 'store.dropDatabase',
    path: '/store/platforms/:id/database/drop'
  }, allowSystem, wrapAction(async (req, res) => {
    const {
      id: platformId
    } = req.params
    const env = req.env

    if (!env) throw createError(400, 'Missing environment')

    const result = await requester.send({
      type: 'dropDatabase',
      platformId,
      env
    })

    return result
  }))

  server.post({
    name: 'store.initElasticsearch',
    path: '/store/platforms/:id/elasticsearch/init'
  }, allowSystem, wrapAction(async (req, res) => {
    const {
      id: platformId
    } = req.params
    const env = req.env

    if (!env) throw createError(400, 'Missing environment')

    const result = await requester.send({
      type: 'initElasticsearch',
      platformId,
      env
    })

    return result
  }))

  server.post({
    name: 'store.syncElasticsearch',
    path: '/store/platforms/:id/elasticsearch/sync'
  }, allowSystem, wrapAction(async (req, res) => {
    const {
      id: platformId
    } = req.params
    const env = req.env

    if (!env) throw createError(400, 'Missing environment')

    const result = await requester.send({
      type: 'syncElasticsearch',
      platformId,
      env
    })

    return result
  }))

  server.post({
    name: 'store.dropElasticsearch',
    path: '/store/platforms/:id/elasticsearch/drop'
  }, allowSystem, wrapAction(async (req, res) => {
    const {
      id: platformId
    } = req.params
    const env = req.env

    if (!env) throw createError(400, 'Missing environment')

    const result = await requester.send({
      type: 'dropElasticsearch',
      platformId,
      env
    })

    return result
  }))

  server.post({
    name: 'store.syncCache',
    path: '/store/platforms/:id/cache/sync'
  }, allowSystem, wrapAction(async (req, res) => {
    const {
      id: platformId
    } = req.params
    const env = req.env

    if (!env) throw createError(400, 'Missing environment')

    return requester.send({
      type: 'syncCache',
      platformId,
      env
    })
  }))

  server.del({
    name: 'store.deleteCache',
    path: '/store/platforms/:id/cache'
  }, allowSystem, wrapAction(async (req, res) => {
    const {
      id: platformId
    } = req.params
    const env = req.env

    if (!env) throw createError(400, 'Missing environment')

    return requester.send({
      type: 'deleteCache',
      platformId,
      env
    })
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Store route > Store Requester',
    key: 'store'
  })
}

function stop () {
  requester.close()
  requester = null
}

module.exports = {
  init,
  start,
  stop
}
