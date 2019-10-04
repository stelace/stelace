// Inspired by: https://github.com/panva/node-oidc-provider-example/blob/master/03-oidc-views-accounts/index.js

const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const Provider = require('oidc-provider')
const _ = require('lodash')

const Account = require('./account')
const adapter = require('./adapter')
const { generateJwks } = require('./jwks')

module.exports = function createOidcServer ({
  issuer,
  loginRedirectUrl,
  logoutRedirectUrl,
  clientId = 'clientId',
  clientSecret = 'clientSecret'
}) {
  const oidc = new Provider(issuer, {
    // token serialization format
    // https://github.com/panva/node-oidc-provider/blob/master/docs/README.md#formats
    // defined to avoid warning in testing environment
    formats: {
      default: 'opaque',
    },

    // options for cookie module
    // https://github.com/panva/node-oidc-provider/blob/master/docs/README.md#cookies
    // defined to avoid warning in testing environment
    cookies: {
      keys: ['openid']
    },

    // if true, will display an UI for login and accepts any credentials
    // https://github.com/panva/node-oidc-provider/blob/master/docs/README.md#featuresdevinteractions
    // defined to avoid warning in testing environment
    features: {
      // disable the packaged interactions
      devInteractions: { enabled: false },

      introspection: { enabled: true },
      revocation: { enabled: true }
    },

    // https://github.com/panva/node-oidc-provider/blob/master/docs/README.md#adapter
    // defined to avoid warning in testing environment
    // default Memory adapter for development environment
    adapter,

    clients: [{
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uris: _.flatten([loginRedirectUrl]),
      post_logout_redirect_uris: _.flatten([logoutRedirectUrl]),
      // response_types: ['id_token'],
      // grant_types: ['authorization_code', 'implicit'],
      // token_endpoint_auth_method: 'none',
    }],

    jwks: generateJwks(),

    // https://github.com/panva/node-oidc-provider/blob/master/docs/README.md#findaccount
    // oidc-provider only looks up the accounts by their ID when it has to read the claims,
    // passing it our Account model method is sufficient, it should return a Promise that resolves
    // with an object with accountId property and a claims method.
    findAccount: Account.findAccount,

    // let's tell oidc-provider you also support the email scope, which will contain email and
    // email_verified claims
    claims: {
      openid: ['sub'],
      name: ['name', 'first_name', 'last_name'],
      email: ['email', 'email_verified'],
      iss: issuer
    },

    interactionUrl (ctx) {
      return `/interaction/${ctx.oidc.uid}`
    },

    // HTML to show when the logout endpoint is hit
    // https://github.com/panva/node-oidc-provider/blob/master/docs/README.md#logoutsource
    // defined to avoid warning in testing environment
    async logoutSource (ctx, form) {
      ctx.body = `
        <!DOCTYPE html>
        <head>
        <title>Logout Request</title>
        <style>/* css and html classes omitted for brevity, see lib/helpers/defaults.js */</style>
        </head>
        <body>
        <div>
          <h1>Do you want to sign-out from ${ctx.host}?</h1>
          ${form}
          <button autofocus type="submit" form="op.logoutForm" value="yes" name="logout">Yes, sign me out</button>
          <button type="submit" form="op.logoutForm">No, stay signed in</button>
        </div>
        </body>
        </html>
      `
    },

    // HTML to show when an error happens
    // https://github.com/panva/node-oidc-provider/blob/master/docs/README.md#rendererror
    // defined to avoid warning in testing environment
    async renderError (ctx, out, error) {
      ctx.type = 'html'
      ctx.body = `
        <!DOCTYPE html>
        <head>
        <title>oops! something went wrong</title>
        <style>/* css and html classes omitted for brevity, see lib/helpers/defaults.js */</style>
        </head>
        <body>
        <div>
          <h1>oops! something went wrong</h1>
          ${Object.entries(out).map(([key, value]) => `<pre><strong>${key}</strong>: ${value}</pre>`).join('')}
        </div>
        </body>
        </html>
      `
    }
  })

  // let's work with express here, below is just the interaction definition
  const expressApp = express()
  expressApp.set('trust proxy', true)
  expressApp.set('view engine', 'ejs')
  expressApp.set('views', path.resolve(__dirname, 'views'))

  const parse = bodyParser.urlencoded({
    extended: false
  })

  function setNoCache (req, res, next) {
    res.set('Pragma', 'no-cache')
    res.set('Cache-Control', 'no-cache, no-store')
    next()
  }

  expressApp.get('/interaction/:uid', setNoCache, async (req, res, next) => {
    try {
      const details = await oidc.interactionDetails(req)
      const {
        uid,
        prompt,
        params
      } = details

      const client = await oidc.Client.find(params.client_id)

      if (prompt.name === 'login') {
        return res.render('login', {
          client,
          uid,
          details: prompt.details,
          params,
          title: 'Sign-in',
          flash: undefined,
        })
      }

      return res.render('interaction', {
        client,
        uid,
        details: prompt.details,
        params,
        title: 'Authorize',
      })
    } catch (err) {
      return next(err)
    }
  })

  expressApp.post('/interaction/:uid/login', setNoCache, parse, async (req, res, next) => {
    try {
      const {
        uid,
        prompt,
        params
      } = await oidc.interactionDetails(req)
      const client = await oidc.Client.find(params.client_id)

      const accountId = await Account.authenticate(req.body.email, req.body.password)

      if (!accountId) {
        res.render('login', {
          client,
          uid,
          details: prompt.details,
          params: {
            ...params,
            login_hint: req.body.email,
          },
          title: 'Sign-in',
          flash: 'Invalid email or password.',
        })
        return
      }

      const result = {
        login: {
          account: accountId,
        },
      }

      await oidc.interactionFinished(req, res, result, {
        mergeWithLastSubmission: false
      })
    } catch (err) {
      next(err)
    }
  })

  expressApp.post('/interaction/:uid/confirm', setNoCache, parse, async (req, res, next) => {
    try {
      const result = {
        consent: {
          // rejectedScopes: [], // < uncomment and add rejections here
          // rejectedClaims: [], // < uncomment and add rejections here
        },
      }
      await oidc.interactionFinished(req, res, result, {
        mergeWithLastSubmission: true
      })
    } catch (err) {
      next(err)
    }
  })

  expressApp.get('/interaction/:uid/abort', setNoCache, async (req, res, next) => {
    try {
      const result = {
        error: 'access_denied',
        error_description: 'End-User aborted interaction',
      }
      await oidc.interactionFinished(req, res, result, {
        mergeWithLastSubmission: false
      })
    } catch (err) {
      next(err)
    }
  })

  // leave the rest of the requests to be handled by oidc-provider, there's a catch all 404 there
  expressApp.use(oidc.callback)

  return expressApp
}
