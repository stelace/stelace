const { Joi, objectIdParamsSchema } = require('../../util/validation')
const { DEFAULT_NB_RESULTS_PER_PAGE } = require('../../util/pagination')

const signersSchema = Joi.object().pattern(
  Joi.string().required(),
  Joi.alternatives().try(
    Joi.any().valid(null), // null
    Joi.object().keys({ // or signer object
      comment: Joi.string().allow('', null),
      statement: Joi.string().allow('pass', 'challenge', null)
    })
  )
)

const signCodesSchema = Joi.object().pattern(
  Joi.string(),
  Joi.alternatives().try(
    Joi.any().valid(null),
    Joi.string()
  )
)

const schemas = {}

// ////////// //
// 2019-05-20 //
// ////////// //
schemas['2019-05-20'] = {}
schemas['2019-05-20'].list = {
  query: Joi.object().keys({
    // order
    order: Joi.string().valid('asc', 'desc').default('desc'),

    // pagination
    page: Joi.number().integer().min(1).default(1),
    nbResultsPerPage: Joi.number().integer().min(1).max(100).default(DEFAULT_NB_RESULTS_PER_PAGE),

    // filters
    assetId: Joi.string().required()
  })
}
schemas['2019-05-20'].read = {
  params: objectIdParamsSchema
}
schemas['2019-05-20'].create = {
  body: Joi.object().keys({
    assetId: Joi.string().required(),
    status: Joi.string().valid('draft', 'accept', 'reject', null),
    statement: Joi.string().valid('pass', 'challenge', null),
    transactionId: Joi.string().allow(null),
    ownerId: Joi.string().allow(null),
    takerId: Joi.string().allow(null),
    emitterId: Joi.string().allow(null),
    receiverId: Joi.string().allow(null),
    signers: signersSchema,
    signCodes: signCodesSchema,
    nbSigners: Joi.number().integer().min(1),
    expirationDate: Joi.string().isoDate().allow(null),
    metadata: Joi.object().unknown(),
    platformData: Joi.object().unknown()
  }).required()
}
schemas['2019-05-20'].update = {
  params: objectIdParamsSchema,
  body: schemas['2019-05-20'].create.body
    .fork(['assetId', 'transactionId', 'ownerId', 'takerId'], schema => schema.forbidden())
}
schemas['2019-05-20'].sign = {
  params: objectIdParamsSchema,
  body: Joi.object().keys({
    signCode: Joi.string().allow('', null)
  }).required()
}
schemas['2019-05-20'].remove = {
  params: objectIdParamsSchema
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'assessment.list',
      schema: schemas['2019-05-20'].list
    },
    {
      target: 'assessment.read',
      schema: schemas['2019-05-20'].read
    },
    {
      target: 'assessment.create',
      schema: schemas['2019-05-20'].create
    },
    {
      target: 'assessment.update',
      schema: schemas['2019-05-20'].update
    },
    {
      target: 'assessment.sign',
      schema: schemas['2019-05-20'].sign
    },
    {
      target: 'assessment.remove',
      schema: schemas['2019-05-20'].remove
    }
  ]
}

module.exports = validationVersions
