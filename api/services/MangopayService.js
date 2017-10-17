var request  = require('request');
var moment   = require('moment');
var CryptoJS = require('crypto-js');

Promise.promisifyAll(request, { multiArgs: true });

var api = {
    protocol: "https",
    hostname: {
        sandbox: "api.sandbox.mangopay.com",
        production: "api.mangopay.com"
    },
    version: "v2.01"
};
var refreshTokenBeforeExpirationInMinutes = 5; // 5 minutes
var mangopaySingletons = {};


module.exports = {

    getInstance: getInstance,
    getSingleton: getSingleton

};


function getInstance(options) {
    return new Mangopay(options);
}

function getSingleton(options) {
    var hash = getInstanceHash(options);
    var singleton = mangopaySingletons[hash];

    if (singleton) {
        return singleton;
    } else {
        mangopaySingletons[hash] = getInstance(options);
        return mangopaySingletons[hash];
    }
}

function getInstanceHash(options) {
    var str = "" + options.username + options.password;

    if (options.production) {
        str += options.production;
    }

    return CryptoJS.MD5(str);
}

function Mangopay(options) {
    this.httpClient = new HttpClient(options);

    this.event            = new Event(this.httpClient);
    this.hook             = new Hook(this.httpClient);
    this.user             = new User(this.httpClient);
    this.wallet           = new Wallet(this.httpClient);
    this.payin            = new Payin(this.httpClient);
    this.card             = new Card(this.httpClient);
    this.preauthorization = new Preauthorization(this.httpClient);
    this.refund           = new Refund(this.httpClient);
    this.bankAccount      = new BankAccount(this.httpClient);
    this.payout           = new Payout(this.httpClient);
}

function setUrlParam(url, key, value) {
    var hasParams = (url.indexOf("?") !== -1);

    return url + (hasParams ? "&" : "?") + key + "=" + value;
}

////////////////
// HttpClient //
////////////////

/**
 * @param args
 * - *username
 * - *password
 * - production
 */
function HttpClient(args) {
    if (typeof args.username !== "string"
        || typeof args.password !== "string"
    ) {
        throw new Error("HttpClient: bad parameters");
    }

    this.username   = args.username;
    this.password   = args.password;
    this.production = args.production;

    this.hostname = (this.production ? api.hostname.production : api.hostname.sandbox);
    this.basicAuthToken = this.getBasicAuthToken();
}

HttpClient.prototype.getBasicAuthToken   = httpClient_getBasicAuthToken;
HttpClient.prototype.getOAuth2Token      = httpClient_getOAuth2Token;
HttpClient.prototype.request             = httpClient_request;
HttpClient.prototype.setPaginationParams = httpClient_setPaginationParams;

function httpClient_getBasicAuthToken() {
    var token = this.username + ":" + this.password;
    token = new Buffer(token).toString("base64");

    return "Basic " + token;
}

function httpClient_getOAuth2Token() {
    return Promise
        .resolve()
        .then(() => {
            if (this.expirationDate && moment().isBefore(this.expirationDate)) {
                return this.oauth2Token;
            }

            var options = {
                url: api.protocol + "://" + this.hostname + "/" + api.version + "/oauth/token",
                headers: {
                    Authorization: this.basicAuthToken
                },
                form: {
                    grant_type: "client_credentials"
                },
                json: true
            };

            return request
                .postAsync(options)
                .spread((response, body) => {
                    if (response.statusCode !== 200) {
                        throw body;
                    }

                    this.oauth2Token = body;
                    this.expirationDate = moment()
                                            .add(this.oauth2Token.expires_in, "s")
                                            .subtract(refreshTokenBeforeExpirationInMinutes, "m");

                    return body;
                });
        });
}

