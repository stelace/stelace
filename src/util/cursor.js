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

function isValidCursorProps (props) {
  return Array.isArray(props) &&
    props.length > 0 &&
    props.length <= 2 &&
    props.every(p => _.isString(p.name) && allowedTypes.includes(p.type))
}

/**
 * A cursor encodes one or two values.
 * If unicity isn't guaranteed by one value, provide two values.
 * Example: (createdDate) isn't enough because two rows can have the same value
 * then (createdDate, id) is a good candidate for cursor
 * @param {Object}   obj - cursor will be created based on this object
 * @param {Object[]} props
 * @param {Object}   props[i]
 * @param {String}   props[i].name - prop name to encode
 * @param {String}   props[i].type - allowed value: 'number', 'boolean', 'date', 'string'
 */
function createCursor (obj, props) {
  if (!props) throw new Error('Missing cursor props')
  if (!isValidCursorProps(props)) throw new Error('Invalid cursor props')

  const cursor = props.map(p => {
    const { name } = p
    return stringifyValue(obj[name])
  }).join(separator)

  return encodeBase64(cursor)
}

/**
 * @param {Object}   obj - cursor will be created based on this object
 * @param {Object[]} props
 * @param {Object}   props[i]
 * @param {String}   props[i].name - object property
 * @param {String}   props[i].type - allowed value: 'number', 'boolean', 'date', 'string'
 */
function parseCursor (cursor, props) {
  if (!props) throw new Error('Missing cursor props')
  if (!isValidCursorProps(props)) throw new Error('Invalid cursor props')

  const parts = decodeBase64(cursor).split(separator)
  if (parts.length !== props.length) throw new Error('Invalid cursor')

  return parts.reduce((decoded, p, index) => {
    const { name, type } = props[index]

    return {
      ...decoded,
      [name]: parseValue(p, type)
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
  isValidCursorProps,
  createCursor,
  parseCursor,
}
