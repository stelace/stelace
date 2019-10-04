require('dotenv').config()
require('./src/secure-env').config()

const { start: startApm } = require('./apm')

// start the APM service before Restify server so it can monitor all application lifecycle
startApm()

const { start, stop } = require('./server')
const { onClose } = require('./close')

start()

onClose(async (signal, value) => {
  await stop()

  process.exit(128 + value)
})
