const createError = require('http-errors')
const joi = require('@hapi/joi')
const apm = require('elastic-apm-node')
const _ = require('lodash')

const { apiVersions } = require('../util')

const validationVersions = [
  require('./apiKey'),
  require('./assessment'),
  require('./asset'),
  require('./assetType'),
  require('./authentication'),
  require('./authorization'),
  require('./availability'),
  require('./batch'),
  require('./category'),
  require('./config'),
  require('./customAttribute'),
  require('./document'),
  require('./entry'),
  require('./event'),
  require('./message'),
  require('./order'),
  require('./role'),
  require('./search'),
  require('./signal'),
  require('./store'),
  require('./task'),
  require('./transaction'),
  require('./user'),
  require('./webhook'),
  require('./workflow')
]
const customValidationVersions = []

let indexedValidationVersions = indexValidationVersions(validationVersions)

function indexValidationVersions (validationVersionConfigs) {
  const indexed = {}

  validationVersionConfigs.forEach(validationVersionConfig => {
    const versions = Object.keys(validationVersionConfig)

    versions.forEach(version => {
      const validationDefinitions = validationVersionConfig[version]

      indexed[version] = indexed[version] || {}

      validationDefinitions.forEach(validationDefinition => {
        const { target } = validationDefinition
        if (!target) throw new Error('Validation object missing target')

        indexed[version][target] = validationDefinition
        indexed[version][target].version = version
      })
    })
  })

  return indexed
}

function getValidationDefinition ({ version, target }) {
  return indexedValidationVersions[version] && indexedValidationVersions[version][target]
}

// match the latest version
function matchValidationDefinition ({ version, target }) {
  const def = getValidationDefinition({ version, target })
  if (def) return def

  const index = apiVersions.indexOf(version)
  if (index === -1) return

  for (let i = index + 1; i < apiVersions.length; i++) {
    const version = apiVersions[i]

    const def = getValidationDefinition({ version, target })
    if (def) return def
  }
}

const joiOptions = {
  convert: true,
  allowUnknown: false,
  abortEarly: false
}
const keysToValidate = ['params', 'body', 'query']

const errorTransformer = (validationInput, joiError) => {
  const err = createError(400, joiError.message, {
    public: joiError.details
  })
  return err
}
const errorResponder = (transformedErr, req, res, next) => next(transformedErr)

const middleware = () => {
  return (req, res, next) => {
    const apmSpan = apm.startSpan('Request validation')

    const routeDefinition = req.route.spec

    const version = req._selectedVersion
    const target = routeDefinition.name

    const validationDefinition = matchValidationDefinition({ version, target })

    // no validation found on route
    if (!validationDefinition || !validationDefinition.schema) {
      apmSpan && apmSpan.end()
      return setImmediate(next)
    }

    const { schema: schemaObjOrFunction } = validationDefinition

    let schema
    if (_.isFunction(schemaObjOrFunction)) schema = schemaObjOrFunction()
    else schema = schemaObjOrFunction

    const toValidate = keysToValidate.reduce((accum, key) => {
      // only include keys present in the validation object
      // validation can be a Joi schema, so the exclusion logic is a bit different
      const skipValidation = (schema.isJoi && !joi.reach(schema, key)) || (!schema.isJoi && !schema[key])
      if (skipValidation) return accum

      accum[key] = req[key]
      return accum
    }, {})

    let errorToDisplay
    let errorKey

    keysToValidate.forEach(key => {
      if (errorToDisplay || !schema[key]) return

      const { error, value } = schema[key].validate(toValidate[key], Object.assign({}, joiOptions, { context: { label: 'body' } }))
      if (error) {
        if (error.message === '"value" is required') {
          const errorMessage = `"${key}" is required`
          error.message = errorMessage
          _.set(error, 'details[0].message', errorMessage)
        }
        errorToDisplay = error
        errorKey = key
      } else {
        if (!value || !req[key]) return
        req[key] = value
      }
    })

    apmSpan && apmSpan.end()

    if (errorToDisplay) {
      // apmSpan && apmSpan.end()

      return errorResponder(
        errorTransformer(toValidate[errorKey], errorToDisplay),
        req, res, next
      )
    }

    // // write defaults back to request
    // keysToValidate.forEach(key => {
    //   if (!value[key] || !req[key]) return
    //   req[key] = value[key]
    // })

    // apmSpan && apmSpan.end()

    next()
  }
}

function registerValidationVersions (versions) {
  customValidationVersions.push(versions)

  indexedValidationVersions = indexValidationVersions(validationVersions.concat(customValidationVersions))
}

module.exports = {
  validator: middleware,

  getValidationDefinition,
  matchValidationDefinition,

  registerValidationVersions
}
