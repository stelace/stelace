/* global Booking, GamificationService, Listing, Media, Rating, User */

module.exports = {

    getClassifiedRatings: getClassifiedRatings,
    populateRatings: populateRatings,

    findRatings: findRatings,
    createRating: createRating,
    updateRating: updateRating

};

const moment = require('moment');
const _ = require('lodash');
const createError = require('http-errors');

/**
 * get classified ratings by "my", "other"
 * @param  {Number}  bookingId
 * @param  {Number}  userId - the current user
 * @return {object}  classified ratings
 */
async function getClassifiedRatings({ bookingId, userId }) {
    const ratings = await Rating.find({ bookingId });
    const classifiedRatings = Rating.classify(ratings, userId);
    return classifiedRatings;
}

/**
 * populate ratings
 * @param  {object[]} ratings
 * @param  {string}   [access = "others"]
 * @param  {boolean}  [populateListings = false]
 * @return {object[]} populated ratings
 */
async function populateRatings(ratings, access = 'others', populateListings = false) {
    const modelAccess = 'others';

    const [
        users,
        listings,
    ] = await Promise.all([
        User.find({ id: _.pluck(ratings, 'userId') }),
        populateListings ? Listing.find({ id: _.pluck(ratings, 'listingId') }) : [],
    ]);

    const userMedias = await User.getMedia(users);

    const indexedUsers = _.indexBy(users, 'id');
    const indexedListings = _.indexBy(listings, 'id');

    return _.map(ratings, rating => {
        rating           = Rating.expose(rating, access);
        rating.user      = User.expose(indexedUsers[rating.userId], modelAccess);
        rating.userMedia = Media.expose(userMedias[rating.userId], modelAccess);

        if (populateListings) {
            rating.listing = Listing.expose(indexedListings[rating.listingId], modelAccess);
        }

        return rating;
    });
}

/**
 * find ratings from booking or target
 * if target provided, get all ratings related to that user
 * if booking provided, get all ratings related to this booking
 * @param  {Number} bookingId - bookingId or targetId must be provided
 * @param  {Number} targetId
 * @param  {Boolean} [populateListings = false]
 * @param  {Object} [user] - must be defined if booking provided
 * @param  {String} [access]
 * @return {Object|Object[]} classifiedRatings | populated ratings
 */
async function findRatings({
    bookingId,
    targetId,
    populateListings,
    user,
    access,
}) {
    const now = moment().toISOString();

    if (bookingId) {
        if (!user) { // must be logged
            throw createError(403);
        }

        const classifiedRatings = await getClassifiedRatings({
            bookingId,
            userId: user.id,
        });

        return Rating.exposeClassifiedRatings(classifiedRatings, now);
    } else if (targetId) {
        let ratings = await Rating.find({ targetId });
        ratings = Rating.hideCommentsWhenNotVisible(ratings, now);
        ratings = await populateRatings(ratings, access, populateListings);
        return ratings;
    } else {
        throw createError(403);
    }
}

/**
 * create rating
 * @param  {object} attrs
 * @param  {number} attrs.score
 * @param  {string} attrs.comment
 * @param  {string} attrs.listingComment
 * @param  {number} attrs.bookingId
 * @param  {object} user
 * @param  {object} [logger] - useful for gamification
 * @param  {object} [req]    - useful for gamification
 * @return {Promise<object>} classifiedRatings
 * @return {object}          classifiedRatings.my
 * @return {object}          classifiedRatings.other
 */
async function createRating({
    attrs = {},
    user,
    logger,
    req,
}) {
    const filteredAttrs = [
        'score',
        'comment',
        'listingComment',
        'bookingId'
    ];

    const createAttrs = _.pick(attrs, filteredAttrs);

    const now = moment().toISOString();

    if (!_.includes(Rating.get('scores'), createAttrs.score)
     || !createAttrs.bookingId
    ) {
        throw createError(400);
    }

    const booking = await Booking.findOne({ id: createAttrs.bookingId });
    if (!booking) {
        throw createError(404);
    }
    if (!_.includes(Rating.getRatersIds(booking), user.id)) {
        throw createError(403);
    }

    let classifiedRatings = await getClassifiedRatings({ bookingId: createAttrs.bookingId, userId: user.id });
    if (classifiedRatings.my) {
        throw createError(400, 'existing rating'); // cannot create two ratings from the same user for one booking
    }

    const visibleDate = Rating.getDefaultVisibleDate(booking);
    if (visibleDate < now) {
        throw createError(400, `rating can't be created anymore`);
    }

    createAttrs.listingId      = booking.listingId;
    createAttrs.visibleDate = visibleDate;

    _.assign(createAttrs, Rating.getRoles(booking, user.id));

    const rating = await Rating.create(createAttrs);

    classifiedRatings.my = rating;

    try {
        classifiedRatings = await Rating.updateRatingsVisibleDate(classifiedRatings);
    } catch (e) { /* do nothing */ }

    afterRatingActionGamification(user, rating, logger, req);

    return classifiedRatings;
}

/**
 * update rating
 * @param  {number} ratingId
 * @param  {object} attrs
 * @param  {number} attrs.score
 * @param  {string} attrs.comment
 * @param  {string} attrs.listingComment
 * @param  {object} user
 * @param  {object} [logger] - useful for gamification
 * @param  {object} [req] - useful for gamification
 * @return {Promise<object>} classifiedRatings
 * @return {object}          classifiedRatings.my
 * @return {object}          classifiedRatings.other
 */
async function updateRating(ratingId, {
    attrs = {},
    user,
    logger,
    req,
}) {
    const filteredAttrs = [
        "score",
        "comment",
        "listingComment"
    ];

    const updateAttrs = _.pick(attrs, filteredAttrs);

    var now = moment().toISOString();

    if (!_.includes(Rating.get('scores'), updateAttrs.score)) {
        throw createError(400);
    }

    let rating = await Rating.findOne({ id: ratingId });
    if (!rating) {
        throw createError(404);
    }
    if (rating.userId !== user.id) {
        throw createError(403);
    }
    if (rating.visibleDate < now) {
        throw createError(400, 'rating cannot be updated anymore');
    }

    let classifiedRatings = await getClassifiedRatings({
        bookingId: rating.bookingId,
        userId: user.id,
    });

    const scoreDiff = updateAttrs.score - rating.score;

    rating = await Rating.updateOne(rating.id, updateAttrs);
    classifiedRatings.my = rating;

    try {
        await Rating.propagateRatingChange(rating, scoreDiff, false);
    } catch (e) { /* do nothing */ }

    try {
        classifiedRatings = await Rating.updateRatingsVisibleDate(classifiedRatings);
    } catch (e) { /* do nothing */ }

    afterRatingActionGamification(user, rating, logger, req);

    return classifiedRatings;
}

function afterRatingActionGamification(user, rating, logger, req) {
    var actionsIds = [
        "FIRST_RATING",
    ];
    var actionsData = { FIRST_RATING: { rating: rating } };

    GamificationService.checkActions(user, actionsIds, actionsData, logger, req);
}
