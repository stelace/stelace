const _ = require('lodash')
const { allDeepKeys } = require('../../util/deepKeys')

const objectChanges = {
  '2018-08-10': [ // this is the target version for the following array of changes
    // downwards changes in this array will be applied if:
    // latest API version >= '2018-08-10' > selected version
    // selected version being Stelace version header in request OR platform config version
    {
      target: 'category', // object type (camel case)
      description: 'Describe changes here for documentation.',
      down: async (params) => {
        const { result } = params

        result.oldName = result.name
        delete result.name

        return params
      }
    }
  ],

  // More complex examples below:

  '2019-05-04': [
    {
      target: 'afterAll', // Applies after all object version transformations
      description: 'Copy platformData into marketplaceData',
      down: async (params) => {
        const { result } = params

        const newResult = await allDeepKeys(result, 'platformData', { copyTo: 'marketplaceData' })

        params.result = newResult
        return params
      }
    },

    {
      target: 'assetType',
      description: 'Move `marketplaceConfig` nested properties into root,' +
        ' rename `transactionTime` into `timing` and `blockAvailabilityStatus` into `unavailableWhen`',
      down: async (params) => {
        const { result } = params

        const marketplaceConfig = {
          pricing: result.pricing,
          transactionTime: result.timing,
          transactionProcess: result.transactionProcess,
          namespaces: result.namespaces,
          blockAvailabilityStatus: result.unavailableWhen
        }

        result.marketplaceConfig = marketplaceConfig
        delete result.pricing
        delete result.timing
        delete result.transactionProcess
        delete result.namespaces
        delete result.unavailableWhen

        const minDuration = _.get(result.marketplaceConfig, 'transactionTime.minDuration')
        const maxDuration = _.get(result.marketplaceConfig, 'transactionTime.maxDuration')

        if (minDuration) {
          _.set(result.marketplaceConfig, 'transactionTime.minDuration', _.values(minDuration)[0])
        }
        if (maxDuration) {
          _.set(result.marketplaceConfig, 'transactionTime.maxDuration', _.values(minDuration)[0])
        }

        return params
      }
    }
  ]
}

module.exports = objectChanges
