const glob = require('glob')
const path = require('path')
const semver = require('semver')
const _ = require('lodash')
const parseGithubUrl = require('parse-github-url')

const { version: serverVersion } = require(path.join(__dirname, '../package.json'))

const { IGNORED_LOCAL_PLUGINS, INSTALLED_PLUGINS } = process.env

module.exports = {
  getPlugins,
  getInstalledPluginsNames
}

function getPlugins () {
  const pluginsFiles = glob.sync('*/index.js', {
    cwd: __dirname
  })

  const ignore = fromEnvVar(IGNORED_LOCAL_PLUGINS)
  const localPlugins = pluginsFiles
    .filter(file => {
      const dir = path.dirname(file)
      if (ignore.includes(dir)) return false
      return true
    })
    .map(p => load(p, { isLocalModule: true }))

  let externalPlugins = []
  if (INSTALLED_PLUGINS) {
    externalPlugins = getInstalledPluginsNames().map(load)
  }

  return [
    ...localPlugins,
    ...externalPlugins
  ]
}

function getInstalledPluginsNames () {
  return (process.env.INSTALLED_PLUGINS || '')
    .split(',')
    .map(getPluginName)
    .filter(Boolean)
}

/**
 * When using a github repository URL, the `name` set in plugin’s `package.json`
 * must exactly match the name of the repository.
 * @param {String} str - Either npm module name or github repository name
 */
function getPluginName (str) {
  const repo = parseGithubUrl(str)
  if (!_.has(repo, 'name')) return str
  return repo.name
}

function load (file, { isLocalModule }) {
  const p = require(isLocalModule ? `./${file}` : file)
  let { supportedServerVersions: versions } = p

  // Optional during migration
  if (versions && !semver.validRange(versions)) {
    throw new Error('Invalid supportedServerVersions range')
  }

  if (!p.name) throw new Error('Missing plugin name')
  if (!p.version) throw new Error('Missing plugin version')

  if (versions && !semver.satisfies(serverVersion, versions)) {
    throw new Error(`${serverVersion} Stelace server version not supported by ${
      p.name
    } plugin (${versions || 'missing range'})`)
  }

  return p
}

function fromEnvVar (v = '') {
  return _.compact(v.split(',').map(_.trim))
}
