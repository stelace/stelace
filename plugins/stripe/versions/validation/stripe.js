const Joi = require('@hapi/joi')

const schemas = {}

// ////////// //
// 2019-05-20 //
// ////////// //
schemas['2019-05-20'] = {}
schemas['2019-05-20'].request = {
  body: Joi.object().keys({
    method: Joi.string().required(),
    url: Joi.string().required(),
    body: Joi.object().unknown()
  })
}
schemas['2019-05-20'].webhookSubscription = null

const validationVersions = {
  '2019-05-20': [
    {
      target: 'stripe.request',
      schema: schemas['2019-05-20'].request
    },
    {
      target: 'stripe.webhooks.subscription',
      schema: schemas['2019-05-20'].webhookSubscription
    }
  ]
}

module.exports = validationVersions
