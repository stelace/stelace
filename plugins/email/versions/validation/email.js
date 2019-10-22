const { utils } = require('../../../serverTooling')
const { validation: { Joi } } = utils

const singleLvlObjectSchema = Joi.object().pattern(
  Joi.string(),
  Joi.alternatives().try(
    Joi.boolean(),
    Joi.number(),
    Joi.string().allow('', null)
  )
)

// https://nodemailer.com/message/addresses
const emailSchema = Joi.alternatives().try(
  Joi.string(),
  Joi.object().keys({
    name: Joi.string(),
    address: Joi.string().email()
  })
)

// https://nodemailer.com/message/custom-headers
const headersSchema = Joi.object().pattern(
  Joi.string(),
  Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string()),
    Joi.object().keys({
      prepared: Joi.boolean(),
      value: Joi.string()
    })
  )
)

const schemas = {}

// ////////// //
// 2019-05-20 //
// ////////// //
schemas['2019-05-20'] = {}
schemas['2019-05-20'].send = {
  query: Joi.object().keys({
    _forceSend: Joi.boolean()
  }),
  body: Joi.object().keys({
    html: Joi.string(),
    text: Joi.string(),
    from: emailSchema,

    // Unfortunately, cannot use to: Joi.array().items(emailSchema).single()
    // Joi.array().items() doesn't seem to accept Joi.alternatives() as item
    to: Joi.alternatives().try(
      emailSchema,
      Joi.array().items(emailSchema)
    ),

    // DEPRECATED: favor `from` and `to` Nodemailer format
    fromName: Joi.string(), // not transmitted to service at all, please use `from`
    toEmail: Joi.string().email(),
    toName: Joi.string().allow('', null),
    // DEPRECATED:END

    subject: Joi.string().allow(''),
    replyTo: emailSchema,
    headers: headersSchema
  }).label('body').xor('to', 'toEmail').required()
}
schemas['2019-05-20'].sendTemplate = {
  body: Joi.object().keys({
    name: Joi.string().required(),
    data: singleLvlObjectSchema,
    locale: Joi.string(),
    currency: Joi.string(),
    timezone: Joi.string(),
    from: emailSchema,
    to: Joi.alternatives().try(
      emailSchema,
      Joi.array().items(emailSchema)
    ),

    // DEPRECATED: favor `from` and `to` Nodemailer format
    fromName: Joi.string(), // not transmitted to service at all, please use `from`
    toEmail: Joi.string().email(),
    toName: Joi.string().allow('', null),
    // DEPRECATED:END

    replyTo: emailSchema
  }).xor('to', 'toEmail').required()
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'email.send',
      schema: schemas['2019-05-20'].send
    },
    {
      target: 'email.sendTemplate',
      schema: schemas['2019-05-20'].sendTemplate
    }
  ]
}

module.exports = validationVersions
