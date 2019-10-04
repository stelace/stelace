/**
 * This scripts prepares tests of installed plugins to run with core server tests
 * TODO: Use ShellJS for better portability https://github.com/shelljs/shelljs
 */

require('dotenv').config()
const path = require('path')
const { execSync } = require('child_process')

const { getInstalledPluginsNames } = require('../plugins')
const stelaceServerPath = path.resolve(__dirname, '..')

if (getInstalledPluginsNames().length) {
  // can be resolved inside Docker
  console.log("Injecting local server in `require('stelace-server')` within installed plugins tests")
  execSync(`find ${
    stelaceServerPath
  }/plugins/installed -type f -exec sed -i "s|require('stelace-server\\([^']*\\)')|require('${
    stelaceServerPath
  }\\1')|" {} +`, {
    stdio: 'inherit'
  })
}
