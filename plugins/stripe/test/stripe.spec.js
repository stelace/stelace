require('dotenv').config()

const test = require('ava')
const request = require('supertest')

const moment = require('moment')
const Stripe = require('stripe')

const {
  testTools: { lifecycle, auth }
} = require('../../serverTooling')

const { before, beforeEach, after } = lifecycle
const { getAccessTokenHeaders, getSystemKey } = auth

const secretApiKey = process.env.STRIPE_SECRET_KEY

// perform the Stripe tests only if the secret API key is provided
if (secretApiKey) {
  test.before(async t => {
    await before({ name: 'stripe' })(t)
    await beforeEach()(t)

    const systemKey = getSystemKey()

    await request(t.context.serverUrl)
      .patch(`/system/platforms/${t.context.platformId}/config/private`)
      .send({
        stelace: {
          instant: {
            stripeSecretKey: secretApiKey
          }
        }
      })
      .set({
        'x-stelace-system-key': systemKey,
        'x-stelace-env': t.context.env
      })
      .expect(200)
  })
  // test.beforeEach(beforeEach()) // Concurrent tests are much faster
  test.after(after())

  test('manages own customer', async (t) => {
    const userId = 'usr_Y0tfQps1I3a1gJYz2I3a'
    const anotherUserId = 'usr_T2VfQps1I3a1gJYz2I3a'

    const authorizationHeaders = await getAccessTokenHeaders({
      t,
      permissions: ['user:read'],
      userId
    })
    const anotherAuthorizationHeaders = await getAccessTokenHeaders({
      t,
      permissions: ['user:read'],
      userId: anotherUserId
    })

    const { body: beforeUser } = await request(t.context.serverUrl)
      .get(`/users/${userId}`)
      .set(authorizationHeaders)
      .expect(200)

    t.falsy(beforeUser.platformData._private && beforeUser.platformData._private.stripeCustomer)

    // create customer
    const { body: createdCustomer } = await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'POST',
        url: '/v1/customers',
        body: {
          email: 'test@example.com'
        }
      })
      .set(authorizationHeaders)
      .expect(200)

    const { body: afterCreationUser } = await request(t.context.serverUrl)
      .get(`/users/${userId}`)
      .set(authorizationHeaders)
      .expect(200)

    t.deepEqual(afterCreationUser.platformData._private.stripeCustomer, createdCustomer)

    // read customer
    const { body: customer } = await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'GET',
        url: `/v1/customers/${createdCustomer.id}`
      })
      .set(authorizationHeaders)
      .expect(200)

    t.deepEqual(customer, createdCustomer)

    // a user cannot read the customer information from another user
    await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'GET',
        url: `/v1/customers/${createdCustomer.id}`
      })
      .set(anotherAuthorizationHeaders)
      .expect(403)

    // update customer
    const { body: updatedCustomer } = await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'POST',
        url: `/v1/customers/${createdCustomer.id}`,
        body: {
          email: 'test2@example.com'
        }
      })
      .set(authorizationHeaders)
      .expect(200)

    const { body: afterUpdateUser } = await request(t.context.serverUrl)
      .get(`/users/${userId}`)
      .set(authorizationHeaders)
      .expect(200)

    t.deepEqual(afterUpdateUser.platformData._private.stripeCustomer, updatedCustomer)

    // remove customer
    await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'DELETE',
        url: `/v1/customers/${createdCustomer.id}`
      })
      .set(authorizationHeaders)
      .expect(200)

    const { body: afterRemovalUser } = await request(t.context.serverUrl)
      .get(`/users/${userId}`)
      .set(authorizationHeaders)
      .expect(200)

    t.falsy(afterRemovalUser.platformData._private && afterRemovalUser.platformData._private.stripeCustomer)
  })

  test('manages own card', async (t) => {
    const userId = 'usr_T2VfQps1I3a1gJYz2I3a'

    const authorizationHeaders = await getAccessTokenHeaders({
      t,
      permissions: ['user:read'],
      userId
    })

    // create customer
    const { body: createdCustomer } = await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'POST',
        url: '/v1/customers',
        body: {
          email: 'test@example.com'
        }
      })
      .set(authorizationHeaders)
      .expect(200)

    const { body: beforeUser } = await request(t.context.serverUrl)
      .get(`/users/${userId}`)
      .set(authorizationHeaders)
      .expect(200)

    t.true(beforeUser.platformData._private.stripeCustomer.sources.total_count === 0)

    // create a card
    const { body: createdCard } = await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'POST',
        url: `/v1/customers/${createdCustomer.id}/sources`,
        body: {
          // in testing environment, we use a testing source token (https://stripe.com/docs/testing)
          // however in live environment, create the source token first by the client library Stripe.js
          // before passing in this request
          source: 'tok_visa'
        }
      })
      .set(authorizationHeaders)
      .expect(200)

    t.is(createdCard.customer, createdCustomer.id)

    // check that the card information has been added into customer object
    const { body: afterCardCreatedUser } = await request(t.context.serverUrl)
      .get(`/users/${userId}`)
      .set(authorizationHeaders)
      .expect(200)

    t.true(afterCardCreatedUser.platformData._private.stripeCustomer.sources.total_count === 1)
    t.deepEqual(
      afterCardCreatedUser.platformData._private.stripeCustomer.sources.data.find(source => {
        return source.id === createdCard.id
      }),
      createdCard
    )

    // update a card
    const { body: updatedCard } = await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'POST',
        url: `/v1/customers/${createdCustomer.id}/sources/${createdCard.id}`,
        body: {
          name: 'Foo bar'
        }
      })
      .set(authorizationHeaders)
      .expect(200)

    t.is(updatedCard.customer, createdCustomer.id)

    // check that the card information has been added into customer object
    const { body: afterCardUpdatedUser } = await request(t.context.serverUrl)
      .get(`/users/${userId}`)
      .set(authorizationHeaders)
      .expect(200)

    t.true(afterCardUpdatedUser.platformData._private.stripeCustomer.sources.total_count === 1)
    t.deepEqual(
      afterCardUpdatedUser.platformData._private.stripeCustomer.sources.data.find(source => {
        return source.id === updatedCard.id
      }),
      updatedCard
    )

    // remove customer (clean testing environment)
    await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'DELETE',
        url: `/v1/customers/${createdCustomer.id}`
      })
      .set(authorizationHeaders)
      .expect(200)
  })

  test('fails to create card because of wrong information', async (t) => {
    const userId = 'usr_QVQfQps1I3a1gJYz2I3a'

    const authorizationHeaders = await getAccessTokenHeaders({
      t,
      permissions: ['user:read'],
      userId
    })

    // create customer
    const { body: createdCustomer } = await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'POST',
        url: '/v1/customers',
        body: {
          email: 'test@example.com'
        }
      })
      .set(authorizationHeaders)
      .expect(200)

    // card error
    await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'POST',
        url: `/v1/customers/${createdCustomer.id}/sources`,
        body: {
          // in testing environment, we use a testing source token (https://stripe.com/docs/testing)
          // however in live environment, create the source token first by the client library Stripe.js
          // before passing in this request
          source: 'tok_cvcCheckFail'
        }
      })
      .set(authorizationHeaders)
      .expect(402)

    // remove customer (clean testing environment)
    await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'DELETE',
        url: `/v1/customers/${createdCustomer.id}`
      })
      .set(authorizationHeaders)
      .expect(200)

    t.pass()
  })

  test('lists/reads plans', async (t) => {
    const authorizationHeaders = await getAccessTokenHeaders({ t })

    const stripe = Stripe(secretApiKey)

    const createdPlan1 = await stripe.plans.create({
      amount: 1000,
      currency: 'EUR',
      interval: 'month',
      product: {
        name: 'Amazing service'
      }
    })

    const createdPlan2 = await stripe.plans.create({
      amount: 5600,
      currency: 'EUR',
      interval: 'month',
      product: {
        name: 'Premium access'
      }
    })

    // lists plan
    const { body: { data: plans } } = await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'GET',
        url: '/v1/plans'
      })
      .set(authorizationHeaders)
      .expect(200)

    t.deepEqual(
      plans.find(plan => plan.id === createdPlan1.id),
      createdPlan1
    )
    t.deepEqual(
      plans.find(plan => plan.id === createdPlan2.id),
      createdPlan2
    )

    // reads plan
    const { body: plan1 } = await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'GET',
        url: `/v1/plans/${createdPlan1.id}`
      })
      .set(authorizationHeaders)
      .expect(200)

    t.deepEqual(plan1, createdPlan1)

    // clean testing environment
    await stripe.plans.del(createdPlan1.id)
    await stripe.plans.del(createdPlan2.id)
    await stripe.products.del(createdPlan1.product)
    await stripe.products.del(createdPlan2.product)
  })

  test('manages own subscription', async (t) => {
    const userId = 'usr_WHlfQps1I3a1gJYz2I3a'

    const authorizationHeaders = await getAccessTokenHeaders({
      t,
      permissions: ['user:read'],
      userId
    })

    const stripe = Stripe(secretApiKey)

    const plan1 = await stripe.plans.create({
      amount: 1000,
      currency: 'EUR',
      interval: 'month',
      product: {
        name: 'Amazing service'
      }
    })

    // create customer
    const { body: createdCustomer } = await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'POST',
        url: '/v1/customers',
        body: {
          email: 'test@example.com'
        }
      })
      .set(authorizationHeaders)
      .expect(200)

    const { body: beforeUser } = await request(t.context.serverUrl)
      .get(`/users/${userId}`)
      .set(authorizationHeaders)
      .expect(200)

    t.true(beforeUser.platformData._private.stripeCustomer.subscriptions.total_count === 0)

    // create a card
    const { body: createdCard } = await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'POST',
        url: `/v1/customers/${createdCustomer.id}/sources`,
        body: {
          // in testing environment, we use a testing source token (https://stripe.com/docs/testing)
          // however in live environment, create the source token first by the client library Stripe.js
          // before passing in this request
          source: 'tok_visa'
        }
      })
      .set(authorizationHeaders)
      .expect(200)

    t.is(createdCard.customer, createdCustomer.id)

    // create a subscription
    const { body: createdSubscription } = await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'POST',
        url: '/v1/subscriptions',
        body: {
          customer: createdCustomer.id,
          items: [
            { plan: plan1.id } // by default, quantity is 1
          ]
        }
      })
      .set(authorizationHeaders)
      .expect(200)

    t.is(createdSubscription.customer, createdCustomer.id)

    // check that the subscription information has been added into customer object
    const { body: afterSubscriptionCreatedUser } = await request(t.context.serverUrl)
      .get(`/users/${userId}`)
      .set(authorizationHeaders)
      .expect(200)

    t.true(afterSubscriptionCreatedUser.platformData._private.stripeCustomer.subscriptions.total_count === 1)
    t.deepEqual(
      afterSubscriptionCreatedUser.platformData._private.stripeCustomer.subscriptions.data.find(source => {
        return source.id === createdSubscription.id
      }),
      createdSubscription
    )

    // the customer is up to date concerning subscription payments
    t.false(afterSubscriptionCreatedUser.platformData._private.stripeCustomer.delinquent)

    t.truthy(createdSubscription.current_period_start)
    t.truthy(createdSubscription.current_period_end)
    t.falsy(createdSubscription.trial_start)
    t.falsy(createdSubscription.trial_end)

    // update a subscription
    const { body: updatedSubscription } = await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'POST',
        url: `/v1/subscriptions/${createdSubscription.id}`,
        body: {
          cancel_at_period_end: true
        }
      })
      .set(authorizationHeaders)
      .expect(200)

    t.is(updatedSubscription.customer, createdCustomer.id)

    // check that the subscription information has been added into customer object
    const { body: afterSubscriptionUpdatedUser } = await request(t.context.serverUrl)
      .get(`/users/${userId}`)
      .set(authorizationHeaders)
      .expect(200)

    t.true(afterSubscriptionUpdatedUser.platformData._private.stripeCustomer.subscriptions.total_count === 1)
    t.deepEqual(
      afterSubscriptionUpdatedUser.platformData._private.stripeCustomer.subscriptions.data.find(source => {
        return source.id === updatedSubscription.id
      }),
      updatedSubscription
    )

    // cancel a subscription
    await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'DELETE',
        url: `/v1/subscriptions/${createdSubscription.id}`
      })
      .set(authorizationHeaders)
      .expect(200)

    // check that the subscription information has been removed from customer object
    const { body: afterSubscriptionRemovedUser } = await request(t.context.serverUrl)
      .get(`/users/${userId}`)
      .set(authorizationHeaders)
      .expect(200)

    t.true(afterSubscriptionRemovedUser.platformData._private.stripeCustomer.subscriptions.total_count === 0)

    // clean testing environment
    await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'DELETE',
        url: `/v1/customers/${createdCustomer.id}`
      })
      .set(authorizationHeaders)
      .expect(200)

    await stripe.plans.del(plan1.id)
    await stripe.products.del(plan1.product)
  })

  test('creates a subscription with a 3DSecure card', async (t) => {
    const userId = 'usr_IoyayAs1sBJ1h8BgesBJ'

    const authorizationHeaders = await getAccessTokenHeaders({
      t,
      permissions: ['user:read'],
      userId
    })

    const stripe = Stripe(secretApiKey)

    const plan1 = await stripe.plans.create({
      amount: 1000,
      currency: 'EUR',
      interval: 'month',
      product: {
        name: 'Amazing service'
      }
    })

    // create customer
    const { body: createdCustomer } = await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'POST',
        url: '/v1/customers',
        body: {
          email: 'test@example.com'
        }
      })
      .set(authorizationHeaders)
      .expect(200)

    const { body: beforeUser } = await request(t.context.serverUrl)
      .get(`/users/${userId}`)
      .set(authorizationHeaders)
      .expect(200)

    t.true(beforeUser.platformData._private.stripeCustomer.subscriptions.total_count === 0)

    // create a card
    const { body: createdCard } = await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'POST',
        url: `/v1/customers/${createdCustomer.id}/sources`,
        body: {
          // in testing environment, we use a testing source token (https://stripe.com/docs/testing)
          // however in live environment, create the source token first by the client library Stripe.js
          // before passing in this request

          // 3DSecure token from client-side
          // Warning: for now, we cannot accept cards that require 3DSecure as automatic payments cannot be done
          source: 'tok_threeDSecureRecommended'
        }
      })
      .set(authorizationHeaders)
      .expect(200)

    t.is(createdCard.customer, createdCustomer.id)

    // create a charge to complete the 3DSecure process
    // https://stripe.com/docs/sources/three-d-secure/subscriptions
    const { body: createdCharge } = await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'POST',
        url: '/v1/charges',
        body: {
          amount: 1000,
          currency: 'EUR',
          customer: createdCustomer.id
        }
      })
      .set(authorizationHeaders)
      .expect(200)

    t.is(createdCharge.customer, createdCustomer.id)

    // create a subscription
    const { body: createdSubscription } = await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'POST',
        url: '/v1/subscriptions',
        body: {
          trial_end: moment().add(1, 'M').unix(), // timestamp in seconds
          customer: createdCustomer.id,
          items: [
            { plan: plan1.id } // by default, quantity is 1
          ]
        }
      })
      .set(authorizationHeaders)
      .expect(200)

    t.is(createdSubscription.customer, createdCustomer.id)

    // check that the subscription information has been added into customer object
    const { body: afterSubscriptionCreatedUser } = await request(t.context.serverUrl)
      .get(`/users/${userId}`)
      .set(authorizationHeaders)
      .expect(200)

    t.true(afterSubscriptionCreatedUser.platformData._private.stripeCustomer.subscriptions.total_count === 1)
    t.deepEqual(
      afterSubscriptionCreatedUser.platformData._private.stripeCustomer.subscriptions.data.find(source => {
        return source.id === createdSubscription.id
      }),
      createdSubscription
    )

    t.truthy(createdSubscription.current_period_start)
    t.truthy(createdSubscription.current_period_end)
    t.truthy(createdSubscription.trial_start)
    t.truthy(createdSubscription.trial_end)
    t.is(createdSubscription.current_period_start, createdSubscription.trial_start)
    t.is(createdSubscription.current_period_end, createdSubscription.trial_end)

    // the customer is up to date concerning subscription payments
    t.false(afterSubscriptionCreatedUser.platformData._private.stripeCustomer.delinquent)

    // cancel a subscription
    await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'DELETE',
        url: `/v1/subscriptions/${createdSubscription.id}`
      })
      .set(authorizationHeaders)
      .expect(200)

    // clean testing environment
    await request(t.context.serverUrl)
      .post('/providers/stripe/request')
      .send({
        method: 'DELETE',
        url: `/v1/customers/${createdCustomer.id}`
      })
      .set(authorizationHeaders)
      .expect(200)

    await stripe.plans.del(plan1.id)
    await stripe.products.del(plan1.product)
  })
} else {
  test('No Stripe tests', async (t) => {
    t.pass()
  })
}
