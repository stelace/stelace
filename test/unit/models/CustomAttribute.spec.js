require('dotenv').config()

const test = require('ava')

const {
  CustomAttribute
} = require('../../../src/models')

test('check if the object is enforced by the associated custom attributes', (t) => {
  const customAttributes = [
    { name: 'seatingCapacity', type: 'number' },
    { name: 'automaticGearbox', type: 'boolean' },
    { name: 'longDescription', type: 'text' },
    { name: 'color', type: 'select', listValues: ['blue', 'red', 'green'] },
    { name: 'options', type: 'tags', listValues: ['convertible', 'tinted-glass'] },
    { name: 'tags', type: 'tags', listValues: [] }
  ]

  t.true(CustomAttribute.checkObject({
    seatingCapacity: 4,
    automaticGearbox: false,
    longDescription: 'Lorem ipsum...',
    color: 'blue',
    options: ['convertible', 'tinted-glass'],
    tags: ['free tag', 'free-too']
  }, customAttributes).result)

  t.true(CustomAttribute.checkObject({
    seatingCapacity: 4
  }, customAttributes).result)

  t.true(CustomAttribute.checkObject({
    seatingCapacity: null
  }, customAttributes).result)

  t.false(CustomAttribute.checkObject({
    seatingCapacity: 'test'
  }, customAttributes).result)

  t.false(CustomAttribute.checkObject({
    color: ['blue', 'red']
  }, customAttributes).result)

  t.false(CustomAttribute.checkObject({
    options: ['custom']
  }, customAttributes).result)

  t.true(CustomAttribute.checkObject({
    options: ['tinted-glass']
  }, customAttributes).result)

  t.true(CustomAttribute.checkObject({
    options: ['tinted-glass', 'convertible']
  }, customAttributes).result)

  t.true(CustomAttribute.checkObject({
    options: null
  }, customAttributes).result)

  t.false(CustomAttribute.checkObject({
    options: 'not-an-array'
  }, customAttributes).result)

  t.false(CustomAttribute.checkObject({
    options: 123
  }, customAttributes).result)

  t.false(CustomAttribute.checkObject({
    tags: 'not-an-array'
  }, customAttributes).result)

  t.false(CustomAttribute.checkObject({
    unknownAttribute: true
  }, customAttributes).result)
})

test('display a list with detailed errors when the check custom attributes failed', (t) => {
  const customAttributes = [
    { name: 'seatingCapacity', type: 'number' },
    { name: 'automaticGearbox', type: 'boolean' },
    { name: 'longDescription', type: 'text' },
    { name: 'color', type: 'select', listValues: ['blue', 'red', 'green'] },
    { name: 'options', type: 'tags', listValues: ['convertible', 'tinted-glass'] }
  ]

  t.false(CustomAttribute.checkObject({
    unknownAttribute: true
  }, customAttributes).result)

  const result1 = CustomAttribute.checkObject({
    unknownAttribute: true
  }, customAttributes)

  t.false(result1.result)
  t.true(Array.isArray(result1.errors))
  t.true(result1.errors.length === 1)
  t.true(result1.errors[0].name === 'unknownAttribute')
  t.true(typeof result1.errors[0].value !== 'undefined')
  t.truthy(result1.errors[0].message)

  const result2 = CustomAttribute.checkObject({
    seatingCapacity: '4',
    automaticGearbox: 'false',
    longDescription: 10,
    color: 'cyan',
    options: ['radio', 'tinted-glass'],
    tags: 'radio'
  }, customAttributes)

  t.false(result2.result)
  t.true(Array.isArray(result2.errors))
  t.true(result2.errors.length === 6)
  t.truthy(result2.errors.find(error => error.name === 'seatingCapacity'))
  t.truthy(result2.errors.find(error => error.name === 'automaticGearbox'))
  t.truthy(result2.errors.find(error => error.name === 'longDescription'))
  t.truthy(result2.errors.find(error => error.name === 'color'))
  t.truthy(result2.errors.find(error => error.name === 'options'))
  t.truthy(result2.errors.find(error => error.name === 'tags'))

  const result3 = CustomAttribute.checkObject({
    seatingCapacity: 4,
    automaticGearbox: false,
    longDescription: 'Lorem ipsum...',
    color: 'blue',
    options: ['convertible', 'tinted-glass']
  }, customAttributes)

  t.true(result3.result)
  t.true(Array.isArray(result3.errors))
  t.true(result3.errors.length === 0)
})
