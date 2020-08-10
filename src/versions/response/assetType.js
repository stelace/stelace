const responseChanges = {
  '2020-08-10': [
    {
      target: 'assetType.list',
      description: 'Asset types list is returned without pagination meta',
      down: async (params) => {
        const paginationMeta = params.result
        params.result = paginationMeta.results

        return params
      }
    }
  ],
}

module.exports = responseChanges
