const _ = require('lodash')

const {
  sendEmail
} = require('../util/send')

const {
  generateGeneralTemplate
} = require('../util/template')

const {
  getTransporter,
  getDefaults
} = require('../util/nodemailer')

const TEST = process.env.NODE_ENV === 'test'

module.exports = function createService (deps) {
  const {
    createError,
    utils: {
      locale: { parseLocale },
      time: { isValidTimezone }
    },

    configRequester,
    entryRequester
  } = deps

  return {
    send,
    sendTemplate
  }

  async function send (req) {
    const platformId = req.platformId
    const env = req.env

    const {
      html,
      text,
      from,
      to,

      // DEPRECATED: favor `to` instead of `toEmail` and `toName`
      toEmail,
      toName,
      // DEPRECATED:END

      subject,
      replyTo,
      headers
    } = req

    const emailParams = await checkAndGetEmailParameters({
      platformId,
      env,
      req,
      to,
      toEmail,
      toName
    })

    let forceSendingEmailInTestEnv
    if (TEST) {
      forceSendingEmailInTestEnv = req._forceSend
    }

    const { emailContext, nodemailerInfo } = await sendEmail({
      transporter: emailParams.transporter,
      defaults: emailParams.defaults,
      html,
      text,
      from,
      to: emailParams.to,
      subject,
      replyTo,
      headers,

      forceSendingEmailInTestEnv
    })

    const exposedResult = { success: true }
    if (TEST || process.env.DEBUG_EMAILS) {
      exposedResult.emailContext = emailContext
      exposedResult.nodemailerInfo = nodemailerInfo
    }

    return exposedResult
  }

  async function sendTemplate (req) {
    const platformId = req.platformId
    const env = req.env

    const {
      name,
      locale: requestedLocale,
      currency: requestedCurrency,
      timezone,
      data,
      from,

      // DEPRECATED: favor `to` instead of `toEmail` and `toName`
      toEmail,
      toName,
      // DEPRECATED:END

      to,
      replyTo
    } = req

    if (timezone && !isValidTimezone(timezone)) throw createError(422, 'Invalid timezone')

    const emailParams = await checkAndGetEmailParameters({
      platformId,
      env,
      req,
      to,
      toEmail,
      toName
    })

    const config = await configRequester.communicate(req)({
      type: 'read',
      access: 'default'
    })

    const platformInfo = getPlatformInfoFromConfig(config)

    const locale = requestedLocale || platformInfo.locale
    const currency = requestedCurrency || platformInfo.currency

    if (!locale) throw createError('Locale is needed')

    const { language } = parseLocale(locale)

    const defaultLanguage = 'en'
    const supportedLanguages = ['en', 'fr']
    const selectedLanguage = supportedLanguages.includes(language) ? language : defaultLanguage

    const { results: entries } = await entryRequester.communicate(req)({
      type: 'list',
      collection: 'email',
      name: ['common'].concat(name),
      locale,
      orderBy: 'createdDate',
      order: 'desc',
      page: 1,
      nbResultsPerPage: 2 // common template + specified template
    })

    if (!entries.length) {
      throw createError(422, 'No content available, please create entries first')
    }

    const commonEntry = entries.find(entry => entry.name === 'common')
    const emailEntry = entries.find(entry => entry.name === name)

    const commonFields = commonEntry && commonEntry.fields
    const emailFields = emailEntry && emailEntry.fields

    const defaultFields = {
      service_logo__url: platformInfo.logoUrl
    }

    const brandingFields = getBrandingFields({
      serviceName: platformInfo.serviceName,
      language: selectedLanguage
    })
    const templateFields = getTemplateFieldsFromEntryFields([
      // objects with higher index fields override the existing fields
      defaultFields,
      brandingFields,
      commonFields,
      emailFields,
    ])

    let newTemplate
    let newTemplateFields

    const enrichedData = enrichData(data, { platformInfo })

    try {
      const generatedResult = generateGeneralTemplate(templateFields, enrichedData, {
        locale,
        currency,
        timezone
      })

      newTemplate = generatedResult.newTemplate
      newTemplateFields = generatedResult.newFields
    } catch (err) {
      if (err.errorType === 'ICU_FORMAT_ERROR') {
        throw createError(422, `Invalid ICU format for the field "${err.invalidKey}"`, {
          public: {
            value: err.invalidValue
          }
        })
      } else {
        throw err
      }
    }

    const { emailContext, nodemailerInfo } = await sendEmail({
      transporter: emailParams.transporter,
      defaults: emailParams.defaults,
      html: newTemplate,
      from,
      to: emailParams.to,
      subject: newTemplateFields.subject,
      replyTo
    })

    const exposedResult = { success: true }
    if (TEST || process.env.DEBUG_EMAILS) {
      exposedResult.emailContext = emailContext
      exposedResult.nodemailerInfo = nodemailerInfo
    }

    return exposedResult
  }

  function getPlatformInfoFromConfig (config) {
    const instantConfig = _.get(config, 'stelace.instant', {})

    return {
      serviceName: instantConfig.serviceName,
      logoUrl: instantConfig.logoUrl,
      locale: instantConfig.locale,
      currency: instantConfig.currency
    }
  }

  function enrichData (data = {}, { platformInfo }) {
    const enrichedData = Object.assign({}, data)

    if (!enrichedData.serviceName) {
      enrichedData.serviceName = platformInfo.serviceName
    }

    return enrichedData
  }

  function getBrandingFields ({ serviceName, language }) {
    const stelaceUrl = 'https://stelace.com/?utm_campaign=powered-by&utm_source=galaxy&utm_medium=email'
    const brandingByLocale = {
      en: `${serviceName} is powered by <a href="${stelaceUrl}">Stelace API</a>.`,
      fr: `${serviceName} est propulsé par <a href="${stelaceUrl}">l’API Stelace</a>.`
    }

    return {
      branding: brandingByLocale[language] || '',
      stelace_website__img_url: `${stelaceUrl}&utm_content=logo`,
      stelace_logo__alt: 'Stelace',
      stelace_logo__url: 'https://stelace-instant-files.s3.amazonaws.com/s/stelace-platform-runner-small.png',
    }
  }

  /**
   * Get the template fields to be used for ICU and Handlebars compilation
   *
   * A field value can be a String
   * or an object to enable rich-editing (like markdown)
   *
   * If it's an object, it must have the property `transform` like
   * "some_key": {
   *   "editable": "# Markdown content header",
   *   "transform": "markdown",
   *   "transformed": "<h1>Markdown content header</h1>" // rendered HTML
   * }
   * @param {Object[]} entriesFields
   */
  function getTemplateFieldsFromEntryFields (entriesFields) {
    const templateFields = {}

    entriesFields.forEach(entryFields => {
      if (!entryFields || !_.isPlainObject(entryFields)) return

      const fieldNames = Object.keys(entryFields)

      fieldNames.forEach(fieldName => {
        const value = entryFields[fieldName]

        if (_.isPlainObject(value)) {
          const validTransformedField = _.isPlainObject(value) && _.isString(value.transformed)
          if (!validTransformedField) {
            throw createError(422, `Invalid transform object for the field "${fieldName}"`, {
              public: { value }
            })
          }

          templateFields[fieldName] = value.transformed
        } else {
          templateFields[fieldName] = value
        }
      })
    })

    return templateFields
  }

  async function checkAndGetEmailParameters ({
    platformId,
    env,
    req,
    to,
    toEmail,
    toName
  }) {
    if (toEmail && to) throw createError(400, 'Please provide only one of \'to\' and \'toEmail\'')

    const privateConfig = await configRequester.communicate(req)({
      type: 'readPrivate'
    })

    const emailConfig = _.get(privateConfig, 'stelace.email') || {}

    const transporter = await getTransporter({ platformId, env, emailConfig })

    const emailDefaults = getDefaults(emailConfig)

    try {
      // prevent nodemailer from testing SMTP credentials when running tests
      if (!TEST) {
        await transporter.verify()
      }
    } catch (err) {
      throw createError(422, 'Invalid email connection')
    }

    let toField
    if (to) {
      toField = to
    } else if (toEmail) {
      toField = toName ? `"${toName}" <${toEmail}>` : toEmail
    }

    return {
      transporter,
      defaults: emailDefaults,
      to: toField
    }
  }
}
