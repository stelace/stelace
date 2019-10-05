const { Joi } = require('../../util/validation')

const refreshTokenExpirationSchema = Joi.object().pattern(
  Joi.string().valid('m', 'h', 'd'),
  Joi.number().integer().min(1)
).length(1)

const singleLvlObjectSchema = Joi.object().pattern(
  Joi.string(),
  Joi.alternatives().try(
    Joi.boolean(),
    Joi.number(),
    Joi.string().allow('', null)
  )
)

const ssoConnectionSchema = Joi.object().keys({
  protocol: Joi.when('authorizationUrl', {
    is: Joi.string().required(),
    then: Joi.string().valid(...['oauth2', 'openid']).required(),
    otherwise: Joi.string()
  }),
  authorizationQueryParams: singleLvlObjectSchema.allow(null),
  tokenBodyParams: singleLvlObjectSchema.allow(null),
  clientId: Joi.string(),
  clientSecret: Joi.string(),
  afterAuthenticationUrl: Joi.string().uri(),
  userInfoMapping: singleLvlObjectSchema.allow(null),
  userMapProperties: singleLvlObjectSchema.allow(null), // DEPRECATED
  scope: Joi.string(),
  active: Joi.boolean(),

  // the following properties are only used with 'openid' protocol
  // but we don’t apply validation rules here to let switch protocols
  endSessionUrl: Joi.string().uri(),
  afterLogoutUrl: Joi.string().uri(),
  jwksUrl: Joi.string().uri().allow('', null),
  jwks: Joi.object().unknown().allow(null),
  idTokenSignedResponseAlg: Joi.string().allow('', null),
  tokenEndpointAuthSigningAlg: Joi.string().allow('', null),
  issuer: Joi.string(),

  // can only be used in conjunction with OpenID authorization code flow
  // if true, will generate a code challenge as an additional security check
  pkceEnabled: Joi.boolean(),

  // custom SSO connection
  isCustom: Joi.boolean(), // ensures we have no name conflicts in the future without any naming rule
  authorizationUrl: Joi.string().uri(),
  tokenUrl: Joi.string().uri(),
  userInfoUrl: Joi.string().uri()
})

const emailSchema = Joi.alternatives().try(
  Joi.string(),
  Joi.object().keys({
    name: Joi.string(),
    address: Joi.string().email()
  })
)

const schemas = {}

// ////////// //
// 2019-05-20 //
// ////////// //
schemas['2019-05-20'] = {}
schemas['2019-05-20'].read = null
schemas['2019-05-20'].update = {
  body: Joi.object({
    stelace: Joi.object().keys({
      roles: Joi.object().keys({
        whitelist: Joi.array().unique().items(Joi.string()).allow(null),
        default: Joi.array().unique().items(Joi.string()).allow(null)
      }),
      tokenCheckRedirectUrl: Joi.string().uri().allow('', null),
      search: Joi.object().keys({
        maxDistance: Joi.number().integer().positive().allow(null)
      }),

      instant: Joi.object().keys({
        serviceName: Joi.string().allow('', null),
        logoUrl: Joi.string().allow('', null),
        locale: Joi.string(),
        currency: Joi.string(),
        assetsInUniqueCountry: Joi.string().allow(null),
        assetsInUniqueCountryActive: Joi.boolean()
      }).unknown()
    }).unknown(),
    custom: Joi.object().unknown(),
    theme: Joi.object().unknown()
  }).required()
}

schemas['2019-05-20'].readPrivate = null
schemas['2019-05-20'].updatePrivate = {
  body: Joi.object({
    stelace: Joi.object().keys({
      stelaceAuthRefreshTokenExpiration: refreshTokenExpirationSchema.allow(null),
      ssoConnections: Joi.object()
        .pattern(Joi.string().max(64), ssoConnectionSchema.allow(null)),

      // https://nodemailer.com/smtp/#general-options
      email: Joi.object().keys({
        host: Joi.string().allow(null),
        port: Joi.number().integer().positive().allow(null),
        secure: Joi.boolean().allow(null),
        ignoreTLS: Joi.boolean().allow(null),
        requireTLS: Joi.boolean().allow(null),
        auth: Joi.object().keys({
          user: Joi.string().allow(null),
          pass: Joi.string().allow(null)
        }).allow(null),

        defaults: Joi.object().keys({
          from: emailSchema.allow(null),
          cc: Joi.alternatives().try(
            emailSchema,
            Joi.array().items(emailSchema)
          ).allow(null),
          bcc: Joi.alternatives().try(
            emailSchema,
            Joi.array().items(emailSchema)
          ).allow(null),
          replyTo: emailSchema.allow(null)
        }).allow(null)
      }).allow(null),

      instant: Joi.object().keys({
        stripeSecretKey: Joi.string().allow('', null),
        stripeWebhookSubscriptionSecret: Joi.string().allow('', null)
      }).unknown()
    }).unknown()
  }).required()
}

schemas['2019-05-20'].readSystem = null
schemas['2019-05-20'].updateSystem = {
  body: Joi.object({
    stelace: Joi.object().keys({
      stelaceVersion: Joi.string()
    }).unknown(),
    custom: Joi.object().unknown(),
  }).required()
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'config.read',
      schema: schemas['2019-05-20'].read
    },
    {
      target: 'config.update',
      schema: schemas['2019-05-20'].update
    },
    {
      target: 'config.readPrivate',
      schema: schemas['2019-05-20'].readPrivate
    },
    {
      target: 'config.updatePrivate',
      schema: schemas['2019-05-20'].updatePrivate
    }
  ]
}

module.exports = validationVersions
