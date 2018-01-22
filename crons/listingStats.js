/* global BootstrapService, Booking, Conversation, Listing, LoggerService, StelaceEvent */

const Sails  = require('sails');
const moment = require('moment');
const yargs  = require('yargs');

const cronTaskName = "listingStats";

const _ = require('lodash');
const Promise = require('bluebird');

const argv = yargs
    .usage("Usage: $0 --pastDays")
    .argv;

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
        console.log("\n!!! Fail cron task: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    let logger = LoggerService.getLogger("cron");
    logger = logger.child({ cronTaskName: cronTaskName });

    const startTime = moment();
    const pastDays = argv.pastDays || 1;
    const pastLimit = moment().subtract(pastDays, "d").startOf('day');
    const dateConstraints = {
        ">=": pastLimit.toISOString(),
        "<": moment().startOf('day').toISOString()
    };

    let info = {
        listingsUpdated: 0,
        views: 0,
        conversations: 0,
        bookings: 0
    };

    logger.info("Start cron");

    if (argv.pastDays > 1) {
        logger.warn(`Aggregating over ${pastDays} days instead of default (yesterday) and ADDING result`);
    }

    return Promise.coroutine(function* () {
        const views = yield StelaceEvent.find({
            label: "Listing view",
            createdDate: dateConstraints,
            listingId: { "!": null }
        });
        const groupedViews = _(views)
            .uniq("sessionId")
            .groupBy("listingId")
            .value();

        const conversations = yield Conversation.find({
            createdDate: dateConstraints
        });
        const groupedConversations = _.groupBy(conversations, "listingId");

        const bookings = yield Booking.find({
            paidDate: dateConstraints
        });
        const groupedBookings = _.groupBy(bookings, "listingId");

        const listingIds = _(groupedViews)
            .keys()
            .union(_.keys(groupedConversations))
            .value();
        const listings   = yield Listing.find({ id: listingIds });

        const indexedListings = _.indexBy(listings, "id");
        let listingUpdates = [];

        _.forEach(indexedListings, (listing, listingId) => {
            const listingViews = ((groupedViews[listingId] && groupedViews[listingId].length) || 0) * 1;
            const listingConversations = ((groupedConversations[listingId] && groupedConversations[listingId].length) || 0) * 1;
            const listingBookings = ((groupedBookings[listingId] && groupedBookings[listingId].length) || 0) * 1;

            const nbViews = (indexedListings[listingId].nbViews || 0) + listingViews;
            const nbBookings = (indexedListings[listingId].nbBookings || 0) * 1 + listingBookings;
            const nbContacts = (indexedListings[listingId].nbContacts || 0) * 1 + listingConversations;

            listingUpdates.push(Listing.updateOne(listingId, {
                nbViews,
                nbContacts,
                nbBookings
            }));
        });

        info.listingsUpdated = listingUpdates.length;
        info.views = views.length;
        info.conversations = conversations.length;
        info.bookings = bookings.length;

        return Promise.all(listingUpdates);
    })()
    .catch(err => {
        logger.error({ err: err });
    })
    .finally(() => {
        const duration = moment().diff(startTime);
        logger.info(`End cron: ${info.listingsUpdated} listings with ${info.views} views, ${info.conversations} conversations and ${info.bookings} bookings, in ${duration}ms.`);
        setTimeout(sails.lowerSafe, pastDays * 10); // let close MySQL connection after updates
    });

});
