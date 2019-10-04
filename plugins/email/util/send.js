const _ = require('lodash')
const createError = require('http-errors')

const {
  generateText,
  minifyHtml,
  generateLocalEmailFile
} = require('./content')

const TEST = process.env.NODE_ENV === 'test'

/**
 * Send email using `html`/`text` as content
 * or any custom headers to fill templates hosted by email provider
 * @param {Object}   transporter
 * @param {Object}   [defaults] - default config used by the transporter (from, cc, ...)
 * @param {String}   [html]
 * @param {String}   [text] - alternate version of html, but can also be provided without html
 * @param {String}   from
 * @param {String}   to
 * @param {String}   [subject]
 * @param {String}   [replyTo]
 * @param {String[]} [tags = []]
 * @param {Boolean}  [minifyHtml = true]
 * @param {String}   [cc]
 * @param {String}   [bcc]
 * @param {Object}   [headers] - Nodemailer format defined in this page https://nodemailer.com/message/custom-headers/
 * @param {Boolean}  [transactional = true]
 * @param {Boolean}  [localHtmlBuild = false] - if true, generate a HTML file in local project and don't send an email,
 *                                              will be true if test environment
 * @param {String}   [localHtmlName = 'general']
 * @param {Boolean}  [forceSendingEmailInTestEnv = false]
 *
 * @return {Object}  result
 * @return {Object}  result.localFilepath    - path of the generated file if local generation (useful for test and debug)
 * @return {Object}  result.html             - html that is sent (useful for test and debug)
 * @return {Object}  result.nodemailerInfo   - nodemailer return info
 */
async function sendEmail ({
  transporter,
  defaults,
  html,
  text,
  from,
  to,
  subject,
  replyTo,
  minifyHtml: minify = true,
  cc,
  bcc,
  headers,
  localHtmlBuild = false,
  localHtmlName = 'general',
  forceSendingEmailInTestEnv = false
}) {
  const result = {
    emailContext: {},
    localFilepath: null,
    nodemailerInfo: null
  }

  defaults = defaults || {}

  if (!defaults.from && !from) throw createError(400, 'Missing from email address')
  if (!to) throw createError(400, 'Missing to email address')

  let htmlToSend = html
  if (minify && htmlToSend) htmlToSend = minifyHtml(html)

  result.html = htmlToSend

  if (html && !text) {
    text = generateText(htmlToSend, ['.headerContainer', '.bodyContainer'])
  }

  result.emailContext = {
    html: htmlToSend,
    text,
    from: from || defaults.from,
    to,
    subject,
    replyTo: replyTo || defaults.replyTo,
    cc: cc || defaults.cc,
    bcc: bcc || defaults.bcc,
    headers
  }

  if (localHtmlBuild || (TEST && !forceSendingEmailInTestEnv)) {
    const filename = generateLocalEmailFile(htmlToSend || text, localHtmlName)
    result.localFilepath = filename
    return result
  }

  const message = {
    from,
    to,
    subject,
    text,
    html,
    replyTo,
    cc,
    bcc,
    headers
  }

  if (process.env.DEBUG_EMAILS) {
    const stringifiedRecipients = _.isPlainObject(to) || Array.isArray(to) ? JSON.stringify(to) : to
    const originalRecipients = `[ORIGINAL RECIPIENTS: ${stringifiedRecipients}]`

    message.subject = `[DEBUG] ${(message.subject || '')} ${originalRecipients}`
    message.to = process.env.DEBUG_EMAILS
    message.cc = null
    message.bcc = null

    result.subject = message.subject
    result.emailContext.to = process.env.DEBUG_EMAILS
    result.emailContext.cc = null
    result.emailContext.bcc = null
  }

  const info = await transporter.sendMail(_.omitBy(message, (key) => _.isEmpty(key)))
  result.nodemailerInfo = info

  return result
}

module.exports = {
  sendEmail
}
