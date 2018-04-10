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

    '/old-browsers': "AppController.oldBrowsers",
    '/install': 'AppController.install',
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

    // ContentEntriesController
    'get /api/contents/entries/:lang': 'ContentEntriesController.findLanguage',

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
    'get /api/listing/price-recommendation': "ListingController.getRecommendedPrices",
    'post /api/listing/price-recommendation/time-unit-price': "ListingController.getTimeUnitPriceFromSellingPrice",
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
    'get /api/location/journeys-info': "LocationController.getJourneysInfo",
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
    'get /api/stelace/config/install/status': "StelaceConfigController.installStatus",
    'get /api/stelace/config': "StelaceConfigController.findOne",
    'post /api/stelace/config/install': "StelaceConfigController.install",
    'patch /api/stelace/config': "StelaceConfigController.update",

    // StelaceEventController
    'post /api/stelace/event': "StelaceEventController.createEvent",
    'patch /api/stelace/event/:id': "StelaceEventController.updateEvent",

    // UserController
    'get /api/user/params': "UserController.params",
    "get /api/user/me": "UserController.me",
    "get /api/user/my-permissions": "UserController.getMyPermissions",
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

    'get /api/v0.1/api-events/count': { target: 'publicApi/latest/ApiEventController.getCount', cors: apiCors },

    'get /api/v0.1/api-keys/main': { target: 'publicApi/latest/ApiKeyController.findMain', cors: apiCors },
    'post /api/v0.1/api-keys': { target: 'publicApi/latest/ApiKeyController.create', cors: apiCors },
    'delete /api/v0.1/api-keys/:id': { target: 'publicApi/latest/ApiKeyController.destroy', cors: apiCors },

    'get /api/v0.1/bookings': { target: 'publicApi/latest/BookingController.find', cors: apiCors },
    'get /api/v0.1/bookings/:id': { target: 'publicApi/latest/BookingController.findOne', cors: apiCors },
    'post /api/v0.1/bookings/:id/cancel': { target: 'publicApi/latest/BookingController.cancel', cors: apiCors },

    'get /api/v0.1/contents/entries/editable': { target: 'publicApi/latest/ContentEntriesController.findEditable', cors: apiCors },
    'patch /api/v0.1/contents/entries/editable': { target: 'publicApi/latest/ContentEntriesController.updateEditable', cors: apiCors },
    'patch /api/v0.1/contents/entries/editable/reset': { target: 'publicApi/latest/ContentEntriesController.resetEditable', cors: apiCors },
    'get /api/v0.1/contents/entries/default': { target: 'publicApi/latest/ContentEntriesController.findDefault', cors: apiCors },
    'patch /api/v0.1/contents/entries/default': { target: 'publicApi/latest/ContentEntriesController.updateDefault', cors: apiCors },

    'get /api/v0.1/emails/templates': { target: 'publicApi/latest/EmailTemplateController.getListTemplates', cors: apiCors },
    'get /api/v0.1/emails/templates/preview': { target: 'publicApi/latest/EmailTemplateController.preview', cors: apiCors },
    'get /api/v0.1/emails/templates/edit': { target: 'publicApi/latest/EmailTemplateController.edit', cors: apiCors },
    'get /api/v0.1/emails/templates/metadata': { target: 'publicApi/latest/EmailTemplateController.getTemplateMetadata', cors: apiCors },
    'get /api/v0.1/emails/entries/editable': { target: 'publicApi/latest/EmailTemplateController.findEditable', cors: apiCors },
    'patch /api/v0.1/emails/entries/editable': { target: 'publicApi/latest/EmailTemplateController.updateEditable', cors: apiCors },
    'patch /api/v0.1/emails/entries/editable/reset': { target: 'publicApi/latest/EmailTemplateController.resetEditable', cors: apiCors },
    'get /api/v0.1/emails/entries/default': { target: 'publicApi/latest/EmailTemplateController.findDefault', cors: apiCors },
    'patch /api/v0.1/emails/entries/default': { target: 'publicApi/latest/EmailTemplateController.updateDefault', cors: apiCors },

    'get /api/v0.1/info/me': { target: 'publicApi/latest/InfoController.me', cors: apiCors },
    'get /api/v0.1/info/my-permissions': { target: 'publicApi/latest/InfoController.getMyPermissions', cors: apiCors },
    'get /api/v0.1/info/plan-permissions': { target: 'publicApi/latest/InfoController.getPlanPermissions', cors: apiCors },

    'get /api/v0.1/listings': { target: 'publicApi/latest/ListingController.find', cors: apiCors },
    'get /api/v0.1/listings/:id': { target: 'publicApi/latest/ListingController.findOne', cors: apiCors },
    'post /api/v0.1/listings': { target: 'publicApi/latest/ListingController.create', cors: apiCors },
    'patch /api/v0.1/listings/:id': { target: 'publicApi/latest/ListingController.update', cors: apiCors },
    'put /api/v0.1/listings/:id/validate': { target: 'publicApi/latest/ListingController.validate', cors: apiCors },
    'put /api/v0.1/listings/:id/medias': { target: 'publicApi/latest/ListingController.updateMedias', cors: apiCors },
    'delete /api/v0.1/listings/:id': { target: 'publicApi/latest/ListingController.destroy', cors: apiCors },

    'get /api/v0.1/listing-categories': { target: 'publicApi/latest/ListingCategoryController.find', cors: apiCors },
    'get /api/v0.1/listing-categories/:id': { target: 'publicApi/latest/ListingCategoryController.findOne', cors: apiCors },
    'post /api/v0.1/listing-categories': { target: 'publicApi/latest/ListingCategoryController.create', cors: apiCors },
    'put /api/v0.1/listing-categories/assign': { target: 'publicApi/latest/ListingCategoryController.assignListings', cors: apiCors },
    'patch /api/v0.1/listing-categories/:id': { target: 'publicApi/latest/ListingCategoryController.update', cors: apiCors },
    'delete /api/v0.1/listing-categories/:id': { target: 'publicApi/latest/ListingCategoryController.destroy', cors: apiCors },

    'get /api/v0.1/listing-types': { target: 'publicApi/latest/ListingTypeController.find', cors: apiCors },
    'get /api/v0.1/listing-types/:id': { target: 'publicApi/latest/ListingTypeController.findOne', cors: apiCors },
    'post /api/v0.1/listing-types': { target: 'publicApi/latest/ListingTypeController.create', cors: apiCors },
    'patch /api/v0.1/listing-types/:id': { target: 'publicApi/latest/ListingTypeController.update', cors: apiCors },
    'delete /api/v0.1/listing-types/:id': { target: 'publicApi/latest/ListingTypeController.destroy', cors: apiCors },

    'get r|/api/v0.1/media/get/(\\d+)/([\\w-]+).(\\w+)|id,uuid,ext': { target: "publicApi/latest/MediaController.get", cors: apiCors },
    'get /api/v0.1/media/get/:id/:uuid': { target: "publicApi/latest/MediaController.getRedirect", cors: apiCors },
    'get /api/v0.1/media/download': { target: "publicApi/latest/MediaController.download", cors: apiCors },
    'post /api/v0.1/media/upload': { target: "publicApi/latest/MediaController.upload", cors: apiCors },
    'patch /api/v0.1/media/:id': { target: "publicApi/latest/MediaController.update", cors: apiCors },

    'get /api/v0.1/stats/users_registered': { target: 'publicApi/latest/StatsController.userRegistered', cors: apiCors },
    'get /api/v0.1/stats/listings_published': { target: 'publicApi/latest/StatsController.listingPublished', cors: apiCors },
    'get /api/v0.1/stats/bookings_paid': { target: 'publicApi/latest/StatsController.bookingPaid', cors: apiCors },

    'get /api/v0.1/stelace/config': { target: 'publicApi/latest/StelaceConfigController.findOne', cors: apiCors },
    'patch /api/v0.1/stelace/config': { target: 'publicApi/latest/StelaceConfigController.update', cors: apiCors },
    'post /api/v0.1/stelace/config/refresh': { target: 'publicApi/latest/StelaceConfigController.refresh', cors: apiCors },

    'get /api/v0.1/users': { target: 'publicApi/latest/UserController.find', cors: apiCors },
    'get /api/v0.1/users/:id': { target: 'publicApi/latest/UserController.findOne', cors: apiCors },
    'post /api/v0.1/users': { target: 'publicApi/latest/UserController.create', cors: apiCors },
    'patch /api/v0.1/users/:id': { target: 'publicApi/latest/UserController.update', cors: apiCors },
    'delete /api/v0.1/users/:id': { target: 'publicApi/latest/UserController.destroy', cors: apiCors },

    'get /api/v0.1/webhooks': { target: 'publicApi/latest/WebhookController.find', cors: apiCors },
    'post /api/v0.1/webhooks': { target: 'publicApi/latest/WebhookController.create', cors: apiCors },
    'patch /api/v0.1/webhooks/:id': { target: 'publicApi/latest/WebhookController.update', cors: apiCors },
    'delete /api/v0.1/webhooks/:id': { target: 'publicApi/latest/WebhookController.destroy', cors: apiCors },



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
