/* global EmailTemplateService, ImageService, Media, Passport, StelaceConfigService, UrlService, User, UserService */

const fs       = require('fs');
const path     = require('path');
const Url      = require('url');
const passport = require('passport');
const request  = require('request');
const uuid     = require('uuid');
const _ = require('lodash');
const Promise = require('bluebird');
const createError = require('http-errors');
const protocols = require('./protocols');

Promise.promisifyAll(fs);
Promise.promisifyAll(request, { multiArgs: true });

let passportInstance;

/**
 * Passport Service
 *
 * A painless Passport.js service for your Sails app that is guaranteed to
 * Rock Your Socks™. It takes all the hassle out of setting up Passport.js by
 * encapsulating all the boring stuff in two functions:
 *
 *   passport.endpoint()
 *   passport.callback()
 *
 * The former sets up an endpoint (/auth/:provider) for redirecting a user to a
 * third-party provider for authentication, while the latter sets up a callback
 * endpoint (/auth/:provider/callback) for receiving the response from the
 * third-party provider. All you have to do is define in the configuration which
 * third-party providers you'd like to support. It's that easy!
 *
 * Behind the scenes, the service stores all the data it needs within "Pass-
 * ports". These contain all the information required to associate a local user
 * with a profile from a third-party provider. This even holds true for the good
 * ol' password authentication scheme – the Authentication Service takes care of
 * encrypting passwords and storing them in Passports, allowing you to keep your
 * User model free of bloat.
 */

module.exports = {

    getPassportInstance,
    unsetPassportInstance,

};

async function getPassportInstance() {
    if (passportInstance) return passportInstance;

    const strategies = await fetchStrategies();

    passportInstance = _getPassportInstance(strategies);
    return passportInstance;
}

function _getPassportInstance(strategies) {
    const passportInstance = new passport.Passport();

    passportInstance.protocols = protocols;
    passportInstance.connect = connect;
    passportInstance.endpoint = endpoint;
    passportInstance.callback = callback;
    passportInstance.serializeUser(serializeUserHandler);
    passportInstance.deserializeUser(deserializeUserHandler);

    loadStrategies(passportInstance, strategies);

    return passportInstance;
}

function unsetPassportInstance() {
    passportInstance = null;
}

/**
 * Connect a third-party profile to a local user
 *
 * This is where most of the magic happens when a user is authenticating with a
 * third-party provider. What it does, is the following:
 *
 *   1. Given a provider and an identifier, find a mathcing Passport.
 *   2. From here, the logic branches into two paths.
 *
 *     - A user is not currently logged in:
 *       1. If a Passport wassn't found, create a new user as well as a new
 *          Passport that will be assigned to the user.
 *       2. If a Passport was found, get the user associated with the passport.
 *
 *     - A user is currently logged in:
 *       1. If a Passport wasn't found, create a new Passport and associate it
 *          with the already logged in user (ie. "Connect")
 *       2. If a Passport was found, nothing needs to happen.
 *
 * As you can see, this function handles both "authentication" and "authori-
 * zation" at the same time. This is due to the fact that we pass in
 * `passReqToCallback: true` when loading the strategies, allowing us to look
 * for an existing session in the request and taking action based on that.
 *
 * For more information on auth(entication|rization) in Passport.js, check out:
 * http://passportjs.org/guide/authenticate/
 * http://passportjs.org/guide/authorize/
 *
 * @param {Object}   req
 * @param {Object}   query
 * @param {Object}   profile
 * @param {Function} next
 */
