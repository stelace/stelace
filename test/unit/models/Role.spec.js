require('dotenv').config()

const test = require('ava')

const {
  Role
} = require('../../../src/models')

test('get namespaces recursively', (t) => {
  const roles = [
    {
      id: '1',
      value: 'dev',
      readNamespaces: ['*'],
      editNamespaces: ['*'],
      parentId: null
    },
    {
      id: '2',
      value: 'user',
      readNamespaces: ['custom1'],
      editNamespaces: ['custom2'],
      parentId: null
    },
    {
      id: '3',
      value: 'provider',
      readNamespaces: ['private1'],
      editNamespaces: ['private2'],
      parentId: '2'
    }
  ]

  t.deepEqual(Role.getNamespaces(roles, ['dev']), {
    readNamespaces: ['*'],
    editNamespaces: ['*']
  })

  t.deepEqual(Role.getNamespaces(roles, ['dev', 'user']), {
    readNamespaces: ['*', 'custom1'],
    editNamespaces: ['*', 'custom2']
  })

  t.deepEqual(Role.getNamespaces(roles, ['provider']), {
    readNamespaces: ['private1', 'custom1'],
    editNamespaces: ['private2', 'custom2']
  })
})
