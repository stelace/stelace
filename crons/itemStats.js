/* global BootstrapService, Booking, Conversation, Item, LoggerService, StelaceEvent */

const Sails  = require('sails');
const moment = require('moment');
const yargs  = require('yargs');

const cronTaskName = "itemStats";

global._       = require('lodash');
global.Promise = require('bluebird');

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
        itemsUpdated: 0,
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
            label: "Item view",
            createdDate: dateConstraints,
            itemId: { "!": null }
        });
        const groupedViews = _(views)
            .uniq("sessionId")
            .groupBy("itemId")
            .value();

        const conversations = yield Conversation.find({
            createdDate: dateConstraints
        });
        const groupedConversations = _.groupBy(conversations, "itemId");

        const bookings = yield Booking.find({
            paidDate: dateConstraints
        });
        const groupedBookings = _.groupBy(bookings, "itemId");

        const itemIds = _(groupedViews)
            .keys()
            .union(_.keys(groupedConversations))
            .value();
        const items   = yield Item.find({ id: itemIds });

        const indexedItems = _.indexBy(items, "id");
        let itemUpdates = [];

        _.forEach(indexedItems, (item, itemId) => {
            const itemViews = ((groupedViews[itemId] && groupedViews[itemId].length) || 0) * 1;
            const itemConversations = ((groupedConversations[itemId] && groupedConversations[itemId].length) || 0) * 1;
            const itemBookings = ((groupedBookings[itemId] && groupedBookings[itemId].length) || 0) * 1;

            const nbViews = (indexedItems[itemId].nbViews || 0) + itemViews;
            const nbBookings = (indexedItems[itemId].nbBookings || 0) * 1 + itemBookings;
            const nbContacts = (indexedItems[itemId].nbContacts || 0) * 1 + itemConversations;

            itemUpdates.push(Item.updateOne(itemId, {
                nbViews,
                nbContacts,
                nbBookings
            }));
        });

        info.itemsUpdated = itemUpdates.length;
        info.views = views.length;
        info.conversations = conversations.length;
        info.bookings = bookings.length;

        return Promise.all(itemUpdates);
    })()
    .catch(err => {
        logger.error({ err: err });
    })
    .finally(() => {
        const duration = moment().diff(startTime);
        logger.info(`End cron: ${info.itemsUpdated} items with ${info.views} views, ${info.conversations} conversations and ${info.bookings} bookings, in ${duration}ms.`);
        setTimeout(sails.lowerSafe, pastDays * 10); // let close MySQL connection after updates
    });

});
