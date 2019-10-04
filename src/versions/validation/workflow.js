const Joi = require('@hapi/joi')

const { objectIdParamsSchema } = require('../../util/validation')
const { apiVersions } = require('../util')

const computedSchema = Joi.object().max(20)
const contextSchema = Joi.array().unique().items(Joi.string()).single()
const descriptionSchema = Joi.string().max(2048).allow('', null)
const booleanExpressionSchema = Joi.string().max(1024).allow('', null)

const runSchema = Joi.array().items(Joi.object({
  name: Joi.string().max(255),
  description: descriptionSchema,
  computed: computedSchema,
  filter: booleanExpressionSchema,
  stop: booleanExpressionSchema,
  skip: booleanExpressionSchema,
  handleErrors: Joi.boolean(),
  endpointMethod: Joi.string().valid('GET', 'PATCH', 'POST', 'DELETE').required(),
  endpointUri: Joi.string()
    // allow leading $ for template strings in workflows (endpointUri: "${computed.url}")
    .regex(/^(\/|http|\$)/, 'full external URL like "https://your.api.com" or Stelace endpoint path like "/assets"')
    .required(),
  endpointPayload: Joi.object(),
  endpointHeaders: Joi.object().pattern(Joi.string(), Joi.string())
})).single().max(10)

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
    description: descriptionSchema,
    context: contextSchema,
    notifyUrl: Joi.string().uri(),
    event: Joi.string(),
    computed: computedSchema,
    run: runSchema,
    apiVersion: Joi.string().valid(...apiVersions),
    active: Joi.boolean(),
    metadata: Joi.object().unknown(),
    platformData: Joi.object().unknown()
  }).required()
}
schemas['2019-05-20'].update = {
  params: objectIdParamsSchema,
  body: schemas['2019-05-20'].create.body
    .optionalKeys('name')
}
schemas['2019-05-20'].remove = {
  params: objectIdParamsSchema
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'workflow.list',
      schema: schemas['2019-05-20'].list
    },
    {
      target: 'workflow.read',
      schema: schemas['2019-05-20'].read
    },
    {
      target: 'workflow.create',
      schema: schemas['2019-05-20'].create
    },
    {
      target: 'workflow.update',
      schema: schemas['2019-05-20'].update
    },
    {
      target: 'workflow.remove',
      schema: schemas['2019-05-20'].remove
    }
  ]
}

module.exports = validationVersions