function httpClient_request(path, options) {
    options = options || {};

    return this.getOAuth2Token()
        .then(token => {
            var method = options.method || "";
            options = _.omit(options, "method");

            var args = _.defaults(options, {
                url: api.protocol + "://" + this.hostname + "/" + api.version + "/" + this.username + path,
                headers: {
                    Authorization: token.token_type + " " + token.access_token
                },
                json: true
            });

            var requestHandler = (response, body) => {
                if (response.statusCode !== 200) {
                    throw body;
                }

                return body;
            };

            switch (method.toLowerCase()) {
                case "":
                case "get":
                    return request.getAsync(args).spread(requestHandler);

                case "post":
                    return request.postAsync(args).spread(requestHandler);

                case "put":
                    return request.putAsync(args).spread(requestHandler);

                case "delete":
                    return request.delAsync(args).spread(requestHandler);
            }
        });
}

/**
 * @param options
 * - page
 * - perPage
 */
function httpClient_setPaginationParams(path, options) {
    options = options || {};
    options.page = options.page || 1;
    options.perPage = options.perPage || 10;

    path = setUrlParam(path, "page", options.page);
    path = setUrlParam(path, "per_page", options.perPage);

    return path;
}


///////////
// Event //
///////////

function Event(httpClient) {
    this.httpClient = httpClient;
}

Event.prototype.list = event_list;

/**
 * @param options
 * - afterDate (Unix Timestamp)
 * - beforeDate (Unix Timestamp)
 * - page
 * - perPage
 */
function event_list(options) {
    options = options || {};
    var path = "/events";
    path = this.httpClient.setPaginationParams(path, options);

    if (options.afterDate) {
        path = setUrlParam(path, "afterDate", options.afterDate);
    }
    if (options.beforeDate) {
        path = setUrlParam(path, "beforeDate", options.beforeDate);
    }

    return this.httpClient.request(path, options);
}


//////////
// Hook //
//////////

function Hook(httpClient) {
    this.httpClient = httpClient;
}

Hook.prototype.list   = hook_list;
Hook.prototype.fetch  = hook_fetch;
Hook.prototype.create = hook_create;
Hook.prototype.edit   = hook_edit;

function hook_list(options) {
    var path = "/hooks";

    return this.httpClient.request(path, options);
}

/**
 * @param options
 * - *hookId
 */
function hook_fetch(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.hookId) {
                throw new Error("hook.fetch: missing parameters");
            }

            var path = "/hooks/" + options.hookId;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *body.Url
 * - *body.EventType
 * - body.Tag
 */
function hook_create(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.body.Url
                || ! options.body.EventType
            ) {
                throw new Error("hook.create: missing parameters");
            }

            var path = "/hooks";
            options.method = "POST";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *hookId
 * - body.Url
 * - body.Status
 * - body.Tag
 */
function hook_edit(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.hookId) {
                throw new Error("hook.edit: missing parameters");
            }

            var path = "/hooks/" + options.hookId;
            options.method = "PUT";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}



//////////
// User //
//////////

function User(httpClient) {
    this.httpClient = httpClient;
}

User.prototype.fetch        = user_fetch;
User.prototype.wallets      = user_wallets;
User.prototype.list         = user_list;
User.prototype.cards        = user_cards;
User.prototype.transactions = user_transactions;

User.prototype.fetchNatural  = user_fetchNatural;
User.prototype.createNatural = user_createNatural;
User.prototype.editNatural   = user_editNatural;

User.prototype.fetchLegal  = user_fetchLegal;
User.prototype.createLegal = user_createLegal;
User.prototype.editLegal   = user_editLegal;

/**
 * @param options
 * - *userId
 */
function user_fetch(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.userId) {
                throw new Error("user.fetch: missing parameters");
            }

            var path = "/users/" + options.userId;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *userId
 * - page
 * - perPage
 */
function user_wallets(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.userId) {
                throw new Error("user.wallets: missing parameters");
            }

            var path = "/users/" + options.userId + "/wallets";
            path = this.httpClient.setPaginationParams(path, options);

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - page
 * - perPage
 */
function user_list(options) {
    var path = "/users";
    path = this.httpClient.setPaginationParams(path, options);

    return this.httpClient.request(path, options);
}

/**
 * @param options
 * - *userId
 * - page
 * - perPage
 */
function user_cards(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.userId) {
                throw new Error("user.cards: missing parameters");
            }

            var path = "/users/" + options.userId + "/cards";
            path = this.httpClient.setPaginationParams(path, options);

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *userId
 * - page
 * - perPage
 * - status
 */
