/**
 * Passport configuration
 *
 * This if the configuration for your Passport.js setup and it where you'd
 * define the authentication strategies you want your application to employ.
 *
 * I have tested the service with all of the providers listed below - if you
 * come across a provider that for some reason doesn't work, feel free to open
 * an issue on GitHub.
 *
 * Also, authentication scopes can be set through the `scope` property.
 *
 * For more information on the available providers, check out:
 * http://passportjs.org/guide/providers/
 */

var passportLocal    = require('passport-local');
var passportFacebook = require('passport-facebook');
var passportGoogle   = require('passport-google-oauth');

module.exports.passport = {

    local: {
        strategy: passportLocal.Strategy
    },

    // twitter: {
    //     name: 'Twitter',
    //     protocol: 'oauth',
    //     strategy: require('passport-twitter').Strategy,
    //     options: {
    //         consumerKey: 'your-consumer-key',
    //         consumerSecret: 'your-consumer-secret'
    //     }
    // },

    // github: {
    //     name: 'GitHub',
    //     protocol: 'oauth2',
    //     strategy: require('passport-github').Strategy,
    //     options: {
    //         clientID: 'your-client-id',
    //         clientSecret: 'your-client-secret'
    //     }
    // },

    facebook: {
        name: "Facebook",
        protocol: "oauth2",
        strategy: passportFacebook.Strategy,
        options: {
            clientID: "",
            clientSecret: "",
            profileFields: ["id", "displayName", "profileUrl", "name", "gender", "photos", "emails"],
            callbackURL: ""
        },
        scope: ["email", "public_profile", "user_friends"]
    },

    google: {
        name: "Google",
        protocol: "oauth2",
        strategy: passportGoogle.OAuth2Strategy,
        options: {
            clientID: "",
            clientSecret: "",
            callbackURL: ""
        },
        scope: ["email"]
    }

};
