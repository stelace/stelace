/* global AclService, User */

module.exports = {

    me,
    getMyPermissions,

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
    if (req.apiKey) {
        return {};
    }

    const permissions = await AclService.getUserPermissions(req.user);
    res.json(permissions);
}