function user_transactions(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.userId) {
                throw new Error("user.transactions: missing parameters");
            }

            var path = "/users/" + options.userId + "/transactions";
            path = this.httpClient.setPaginationParams(path, options);

            if (options.status) {
                path = setUrlParam(path, "status", options.status);
            }

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *userId
 */
function user_fetchNatural(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.userId) {
                throw new Error("user.fetchNatural: missing parameters");
            }

            var path = "/users/natural/" + options.userId;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *body.Email
 * - *body.FirstName
 * - *body.LastName
 * - *body.Birthday
 * - *body.Nationality
 * - *body.CountryOfResidence
 * - body.Tag
 * - body.Address
 * - body.Occupation
 * - body.IncomeRange
 * - body.ProofOfIdentity
 * - body.ProofOfAddress
 */
function user_createNatural(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.body.Email
                || ! options.body.FirstName
                || ! options.body.LastName
                || ! options.body.Birthday
                || ! options.body.Nationality
                || ! options.body.CountryOfResidence
            ) {
                throw new Error("user.createNatural: missing parameters");
            }

            var path = "/users/natural/";
            options.method = "POST";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *userId
 * - body.Email
 * - body.FirstName
 * - body.LastName
 * - body.Birthday
 * - body.Nationality
 * - body.CountryOfResidence
 * - body.Tag
 * - body.Address
 * - body.Occupation
 * - body.IncomeRange
 * - body.ProofOfIdentity
 * - body.ProofOfAddress
 */
function user_editNatural(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.userId) {
                throw new Error("user.createNatural: missing parameters");
            }

            var path = "/users/natural/" + options.userId;
            options.method = "PUT";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *userId
 */
function user_fetchLegal(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.userId) {
                throw new Error("user.fetchLegal: missing parameters");
            }

            var path = "/users/legal/" + options.userId;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *body.Email
 * - *body.Name
 * - *body.LegalPersonType
 * - *body.LegalRepresentativeFirstName
 * - *body.LegalRepresentativeLastName
 * - *body.LegalRepresentativeBirthday
 * - *body.LegalRepresentativeNationality
 * - *body.LegalRepresentativeCountryOfResidence
 * - body.Tag
 * - body.HeadquartersAddress
 * - body.LegalRepresentativeAdress
 * - body.LegalRepresentativeEmail
 */
function user_createLegal(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.body.Email
                || ! options.body.Name
                || ! options.body.LegalPersonType
                || ! options.body.LegalRepresentativeFirstName
                || ! options.body.LegalRepresentativeLastName
                || ! options.body.LegalRepresentativeBirthday
                || ! options.body.LegalRepresentativeNationality
                || ! options.body.LegalRepresentativeCountryOfResidence
            ) {
                throw new Error("user.createLegal: missing parameters");
            }

            var path = "/users/legal/";
            options.method = "POST";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *userId
 * - body.Email
 * - body.Name
 * - body.LegalPersonType
 * - body.LegalRepresentativeFirstName
 * - body.LegalRepresentativeLastName
 * - body.LegalRepresentativeBirthday
 * - body.LegalRepresentativeNationality
 * - body.LegalRepresentativeCountryOfResidence
 * - body.Tag
 * - body.HeadquartersAddress
 * - body.LegalRepresentativeAdress
 * - body.LegalRepresentativeEmail
 */
function user_editLegal(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.userId) {
                throw new Error("user.editLegal: missing parameters");
            }

            var path = "/users/legal/" + options.userId;
            options.method = "PUT";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}




////////////
// Wallet //
////////////

function Wallet(httpClient) {
    this.httpClient = httpClient;
}

Wallet.prototype.fetch        = wallet_fetch;
Wallet.prototype.create       = wallet_create;
Wallet.prototype.edit         = wallet_edit;
Wallet.prototype.transactions = wallet_transactions;

Wallet.prototype.fetchTransfer  = wallet_fetchTransfer;
Wallet.prototype.createTransfer = wallet_createTransfer;

