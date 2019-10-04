require('dotenv').config()

const { IGNORED_LOCAL_PLUGINS, TESTS } = process.env

const fromEnvVar = (v = '') => v.split(',').filter(Boolean).map(s => s.trim())

const pluginTestsToIgnore = fromEnvVar(IGNORED_LOCAL_PLUGINS).map(p => `!plugins/${p}/**/*`)

let tests = []
const integrationTests = ['test/integration/**/*.spec.js', 'plugins/**/*.spec.js']
const unitTests = ['test/unit/**/*.spec.js']

if (TESTS === 'integration') tests.push(...integrationTests)
else if (TESTS === 'unit') tests.push(...unitTests)
else tests = [...unitTests, ...integrationTests]

export default () => ({
  files: [
    ...tests,
    ...pluginTestsToIgnore
  ],
  sources: [
    '**/*.js',
    '!node_modules/**/*'
  ],
  serial: false,
  cache: false
})
