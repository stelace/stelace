const { Joi } = require('../../util/validation')

const externalAuthProviderSchema = Joi.object().keys({
  platformId: Joi.string().required(),
  provider: Joi.string().required()
})

const schemas = {}

// ////////// //
// 2019-05-20 //
// ////////// //
schemas['2019-05-20'] = {}
schemas['2019-05-20'].login = {
  body: Joi.object().keys({
    username: Joi.string().max(255).required(),
    password: Joi.string().max(255).required()
  }).required()
}
schemas['2019-05-20'].logout = {
  body: Joi.object().keys({
    refreshToken: Joi.string().required(),
    logoutFromExternalProvider: Joi.boolean()
  }).required()
}
schemas['2019-05-20'].createToken = {
  body: Joi.object().keys({
    grantType: Joi.string().valid('refreshToken', 'impersonateToken', 'authorizationCode').required(),
    refreshToken: Joi.string(),
    code: Joi.string(),
    userId: Joi.string(),
    sourceUserId: Joi.string(),
    roles: Joi.array().items(Joi.string()).unique(),
    permissions: Joi.array().items(Joi.string()).unique(),
    orgRoles: Joi.array().items(Joi.string()).unique()
  }).required()
}
schemas['2019-05-20'].ssoLogin = {
  params: externalAuthProviderSchema.required()
}
schemas['2019-05-20'].ssoLoginCallback = {
  params: externalAuthProviderSchema.required()
}
schemas['2019-05-20'].ssoLogoutCallback = {
  params: externalAuthProviderSchema.required()
}
schemas['2019-05-20'].checkToken = {
  body: Joi.object().keys({
    tokenType: Joi.string().valid('refreshToken', 'accessToken').required(),
    token: Joi.string().required(),
    userAgent: Joi.string()
  }).required()
}
schemas['2019-05-20'].changePassword = {
  body: Joi.object().keys({
    currentPassword: Joi.string().max(255).required(),
    newPassword: Joi.string().min(8).max(255).required()
  }).required()
}
schemas['2019-05-20'].requestPasswordReset = {
  body: Joi.object().keys({
    username: Joi.string().required()
  }).required()
}
schemas['2019-05-20'].confirmPasswordReset = {
  body: Joi.object().keys({
    resetToken: Joi.string().required(),
    newPassword: Joi.string().min(8).max(255).required()
  }).required()
}
schemas['2019-05-20'].requestTokenCheck = {
  body: Joi.object().keys({
    userId: Joi.string(),
    type: Joi.string().required(),
    expirationDate: Joi.string().isoDate(),
    redirectUrl: Joi.string().uri(),
    data: Joi.object().unknown()
  }).required()
}
schemas['2019-05-20'].confirmTokenCheck = {
  params: Joi.object().keys({
    token: Joi.string().required()
  }).required(),
  query: Joi.object().keys({
    redirect: Joi.boolean()
  })
}
schemas['2019-05-20'].authCheck = {
  body: Joi.object().keys({
    apiKey: Joi.string(),
    authorization: Joi.string()
  })
}

const validationVersions = {
  '2019-05-20': [
    {
      target: 'auth.login',
      schema: schemas['2019-05-20'].login
    },
    {
      target: 'auth.logout',
      schema: schemas['2019-05-20'].logout
    },
    {
      target: 'auth.createToken',
      schema: schemas['2019-05-20'].createToken
    },
    {
      target: 'auth.checkToken',
      schema: schemas['2019-05-20'].checkToken
    },
    {
      target: 'auth.ssoLogin',
      schema: schemas['2019-05-20'].ssoLogin
    },
    {
      target: 'auth.ssoLoginCallback',
      schema: schemas['2019-05-20'].ssoLoginCallback
    },
    {
      target: 'auth.ssoLogoutCallback',
      schema: schemas['2019-05-20'].ssoLogoutCallback
    },
    {
      target: 'password.changePassword',
      schema: schemas['2019-05-20'].changePassword
    },
    {
      target: 'password.requestPasswordReset',
      schema: schemas['2019-05-20'].requestPasswordReset
    },
    {
      target: 'password.confirmPasswordReset',
      schema: schemas['2019-05-20'].confirmPasswordReset
    },
    {
      target: 'token.requestCheck',
      schema: schemas['2019-05-20'].requestTokenCheck
    },
    {
      target: 'token.confirmCheck',
      schema: schemas['2019-05-20'].confirmTokenCheck
    }
  ]
}

module.exports = validationVersions
