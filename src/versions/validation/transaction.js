const { Joi, objectIdParamsSchema, getRangeFilter } = require('../../util/validation')
const { DEFAULT_NB_RESULTS_PER_PAGE } = require('../../util/list')
const { allowedTimeUnits } = require('../../util/time')

const orderByFields = [
  'createdDate',
  'updatedDate'
]

const durationSchema = Joi.object().pattern(
  Joi.string().valid(...allowedTimeUnits),
  Joi.number().integer().min(1)
).length(1)

const schemas = {}

// ////////// //
// 2019-05-20 //
// ////////// //
schemas['2019-05-20'] = {}
schemas['2019-05-20'].preview = {
  body: Joi.object().keys({
    assetId: Joi.string().required(),
    startDate: Joi.string().isoDate(),
    endDate: Joi.string().isoDate(),
    duration: durationSchema,
    quantity: Joi.number().integer().min(1),
    value: Joi.number().min(0),
    ownerAmount: Joi.number().min(0),
    takerAmount: Joi.number().min(0),
    metadata: Joi.object().unknown(),
    platformData: Joi.object().unknown()
  })
    .oxor('endDate', 'duration')
    .required()
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
    id: [Joi.string(), Joi.array().unique().items(Joi.string())],
    createdDate: getRangeFilter(Joi.string().isoDate()),
    updatedDate: getRangeFilter(Joi.string().isoDate()),
    assetId: [Joi.string(), Joi.array().unique().items(Joi.string())],
    assetTypeId: [Joi.string(), Joi.array().unique().items(Joi.string())],
    ownerId: [Joi.string(), Joi.array().unique().items(Joi.string())],
    takerId: [Joi.string(), Joi.array().unique().items(Joi.string())],
    value: getRangeFilter(Joi.number().min(0)),
    ownerAmount: getRangeFilter(Joi.number().min(0)),
    takerAmount: getRangeFilter(Joi.number().min(0)),
    platformAmount: getRangeFilter(Joi.number().min(0))
  })
}
schemas['2019-05-20'].read = {
  params: objectIdParamsSchema
}
schemas['2019-05-20'].create = {
  body: Joi.object().keys({
    assetId: Joi.string(),
    startDate: Joi.string().isoDate(),
    endDate: Joi.string().isoDate(),
    duration: durationSchema,
    quantity: Joi.number().integer().min(1),
    value: Joi.number().min(0),
    ownerAmount: Joi.number().min(0),
    takerAmount: Joi.number().min(0),
    takerId: Joi.string(),
    metadata: Joi.object().unknown(),
    platformData: Joi.object().unknown()
  })
    .oxor('endDate', 'duration')
    .required()
}
schemas['2019-05-20'].update = {
  params: objectIdParamsSchema,
  body: schemas['2019-05-20'].create.body
    .keys({
      status: Joi.string()
    })
}
schemas['2019-05-20'].createTransition = {
  params: objectIdParamsSchema,
  body: Joi.object().keys({
    name: Joi.string().required(),
    data: Joi.object().unknown()
  }).required()
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'transaction.preview',
      schema: schemas['2019-05-20'].preview
    },
    {
      target: 'transaction.list',
      schema: schemas['2019-05-20'].list
    },
    {
      target: 'transaction.read',
      schema: schemas['2019-05-20'].read
    },
    {
      target: 'transaction.create',
      schema: schemas['2019-05-20'].create
    },
    {
      target: 'transaction.update',
      schema: schemas['2019-05-20'].update
    },
    {
      target: 'transaction.createTransition',
      schema: schemas['2019-05-20'].createTransition
    }
  ]
}

module.exports = validationVersions
