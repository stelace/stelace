const request = require('supertest')
const ngrok = require('ngrok')

const { getAccessTokenHeaders } = require('./auth')

const noop = () => Promise.resolve()

// Utility to test external service webhooks integration into Stelace
// Two operating modes:
// - Test external webhook integration for real via Ngrok,
//     as long as the external service lets you create webhooks with some API,
//     or you have a paid ngrok plan and a stable URL to use for a longlived test webhook
// - Simulate external webhook by polling external service events
//    and propagate them to some Stelace endpoint, provided the external service
//    has some Event API to fetch latest external events.
class WebhookManager {
  /**
   * @param {Object}   params
   * @param {Object}   params.t - AVA test object
   * @param {Boolean}  [params.isWebhookSimulated = true]
   *
   * @param {Function} [params.simulateWebhookSince(lastFetchTimestamp)] - required if isWebhookSimulated is true
   *   poll events from external service and hit Stelace webhook endpoint
   *   should return the last event timestamp for next fetch
   *   this timestamp will be injected at the next call of the function `simulateWebhookSince`
   * @example
   *   const processedEventIds = {}
   *
   *   async simulateWebhookSince(lastFetchTimestamp) {
   *     // we recommend to apply deduplication on events
   *     // because events created at the same second can be not available at the same time
   *
   *     // timestamps can be expressed in seconds or milliseconds depending on external APIs
   *     // so use the unit scale that is easier to use in events list filter
   *     const now = getTimestamp() // implement this function
   *     const filterParams = lastFetchTimestamp ? { gt: lastFetchTimestamp } : { gt: now }
   *
   *     const events = await externalServiceSdk.events.list(filterParams)
   *
   *     for (const event of events) {
   *       if (processedEventIds[event.id]) continue // via external Events API
   *
   *       await request(t.context.serverUrl)
   *         .post(webhookUrl)
   *         .send(event)
   *         .set({ authorization: `Basic ${basicAuth}` })
   *         .expect(200)
   *
   *       processedEventIds[event.id] = true
   *     }
   *
   *     const smallestTimestampStep = 1 // customize this value if needed
   *
   *     const timestamps = events.map(e => e.created)
   *     const maxTimestamp = _.max(timestamps)
   *     return maxTimestamp ? maxTimestamp - smallestTimestampStep : null // to be sure to fetch processed events
   *   }
   *
   * @param {Boolean}  [params.webhookFetchInterval = 2000] - interval in milliseconds between calls to external Events API
   *   if isWebhookSimulated is true
   * @param {Function} [params.createWebhook(tunnelUrl)] - can be provided if isWebhookSimulated is false
   *   tunnelUrl being the ngrok endpoint to prepend to Stelace API endpoint path.
   * @param {Function} [params.removeWebhook] - can be provided if isWebhookSimulated is false
   *
   * Please refer to ngrok options (https://github.com/bubenshchykov/ngrok#options)
   * @param {Object}   [params.tunnel]
   * @param {String}   [params.tunnel.subdomain]
   * @param {String}   [params.tunnel.auth]
   * @param {String}   [params.tunnel.authToken]
   *
   * @example Webhook manager usage in non-simulating mode
   *   const webhookUrl = `/stelace_api/webhook/url/with/platform_identifiers/e${t.context.platformId}_${t.context.env}`
   *   let webhook
   *
   *   const createWebhook = async (tunnelUrl) => {
   *     webhook = await externalServiceSdk.webhooks.create({
   *       url: `${tunnelUrl}${webhookUrl}`
   *     })
   *   }
   *
   *   const removeWebhook = async () => {
   *     await externalServiceSdk.webhooks.delete(webhook.id)
   *   }
   *
   *   const webhookManager = new WebhookManager({
   *     t, // AVA test object
   *     tunnel, // ngrok tunnel configuration object
   *     isWebhookSimulated: false,
   *     createWebhook,
   *     removeWebhook
   *   })
   *   await webhookManager.start()
   */
  constructor ({
    t,
    isWebhookSimulated = true,
    simulateWebhookSince,
    webhookFetchInterval = 2000,
    createWebhook,
    removeWebhook,
    tunnel
  }) {
    this.t = t

    this.lastEventTimestamp = null

    this.isWebhookSimulated = isWebhookSimulated
    this.tunnel = tunnel || {}

    this.webhookFetchInterval = webhookFetchInterval
    this.simulateWebhookSince = simulateWebhookSince
    this.simulateWebhookInterval = null

    this.createWebhook = createWebhook || noop
    this.removeWebhook = removeWebhook || noop
  }

  async start () {
    if (this.isWebhookSimulated) {
      if (!this.simulateWebhookSince) {
        throw new Error('Functions `simulateWebhookSince` expected')
      }
    }

    if (this.isWebhookSimulated) {
      this.simulateWebhookInterval = setInterval(async () => {
        const timestamp = await this.simulateWebhookSince(this.lastEventTimestamp)
        this.lastEventTimestamp = timestamp
      }, this.webhookFetchInterval)
    } else {
      // https://github.com/bubenshchykov/ngrok#connect
      this.tunnelUrl = await ngrok.connect({
        addr: this.t.context.serverPort,
        auth: this.tunnel.auth || undefined,
        subdomain: this.tunnel.subdomain || undefined,
        authtoken: this.tunnel.authToken || undefined
      })

      await this.createWebhook(this.tunnelUrl)
    }
  }

  async stop () {
    if (this.isWebhookSimulated) {
      clearInterval(this.simulateWebhookInterval)
    } else {
      await this.removeWebhook()

      // https://github.com/bubenshchykov/ngrok#disconnect
      await ngrok.disconnect(this.tunnelUrl)
    }
  }

  // expose this function as convenience to wait for events before testing them
  async waitForEvents (waitDurationMs = 10000) {
    return new Promise(resolve => setTimeout(resolve, waitDurationMs))
  }

  // expose this function as convenience
  // can be used to update private config with webhook secret for instance
  async updatePrivateConfig (payload) {
    const authorizationHeaders = await getAccessTokenHeaders({
      t: this.t,
      permissions: ['config:edit:all']
    })

    return request(this.t.context.serverUrl)
      .patch('/config/private')
      .send(payload)
      .set(authorizationHeaders)
      .expect(200)
  }
}

module.exports = WebhookManager
