/**
 * Route Mappings
 * (sails.config.routes)
 *
 * Your routes tell Sails what to do each time it receives a request.
 *
 * For more information on configuring custom routes, check out:
 * https://sailsjs.com/anatomy/config/routes-js
 */

const apiCors = { allowOrigins: '*' };

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
    'get /webhook/mangopay': "TransactionLogController.mangopayWebhook",

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
    'post /api/booking/:id/cancel': "BookingController.cancel",
    'post /api/booking/:id/accept': "BookingController.accept",
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
    'get /api/finance/bankAccount': "FinanceController.getBankAccounts",
    'post /api/finance/bankAccount': "FinanceController.createBankAccount",

    // GamificationController
    'get /api/gamification/params': "GamificationController.params",
    'get /api/gamification/stats': "GamificationController.getStats",
    'put /api/gamification/progressView': "GamificationController.updateProgressView",

    // KycController
    'get /api/kyc/my': 'KycController.my',

    // ListingController
    'get /api/listing/query': "ListingController.query",
    'get /api/listing/my': "ListingController.my",
    'put /api/listing/:id/medias': "ListingController.updateMedias",
    'post /api/listing/search': 'ListingController.search',
    'get /api/listing/:id/locations': "ListingController.getLocations",
    'get /api/listing/pricing': "ListingController.getPricing",
    'get /api/listing/price-recommendation': "ListingController.getRecommendedPrices",
    'post /api/listing/renting-price': "ListingController.getRentingPriceFromSellingPrice",
    'put /api/listing/:id/pause': "ListingController.pauseListingToggle",
    'get /api/listing/:id/listingAvailabilities': "ListingController.getListingAvailability",
    'post /api/listing/:id/listingAvailabilities': "ListingController.createListingAvailability",
    'delete /api/listing/:id/listingAvailabilities': "ListingController.removeListingAvailability",

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
    'get r|/api/media/get/(\\d+)/([\\w-]+).(\\w+)|id,uuid,ext': "MediaController.get",
    'get /api/media/get/:id/:uuid': "MediaController.getRedirect",
    'get /api/media/download': "MediaController.download",
    'post /api/media/upload': "MediaController.upload",
    'get /api/media/my': "MediaController.my",

    // MessageController   // mix conversations and messages
    'get /api/message/conversation': "MessageController.conversation",
    'get /api/message/conversation-meta': "MessageController.conversationMeta",
    'get /api/message/get-conversations': "MessageController.getConversations",
    'get /api/message/listing': "MessageController.getPublicMessages",
    'put /api/message/:id/mark-read': "MessageController.markAsRead",
    'patch /api/message/:id/update-meta': "MessageController.updateMeta",

    // SmsController
    'post /api/phone/sendCode': "SmsController.sendVerify",
    'post /api/phone/checkCode': "SmsController.checkVerify",

    // StelaceConfigController
    'patch /api/stelace/config': "StelaceConfigController.update",

    // StelaceEventController
    'post /api/stelace/event': "StelaceEventController.createEvent",
    'patch /api/stelace/event/:id': "StelaceEventController.updateEvent",

    // UserController
    'get /api/user/params': "UserController.params",
    "get /api/user/me": "UserController.me",
    "get /api/user/getAuthMeans": "UserController.getAuthMeans",
    "get /api/user/payment-accounts": "UserController.getPaymentAccounts",
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



    // API ROUTES

    'post /api/v0.1/api-key': { target: 'v0_1/ApiKeyController.create', cors: apiCors },
    'delete /api/v0.1/api-key': { target: 'v0_1/ApiKeyController.destroy', cors: apiCors },

    'get /api/v0.1/bookings': { target: 'v0_1/BookingController.find', cors: apiCors },
    'get /api/v0.1/bookings/:id': { target: 'v0_1/BookingController.findOne', cors: apiCors },
    'post /api/v0.1/bookings/:id/cancel': { target: 'v0_1/BookingController.cancel', cors: apiCors },

    'get /api/v0.1/contents/entries/editable': { target: 'v0_1/ContentEntriesController.findEditable', cors: apiCors },

    'get /api/v0.1/listings': { target: 'v0_1/ListingController.find', cors: apiCors },
    'get /api/v0.1/listings/pricing': { target: 'v0_1/ListingController.getPricing', cors: apiCors },
    'get /api/v0.1/listings/:id': { target: 'v0_1/ListingController.findOne', cors: apiCors },
    'post /api/v0.1/listings': { target: 'v0_1/ListingController.create', cors: apiCors },
    'patch /api/v0.1/listings/:id': { target: 'v0_1/ListingController.update', cors: apiCors },
    'put /api/v0.1/listings/:id/validate': { target: 'v0_1/ListingController.validate', cors: apiCors },
    'put /api/v0.1/listings/:id/medias': { target: 'v0_1/ListingController.updateMedias', cors: apiCors },
    'delete /api/v0.1/listings/:id': { target: 'v0_1/ListingController.destroy', cors: apiCors },

    'get /api/v0.1/listing-categories': { target: 'v0_1/ListingCategoryController.find', cors: apiCors },
    'get /api/v0.1/listing-categories/:id': { target: 'v0_1/ListingCategoryController.findOne', cors: apiCors },
    'post /api/v0.1/listing-categories': { target: 'v0_1/ListingCategoryController.create', cors: apiCors },
    'put /api/v0.1/listing-categories/assign': { target: 'v0_1/ListingCategoryController.assignListings', cors: apiCors },
    'patch /api/v0.1/listing-categories/:id': { target: 'v0_1/ListingCategoryController.update', cors: apiCors },
    'delete /api/v0.1/listing-categories/:id': { target: 'v0_1/ListingCategoryController.destroy', cors: apiCors },

    'get /api/v0.1/listing-types': { target: 'v0_1/ListingTypeController.find', cors: apiCors },
    'get /api/v0.1/listing-types/:id': { target: 'v0_1/ListingTypeController.findOne', cors: apiCors },
    'post /api/v0.1/listing-types': { target: 'v0_1/ListingTypeController.create', cors: apiCors },
    'patch /api/v0.1/listing-types/:id': { target: 'v0_1/ListingTypeController.update', cors: apiCors },
    'delete /api/v0.1/listing-types/:id': { target: 'v0_1/ListingTypeController.destroy', cors: apiCors },

    'get r|/api/v0.1/media/get/(\\d+)/([\\w-]+).(\\w+)|id,uuid,ext': { target: "v0_1/MediaController.get", cors: apiCors },
    'get /api/v0.1/media/get/:id/:uuid': { target: "v0_1/MediaController.getRedirect", cors: apiCors },
    'get /api/v0.1/media/download': { target: "v0_1/MediaController.download", cors: apiCors },
    'post /api/v0.1/media/upload': { target: "v0_1/MediaController.upload", cors: apiCors },
    'patch /api/v0.1/media/:id': { target: "v0_1/MediaController.update", cors: apiCors },

    'get /api/v0.1/stats/users_registered': { target: 'v0_1/StatsController.userRegistered', cors: apiCors },
    'get /api/v0.1/stats/listings_published': { target: 'v0_1/StatsController.listingPublished', cors: apiCors },
    'get /api/v0.1/stats/bookings_paid': { target: 'v0_1/StatsController.bookingPaid', cors: apiCors },

    'get /api/v0.1/users': { target: 'v0_1/UserController.find', cors: apiCors },
    'get /api/v0.1/users/:id': { target: 'v0_1/UserController.findOne', cors: apiCors },
    'post /api/v0.1/users': { target: 'v0_1/UserController.create', cors: apiCors },
    'patch /api/v0.1/users/:id': { target: 'v0_1/UserController.update', cors: apiCors },
    'delete /api/v0.1/users/:id': { target: 'v0_1/UserController.destroy', cors: apiCors },

    'get /api/v0.1/webhooks': { target: 'v0_1/WebhookController.find', cors: apiCors },
    'post /api/v0.1/webhooks': { target: 'v0_1/WebhookController.create', cors: apiCors },
    'delete /api/v0.1/webhooks/:id': { target: 'v0_1/WebhookController.destroy', cors: apiCors },



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
