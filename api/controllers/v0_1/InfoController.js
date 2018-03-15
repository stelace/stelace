/* global AclService, User */

module.exports = {

    me,
    getMyPermissions,
    getPlanPermissions,

};

async function me(req, res) {
    const access = 'api';

    const result = {
        user: null,
        apiKey: null,
    };

    if (req.user) {
        result.user = User.expose(req.user, access);
    } else if (req.apiKey) {
        result.apiKey = true;
    }

    res.json(result);
}

async function getMyPermissions(req, res) {
    let permissions;

    if (req.user) {
        permissions = await AclService.getUserPermissions(req.user);
    } else {
        permissions = await AclService.getApiKeyPermissions(req.apiKey);
    }

    res.json(permissions);
}

async function getPlanPermissions(req, res) {
    const planPermissions = await AclService.getPlanPermissions();
    res.json(planPermissions);
}
