const {
  validator,
  registerValidationVersions
} = require('./validation')

const {
  applyRequestChanges,
  registerRequestChanges
} = require('./request')

const {
  applyResponseChanges,
  registerResponseChanges
} = require('./response')

const {
  applyObjectChanges,
  registerObjectChanges
} = require('./object')

const { apiVersions } = require('./util')

module.exports = {
  apiVersions,

  validator,
  applyRequestChanges,
  applyResponseChanges,
  applyObjectChanges,

  registerValidationVersions,
  registerRequestChanges,
  registerResponseChanges,
  registerObjectChanges,
}
