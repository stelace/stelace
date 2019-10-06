const _ = require('lodash')

/**
 * Returns (nested) object having `key`, found first (iteration order not guaranteed).
 * Found object path can also be returned when `getPath` option is true.
 * Recursively self nested keys are not supported.
 * E.g. `{ key: { key: { key: true } }}` will match only once (on outer 'key').
 * @param {Object|Object[]} obj
 * @param {String} key
 * @param {Object} [options]
 * @param {Boolean} [options.getPath=options.arrayResults] - `path` will be returned along with `result` if true
 * @param {Boolean} [options.arrayResults=false] - When true, all items of any array are searched in parallel
 *   and results are returned in an array instead of a single foundObject.
 *   Note that this only applies to matches in arrays.
 * @param {String} [options.base] - Restricts search target path, mostly for internal recursion use
 * @returns {Object} foundObject
 *   - or `{ result: foundObject, path }` if `getPath` is true,
 *   - or `[foundObject1, foundObject2]` if `arrayResults` is true.
 *     this array having `path` and `result` properties corresponding to first foundObject.
 *   - or `null` if not found
 */
async function findDeepKey (obj, key, { getPath = false, base = '', arrayResults = false } = {}) {
  if (!key || typeof key !== 'string') throw new Error('Key string expected')

  if (_.has(obj, key)) return getPath ? { result: obj, path: base } : obj

  let res = null
  let foundArray = []
  let returnedPath = ''
  let tmpPath = base.toString()
  const tmpObj = tmpPath ? _.get(obj, tmpPath, obj) : obj

  if (arrayResults && Array.isArray(tmpObj)) {
    const foundObjects = await Promise.all(obj.map(async (v, i) => {
      const opts = { base: _appendPath(tmpPath, i), getPath: true, arrayResults }
      return findDeepKey(v, key, opts)
    }))
    foundArray = _transformFoundObjects(foundObjects, { base })
  } else {
    for (const k in tmpObj) {
      const v = tmpObj[k]
      const shouldSearchInValue = !res && _.isObjectLike(v)
      if (!shouldSearchInValue) continue

      tmpPath = _appendPath(base, k)

      const found = await findDeepKey(v, key, { base: tmpPath, getPath: true, arrayResults }) || {}
      if (arrayResults && Array.isArray(found)) {
        foundArray = [...foundArray, ..._transformFoundObjects(found, { base })]
      }

      if (found.result) {
        res = found.result
        returnedPath = found.path
      }
    }
  }

  if (arrayResults && foundArray.length) {
    foundArray.result = foundArray[0].result
    foundArray.path = foundArray[0].path
    return foundArray
  }
  return getPath ? { result: res, path: returnedPath } : res
}

function _appendPath (base, suffix) {
  if (!suffix.toString()) return base.toString()
  return base.toString() ? `${base}.${suffix}` : `${suffix}`
}

function _transformFoundObjects (objects, { getPath = true, base } = {}) {
  return objects
    .map((o, i) => {
      if (getPath) o.path = o.path || _appendPath(base, i)
      else o = o.result

      return o
    })
    .filter(o => o.result) // apply this after map to preserve indices
}

/**
 * Returns array of found objects containing provided `key`, exactly as {@link findDeepKey}, but
 * unlike findDeepKey you can find *all* occurrences and transform with additional copy/move options.
 * Note that occurrences are matched once and only once and that findDeepKey does not support
 * self nested key occurrences.
 * @see findDeepKey
 * @param {Object|Object[]} obj
 * @param {String} key
 * @param {Object} [options]
 * @param {String} [options.copyTo] - if provided, found values will be *copied* to this path
 *   within parent object.
 *   Lodash-style {@link https://lodash.com/docs/4.17.11#get|path accessor} is expected,
 *   so you can set `path.to.array.0`.
 * @param {String} [options.moveTo] - if provided, found values will be *moved* to this path
 *   within parent object. This means original key/value pair will be removed from result.
 * @returns {Object[]|Object} Returns transformed object copy
 *   if one or both of `copyTo` and `moveTo` options are used,
 *   or returns an array of objects returned by {@link findDeepKey} called internally.
 */
async function allDeepKeys (object, key, options = {}) {
  if (!_.isPlainObject(options)) throw new Error('Options is expected to be an object.')
  if ([options.copyTo, options.moveTo].some(o => o && typeof o !== 'string')) {
    throw new Error('copyTo and moveTo options can only be strings or omitted.')
  }

  const copy = _.cloneDeep(object)
  const transformedObject = _.cloneDeep(object)

  const innerOptions = { getPath: true, arrayResults: true }
  let found = {}
  const all = []

  // Safeguard
  const maxDuration = 4000
  const start = new Date()

  while ((found = await findDeepKey(copy, key, innerOptions)) && found.result) { // eslint-disable-line
    if (Array.isArray(found)) found.forEach(handleSingleResult)
    else handleSingleResult(found)

    const elapsed = new Date() - start
    if (elapsed > maxDuration) throw new Error(`allDeepKeys taking more than ${maxDuration}.`, object)
  }

  function handleSingleResult (found) {
    const fullPath = found.path ? `${found.path}.${key}` : key
    // Target key may have been _.unset during recursion
    const pristineResultObject = found.path ? _.get(object, found.path) : object
    // Return exactly what is expected even if we need `path` in found object internally
    const formattedOutput = options.getPath
      ? Object.assign(found, { result: pristineResultObject })
      : pristineResultObject

    all.push(formattedOutput)

    const pathPrefix = found.path ? `${found.path}.` : ''
    if (options.copyTo) {
      _.set(transformedObject, `${pathPrefix}${options.copyTo}`, found.result[key])
    }
    if (options.moveTo) {
      _.set(transformedObject, `${pathPrefix}${options.moveTo}`, found.result[key])
      _.unset(transformedObject, fullPath)
    }

    // Useful for loop debugging
    // await new Promise(resolve => setTimeout(resolve, 200))

    // Recursively nested keys are not supported. Refer to {@link findDeepKey} for an example.
    // This line must always prevent infinite loop
    _.unset(copy, fullPath)
  }

  return (options.copyTo || options.moveTo) ? transformedObject : all
}

module.exports = {
  findDeepKey,
  allDeepKeys
}
