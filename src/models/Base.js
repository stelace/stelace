const { Model, QueryBuilder } = require('objection')
const { DbErrors } = require('objection-db-errors')

const _ = require('lodash')

const { mergeOrOverwrite } = require('../util/merging')

// create a custom query builder to automatically set the schema
class SchemaQueryBuilder extends QueryBuilder {
  constructor (modelClass) {
    super(modelClass)
    if (modelClass.defaultSchema) {
      this.withSchema(modelClass.defaultSchema)
    }
  }
}

Model.QueryBuilder = SchemaQueryBuilder
Model.RelatedQueryBuilder = SchemaQueryBuilder

class Base extends DbErrors(Model) {
  $beforeInsert () {
    const now = new Date().toISOString()

    this.createdDate = now
    this.updatedDate = now
  }

  $beforeUpdate () {
    this.updatedDate = new Date().toISOString()
  }

  static getAccessFields (access) {
    const accessFields = {}
    return accessFields[access]
  }

  static isNamespaceKey (key) {
    return key.charAt(0) === '_'
  }

  static getNamespace (key) {
    return key.slice(1)
  }

  static getNamespaceKey (namespace) {
    return '_' + namespace
  }

  static checkDataNamespaces (element = {}, namespaces = []) {
    const exposeAllNamespaces = namespaces.includes('*')
    if (exposeAllNamespaces) {
      return true
    }

    const foundNamespaces = this.getDataNamespaces(element)
    const indexedNamespaces = _.keyBy(namespaces)

    return foundNamespaces.reduce((memo, namespace) => {
      if (!indexedNamespaces[namespace]) {
        return memo && false
      }
      return memo
    }, true)
  }

  static getDataNamespaces (element) {
    const foundNamespaces = []

    if (element.metadata && typeof element.metadata === 'object') {
      Object.keys(element.metadata).forEach(key => {
        if (this.isNamespaceKey(key)) {
          foundNamespaces.push(this.getNamespace(key))
        }
      })
    }
    if (element.platformData && typeof element.platformData === 'object') {
      Object.keys(element.platformData).forEach(key => {
        if (this.isNamespaceKey(key)) {
          foundNamespaces.push(this.getNamespace(key))
        }
      })
    }

    return _.uniq(foundNamespaces)
  }

  static isAllowedNamespace (namespace, listNamespaces) {
    return listNamespaces.includes(namespace) || listNamespaces.includes('*')
  }

