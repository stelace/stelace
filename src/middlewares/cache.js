const _ = require('lodash')

module.exports = cache

function cache (directives = 'max-age=60') {
  const middleware = (req, res, next) => {
    if (typeof directives !== 'string') return next()
    res.header('cache-control', directives)

    // Using Vary header to instruct client to fetch new content when switching env or API Key
    // https://greenbytes.de/tech/webdav/rfc7234.html#rfc.section.3.2
    const varyHeader = (res.header('vary') || '')
      .split(',') // restify-cors-middleware sets its own comma-separated values
      .map(s => s.trim())
    const newVaryHeader = _.union(varyHeader, ['authorization']).join(',')
    res.setHeader('vary', newVaryHeader) // replacing the header
    next()
  }
  return middleware
}
