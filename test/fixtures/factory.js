const { escapeFixture } = require('./util')

module.exports = {

  createModel

}

function createModel (params = {}, refParams = {}) {
  const model = {}

  Object.keys(params).forEach(key => {
    const value = params[key]
    model[key] = escapeFixture(value)
  })

  Object.keys(refParams).forEach(key => {
    const value = refParams[key]
    model[key] = value
  })

  return model
}
