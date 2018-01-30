/**
 * Policy Mappings
 * (sails.config.policies)
 *
 * Policies are simple functions which run **before** your actions.
 *
 * For more information on configuring policies, check out:
 * https://sailsjs.com/docs/concepts/policies
 */


module.exports.policies = {

    /***************************************************************************
    *                                                                          *
    * Default policy for all controllers and actions, unless overridden.       *
    * (`true` allows public access)                                            *
    *                                                                          *
    ***************************************************************************/

    '*': ["isAuthenticated"],

    AppController: {
        index: true,
        oldBrowsers: true,
        install: true,
    },

    AuthController: {
        "*": ["isCookieAuthenticated", "passport"],
        loginAs: ["isAuthenticated"],
        logout: ["isAuthenticated"],
        refreshToken: true,
        basicAuth: true
    },

    BookingController: {
        create: ["isAuthenticated", "getUserInfo"],
        accept: ["isAuthenticated", "getUserInfo"],
        payment: ["isAuthenticated", "getUserInfo"],
        paymentSecure: true,
        getContract: true
    },

    BookmarkController: {
        create: ["isAuthenticated", "getUserInfo"],
        destroy: true,
        destroyLink: true,
        my: ["gracefulDismissNoToken", "isAuthenticated"]
    },

    BrandController: {
        find: ["isAuthenticatedOptional"],
        findOne: ["isAuthenticatedOptional"]
    },

    CardController: {
        create: ["isAuthenticated", "getUserInfo"],
        createCardRegistration: ["isAuthenticated", "getUserInfo"],
        my: ['isAuthenticated', 'getUserInfo'],
    },

    ClientLogController: {
        "*": true
    },

    ContentEntriesController: {
        findLanguage: true,
    },

    EmailTrackingController: {
        mandrill: true,
        sparkpost: true,
    },

    FinanceController: {
        "*": ["isAuthenticated", "getUserInfo"]
    },

    GamificationController: {
        params: true,
        getStats: ["isAuthenticated", "getUserInfo"],
        updateProgressView: ["isAuthenticated", "getUserInfo"]
    },

    LinkController: {
        createReferredBy: ["isAuthenticated", "getUserInfo"],
        sendFriendEmails: ["isAuthenticated", "getUserInfo"]
    },

    ListingController: {
        find: ["isAuthenticatedOptional"],
        findOne: ["isAuthenticatedOptional"],
        getLocations: true,
        getPricing: true,
        search: ["isAuthenticatedOptional", "getUserInfo"],
        getRecommendedPrices: ["isAuthenticatedOptional"],
        getRentingPriceFromSellingPrice: true,
        pauseListingToggle: ["isAuthenticated"]
    },

    ListingCategoryController: {
        find: ["isAuthenticatedOptional"],
        findOne: ["isAuthenticatedOptional"],
    },

    ListingTypeController: {
        find: true,
    },

    LocationController: {
        create: ["isAuthenticated", "getUserInfo"],
        update: ["isAuthenticated", "getUserInfo"],
        updateMain: ["isAuthenticated", "getUserInfo"],
        my: ["gracefulDismissNoToken", "isAuthenticated"],
        getJourneysDuration: true,
        getGeoInfo: true
    },

    MediaController: {
        get: ["isAuthenticatedOptional"],
        getRedirect: ["isAuthenticatedOptional"],
        my: ["gracefulDismissNoToken", "isAuthenticated", "getUserInfo"]
    },

    MessageController: {
        getConversations: ["isAuthenticatedOptional"],
        getPublicMessages: true
    },

    PublicMediaController: {
        "*": true
    },

    RatingController: {
        find: ["isAuthenticatedOptional"],
        create: ["isAuthenticated", "getUserInfo"],
        update: ["isAuthenticated", "getUserInfo"]
    },

    SmsController: {
        sendVerify: ["isAuthenticated", "getUserInfo"]
    },

    StelaceConfigController: {
        findOne: true,
        install: true,
        installStatus: true,
    },

    StelaceEventController: {
        createEvent: ["isAuthenticatedOptional"],
        updateEvent: ["isAuthenticatedOptional"]
    },

    TagController: {
        find: true
    },

    TransactionLogController: {
        mangopayWebhook: true
    },

    UserController: {
        params: true,
        findOne: ["isAuthenticatedOptional"],
        update: ["isAuthenticated", "getUserInfo"],
        me: ["gracefulDismissNoToken", "isAuthenticated", "getUserInfo"],
        getPaymentAccounts: ['isAuthenticated', 'getUserInfo'],
        lostPassword: true,
        recoveryPassword: true,
        emailCheck: true,
        emailNew: ["isAuthenticated", "getUserInfo"],
        updateMedia: ["isAuthenticated", "getUserInfo"],
        unsubscribeLink: true,
        applyFreeFees: ["isAuthenticated", "getUserInfo"],
        getIncomeReport: ["isAuthenticated", "getUserInfo"],
        getIncomeReportPdf: true,
    },



    // API ROUTES

    'v0_1/ApiKeyController': {
        '*': ['isProvider'],
    },

    'v0_1/BookingController': {
        '*': ['isApiAuthenticated'],
    },

    'v0_1/ContentEntriesController': {
        '*': ['isApiAuthenticated'],
        'findEditable': true,
        'findDefault': true,
    },

    'v0_1/ListingController': {
        '*': ['isApiAuthenticated'],
    },

    'v0_1/ListingCategoryController': {
        '*': ['isApiAuthenticated'],
    },

    'v0_1/ListingTypeController': {
        '*': ['isApiAuthenticated'],
    },

    'v0_1/MediaController': {
        '*': ['isApiAuthenticated'],
        'get': true,
        'getRedirect': true,
    },

    'v0_1/StatsController': {
        '*': ['isApiAuthenticated'],
    },

    'v0_1/StelaceConfigController': {
        '*': ['isApiAuthenticated'],
    },

    'v0_1/UserController': {
        '*': ['isApiAuthenticated'],
    },

    'v0_1/WebhookController': {
        '*': ['isApiAuthenticated'],
    },

};
