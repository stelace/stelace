const { Joi, objectIdParamsSchema } = require('../../util/validation')

const platformIdParamsSchema = objectIdParamsSchema

const platformIdAndEnv = Joi.object().keys({
  id: Joi.string().required(),
  env: Joi.string().required()
}).required()

const platformIdEnvAndKey = Joi.object().keys({
  id: Joi.string().required(),
  env: Joi.string().required(),
  key: Joi.string().required()
}).required()

const schemas = {}

// ////////// //
// 2019-05-20 //
// ////////// //
schemas['2019-05-20'] = {}

// PLATFORMS
schemas['2019-05-20'].listPlatforms = null
schemas['2019-05-20'].createPlatform = {
  body: Joi.object().keys({
    platformId: [Joi.string(), Joi.number().integer().min(1)]
  })
}
schemas['2019-05-20'].removePlatform = {
  params: platformIdParamsSchema
}
schemas['2019-05-20'].initPlatform = {
  params: platformIdParamsSchema
}
schemas['2019-05-20'].checkPlatform = {
  params: platformIdParamsSchema
}

// ENV DATA
schemas['2019-05-20'].getPlatformEnvData = {
  params: platformIdAndEnv
}
schemas['2019-05-20'].setPlatformEnvData = {
  params: platformIdAndEnv,
  body: Joi.object().unknown().required()
}
schemas['2019-05-20'].removePlatformEnvData = {
  params: platformIdAndEnv
}

// ENV DATA BY KEY
schemas['2019-05-20'].getPlatformEnvDataByKey = {
  params: platformIdEnvAndKey
}
schemas['2019-05-20'].setPlatformEnvDataByKey = {
  params: platformIdEnvAndKey,
  body: Joi.object().unknown().required()
}
schemas['2019-05-20'].removePlatformEnvDataByKey = {
  params: platformIdEnvAndKey
}

// DATABASE
schemas['2019-05-20'].migrateDatabase = {
  params: platformIdParamsSchema,
  query: Joi.object().keys({
    dataVersion: Joi.string()
  })
}
schemas['2019-05-20'].dropDatabase = {
  params: platformIdParamsSchema
}

// ELASTICSEARCH
schemas['2019-05-20'].initElasticsearch = {
  params: platformIdParamsSchema
}
schemas['2019-05-20'].syncElasticsearch = {
  params: platformIdParamsSchema
}
schemas['2019-05-20'].dropElasticsearch = {
  params: platformIdParamsSchema
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'store.listPlatforms',
      schema: schemas['2019-05-20'].listPlatforms
    },
    {
      target: 'store.createPlatform',
      schema: schemas['2019-05-20'].createPlatform
    },
    {
      target: 'store.removePlatform',
      schema: schemas['2019-05-20'].removePlatform
    },
    {
      target: 'store.initPlatform',
      schema: schemas['2019-05-20'].initPlatform
    },
    {
      target: 'store.checkPlatform',
      schema: schemas['2019-05-20'].checkPlatform
    },

    {
      target: 'store.getPlatformEnvData',
      schema: schemas['2019-05-20'].getPlatformEnvData
    },
    {
      target: 'store.setPlatformEnvData',
      schema: schemas['2019-05-20'].setPlatformEnvData
    },
    {
      target: 'store.removePlatformEnvData',
      schema: schemas['2019-05-20'].removePlatformEnvData
    },

    {
      target: 'store.getPlatformEnvDataByKey',
      schema: schemas['2019-05-20'].getPlatformEnvDataByKey
    },
    {
      target: 'store.setPlatformEnvDataByKey',
      schema: schemas['2019-05-20'].setPlatformEnvDataByKey
    },
    {
      target: 'store.removePlatformEnvDataByKey',
      schema: schemas['2019-05-20'].removePlatformEnvDataByKey
    },

    {
      target: 'store.migrateDatabase',
      schema: schemas['2019-05-20'].migrateDatabase
    },
    {
      target: 'store.dropDatabase',
      schema: schemas['2019-05-20'].dropDatabase
    },
    {
      target: 'store.initElasticsearch',
      schema: schemas['2019-05-20'].initElasticsearch
    },
    {
      target: 'store.syncElasticsearch',
      schema: schemas['2019-05-20'].syncElasticsearch
    },
    {
      target: 'store.dropElasticsearch',
      schema: schemas['2019-05-20'].dropElasticsearch
    },
  ]
}

module.exports = validationVersions
