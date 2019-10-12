const _ = require('lodash')

let requester

function init (server, { middlewares, helpers } = {}) {
  const {
    checkPermissions
  } = middlewares
  const {
    wrapAction
  } = helpers

  server.post({
    name: 'authorization.checkPermissions',
    path: '/permissions/check'
  }, wrapAction(async (req, res) => {
    const fields = [
      'permissions'
    ]

    const payload = _.pick(req.body, fields)

    const { permissions: permissionsToCheck } = payload

    // check the permissions here because we need to check dynamically the permissions passed via the payload
    await new Promise((resolve, reject) => {
      checkPermissions(permissionsToCheck, { optionalCheck: true })(req, res, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    const permissionsObject = {
      missingPlanPermissions: []
    }

    permissionsToCheck.forEach(p => {
      permissionsObject[p] = req.matchedPermissions[p] || false
      if (req.missingPlanPermissions.includes(p)) {
        permissionsObject.missingPlanPermissions.push(p)
      }
    })

    return permissionsObject
  }))
}

function start ({ communication }) {
  const { getRequester } = communication

  requester = getRequester({
    name: 'Authorization route > Authorization Requester',
    key: 'authorization'
  })
}

function stop () {
  requester.close()
  requester = null
}

module.exports = {
  init,
  start,
  stop
}
