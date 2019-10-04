const {
  getRedisClient,
  setPlatformId
} = require('../src/redis')

async function reset () {
  const client = getRedisClient()

  await client.flushdbAsync()
}

module.exports = {
  reset,
  setPlatformId
}
