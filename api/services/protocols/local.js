/* global EmailTemplateService, Passport, User */

/**
 * Local Authentication Protocol
 *
 * The most widely used way for websites to authenticate users is via a username
 * and/or email as well as a password. This module provides functions both for
 * registering entirely new users, assigning passwords to already registered
 * users and validating login requesting.
 *
 * For more information on local authentication in Passport.js, check out:
 * http://passportjs.org/guide/username-password/
 */

/**
 * Register a new user
 *
 * This method creates a new user from a specified email, username and password
 * and assign the newly created user a local Passport.
 *
 * @param {Object}   req
 * @param {Object}   res
 * @param {Function} next
 */
exports.register = function (req, res, next) {
    var email    = req.param("email");
    var username = req.param("username");
    var password = req.param("password");

    var createAttrs = {
        email: email
    };

    var error;

    return Promise.coroutine(function* () {
        if (! email) {
            throw new BadRequestError("no email");
        }
        if (! µ.isEmail(email)) {
            error = new BadRequestError("invalid email");
            error.expose = true;
            throw error;
        }
        if (! password) {
            throw new BadRequestError("no password");
        }

        if (µ.isEmail(email)) {
            createAttrs.username = username || email.split("@")[0];
        }

        var user = yield User.findOne({ email: email });

        if (user) {
            error = new BadRequestError("email exists");
            error.expose = true;
            throw error;
        }

        user = yield User.create(createAttrs)
            .catch(function (err) {
                if (err.code === "E_VALIDATION") {
                    if (err.invalidAttributes.email) {
                        error = new BadRequestError("email exists");
                        error.expose = true;
                        throw error;
                    } else {
                        throw new Error("user exists");
                    }
                }
            });

        var token = yield User.createCheckEmailToken(user, user.email);

        return yield Passport
            .create({
                protocol: "local",
                password: password,
                user: user.id
            })
            .then(() => {
                EmailTemplateService.sendEmailTemplate('app-subscription-to-confirm', {
                    user: user,
                    token: token
                })
                .catch(() => { /* do nothing*/ });

                return user;
            })
            .catch(err => {
                if (err.code === "E_VALIDATION") {
                    throw new Error("passport invalid");
                }

                return user.destroy()
                    .then(function () {
                        throw err;
                    })
                    .catch(function (destroyErr) {
                        throw destroyErr;
                    });
            });
    })()
    .asCallback(next);
};

/**
 * Assign local Passport to user
 *
 * This function can be used to assign a local Passport to a user who doens't
 * have one already. This would be the case if the user registered using a
 * third-party service and therefore never set a password.
 *
 * @param {Object}   req
 * @param {Object}   res
 * @param {Function} next
 */
exports.connect = function (req, res, next) {
    var user     = req.user;
    var password = req.param("password");

    return Promise
        .resolve()
        .then(function () {
            return Passport.findOne({
                protocol: "local",
                user: user.id
            });
        })
        .then(function (passport) {
            if (! passport) {
                return Passport
                    .create({
                        protocol: "local",
                        password: password,
                        user: user.id
                    })
                    .then(function (/* passport */) {
                        return user;
                    });
            } else {
                return user;
            }
        })
        .asCallback(next);
};

/**
 * Validate a login request
 *
 * Looks up a user using the supplied identifier (email or username) and then
 * attempts to find a local Passport associated with the user. If a Passport is
 * found, its password is checked against the password supplied in the form.
 *
 * @param {Object}   req
 * @param {string}   identifier
 * @param {string}   password
 * @param {Function} next
 */
exports.login = function (req, identifier, password, next) {
    var isEmail = µ.isEmail(identifier);

    return Promise
        .resolve()
        .then(function () {
            if (! isEmail) {
                throw new BadRequestError("email incorrect");
            }

            return User.findOne({ email: identifier });
        })
        .then(function (user) {
            if (! user) {
                throw new NotFoundError("user not found");
            }

            return [
                user,
                Passport.findOne({
                    protocol: "local",
                    user: user.id
                })
            ];
        })
        .spread(function (user, passport) {
            if (passport) {
                return passport
                    .validatePassword(password)
                    .then(function (valid) {
                        if (! valid) {
                            throw new BadRequestError("password incorrect");
                        }

                        return user;
                    });
            } else {
                throw new BadRequestError("no password");
            }
        })
        .asCallback(next);
};
