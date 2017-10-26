/* global Assessment, Booking, BootstrapService, GamificationService, Listing, LoggerService, Rating, User */

var Sails = require('sails');

global._       = require('lodash');
global.Promise = require('bluebird');

Sails.load({
    models: {
        migrate: "safe"
    },
    hooks: {
        grunt: false,
        sockets: false,
        pubsub: false
    }
}, function (err, sails) {
    if (err) {
        console.log("\n!!! Fail script launch: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    var logger = LoggerService.getLogger("app");

    return Promise
        .resolve()
        .then(() => {
            return [
                User.find(),
                Listing.find(),
                Booking.find(),
                Assessment.find(),
                Rating.find()
            ];
        })
        .spread((users, listings, bookings, assessments, ratings) => {
            var hash = getHash(users, listings, bookings, assessments, ratings);

            return Promise
                .resolve(_.values(hash))
                .map(info => {
                    var user        = info.user;
                    var params      = getCheckActionsParams(info);
                    var actionsIds  = params.actionsIds;
                    var actionsData = params.actionsData;

                    return GamificationService.checkActions(user, actionsIds, actionsData, logger);
                });
        })
        .then(() => {
            return Promise.all([
                User.update({ points: null }, { points: 0 }),
                User.update({ lastViewedPoints: null }, { lastViewedPoints: 0 })
            ]);
        })
        .catch(err => {
            console.log(err);
            console.log(err.stack);
        })
        .finally(() => {
            sails.lowerSafe();
        });



    function getHash(users, listings, bookings, assessments, ratings) {
        var indexedListings         = _.groupBy(listings, "ownerId");
        var indexedBookingsAsTaker  = _.groupBy(bookings, "takerId");
        var indexedBookingsAsOwner  = _.groupBy(bookings, "ownerId");
        var indexedRatings          = _.groupBy(ratings, "userId");

        var pushAssessment = function (memo, assessment, userId) {
            if (! memo[userId]) {
                memo[userId] = [];
            }
            memo[userId].push(assessment);
        };

        var indexedAssessments = _.reduce(assessments, (memo, assessment) => {
            if (assessment.ownerId) {
                pushAssessment(memo, assessment, assessment.ownerId);
            }
            if (assessment.takerId) {
                pushAssessment(memo, assessment, assessment.takerId);
            }

            return memo;
        }, {});

        var hash = _.reduce(users, (memo, user) => {
            var info = {
                user: user,
                listings: indexedListings[user.id] || [],
                bookingsAsTaker: indexedBookingsAsTaker[user.id] || [],
                bookingsAsOwner: indexedBookingsAsOwner[user.id] || [],
                assessments: indexedAssessments[user.id] || [],
                ratings: indexedRatings[user.id] || []
            };

            memo[user.id] = info;
            return memo;
        }, {});

        return hash;
    }

    function getCheckActionsParams(info) {
        var listings            = info.listings;
        var bookingsAsTaker  = info.bookingsAsTaker;
        var bookingsAsOwner  = info.bookingsAsOwner;
        var ratings          = info.ratings;

        var actionsIds = [
            // user
            "ADD_FIRSTNAME",
            "ADD_LASTNAME",
            "ADD_DESCRIPTION",
            "EMAIL_VALIDATION",
            "PHONE_VALIDATION",
            "ADD_PROFILE_IMAGE",
            "FIRST_LOCATIONS_NB_2",

            // listing
            "FIRST_VALID_LISTING_AD",
            "VALID_LISTING_AD",

            // rating
            "FIRST_RATING",

            // booking
            "FIRST_BOOKING",
            "FIRST_RENTING_OUT",
            "FIRST_COMPLETE_BOOKING",
            "COMPLETE_BOOKING",
        ];

        var actionsData = {
            FIRST_VALID_LISTING_AD: _.map(listings, listing => ({ listing: listing })),
            VALID_LISTING_AD: _.map(listings, listing => ({ listing: listing })),
            FIRST_RATING: _.map(ratings, rating => ({ rating: rating })),
            FIRST_BOOKING: _.map(bookingsAsTaker, booking => ({ booking: booking })),
            FIRST_RENTING_OUT: _.map(bookingsAsOwner, booking => ({ booking: booking })),
            FIRST_COMPLETE_BOOKING: _.map(bookingsAsTaker.concat(bookingsAsOwner), booking => ({ booking: booking })),
            COMPLETE_BOOKING: _.map(bookingsAsTaker.concat(bookingsAsOwner), booking => ({ booking: booking })),
        };

        return {
            actionsIds: actionsIds,
            actionsData: actionsData
        };
    }
});
