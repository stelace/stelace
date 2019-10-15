const moment = require('moment').utc()
const Handlebars = require('handlebars')

registerHbsHelpers(Handlebars)

function registerHbsHelpers (Handlebars) {
  Handlebars.registerHelper('date', format => {
    return moment.utc().format(format)
  })
}

function compile (content, data) {
  const template = Handlebars.compile(content)
  return template(data)
}

module.exports = {
  compile
}