/**
 * @param options
 * - *walletId
 */
function wallet_fetch(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.walletId) {
                throw new Error("wallet.fetch: missing parameters");
            }

            var path = "/wallets/" + options.walletId;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *body.Owners
 * - *body.Description
 * - *body.Currency
 * - body.Tag
 */
function wallet_create(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.body.Owners
                || ! options.body.Description
                || ! options.body.Currency
            ) {
                throw new Error("wallet.create: missing parameters");
            }

            var path = "/wallets";
            options.method = "POST";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *walletId
 * - body.Tag
 * - body.Description
 */
function wallet_edit(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.walletId) {
                throw new Error("wallet.edit: missing parameters");
            }

            var path = "/wallets/" + options.walletId;
            options.method = "PUT";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *walletId
 */
function wallet_transactions(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.walletId) {
                throw new Error("wallet.transactions: missing parameters");
            }

            var path = "/wallets/" + options.walletId + "/transactions";

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *transferId
 */
function wallet_fetchTransfer(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.transferId) {
                throw new Error("wallet.fetchTransfer: missing parameters");
            }

            var path = "/transfers/" + options.transferId;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *body.AuthorId
 * - *body.DebitedFunds
 * - *body.Fees
 * - *body.DebitedWalletId
 * - *body.CreditedWalletId
 * - body.Tag
 */
function wallet_createTransfer(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.body.AuthorId
                || ! options.body.DebitedFunds
                || ! options.body.Fees
                || ! options.body.DebitedWalletId
                || ! options.body.CreditedWalletId
            ) {
                throw new Error("wallet.createTransfer: missing parameters");
            }

            var path = "/transfers";
            options.method = "POST";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}



///////////
// Payin //
///////////

function Payin(httpClient) {
    this.httpClient = httpClient;
}

Payin.prototype.fetch               = payin_fetch;
Payin.prototype.cardWeb             = payin_cardWeb;
Payin.prototype.cardDirect          = payin_cardDirect;
Payin.prototype.preauthorizedDirect = payin_preauthorizedDirect;
Payin.prototype.bankwireDirect      = payin_bankwireDirect;
Payin.prototype.directDebitWeb      = payin_directDebitWeb;

/**
 * @param options
 * - *payinId
 */
function payin_fetch(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.payinId) {
                throw new Error("payin.fetch: missing parameters");
            }

            var path = "/payins/" + options.payinId;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *body.AuthorId
 * - *body.DebitedFunds
 * - *body.Fees
 * - *body.CreditedWalletId
 * - *body.ReturnURL
 * - *body.Culture
 * - *body.CardType
 * - body.Tag
 * - body.TemplateURLOptions
 * - body.SecureMode
 * - body.CreditedUserId
 */
function payin_cardWeb(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.body.AuthorId
                || ! options.body.DebitedFunds
                || ! options.body.Fees
                || ! options.body.CreditedWalletId
                || ! options.body.ReturnURL
                || ! options.body.Culture
                || ! options.body.CardType
            ) {
                throw new Error("payin.cardWeb: missing parameters");
            }

            var path = "/payins/card/web";
            options.method = "POST";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *body.AuthorId
 * - *body.CreditedUserId
 * - *body.DebitedFunds
 * - *body.Fees
 * - *body.CreditedWalletId
 * - *body.SecureModeReturnURL
 * - *body.CardId
 * - body.Tag
 * - body.SecureMode
 */
function payin_cardDirect(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.body.AuthorId
                || ! options.body.CreditedUserId
                || ! options.body.DebitedFunds
                || ! options.body.Fees
                || ! options.body.CreditedWalletId
                || ! options.body.SecureModeReturnURL
                || ! options.body.CardId
            ) {
                throw new Error("payin.cardDirect: missing parameters");
            }

            var path = "/payins/card/direct";
            options.method = "POST";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *body.AuthorId
 * - *body.DebitedFunds
 * - *body.Fees
 * - *body.CreditedWalletId
 * - *body.PreauthorizationId
 * - body.Tag
 * - body.CreditedUserId
 */
