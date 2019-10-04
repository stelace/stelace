const Joi = require('@hapi/joi')

const { objectIdParamsSchema, getRangeFilter } = require('../../util/validation')
const { DEFAULT_NB_RESULTS_PER_PAGE } = require('../../util/list')

const orderByFields = [
  'name',
  'createdDate',
  'updatedDate',
  'quantity',
  'price',
  'validated',
  'active'
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
    id: [Joi.string(), Joi.array().unique().items(Joi.string())],
    createdDate: getRangeFilter(Joi.string().isoDate()),
    updatedDate: getRangeFilter(Joi.string().isoDate()),
    eventType: [Joi.string(), Joi.array().unique().items(Joi.string())],
    eventObjectId: [Joi.string(), Joi.array().unique().items(Joi.string())],
    active: Joi.boolean()
  })
}
schemas['2019-05-20'].read = {
  params: objectIdParamsSchema
}
schemas['2019-05-20'].create = {
  body: Joi.object().keys({
    executionDate: Joi.string().isoDate().allow(null),
    recurringPattern: Joi.string().allow(null),
    recurringTimezone: Joi.string().allow(null),
    eventType: Joi.string().required(),
    eventMetadata: Joi.object().unknown(),
    eventObjectId: Joi.string().allow(null),
    active: Joi.boolean(),
    metadata: Joi.object().unknown(),
    platformData: Joi.object().unknown()
  }).required()
}
schemas['2019-05-20'].update = {
  params: objectIdParamsSchema,
  body: schemas['2019-05-20'].create.body
    .optionalKeys('eventType')
}
schemas['2019-05-20'].remove = {
  params: objectIdParamsSchema
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'task.list',
      schema: schemas['2019-05-20'].list
    },
    {
      target: 'task.read',
      schema: schemas['2019-05-20'].read
    },
    {
      target: 'task.create',
      schema: schemas['2019-05-20'].create
    },
    {
      target: 'task.update',
      schema: schemas['2019-05-20'].update
    },
    {
      target: 'task.remove',
      schema: schemas['2019-05-20'].remove
    }
  ]
}

module.exports = validationVersions
