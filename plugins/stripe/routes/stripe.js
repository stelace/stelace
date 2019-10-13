const _ = require('lodash')
const createService = require('../services/stripe')

const { matchRoute } = require('../util/router')

let stripe
let deps = {}

const getRoutes = (stripe) => ([
  {
    name: 'customer.read',
    method: 'GET',
    path: '/v1/customers/:customerId',
    handler: stripe.readCustomer
  },
  {
    name: 'customer.create',
    method: 'POST',
    path: '/v1/customers',
    handler: stripe.createCustomer
  },
  {
    name: 'customer.update',
    method: 'POST',
    path: '/v1/customers/:customerId',
    handler: stripe.updateCustomer
  },
  {
    name: 'customer.remove',
    method: 'DELETE',
    path: '/v1/customers/:customerId',
    handler: stripe.removeCustomer
  },

  {
    name: 'card.create',
    method: 'POST',
    path: '/v1/customers/:customerId/sources',
    handler: stripe.createCard
  },
  {
    name: 'card.update',
    method: 'POST',
    path: '/v1/customers/:customerId/sources/:sourceId',
    handler: stripe.updateCard
  },

  {
    name: 'plan.list',
    method: 'GET',
    path: '/v1/plans',
    handler: stripe.listPlan
  },
  {
    name: 'plan.read',
    method: 'GET',
    path: '/v1/plans/:planId',
    handler: stripe.readPlan
  },

  {
    name: 'subscription.create',
    method: 'POST',
    path: '/v1/subscriptions',
    handler: stripe.createSubscription
  },
  {
    name: 'subscription.update',
    method: 'POST',
    path: '/v1/subscriptions/:subscriptionId',
    handler: stripe.updateSubscription
  },
  {
    name: 'subscription.cancel',
    method: 'DELETE',
    path: '/v1/subscriptions/:subscriptionId',
    handler: stripe.cancelSubscription
  },

  {
    name: 'checkout.session.create',
    method: 'POST',
    path: '/v1/checkout/sessions',
    handler: stripe.checkoutSessionCreate
  },

  {
    name: 'charge.create',
    method: 'POST',
    path: '/v1/charges',
    handler: stripe.createCharge
  }
])

function init (server, { middlewares, helpers } = {}) {
  const {
    checkPermissions
  } = middlewares
  const {
    wrapAction,
    getRequestContext
  } = helpers

  server.post({
    name: 'stripe.request',
    path: '/providers/stripe/request'
  // use the middleware `checkPermissions` without providing any permissions
  // because logic to verify if the user belongs to the organization is in it
  }, checkPermissions([]), wrapAction(async (req, res) => {
    let ctx = getRequestContext(req)

    const {
      createError
    } = deps

    const fields = [
      'method',
      'url',
      'body'
    ]

    const payload = _.pick(req.body, fields)

    const {
      method,
      url
    } = payload

    ctx = Object.assign({}, ctx, payload)

    const routes = getRoutes(stripe)

    const routeResult = matchRoute(routes, { method, url })
    if (!routeResult || !routeResult.route) {
      throw createError(404, 'No route found to Stripe')
    }

    const handlerContext = Object.assign({}, ctx, {
      name: routeResult.route.name,
      path: routeResult.route.path,
      params: routeResult.params,
      query: routeResult.query
    })

    const result = await routeResult.route.handler(handlerContext)

    return result
  }))

  server.post({
    name: 'stripe.webhooks.subscription',
    path: '/providers/stripe/webhooks/:key/subscriptions',
    optionalApiKey: true
  }, wrapAction(async (req, res) => {
    const {
      key
    } = req.params

    const result = await stripe.webhookSubscription({
      _requestId: req._requestId,
      key,
      rawBody: req.rawBody,
      stripeSignature: req.headers['stripe-signature'],
      deps
    })

    return result
  }))
}

function start (startParams) {
  deps = Object.assign({}, startParams)

  const {
    communication: { getRequester }
  } = deps

  const documentRequester = getRequester({
    name: 'Stripe service > Document Requester',
    key: 'document'
  })

  const userRequester = getRequester({
    name: 'Stripe service > User Requester',
    key: 'user'
  })

  const configRequester = getRequester({
    name: 'Stripe service > Config Requester',
    key: 'config'
  })

  const orderRequester = getRequester({
    name: 'Stripe service > Order Requester',
    key: 'order'
  })

  Object.assign(deps, {
    documentRequester,
    userRequester,
    configRequester,
    orderRequester,
  })

  stripe = createService(deps)
}

function stop () {
  const {
    documentRequester,
    userRequester,
    configRequester,
    orderRequester
  } = deps

  documentRequester.close()
  userRequester.close()
  configRequester.close()
  orderRequester.close()

  deps = null
}

module.exports = {
  init,
  start,
  stop
}
