/* global OsrmService */

module.exports = {

    getOsrmJourneys: getOsrmJourneys,
    sortUniqueOsrmJourneys: sortUniqueOsrmJourneys,

    isValidGpsPt: isValidGpsPt,
    isValidGpsPts: isValidGpsPts

};

var request      = require('request');
var NodeCache    = require('node-cache');
const _ = require('lodash');
const Promise = require('bluebird');

Promise.promisifyAll(request, { multiArgs: true });

var OsrmJourneysCache = new NodeCache({ stdTTL: 24 * 60 * 60 }); // 1 day

// example output:
// [ { fromIndex: 0, toIndex: 0, durationSeconds: 22014 },
// { fromIndex: 0, toIndex: 1, durationSeconds: 13926 },
// { fromIndex: 1, toIndex: 0, durationSeconds: 17364 },
// { fromIndex: 1, toIndex: 1, durationSeconds: 21710 } ]
function getOsrmJourneys(fromGpsPts, toGpsPts) {
    return Promise.coroutine(function* () {
        if (! isValidGpsPts(fromGpsPts) || ! isValidGpsPts(toGpsPts)) {
            var error = new Error("Array of gps points expected");
            throw error;
        }

        var cached = getCachedOsrmMatrixJourneys(fromGpsPts, toGpsPts);
        var matrix         = cached.matrix;
        var newFromGpsPts  = cached.newFromGpsPts;
        var newToGpsPts    = cached.newToGpsPts;
        var newFromIndexes = cached.newFromIndexes;
        var newToIndexes   = cached.newToIndexes;

        var table;

        if (newFromGpsPts.length) {
            table = yield OsrmService.table(newFromGpsPts.concat(newToGpsPts));
        }

        var journeys = [];
        var nbFromGpsPts = fromGpsPts.length;
        var durationSeconds;

        _.forEach(fromGpsPts, (fromGpsPt, i) => {
            _.forEach(toGpsPts, (toGpsPt, j) => {
                durationSeconds = matrix[i][j]; // if defined, this is a cached value

                if (typeof durationSeconds === "undefined") {
                    durationSeconds = convertOsrmValueToDurationSeconds(table[newFromIndexes[i]][nbFromGpsPts + newToIndexes[j]]);
                }

                journeys.push({
                    fromIndex: i,
                    toIndex: j,
                    durationSeconds: durationSeconds
                });

                // set or renew cache
                setOsrmJourneysCache(fromGpsPt, toGpsPt, durationSeconds);
            });
        });

        return journeys;
    })();
}

function convertOsrmValueToDurationSeconds(value) {
    return Math.round(value / 10);
}

function getOsrmJourneysCache(fromGpsPt, toGpsPt) {
    return OsrmJourneysCache.get(getOsrmJourneyCacheKey(fromGpsPt, toGpsPt));
}

function setOsrmJourneysCache(fromGpsPt, toGpsPt, value) {
    OsrmJourneysCache.set(getOsrmJourneyCacheKey(fromGpsPt, toGpsPt), value);
}

function getCachedOsrmMatrixJourneys(fromGpsPts, toGpsPts) {
    var matrix = [];

    var newFromIndexes = {};
    var newToIndexes   = {};
    var fromIndexDelta = 0;
    var toIndexDelta   = 0;

    var durationSeconds;
    var row;

    _.forEach(fromGpsPts, (fromGpsPt, i) => {
        row = [];

        _.forEach(toGpsPts, (toGpsPt, j) => {
            durationSeconds = getOsrmJourneysCache(fromGpsPt, toGpsPt);
            row.push(durationSeconds);

            // if no cache, determine indexes that should be included in the table computation
            if (typeof durationSeconds === "undefined") {
                newFromIndexes[i] = true;
                newToIndexes[j]   = true;
            }
        });

        matrix.push(row);
    });

    // there is an index delta if there are cached values
    var newFromGpsPts = _.reduce(fromGpsPts, (memo, gpsPt, index) => {
        if (newFromIndexes[index]) {
            memo.push(gpsPt);
            newFromIndexes[index] = index + fromIndexDelta;
        } else {
            --fromIndexDelta;
        }
        return memo;
    }, []);

    var newToGpsPts = _.reduce(toGpsPts, (memo, gpsPt, index) => {
        if (newToIndexes[index]) {
            memo.push(gpsPt);
            newToIndexes[index] = index + toIndexDelta;
        } else {
            --toIndexDelta;
        }
        return memo;
    }, []);

    return {
        matrix: matrix,
        newFromGpsPts: newFromGpsPts,
        newToGpsPts: newToGpsPts,
        newFromIndexes: newFromIndexes,
        newToIndexes: newToIndexes
    };
}

function sortUniqueOsrmJourneys(journeys, field, byOrder) {
    if (! _.contains(["from", "to"], field)
     || ! _.contains(["minDuration", "maxDuration"], byOrder)
    ) {
        throw new Error("Bad params");
    }

    var multiplier = (byOrder === "minDuration" ? 1 : -1);
    var newJourneys = _.sortBy(journeys, journey => {
        return multiplier * journey.durationSeconds;
    });

    var indexes = {};
    var key = (field === "from" ? "fromIndex" : "toIndex");

    return _.reduce(newJourneys, (memo, journey) => {
        var index = journey[key];
        if (! indexes[index]) {
            memo.push(journey);
            indexes[index] = true;
        }
        return memo;
    }, []);
}

function getOsrmJourneyCacheKey(fromGpsPt, toGpsPt) {
    return fromGpsPt.latitude
        + "," + fromGpsPt.longitude
        + ">" + toGpsPt.latitude
        + "," + toGpsPt.longitude;
}

function isValidGpsPt(entry) {
    return ! isNaN(entry.latitude) && ! isNaN(entry.longitude);
}

function isValidGpsPts(entries) {
    if (! _.isArray(entries)) {
        return false;
    }

    return _.reduce(entries, function (memo, entry) {
        if (! isValidGpsPt(entry)) {
            memo = memo && false;
        }
        return memo;
    }, true);
}
