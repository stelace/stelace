require('dotenv').config()

const test = require('ava')

const { parseLocale } = require('../../../src/util/locale')

test('parses the locale', (t) => {
  t.deepEqual(parseLocale('fr'), {
    language: 'fr',
    region: null
  })

  t.deepEqual(parseLocale('fr-fr'), {
    language: 'fr',
    region: 'FR'
  })

  t.deepEqual(parseLocale('fr_CA'), {
    language: 'fr',
    region: 'CA'
  })
})
