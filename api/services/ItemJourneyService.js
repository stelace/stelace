/* global Assessment, Booking, Item, Rating, ToolsService */

module.exports = {

    getItemsJourneys: getItemsJourneys,
    ItemJourney: ItemJourney

};

var moment = require('moment');

function getItemsJourneys(itemsIds) {
    return Promise.coroutine(function* () {
        var data = yield getItemsJourneysData(itemsIds);

        var hashBookings = data.hashBookings;
        var bookings     = data.bookings;
        var ratings      = data.ratings;

        var indexedAssessmentRatings = _.groupBy(ratings, "assessmentId");

        var groupBookings = _.groupBy(bookings, "itemId");

        return _.reduce(itemsIds, (memo, itemId) => {
            memo[itemId] = new ItemJourney(groupBookings[itemId] || [], {
                hashBookings: hashBookings,
                indexedAssessmentRatings: indexedAssessmentRatings
            });
            return memo;
        }, {});
    })();
}

function getItemsJourneysData(itemsIds) {
    return Promise.coroutine(function* () {
        var bookings = yield Item.getBookings(itemsIds);

        var hashBookings = yield Booking.getAssessments(bookings);

        var assessments = [];

        _.forEach(hashBookings, hashBooking => {
            if (hashBooking.inputAssessment) {
                assessments.push(hashBooking.inputAssessment);
            }
            if (hashBooking.outputAssessment) {
                assessments.push(hashBooking.outputAssessment);
            }
        });

        assessments = ToolsService.uniqBy(assessments, "id");

        var ratings = yield Rating.find({ assessmentId: _.pluck(assessments, "id") });

        return {
            hashBookings: hashBookings,
            bookings: bookings,
            ratings: ratings
        };
    })();
}


/**
 * Item journey represents the journey of an item booking after booking
 * It is composed of steps. And steps can be grouped by routes.
 *
 * step = object with
 * - booking
 * - input assessment (not always defined)
 * - output assessment (not always defined)
 * - input assessment conversation (not always defined)
 * - output assessment conversation (not always defined)
 *
 * Route represents the path of item that goes from owner to booker(s), and finally go back to owner.
 * route = N steps where N >= 1
 */

/**
 * item journey
 * @param {object} bookings
 * @param {object} args
 * @param {object} args.hashBookings - hash indexed by booking id
 * @param {object} args.hashBookings.inputAssessment
 * @param {object} args.hashBookings.inputAssessmentConversation
 * @param {object} args.hashBookings.outputAssessment
 * @param {object} args.hashBookings.outputAssessmentConversation
 * @param {object} args.indexedAssessmentRatings - ratings indexed by assessment id
 */
function ItemJourney(bookings, args) {
    this.steps                    = [];
    this.indexedAssessmentRatings = {};

    if (! bookings.length) {
        return;
    }

    args = args || {};
    var hashBookings             = args.hashBookings;
    var indexedAssessmentRatings = args.indexedAssessmentRatings;

    _.forEach(bookings, booking => {
        var hashBooking = hashBookings[booking.id];
        this._createStepsFromBooking(booking, hashBooking);
    });

    var assessments = _.reduce(this.steps, (memo, step) => {
        if (step.inputAssessment) {
            memo.push(step.inputAssessment);
        }
        if (step.outputAssessment) {
            memo.push(step.outputAssessment);
        }
        return memo;
    }, []);

    var assessmentsIds = _.uniq(_.pluck(assessments, "id"));

    _.forEach(assessmentsIds, assessmentId => {
        this.indexedAssessmentRatings[assessmentId] = indexedAssessmentRatings[assessmentId] || [];
    });
}

ItemJourney.prototype._createStepsFromBooking = function (booking, hashBooking) {
    var step = {
        journeyIndex: this.steps.length,
        booking: booking,
        inputAssessment: hashBooking.inputAssessment,
        inputAssessmentConversation: hashBooking.inputAssessmentConversation,
        outputAssessment: hashBooking.outputAssessment,
        outputAssessmentConversation: hashBooking.outputAssessmentConversation
    };
    var routeInfo = {
        startRoute: true,
        endRoute: true
    };

    _.assign(step, routeInfo);

    this.steps.push(step);
};

/**
 * get steps that match the filter condition
 * @param  {object|function} filter - the lodash filter (same as first param of _.filter)
 * @param  {object}          [args]
 * @param  {boolean}         [args.onlyOne = false] - get the first result only
 * @param  {string}          [args.order = "asc"] - get steps in the chronological order ("asc") or not ("desc")
 * @param  {object[]}        [args.steps] - if not provided, use the item journeys steps
 * @return {object|object[]} step or steps
 */
