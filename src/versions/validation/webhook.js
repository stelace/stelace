const { Joi, objectIdParamsSchema } = require('../../util/validation')
const { apiVersions } = require('../util')

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
    targetUrl: Joi.string().uri(),
    event: Joi.string(),
    apiVersion: Joi.string().valid(...apiVersions),
    active: Joi.boolean(),
    metadata: Joi.object().unknown(),
    platformData: Joi.object().unknown()
  }).required()
}
schemas['2019-05-20'].update = {
  params: objectIdParamsSchema,
  body: schemas['2019-05-20'].create.body
    .fork('targetUrl', schema => schema.forbidden())
    .fork('name', schema => schema.optional())
}
schemas['2019-05-20'].remove = {
  params: objectIdParamsSchema
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'webhook.list',
      schema: schemas['2019-05-20'].list
    },
    {
      target: 'webhook.read',
      schema: schemas['2019-05-20'].read
    },
    {
      target: 'webhook.create',
      schema: schemas['2019-05-20'].create
    },
    {
      target: 'webhook.update',
      schema: schemas['2019-05-20'].update
    },
    {
      target: 'webhook.remove',
      schema: schemas['2019-05-20'].remove
    }
  ]
}

module.exports = validationVersions
