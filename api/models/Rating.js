/* global Booking, Listing, LoggerService, Rating, TimeService, User */

/**
* Rating.js
*
* @description :: Ratings between users in various transactions consist in a simple weighted coefficient (0/1/2) and optional comments (on owner and listing)
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        score: {
            type: "integer",
            required: true
        },
        comment: { // general comment, focusing on owner
            type: "text",
            maxLength: 2000
        },
        listingComment: {
            type: "text",
            maxLength: 2000
        },
        listingId: { // when listingComment, makes matching easier on listing page (not necessary to get booking)
            type: "integer",
            index: true
        },
        userId: {
            type: "integer",
            index: true
        },
        userType: "string",
        targetId: "integer",
        targetType: "string",
        bookingId: {
            type: "integer",
            index: true
        },
        visibleDate: "string" // if now is after "visibleDate", then the rating can be visible
    },

    getAccessFields: getAccessFields,
    get: get,

    afterCreate: afterCreate,

    propagateRatingChange: propagateRatingChange,
    classify: classify,
    getRoles: getRoles,
    getDefaultVisibleDate: getDefaultVisibleDate,
    isCompleteRating: isCompleteRating,
    hideCommentsWhenNotVisible: hideCommentsWhenNotVisible,
    exposeClassifiedRatings: exposeClassifiedRatings,
    canUpdateVisibleDate: canUpdateVisibleDate,
    getRatersIds: getRatersIds,

    updateRatingsVisibleDate: updateRatingsVisibleDate

};

var params = {
    scores: [1, 2, 3, 4, 5],
    types: ["owner", "taker"],
    nbDaysAfterBookingEndDateToCreate: 60,
    nbDaysToUpdateAfterBothCompletion: 1
};

var moment = require('moment');
const _ = require('lodash');
const Promise = require('bluebird');

function getAccessFields(access) {
    var accessFields = {
        self: [ // req.user.id in (userId || targetId)
            "id",
            "score",
            "comment",
            "listingComment",
            "listingId",
            "userId",
            "userType",
            "targetId",
            "targetType",
            "bookingId",
            "visibleDate",
            "createdDate",
            "updatedDate",
        ],
        others: [
            "id",
            "score",
            "comment",
            "listingComment",
            "listingId",
            "userId",
            "userType",
            "targetId",
            "targetType",
            "visibleDate",
            "createdDate",
            "updatedDate"
        ]
    };

    return accessFields[access];
}

function get(prop) {
    if (prop) {
        return params[prop];
    } else {
        return params;
    }
}

function afterCreate(newRating, next) {
    var logger = LoggerService.getLogger("app");

    return Promise.coroutine(function* () {
        if (! _.contains(params.types, newRating.targetType)) {
            throw new Error("Wrong target type");
        }

        // update User and Listing with new rating
        // User and Listing update after rating update is done in RatingService since it can't be done with afterUpdate
        yield propagateRatingChange(newRating, newRating.score, true);
    })()
    .catch(err => {
        logger.error({ err: err }, "update target user and listing nbRatings after rating creation");
    })
    .asCallback(next);
}

/**
 * propagate rating change
 * @param  {object}  rating
 * @param  {number}  [scoreDiff = 0]
 * @param  {boolean} [isNewRating = false]
 * @return {Promise<void>}
 */
function propagateRatingChange(rating, scoreDiff, isNewRating) {
    scoreDiff   = scoreDiff || 0;
    isNewRating = isNewRating || false;

    return Promise.coroutine(function* () {
        // nothing to propagate if not a new rating and no score diff
        if (! isNewRating && scoreDiff === 0) {
            return;
        }

        var results = yield Promise.props({
            targetUser: User.findOne({ id: rating.targetId }),
            listing: Listing.findOne({ id: rating.listingId })
        });

        var targetUser = results.targetUser;
        var listing       = results.listing;

        if (! targetUser || ! listing) {
            var error = new Error("Rating propagation fail: target user or listing is not found");
            error.ratingId     = rating.id;
            error.targetUserId = rating.targetId;
            error.listingId       = rating.listingId;
            throw error;
        }

        // Scores are saved in models for simplicity and less requests but this implies some corruption risks.
        // Acceptable for search results or other agregated info. Ratings are requested anyway for detailed info.
        // Use UpdateUserAndListingRatings script to check periodically
        var userUpdateAttrs = {
            ratingScore: targetUser.ratingScore + scoreDiff
        };
        var listingUpdateAttrs = {
            ratingScore: listing.ratingScore + scoreDiff
        };

        if (isNewRating) {
            userUpdateAttrs.nbRatings = targetUser.nbRatings + 1;
            listingUpdateAttrs.nbRatings = listing.nbRatings + 1;
        }

        yield Promise.props({
            targetUser: User.updateOne(targetUser.id, userUpdateAttrs),
            // Increment listing.nbRatings only when appriopriate (no listing rating per se. listing is associated with owner)
            listing: listing.ownerId === targetUser.id ? Listing.updateOne(listing.id, listingUpdateAttrs) : null
        });
    })();
}

