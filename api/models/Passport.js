const bcrypt = require('bcrypt');
const Promise = require('bluebird');

Promise.promisifyAll(bcrypt);

/**
 * Passport Model
 *
 * The Passport model handles associating authenticators with users. An authen-
 * ticator can be either local (password) or third-party (provider). A single
 * user can have multiple passports, allowing them to connect and use several
 * third-party strategies in optional conjunction with a password.
 *
 * Since an application will only need to authenticate a user once per session,
 * it makes sense to encapsulate the data specific to the authentication process
 * in a model of its own. This allows us to keep the session itself as light-
 * weight as possible as the application only needs to serialize and deserialize
 * the user, but not the authentication data, to and from the session.
 */
var Passport = {

    attributes: {

        id: {
            type: 'number',
            columnType: 'int',
            autoIncrement: true,
        },
        createdDate: {
            type: 'string',
            columnType: 'varchar(255)',
            maxLength: 255,
        },
        updatedDate: {
            type: 'string',
            columnType: 'varchar(255)',
            maxLength: 255,
        },

        // Required field: Protocol
        //
        // Defines the protocol to use for the passport. When employing the local
        // strategy, the protocol will be set to 'local'. When using a third-party
        // strategy, the protocol will be set to the standard used by the third-
        // party service (e.g. 'oauth', 'oauth2', 'openid').
        protocol: {
            type: 'string',
            columnType: 'varchar(255)',
            required: true,
            maxLength: 255,
        },

        // Local field: Password
        //
        // When the local strategy is employed, a password will be used as the
        // means of authentication along with either a username or an email.
        password: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },

        // Provider fields: Provider, identifer and tokens
        //
        // "provider" is the name of the third-party auth service in all lowercase
        // (e.g. 'github', 'facebook') whereas "identifier" is a provider-specific
        // key, typically an ID. These two fields are used as the main means of
        // identifying a passport and tying it to a local user.
        //
        // The "tokens" field is a JSON object used in the case of the OAuth stan-
        // dards. When using OAuth 1.0, a `token` as well as a `tokenSecret` will
        // be issued by the provider. In the case of OAuth 2.0, an `accessToken`
        // and a `refreshToken` will be issued.
        provider: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        identifier: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        tokens: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },

        user: {
            type: 'number',
            columnType: 'int',
            // index: true,
            required: true,
        },
    },

    /**
     * Validate password used by the local strategy.
     *
     * @param {string}   password The password to validate
     * @param {Function} next
     */
    validatePassword: function (passport, password, next) {
        return bcrypt
            .compareAsync(password, passport.password)
            .asCallback(next);
    },

    /**
    * Callback to be run before creating a Passport.
    *
    * @param {Object}   passport The soon-to-be-created Passport
    * @param {Function} next
    */
    beforeCreate: async (passport, next) => {
        try {
            Passport.beforeCreateDates(passport);

            if (passport.password) {
                const hash = await bcrypt.hashAsync(passport.password, 10);
                passport.password = hash;
            }

            next();
        } catch(err) {
            next(err);
        }
    },

    /**
    * Callback to be run before updating a Passport.
    *
    * @param {Object}   passport Values to be updated
    * @param {Function} next
    */
    beforeUpdate: async (passport, next) => {
        try {
            Passport.beforeUpdateDates(passport);

            if (passport.password) {
                const hash = await bcrypt.hashAsync(passport.password, 10);
                passport.password = hash;
            }

            next();
        } catch(err) {
            next(err);
        }
    },
};

module.exports = Passport;
