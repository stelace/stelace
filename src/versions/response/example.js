const bluebird = require('bluebird')
const { applyObjectSingleChange } = require('../object')

const responseChanges = {
  '2018-08-10': [ // this is the target version for the following array of changes
    // changes in this array will be applied if:
    // latest API version >= '2018-08-10' > selected version
    // selected version being Stelace version header in request OR platform config version
    {
      target: 'category.create', // route name
      description: 'Describe changes here for documentation.',
      down: async (params) => {
        const newParams = await applyObjectSingleChange({ version: '2018-08-10', target: 'category', params })
        return newParams
      }
    }
  ],

  // More complex examples below:

  '2019-05-04': [
    {
      target: 'afterAll',
      description: 'Copy platformData into marketplaceData', // Applies after all response version transformations
      down: async (params) => {
        const newParams = await applyObjectSingleChange({ version: '2019-05-04', target: 'afterAll', params })
        return newParams
      }
    },

    {
      target: 'transaction.list',
      description: 'Change duration structure from `nbTimeUnits` to `duration`',
      down: async (params) => {
        params.result.results = await bluebird.map(params.result.results, async (result) => {
          const newParams = await applyObjectSingleChange({ version: '2019-05-04', target: 'transaction', params: { result } })
          return newParams.result
        })

        return params
      }
    },
  ]
}

module.exports = responseChanges
