(function () {

    angular
        .module("app.data")
        .factory("LocationService", LocationService);

    function LocationService($q, $http, apiBaseUrl, Restangular, Location, cache, map, authentication, storage) {
        var isAuthed = false;
        var maxLocations = 4;

        var service = Restangular.all("location");
        service.getMine             = getMine;
        service.updateMainLocation  = updateMainLocation;
        service.add                 = add;
        service.remove              = remove;
        service.getMainLocation     = getMainLocation;
        service.getMaxLocations     = getMaxLocations;
        service.getShortName        = getShortName;
        service.getJourneysInfo     = getJourneysInfo;
        service.getGeoInfo          = getGeoInfo;

        Restangular.extendModel("location", function (obj) {
            return Location.mixInto(obj);
        });




        function getMine(clearCache) {
            var getNonAuthedLocations = function () {
                return $q(function (resolve, reject) {
                    if (clearCache) {
                        cache.set("tmpMyLocations", null);
                    }

                    if (cache.get("tmpMyLocations")) {
                        resolve(cache.get("tmpMyLocations"));
                    } else {
                        storage.getItem("tmpMyLocations")
                            .then(function (locations) {
                                cache.set("tmpMyLocations", locations || []);
                                resolve(cache.get("tmpMyLocations"));
                            })
                            .catch(function (err) {
                                reject(err);
                            });
                    }
                });
            };
            var getAuthedLocations = function () {
                return $q(function (resolve, reject) {
                    if (clearCache) {
                        cache.set("myLocations", null);
                    }

                    if (cache.get("myLocations")) {
                        resolve(cache.get("myLocations"));
                    } else {
                        service.customGETLIST("my")
                            .then(function (locations) {
                                _.forEach(locations, function (location) {
                                    location.displayAddress = map.getPlaceName(location);
                                    location.shortName      = getShortName(location);
                                });

                                cache.set("myLocations", locations);
                                _refreshIndexes();
                                resolve(cache.get("myLocations"));
                            })
                            .catch(function (err) {
                                reject(err);
                            });
                    }
                });
            };

            return authentication.isAuthenticated()
                .then(function (isAuthenticated) {
                    isAuthed = isAuthenticated;
                    if (isAuthenticated) {
                        return getAuthedLocations();
                    } else {
                        return getNonAuthedLocations();
                    }
                });
        }

        function updateMainLocation(id) {
            return service.customPUT({ id: id }, "main")
                .then(function () {
                    var locations = _getCachedLocations();

                    _.forEach(locations, function (location) {
                        if (location.id === id) {
                            location.main = true;
                        } else {
                            location.main = false;
                        }
                    });

                    var partition = _.partition(locations, function (location) {
                        return location.main;
                    });

                    // set the main location as the first one
                    cache.set("myLocations", partition[0].concat(partition[1]));
                    _refreshIndexes();
                });
        }

        function _getCachedLocations() {
            var prop = (isAuthed ? "myLocations" : "tmpMyLocations");
            return cache.get(prop) || [];
        }

        function _refreshIndexes() {
            var myLocations = _getCachedLocations();
            _.forEach(myLocations, function (location, index) {
                location.index = index + 1;
            });
        }

        function add(location) {
            var myLocations       = _getCachedLocations();
            var identicalLocation = _.find(myLocations, {
                remoteId: location.remoteId
            });

            if (identicalLocation) {
                return; // duplicate creation is also avoided server-side
            }

            myLocations.push(location);
            location.displayAddress = map.getPlaceName(location);
            location.shortName      = getShortName(location);
            if (! location.id) {
                location.id = _.uniqueId("location_");
            }
            _refreshIndexes();

            if (! isAuthed) {
                storage.setItem("tmpMyLocations", myLocations);
            }
        }

        function remove(location) {
            var myLocations = _getCachedLocations();
            var index = _.findIndex(myLocations, function (l) {
                return l.id === location.id;
            });
            if (index !== -1) {
                myLocations.splice(index, 1);
            }
            _refreshIndexes();

            if (! isAuthed) {
                storage.setItem("tmpMyLocations", myLocations);
            }
        }

        function getMainLocation(locations) {
            var mainLocation = _.find(locations, function (location) {
                return location.main;
            });

            if (mainLocation) {
                return mainLocation;
            } else {
                return locations[0];
            }
        }

        function getMaxLocations() {
            return maxLocations;
        }

        function getShortName(location) {
            var streetRegex = /(?:avenue|rue|boulevard|place)(?: du| de la| de| des)? (.*)/i;

            if (location.establishment) {
                return location.name;
            } else if (location.street) {
                return location.street.replace(streetRegex, "$1");
            } else {
                return location.city;
            }
        }

        function getJourneysInfo(from, to) {
            return service.customGET("journeys-info", {
                from: JSON.stringify(_.map(from, function (f) {
                    return _.pick(f, ["latitude", "longitude"]);
                })),
                to: JSON.stringify(_.map(to, function (t) {
                    return _.pick(t, ["latitude", "longitude"]);
                }))
            })
            .then(function (res) {
                return res.plain();
            });
        }

        // return empty response if the request takes too long
        function getGeoInfo(raceDuration) {
            return $q(function (resolve/*, reject */) {
                var raceFinished = false;

                var raceResolve = function (res) {
                    if (! raceFinished) {
                        resolve(res);
                        raceFinished = true;
                    }
                };

                if (typeof cache.get("geoInfo") !== "undefined") {
                    raceResolve(cache.get("geoInfo"));
                    return;
                }

                $http.get(apiBaseUrl + "/location/getGeoInfo")
                    .then(function (res) {
                        cache.set("geoInfo", res);
                        raceResolve(res);
                    })
                    .catch(function () {
                        cache.set("geoInfo", false);
                        raceResolve();
                    });

                setTimeout(function () {
                    raceResolve();
                }, raceDuration || 3000);
            });
        }

        return service;
    }

})();