/**
 * Classify the ratings associated with a booking by:
 * - 'my' if the rating if from the current user
 * - 'other' otherwise
 * @param  {Object[]} ratings
 * @param  {Number} userId - the current user
 * @return {Object} classifiedRatings
 * @return {Object} classifiedRatings.my
 * @return {Object} classifiedRatings.other
 */
function classify(ratings, userId) {
    return _.reduce(ratings, (classifiedRatings, rating) => {
        if (rating.userId === userId) {
            classifiedRatings.my = rating;
        } else {
            classifiedRatings.other = rating;
        }

        return classifiedRatings;
    }, {});
}

function getRoles(booking, userId) {
    var roles = {
        userId: userId,
        userType: null,
        targetId: null,
        targetType: null
    };

    if (userId === booking.takerId) {
        roles.userType   = 'taker';
        roles.targetId   = booking.ownerId;
        roles.targetType = 'owner';
    } else { // userId === booking.ownerId
        roles.userType   = 'owner';
        roles.targetId   = booking.takerId;
        roles.targetType = 'taker';
    }

    return roles;
}

function getDefaultVisibleDate(booking) {
    var nbDays = Rating.get("nbDaysAfterBookingEndDateToCreate");
    var date;

    if (! Booking.isNoTime(booking)) {
        date = booking.endDate;
    } else {
        date = Booking.getDueDate(booking, "end");
    }

    return moment(date).add(nbDays, "d").toISOString();
}

function isCompleteRating(rating) {
    return rating.score && (rating.comment || rating.listingComment);
}

// the comments of ratings are hidden if visible date isn't passed
function hideCommentsWhenNotVisible(ratings, now) {
    return _.map(ratings, rating => {
        if (rating.visibleDate > now) {
            rating.comment     = null;
            rating.listingComment = null;
        }

        return rating;
    });
}

function exposeClassifiedRatings(classifiedRatings, now) {
    classifiedRatings = _.clone(classifiedRatings);

    // the rating from the other person is hidden unless the visible date is passed
    // when hidden, get the level of completeness
    if (classifiedRatings.other) {
        // after visibleDate, ratings are shown
        if (classifiedRatings.other.visibleDate < now) {
            classifiedRatings.other = Rating.expose(classifiedRatings.other, "others");
        } else {
            if (Rating.isCompleteRating(classifiedRatings.other)) {
                classifiedRatings.other = "complete";
            } else {
                // set to null, prove rating existence but don't reveal it
                classifiedRatings.other = null;
            }
        }
    }

    if (classifiedRatings.my) {
        classifiedRatings.my = Rating.expose(classifiedRatings.my, "self");
    }

    return classifiedRatings;
}

// if the ratings from the two parts are complete,
function updateRatingsVisibleDate(classifiedRatings, visibleDate) {
    visibleDate = visibleDate || moment().add(Rating.get("nbDaysToUpdateAfterBothCompletion"), "d").toISOString();

    return Promise.coroutine(function* () {
        // if there aren't 2 complete ratings
        if (! classifiedRatings.my
         || ! classifiedRatings.other
         || ! Rating.isCompleteRating(classifiedRatings.my)
         || ! Rating.isCompleteRating(classifiedRatings.other)
        ) {
            return classifiedRatings;
        }
        // if the two ratings cannot update their visible date, do nothing
        if (! canUpdateVisibleDate(classifiedRatings.my)
         && ! canUpdateVisibleDate(classifiedRatings.other)
        ) {
            return classifiedRatings;
        }

        var ratingsIds = [classifiedRatings.my.id, classifiedRatings.other.id];
        var updatedRatings = yield Rating.update({ id: ratingsIds }, { visibleDate: visibleDate });

        var myRating    = _.find(updatedRatings, { id: classifiedRatings.my.id });
        var otherRating = _.find(updatedRatings, { id: classifiedRatings.other.id });

        if (myRating) {
            classifiedRatings.my = myRating;
        }
        if (otherRating) {
            classifiedRatings.other = myRating;
        }

        return classifiedRatings;
    })();
}

// visible date can be updated if it isn't "really" set
function canUpdateVisibleDate(rating) {
    // if the visible date is "pure" (0 hours, 0 minutes, 0 seconds)
    // then it is almost sure that it was automatically set at creation
    // so that it isn't set because the ratings from the two parts are complete
    return ! rating.visibleDate || TimeService.isPureDate(rating.visibleDate);
}

function getRatersIds(booking) {
    return [booking.ownerId, booking.takerId];
}
