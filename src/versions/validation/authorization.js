const { Joi } = require('../../util/validation')

const schemas = {}

// ////////// //
// 2019-05-20 //
// ////////// //
schemas['2019-05-20'] = {}
schemas['2019-05-20'].checkPermissions = {
  body: Joi.object().keys({
    permissions: Joi.array().items(Joi.string()).unique().required()
  }).required()
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'authorization.checkPermissions',
      schema: schemas['2019-05-20'].checkPermissions
    },
  ]
}

module.exports = validationVersions
