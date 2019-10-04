require('dotenv').config()

const test = require('ava')

const { matchRoute } = require('../util/router')

test('returns the matched route', (t) => {
  const routes = [
    {
      method: 'GET',
      path: '/custom/:id'
    },
    {
      method: 'POST',
      path: '/custom'
    }
  ]

  const result = matchRoute(routes, { method: 'GET', url: '/custom/123' })
  t.truthy(result.route)
  t.truthy(result.params)
  t.falsy(result.query)
})

test('returns null if there is no route found', (t) => {
  const routes = [
    {
      method: 'GET',
      path: '/custom/:id'
    },
    {
      method: 'POST',
      path: '/custom'
    }
  ]

  const result = matchRoute(routes, { method: 'GET', url: '/custom-resources/123' })
  t.is(result.route, null)
  t.is(result.params, null)
  t.is(result.query, null)
})

test('returns the parsed params', (t) => {
  const routes = [
    {
      method: 'GET',
      path: '/custom/:id'
    },
    {
      method: 'POST',
      path: '/custom'
    }
  ]

  const result = matchRoute(routes, { method: 'GET', url: '/custom/123?test=true' })
  t.deepEqual(result.params, { id: '123' })
  t.deepEqual(result.query, { test: 'true' })
})
