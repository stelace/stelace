const fs = require('fs');
const _ = require('lodash');

const data = fs.readFileSync('./.sailsrc', 'utf8');
const config = JSON.parse(data);

function getOriginalConfig() {
  return config;
}

function getConfig({ dbMigration = false } = {}) {
  if (!dbMigration) {
    return mergeConfig({ models: { migrate: 'safe' } });
  } else {
    return Object.assign({}, config);
  }
}

function mergeConfig(newConfig) {
  return _.merge({}, config, newConfig);
}

module.exports = {
  getOriginalConfig,
  getConfig,
  mergeConfig,
};
