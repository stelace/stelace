const Joi = require('@hapi/joi')

const { objectIdParamsSchema } = require('../../util/validation')
const { DEFAULT_NB_RESULTS_PER_PAGE } = require('../../util/list')
const { allowedTimeUnits } = require('../../util/time')

const durationSchema = Joi.object().pattern(
  Joi.string().valid(...allowedTimeUnits),
  Joi.number().integer().min(1)
).length(1)

const quantitySchema = Joi.alternatives().try([
  Joi.string().regex(/^[+-]\d+$/), // relative quantity, put the string type before the number because Joi will autoconvert '+1' into 1
  Joi.number().integer().min(0) // fixed quantity
])

const orderByFields = [
  'createdDate',
  'updatedDate'
]

const schemas = {}

// ////////// //
// 2019-05-20 //
// ////////// //
schemas['2019-05-20'] = {}
schemas['2019-05-20'].getGraph = {
  query: Joi.object().keys({
    assetId: Joi.string().required()
  })
}
schemas['2019-05-20'].list = {
  query: Joi.object().keys({
    // order
    orderBy: Joi.string().valid(...orderByFields).default('createdDate'),
    order: Joi.string().valid('asc', 'desc').default('desc'),

    // pagination
    page: Joi.number().integer().min(1).default(1),
    nbResultsPerPage: Joi.number().integer().min(1).max(100).default(DEFAULT_NB_RESULTS_PER_PAGE),

    // filters
    assetId: Joi.string().required()
  })
}
schemas['2019-05-20'].create = {
  body: Joi.object().keys({
    assetId: Joi.string().required(),
    startDate: Joi.string().isoDate().required(),
    endDate: Joi.string().isoDate().required(),
    quantity: quantitySchema.required(),
    recurringPattern: Joi.string().allow(null),
    recurringTimezone: Joi.string().allow(null),
    recurringDuration: durationSchema.allow(null),
    metadata: Joi.object().unknown(),
    platformData: Joi.object().unknown()
  }).required()
}
schemas['2019-05-20'].update = {
  params: objectIdParamsSchema,
  body: schemas['2019-05-20'].create.body
    .forbiddenKeys('assetId')
    .optionalKeys('startDate', 'endDate', 'quantity')
}
schemas['2019-05-20'].remove = {
  params: objectIdParamsSchema
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'availability.getGraph',
      schema: schemas['2019-05-20'].getGraph
    },
    {
      target: 'availability.list',
      schema: schemas['2019-05-20'].list
    },
    {
      target: 'availability.create',
      schema: schemas['2019-05-20'].create
    },
    {
      target: 'availability.update',
      schema: schemas['2019-05-20'].update
    },
    {
      target: 'availability.remove',
      schema: schemas['2019-05-20'].remove
    }
  ]
}

module.exports = validationVersions
