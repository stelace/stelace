/**
 * Policy Mappings
 * (sails.config.policies)
 *
 * Policies are simple functions which run **before** your controllers.
 * You can apply one or more policies to a given controller, or protect
 * its actions individually.
 *
 * Any policy file (e.g. `api/policies/authenticated.js`) can be accessed
 * below by its filename, minus the extension, (e.g. "authenticated")
 *
 * For more information on how policies work, see:
 * http://sailsjs.org/#/documentation/concepts/Policies
 *
 * For more information on configuring policies, check out:
 * http://sailsjs.org/#/documentation/reference/sails.config/sails.config.policies.html
 */


module.exports.policies = {

    /***************************************************************************
    *                                                                          *
    * Default policy for all controllers and actions (`true` allows public     *
    * access)                                                                  *
    *                                                                          *
    ***************************************************************************/

    '*': ["isAuthenticated"],

    AppController: {
        index: true,
        oldBrowsers: true
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
        confirm: ["isAuthenticated", "getUserInfo"],
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
        createCardRegistration: ["isAuthenticated", "getUserInfo"]
    },

    ClientLogController: {
        "*": true
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
        search: ["isAuthenticatedOptional"]
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
        getOld: ["isAuthenticatedOptional"],
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

    StelaceEventController: {
        createEvent: ["isAuthenticatedOptional"],
        updateEvent: ["isAuthenticatedOptional"]
    },

    TagController: {
        find: true
    },

    TransactionLogController: {
        webhook: true
    },

    UserController: {
        params: true,
        findOne: ["isAuthenticatedOptional"],
        me: ["gracefulDismissNoToken", "isAuthenticated", "getUserInfo"],
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
        find: ['isApiAuthenticated'],
        findOne: ['isApiAuthenticated'],
    },

    'v0_1/ListingController': {
        find: ['isApiAuthenticated'],
        findOne: ['isApiAuthenticated'],
    },

    'v0_1/ListingTypeController': {
        find: ['isApiAuthenticated'],
        findOne: ['isApiAuthenticated'],
    },

    'v0_1/UserController': {
        find: ['isApiAuthenticated'],
        findOne: ['isApiAuthenticated'],
    },


    /***************************************************************************
    *                                                                          *
    * Here's an example of mapping some policies to run before a controller    *
    * and its actions                                                          *
    *                                                                          *
    ***************************************************************************/
    // RabbitController: {

        // Apply the `false` policy as the default for all of RabbitController's actions
        // (`false` prevents all access, which ensures that nothing bad happens to our rabbits)
        // '*': false,

        // For the action `nurture`, apply the 'isRabbitMother' policy
        // (this overrides `false` above)
        // nurture	: 'isRabbitMother',

        // Apply the `isNiceToAnimals` AND `hasRabbitFood` policies
        // before letting any users feed our rabbits
        // feed : ['isNiceToAnimals', 'hasRabbitFood']
    // }
};
