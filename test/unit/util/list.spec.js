require('dotenv').config()

const test = require('ava')

const {
  replaceBy
} = require('../../../src/util/list')

test('replaces the right element', (t) => {
  const elements = [
    { id: 1, name: '1' },
    { id: 2, name: '2' },
    { id: 3, name: '3' },
    { id: 4, name: '4' },
    { id: 5, name: '5' }
  ]
  const elementsAfterReplacing = [
    { id: 1, name: '1' },
    { id: 2, name: '2' },
    { id: 3, name: 'new 3' },
    { id: 4, name: '4' },
    { id: 5, name: '5' }
  ]

  const elementToReplace = { id: 3, name: 'new 3' }

  const newElements = replaceBy(elements, elementToReplace, element => element.id === 3)
  t.deepEqual(newElements, elementsAfterReplacing)
})
