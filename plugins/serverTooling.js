// Following objects are exposed on server object as well
// and can be required from a standalone plugin repo with stelace-server installed as devDependency.
// But we can’t require them from plugins within server project as it would entail circular dependencies.

const lifecycle = require('../test/lifecycle')
const auth = require('../test/auth')
const util = require('../test/util')
const factory = require('../test/fixtures/factory')
const fixtures = require('../test/fixtures')
const connection = require('../test/connection')

const permissions = require('../src/permissions')
const redis = require('../src/redis')
const roles = require('../src/roles')
const versions = require('../src/versions')

const time = require('../src/util/time')
const encoding = require('../src/util/encoding')

module.exports = {
  permissions,
  redis,
  roles,
  versions,

  testTools: {
    lifecycle,
    auth,
    util,
    factory,
    fixtures,
    connection
  },
  utils: {
    time,
    encoding
  }
}