async function connect(req, query, profile, next) {
    try {
        query.provider = req.param('provider');

        if (! query.provider || ! query.identifier) {
            throw createError(400, 'Not valid info');
        }

        const activeSocialLogin = await StelaceConfigService.isFeatureActive('SOCIAL_LOGIN');
        if (!activeSocialLogin) {
            throw createError(403, 'Social login disabled');
        }

        const [passport] = await Passport
            .find({
                provider: query.provider,
                identifier: query.identifier.toString(),
            })
            .limit(1);

        let user;

        if (! req.user) {
            if (! passport) {
                // Scenario: A new user is attempting to sign up using a third-party
                //           authentication provider.
                // Action:   Create a new user and assign them a passport.
                user = await createNewUser(query, profile, req);
            } else {
                // Scenario: An existing user is trying to log in using an already
                //           connected passport.
                // Action:   Get the user associated with the passport.
                user = await useExistingPassport(passport, query);
            }
        } else {
            if (! passport) {
                // Scenario: A user is currently logged in and trying to connect a new
                //           passport.
                // Action:   Create and assign a new passport to the user.
                user = await connectNewPassport(query, req.user);
            } else {
                // Scenario: The user is a nutjob or spammed the back-button.
                // Action:   Simply pass along the already established session.
                user = req.user;
            }
        }

        next(null, user);
    } catch (err) {
        next(err);
    }
}

async function createNewUser(query, profile, req) {
    const params = { req };

    // If the profile object contains a list of emails, grab the first one and
    // add it to the user.
    if (profile.emails && profile.emails.length && profile.emails[0].value) {
        params.email = profile.emails[0].value.toLowerCase();
    }
    // If the profile object contains a username, add it to the user.
    if (profile.username) {
        params.username = profile.username;
    }

    if (profile.name && profile.name.givenName) {
        params.firstname = profile.name.givenName;
    }
    if (profile.name && profile.name.familyName) {
        params.lastname = profile.name.familyName;
    }

    const user = await UserService.createUser(params);

    try {
        await Passport.create({
            provider: query.provider,
            identifier: query.identifier,
            protocol: query.protocol,
            user: user.id,
        });
    } catch (err) {
        await User.destroy({ id: user.id }).catch(() => {});

        throw err;
    }

    // email can be null if social login without email provided
    if (user.email) {
        const token = await User.createCheckEmailToken(user, user.email);

        EmailTemplateService
            .sendEmailTemplate('email_confirmation', {
                user,
                data: {
                    token,
                },
            })
            .catch(() => { /* do nothing*/ });
    }

    await downloadProfileImage(user, query, profile);

    return user;
}

async function useExistingPassport(passport, query) {
    let storedPassport;

    // If the tokens have changed since the last session, update them
    if (query.hasOwnProperty("tokens") && query.tokens !== passport.tokens) {
        storedPassport = await Passport.updateOne(passport.id, { tokens: query.tokens });
    } else {
        storedPassport = passport;
    }

    // Fetch the user associated with the Passport
    const user = await User.findOne({ id: storedPassport.user });
    return user;
}

async function connectNewPassport(query, user) {
    query.user = user.id;

    await Passport.create(query);
    return user;
}

async function downloadProfileImage(user, query, profile) {
    const imageSize = 300;
    let imageUrl;

    if (profile.photos.length) {
        if (query.provider === "facebook") {
            // get the image this way in order to have a bigger image
            imageUrl = "https://graph.facebook.com/"
                            + query.identifier
                            + "/picture?width=" + imageSize
                            + "&height=" + imageSize
                            + "&access_token=" + query.tokens.accessToken;
        } else if (query.provider === "google") {
            // do not take the default image
            if (profile._json.image && ! profile._json.image.isDefault) {
                imageUrl = profile.photos[0].value;

                const sizeRegex = /^(.*[?&]sz=)(\d+)(.*)$/;
                if (sizeRegex.test(imageUrl)) {
                    imageUrl = imageUrl.replace(sizeRegex, '$1' + imageSize + '$3');
                }
            }
        }
    }

    if (!imageUrl) {
        return user;
    }

    const fileUuid = uuid.v4();
    let filepath;

    try {
        const extension = await getFileExtension(imageUrl);
        filepath = path.join(sails.config.tmpDir, fileUuid + "." + extension);

        await downloadImage(imageUrl, filepath);
        const fileSize = await ImageService.getSize(filepath);

        const media = await Media.create({
            name: "Profile_image_from_" + query.provider,
            extension: extension,
            uuid: fileUuid,
            type: "img",
            userId: user.id,
            field: "user",
            targetId: user.id,
            width: fileSize.width,
            height: fileSize.height,
        });

        // do not compress image compared to upload file function
        // because pictures from social networks is compressed
        const destFilePath = path.join(sails.config.uploadDir, Media.getStorageFilename(media));
        await fs.renameAsync(filepath, destFilePath);

        const updatedUser = await User.updateOne(user.id, { mediaId: media.id });
        return updatedUser;
    } catch (err) {
        if (filepath) {
            await fs.unlinkAsync(filepath).catch(() => { /* do nothing */ });
        }
        return user;
    }
}

