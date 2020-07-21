const _ = require('lodash')
const { encodeBase64, decodeBase64 } = require('./encoding')

const allowedTypes = [
  'number',
  'boolean',
  'string',

  // Date instances are returned from database for timestamptz type
  // which is different from date stored in string type
  'date',
]

// must be uncommon chain of characters to distinguish
// from real string values
const separator = '~|~'
const nullValue = '[[NULL]]' // to distinguish from string with 'null' value
const undefinedValue = '[[UNDEFINED]]' // to distinguish from string with 'undefined' value

function isValidCursorConfig (config) {
  return Array.isArray(config) &&
    config.length > 0 &&
    config.length <= 2 &&
    config.every(c => _.isString(c.prop) && allowedTypes.includes(c.type))
}

/**
 * A cursor encodes one or two values.
 * If unicity isn't guaranteed by one value, provide two values.
 * Example: (createdDate) isn't enough because two rows can have the same value
 * then (createdDate, id) is a good candidate for cursor
 * @param {Object}   obj - cursor will be created based on this object
 * @param {Object[]} config
 * @param {Object}   config[i]
 * @param {String}   config[i].prop - object property to encode
 * @param {String}   config[i].type - allowed value: 'number', 'boolean', 'date', 'string'
 */
function createCursor (obj, config) {
  if (!config) throw new Error('Missing cursor config')
  if (!isValidCursorConfig(config)) throw new Error('Invalid cursor config')

  const cursor = config.map(c => {
    const { prop } = c
    return stringifyValue(obj[prop])
  }).join(separator)

  return encodeBase64(cursor)
}

/**
 * @param {Object}   obj - cursor will be created based on this object
 * @param {Object[]} config
 * @param {Object}   config[i]
 * @param {String}   config[i].prop - object property
 * @param {String}   config[i].type - allowed value: 'number', 'boolean', 'date', 'string'
 */
function parseCursor (cursor, config) {
  if (!config) throw new Error('Missing cursor config')
  if (!isValidCursorConfig(config)) throw new Error('Invalid cursor config')

  const parts = decodeBase64(cursor).split(separator)
  if (parts.length !== config.length) throw new Error('Invalid cursor')

  return parts.reduce((decoded, p, index) => {
    const { prop, type } = config[index]

    return {
      ...decoded,
      [prop]: parseValue(p, type)
    }
  }, {})
}

function stringifyValue (value) {
  if (_.isUndefined(value)) return undefinedValue
  if (_.isNull(value)) return nullValue
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function parseValue (value, type) {
  if (value === undefinedValue) return
  if (value === nullValue) return null
  if (type === 'number') return parseFloat(value)
  if (type === 'boolean') return value === 'true'
  return value
}

module.exports = {
  isValidCursorConfig,
  createCursor,
  parseCursor,
}
