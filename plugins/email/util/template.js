const path = require('path')
const fs = require('fs')
const _ = require('lodash')

const { formatMessages } = require('./i18n')
const { compile } = require('./handlebars')

let generalTemplateHtml

const generalTemplateFields = [
  'subject',
  'preview_content',
  'preheader_content__block',
  'preheader_content',
  'service_logo__block',
  'service_logo__url',
  'header_title__block',
  'header_title',
  'leading_content__block',
  'leading_content',
  'notification_image__block',
  'notification_image__href',
  'notification_image__alt',
  'notification_image__url',
  'notification_image__width',
  'notification_image__max_width',
  'notification_image__custom_styles',
  'content',
  'cta_button__block',
  'cta__button_url',
  'cta_button__text',
  'trailing_content__block',
  'trailing_content',
  'featured__block',
  'featured__image__href',
  'featured__image__alt',
  'featured__image__url',
  'featured__title',
  'featured__content',
  'end_content__block',
  'end_content',
  'footer_content__block',
  'footer_content',
  'legal_notice',
  'style__color_brand',
  'style__color_calltoaction',
  'branding__block',
  'branding',
  'stelace_logo__url',
  'stelace_logo__alt',
  'stelace_website__img_url'
]

function getTemplateHtmlContent (name) {
  const templatePath = path.join(__dirname, '../templates', name + '.html')

  try {
    return fs.readFileSync(templatePath, 'utf8')
  } catch (e) {
    throw new Error(`Template "${name}" does not exist`)
  }
}

function generateGeneralTemplate (fields, data, options = {}) {
  if (!generalTemplateHtml) {
    generalTemplateHtml = getTemplateHtmlContent('general')
  }

  const filteredFields = _.pick(fields, generalTemplateFields)

  const newOptions = Object.assign({}, options, {
    beforeCompileTemplate: computeGeneralFieldsBlock
  })

  return generateTemplate({ template: generalTemplateHtml, fields: filteredFields, data, options: newOptions })
}

function computeGeneralFieldsBlock (fields) {
  const newFields = Object.assign({}, fields)

  newFields.leading_content__block = !!newFields.notification_image__block
  newFields.trailing_content__block = !!(newFields.cta_button__block && newFields.featured__block)
  newFields.end_content__block = !!(newFields.cta_button__block || newFields.trailing_content__block)

  newFields.preheader_content__block = !!newFields.preheader_content
  newFields.service_logo__block = !!newFields.service_logo__url
  newFields.header_title__block = !!newFields.header_title
  newFields.leading_content__block = !!newFields.leading_content
  newFields.notification_image__block = !!newFields.notification_image__href
  newFields.cta_button__block = !!newFields.cta_button__text
  newFields.trailing_content__block = !!newFields.trailing_content
  newFields.featured__block = !!newFields.featured__content
  newFields.end_content__block = !!newFields.end_content
  newFields.footer_content__block = !!newFields.footer_content
  newFields.branding__block = !!newFields.branding

  newFields.trailing_content__block = !!newFields.cta_button__block

  return newFields
}

/**
 * Compile a template with internationalized fields and provided data
 * @param {String}   template   - Handlebars HTML content
 * @param {Object}   fields     - context to compile the Handlebars template, ICU values will also be interpolated with data
 * @param {Object}   data       - data that will be used to interpolate ICU strings
 * @param {Object}   [options]
 * @param {String}   [options.locale]
 * @param {String}   [options.currency]
 * @param {String}   [options.timezone]
 * @param {Function} [options.beforeCompileTemplate] - can alter fields before Handlebars compilation
 */
function generateTemplate ({ template, fields, data, options = {} }) {
  const {
    locale,
    currency,
    timezone,
    beforeCompileTemplate
  } = options

  let newFields = formatMessages(fields, data, { locale, currency, timezone })

  if (typeof beforeCompileTemplate === 'function') {
    newFields = beforeCompileTemplate(newFields)
  }

  const generatedTemplate = compile(template, newFields)

  return {
    newTemplate: generatedTemplate,
    newFields
  }
}

module.exports = {
  getTemplateHtmlContent,
  generateGeneralTemplate,
  generateTemplate
}
