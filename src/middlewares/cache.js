module.exports = cache

function cache (directives = 'max-age=60') {
  const middleware = (req, res, next) => {
    if (typeof directives !== 'string') return next()
    res.header('cache-control', directives)
    next()
  }
  return middleware
}
