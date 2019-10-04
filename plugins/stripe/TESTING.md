# Stripe testing

To test Stripe, we have to set the secret API key in order to access their endpoints.
Unfortunately, we cannot put it in the .env.example file as it can leak to outside, so continuous
integration isn't possible for now.

## Tests setup

Stripe tests will automatically run if the secret API key is provided in the .env file.

```
STRIPE_SECRET_KEY=sk_test_...
```

## Webhook setup

For now, there is no automated workflow to test webhooks.
Below we explain the method to test the subscription webhook in local environment.

Official links:
- https://stripe.com/docs/webhooks
- https://stripe.com/docs/billing/webhooks
- https://stripe.com/docs/testing#webhooks

For webhooks lifecycle: https://stripe.com/docs/billing/lifecycle

First, add the webhook subscription secret into .env:
```
STRIPE_WEBHOOK_SUBSCRIPTION_SECRET=whsec_...
```

Create an account into the service [ngrok](https://ngrok.com) in order to test webhook in the local machine
without manually deploying a remote server.
Follow the installation guide.

Launch the ngrok tunnel to get the webhook endpoint for Stripe:
```
./ngrok http 4100
```

Execute the webhook setup script to populate Stelace config with Stripe secrets and get the path for the webhook endpoint.
```
./node_modules/ava/cli.js plugins/stripe/test/init-webhook.js
```

Create a webhook in Stripe Dashboard:
- Add the endpoint URL: concatenate the ngrok domain + the setup path
- Select the following events:
  - invoice.payment_succeeded
  - invoice.payment_failed

Now start the server, send some test webhook events via Stripe Dashboard and see if all goes as expected
(e.g. correct events stored in db).
```
npm start
```

Note: The process ngrok creates a new endpoint each time it is executed. Therefore, we have to update
the webhook endpoint in Stripe Dashboard.
