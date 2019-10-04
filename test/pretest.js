const { dropTestPlatforms } = require('./lifecycle')

dropTestPlatforms()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.log(err)
    process.exit(0)
  })
