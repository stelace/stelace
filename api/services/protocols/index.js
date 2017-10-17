/**
 * Authentication Protocols
 *
 * Protocols where introduced to patch all the little inconsistencies between
 * the different authentication APIs. While the local authentication strategy
 * is as straigt-forward as it gets, there are some differences between the
 * services that expose an API for authentication.
 *
 * For example, OAuth 1.0 and OAuth 2.0 both handle delegated authentication
 * using tokens, but the tokens have changed between the two versions. This
 * is accomodated by having a single `token` object in the Passport model that
 * can contain any combination of tokens issued by the authentication API.
 */

var local  = require('./local');
var oauth  = require('./oauth');
var oauth2 = require('./oauth2');
var openid = require('./openid');

module.exports = {
    local: local,
    oauth: oauth,
    oauth2: oauth2,
    openid: openid
};
