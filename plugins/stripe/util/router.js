const { pathToRegexp } = require('path-to-regexp')
const qs = require('querystring')

function parseParams (path, regexp, keys) {
  const matches = regexp.exec(path)
  if (!matches) return null

  return matches.reduce((memo, match, index) => {
    if (index === 0) return memo

    memo[keys[index - 1].name] = match
    return memo
  }, {})
}

function matchRoute (routes, { method, url }) {
  const result = {
    route: null,
    params: null,
    query: null
  }

  for (let i = 0, l = routes.length; i < l; i++) {
    const route = routes[i]

    if (route.method.toLowerCase() !== method.toLowerCase()) continue

    if (!route._pathRegexp) {
      route._pathKeys = []
      route._pathRegexp = pathToRegexp(route.path, route._pathKeys)
    }

    const urlQueryIndex = url.indexOf('?')
    const hasUrlQuery = urlQueryIndex !== -1

    const queryString = hasUrlQuery ? url.substring(urlQueryIndex) : null

    if (queryString) {
      result.query = qs.parse(queryString.substring(1))
    }

    const path = hasUrlQuery ? url.substring(0, urlQueryIndex) : url

    result.params = parseParams(path, route._pathRegexp, route._pathKeys)
    if (result.params) {
      result.route = route
      break
    }
  }

  return result
}

module.exports = {
  matchRoute
}
