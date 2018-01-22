/* global Passport */

module.exports = {

    getAuthMeans,
    addPasswordAuth,
    removePasswordAuth,
    removeAllAuth,

};

const _ = require('lodash');

/**
 * Get all authentication means for a user
 * @param {Number} userId
 * @result {Object} hash of all active authentication means
 * e.g. { local: true, facebook: true }
 */
async function getAuthMeans(userId) {
    const passports = await Passport.find({ user: userId });
    const result = _.reduce(passports, (memo, passport) => {
        if (passport.protocol === 'local') {
            memo.local = true;
        } else {
            memo[passport.provider] = true;
        }
        return memo;
    }, {});

    return result;
}

/**
 * Add password authentication for a user
 * @param {Object} params
 * @param {Number} params.userId
 * @param {String} params.password
 * @param {Object} [options]
 * @param {Boolean} [options.checkExistingAuth = true]
 * @result {Object} existing or created passport
 */
async function addPasswordAuth(params, options = {}) {
    const { userId, password } = params;
    const { checkExistingAuth = true } = options;

    if (!userId || !password) {
        throw new BadRequestError('Missing credentials');
    }

    if (checkExistingAuth) {
        const passport = await Passport.findOne({ user: userId, protocol: 'local' });
        if (passport) {
            return passport;
        }
    }

    const passport = await Passport.create({
        protocol: 'local',
        password,
        user: userId,
    });
    return passport;
}

/**
 * Remove password authentication for a user
 * @param {Number} userId
 */
async function removePasswordAuth(userId) {
    await Passport.destroy({ user: userId, protocol: 'local' });
}

/**
 * Remove all authentications for a user
 * @param {Number} userId
 */
async function removeAllAuth(userId) {
    await Passport.destroy({ user: userId });
}
