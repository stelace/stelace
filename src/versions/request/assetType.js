const requestChanges = {
  '2019-05-20': [
    {
      target: 'assetType.list',
      description: 'Asset types list is returned without pagination meta',
      up: async (params) => {
        const { req } = params

        req.query = {
          orderBy: 'createdDate',
          order: 'desc',
          nbResultsPerPage: 10000, // high number to retrieve all workflows in theory
        }

        return params
      }
    }
  ],
}

module.exports = requestChanges
