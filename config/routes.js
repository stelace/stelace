/**
 * Route Mappings
 * (sails.config.routes)
 *
 * Your routes map URLs to views and controllers.
 *
 * If Sails receives a URL that doesn't match any of the routes below,
 * it will check for matching files (images, scripts, stylesheets, etc.)
 * in your assets directory.  e.g. `http://localhost:1337/images/foo.jpg`
 * might match an image file: `/assets/images/foo.jpg`
 *
 * Finally, if those don't match either, the default 404 handler is triggered.
 * See `config/404.js` to adjust your app's 404 logic.
 *
 * Note: Sails doesn't ACTUALLY serve stuff from `assets`-- the default Gruntfile in Sails copies
 * flat files from `assets` to `.tmp/public`.  This allows you to do things like compile LESS or
 * CoffeeScript for the front-end.
 *
 * For more information on configuring custom routes, check out:
 * http://sailsjs.org/#/documentation/concepts/Routes/RouteTargetSyntax.html
 */

module.exports.routes = {

    /////////////////
    // View routes //
    /////////////////

    // RegistrationController
    '/old-browsers': "AppController.oldBrowsers",
    '/unsubscribe': "UserController.unsubscribeLink",



    ///////////////////
    // Custom routes //
    ///////////////////

    // Webhooks
    '/webhook/mandrill': "EmailTrackingController.mandrill", // "POST" and "HEAD" authorized
    '/webhook/sparkpost': "EmailTrackingController.sparkpost", // multiple verbs authorized
    'get /webhook/mangopay': "TransactionLogController.webhook",

    // PublicMediaController
    'get /terms/mangopay': "PublicMediaController.mangopay",



    ///////////////////////
    // API custom routes //
    ///////////////////////

    // AssessmentController
    'put /api/assessment/:id/sign': "AssessmentController.sign",
    'get /api/assessment/last': "AssessmentController.last",

    // AuthController
    'post /api/logout': "AuthController.logout",

    'post /api/auth/local': "AuthController.callback",
    'post /api/auth/local/:action': "AuthController.callback",

    'post /api/auth/refresh-token': "AuthController.refreshToken",
    'post /api/auth/loginAs': "AuthController.loginAs",

    'get /auth/:provider': "AuthController.provider",
    'get /auth/:provider/callback': "AuthController.callback",

    'post /api/auth/basic': "AuthController.basicAuth",

    // BackofficeController
    'get /api/backoffice/incompleteBookings': "BackofficeController.getIncompleteBookings",
    'post /api/backoffice/setAction': "BackofficeController.setAction",
    'get /api/backoffice/booking/:id': "BackofficeController.getBooking",
    'post /api/backoffice/booking/:id/cancel': "BackofficeController.cancelBooking",

    // BookingController
    'get /api/booking/my': "BookingController.my",
    'get /api/booking/params': "BookingController.params",
    'post /api/booking/:id/cancel': "BookingController.cancel",
    'post /api/booking/:id/validate': "BookingController.validate",
    'post /api/booking/:id/payment': "BookingController.payment",
    'get /api/booking/:id/payment-secure': "BookingController.paymentSecure",
    'post /api/booking/:id/contract-token': "BookingController.createContractToken",
    'get /api/booking/:id/contract': "BookingController.getContract",

    // BookmarkController
    'get /api/bookmark/my': "BookmarkController.my",
    'get /api/bookmark/:id/destroy': "BookmarkController.destroyLink",

    // CardController
    'get /api/card/my': "CardController.my",
    'post /api/card/registration': "CardController.createCardRegistration",

    // ClientLogController
    'post /api/clientLog/error': "ClientLogController.error",

    // FinanceController
    'post /api/finance/account': "FinanceController.createAccount",
    'post /api/finance/bankAccount': "FinanceController.createBankAccount",

    // GamificationController
    'get /api/gamification/params': "GamificationController.params",
    'get /api/gamification/stats': "GamificationController.getStats",
    'put /api/gamification/progressView': "GamificationController.updateProgressView",

    // ItemController
    'get /api/item/query': "ItemController.query",
    'get /api/item/my': "ItemController.my",
    'put /api/item/:id/medias': "ItemController.updateMedias",
    'post /api/item/search': 'ItemController.search',
    'get /api/item/:id/locations': "ItemController.getLocations",
    'get /api/item/pricing': "ItemController.getPricing",
    'get /api/item/price-recommendation': "ItemController.getRecommendedPrices",
    'post /api/item/renting-price': "ItemController.getRentingPriceFromSellingPrice",
    'put /api/item/:id/pause': "ItemController.pauseItemToggle",

    // LinkController
    'post /api/link/referredBy': "LinkController.createReferredBy",
    'get /api/link/friends': "LinkController.getFriends",
    'get /api/link/referer': "LinkController.getReferer",
    'post /api/link/sendFriendEmails': "LinkController.sendFriendEmails",

    // LocationController
    'get /api/location/my': "LocationController.my",
    'put /api/location/main': "LocationController.updateMain",
    'get /api/location/journeysDuration': "LocationController.getJourneysDuration",
    'get /api/location/getGeoInfo': "LocationController.getGeoInfo",

    // MediaController
    'get /api/media/get/:id/:uuid.:ext': "MediaController.get",
    'get /api/media/get/:id/:uuid': "MediaController.getOld",
    'get /api/media/download': "MediaController.download",
    'post /api/media/upload': "MediaController.upload",
    'get /api/media/my': "MediaController.my",

    // MessageController   // mix conversations and messages
    'get /api/message/conversation': "MessageController.conversation",
    'get /api/message/conversation-meta': "MessageController.conversationMeta",
    'get /api/message/get-conversations': "MessageController.getConversations",
    'get /api/message/item': "MessageController.getPublicMessages",
    'put /api/message/:id/mark-read': "MessageController.markAsRead",
    'put /api/message/:id/update-meta': "MessageController.updateMeta",

    // SmsController
    'post /api/phone/sendCode': "SmsController.sendVerify",
    'post /api/phone/checkCode': "SmsController.checkVerify",

    // StelaceEventController
    'post /api/stelace/event': "StelaceEventController.createEvent",
    'put /api/stelace/event/:id': "StelaceEventController.updateEvent",

    // UserController
    'get /api/user/params': "UserController.params",
    "get /api/user/me": "UserController.me",
    "get /api/user/getAuthMeans": "UserController.getAuthMeans",
    'put /api/user/:id/password': "UserController.updatePassword",
    'put /api/user/:id/email': "UserController.updateEmail",
    'put /api/user/:id/address': "UserController.updateAddress",
    'put /api/user/:id/phone': "UserController.updatePhone",
    'post /api/user/lost-password': "UserController.lostPassword",
    'put /api/user/recovery-password': "UserController.recoveryPassword",
    'put /api/user/emailCheck': "UserController.emailCheck",
    'post /api/user/emailNew': "UserController.emailNew",
    'put /api/user/:id/media': "UserController.updateMedia",
    'post /api/user/freeFees': "UserController.applyFreeFees",
    'get /api/user/income-report': "UserController.getIncomeReport",
    'get /api/user/:id/income-report/:year': "UserController.getIncomeReportPdf",



    ////////////////
    // App routes //
    ////////////////

    // https://stackoverflow.com/questions/19843946/sails-js-regex-routes
    '/*': {
        controller: "AppController",
        action: "index",
        skipAssets: true,
        skipRegex: /^\/api\/.*$/
    }

};
