module.exports = {

    isDate: isDate,
    isDateString: isDateString,
    isPureDate: isPureDate,
    isIntersection: isIntersection,
    getPeriodLimits: getPeriodLimits,
    convertTimestampSecToISO: convertTimestampSecToISO,
    getMonthWeekDays: getMonthWeekDays

};

var moment = require('moment');
const _ = require('lodash');

/**
 * Check if the provided date is an instance of Date and a valid date
 * @param  {Date}  date
 * @return {Boolean}
 */
function isDate(date) {
    return typeof date === 'object' && date.getTime && !isNaN(date.getTime());
}

/**
 * Check if the provided value is UTC-format date string
 * @param  {String}  value
 * @param  {Object}  [options]
 * @param  {Boolean} [options.onlyDate = false]
 * @return {Boolean}
 */
function isDateString(value, { onlyDate = false } = {}) {
    if (typeof value !== 'string') return false;

    let regex;

    if (onlyDate) {
        regex = /^\d{4}-\d{2}-\d{2}$/;
    } else {
        regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
    }

    if (!regex.test(value)) return false;

    const date = new Date(value);
    return isDate(date);
}

/**
 * Check if the date has 0 unit below days (0 hour, 0 minute, 0 second, 0 millisecond)
 * If true, that means the date is probably an automated date (not created by user)
 * @param  {String|Object}  date
 * @return {Boolean}
 */
function isPureDate(date) {
    if (!isDateString(date) && !isDate(date)) {
        throw new Error('Expected a valid date');
    }

    const m = moment(date);

    return m.hours() === 0
        && m.minutes() === 0
        && m.seconds() === 0
        && m.milliseconds() === 0;
}

function isIntersection(array, value) {
    return _.reduce(array, function (memo, element) {
        if (value.endDate <= element.startDate || element.endDate <= value.startDate) {
            return memo;
        } else {
            return memo || true;
        }
    }, false);
}

/**
 * get period limits
 * @param  {string} date
 * @param  {object} duration    moment duration object
 * @param  {string} [type]      define the period behavior
 * @return {object}
 */
function getPeriodLimits(date, duration, type) {
    var min;
    var max;

    if (type === "before") {
        min = moment(date).subtract(duration).toISOString();
        max = date;
    } else if (type === "after") {
        min = date;
        max = moment(date).add(duration).toISOString();
    } else { // type === "center"
        var halfDuration = _.reduce(duration, (memo, value, key) => {
            memo[key] = value / 2;
            return memo;
        }, {});

        min = moment(date).subtract(halfDuration).toISOString();
        max = moment(date).add(halfDuration).toISOString();
    }

    return {
        min: min,
        max: max
    };
}

function convertTimestampSecToISO(timestampSec) {
    return moment(new Date(parseInt(timestampSec + '000', 10))).toISOString();
}

function getMonthWeekDays(weekDayNum, year, month) {
    var formatDate = "YYYY-MM-DD";

    var date      = moment().year(year).month(month - 1).startOf("month");
    var limitDate = moment(date).add(1, "M").format(formatDate);

    date.isoWeekday(weekDayNum);

    var weekDays = [];
    var dateStr = date.format(formatDate);

    while (dateStr < limitDate) {
        if (date.month() + 1 === month) {
            weekDays.push(dateStr);
        }
        date.add(7, "d");
        dateStr = date.format(formatDate);
    }

    return weekDays;
}
