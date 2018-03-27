/* global TimeService */

module.exports = {
    isValidPeriodDates,
    getDayAfter,
    getDateCount,
};

const moment = require('moment');
const _ = require('lodash');

const defaultMaxPeriodDuration = 366 * 2; // 2 years

function isValidPeriodDates(startDate, endDate, maxDuration = defaultMaxPeriodDuration) {
    return startDate && TimeService.isDateString(startDate, { onlyDate: true })
     && endDate && TimeService.isDateString(endDate, { onlyDate: true })
     && startDate < endDate
     && moment(endDate).diff(startDate, 'd') <= maxDuration;
}

function getDayAfter(date) {
    return moment(date).add({ d: 1 }).format('YYYY-MM-DD');
}

function getDateCount(dates, { startDate, endDate, total }) {
    if (!startDate || !TimeService.isDateString(startDate, { onlyDate: true })
     || !endDate || !TimeService.isDateString(endDate, { onlyDate: true })
     || endDate <= startDate
    ) {
        throw new Error('Expected correct dates');
    }

    const hash = {};

    _.forEach(dates, date => {
        const key = moment(date).format('YYYY-MM-DD');
        hash[key] = hash[key] || 0;
        hash[key] += 1;
    });

    let currentDate = startDate;
    let stopDate = endDate;

    let arrayDates = [];

    while (currentDate <= stopDate) {
        if (hash[currentDate]) {
            arrayDates.push({
                date: currentDate,
                count: hash[currentDate],
            });
        } else {
            arrayDates.push({
                date: currentDate,
                count: 0,
            });
        }

        currentDate = moment(currentDate).add({ d: 1 }).format('YYYY-MM-DD');
    }

    if (_.isNumber(total)) {
        let sum = total;

        arrayDates = arrayDates.map(obj => {
            sum += obj.count;
            return Object.assign({}, obj, { aggregate: sum });
        });
    }

    return arrayDates;
}
