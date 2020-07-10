const glob = require('glob')
const path = require('path')
const semver = require('semver')
const _ = require('lodash')
const parseGithubUrl = require('parse-github-url')
const chalk = require('chalk')

const log = console.log
const info = str => log(`${chalk.green(str)}`)
const warn = (err, msg, note) => {
  if (msg) log(chalk.red(msg))
  if (note) log(chalk.yellow(note))
  if (err) log(err)
}

const { version: serverVersion } = require(path.join(__dirname, '../package.json'))

const { IGNORED_LOCAL_PLUGINS, INSTALLED_PLUGINS } = process.env

const stelaceServerPath = path.resolve(__dirname, '..')
const pluginsLoadedManually = []
const logged = {}

module.exports = {
  getPlugins,
  getInstalledPluginsNames,
  loadPlugin,
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
    externalPlugins = getInstalledPluginsNames().map(p => load(p, { useInstalledCopy: true }))
  }

  return [
    ...pluginsLoadedManually,
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

/**
 * Additional way to load any plugin using `require('stelace-server/plugins')`.
 * Must be called __before__ `require('stelace-server')`.
 * This lets external plugins manually load themselves to run their own test suite.
 * @param {String} path - Absolute path loaded with server `require`
 */
function loadPlugin (path) {
  load(path, { isManual: true })
}

function load (name, { isLocalModule, isManual, useInstalledCopy } = {}) {
  let p
  try {
    let mod = isLocalModule ? `./${name}` : name
    if (useInstalledCopy) mod = path.join(stelaceServerPath, 'plugins/installed', name)
    p = require(mod)
  } catch (err) {
    const installedModuleError = err.code === 'MODULE_NOT_FOUND' &&
      /plugins[\\/]index\.js/.test(_.get(err, 'requireStack[0]', ''))
    const shouldInstall = !isLocalModule && !isManual && installedModuleError
    const note = shouldInstall ? `Maybe you just forgot to run \`${
      chalk.bold('yarn plugins')
    }\`.\n` : ''
    warn(err, `\n${chalk.bold(name)} plugin error`, note)
    process.exit(0)
  }
  const { supportedServerVersions: versions } = p

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

  if (!logged[p.name]) info(`${chalk.bold(p.name)} plugin enabled`)
  logged[p.name] = true

  if (isManual) pluginsLoadedManually.push(p)

  return p
}

function fromEnvVar (v = '') {
  return _.compact(v.split(',').map(_.trim))
}
