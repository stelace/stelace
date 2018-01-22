/* global User */

const Promise = require('bluebird');

module.exports = function (req, res, next) {

    return Promise
        .resolve()
        .then(() => {
            // for anonymous users
            if (! req.user || ! req.user.id) {
                return;
            }

            return User
                .findOne({ id: req.user.id })
                .then(user => {
                    if (! user) {
                        throw new NotFoundError("user not found");
                    }

                    req.user = user;
                    return;
                });
        })
        .asCallback(next);

};
