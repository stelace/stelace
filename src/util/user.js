function getCurrentUserId (req) {
  if (req._organizationId) {
    return req._organizationId
  } else {
    return req._targetUserId || req._userId
  }
}

function getRealCurrentUserId (req) {
  return req._targetUserId || req._userId
}

function getCurrentOrganizationId (req) {
  return req._organizationId
}

// realOrganizationId can be the provided organizationId or an ancestor of this organization
function getCurrentRealOrganizationId (req) {
  return req._realOrganizationId
}

function isCurrentUserOrganization (req) {
  return !!req._organizationId
}

module.exports = {
  getCurrentUserId,
  getRealCurrentUserId,
  getCurrentOrganizationId,
  getCurrentRealOrganizationId,
  isCurrentUserOrganization
}