ItemJourney.prototype.getSteps = function (filter, args) {
    args = args || {};

    var onlyOne = typeof args.onlyOne !== "undefined" ? args.onlyOne : false;
    var order   = args.order || "asc";
    var steps   = args.steps || this.steps;

    var loopFn = (onlyOne ? _.find : _.filter);

    if (order === "desc") {
        steps = _.clone(steps);
        steps.reverse();
    }

    return loopFn(steps, filter);
};

ItemJourney.prototype.getLastStep = function () {
    return _.last(this.steps);
};

ItemJourney.prototype.getRoutes = function () {
    var currentRoute = [];

    var lastStepIndex = this.steps.length - 1;

    return _.reduce(this.steps, (memo, step, index) => {
        var clonedStep = _.clone(step);
        clonedStep.routeIndex = currentRoute.length;

        currentRoute.push(clonedStep);

        if (clonedStep.endRoute
         || lastStepIndex === index
        ) {
            memo.push(currentRoute);
            currentRoute = [];
        }

        return memo;
    }, []);
};

/**
 * get step with route that match the filter condition
 * @param  {object|function} filter - the lodash filter (same as first param of _.filter)
 * @param  {object}          [args]
 * @param  {string}          [args.routeOrder = "asc"] - loop routes in the chronological order ("asc") or not ("desc")
 * @param  {string}          [args.order = "asc"] - loop steps in route in the chronological order ("asc") or not ("desc")
 * @return {object} routeInfo
 * @return {object} routeInfo.routeIndex - routeIndex = -1 if not found
 * @return {object} routeInfo.route - steps in chronological order (independently from filter order)
 */
ItemJourney.prototype.getStepByRoute = function (filter, args) {
    args = args || {};
    var routeOrder = args.routeOrder || "asc";
    var order      = args.order || "asc";

    var routes = this.getRoutes();

    if (routeOrder === "desc") {
        routes.reverse();
    }

    var routeIndex;
    var route;

    var loopFn = (order === "desc" ? _.findLastIndex : _.findIndex);

    _.forEach(routes, r => {
        if (route) {
            return;
        }

        var index = loopFn(r, filter);

        if (index !== -1) {
            routeIndex = index;
            route      = r;
        }
    });

    return {
        routeIndex: typeof routeIndex !== "undefined" ? routeIndex : -1,
        route: route
    };
};

ItemJourney.prototype.isRouteComplete = function (route) {
    return _.last(route).endRoute;
};

ItemJourney.prototype.getFutureBookings = function (refDate) {
    var firstFutureBookingStep = this.getSteps(step => {
        return step.booking.endDate && step.booking.endDate >= refDate;
    }, { onlyOne: true });

    if (! firstFutureBookingStep) {
        return [];
    }

    // get first booking at first because some bookings don't have dates
    var steps = this.getSteps(step => step.journeyIndex >= firstFutureBookingStep.journeyIndex);
    return _.pluck(steps, "booking");
};

/**
 * get the list of assessments of the item journey
 * @param  {boolean}  [signed = false]
 * @param  {object[]} [steps] - if not provided, use the item journeys steps
 * @return {object[]} assessments
 */
ItemJourney.prototype.getAssessments = function (signed, steps) {
    signed = signed || false;

    // useful to deduplicate assessments due to liberty mode (1 assessment in 2 steps)
    var hashIds = {};

    var array = steps || this.steps;

    return _.reduce(array, (memo, step) => {
        if (step.inputAssessment
         && ! isInCache(hashIds, step.inputAssessment.id)
         && matchSignCondition(step.inputAssessment, signed)
        ) {
            memo.push(step.inputAssessment);
            putInCache(hashIds, step.inputAssessment.id);
        }

        if (step.outputAssessment
         && ! isInCache(hashIds, step.outputAssessment.id)
         && matchSignCondition(step.outputAssessment, signed)
        ) {
            memo.push(step.outputAssessment);
            putInCache(hashIds, step.outputAssessment.id);
        }

        return memo;
    }, []);
};

function matchSignCondition(assessment, signed) {
    if (! signed) {
        return true;
    }

    return !! assessment.signedDate;
}

function isInCache(hash, id) {
    return hash[id];
}

function putInCache(hash, id) {
    hash[id] = true;
}

ItemJourney.prototype.getBeforeAssessment = function (assessmentId) {
    var reversedAssessments = this.getAssessments().reverse();

    var index = _.findIndex(reversedAssessments, { id: assessmentId });

    // no assessment found
    if (index === -1) {
        return;
    }

    // find the first signed assessment after the selected assessment
    return _.find(reversedAssessments.slice(index + 1), assessment => !! assessment.signedDate);
};

ItemJourney.prototype.getLastSignedAssessment = function () {
    return _.last(this.getAssessments(true));
};

/**
 * get the user that will have the item at the end (even if it's the owner)
 * @param  {object} item
 * @return {number}
 */