function getFileExtension(url) {
    return request.headAsync(url)
        .spread(response => {
            if (! response.headers || ! response.headers["content-type"]) {
                return;
            }

            return Media.convertContentTypeToExtension(response.headers["content-type"]);
        });
}

function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        request(url)
            .pipe(fs.createWriteStream(filepath))
            .on("error", reject)
            .on("close", resolve);
    });
}

/**
 * Create an authentication endpoint
 *
 * For more information on authentication in Passport.js, check out:
 * http://passportjs.org/guide/authenticate/
 *
 * @param  {Object} req
 * @param  {Object} res
 */
async function endpoint(req, res) {
    var strategies = sails.config.passport;
    var provider   = req.param('provider');
    var options    = {
        session: false
    };

    // If a provider doesn't exist for this endpoint, send the user back to the
    // login page
    if (! strategies.hasOwnProperty(provider)) {
        return res.redirect('/login');
    }

    // Attach scope if it has been set in the config
    if (strategies[provider].hasOwnProperty("scope")) {
        options.scope = strategies[provider].scope;
    }

    // Redirect the user to the provider for authentication. When complete,
    // the provider will redirect the user back to the application at
    //     /auth/:provider/callback
    this.authenticate(provider, options)(req, res, req.next);
}

/**
 * Create an authentication callback endpoint
 *
 * For more information on authentication in Passport.js, check out:
 * http://passportjs.org/guide/authenticate/
 *
 * @param {Object}   req
 * @param {Object}   res
 * @param {Function} next
 */
async function callback(req, res, next) {
    var provider = req.param('provider') || 'local';
    var action   = req.param('action');

    // Passport.js wasn't really built for local user registration, but it's nice
    // having it tied into everything else.
    if (provider === "local" && typeof action !== "undefined") {
        if (action === "register" && ! req.user) {
            this.protocols.local.register(req, res, next);
        } else if (action === "connect" && req.user) {
            this.protocols.local.connect(req, res, next);
        } else {
            // cannot register twice or perform actions different from (register, connect)
            next(createError(400, 'Invalid action'));
        }
    } else {

        // The provider will redirect the user to this URL after approval. Finish
        // the authentication process by attempting to obtain an access token. If
        // access was granted, the user will be logged in. Otherwise, authentication
        // has failed.

        if (provider === "local" && (! req.param("identifier") || ! req.param("password"))) {
            return next(createError(400, 'Invalid action'));
        }

        this.authenticate(provider, next)(req, res, req.next);
    }
}

async function fetchStrategies() {
    const secretData = await StelaceConfigService.getSecretData();
    return computeStrategies(secretData);
}

function computeStrategies(secretData) {
    const strategies = {};

    const localConfig = getLocalStrategyConfig();
    const facebookConfig = getFacebookStrategyConfig(secretData);
    const googleConfig = getGoogleStrategyConfig(secretData);

    if (localConfig) {
        strategies.local = localConfig;
    }
    if (facebookConfig) {
        strategies.facebook = facebookConfig;
    }
    if (googleConfig) {
        strategies.google = googleConfig;
    }

    return strategies;
}

