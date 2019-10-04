const Joi = require('@hapi/joi')

const channelNameSchema = Joi.string().trim().max(256)
  .regex(/^[a-z0-9-_]+$/i, 'alphanumeric, hyphen or underscore (/^[a-z0-9-_]+$/i)')
const eventNameSchema = channelNameSchema

const schemas = {}

// ////////// //
// 2019-05-20 //
// ////////// //
schemas['2019-05-20'] = {}
schemas['2019-05-20'].create = {
  body: Joi.object().keys({
    message: Joi.any(),
    destination: channelNameSchema,
    event: eventNameSchema
  }).required()
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'signal.create',
      schema: schemas['2019-05-20'].create
    }
  ]
}

module.exports = validationVersions