  /**
   * Expose the model element based on access and other parameters
   * @param {Object} element
   * @param {Object} params
   * @param {String} [params.access = "api"] - define the level of access for this element
   * @param {String} [params.locale]
   * @param {String} [params.fallbackLocale]
   * @param {String} [params.namespaces = []] - expose only the provided "read" namespaces
   * @param {Object} [params.planPermissions = {}] - hash of permissions (k, v) = (permission name, enabled)
   * @param {Boolean} params.planPermissions[permission]
   * @param {Object} [params.options = {}]
   * @param {String} [params.systemHash]
   * @param {Object} [params.req] - request context, if provided it will automatically set the information
   * @param {String[]} [params.accessFields] - provide access fields to override the default fields (useful for nested models)
   *
   * @return {Object} exposedElement
   */
  static expose (element, {
    access = 'api',
    locale,
    fallbackLocale,
    namespaces,
    plan,
    planPermissions,
    env,
    options = {},
    systemHash,
    req,
    accessFields
  } = {}) {
    const { systemNamespaces, isSystem } = require('../../auth') // require here to prevent circular dependency

    let object = _.cloneDeep(element)

    // populate data from the request context
    if (req) {
      if (!namespaces) {
        namespaces = req._readNamespaces
      }
      if (!plan) {
        plan = req._plan
      }
      if (!planPermissions) {
        planPermissions = _.get(req._plan, 'allPermissions', null)
      }
      if (!env) {
        env = req.env
      }
      if (typeof systemHash === 'undefined') {
        systemHash = req._systemHash || null
      }
    }

    if (!namespaces) {
      namespaces = []
    }
    if (!plan) {
      plan = {}
    }
    if (!planPermissions) {
      planPermissions = null
    }
    if (typeof systemHash === 'undefined') {
      systemHash = null
    }

    if (locale && typeof this.getI18nMap === 'function') {
      object = this.getI18nModel(object, { locale, fallbackLocale })
    }

    if (typeof element === 'undefined' || element === null) {
      return null
    }

    if (!accessFields) {
      accessFields = this.getAccessFields(access)
    }

    if (!accessFields) {
      return {}
    } else {
      accessFields.forEach(field => {
        this.exposeTransform(object, field, { access, namespaces, plan, planPermissions, isSystem, options })
      })

      const exposedObject = _.pick(object, accessFields)

      const hasWildcardNamespace = namespaces.includes('*')
      const exposeAllNamespaces = isSystem(systemHash)

      // 3 use cases:
      // - isSystem is true, expose all namespaces
      // - hasWildcardNamespaces is true, expose all namespaces except for system namespaces
      // - otherwise, expose only specified namespaces

      if (!exposeAllNamespaces) {
        if (hasWildcardNamespace) {
          const indexedSystemNamespaces = systemNamespaces.reduce((memo, namespace) => {
            const key = this.getNamespaceKey(namespace)
            memo[key] = true
            return memo
          }, {})

          if (exposedObject.metadata && typeof exposedObject.metadata === 'object') {
            Object.keys(exposedObject.metadata).forEach(key => {
              if (this.isNamespaceKey(key) && indexedSystemNamespaces[key]) {
                delete exposedObject.metadata[key]
              }
            })
          }
          if (exposedObject.platformData && typeof exposedObject.platformData === 'object') {
            Object.keys(exposedObject.platformData).forEach(key => {
              if (this.isNamespaceKey(key) && indexedSystemNamespaces[key]) {
                delete exposedObject.platformData[key]
              }
            })
          }
        } else {
          const indexedNamespaces = namespaces.reduce((memo, namespace) => {
            const key = this.getNamespaceKey(namespace)
            memo[key] = true
            return memo
          }, {})

          if (exposedObject.metadata && typeof exposedObject.metadata === 'object') {
            Object.keys(exposedObject.metadata).forEach(key => {
              if (this.isNamespaceKey(key) && !indexedNamespaces[key]) {
                delete exposedObject.metadata[key]
              }
            })
          }
          if (exposedObject.platformData && typeof exposedObject.platformData === 'object') {
            Object.keys(exposedObject.platformData).forEach(key => {
              if (this.isNamespaceKey(key) && !indexedNamespaces[key]) {
                delete exposedObject.platformData[key]
              }
            })
          }
        }
      }

      exposedObject.livemode = env === 'live'

      return _.pick(exposedObject, accessFields)
    }
  }

  static exposeAll (elements, params) {
    if (!Array.isArray(elements)) {
      throw new Error('array of elements expected')
    }

    return elements.map(element => this.expose(element, params))
  }

  static exposeTransform (/* element, field, { access, namespaces, plan, planPermissions, isSystem, options } = {} */) {
    // do nothing (only for template, exposeTransform on model override)
  }

  static getI18nModel (element, { locale, fallbackLocale, useOnlyLocale }) {
    if (typeof this.getI18nMap !== 'function') {
      throw new Error('Expected i18n map')
    }

    const i18nMap = this.getI18nMap()

    return getI18nModel(element, { i18nMap, locale, fallbackLocale, useOnlyLocale })
  }

  static getI18nModelDelta (element, attrs, { locale, fallbackLocale }) {
    if (typeof this.getI18nMap !== 'function') {
      throw new Error('Expected i18n map')
    }

    const i18nMap = this.getI18nMap()

    return getI18nModelDelta(element, attrs, { i18nMap, locale, fallbackLocale })
  }

  static setI18nModel (element, attrs, { locale, fallbackLocale }) {
    if (typeof this.getI18nMap !== 'function') {
      throw new Error('Expected i18n map')
    }

    const i18nMap = this.getI18nMap()

    setI18nModel(element, attrs, { i18nMap, locale, fallbackLocale })
  }

