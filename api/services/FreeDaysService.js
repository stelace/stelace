/* global FreeDaysLog, User */

module.exports = {

    getFreeDaysForBooking: getFreeDaysForBooking,
    getFreeDaysUsedForBooking: getFreeDaysUsedForBooking,
    useFreeDaysForBooking: useFreeDaysForBooking,
    cancelUseFreeDays: cancelUseFreeDays

};

function getFreeDaysForBooking(user, booking) {
    return Promise.coroutine(function* () {
        return yield FreeDaysLog.find({
            userId: user.id,
            targetType: "booking",
            targetId: booking.id
        });
    })();
}

function getFreeDaysUsedForBooking(user, booking) {
    return Promise.coroutine(function* () {
        return yield FreeDaysLog.findOne({
            userId: user.id,
            targetType: "booking",
            targetId: booking.id,
            reasonType: "use"
        });
    })();
}

function useFreeDaysForBooking(user, booking) {
    return Promise.coroutine(function* () {
        return yield User.updateNbFreeDays(user, {
            delta: - booking.nbFreeDays,
            targetType: "booking",
            targetId: booking.id,
            reasonType: "use"
        });
    })();
}

function cancelUseFreeDays(user, freeDaysLog, nbFreeDays) {
    var nbUsedFreeDays = Math.abs(freeDaysLog.delta);

    var delta;
    if (typeof nbFreeDays !== "undefined") {
        delta = Math.min(nbFreeDays, nbUsedFreeDays);
    } else {
        delta = nbUsedFreeDays;
    }

    return Promise.coroutine(function* () {
        return yield User.updateNbFreeDays(user, {
            delta: delta,
            targetType: freeDaysLog.targetType,
            targetId: freeDaysLog.targetId,
            reasonType: "cancel" + (freeDaysLog.reasonType ? " " + freeDaysLog.reasonType : "")
        });
    })();
}
