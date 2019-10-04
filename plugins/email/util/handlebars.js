const moment = require('moment')
const Handlebars = require('handlebars')

registerHbsHelpers(Handlebars)

function registerHbsHelpers (Handlebars) {
  Handlebars.registerHelper('date', format => {
    return moment().format(format)
  })
}

function compile (content, data) {
  const template = Handlebars.compile(content)
  return template(data)
}

module.exports = {
  compile
}
