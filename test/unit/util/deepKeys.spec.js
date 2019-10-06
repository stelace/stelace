const test = require('ava')
const _ = require('lodash')

const { findDeepKey, allDeepKeys } = require('../../../src/util/deepKeys')

test('findDeepKey returns object itself when having key at root', async (t) => {
  const obj = { key: true }

  t.is(await findDeepKey(obj, 'key'), obj)
  t.deepEqual(await findDeepKey(obj, 'key', { getPath: true }), { result: { key: true }, path: '' })
})

test('allDeepKeys returns [object] itself when having key at root', async (t) => {
  const obj = { key: true }

  let results = await allDeepKeys(obj, 'key')
  t.deepEqual(results, [{ key: true }])
  t.is(results[0], obj)

  const copied = await allDeepKeys(obj, 'key', { copyTo: 'copied' })
  t.deepEqual(copied, { key: true, copied: true })

  results = await allDeepKeys(obj, 'key', { getPath: true })
  t.deepEqual(results, [{ result: { key: true }, path: '' }])
})

const array = [
  { id: '1', platformData: {} },
  { id: '2', platformData: {} },
  { id: '3', platformData: {} }
]

test('findDeepKey returns first object found in array or array of results using arrayResults option', async (t) => {
  const results = await findDeepKey(array, 'platformData', { arrayResults: true })
  t.deepEqual(results.result, { id: '1', platformData: {} })
  t.is(results.path, '0')

  // arrayResults is false by default
  t.deepEqual(await findDeepKey(array, 'platformData', { getPath: true }), {
    result: { id: '1', platformData: {} },
    path: '0'
  })
})

test('allDeepKeys returns first object found in array', async (t) => {
  t.deepEqual(await allDeepKeys(array, 'platformData'), array)
  t.deepEqual(await allDeepKeys(array, 'platformData', { getPath: true }), array.map((o, i) => {
    return { result: o, path: `${i}` }
  }))
})

const obj = { nested: { key: 'string' } }
const deep = {
  complex: true,
  body: { having: [1, 2], other: true, keys: _ => _, obj }
}
const several = {
  deep,
  notSoDeep: {
    other: 'here too',
    label: true
  }
}
const havingOtherInArray = {
  nested: { array: [{}, { deep }] }
}

test('findDeepKey returns nested object having key and path with getPath option', async (t) => {
  t.deepEqual(await findDeepKey(obj, 'key'), { key: 'string' })
  t.deepEqual(await findDeepKey(obj, 'key', { getPath: true }), {
    result: { key: 'string' },
    path: 'nested'
  })

  t.deepEqual(await findDeepKey(deep, 'key'), { key: 'string' })
  t.deepEqual(await findDeepKey(deep, 'key', { getPath: true }), {
    result: { key: 'string' },
    path: 'body.obj.nested'
  })
  // Keeps object references when passed in object
  t.is(await findDeepKey(deep, 'nested'), obj)
})

test('findDeepKey returns nested object found first when having key in several nested objects', async (t) => {
  // iteration order not guaranteed
  t.truthy(await findDeepKey(several, 'other'))
})

test('findDeepKey returns null when not finding key', async (t) => {
  t.is(await findDeepKey(deep, 'unknown'), null)
})

test('allDeepKeys returns an empty array when not finding key', async (t) => {
  t.deepEqual(await allDeepKeys(deep, 'unknown'), [])
})

test('allDeepKeys with transform option returns copied object when not finding key', async (t) => {
  const copy = await allDeepKeys(deep, 'unknown', { copyTo: 'whatever' })
  t.deepEqual(copy, deep)
  t.not(copy, deep)
})

test('allDeepKeys returns array including all nested objects', async (t) => {
  // iteration order not guaranteed
  const results = await allDeepKeys(several, 'other')

  t.true(Array.isArray(results))
  t.is(results.length, 2)
  t.true(results.every(r => r.other))
})

test('allDeepKeys copies or moves all key/value pairs occurrences', async (t) => {
  let transformed = await allDeepKeys(several, 'other', { copyTo: 'otherCopy' })
  const snapshot = _.cloneDeep(several)

  const expectedResult = _.cloneDeep(several)
  expectedResult.notSoDeep.otherCopy = expectedResult.notSoDeep.other
  expectedResult.deep.body.otherCopy = expectedResult.deep.body.other

  t.true(_.isPlainObject(transformed))
  t.deepEqual(transformed, expectedResult)
  // Passed object should not be mutated
  t.deepEqual(several, snapshot)

  // Moving: original key must be deleted
  transformed = await allDeepKeys(several, 'other', { moveTo: 'otherCopy' })
  delete expectedResult.notSoDeep.other
  delete expectedResult.deep.body.other

  t.true(_.isPlainObject(transformed))
  t.deepEqual(transformed, expectedResult)
  // Passed object should not be mutated
  t.deepEqual(several, snapshot)
})

const severalInArray = _.cloneDeep(several)
severalInArray.otherArray = [
  {},
  { useless: 0 },
  { other: true },
  { nested: { other: 'string' } }
]
severalInArray.yet = { anotherArray: [null, { other: 'here' }] }

test('findDeepKey returns object in arrays', async (t) => {
  let result = await findDeepKey(havingOtherInArray, 'other')
  t.true(_.isPlainObject(result))
  t.is(result.other, havingOtherInArray.nested.array[1].deep.body.other)

  // With path
  result = await findDeepKey(havingOtherInArray, 'other', { getPath: true })
  t.true(_.isPlainObject(result.result))
  t.is(result.result.other, havingOtherInArray.nested.array[1].deep.body.other)
  t.is(result.path, 'nested.array.1.deep.body')
})

test('allDeepKeys returns several objects in nested array', async (t) => {
  const expectedPaths = [
    'deep.body',
    'notSoDeep',
    'otherArray.2',
    'otherArray.3.nested',
    'yet.anotherArray.1'
  ].sort()
  const result = await allDeepKeys(severalInArray, 'other', { getPath: true })

  t.true(Array.isArray(result))
  t.is(result.length, 5)
  t.true(result.every(r => r.result.other === _.get(severalInArray, `${r.path}.other`)))

  const paths = result.reduce((p, r) => [r.path, ...p], []).sort()
  t.deepEqual(paths, expectedPaths)
})
