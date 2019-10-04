const Joi = require('@hapi/joi')

const { objectIdParamsSchema } = require('../../util/validation')
const { DEFAULT_NB_RESULTS_PER_PAGE } = require('../../util/list')

const orderByFields = [
  'name',
  'createdDate',
  'updatedDate'
]

const schemas = {}

// ////////// //
// 2019-05-20 //
// ////////// //
schemas['2019-05-20'] = {}
schemas['2019-05-20'].list = {
  query: Joi.object().keys({
    // order
    orderBy: Joi.string().valid(...orderByFields).default('createdDate'),
    order: Joi.string().valid('asc', 'desc').default('desc'),

    // pagination
    page: Joi.number().integer().min(1).default(1),
    nbResultsPerPage: Joi.number().integer().min(1).max(100).default(DEFAULT_NB_RESULTS_PER_PAGE),

    // filters
    id: [Joi.string(), Joi.array().unique().items(Joi.string())]
  })
}
schemas['2019-05-20'].read = {
  params: objectIdParamsSchema
}
schemas['2019-05-20'].create = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    type: Joi.string().valid('number', 'boolean', 'text', 'select', 'tags').required(),
    listValues: Joi.array().items(Joi.string()),
    metadata: Joi.object().unknown(),
    platformData: Joi.object().unknown()
  }).required()
}
schemas['2019-05-20'].update = {
  params: objectIdParamsSchema,
  body: schemas['2019-05-20'].create.body
    .forbiddenKeys('name', 'type')
}
schemas['2019-05-20'].remove = {
  params: objectIdParamsSchema
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'customAttribute.list',
      schema: schemas['2019-05-20'].list
    },
    {
      target: 'customAttribute.read',
      schema: schemas['2019-05-20'].read
    },
    {
      target: 'customAttribute.create',
      schema: schemas['2019-05-20'].create
    },
    {
      target: 'customAttribute.update',
      schema: schemas['2019-05-20'].update
    },
    {
      target: 'customAttribute.remove',
      schema: schemas['2019-05-20'].remove
    }
  ]
}

module.exports = validationVersions