ItemJourney.prototype.getLastUserId = function (item) {
    var lastStep = this.getLastStep();

    if (! lastStep) {
        // no booking yet, the owner has it
        return item.ownerId;
    } else if (lastStep.outputAssessment) {
        // if there is an output assessment, the taker of this assessment has it
        return Assessment.getRealTakerId(lastStep.outputAssessment);
    } else {
        // the booker has it
        return lastStep.booking.bookerId;
    }
};

/**
 * get ratings from assessment
 * @param  {number}  assessmentId
 *
 * @return {object[]} ratings
 */
ItemJourney.prototype.getRatings = function (assessmentId) {
    var routeInfo = this.getStepByRoute(step => {
        return this.isInputAssessment(step, assessmentId)
            || this.isOutputAssessment(step, assessmentId);
    }, {
        routeOrder: "desc", // recent ratings are more often fetched than old ones
        order: "desc" // desc order is needed for liberty ratings because of before assessment order
    });

    var routeIndex = routeInfo.routeIndex;
    var route      = routeInfo.route;

    // assessment not found
    if (routeIndex === -1) {
        return [];
    }

    // take all ratings from the route
    // in case of ratings are scattered between input and output assessments
    // and across bookings
    return this.getRouteRatings(route);
};

ItemJourney.prototype.isInputAssessment = function (step, assessmentId) {
    return step.inputAssessment && step.inputAssessment.id === assessmentId;
};

ItemJourney.prototype.isOutputAssessment = function (step, assessmentId) {
    return step.outputAssessment && step.outputAssessment.id === assessmentId;
};

ItemJourney.prototype.getRouteRatings = function (route) {
    var assessments = this.getAssessments(false, route);

    return _.reduce(assessments, (memo, assessment) => {
        var assessmentRatings = this.indexedAssessmentRatings[assessment.id] || [];
        memo = memo.concat(assessmentRatings);

        return memo;
    }, []);
};

ItemJourney.prototype.isItemSold = function () {
    var lastStep = this.getLastStep();

    if (! lastStep) {
        return false;
    } else {
        return !! (lastStep.booking && Booking.isPurchase(lastStep.booking));
    }
};

/**
 * get parent bookings
 * @param  {object} item
 * @param  {number} userId
 * @param  {object} args
 * @param  {string} args.refDate
 * @param  {number} args.discountPeriodInDays
 * @return {object} parentBookings
 * @return {object} parentBookings.renting  - booking (can be null)
 * @return {object} parentBookings.purchase - booking (can be null)
 */
ItemJourney.prototype.getParentBookings = function (item, userId, args) {
    var refDate              = args.refDate;
    var discountPeriodInDays = args.discountPeriodInDays;

    var parentBookings = {
        renting: null,
        purchase: null
    };

    if (item.soldDate
     || (! item.rentable && ! item.sellable)
    ) {
        return parentBookings;
    }

    // get the renting parent booking
    if (item.rentable) {
        var lastStep = this.getLastStep();

        // if the user is the last booker
        // and he still has the item
        if (lastStep
         && lastStep.booking.bookerId === userId
         && lastStep.inputAssessment && lastStep.inputAssessment.signedDate
         && (! lastStep.outputAssessment || ! lastStep.outputAssessment.signedDate)
        ) {
            parentBookings.renting = lastStep.booking;
        }
    }

    // get the purchase parent booking
    if (item.sellable) {
        var discountLimitDate = moment(refDate).subtract(discountPeriodInDays, "d").format("YYYY-MM-DD");

        // get the last booking that is from this user
        // and within the discount period
        var step = this.getSteps(step => {
            var booking = step.booking;

            var isWithinDiscountPeriod = (discountLimitDate <= booking.endDate);
            var isSameUser             = (booking.bookerId === userId);

            return isWithinDiscountPeriod && isSameUser;
        }, {
            onlyOne: true,
            order: "desc"
        });

        parentBookings.purchase = (step ? step.booking : null);
    }

    return parentBookings;
};

/**
 * get purchase mode ("rental-purchase" or "purchase")
 * @param  {object} user
 * @param  {string} refDate - format "YYYY-MM-DD"
 * @return {boolean|string} false if not available, purchase mode if so
 */
ItemJourney.prototype.getPurchaseMode = function (user, refDate) {
    var lastStep = this.getLastStep();

    if (! lastStep) {
        return "purchase";
    }

    var isFutureLastBooking = (refDate <= lastStep.booking.endDate);
    var isItemTaken = lastStep.inputAssessment && lastStep.inputAssessment.signedDate
        && (! lastStep.outputAssessment || ! lastStep.outputAssessment.signedDate);
    var isSamePersonAsLastBooker = (lastStep.booking.bookerId === user.id);

    if (isSamePersonAsLastBooker) {
        return (isItemTaken ? "rental-purchase" : "purchase");
    } else {
        if (isFutureLastBooking) {
            return false;
        } else {
            return "purchase";
        }
    }
};
