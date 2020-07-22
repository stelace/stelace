const requestChanges = {
  '2019-05-20': [
    {
      target: 'beforeAll', // all requests with a version <= '2019-05-20'
      description: 'Use offset pagination for version below version 2019-05-20 included',
      up: async (params) => {
        const { req } = params

        req._useOffsetPagination = true

        return params
      }
    }
  ],
}

module.exports = requestChanges
