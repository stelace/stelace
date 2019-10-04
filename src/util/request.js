function getRequestContext (req) {
  return {
    method: req.method,
    routeName: req.route && req.route.name,
    ip: req._ip,
    requestId: req._requestId,
    selectedVersion: req._selectedVersion,
    platformVersion: req._platformVersion,
    latestVersion: req._latestVersion,
    platformId: req.platformId,
    env: req.env
  }
}

module.exports = {
  getRequestContext
}
