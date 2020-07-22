const { Joi, objectIdParamsSchema, getRangeFilter } = require('../../util/validation')
const { DEFAULT_NB_RESULTS_PER_PAGE } = require('../../util/pagination')

const locationSchema = Joi.object().unknown().keys({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required()
})

const orderByFields = [
  'createdDate',
  'updatedDate',
]

const oldPaginationOrderByFields = [
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
// 2020-08-10 //
// ////////// //
schemas['2020-08-10'] = {}
schemas['2020-08-10'].list = () => ({
  query: schemas['2019-05-20'].list.query
    .fork('page', schema => schema.forbidden())
    .fork('orderBy', () => Joi.string().valid(...orderByFields).default('createdDate'))
    .keys({
      // cursor pagination
      startingAfter: Joi.string(),
      endingBefore: Joi.string(),
    })
    .oxor('startingAfter', 'endingBefore')
})

// ////////// //
// 2019-05-20 //
// ////////// //
schemas['2019-05-20'] = {}
schemas['2019-05-20'].list = {
  query: Joi.object().keys({
    // order
    orderBy: Joi.string().valid(...oldPaginationOrderByFields).default('createdDate'),
    order: Joi.string().valid('asc', 'desc').default('desc'),

    // pagination
    page: Joi.number().integer().min(1).default(1),
    nbResultsPerPage: Joi.number().integer().min(1).max(100).default(DEFAULT_NB_RESULTS_PER_PAGE),

    // filters
    id: [Joi.string(), Joi.array().unique().items(Joi.string())],
    createdDate: getRangeFilter(Joi.string().isoDate()),
    updatedDate: getRangeFilter(Joi.string().isoDate()),
    ownerId: [Joi.string(), Joi.array().unique().items(Joi.string())],
    categoryId: [Joi.string(), Joi.array().unique().items(Joi.string())],
    assetTypeId: [Joi.string(), Joi.array().unique().items(Joi.string())],
    validated: Joi.boolean(),
    active: Joi.boolean(),
    quantity: getRangeFilter(Joi.number().integer().min(0)),
    price: getRangeFilter(Joi.number().min(0))
  })
}
schemas['2019-05-20'].read = {
  params: objectIdParamsSchema
}
schemas['2019-05-20'].create = {
  body: Joi.object().keys({
    name: Joi.string().max(255).required(),
    ownerId: Joi.string().allow('', null),
    description: Joi.string().max(3000).allow('', null),
    categoryId: Joi.string().allow(null),
    validated: Joi.boolean(),
    active: Joi.boolean(),
    locations: Joi.array().items(locationSchema),
    assetTypeId: Joi.string(),
    quantity: Joi.number().integer().min(0),
    price: Joi.number().min(0),
    currency: Joi.string(),
    customAttributes: Joi.object().unknown(),
    metadata: Joi.object().unknown(),
    platformData: Joi.object().unknown()
  }).required()
}
schemas['2019-05-20'].update = {
  params: objectIdParamsSchema,
  body: schemas['2019-05-20'].create.body
    .fork('ownerId', schema => schema.forbidden())
    .fork('name', schema => schema.optional())
}
schemas['2019-05-20'].remove = {
  params: objectIdParamsSchema
}

const validationVersions = {
  '2020-08-10': [
    {
      target: 'asset.list',
      schema: schemas['2020-08-10'].list
    },
  ],

  '2019-05-20': [
    {
      target: 'asset.list',
      schema: schemas['2019-05-20'].list
    },
    {
      target: 'asset.read',
      schema: schemas['2019-05-20'].read
    },
    {
      target: 'asset.create',
      schema: schemas['2019-05-20'].create
    },
    {
      target: 'asset.update',
      schema: schemas['2019-05-20'].update
    },
    {
      target: 'asset.remove',
      schema: schemas['2019-05-20'].remove
    }
  ]
}

module.exports = validationVersions
