/* global google */

(function () {

    angular
        .module("app.core")
        .factory("map", map);

    function map($http, $q, tools) {
        var providers = {};
        var selectedProvider = "google";
        var geocoder;

        var service = {};
        service.setProvider        = setProvider;
        service.geocode            = geocode;
        service.reverseGeocode     = reverseGeocode;
        service.getGooglePlaceData = getGooglePlaceData;
        service.getPlaceName       = getPlaceName;

        providers.google = {
            geocode: geocodeGoogle,
            reverseGeocode: reverseGeocodeGoogle
        };
        providers.nominatim = {
            geocode: geocodeNominatim,
            reverseGeocode: reverseGeocodeNominatim
        };

        return service;



        function _isGeocoderReady() {
            return $q.when(true)
                .then(function () {
                    if (geocoder) {
                        return true;
                    } else if (! geocoder
                        && window.google
                        && window.google.maps
                        && window.google.maps.Geocoder
                    ) {
                        geocoder = new google.maps.Geocoder();
                        return true;
                    } else {
                        return false;
                    }
                });
        }

        function setProvider(provider) {
            if (_.contains(_.keys(providers), provider)) {
                selectedProvider = provider;
            }
        }

        function geocode(query) {
            return providers[selectedProvider].geocode(query);
        }

        function reverseGeocode(gpsCoords) {
            return providers[selectedProvider].reverseGeocode(gpsCoords);
        }

        function getGooglePlaceData(place) {
            return $q(function (resolve /*, reject */) {
                var p = _extractGooglePlaceData(place);

                if (p.city
                    && p.department
                    && p.region
                    && p.country
                ) {
                    return resolve(p); // resolve does not end function. Need to return.
                }

                var params = {
                    latitude: p.latitude,
                    longitude: p.longitude
                };

                reverseGeocodeGoogle(params)
                    .then(function (reversed) {
                        if (! reversed) {
                            resolve(p);
                        } else {
                            p.postalCode = p.postalCode || reversed.postalCode;
                            p.region     = p.region || reversed.region;
                            p.department = p.department || reversed.department;
                            p.city       = p.city || reversed.city;
                            // p.streetNum  = p.streetNum || reversed.streetNum;
                            // p.street     = p.street || reversed.street;

                            resolve(p);
                        }
                    }).catch(function (/* err */) {
                        resolve(p);
                    });
            });
        }

        function _extractGooglePlaceData(place, geometryFunc) {
            geometryFunc = (typeof geometryFunc !== "undefined" ? geometryFunc : true);

            var p = {};

            p.name          = place.name;
            p.provider      = "google";
            p.remoteId      = place.place_id;
            p.establishment = !! _.find(place.types, function (type) {
                var typesAsEstablishment = [
                    "establishment",
                    "neighborhood",
                    "colloquial_area"
                ];

                return _.contains(typesAsEstablishment, type);
            });

            if (geometryFunc) {
                p.latitude      = tools.roundDecimal(place.geometry.location.lat(), 6);
                p.longitude     = tools.roundDecimal(place.geometry.location.lng(), 6);
            } else {
                p.latitude      = tools.roundDecimal(place.geometry.location.lat, 6);
                p.longitude     = tools.roundDecimal(place.geometry.location.lng, 6);
            }

            var associationKeys = {
                postalCode: "postal_code",
                country   : "country",
                region    : "administrative_area_level_1",
                department: "administrative_area_level_2",
                city      : "locality",
                street    : "route",
                streetNum : "street_number"
            };
            var countryISO;

            _.forEach(place.address_components, function (component) {
                _.forEach(associationKeys, function (googleKey, key) {
                    if (_.contains(component.types, googleKey)) {
                        p[key] = component.long_name;
                        if (key === 'country') {
                            countryISO = component.short_name;
                        }
                    }
                });
            });

            if (countryISO) {
                p.countryISO = countryISO;
            }

            if (! p.establishment) {
                p.name = getPlaceName(p);
            }

            return p;
        }

        ////////////
        // Google //
        ////////////

        // DEPRECATED. See Below
        // function geocodeGoogle(query) {
        //     var deferred = $q.defer();
        //     var urlQuery = "https://maps.googleapis.com/maps/api/geocode/json?components=country:FR&address=";
        //     var encodedQuery = encodeURI(query);

        //     var xhr = new XMLHttpRequest();
        //     xhr.open("GET", urlQuery + encodedQuery);
        //     xhr.responseType = "json";
        //     xhr.onload = function () {
        //         if (xhr.status !== 200) {
        //             deferred.reject(xhr.response);
        //             return;
        //         }

        //         var locations = xhr.response.results;

        //         if (locations.length) {
        //             var gpsCoords = locations[0].geometry.location;

        //             deferred.resolve({
        //                 latitude: tools.roundDecimal(gpsCoords.lat, 6),
        //                 longitude: tools.roundDecimal(gpsCoords.lng, 6)
        //             });
        //         } else {
        //             deferred.resolve();
        //         }
        //     };
        //     xhr.send();

        //     return deferred.promise;
        // }

        // function reverseGeocodeGoogle(gpsCoords) {
        //     var deferred = $q.defer();
        //     var urlQuery = "https://maps.googleapis.com/maps/api/geocode/json?sensor=false&latlng=";

        //     if (! gpsCoords
        //      || ! gpsCoords.latitude
        //      || ! gpsCoords.longitude
        //     ) {
        //         deferred.reject("gps coords expected");
        //     } else {
        //         var xhr = new XMLHttpRequest();
        //         xhr.open("GET", urlQuery + gpsCoords.latitude + "," + gpsCoords.longitude);
        //         xhr.responseType = "json";
        //         xhr.onload = function () {
        //             if (xhr.status !== 200) {
        //                 deferred.reject(xhr.response);
        //                 return;
        //             }

        //             var locations = xhr.response.results;

        //             if (locations.length) {
        //                 var location = locations[0];

        //                 deferred.resolve(_extractGooglePlaceData(location, false));
        //             } else {
        //                 deferred.resolve();
        //             }
        //         };
        //         toastr.info("sending xhr");
        //         xhr.send();
        //     }

        //     return deferred.promise;
        // }

        // New geocoding without xhr because cross-domain api calls via xhr fail with iOS and Safari
        // See http://stackoverflow.com/questions/2921745/how-to-make-cross-domain-ajax-calls-to-google-maps-api
        function geocodeGoogle(query) {
            return $q(function (resolve, reject) {
                _isGeocoderReady().then(function (ready) {
                    if (! ready) {
                        return reject("Google map SDK not available");
                    }

                    geocoder.geocode({ "address": query }, function (results, status) {
                        if (status === google.maps.GeocoderStatus.OK) {
                            resolve(_extractGooglePlaceData(results[0]));
                        } else {
                            reject("Geocoding failed: " + status);
                        }
                    });
                });
            });
        }

        function reverseGeocodeGoogle(gpsCoords) {
            return $q(function (resolve, reject) {
                if (! gpsCoords
                 || ! gpsCoords.latitude
                 || ! gpsCoords.longitude
                ) {
                    return reject("gps coords expected");
                }

                _isGeocoderReady().then(function (ready) {
                    if (! ready) {
                        return reject("Google map SDK not available");
                    }

                    var latlng = new google.maps.LatLng(gpsCoords.latitude, gpsCoords.longitude);
                    geocoder.geocode({ "latLng": latlng }, function (results, status) {
                        if (status === google.maps.GeocoderStatus.OK) {
                            resolve(_extractGooglePlaceData(results[0]));
                        } else {
                            reject("Geocoding failed: " + status);
                        }
                    });
                });
            });
        }

        ///////////////
        // Nominatim //
        ///////////////

        function geocodeNominatim(query) {
            var urlQuery = "https://nominatim.openstreetmap.org/search?format=json&q=";
            var encodedQuery = encodeURI(query);

            return $http.get(urlQuery + encodedQuery)
                .then(function (res) {
                    var locations = res.data;
                    var location = _.find(locations, function (location) {
                        return (/france/gi).test(location.display_name);
                    });

                    if (location && location.lat && location.lon) {
                        return {
                            latitude: tools.roundDecimal(parseFloat(location.lat), 6),
                            longitude: tools.roundDecimal(parseFloat(location.lon), 6)
                        };
                    } else {
                        return;
                    }
                });
        }

        function reverseGeocodeNominatim(gpsCoords) {
            var urlQuery = "https://nominatim.openstreetmap.org/reverse?format=json";

            if (! gpsCoords
             || ! gpsCoords.latitude
             || ! gpsCoords.longitude
            ) {
                return $q.reject("gps coords expected");
            }

            return $http.get(urlQuery + "&lat=" + gpsCoords.latitude + "&lon=" + gpsCoords.longitude)
                .then(function (res) {
                    if (res.data && res.data.address) {
                        var place = _extractNominatimPlaceData(res.data);
                        place.latitude  = gpsCoords.latitude;
                        place.longitude = gpsCoords.longitude;

                        return place;
                    } else {
                        return;
                    }
                });
        }

        function _extractNominatimPlaceData(place) {
            var p = {
                name: place.display_name,
                streetNum: place.address.house_number,
                street: place.address.road,
                postalCode: place.address.postcode,
                country: place.address.country,
                region: place.address.state,
                department: place.address.county,
                city: place.address.city,
                establishment: false,
                provider: "nominatim",
                remoteId: place.place_id
            };
            p.name = getPlaceName(p);

            return p;
        }

        function getPlaceName(place) {
            var name = "";
            var fallback = place.department || place.region;

            if (! place.city) {
                name = place.name || place.establishmentName || fallback;
            } else if (place.establishment) {
                name = place.establishmentName ? place.establishmentName  + ", " + place.city : place.name || fallback;
            } else {
                name = place.city;

                if (place.street) {
                    name = place.street + ", " + name;

                    if (place.streetNum) {
                        name = place.streetNum + " " + name;
                    }
                }
            }

            return name;
        }
    }

})();
