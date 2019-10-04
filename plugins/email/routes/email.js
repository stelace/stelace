const _ = require('lodash')
const createEmailService = require('../services/email')
const createEmailLog = require('../models/EmailLog')

let email
let deps = {}

function init (server, { middlewares, helpers } = {}) {
  const {
    checkPermissions
  } = middlewares
  const {
    wrapAction,
    getRequestContext
  } = helpers

  server.post({
    name: 'email.send',
    path: '/emails/send'
  }, checkPermissions([
    'email:send:all'
  ]), wrapAction(async (req, res) => {
    let ctx = getRequestContext(req)

    const fields = [
      'html',
      'text',
      'from',
      'fromName',
      'to',
      'toEmail',
      'toName',
      'subject',
      'replyTo',
      'headers'
    ]

    const payload = _.pick(req.body, fields)

    if (req.query && typeof req.query._forceSend !== 'undefined') {
      payload._forceSend = req.query._forceSend
    }

    ctx = Object.assign({}, ctx, payload)
    return email.send(ctx)
  }))

  server.post({
    name: 'email.sendTemplate',
    path: '/emails/send-template'
  }, checkPermissions([
    'email:send:all'
  ]), wrapAction(async (req, res) => {
    let ctx = getRequestContext(req)

    const fields = [
      'name',
      'data',
      'locale',
      'currency',
      'from',
      'fromName',
      'to',
      'toEmail',
      'toName',
      'subject',
      'replyTo'
    ]

    const payload = _.pick(req.body, fields)

    ctx = Object.assign({}, ctx, payload)
    return email.sendTemplate(ctx)
  }))
}

function start (startParams) {
  deps = Object.assign({}, startParams)

  const {
    communication: { getRequester },
    BaseModel
  } = deps

  const configRequester = getRequester({
    name: 'Email service > Config Requester',
    key: 'config'
  })

  const documentRequester = getRequester({
    name: 'Email service > Document Requester',
    key: 'document'
  })

  const entryRequester = getRequester({
    name: 'Email service > Entry Requester',
    key: 'entry'
  })

  const EmailLog = createEmailLog(BaseModel)

  Object.assign(deps, {
    configRequester,
    documentRequester,
    entryRequester,

    EmailLog
  })

  email = createEmailService(deps)
}

function stop () {
  const {
    configRequester,
    documentRequester,
    entryRequester
  } = deps

  configRequester.close()
  documentRequester.close()
  entryRequester.close()

  deps = null
}

module.exports = {
  init,
  start,
  stop
}
