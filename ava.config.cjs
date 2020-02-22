require('dotenv').config()

const { IGNORED_LOCAL_PLUGINS, TESTS, STELACE_PLUGINS_PATHS } = process.env

const fromEnvVar = (v = '') => v.split(',').filter(Boolean).map(s => s.trim())

const pluginTestsToIgnore = fromEnvVar(IGNORED_LOCAL_PLUGINS).map(p => `!plugins/${p}/**/*`)
const cliLoadedPluginTests = fromEnvVar(STELACE_PLUGINS_PATHS).map(p => `${p}/**/*.spec.js`)

let tests = []
const integrationTests = ['test/integration/**/*.spec.js', 'plugins/**/*.spec.js', ...cliLoadedPluginTests]
const unitTests = ['test/unit/**/*.spec.js']

if (TESTS === 'integration') tests.push(...integrationTests)
else if (TESTS === 'unit') tests.push(...unitTests)
else tests = [...unitTests, ...integrationTests]

module.exports = () => ({
  files: [
    ...tests,
    ...pluginTestsToIgnore
  ],
  serial: false,
  cache: false,
  timeout: '30s'
})
