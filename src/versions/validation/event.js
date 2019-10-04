const Joi = require('@hapi/joi')

const { objectIdParamsSchema, getRangeFilter } = require('../../util/validation')
const { DEFAULT_NB_RESULTS_PER_PAGE } = require('../../util/list')

const orderByFields = [
  'name',
  'createdDate',
  'updatedDate',
  'type'
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
    type: [Joi.string(), Joi.array().unique().items(Joi.string())],
    objectType: [Joi.string(), Joi.array().unique().items(Joi.string())],
    objectId: [Joi.string(), Joi.array().unique().items(Joi.string())],
    emitter: Joi.string().valid('core', 'custom', 'task'),
    emitterId: [Joi.string(), Joi.array().unique().items(Joi.string())]
  })
}
schemas['2019-05-20'].read = {
  params: objectIdParamsSchema
}
schemas['2019-05-20'].create = {
  body: Joi.object().keys({
    type: Joi.string().required(),
    emitterId: Joi.string(),
    objectId: Joi.string(),
    metadata: Joi.object().unknown()
  }).required()
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'event.list',
      schema: schemas['2019-05-20'].list
    },
    {
      target: 'event.read',
      schema: schemas['2019-05-20'].read
    },
    {
      target: 'event.create',
      schema: schemas['2019-05-20'].create
    },
  ]
}

module.exports = validationVersions
