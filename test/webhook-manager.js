const request = require('supertest')
const ngrok = require('ngrok')

const { getAccessTokenHeaders } = require('./auth')

const noop = () => Promise.resolve()

// Utility to test external service webhooks integration into Stelace
// Two modes of functioning:
// - test webhooks for real via Ngrok
// - simulate webhooks by fetching and creating events
//    (suitable if webhooks cannot be created via API and one cannot have access to Ngrok paid plan
//     for reserved subdomains)
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
   *     // via Events API
   *     const events = await exampleSdk.events.list({ gt: lastFetchTimestamp })
   *
   *     for (const event of events) {
   *       if (processedEventIds[event.id]) continue
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
   *     const timestamps = events.map(e => e.created)
   *     const maxTimestamp = _.max(timestamps) - 1 // to be sure to fetch processed events
   *     return maxTimestamp ? maxTimestamp - 1 : null
   *   }
   *
   * @param {Boolean}  [params.webhookFetchInterval = 2000] - specify the duration in milliseconds for events fetching
   *   if isWebhookSimulated is true
   * @param {Function} [params.createWebhook(tunnelUrl)] - can be provided if isWebhookSimulated is false
   * @param {Function} [params.removeWebhook] - can be provided if isWebhookSimulated is false
   *
   * Please refer to ngrok options (https://github.com/bubenshchykov/ngrok#options)
   * @param {Object}   [params.tunnel]
   * @param {String}   [params.tunnel.subdomain]
   * @param {String}   [params.tunnel.auth]
   * @param {String}   [params.tunnel.authToken]
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

    // minus one second to handle cases events are generated during the same second of webhook manager creation
    this.lastEventTimestamp = getTimestamp() - 1

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
      // https://github.com/bubenshchykov/ngrok#disconnect
      await ngrok.disconnect(this.tunnelUrl)
    }
  }

  // if isWebhookSimulated is false, really wait webhooks events
  // otherwise, fetch events not retrieved from last time to simulate a real webhook running
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

function getTimestamp () {
  return Math.round(new Date().getTime() / 1000)
}

module.exports = WebhookManager