function payin_preauthorizedDirect(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.body.AuthorId
                || ! options.body.DebitedFunds
                || ! options.body.Fees
                || ! options.body.CreditedWalletId
                || ! options.body.PreauthorizationId
            ) {
                throw new Error("payin.preauthorizedDirect: missing parameters");
            }

            var path = "/payins/PreAuthorized/direct";
            options.method = "POST";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *body.AuthorId
 * - *body.CreditedWalletId
 * - *body.DeclaredDebitedFunds
 * - *body.DeclaredFees
 * - body.Tag
 * - body.CreditedUserId
 */
function payin_bankwireDirect(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.body.AuthorId
                || ! options.body.CreditedWalletId
                || ! options.body.DeclaredDebitedFunds
                || ! options.body.DeclaredFees
            ) {
                throw new Error("payin.bankwireDirect: missing parameters");
            }

            var path = "/payins/bankwire/direct";
            options.method = "POST";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *body.AuthorId
 * - *body.DebitedFunds
 * - *body.Fees
 * - *body.CreditedWalletId
 * - *body.ReturnURL
 * - *body.Culture
 * - *body.DirectDebitType
 * - body.Tag
 * - body.TemplateURLOptions
 * - body.CreditedUserId
 */
function payin_directDebitWeb(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.body.AuthorId
                || ! options.body.DebitedFunds
                || ! options.body.Fees
                || ! options.body.CreditedWalletId
                || ! options.body.ReturnURL
                || ! options.body.Culture
                || ! options.body.DirectDebitType
            ) {
                throw new Error("payin.directDebitWeb: missing parameters");
            }

            var path = "/payins/directdebit/web";
            options.method = "POST";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}



//////////
// Card //
//////////

function Card(httpClient) {
    this.httpClient = httpClient;
}

Card.prototype.fetch              = card_fetch;
Card.prototype.edit               = card_edit;
Card.prototype.createRegistration = card_createRegistration;
Card.prototype.editRegistration   = card_editRegistration;

/**
 * @param options
 * - *cardId
 */
function card_fetch(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.cardId) {
                throw new Error("card.fetch: missing parameters");
            }

            var path = "/cards/" + options.cardId;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *cardId
 * - body.Active (only update true to false)
 */
function card_edit(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.cardId) {
                throw new Error("card.edit: missing parameters");
            }

            var path = "/cards/" + options.cardId;
            options.method = "PUT";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *body.UserId
 * - *body.Currency
 * - body.Tag
 * - body.CardType
 * - body.CardRegistrationURL
 * - body.RegistrationData
 */
function card_createRegistration(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.body.UserId
                || ! options.body.Currency
            ) {
                throw new Error("card.createRegistration: missing parameters");
            }

            var path = "/cardregistrations";
            options.method = "POST";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - cardRegistrationId
 * - body.RegistrationData
 */
function card_editRegistration(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.cardRegistrationId) {
                throw new Error("card.editRegistration: missing parameters");
            }

            var path = "/cardregistrations/" + options.cardRegistrationId;
            options.method = "PUT";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}



//////////////////////
// Preauthorization //
//////////////////////

function Preauthorization(httpClient) {
    this.httpClient = httpClient;
}

Preauthorization.prototype.fetch  = preauthorization_fetch;
Preauthorization.prototype.create = preauthorization_create;
Preauthorization.prototype.edit   = preauthorization_edit;

/**
 * @param options
 * - *preauthorizationId
 */
function preauthorization_fetch(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.preauthorizationId) {
                throw new Error("preauthorization.fetch: missing parameters");
            }

            var path = "/preauthorizations/" + options.preauthorizationId;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *body.AuthorId
 * - *body.DebitedFunds
 * - *body.SecureMode
 * - *body.CardId
 * - *body.SecureModeReturnURL
 * - body.Tag
 */
function preauthorization_create(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.body.AuthorId
                || ! options.body.DebitedFunds
                || ! options.body.SecureMode
                || ! options.body.CardId
                || ! options.body.SecureModeReturnURL
            ) {
                throw new Error("preauthorization.create: missing parameters");
            }

            var path = "/preauthorizations/card/direct";
            options.method = "POST";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *preauthorizationId
 * - body.PaymentStatus (only update from "WAITING" to "CANCELED")
 * - body.Tag
 */