  /**
   * Returns a new object including any additional fields required before merging with element in DB,
   * preventing any loss during PATCH, due to diff-only convention.
   * @param {Object} element - element to merge custom data with
   * @param {Object} params - either metadata, customData, customAttributes or newData must be provided
   * @param {Object} [params.metadata] - to merge with element.metadata
   * @param {Object} [params.platformData] - to merge with element.platformData
   * @param {Object} [params.customAttributes] - to merge with element.customAttributes
   * @param {Object} [params.newData] - to merge with element.field
   * @param {String} [params.field] - required if using params.newData
   * @param {String} [params.replaceField] - if true in data object, data is overwritten on element
   * @return {Object} Checks values of type (array of) string (attributes to compare) or function
   */
  static getCustomData (element, params) {
    const {
      metadata,
      platformData,
      customAttributes,
      newData,
      field,
      replaceField = '__replace__'
    } = params

    const hasOneDataObject = Object.keys(_.pick(params, [
      'metadata',
      'platformData',
      'customAttributes',
      'newData'
    ])).length === 1

    if (!hasOneDataObject) {
      throw new Error('Only one of metadata, platformData, customAttributes or newData is expected.')
    }
    if (newData && !field) {
      throw new Error('Field name is required when using newData rather than data built-ins.')
    }

    const customData = newData || metadata || platformData || customAttributes
    const parsedField = field ||
      (metadata ? 'metadata' : (platformData ? 'platformData' : 'customAttributes'))

    if (!customData) return
    if (!element[parsedField]) return customData

    if (customData[replaceField] === true) {
      return _.omit(customData, replaceField)
    } else {
      return _.mergeWith({}, element[parsedField], customData || {}, mergeOrOverwrite)
    }
  }

  static getUpdateDeltaFields (rawPayload, fields, resource) {
    return fields.reduce((changes, field) => {
      const potentialChange = typeof rawPayload[field] !== 'undefined'
      const isEqualToPreviousValue = resource && typeof resource === 'object'
        ? _.isEqual(rawPayload[field], resource[field])
        : false

      if (potentialChange && !isEqualToPreviousValue) {
        changes[field] = rawPayload[field]
      }
      return changes
    }, {})
  }
}

function getI18nModel (model, {
  i18nMap = {},
  locale,
  fallbackLocale,
  useOnlyLocale
}) {
  const obj = _.cloneDeep(model)

  Object.keys(i18nMap).forEach(key => {
    if (!i18nMap[key] || typeof i18nMap[key] !== 'string') {
      return
    }

    obj[key] = getI18nValue(obj, {
      field: key,
      fieldI18n: i18nMap[key],
      locale,
      fallbackLocale,
      useOnlyLocale
    })
  })

  return obj
}

function getI18nModelDelta (model, attrs, {
  i18nMap = {},
  locale,
  fallbackLocale
}) {
  const delta = {}

  model = model || {}

  Object.keys(i18nMap).forEach(key => {
    const i18nKey = i18nMap[key]
    const value = attrs[key]

    if (i18nKey && typeof i18nKey === 'string') {
      if (typeof model[key] !== 'undefined') {
        delta[key] = model[key]
      }

      delta[i18nKey] = model[i18nKey] || {}

      setI18nValue(delta, value, {
        field: key,
        fieldI18n: i18nKey,
        locale,
        fallbackLocale
      })
    }
  })

  return delta
}

function setI18nModel (model, attrs, {
  i18nMap = {},
  locale,
  fallbackLocale
}) {
  Object.keys(i18nMap).forEach(key => {
    const value = attrs[key]

    if (i18nMap[key] && typeof i18nMap[key] === 'string') {
      setI18nValue(model, value, {
        field: key,
        fieldI18n: i18nMap[key],
        locale,
        fallbackLocale
      })
    }
  })

  return model
}

function getI18nValue (model, {
  field,
  fieldI18n,
  locale,
  fallbackLocale,
  useOnlyLocale = false
}) {
  model[fieldI18n] = model[fieldI18n] || {}

  const localeValue = model[fieldI18n][locale]
  if (useOnlyLocale) {
    return localeValue
  }

  if (typeof localeValue !== 'undefined' && localeValue !== null) {
    return localeValue
  }

  const fallbackValue = model[fieldI18n][fallbackLocale]
  if (typeof fallbackValue !== 'undefined' && fallbackValue !== null) {
    return fallbackValue
  }

  return model[field]
}

function setI18nValue (model, value, {
  field,
  fieldI18n,
  locale,
  fallbackLocale
}) {
  model[fieldI18n] = model[fieldI18n] || {}
  model[fieldI18n][locale] = value

  const existFallback = fallbackLocale && typeof model[fieldI18n][fallbackLocale] === 'string'

  if (locale === fallbackLocale || !existFallback) {
    model[field] = value
  }
}

module.exports = Base
