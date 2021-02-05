/**
 * First step to install external plugins during CI and Docker image build process
 * and development as well.
 */

require('dotenv').config()
const shell = require('shelljs')
const path = require('path')
const script = require('commander')

script
  .option('-s, --save', 'Updates package.json and yarn.lock')
  .parse(process.argv)

const options = script.opts()

const packageFile = path.join(__dirname, '../package.json')
const installedPluginsDir = path.join(__dirname, '../plugins/installed')

const { getInstalledPluginsNames } = require('../plugins')
const installs = (process.env.INSTALLED_PLUGINS || '').split(',').filter(Boolean)

const log = console.log

if (installs.length) {
  const list = installs.join(' ')
  if (options.save) {
    log('Installing plugins, updating package.json')
    shell.exec(`yarn add -D ${list}`)
  } else {
    // Hack needed to install without updating package.json & yarn.lock
    // https://github.com/yarnpkg/yarn/issues/1743
    log('Installing plugins without updating package.json')
    shell.cp(packageFile, `${packageFile}.bckp`)
    shell.exec(`yarn add -D ${list} --no-lockfile`)
    shell.mv(`${packageFile}.bckp`, packageFile)
  }

  // We copy installed plugins from `node_modules` to `plugins/installed` directory
  // so we can run their tests with AVA along with other core server tests
  getInstalledPluginsNames().forEach(p => {
    // Getting plugin root directory
    log(`Copying ${p} plugin tests and files to plugins/installed directory`)
    const pluginDirectory = path.dirname(require.resolve(`${p}/package.json`))
    shell.mkdir('-p', `${installedPluginsDir}/${p}`)
    // currently no -a option in shelljs (https://github.com/shelljs/shelljs/issues/771)
    // and -P option doesn’t work with -R (https://github.com/shelljs/shelljs/issues/937)
    shell.cp('-R', `${pluginDirectory}/*`, `${installedPluginsDir}/${p}`)
    // nested package.json file changes the way `require` resolves relative paths in plugin,
    // which can break tests.
    shell.rm(`${installedPluginsDir}/${p}/package.json`)
  })
}
