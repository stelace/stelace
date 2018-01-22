/* global global */

var should = require('should'); // jshint ignore:line

const _ = require('lodash');

global.sails = {
    config: {
        osrmUrl: "localhost"
    }
};
global.OsrmService = require('../../../api/services/OsrmService');

var MapService = require('../../../api/services/MapService');

xdescribe("MapService", function () {

    describe("#geoCode()", function () {
        it("should geocode", function (done) {
            var location = {
                street: "4 Boulevard Saint-Michel",
                postalCode: "75005",
                city: "Paris"
            };

            return MapService
                .geoCode(location)
                .then(gps => {
                    gps[0].should.have.property("latitude");
                    gps[0].should.have.property("longitude");
                    done();
                })
                .catch(err => done(err));
        });
    });

    describe("#reverseGeoCode()", function () {
        it("should reverse geocode", function (done) {
            var gpsCoords = {
                latitude: 48.853062,
                longitude: 2.343969
            };

            return MapService
                .reverseGeoCode(gpsCoords)
                .then(location => {
                    location[0].should.have.property("streetNumber");
                    location[0].should.have.property("streetName");
                    location[0].should.have.property("zipcode");
                    location[0].should.have.property("city");
                    location[0].should.have.property("country");
                    done();
                })
                .catch(err => done(err));
        });
    });

    describe("#getOsrmMinDuration()", function () {
        it("should get osrm min duration", function (done) {
            var fromGpsPts = [
                {
                    name: "Paris",
                    latitude: 48.862714,
                    longitude: 2.333674
                },
                {
                    name: "Rouen",
                    latitude: 49.432667,
                    longitude: 1.107325
                },
                {
                    name: "Rennes",
                    latitude: 48.097905,
                    longitude: -1.616972
                },
                {
                    name: "Grenoble",
                    latitude: 45.193677,
                    longitude: 5.789052
                }
            ];
            var toGpsPts = [
                {
                    name: "Bordeaux",
                    latitude: 44.836421,
                    longitude: -0.506114
                },
                {
                    name: "Montpelliers",
                    latitude: 43.592354,
                    longitude: 3.932362
                },
                {
                    name: "Marseille",
                    latitude: 43.273233,
                    longitude: 5.437489
                },
                {
                    name: "Nice",
                    latitude: 43.671871,
                    longitude: 7.228260
                }
            ];

            return MapService
                .getOsrmMinDuration(fromGpsPts, toGpsPts, false)
                .then(minDurations => {
                    minDurations[0].toIndex.should.equal(0);
                    minDurations[1].toIndex.should.equal(0);
                    minDurations[2].toIndex.should.equal(0);
                    minDurations[3].toIndex.should.equal(1);
                    done();
                })
                .catch(err => done(err));
        });
    });

    describe("#getOsrmJourneys()", function () {
        it("should get osrm journeys", function (done) {
            var fromGpsPts = [
                {
                    name: "Paris",
                    latitude: 48.862714,
                    longitude: 2.333674
                },
                {
                    name: "Rouen",
                    latitude: 49.432667,
                    longitude: 1.107325
                },
                {
                    name: "Rennes",
                    latitude: 48.097905,
                    longitude: -1.616972
                },
                {
                    name: "Grenoble",
                    latitude: 45.193677,
                    longitude: 5.789052
                }
            ];
            var toGpsPts = [
                {
                    name: "Bordeaux",
                    latitude: 44.836421,
                    longitude: -0.506114
                },
                {
                    name: "Montpelliers",
                    latitude: 43.592354,
                    longitude: 3.932362
                },
                {
                    name: "Marseille",
                    latitude: 43.273233,
                    longitude: 5.437489
                },
                {
                    name: "Nice",
                    latitude: 43.671871,
                    longitude: 7.228260
                }
            ];

            return MapService
                .getOsrmJourneys({
                    fromGpsPts: fromGpsPts,
                    toGpsPts: toGpsPts
                })
                .then(durations => {
                    should(durations.length).equal(16);
                    _.forEach(durations, function (duration) {
                        should(duration).have.property("fromIndex");
                        should(duration).have.property("toIndex");
                        should(duration).have.property("durationSeconds");
                    });
                    done();
                })
                .catch(err => done(err));
        });
    });

});

