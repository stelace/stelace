const _ = require('lodash')
const { allDeepKeys } = require('../../util/deepKeys')

const requestChanges = {
  '2018-07-30': [ // this is the target version for the following array of changes
    // changes in this array will be applied if:
    // selected version <= '2018-07-30' < latest API version
    // selected version being Stelace version header in request OR platform config version
    {
      target: 'category.create', // route name
      description: 'Describe changes here for documentation.',
      up: async (params) => {
        const { req } = params

        req.body.name = req.body.oldName
        delete req.body.oldName

        return params
      }
    }
  ],

  // More complex examples below:

  '2019-04-09': [
    {
      target: 'beforeAll', // Applies before all request version transformations
      description: 'Replace marketplateData with platformData',
      up: async (params) => {
        const { req } = params

        const newBody = await allDeepKeys(req.body, 'marketplaceData', { moveTo: 'platformData' })
        req.body = newBody

        return params
      }
    },

    {
      target: 'assetType.create',
      description: 'Move `marketplaceConfig` nested properties into root,' +
        ' rename `transactionTime` into `timing` and `blockAvailabilityStatus` into `unavailableWhen`',
      up: async (params) => {
        const { req } = params

        if (req.body.marketplaceConfig) {
          req.body.pricing = req.body.marketplaceConfig.pricing
          req.body.timing = req.body.marketplaceConfig.transactionTime
          req.body.unavailableWhen = req.body.marketplaceConfig.blockAvailabilityStatus
          req.body.transactionProcess = req.body.marketplaceConfig.transactionProcess
          req.body.namespaces = req.body.marketplaceConfig.namespaces

          if (_.isNumber(req.body.timing.minDuration)) {
            req.body.timing.minDuration = { [req.body.timeUnit]: req.body.timing.minDuration }
          }
          if (_.isNumber(req.body.timing.maxDuration)) {
            req.body.timing.maxDuration = { [req.body.timeUnit]: req.body.timing.maxDuration }
          }

          delete req.body.marketplaceConfig
        }

        return params
      }
    },
  ]
}

module.exports = requestChanges
