/* global GamificationService, User */

module.exports = {

    afterBookingPaidAndValidated: afterBookingPaidAndValidated

};

function afterBookingPaidAndValidated(booking, logger, req) {
    return Promise.coroutine(function* () {
        var users = yield getAfterBookingPaidAndValidatedData(booking);

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
            } else if (booking.bookerId === user.id) {
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
        logger.warn({ err: err }, "Gamification booking paid and validated fail");
    });
}

function getAfterBookingPaidAndValidatedData(booking) {
    return Promise.coroutine(function* () {
        var usersIds = [booking.ownerId, booking.bookerId];
        var users = yield User.find({ id: usersIds });

        var owner  = _.find(users, { id: booking.ownerId });
        var booker = _.find(users, { id: booking.bookerId });

        var errorData = {};
        if (! owner) {
            errorData.ownerId = booking.ownerId;
        }
        if (! booker) {
            errorData.bookerId = booking.bookerId;
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
