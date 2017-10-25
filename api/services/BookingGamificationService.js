/* global GamificationService, User */

module.exports = {

    afterBookingPaidAndAccepted: afterBookingPaidAndAccepted

};

function afterBookingPaidAndAccepted(booking, logger, req) {
    return Promise.coroutine(function* () {
        var users = yield getAfterBookingPaidAndAcceptedData(booking);

        return Promise.map(users, user => {
            var actionsIds  = [];
            var actionsData = {};

            if (booking.ownerId === user.id) {
                actionsIds = [
                    "FIRST_RENTING_OUT",
                ];
                actionsData = {
                    FIRST_RENTING_OUT: { booking: booking },
                };
            } else if (booking.takerId === user.id) {
                actionsIds = [
                    "FIRST_BOOKING",
                ];
                actionsData = {
                    FIRST_BOOKING: { booking: booking }
                };
            }

            return GamificationService.checkActions(user, actionsIds, actionsData, logger, req);
        });
    })()
    .catch(err => {
        logger.warn({ err: err }, "Gamification booking paid and accepted fail");
    });
}

function getAfterBookingPaidAndAcceptedData(booking) {
    return Promise.coroutine(function* () {
        var usersIds = [booking.ownerId, booking.takerId];
        var users = yield User.find({ id: usersIds });

        var owner  = _.find(users, { id: booking.ownerId });
        var taker  = _.find(users, { id: booking.takerId });

        var errorData = {};
        if (! owner) {
            errorData.ownerId = booking.ownerId;
        }
        if (! taker) {
            errorData.takerId = booking.takerId;
        }

        if (! _.isEmpty(errorData)) {
            var error = new Error("Missing references");
            _.forEach(errorData, (value, key) => {
                error[key] = value;
            });
            throw error;
        }

        return users;
    })();
}