function getLocalStrategyConfig() {
    return sails.config.passport.local;
}

/**
 * Returns nothing if missing config
 * @param {Object} config
 * @return {Object|undefined}
 */
function getFacebookStrategyConfig(secretData) {
    const facebookConfig = sails.config.passport.facebook;
    if (!facebookConfig) return;

    const clientID = secretData.social_login__facebook__client_id;
    const clientSecret = secretData.social_login__facebook__client_secret;
    const callbackURL = sails.config.stelace.url + '/auth/facebook/callback';

    if (!isValidStrategyCredentials({ clientID, clientSecret, callbackURL })) {
        return;
    }

    return _.merge({}, facebookConfig, {
        options: {
            clientID,
            clientSecret,
            callbackURL,
        },
    });
}

/**
 * Returns nothing if missing config
 * @param {Object} config
 * @return {Object|undefined}
 */
function getGoogleStrategyConfig(secretData) {
    const googleConfig = sails.config.passport.google;
    if (!googleConfig) return;

    const clientID = secretData.social_login__google__client_id;
    const clientSecret = secretData.social_login__google__client_secret;
    const callbackURL = sails.config.stelace.url + '/auth/google/callback';

    if (!isValidStrategyCredentials({ clientID, clientSecret, callbackURL })) {
        return;
    }

    return _.merge({}, googleConfig, {
        options: {
            clientID,
            clientSecret,
            callbackURL,
        },
    });
}

function isValidStrategyCredentials({ clientID, clientSecret, callbackURL }) {
    return typeof clientID === 'string' && clientID
        && typeof clientSecret === 'string' && clientSecret
        && UrlService.isUrl(callbackURL);
}

/**
 * Load all strategies defined in the Passport configuration
 *
 * For example, we could add this to our config to use the GitHub strategy
 * with permission to access a users email address (even if it's marked as
 * private) as well as permission to add and update a user's Gists:
 *
    github: {
      name: 'GitHub',
      protocol: 'oauth2',
      scope: [ 'user', 'gist' ]
      options: {
        clientID: 'CLIENT_ID',
        clientSecret: 'CLIENT_SECRET'
      }
    }
 *
 * For more information on the providers supported by Passport.js, check out:
 * http://passportjs.org/guide/providers/
 *
 */
function loadStrategies(passport, strategies) {
    Object.keys(strategies).forEach(key => {
        const options = { passReqToCallback: true };
        let Strategy;

        if (key === 'local') {
            // Since we need to allow users to login using both usernames as well as
            // emails, we'll set the username field to something more generic.
            _.assign(options, { usernameField: 'identifier' });

            // Only load the local strategy if it's enabled in the config
            if (strategies.local) {
                Strategy = strategies[key].strategy;

                passport.use(new Strategy(options, passport.protocols.local.login));
            }
        } else {
            if (!strategies[key]) return;

            const protocol = strategies[key].protocol;
            let callback = strategies[key].callback;

            if (!callback) {
                callback = path.join('auth', key, 'callback');
            }

            Strategy = strategies[key].strategy;

            const baseUrl = sails.config.stelace.url;

            switch (protocol) {
                case 'oauth':
                case 'oauth2':
                    options.callbackURL = Url.resolve(baseUrl, callback);
                    break;

                case 'openid':
                    options.returnURL = Url.resolve(baseUrl, callback);
                    options.realm     = baseUrl;
                    options.profile   = true;
                    break;
            }

            // Merge the default options with any options defined in the config. All
            // defaults can be overriden, but I don't see a reason why you'd want to
            // do that.
            _.assign(options, strategies[key].options);

            passport.use(new Strategy(options, passport.protocols[protocol]));
        }
    });
}

function serializeUserHandler(user, next) {
    next(null, user.id);
}

function deserializeUserHandler(id, next) {
    User.findOne(id, next);
}
