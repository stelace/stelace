require('dotenv').config()

const test = require('ava')

const {
  isValidHierarchy
} = require('../../../src/util/hierarchy')

test('checks if the hierarchy is valid', (t) => {
  const elements1 = [
    { id: 1, parentId: null },
    { id: 2, parentId: 1 },
    { id: 3, parentId: 2 },
    { id: 4, parentId: 3 },
    { id: 5, parentId: 4 }
  ]

  t.true(isValidHierarchy(elements1))

  const elements2 = [
    { id: 1, parentId: 5 },
    { id: 2, parentId: 1 },
    { id: 3, parentId: 2 },
    { id: 4, parentId: 3 },
    { id: 5, parentId: 4 }
  ]

  t.false(isValidHierarchy(elements2))

  const elements3 = [
    { id: 1, parentId: null },
    { id: 2, parentId: 1 },
    { id: 3, parentId: 2 },
    { id: 4, parentId: 3 },
    { id: 5, parentId: 4 },
    { id: 6, parentId: 2 },
    { id: 7, parentId: 6 },
    { id: 8, parentId: 7 },
    { id: 9, parentId: 8 },
    { id: 10, parentId: 10 }
  ]

  t.false(isValidHierarchy(elements3))

  const elements4 = [
    { id: 1, parentId: null },
    { id: 2, parentId: 1 },
    { id: 3, parentId: 2 },
    { id: 4, parentId: 3 },
    { id: 5, parentId: 4 },
    { id: 6, parentId: 10 },
    { id: 7, parentId: 6 },
    { id: 8, parentId: 7 },
    { id: 9, parentId: 8 },
    { id: 10, parentId: null }
  ]

  t.true(isValidHierarchy(elements4))

  const elements5 = [
    { id: 1, parentId: null },
    { id: 2, parentId: 1 },
    { id: 3, parentId: 2 },
    { id: 4, parentId: 3 },
    { id: 5, parentId: 4 },
    { id: 6, parentId: 10 },
    { id: 7, parentId: 6 },
    { id: 8, parentId: 7 },
    { id: 9, parentId: 8 },
    { id: 10, parentId: 9 }
  ]

  t.false(isValidHierarchy(elements5))
})
