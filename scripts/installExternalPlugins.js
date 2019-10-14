/**
 * Used to install plugins during CI process
 * TODO: Use ShellJS for better portability https://github.com/shelljs/shelljs
 */

require('dotenv').config()
const { execSync } = require('child_process')
const path = require('path')
const script = require('commander')

script
  .option('-s, --save', 'Updates package.json and yarn.lock')
  .parse(process.argv)

const packageFile = path.join(__dirname, '../package.json')
const installedPluginsDir = path.join(__dirname, '../plugins/installed')

const { getInstalledPluginsNames } = require('../plugins')
const installs = (process.env.INSTALLED_PLUGINS || '').split(',').filter(Boolean)

const log = console.log

if (installs.length) {
  const list = installs.join(' ')
  if (script.save) {
    log('Installing plugins, updating package.json')
    execSync(`yarn add -D ${list}`, { stdio: 'inherit' })
  } else {
    // Hack needed to install without updating package.json & yarn.lock
    // https://github.com/yarnpkg/yarn/issues/1743
    log('Installing plugins without updating package.json')
    execSync(`cp ${packageFile} ${packageFile}.bckp`, { stdio: 'inherit' })
    execSync(`yarn add -D ${list} --no-lockfile`, { stdio: 'inherit' })
    execSync(`mv ${packageFile}.bckp ${packageFile}`, { stdio: 'inherit' })
  }

  // We copy installed plugins from `node_modules` to `plugins/installed` directory
  // so we can run their tests with AVA along with other core server tests
  getInstalledPluginsNames().forEach(p => {
    // Getting plugin root directory
    log(`Copying ${p} plugin tests and files to plugins/installed directory`)
    const pluginDirectory = path.dirname(require.resolve(`${p}/package.json`))
    const pluginFiles = `${pluginDirectory}/.`
    execSync(`mkdir -p ${installedPluginsDir}/${p} && cp -a ${pluginFiles} ${installedPluginsDir}/${p}`, {
      stdio: 'inherit'
    })
    // nested package.json file changes the way `require` resolved relative paths in plugin,
    // which can break tests.
    execSync(`rm ${installedPluginsDir}/${p}/package.json`, { stdio: 'inherit' })
  })
}
