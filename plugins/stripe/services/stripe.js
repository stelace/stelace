const request = require('superagent')
const Stripe = require('stripe')
const _ = require('lodash')
const { parseKey } = require('stelace-util-keys')

module.exports = function createService (deps) {
  const {
    utils: {
      currency: currencyLib
    },

    createError,
    getCurrentUserId,
    handleRemoteNotFoundError,

    configRequester,
    documentRequester,
    orderRequester,
    userRequester
  } = deps

  return {
    readCustomer,
    createCustomer,
    updateCustomer,
    removeCustomer,

    createCard,
    updateCard,

    listPlan,
    readPlan,

    createSubscription,
    updateSubscription,
    cancelSubscription,

    checkoutSessionCreate,

    createCharge,

    webhookSubscription
  }

  async function readCustomer (req) {
    const {
      params
    } = req

    const currentUserId = getCurrentUserId(req)

    const user = await _getCurrentUser(currentUserId, req)
    const userCustomer = _getCustomerFromUser(user)

    const isSelf = userCustomer && userCustomer.id === params.customerId
    if (!isSelf) {
      throw createError(403, 'No customer found for the current user')
    }

    const customer = await _sendStripeRequest(req)
    return customer
  }

  async function createCustomer (req) {
    const currentUserId = getCurrentUserId(req)

    const user = await _getCurrentUser(currentUserId, req)
    const userCustomer = _getCustomerFromUser(user)

    if (userCustomer) {
      throw createError(422, 'Customer already exists for the current user')
    }

    let customer = await _sendStripeRequest(req)

    customer = await _addUserIdIntoCustomerMetadata(customer.id, { userId: currentUserId, req })
    await _updateCurrentUserWithCustomer(currentUserId, { customer, req })

    return customer
  }

  async function updateCustomer (req) {
    const {
      params
    } = req

    const currentUserId = getCurrentUserId(req)

    const user = await _getCurrentUser(currentUserId, req)
    const userCustomer = _getCustomerFromUser(user)

    const isSelf = userCustomer && userCustomer.id === params.customerId
    if (!isSelf) {
      throw createError(403, 'The customer does not match the current user')
    }

    const customer = await _sendStripeRequest(req)

    await _updateCurrentUserWithCustomer(currentUserId, { customer, req })

    return customer
  }

  async function removeCustomer (req) {
    const {
      params
    } = req

    const currentUserId = getCurrentUserId(req)

    const user = await _getCurrentUser(currentUserId, req)
    const userCustomer = _getCustomerFromUser(user)

    const isSelf = userCustomer && userCustomer.id === params.customerId
    if (!isSelf) {
      throw createError(403, 'The customer does not match the current user')
    }

    const result = await _sendStripeRequest(req)

    await _updateCurrentUserWithCustomer(currentUserId, { customer: null, req })

    return result
  }

  async function createCard (req) {
    const {
      params
    } = req

    const currentUserId = getCurrentUserId(req)

    const user = await _getCurrentUser(currentUserId, req)
    const userCustomer = _getCustomerFromUser(user)

    const isSelf = userCustomer && userCustomer.id === params.customerId
    if (!isSelf) {
      throw createError(403, 'The customer does not match the current user')
    }

    const card = await _sendStripeRequest(req)

    const customer = await _fetchCustomer(userCustomer.id, req)
    await _updateCurrentUserWithCustomer(currentUserId, { customer, req })

    return card
  }

  async function updateCard (req) {
    const {
      params
    } = req

    const currentUserId = getCurrentUserId(req)

    const user = await _getCurrentUser(currentUserId, req)
    const userCustomer = _getCustomerFromUser(user)

    const isSelf = userCustomer && userCustomer.id === params.customerId
    if (!isSelf) {
      throw createError(403, 'The customer does not match the current user')
    }

    const card = await _sendStripeRequest(req)

    const customer = await _fetchCustomer(userCustomer.id, req)
    await _updateCurrentUserWithCustomer(currentUserId, { customer, req })

    return card
  }

  async function listPlan (req) {
    const plans = await _sendStripeRequest(req)
    return plans
  }

  async function readPlan (req) {
    const plan = await _sendStripeRequest(req)
    return plan
  }

  async function createSubscription (req) {
    const {
      body = {}
    } = req

    const currentUserId = getCurrentUserId(req)

    const user = await _getCurrentUser(currentUserId, req)
    const userCustomer = _getCustomerFromUser(user)

    const isSelf = userCustomer && userCustomer.id === body.customer
    if (!isSelf) {
      throw createError(403, 'The customer does not match the current user')
    }

    const subscription = await _sendStripeRequest(req)

    const customer = await _fetchCustomer(userCustomer.id, req)
    await _updateCurrentUserWithCustomer(currentUserId, { customer, req })

    return subscription
  }

  async function updateSubscription (req) {
    const {
      params
    } = req

    const currentUserId = getCurrentUserId(req)

    const user = await _getCurrentUser(currentUserId, req)
    const userCustomer = _getCustomerFromUser(user)

    const currentSubscription = await _fetchSubscription(params.subscriptionId, req)
    if (!currentSubscription) {
      throw createError(404)
    }

    const isSelf = userCustomer && userCustomer.id === currentSubscription.customer
    if (!isSelf) {
      throw createError(403, 'The customer does not match the current user')
    }

    const subscription = await _sendStripeRequest(req)

    const customer = await _fetchCustomer(userCustomer.id, req)
    await _updateCurrentUserWithCustomer(currentUserId, { customer, req })

    return subscription
  }

  async function cancelSubscription (req) {
    const {
      params
    } = req

    const currentUserId = getCurrentUserId(req)

    const user = await _getCurrentUser(currentUserId, req)
    const userCustomer = _getCustomerFromUser(user)

    const currentSubscription = await _fetchSubscription(params.subscriptionId, req)
    if (!currentSubscription) {
      throw createError(404)
    }

    const isSelf = userCustomer && userCustomer.id === currentSubscription.customer
    if (!isSelf) {
      throw createError(403, 'The customer does not match the current user')
    }

    const subscription = await _sendStripeRequest(req)

    const customer = await _fetchCustomer(userCustomer.id, req)
    await _updateCurrentUserWithCustomer(currentUserId, { customer, req })

    return subscription
  }

  async function checkoutSessionCreate (req) {
    const {
      body
    } = req

    const currentUserId = getCurrentUserId(req)

    const isSelf = currentUserId === body.client_reference_id
    if (!isSelf) {
      throw createError(403, 'The client reference ID does not match the current user')
    }

    const checkoutSession = await _sendStripeRequest(req)
    return checkoutSession
  }

  async function createCharge (req) {
    const {
      body
    } = req

    const currentUserId = getCurrentUserId(req)

    const user = await _getCurrentUser(currentUserId, req)
    const userCustomer = _getCustomerFromUser(user)

    const isSelf = userCustomer && userCustomer.id === body.customer
    if (!isSelf) {
      throw createError(403, 'The customer does not match the current user')
    }

    const charge = await _sendStripeRequest(req)

    const customer = await _fetchCustomer(userCustomer.id, req)
    await _updateCurrentUserWithCustomer(currentUserId, { customer, req })

    return charge
  }

  async function _getCurrentUser (userId, req) {
    const user = await userRequester.communicate(req)({
      type: 'read',
      userId: userId,
      _matchedPermissions: { 'user:read:all': true }
    }).catch(handleRemoteNotFoundError)
    if (!user) {
      throw createError(422, 'Current user not found')
    }

    return user
  }

  async function _updateCurrentUserWithCustomer (userId, { customer, req }) {
    const user = await userRequester.communicate(req)({
      type: 'update',
      userId: userId,
      platformData: {
        _private: {
          stripeCustomer: customer
        }
      },
      _matchedPermissions: { 'user:edit:all': true }
    })

    return user
  }

  async function _fetchCustomer (customerId, req) {
    const newReq = Object.assign({}, req, {
      method: 'GET',
      url: `/v1/customers/${customerId}`,
      body: null
    })

    const customer = await _sendStripeRequest(newReq)
    return customer
  }

  async function _addUserIdIntoCustomerMetadata (customerId, { req, userId }) {
    const newReq = Object.assign({}, req, {
      method: 'POST',
      url: `/v1/customers/${customerId}`,
      body: {
        metadata: {
          stelaceUserId: userId
        }
      }
    })

    const customer = await _sendStripeRequest(newReq)
    return customer
  }

  async function _fetchSubscription (subscriptionId, req) {
    const newReq = Object.assign({}, req, {
      method: 'GET',
      url: `/v1/subscriptions/${subscriptionId}`,
      body: null
    })

    const subscription = await _sendStripeRequest(newReq)
    return subscription
  }

  function _getCustomerFromUser (user) {
    return user.platformData._private && user.platformData._private.stripeCustomer
  }

  async function _sendStripeRequest (req) {
    const {
      method,
      url,
      body
    } = req

    const privateConfig = await configRequester.communicate(req)({
      type: 'read',
      _matchedPermissions: { 'config:read:all': true },
      access: 'private'
    })

    const apiKey = _.get(privateConfig, 'stelace.instant.stripeSecretKey')
    if (!apiKey) {
      throw createError(403, 'Stripe secret API key not configured')
    }

    const verb = method.toLowerCase()

    const remoteUrl = `https://api.stripe.com${url}`

    const requestBuilder = request[verb](remoteUrl)
      .set({
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      })

    if (body) {
      requestBuilder.send(body)
    }

    try {
      const result = await requestBuilder
      return result.body
    } catch (err) {
      if (err.response) {
        const errorObject = err.response.body
        let errorMessage = 'Stripe error'
        const customErrorMessage = errorObject.error && errorObject.error.message
        const errorCode = errorObject.error && errorObject.error.code

        if (customErrorMessage) {
          errorMessage += ` - ${customErrorMessage}`
        }

        const error = createError(err.response.statusCode, errorMessage, {
          expose: true,
          method,
          url,
          code: errorCode,
          public: {
            stripeError: errorObject
          }
        })

        throw error
      } else {
        throw err
      }
    }
  }

  async function webhookSubscription ({ _requestId, key, rawBody, stripeSignature }) {
    const {
      getStandardAmount
    } = currencyLib

    const parsedKey = await parseKey(key)
    if (!_.get(parsedKey, 'hasValidFormat')) throw createError(403)

    const {
      platformId,
      env
    } = parsedKey

    const req = {
      _requestId,
      platformId,
      env
    }

    const privateConfig = await configRequester.communicate(req)({
      type: 'read',
      _matchedPermissions: { 'config:read:all': true },
      access: 'private'
    })

    const stripeApiKey = _.get(privateConfig, 'stelace.instant.stripeSecretKey')
    if (!stripeApiKey) {
      throw createError(403, 'Stripe secret API key not configured')
    }

    const webhookSecret = _.get(privateConfig, 'stelace.instant.stripeWebhookSubscriptionSecret')
    if (!webhookSecret) {
      throw createError(403, 'Stripe webhook secret not configured')
    }

    const stripe = Stripe(stripeApiKey)

    if (!stripeSignature) {
      throw createError(403, 'Missing Stripe signature')
    }

    // Use Stripe built-in webhook signature checking
    // https://stripe.com/docs/webhooks
    // https://github.com/stripe/stripe-node#webhook-signing
    const event = stripe.webhooks.constructEvent(
      rawBody,
      stripeSignature,
      webhookSecret
    )

    const allowedEvents = [
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'checkout.session.completed'
    ]

    if (!allowedEvents.includes(event.type)) {
      throw createError(403, 'Not allowed event type')
    }

    const documentPagination = await documentRequester.communicate(req)({
      type: 'list',
      documentType: 'stripeEvent',
      data: {
        id: event.id
      },
      orderBy: 'createdDate',
      order: 'desc',
      page: 1,
      nbResultsPerPage: 1
    })

    // Implement event storage idempotency because Stripe may send same event multiple times
    // https://stripe.com/docs/webhooks#best-practices
    const eventAlreadyStored = !!documentPagination.results.length
    if (eventAlreadyStored) {
      return { success: true }
    }

    await documentRequester.communicate(req)({
      type: 'create',
      documentType: 'stripeEvent',
      data: event
    })

    const updateCustomerEvents = [
      'invoice.payment_succeeded',
      'invoice.payment_failed',
      'checkout.session.completed'
    ]

    if (updateCustomerEvents.includes(event.type)) {
      let customerId
      let userId

      // check that the customer ID can be retrieved via this object access
      // before adding new events
      if ([
        'invoice.payment_succeeded',
        'invoice.payment_failed',
        'checkout.session.completed'
      ].includes(event.type)) {
        customerId = event.data.object.customer
      }

      let customer = await _fetchCustomer(customerId, req)

      if (event.type === 'checkout.session.completed') {
        userId = event.data.object.client_reference_id
        customer = await _addUserIdIntoCustomerMetadata(customerId, { req, userId })
      } else {
        userId = customer && customer.metadata.stelaceUserId
      }

      // If we succeed to map the customer to the user, we update the user information
      // as customer subscription status may change (payment failed, unpaid...)
      if (userId) {
        await _updateCurrentUserWithCustomer(userId, { customer, req })

        if (event.type === 'invoice.payment_succeeded') {
          const senderId = userId
          const currency = event.data.object.currency.toUpperCase()
          const paidAmount = getStandardAmount(event.data.object.amount_paid, currency)
          const periodStartDate = new Date(event.data.object.period_start * 1000)
          const periodEndDate = new Date(event.data.object.period_end * 1000)

          await orderRequester.communicate(req)({
            type: 'create',
            _matchedPermissions: {
              'order:create:all': true
            },
            lines: [
              {
                senderId,
                senderAmount: paidAmount,
                platformAmount: paidAmount,
                currency,
                metadata: {
                  periodStartDate,
                  periodEndDate
                }
              }
            ],
            moves: [
              {
                senderId,
                senderAmount: paidAmount,
                platformAmount: paidAmount,
                currency
              }
            ]
          })
        }
      }
    }

    return { success: true }
  }
}
