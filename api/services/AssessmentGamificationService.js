/* global Booking, GamificationService, User */

module.exports = {

    afterAssessmentSigned: afterAssessmentSigned

};

const _ = require('lodash');
const Promise = require('bluebird');

function afterAssessmentSigned(assessment, logger, req) {
    return Promise.coroutine(function* () {
        var data = yield getAfterAssessmentSignedData(assessment);

        var users        = data.users;
        var startBooking = data.startBooking;
        var endBooking   = data.endBooking;

        return yield Promise.map(users, user => {
            return Promise.coroutine(function* () {
                yield checkAssessmentActions(user, assessment, endBooking, logger, req);

                // if it's the input assessment and the user is owner or taker
                // then check friend actions as referer
                if (startBooking
                 && _.contains([assessment.ownerId, assessment.takerId], user.id)
                ) {
                    yield checkRefererActions(user, startBooking, logger, req);
                }
            })();
        });
    })()
    .catch(err => {
        logger.warn({ err: err }, "Gamification assessment sign fail");
    });
}

function getAfterAssessmentSignedData(assessment) {
    return Promise.coroutine(function* () {
        var usersIds = _.uniq(_.compact([
            assessment.ownerId,
            assessment.takerId,
        ]));

        var result = yield Promise.props({
            users: User.find({ id: usersIds }),
            startBooking: assessment.startBookingId ? Booking.findOne({ id: assessment.startBookingId }) : null,
            endBooking: assessment.endBookingId ? Booking.findOne({ id: assessment.endBookingId }) : null
        });

        var users        = result.users;
        var owner        = _.find(users, { id: assessment.ownerId });
        var taker        = _.find(users, { id: assessment.takerId });
        var startBooking = result.startBooking;
        var endBooking   = result.endBooking;

        var errorData = {};
        if (assessment.ownerId && ! owner) {
            errorData.ownerId = assessment.ownerId;
        }
        if (assessment.takerId && ! taker) {
            errorData.takerId = assessment.takerId;
        }
        if (assessment.startBookingId && ! startBooking) {
            errorData.startBookingId = assessment.startBookingId;
        }
        if (assessment.endBookingId && ! endBooking) {
            errorData.endBookingId = assessment.endBookingId;
        }

        if (! _.isEmpty(errorData)) {
            var error = new Error("Missing references");
            _.forEach(errorData, (value, key) => {
                error[key] = value;
            });
            throw error;
        }

        return {
            users: users,
            startBooking: startBooking,
            endBooking: endBooking
        };
    })();
}

function checkAssessmentActions(user, assessment, endBooking, logger, req) {
    return Promise.coroutine(function* () {
        var actionsIds  = [];
        var actionsData = {};

        if (endBooking) {
            actionsIds = actionsIds.concat([
                "FIRST_COMPLETE_BOOKING",
                "COMPLETE_BOOKING"
            ]);

            _.assign(actionsData, {
                FIRST_COMPLETE_BOOKING: { booking: endBooking },
                COMPLETE_BOOKING: { booking: endBooking }
            });
        }

        yield GamificationService.checkActions(user, actionsIds, actionsData, logger, req);
    })()
    .catch(err => {
        logger.warn({ err: err }, "Gamification assessment sign fail: assessment actions");
    });
}

function checkRefererActions(user, booking, logger, req) {
    return Promise.coroutine(function* () {
        var refererInfo = yield User.getRefererInfo(user);

        if (! refererInfo) {
            return;
        }

        var link    = refererInfo.link;
        var referer = refererInfo.referer;

        var actionsIds  = [
            "FRIEND_BOOKING_AS_REFERER",
            "FRIEND_RENTING_OUT_AS_REFERER"
        ];
        var actionsData = {
            FRIEND_BOOKING_AS_REFERER: {
                link: link,
                booking: booking
            },
            FRIEND_RENTING_OUT_AS_REFERER: {
                link: link,
                booking: booking
            }
        };

        return yield GamificationService.checkActions(referer, actionsIds, actionsData, logger, req);
    })()
    .catch(err => {
        logger.warn({ err: err }, "Gamification assessment sign fail: referer actions");
    });
}
