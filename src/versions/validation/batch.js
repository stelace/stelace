const { Joi } = require('../../util/validation')

const allowedObjectTypes = [
  'asset',
  'user'
]

const objectSchema = Joi.object().keys({
  objectId: Joi.string().required(),
  payload: Joi.object().unknown().required()
})

const schemas = {}

// ////////// //
// 2019-05-20 //
// ////////// //
schemas['2019-05-20'] = {}
schemas['2019-05-20'].create = {
  body: Joi.object().keys({
    objectType: Joi.string().valid(...allowedObjectTypes).required(),
    method: Joi.string().valid('PATCH').required(),
    objects: Joi.array().items(objectSchema).max(100).required()
  }).required()
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'batch.create',
      schema: schemas['2019-05-20'].create
    }
  ]
}

module.exports = validationVersions