function preauthorization_edit(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.preauthorizationId) {
                throw new Error("preauthorization.edit: missing parameters");
            }

            var path = "/preauthorizations/" + options.preauthorizationId;
            options.method = "PUT";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}



////////////
// Refund //
////////////

function Refund(httpClient) {
    this.httpClient = httpClient;
}

Refund.prototype.fetch    = refund_fetch;
Refund.prototype.transfer = refund_transfer;
Refund.prototype.payin    = refund_payin;

/**
 * @param options
 * - *refundId
 */
function refund_fetch(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.refundId) {
                throw new Error("refund.fetch: missing parameters");
            }

            var path = "/refunds/" + options.refundId;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *transferId
 * - *body.AuthorId
 */
function refund_transfer(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.transferId
             || ! options.body.AuthorId
            ) {
                throw new Error("refund.transfer: missing parameters");
            }

            var path = "/transfers/" + options.transferId + "/refunds";
            options.method = "POST";

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *payinId
 * - *body.AuthorId
 * - body.DebitedFunds
 * - body.Fees
 */
function refund_payin(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.payinId
             || ! options.body.AuthorId
            ) {
                throw new Error("refund.payin: missing parameters");
            }

            var path = "/payins/" + options.payinId + "/refunds";
            options.method = "POST";

            return this.httpClient.request(path, options);
        });
}



/////////////////
// BankAccount //
/////////////////

function BankAccount(httpClient) {
    this.httpClient = httpClient;
}

BankAccount.prototype.list   = bankAccount_list;
BankAccount.prototype.fetch  = bankAccount_fetch;
BankAccount.prototype.create = bankAccount_create;

/**
 * @param options
 * - *userId
 */
function bankAccount_list(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.userId) {
                throw new Error("bankAccount.list: missing parameters");
            }

            var path = "/users/" + options.userId + "/bankaccounts";

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *userId
 * - *bankAccountId
 */
function bankAccount_fetch(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.userId
                || ! options.bankAccountId
            ) {
                throw new Error("bankAccount.fetch: missing parameters");
            }

            var path = "/users/" + options.userId + "/bankaccounts/" + options.bankAccountId;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *userId
 * - *type
 * - *body.OwnerName
 * - *body.OwnerAddress
 * - *body.IBAN  // if type === "IBAN"
 * - body.Tag
 */
function bankAccount_create(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.userId
                || ! options.type
                || ! options.body.OwnerName
                || ! options.body.OwnerAddress
                || ! options.body.IBAN
            ) {
                throw new Error("bankAccount.create: missing parameters");
            }

            var path = "/users/" + options.userId + "/bankaccounts/" + options.type;
            options.method = "POST";

            return this.httpClient.request(path, options);
        });
}



////////////
// Payout //
////////////

function Payout(httpClient) {
    this.httpClient = httpClient;
}

Payout.prototype.fetch  = payout_fetch;
Payout.prototype.create = payout_create;

/**
 * @param options
 * - *payoutId
 */
function payout_fetch(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.payoutId) {
                throw new Error("payout.fetch: missing parameters");
            }

            var path = "/payouts/" + options.payoutId;

            return this.httpClient.request(path, options);
        });
}

/**
 * @param options
 * - *body.AuthorId
 * - *body.DebitedWalletId
 * - *body.DebitedFunds
 * - *body.Fees
 * - *body.BankAccountId
 * - body.Tag
 * - body.BankWireRef
 */
function payout_create(options) {
    return Promise
        .resolve()
        .then(() => {
            if (! options.body.AuthorId
                || ! options.body.DebitedWalletId
                || ! options.body.DebitedFunds
                || ! options.body.Fees
                || ! options.body.BankAccountId
            ) {
                throw new Error("payout.create: missing parameters");
            }

            var path = "/payouts/bankwire";
            options.method = "POST";
            options.json = options.body;

            return this.httpClient.request(path, options);
        });
}
