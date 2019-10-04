const Base = require('./Base')

const _ = require('lodash')

class CustomAttribute extends Base {
  static get tableName () {
    return 'customAttribute'
  }

  static get idPrefix () {
    return 'attr'
  }

  static get jsonSchema () {
    return {
      type: 'object',
      properties: {
        id: {
          type: 'string'
        },
        createdDate: {
          type: 'string',
          maxLength: 24
        },
        updatedDate: {
          type: 'string',
          maxLength: 24
        },
        name: {
          type: 'string',
          maxLength: 255
        },
        type: {
          type: 'string',
          enum: ['number', 'boolean', 'text', 'select', 'tags'],
          maxLength: 255
        },
        listValues: {
          type: ['array', 'null'],
          default: null
        },
        metadata: {
          type: 'object',
          default: {}
        },
        platformData: {
          type: 'object',
          default: {}
        }
      }
    }
  }

  static getAccessFields (access) {
    const accessFields = {
      api: [
        'id',
        'createdDate',
        'updatedDate',
        'name',
        'type',
        'listValues',
        'metadata',
        'platformData',

        'livemode' // added in the expose function
      ]
    }

    return accessFields[access]
  }

  static get listValuesTypes () {
    return [
      'select',
      'tags'
    ]
  }

  static get requiredListValuesTypes () {
    return [
      'select',
    ]
  }

  static checkObject (obj = {}, customAttributes) {
    const indexedCustomAttributes = _.keyBy(customAttributes, 'name')

    return Object.keys(obj).reduce((memo, name) => {
      // filter out this special field to replace the whole custom attribute object
      if (name === '__replace__') return memo

      const value = obj[name]

      const customAttribute = indexedCustomAttributes[name]
      let newError

      if (customAttribute) {
        if (value === null) return memo // null value is valid

        switch (customAttribute.type) {
          case 'number':
            if (typeof value !== 'number') {
              newError = { name, value, message: 'A number is expected' }
            }
            break

          case 'boolean':
            if (typeof value !== 'boolean') {
              newError = { name, value, message: 'A boolean is expected' }
            }
            break

          case 'text':
            if (typeof value !== 'string') {
              newError = { name, value, message: 'A string is expected' }
            }
            break

          case 'select':
            if (!customAttribute.listValues.includes(value)) {
              newError = {
                name,
                value,
                message: `The value must be in the allowed listValues`,
                allowed: customAttribute.listValues
              }
            }
            break

          case 'tags':
            if (!Array.isArray(value)) {
              newError = { name, value, message: 'An array is expected' }
              break
            }

            // Tags are free when empty listValues
            if (_.isEmpty(customAttribute.listValues)) break

            const extraFields = _.difference(value, customAttribute.listValues)
            if (extraFields.length) {
              newError = {
                name,
                value,
                message: `Some array elements are not allowed in the allowed listValues`,
                allowed: customAttribute.listValues,
                notAllowed: extraFields
              }
            }
            break

          default:
            newError = {
              name,
              value,
              message: 'This custom attribute type does not exist',
              type: customAttribute.type
            }
            break
        }
      } else {
        newError = { name, value, message: 'Unknown custom attribute' }
      }

      if (newError) {
        memo.result = false
        memo.errors.push(newError)
      }

      return memo
    }, { result: true, errors: [] })
  }
}

module.exports = CustomAttribute
