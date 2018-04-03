/* global AuthService, EmailTemplateService, MicroService, Passport, User, UserService */

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

const createError = require('http-errors');

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
exports.register = async function (req, res, next) {
    var email    = req.param("email");
    var username = req.param("username");
    var password = req.param("password");

    try {
        const user = await UserService.createUser({
            email,
            username,
            password,
        }, {
            passwordRequired: true,
            req,
            res,
        });

        var token = await User.createCheckEmailToken(user, user.email);

        EmailTemplateService
            .sendEmailTemplate('email_confirmation', {
                user,
                data: {
                    token,
                },
            })
            .catch(() => { /* do nothing*/ });

        next(null, user);
    } catch (err) {
        next(err);
    }
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
exports.connect = async function (req, res, next) {
    var user     = req.user;
    var password = req.param("password");

    try {
        await AuthService.addPasswordAuth({ userId: user.id, password });
        next(null, user);
    } catch (err) {
        next(err);
    }
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
exports.login = async function (req, identifier, password, next) {
    var isEmail = MicroService.isEmail(identifier);

    try {
        if (!isEmail) {
            throw createError(400, 'Email incorrect');
        }

        const user = await User.findOne({ email: identifier });
        if (!user) {
            throw createError(404, 'User not found');
        }

        const [passport] = await Passport
            .find({
                protocol: 'local',
                user: user.id,
            })
            .limit(1);
        if (!passport) {
            throw createError(400, 'No password');
        }

        const valid = await Passport.validatePassword(passport, password);
        if (!valid) {
            throw createError(400, 'Password incorrect');
        }

        next(null, user);
    } catch (err) {
        next(err);
    }
};
