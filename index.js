const communication = require('./src/communication')
const permissions = require('./src/permissions')
const redis = require('./src/redis')
const roles = require('./src/roles')
const versions = require('./src/versions')

const logger = require('./logger')
const testTools = require('./test')
const utils = {
  authentication: require('./src/util/authentication'),
  availability: require('./src/util/availability'),
  currency: require('./src/util/currency'),
  encoding: require('./src/util/encoding'),
  environment: require('./src/util/environment'),
  list: require('./src/util/list'),
  listQueryBuilder: require('./src/util/listQueryBuilder'),
  locale: require('./src/util/locale'),
  pricing: require('./src/util/pricing'),
  time: require('./src/util/time'),
  transaction: require('./src/util/transaction'),
  transition: require('./src/util/transition'),
  user: require('./src/util/user'),
  validation: require('./src/util/validation'),
}

module.exports = {
  communication,
  permissions,
  redis,
  roles,
  versions,

  logger,
  testTools,
  utils,
}
