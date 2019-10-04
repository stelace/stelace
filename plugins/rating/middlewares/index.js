const debug = require('debug')('stelace:api')

function testMiddleware (req, res, next) {
  if (process.env.NODE_ENV === 'test') {
    req.workingTestMiddleware = true
    debug('Rating plugin test middleware is working fine')
  }
  next()
}

module.exports = {
  testMiddleware
}
