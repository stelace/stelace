const { Joi, objectIdParamsSchema, getRangeFilter } = require('../../util/validation')
const { DEFAULT_NB_RESULTS_PER_PAGE } = require('../../util/list')

const orderByFields = [
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
    id: [Joi.string(), Joi.array().unique().items(Joi.string())],
    createdDate: getRangeFilter(Joi.string().isoDate()),
    updatedDate: getRangeFilter(Joi.string().isoDate()),
    userId: Joi.string(),
    senderId: Joi.string(),
    receiverId: Joi.string(),
    topicId: Joi.string(),
    conversationId: Joi.string()
  })
}
schemas['2019-05-20'].read = {
  params: objectIdParamsSchema
}
schemas['2019-05-20'].create = {
  body: Joi.object().keys({
    topicId: Joi.string().required(),
    conversationId: Joi.string(),
    content: Joi.string().allow('').max(3000).required(),
    attachments: Joi.array().items(Joi.object().unknown()),
    read: Joi.boolean(),
    senderId: Joi.string(),
    receiverId: Joi.string().required(),
    metadata: Joi.object().unknown(),
    platformData: Joi.object().unknown()
  }).required()
}
schemas['2019-05-20'].update = {
  params: objectIdParamsSchema,
  body: schemas['2019-05-20'].create.body
    .fork([
      'topicId',
      'conversationId',
      'content',
      'attachments',
      'senderId',
      'receiverId'
    ], schema => schema.forbidden())
}
schemas['2019-05-20'].remove = {
  params: objectIdParamsSchema
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'message.list',
      schema: schemas['2019-05-20'].list
    },
    {
      target: 'message.read',
      schema: schemas['2019-05-20'].read
    },
    {
      target: 'message.create',
      schema: schemas['2019-05-20'].create
    },
    {
      target: 'message.update',
      schema: schemas['2019-05-20'].update
    },
    {
      target: 'message.remove',
      schema: schemas['2019-05-20'].remove
    }
  ]
}

module.exports = validationVersions
