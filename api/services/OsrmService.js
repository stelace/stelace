module.exports = {

    route: route,
    nearest: nearest,
    locate: locate,
    table: table

};

var request = require('request');
var geolib  = require('geolib');

Promise.promisifyAll(request, { multiArgs: true });

var osrmUrl  = sails.config.osrmUrl;
var osrmPort = sails.config.osrmPort || 5000;
var osrmMock = sails.config.osrmMock;

var doRequest = function (path) {
    return request
        .getAsync({
            url: "http://" + osrmUrl + ":" + osrmPort + path,
            json: true
        })
        .spread(function (response, body) {
            if (response.statusCode !== 200) {
                throw body;
            }

            return body;
        });
};

var isValidGpsPt = function (gpsPt) {
    return typeof gpsPt === "object"
        && typeof gpsPt.latitude === "number"
        && typeof gpsPt.longitude === "number"
    ;
};

function route(gpsPts) {
    var error;

    return Promise
        .resolve()
        .then(function () {
            if (! _.isArray(gpsPts)) {
                error = new Error("gps points expected");
                throw error;
            }
            var validGpsPts = _.reduce(gpsPts, function (memo, gpsPt) {
                if (isValidGpsPt(gpsPt)) {
                    return memo;
                } else {
                    return memo && false;
                }
            }, true);

            if (! validGpsPts) {
                error = new Error("gps points expected");
                throw error;
            }
            if (gpsPts.length !== 2) {
                error = new Error("2 gps points expected");
                throw error;
            }

            var path = "/viaroute?";

            _.each(gpsPts, function (gpsPt, index) {
                if (index !== 0) {
                    path += "&";
                }
                path += "loc=" + gpsPt.latitude + "," + gpsPt.longitude;
            });

            var nbHints = _.reduce(gpsPts, function (memo, gpsPt) {
                if (typeof gpsPt.hint === "string") {
                    ++memo;
                }

                return memo;
            }, 0);

            if (gpsPts.length === nbHints) {
                _.each(gpsPts, function (gpsPt) {
                    path += "&hints=" + gpsPt.hint;
                });
            }

            return doRequest(path)
                .then(function (result) {
                    return {
                        hints: result.hint_data.locations,
                        duration: result.route_summary.total_time,
                        distance: result.route_summary.total_distance
                    };
                });
        });
}

function nearest(gpsPt) {
    var error;

    return Promise
        .resolve()
        .then(function () {
            if (! isValidGpsPt(gpsPt)) {
                error = new Error("gps points expected");
                throw error;
            }

            var path = "/nearest?loc=" + gpsPt.latitude + "," + gpsPt.longitude;

            return doRequest(path)
                .then(function (result) {
                    if (result.status !== 0) {
                        throw result;
                    }

                    return {
                        latitude: result.mapped_coordinate[0],
                        longitude: result.mapped_coordinate[1]
                    };
                });
        });
}

function locate(gpsPt) {
    var error;

    return Promise
        .resolve()
        .then(function () {
            if (! isValidGpsPt(gpsPt)) {
                error = new Error("gps points expected");
                throw error;
            }

            var path = "/locate?loc=" + gpsPt.latitude + "," + gpsPt.longitude;

            return doRequest(path)
                .then(function (result) {
                    if (result.status !== 0) {
                        throw result;
                    }

                    return {
                        latitude: result.mapped_coordinate[0],
                        longitude: result.mapped_coordinate[1]
                    };
                });
        });
}

function table(gpsPts) {
    var error;

    return Promise
        .resolve()
        .then(function () {
            if (! _.isArray(gpsPts)) {
                error = new Error("gps points expected");
                throw error;
            }
            var validGpsPts = _.reduce(gpsPts, function (memo, gpsPt) {
                if (isValidGpsPt(gpsPt)) {
                    return memo;
                } else {
                    return memo && false;
                }
            }, true);

            if (! validGpsPts) {
                error = new Error("gps points expected");
                throw error;
            }
            if (gpsPts.length < 2) {
                error = new Error("2 or more gps points expected");
                throw error;
            }

            if (osrmMock) {
                return _tableMock(gpsPts);
            } else {
                return _table(gpsPts);
            }
        });
}

async function _table(gpsPts) {
    var path = "/table?";

    _.each(gpsPts, function (gpsPt, index) {
        if (index !== 0) {
            path += "&";
        }
        path += "loc=" + gpsPt.latitude + "," + gpsPt.longitude;
    });

    var nbHints = _.reduce(gpsPts, function (memo, gpsPt) {
        if (typeof gpsPt.hint === "string") {
            ++memo;
        }

        return memo;
    }, 0);

    if (gpsPts.length === nbHints) {
        _.each(gpsPts, function (gpsPt) {
            path += "&hints=" + gpsPt.hint;
        });
    }

    const result = await doRequest(path);
    return result.distance_table;
}

function _tableMock(gpsPts) {
    const l = gpsPts.length;
    const table = [];

    for (let i = 0; i < l; i++) {
        const line = [];

        for (let j = 0; j < l; j++) {
            const from = gpsPts[i];
            const to   = gpsPts[j];

            if (i === j) {
                line.push(0);
            } else {
                const distanceInMeters = geolib.getDistance(from, to);
                const seconds = convertMetersToSeconds(distanceInMeters);
                const duration = Math.round(seconds * 10); // osrm duration is expressed in one-tenth of a second
                line.push(duration);
            }
        }

        table.push(line);
    }

    return table;
}

function convertMetersToSeconds(meters) {
    const metersPerSeconds = 60 * 1000 / 3600; // 60 km/h
    return meters / metersPerSeconds;
}
