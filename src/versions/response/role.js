const responseChanges = {
  '2020-08-10': [
    {
      target: 'role.list',
      description: 'Roles list is returned without pagination meta',
      down: async (params) => {
        const paginationMeta = params.result
        params.result = paginationMeta.results

        return params
      }
    }
  ],
}

module.exports = responseChanges
