require('dotenv').config()

const { IGNORED_LOCAL_PLUGINS, TESTS, STELACE_PLUGINS_PATHS, INSTANT_DATA } = process.env

const fromEnvVar = (v = '') => v.split(',').filter(Boolean).map(s => s.trim())

const pluginTestsToIgnore = fromEnvVar(IGNORED_LOCAL_PLUGINS).map(p => `!plugins/${p}/**/*`)
const cliLoadedPluginTests = fromEnvVar(STELACE_PLUGINS_PATHS).map(p => `${p}/**/*.spec.js`)

let tests = []
const seedTests = ['scripts/instantData.js']
const integrationTests = ['test/integration/**/*.spec.js', 'plugins/**/*.spec.js', ...cliLoadedPluginTests]
const unitTests = ['test/unit/**/*.spec.js']

let files = []

if (INSTANT_DATA === 'true') files = [...seedTests]
else {
  if (TESTS === 'integration') tests.push(...integrationTests)
  else if (TESTS === 'unit') tests.push(...unitTests)
  else tests = [...unitTests, ...integrationTests]

  files = [
    ...tests,
    ...pluginTestsToIgnore
  ]
}

module.exports = () => ({
  files,
  serial: false,
  cache: false,
  timeout: '30s'
})
