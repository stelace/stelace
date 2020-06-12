const requestChanges = {
  '2019-05-20': [
    {
      target: 'webhook.list',
      description: 'Webhooks list is returned without pagination meta',
      up: async (params) => {
        const { req } = params

        req.query = {
          orderBy: 'createdDate',
          order: 'desc',
          nbResultsPerPage: 10000, // high number to retrieve all webhooks in theory
        }

        return params
      }
    }
  ],
}

module.exports = requestChanges
