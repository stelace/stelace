const _ = require('lodash')
const apm = require('elastic-apm-node')
const { apiVersions } = require('./util')

class VersionTransformer {
  /**
   * @param {String}   label - Name your transformer, it will be used for APM
   * @param {String}   direction - allowed values: 'up' or 'down'
   *
   * There can be only ONE change for a same target and a same version
   * e.g. only one change for version: '2019-05-20' and target: 'category.create'
   * @param {Object[]} [options.changes = []]
   * @param {String}   options.changes[i].target - to identify the endpoint (for requests/responses) or the object type
   *   The target can have special values: 'beforeAll' or 'afterAll', please see the below transformation lifecycle
   * @param {String}   options.changes[i].version - change version, will apply this change or not
   *   depending on the fromVersion and toVersion
   *   The special value 'always' can be used to apply the change to any version.
   * @param {String}   options.changes[i].description - describe the change, can be used to automate documentation
   * @param {Function} options.changes[i].up - if direction is up
   * @param {Function} options.changes[i].down - if direction is down
   *
   * @param {Boolean}  [options.useApm = true] - if true, will log the transformation duration
   */
  constructor (label, direction, { changes = [], useApm = true }) {
    if (!label) {
      throw new Error('Missing label')
    }
    if (!['up', 'down'].includes(direction)) {
      throw new Error('Missing or incorrect value for direction, expected up or down')
    }

    this.label = label
    this.direction = direction
    this.apiVersions = sortVersions(apiVersions, this.direction)
    this.changes = changes
    this.indexedChanges = indexChanges(changes)
    this.useApm = useApm
  }

  addChanges (changes) {
    this.changes = this.changes.concat(changes)
    this.indexedChanges = indexChanges(this.changes)
  }

  getChange ({ version, target }) {
    return _.get(this.indexedChanges, `${version}.${target}`)
  }

  async applySingleChange ({ target, version, params = {} }) {
    let transformedParams = params

    const change = this.getChange({ version, target })
    if (_.isPlainObject(change)) {
      transformedParams = await change[this.direction](transformedParams)
    }

    return transformedParams
  }

  async applyChanges ({ target, fromVersion, toVersion, params = {} }) {
    const apmSpan = apm.startSpan(`${this.label} version transformation`)

    let transformedParams = params

    // apply the change for ANY version and ANY target
    // and before all other changes
    const beforeAllChange = this.getChange({ version: 'always', target: 'beforeAll' })
    if (_.isPlainObject(beforeAllChange)) {
      transformedParams = await beforeAllChange[this.direction](transformedParams)
    }

    const index = this.apiVersions.indexOf(fromVersion)
    const foundVersion = index !== -1

    if (foundVersion) {
      for (let i = index; i < this.apiVersions.length; i++) {
        const version = this.apiVersions[i]
        if (version === toVersion) break

        // apply the change for ANY target if the version matches
        // and before all changes of that version
        const beforeAllChangeWithVersion = this.getChange({ version, target: 'beforeAll' })
        if (_.isPlainObject(beforeAllChangeWithVersion)) {
          transformedParams = await beforeAllChangeWithVersion[this.direction](transformedParams)
        }

        // apply the change if the version and the target match
        const targetChange = this.getChange({ version, target })
        if (_.isPlainObject(targetChange)) {
          transformedParams = await targetChange[this.direction](transformedParams)
        }

        // apply the change for ANY target if the version matches
        // and after all changes of that version
        const afterAllChangeWithVersion = this.getChange({ version, target: 'afterAll' })
        if (_.isPlainObject(afterAllChangeWithVersion)) {
          transformedParams = await afterAllChangeWithVersion[this.direction](transformedParams)
        }
      }
    }

    // apply the change for ANY version and ANY target
    // and after all other changes
    const afterAllChange = this.getChange({ version: 'always', target: 'afterAll' })
    if (_.isPlainObject(afterAllChange)) {
      transformedParams = await afterAllChange[this.direction](transformedParams)
    }

    apmSpan && apmSpan.end()

    return transformedParams
  }
}

function indexChanges (changes) {
  return changes.reduce((indexed, change) => {
    const { version, target } = change
    const targets = Array.isArray(target) ? target : [target]
    targets.forEach(t => _.set(indexed, `${version}.${t}`, change))
    return indexed
  }, {})
}

function sortVersions (versions, direction) {
  return versions.slice(0).sort((a, b) => {
    const result = ascOrderCompare(a, b)
    if (direction === 'down') return -1 * result
    else return result
  })
}

function ascOrderCompare (a, b) {
  if (a < b) return -1
  else if (a === b) return 0
  else return 1
}

module.exports = VersionTransformer
