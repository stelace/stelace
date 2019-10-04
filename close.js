// https://medium.com/@becintec/building-graceful-node-applications-in-docker-4d2cd4d5d392

var signals = {
  'SIGHUP': 1,
  'SIGINT': 2,
  'SIGTERM': 15
}

function onClose (shutdown) {
  Object.keys(signals).forEach((signal) => {
    process.on(signal, () => {
      shutdown(signal, signals[signal])
    })
  })
}

module.exports = {
  onClose
}
