require('dotenv').config()

const test = require('ava')
const request = require('supertest')

const {
  testTools: { lifecycle, auth }
} = require('../../serverTooling')

const { before, beforeEach, after } = lifecycle
const { getSystemKey } = auth

const secretApiKey = process.env.STRIPE_SECRET_KEY
const webhookSubscriptionSecret = process.env.STRIPE_WEBHOOK_SUBSCRIPTION_SECRET

if (!secretApiKey) {
  throw new Error('Missing Stripe secret key')
}
if (!webhookSubscriptionSecret) {
  throw new Error('Missing Stripe subscription webhook secret')
}

test.before(before({
  name: 'stripe-webhook',
  platformId: 1, // set the platformId to 1
  env: 'test'
}))
test.beforeEach(beforeEach())
test.after(after())

test('init webhook testing environment', async (t) => {
  const systemKey = getSystemKey()

  await request(t.context.serverUrl)
    .patch(`/system/platforms/${t.context.platformId}/config/private`)
    .send({
      stelace: {
        instant: {
          stripeSecretKey: secretApiKey,
          stripeWebhookSubscriptionSecret: webhookSubscriptionSecret
        }
      }
    })
    .set({
      'x-stelace-system-key': systemKey,
      'x-stelace-env': t.context.env
    })
    .expect(200)

  const webhookEndpoint = '/providers/stripe/webhooks/pubk_test_wakWA41rBTUXs1Y5oNRjeY5o/subscriptions'
  console.log(`Subscription webhook endpoint: ${webhookEndpoint}\n`)

  t.pass()
})
