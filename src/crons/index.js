const crons = {
  checkEsReindex: require('./checkESReindex'),
  emitTaskEvents: require('./emitTaskEvents')
}

function start (...args) {
  Object.keys(crons).forEach(key => {
    const cron = crons[key]
    cron.start(...args)
  })
}

function stop (...args) {
  Object.keys(crons).forEach(key => {
    const cron = crons[key]
    cron.stop(...args)
  })
}

module.exports = {
  start,
  stop,

  crons
}
