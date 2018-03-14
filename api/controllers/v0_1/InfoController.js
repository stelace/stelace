/* global User */

module.exports = {

    me,

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
