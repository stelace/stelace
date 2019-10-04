const Joi = require('@hapi/joi')

const { objectIdParamsSchema } = require('../../util/validation')
const { allowedTimeUnits } = require('../../util/time')

const namespaceSchema = Joi.object().keys({
  visibility: Joi.object().pattern(
    Joi.string(),
    Joi.array().items(
      Joi.string()
    ).unique()
  )
})

const durationSchema = Joi.object().pattern(
  Joi.string().valid(...allowedTimeUnits),
  Joi.number().integer().min(1)
).length(1)

const schemas = {}

// ////////// //
// 2019-05-20 //
// ////////// //
schemas['2019-05-20'] = {}
schemas['2019-05-20'].list = null
schemas['2019-05-20'].read = {
  params: objectIdParamsSchema
}
schemas['2019-05-20'].create = {
  body: Joi.object().keys({
    name: Joi.string().max(255).required(),
    timeBased: Joi.boolean().required(),
    infiniteStock: Joi.boolean(),
    pricing: Joi.object().keys({
      ownerFeesPercent: Joi.number().integer().min(0).max(100),
      takerFeesPercent: Joi.number().integer().min(0).max(100)
    }),
    timing: Joi.object().keys({
      timeUnit: Joi.string().valid(...allowedTimeUnits),
      minDuration: durationSchema.allow(null),
      maxDuration: durationSchema.allow(null)
    }),
    transactionProcess: Joi.object().keys({
      initStatus: Joi.string().required(),
      cancelStatus: Joi.string().required(),
      transitions: Joi.array().items(
        Joi.object().keys({
          name: Joi.string().required(),
          from: Joi.string().required(),
          to: Joi.string().required(),
          actors: Joi.array().unique().items(Joi.string())
        })
      )
    }).allow(null),
    namespaces: namespaceSchema,
    unavailableWhen: Joi.array().unique().items(Joi.string()),
    isDefault: Joi.boolean(),
    active: Joi.boolean(),
    metadata: Joi.object().unknown(),
    platformData: Joi.object().unknown()
  }).required()
}
schemas['2019-05-20'].update = {
  params: objectIdParamsSchema,
  body: schemas['2019-05-20'].create.body
    .optionalKeys('name', 'timeBased')
}
schemas['2019-05-20'].remove = {
  params: objectIdParamsSchema
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'assetType.list',
      schema: schemas['2019-05-20'].list
    },
    {
      target: 'assetType.read',
      schema: schemas['2019-05-20'].read
    },
    {
      target: 'assetType.create',
      schema: schemas['2019-05-20'].create
    },
    {
      target: 'assetType.update',
      schema: schemas['2019-05-20'].update
    },
    {
      target: 'assetType.remove',
      schema: schemas['2019-05-20'].remove
    }
  ]
}

module.exports = validationVersions
