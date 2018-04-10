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
        search: ["isAuthenticatedOptional", "getUserInfo"],
        getRecommendedPrices: ["isAuthenticatedOptional"],
        getTimeUnitPriceFromSellingPrice: true,
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
        getJourneysInfo: true,
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

    'publicApi/latest/ApiKeyController': {
        '*': ['isApiAuthenticated'],
    },

    'publicApi/latest/ApiEventController': {
        '*': ['isApiAuthenticated'],
    },

    'publicApi/latest/BookingController': {
        '*': ['isApiAuthenticated'],
    },

    'publicApi/latest/ContentEntriesController': {
        '*': ['isApiAuthenticated'],
        'findEditable': true,
        'findDefault': true,
    },

    'publicApi/latest/EmailTemplateController': {
        '*': ['isApiAuthenticated'],
        'preview': true,
    },

    'publicApi/latest/InfoController': {
        '*': ['isApiAuthenticated'],
    },

    'publicApi/latest/ListingController': {
        '*': ['isApiAuthenticated'],
    },

    'publicApi/latest/ListingCategoryController': {
        '*': ['isApiAuthenticated'],
    },

    'publicApi/latest/ListingTypeController': {
        '*': ['isApiAuthenticated'],
    },

    'publicApi/latest/MediaController': {
        '*': ['isApiAuthenticated'],
        'get': true,
        'getRedirect': true,
    },

    'publicApi/latest/StatsController': {
        '*': ['isApiAuthenticated'],
    },

    'publicApi/latest/StelaceConfigController': {
        '*': ['isApiAuthenticated'],
        'updatePlan': ['isProvider'],
    },

    'publicApi/latest/UserController': {
        '*': ['isApiAuthenticated'],
    },

    'publicApi/latest/WebhookController': {
        '*': ['isApiAuthenticated'],
    },

};
