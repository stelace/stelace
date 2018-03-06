/* global fbq, google */

(function () {

    angular
        .module("app.listings")
        .controller("ListingSearchController", ListingSearchController);

    function ListingSearchController($document,
                                    $location,
                                    $q,
                                    $rootScope,
                                    $scope,
                                    $timeout,
                                    $state,
                                    $stateParams,
                                    $window,
                                    authentication,
                                    // BrandService,
                                    cache,
                                    diacritics,
                                    GoogleMap,
                                    ListingCategoryService,
                                    ListingService,
                                    ListingTypeService,
                                    LocationService,
                                    map,
                                    platform,
                                    StelaceConfig,
                                    StelaceEvent,
                                    time,
                                    toastr,
                                    tools,
                                    uiGmapGoogleMapApi,
                                    UserService,
                                    usSpinnerService) {
        var listeners = [];

        var noTriggerSearch = {};
        var firstTime       = true;
        var wdw             = angular.element($window);
        var mapContainer    = $document[0].getElementById("map-container");
        var searchContent   = $document[0].getElementById("search-content");
        var nbDaysPricing   = 7;
        var mqSmall         = $window.matchMedia("(max-width: 639px)");
        var mqSMedium       = $window.matchMedia("(min-width: 768px)");
        var mqDesktop       = $window.matchMedia("(min-width: 1024px)");
        var mqXLarge        = $window.matchMedia("(min-width: 1440px)");

        var searchTimestamp;
        var urlParams;
        var urlLocationName;
        var urlLocation;
        var previousQueryLocation;
        var googleMap;
        var mapCenteringTimeout;
        var searchQueryLocation;
        var previousSearchLocationInput;
        var currentUser;
        var listingCategories;
        var myLocations;
        var ipLocation;
        var stopSpinnerTimeout;
        var defaultQueryMode = "default";
        var spinnerTimeout;
        // var mapCenter;

        var vm = this;
        vm.showMap               = StelaceConfig.isFeatureActive('MAP');
        vm.searched              = false;
        vm.searchQuery           = {};
        vm.listings                 = [];
        vm.showAddLocationButton = false;
        vm.backgroundOverlay     = true;
        // vm.showSearchButton      = false;
        vm.isGoogleMapSDKReady   = cache.get("isGoogleMapSDKReady") || false;
        vm.isSmall               = mqSmall.matches;
        vm.isSMedium             = mqSMedium.matches;
        vm.isDesktop             = mqDesktop.matches;
        vm.isXLarge              = mqXLarge.matches;
        vm.loadMap               = mqSMedium.matches; // spare map bindings and tiles on mobile
        vm.fixedLocationSearch   = vm.isSMedium;
        vm.isPhantom             = tools.isPhantomBot();

        vm.searchFiltersConfig     = {};

        vm.showPagination = false;
        vm.nbTotalListings   = 0;
        vm.currentPage    = 1;
        vm.nbListingsPerPage = 23; // Multiple of 2, 3 & 4 (listing columns) minus 1 to keep space for dummy listing-card cta
        vm.paginationLinks = {
            first: "◀◀",
            previous: "◀",
            next: "▶",
            last: "▶▶"
        };

        // Google Places ngAutocomplete options
        vm.ngAutocompleteOptions = {
            country: 'fr',
            watchEnter: true
        };

        vm.search              = search;
        vm.addLocation         = addLocation;
        vm.removeTmpLocation   = removeTmpLocation;
        vm.resetSearchLocation = resetSearchLocation;
        vm.toggleLocation      = toggleLocation;
        vm.markerHighlight     = markerHighlight;
        vm.markerStill         = markerStill;
        vm.toggleDetailBox     = toggleDetailBox;
        vm.pageChange          = pageChange;
        vm.uxEvent             = uxEvent;

        activate();

        function activate() {
            urlParams = getUrlParams();

            platform.debugDev("url params", urlParams);

            if (urlParams.page) {
                vm.currentPage = urlParams.page;
            }
            if (urlParams.location) {
                urlLocationName = urlParams.location;
            }
            if (urlParams.query) {
                if (urlParams.fullQuery) {
                    $rootScope.searchParams.query = urlParams.fullQuery;
                } else {
                    $rootScope.searchParams.query = urlParams.query;
                }
            }
            if (urlParams.queryMode) {
                $rootScope.searchParams.queryMode = urlParams.queryMode;
            }
            if (urlParams.listingTypeId) {
                $rootScope.searchParams.listingTypeId = urlParams.listingTypeId;
            }

            // vm.onlyFree = urlParams.onlyFree;

            $rootScope.searchParams.queryMode = $rootScope.searchParams.queryMode || defaultQueryMode;

            // when the locations toggles change
            // $scope.$watch("vm.searchQuery.myLocations", _.debounce(function () {
            //     if (noTriggerSearch.myLocations) {
            //         noTriggerSearch.myLocations = false;
            //         return;
            //     }

            //     search();
            // }, 1000), true);

            // when the query location changes
            $scope.$watch("vm.searchQuery.location", function () {
                if (noTriggerSearch.location) {
                    noTriggerSearch.location = false;
                    return;
                }

                search();
            });

            // when the free option changes
            // $scope.$watch("vm.onlyFree", function () {
            //     if (noTriggerSearch.onlyFree) {
            //         noTriggerSearch.onlyFree = false;
            //         return;
            //     }

            //     search();
            // });

            // when the query change
            // $scope.$watch("vm.searchQuery.query", _.debounce(function () {
            //     if (noTriggerSearch.query) {
            //         noTriggerSearch.query = false;
            //         return;
            //     }

            //     vm.currentPage = 1;
            //     search();
            // }, 1000));

            listeners.push(
                $rootScope.$on("triggerSearch", function (event, params) {
                    params = params || {};

                    if (params.newQuery) {
                        vm.currentPage = 1;
                    }

                    search();
                })
            );

            // update fitMap on window resizing
            var _debouncedFitMap = _.debounce(function () {
                // Don't destroy map once loaded
                if (! vm.loadMap) {
                    vm.loadMap = mqSMedium.matches;
                }

                mapCenteringTimeout = $timeout(function () {
                    _fitMap();
                }, 1000);
            }, 500);

            var _fixedLocationSearch = _.throttle(function () {
                vm.fixedLocationSearch = mqSMedium.matches;
            }, 500);

            wdw.on("resize", _updateLayoutMediaQueries);
            wdw.on("resize", _debouncedFitMap);
            wdw.on("resize", _fixedLocationSearch);

            $scope.$on("$destroy", function () {
                $timeout.cancel(mapCenteringTimeout);
                $timeout.cancel(spinnerTimeout);
                $timeout.cancel(stopSpinnerTimeout);

                wdw.off("resize", _updateLayoutMediaQueries);
                wdw.off("resize", _debouncedFitMap);
                wdw.off("resize", _fixedLocationSearch);

                mapContainer  = null;
                searchContent = null;

                mqSmall   = null;
                mqSMedium = null;
                mqDesktop = null;
                mqXLarge  = null;

                _.forEach(listeners, function (listener) {
                    listener();
                });
            });

            // noTriggerSearch.myLocations = true;
            noTriggerSearch.location    = true;
            // noTriggerSearch.onlyFree    = true;
            // noTriggerSearch.query       = true;

            return $q.all({
                currentUser: UserService.getCurrentUser(),
                listingCategories: ListingCategoryService.cleanGetList(),
                myLocations: $rootScope.myLocations || LocationService.getMine(),
                urlLocation: _getLocationFromURL(urlLocationName),
                ipLocation: $rootScope.ipLocation || LocationService.getGeoInfo(),
                listingTypes: ListingTypeService.cleanGetList()
            }).then(function (results) {
                currentUser    = tools.clearRestangular(results.currentUser);
                listingCategories = results.listingCategories;
                myLocations    = results.myLocations;
                vm.listingTypes = results.listingTypes;

                vm.isAuthed = !! currentUser;
                // only display first level listing categories
                vm.listingCategories = _.filter(listingCategories, function (listingCategory) {
                    return ! listingCategory.parentId;
                });
                $rootScope.myLocations = myLocations;
                urlLocation = results.urlLocation;

                if (results.ipLocation) {
                    ipLocation = results.ipLocation;
                }

                return _loadSearchConfig();
            }).then(function () {
                if (! $rootScope.searchParams.myLocations) {
                    $rootScope.searchParams.myLocations = {};
                    _.forEach($rootScope.myLocations, function (location) {
                        $rootScope.searchParams.myLocations[location.id] = true;
                    });
                }

                if (urlLocation || previousQueryLocation || $rootScope.myLocations.length) {
                    return search();
                } else {
                    return search("creationDate");
                }
            }).then(function () {
                _setSEOTags();

                return uiGmapGoogleMapApi;
            }).then(function () {
                vm.isGoogleMapSDKReady = true;
                cache.set("isGoogleMapSDKReady", true);

                if (! vm.showMap) {
                    return;
                }

                googleMap = new GoogleMap({
                    zoom: 10,
                    events: {
                        click: _closeDetailBox,
                        tilesloaded: _stopMapSpinner
                    }
                });
                vm.gmap = googleMap.getConfig();

                vm.listingBox = {
                    id: _.unique("marker_"),
                    show: false,
                    windowOptions: {
                        boxClass: "InfoBox listing-preview-marker",
                        closeBoxURL: "",
                        disableAutoPan: false,
                        maxWidth: 150,
                        pixelOffset: new google.maps.Size(-75, -220),
                        zIndex: 1000001 // above thumbnails markers
                    },
                    parent: $scope // See https://github.com/angular-ui/angular-google-maps/issues/356#issuecomment-78063209
                };

                _populateMapMyLocations();
                _populateMapListings(vm.listings, vm.fromLocations);
            }).then(function () {
                return _setSEOPaginationLinks();
            }).then(function () {
                platform.setPageStatus("ready");
            }).catch(function (/* err */) {
                platform.setMetaTags({ "status-code": 500 });
                platform.setPageStatus("ready");

                // vm.showSearchButton = true;
            })
            .finally(function () {
                firstTime = false;
            });
        }

        function getUrlParams() {
            var urlParams = {};

            if ($stateParams.query) {
                urlParams.query = ListingService.decodeUrlQuery($stateParams.query);
            }
            if ($stateParams.q) {
                urlParams.fullQuery = ListingService.decodeUrlFullQuery($stateParams.q);
            }
            if ($stateParams.l) {
                urlParams.location = $stateParams.l;
            }
            if ($stateParams.page && ! isNaN($stateParams.page)) {
                urlParams.page = parseInt($stateParams.page, 10);
            }
            if ($stateParams.qm && _.includes(["default", "relevance", "distance"], $stateParams.qm)) {
                urlParams.queryMode = $stateParams.qm;
            }
            if ($stateParams.t && !isNaN($stateParams.t)) {
                urlParams.listingTypeId = parseInt($stateParams.t, 10);
            }

            // urlParams.onlyFree = $stateParams.free === "true";

            return urlParams;
        }

        function _getLocationFromURL(query) {
            return $q(function (resolve, reject) {
                var raceFinished = false;

                var raceResolve = function (res) {
                    if (! raceFinished) {
                        resolve(res);
                        raceFinished = true;
                    }
                };
                var raceReject = function (err) {
                    if (! raceFinished) {
                        reject(err);
                        raceFinished = true;
                    }
                };

                if (! query) {
                    return raceResolve();
                }

                uiGmapGoogleMapApi
                    .then(function () {
                        return map.geocode(query);
                    })
                    .then(function (res) {
                        raceResolve(res);
                    })
                    .catch(function (err) {
                        raceReject(err);
                    });

                setTimeout(function () {
                    raceResolve();
                }, 5000);
            });
        }

        function search(sorting) {
            var ipDefaultLocation;
            var searchParams = {};
            var fromLocations = [];
            var queryLocation;
            var queryLocationSource;

            _startSpinners(firstTime ? 0 : 600);
            // show search spinner after 600ms if search isn't completed

            vm.searchFiltersConfig.showAdvancedSearch = false;

            if (sorting) {
                searchParams.sorting = sorting;
            }

            // if (vm.searchQuery.selectedListingCategory) {
            //     searchParams.listingCategoryId = vm.searchQuery.selectedListingCategory.id;
            // }

            // reset url location if user changes search input
            if (previousSearchLocationInput !== vm.searchLocationInput && ! firstTime) {
                urlLocation = null;
            }
            previousSearchLocationInput = vm.searchLocationInput;

            // if (vm.onlyFree) {
            //     searchParams.onlyFree = true;
            // }

            return $q.when(true)
                .then(function () {
                    // location from query
                    // sync between the input value and the autocompleted stored value
                    if (typeof vm.searchQuery.location === "object" && vm.searchQuery.location !== null) {
                        vm.validLocation = true; // prevents from saving invalid addresses
                        urlLocation = null; // reset url location
                        queryLocationSource = "search";

                        if (googleMap) {
                            return map.getGooglePlaceData(vm.searchQuery.location);
                        } else {
                            return;
                        }
                    }

                    // location from URL or from previous search query location
                    var tmpLocation = urlLocation || previousQueryLocation;
                    if (tmpLocation) {
                        if (firstTime) {
                            vm.showSearchLocation       = true;
                            vm.searchLocationInput      = tmpLocation.name;
                            previousSearchLocationInput = tmpLocation.name;
                        }
                        vm.validLocation = true; // prevents from saving invalid addresses
                        queryLocationSource = "url";
                        return tmpLocation;
                    }

                    // default location when (do it once)
                    // - reset all or location
                    // - or no parameter is passed via URL and there is no stored locations
                    if (_.contains(["all", "location"], $stateParams.reset) || ! $rootScope.myLocations.length) {
                        vm.validLocation = false;
                        queryLocationSource = "default";

                        if (ipLocation && ipLocation.latitude && ipLocation.longitude) {
                            ipDefaultLocation = _.assign({}, ipLocation, { source: "ip", name: "Position" });
                            return ipDefaultLocation;
                        } else {
                            return;
                        }
                    }

                    return;
                })
                .then(function (location) {
                    queryLocation = location;
                    vm.queryLocation = queryLocation;

                    if (queryLocation) {
                        fromLocations.push(queryLocation);
                    }

                    if (queryLocationSource === "search") {
                        searchQueryLocation = queryLocation;
                        queryLocation.source = "query";
                    }

                    // only get my filtered locations
                    _.forEach($rootScope.myLocations, function (location) {
                        if ($rootScope.searchParams.myLocations[location.id]) {
                            fromLocations.push(_.assign({}, location, { source: "saved" }));
                        }
                    });

                    // always has at least one location
                    if (! fromLocations.length && ipDefaultLocation) {
                        fromLocations.push(ipDefaultLocation);
                    }

                    searchParams.locations = _.map(fromLocations, function (location) {
                        var loc = _.pick(location, ["latitude", "longitude", "source"]);

                        return loc;
                    });

                    searchParams.page  = vm.currentPage;
                    searchParams.limit = vm.nbListingsPerPage;
                    searchParams.query = $rootScope.searchParams.query;

                    if ($rootScope.searchParams.listingTypeId) {
                        searchParams.listingTypeId = $rootScope.searchParams.listingTypeId;
                    }

                    searchTimestamp        = new Date().getTime();
                    searchParams.timestamp = searchTimestamp;

                    if ($rootScope.searchParams.queryMode) {
                        searchParams.queryMode = $rootScope.searchParams.queryMode;
                    }

                    // if no locations at this point, change the query mode to "default"
                    if (! fromLocations.length) {
                        searchParams.queryMode = 'default';
                    }

                    platform.debugDev("listing search", searchParams);

                    return $q.all({
                        isAuthenticated: authentication.isAuthenticated(),
                        searchResults: ListingService.search({ type: "search", searchQuery: searchParams }),
                        startSearchDate: new Date(),
                    });
                })
                .then(function (results) {
                    var startSearchDate = results.startSearchDate;
                    var minWaitDuration = 300;
                    var searchDuration = new Date() - startSearchDate;
                    if (searchDuration < minWaitDuration) {
                        var deferred = $q.defer();

                        setTimeout(function () {
                            deferred.resolve(results);
                        }, minWaitDuration - searchDuration);

                        return deferred.promise;
                    } else {
                        return results;
                    }
                })
                .then(function (results) {
                    var isAuthenticated = results.isAuthenticated;
                    var searchResults   = results.searchResults;
                    var listings           = searchResults.listings;

                    // prevent old requests to be displayed if they take longer than recent ones
                    if (searchResults.timestamp !== searchTimestamp) {
                        return;
                    }

                    var alreadyInMyLocations = queryLocation ? _.reduce($rootScope.myLocations, function (memo, location) {
                        if (queryLocation.remoteId === location.remoteId) {
                            memo = memo || true;
                        }
                        return memo;
                    }, false) : true;

                    // TODO: define more clearly when a location is saved
                    if (isAuthenticated) {
                        if (vm.validLocation && ! $rootScope.myLocations.length && queryLocationSource === "search") {
                            vm.addLocation();
                        } else if (vm.validLocation
                            && $rootScope.myLocations.length < LocationService.getMaxLocations()
                            && ! alreadyInMyLocations
                            && queryLocationSource === "search"
                        ) {
                            vm.showAddLocationButton = true;
                        }
                    } else {
                        if ($rootScope.myLocations.length < LocationService.getMaxLocations() && queryLocationSource === "search") {
                            queryLocation.id = queryLocation.id || ("location_" + new Date().getTime());
                            LocationService.add(queryLocation);
                            vm.searchLocationInput   = null;
                            vm.searchQuery.location  = null;
                            $rootScope.searchParams.myLocations[queryLocation.id] = true;
                            _populateMapMyLocations();

                            noTriggerSearch.location    = true;
                            // noTriggerSearch.myLocations = true;
                        }
                    }

                    ListingService.populate(listings, {
                        nbDaysPricing: nbDaysPricing,
                        listingTypes: vm.listingTypes,
                    });

                    vm.fromLocations = fromLocations;
                    _populateMapListings(listings, fromLocations);

                    vm.listings    = listings;
                    vm.searched = true;

                    // sync the URL
                    var urlQuery;
                    var urlLocation;
                    var stateName;
                    var stateParams = {};
                    var redirectConfig = {
                        notify: false
                    };

                    if ($rootScope.searchParams.query) {
                        urlQuery = $rootScope.searchParams.query;
                    }

                    if (fromLocations.length && fromLocations[0].city) {
                        urlLocation = fromLocations[0].city;
                        stateParams.l = urlLocation;
                    }
                    if (firstTime) {
                        redirectConfig.location = "replace";
                    }

                    // if the number of results doesn't match the page number
                    if (vm.currentPage !== searchResults.page) {
                        stateParams.page = 1;
                        vm.currentPage = searchResults.page;
                    } else {
                        stateParams.page = vm.currentPage;
                    }

                    // stateParams.free = (vm.onlyFree ? "true" : null);

                    vm.nbTotalListings = searchResults.count;

                    if (searchResults.count <= vm.nbListingsPerPage) {
                        vm.showPagination = false;
                    } else {
                        vm.showPagination = true;
                    }

                    stateParams.qm = $rootScope.searchParams.queryMode;

                    if (urlQuery) {
                        stateName = "searchWithQuery";
                        stateParams.query = ListingService.encodeUrlQuery(urlQuery);
                        stateParams.q = ListingService.encodeUrlFullQuery(urlQuery);
                    } else {
                        stateName = "search";
                    }

                    if ($rootScope.searchParams.listingTypeId) {
                        stateParams.t = $rootScope.searchParams.listingTypeId;
                    } else {
                        stateParams.t = null;
                    }

                    $state.go(stateName, stateParams, redirectConfig);

                    _setSEOPaginationLinks();
                    _setSEOTags();

                    _showListingCardCta();

                    // Breadcrumbs
                    vm.firstLocation = vm.queryLocation || fromLocations[0] || urlLocation || {};

                    if (vm.firstLocation.city) {
                        vm.breadcrumbCityLink = "/s?reset=all&location=" + vm.firstLocation.city;
                    }

                    // Facebook event. No use to track these details in GA
                    var fbEventParams = {
                        content_ids: _.pluck(listings, "id"),
                        search_string: $rootScope.searchParams.query,
                        content_category: ListingCategoryService.getCategoriesString(vm.breadcrumbCategory)
                    };
                    fbq('track', 'Search', fbEventParams);

                    _saveSearchConfig();
                })
                .catch(function (err) {
                    // vm.showSearchButton = true;
                    return $q.reject(err);
                })
                .finally(function () {
                    // Stop spinner here if it is not first search
                    // Spinner stops later (tilesloaded event) in this case
                    if (typeof vm.hideMapOverlay !== "undefined") {
                        _stopMapSpinner(300);
                    }
                    _stopSpinner();
                });
        }

        function addLocation() {
            if (! googleMap || ! vm.searchQuery.location) {
                return;
            }

            return map.getGooglePlaceData(vm.searchQuery.location)
                .then(function (addingLocation) {
                    return LocationService.post(addingLocation);
                })
                .then(function (newLocation) {
                    LocationService.add(newLocation);
                    vm.showAddLocationButton = false;

                    vm.searchLocationInput   = null;
                    vm.searchQuery.location  = null;
                    $rootScope.searchParams.myLocations[newLocation.id] = true;

                    noTriggerSearch.location    = true;
                    // noTriggerSearch.myLocations = true;

                    _populateMapMyLocations();
                    toastr.success("Ajouté à mes lieux favoris");
                });
        }

        function removeTmpLocation(location) {
            LocationService.remove(location);
            delete $rootScope.searchParams.myLocations[location.id];

            if (googleMap) {
                googleMap.removeMarker(location.markerId);
            }
        }

        function resetSearchLocation() {
            if (vm.searchQuery) {
                vm.searchQuery.location = null;
            }
            vm.searchLocationInput   = null;
            vm.showAddLocationButton = false;
        }

        function toggleLocation(locId) {
            $rootScope.searchParams.myLocations[locId] = ! $rootScope.searchParams.myLocations[locId];
            _populateMapMyLocations(locId);
        }

        function markerHighlight(ids) {
            if (! googleMap) {
                return;
            }

            _.forEach(ids, function (id) {
                googleMap.markerHighlight(id);
            });
            if (! _.contains(ids, vm.listingBox.originatorId)) {
                _closeDetailBox();
            }
        }

        function markerStill(ids) {
            if (! googleMap) {
                return;
            }
            _.forEach(ids, function (id) {
                googleMap.markerStill(id);
            });
        }

        function _closeDetailBox(map/*, eventName*/) {
            if (! googleMap) {
                return;
            }

            if (vm.listingBox.show) {
                vm.listingBox.show = false;
                googleMap.showMarker(vm.listingBox.originatorId);
            }
            if (map) {
                $scope.$digest(); // needed since Google Maps event happen outside of angular
            }
        }

        function toggleDetailBox(markerId, detailBox, oneWay, e) {
            if (! googleMap) {
                return;
            }

            var triggerMarker = googleMap.getMarker(markerId);
            var highestMarker = _.max(vm.gmap.markers, "windowOptions.zIndex");

            // All hover events maxes out element z-index
            if (e && e.type === "mouseover") {
                triggerMarker.windowOptions.zIndex = highestMarker.windowOptions.zIndex + 1;
            }

            // Closed opened detailBox before opening or toggling new detailBox
            // detailBox : "Box"
            if (oneWay !== "close" && vm[detailBox].show) {
                vm[detailBox].show = false;
                googleMap.showMarker(vm[detailBox].originatorId);
            }

            // update data and metadata
            if (vm[detailBox].show && oneWay !== "open") {
                vm[detailBox].show = false;
                googleMap.showMarker(markerId);
            } else if (oneWay !== "close") {
                vm[detailBox].show          = false;
                vm[detailBox].originatorId  = markerId;
                vm[detailBox].data          = {};
                if (detailBox === "listingBox") {
                    vm[detailBox].data.listing                  = triggerMarker.data;
                    vm[detailBox].data.location                 = triggerMarker.toLocation;
                    vm[detailBox].data.locationsString          = _.pluck(vm[detailBox].data.listing.populatedLocations, "city").join(", ");
                    vm[detailBox].data.locationsString          = vm[detailBox].data.locationsString.length > 35
                        ? vm[detailBox].data.locationsString.substr(0, 35) + "..." : vm[detailBox].data.locationsString;
                    vm[detailBox].data.closestLocationShortName = LocationService.getShortName(vm[detailBox].data.listing.loc)
                        || (vm.queryLocation && (vm.queryLocation.city || vm.queryLocation.name));
                }

                $timeout(function () { // show on next tick to allow google maps to pan if necessary to show detailBox.
                    vm[detailBox].show = true;
                });

                if (detailBox === "listingBox") {
                    StelaceEvent.sendEvent("Listing search map listingBox opening");
                }

                googleMap.toggleMarker(markerId);
            }
        }

        function _populateMapListings(listings, fromLocations) {
            if (! googleMap) {
                return;
            }
            var newMarkers = [];

            // unset all listing markers
            _.forEach(_.filter(vm.gmap.markers, { type: "listing" }), function (oldMarker) {
                googleMap.removeMarker(oldMarker.id);
            });

            _.forEach(listings, function (listing, index) {
                var shortestJourney;
                var shortestLocation;

                var markerId = _.uniqueId("marker_");
                var marker   = {};

                if (listing.journeysDurations) {
                    shortestJourney  = listing.journeysDurations[0]; // sorted by server (ListingController, MapService)
                    shortestLocation = _.find(fromLocations, function (location, index) {
                        return shortestJourney.index === index;
                    });

                    listing.loc                = shortestLocation;
                    listing.toLoc              = shortestJourney.toLocation;
                    listing.populatedLocations = _.pluck(_.uniq(listing.journeysDurations, "toLocation.city"), "toLocation"); // keeps sorted order
                    shortestLocation.index  = listing.journeysDurations[0].index;
                    listing.minDurationString  = time.getDurationString(shortestJourney.durationSeconds);

                    marker.toLocation    = shortestJourney.toLocation;

                    marker.coords        = {
                        longitude: marker.toLocation.longitude,
                        latitude: marker.toLocation.latitude
                    };
                } else {
                    listing.loc          = listing.completeLocations[0];
                    listing.toLoc        = listing.completeLocations[0];
                    marker.toLocation = listing.completeLocations[0];

                    marker.coords        = {
                        longitude: listing.completeLocations[0].longitude,
                        latitude: listing.completeLocations[0].latitude
                    };
                    listing.populatedLocations = listing.completeLocations;
                }

                listing.markersId = [markerId];

                marker.type          = "listing";
                marker.data          = listing;
                marker.media         = listing.url;
                marker.id            = markerId;
                marker.show          = true;

                if (googleMap) {
                    marker.windowOptions = {
                        boxClass: "InfoBox listing-marker",
                        closeBoxURL: "",
                        disableAutoPan: true,
                        maxWidth: 45,
                        pixelOffset: new google.maps.Size(-22.5, -40),
                        zIndex: 100000 - index
                    };
                    // Options for plain old markers
                    // marker.options    =  {
                    //     animation: google.maps.Animation.DROP,
                    //     title: listing.name,
                    //     zIndex: 100000 - markerId
                    // };
                    // marker.icon       = "https://maps.gstatic.com/mapfiles/transparent.png";
                }
                newMarkers.push(marker);

                // Display all listings locations
                // _displayOtherLocationsMarkers(listing, marker);

            });

            // mapCenter = (newMarkers[newMarkers.length - 1].toLocation);
            googleMap.setMarkers(newMarkers);
            _fitMap();

            // function _displayOtherLocationsMarkers(listing, firstMarker) {
            //     // first marker is already created
            //     var otherLocations = _.reject(listing.populatedLocations, function (location) {
            //         return location.id === firstMarker.toLocation.id;
            //     });

            //     _.forEach(otherLocations, function (location, index) {
            //         var markerId = _.uniqueId("marker_");
            //         var marker   = {};
            //         listing.markersId.push(markerId);

            //         marker.toLocation    = location;
            //         marker.coords        = {
            //             longitude: location.longitude,
            //             latitude: location.latitude
            //         };
            //         marker.type          = "listing";
            //         marker.data          = listing;
            //         marker.media         = listing.url;
            //         marker.id            = markerId;
            //         marker.show          = true;

            //         if (googleMap) {
            //             marker.windowOptions = {
            //                 boxClass: "InfoBox listing-marker",
            //                 closeBoxURL: "",
            //                 disableAutoPan: true,
            //                 maxWidth: 45,
            //                 pixelOffset: new google.maps.Size(-22.5, -40),
            //                 zIndex: 100000 - index
            //             };
            //         }
            //         newMarkers.push(marker);
            //     });
            // }

        }

        function _populateMapMyLocations(locId) {
            if (! googleMap) {
                return;
            }

            var myLocationsMarkers = _.filter(vm.gmap.markers, { type: "searchLocation" });

            if (locId) {
                // only hiding relevant location to avoid flicker
                var toggledMarker = _.find(myLocationsMarkers, function (marker) {
                    return marker.myLocation.id === locId;
                });
                googleMap.toggleMarker(toggledMarker.id);
            }

            _.forEach($rootScope.myLocations, function (myLocation, index) {
                if (_.find(myLocationsMarkers, function (marker) {
                    return marker.myLocation.id === myLocation.id;
                })) { // myLocation marker already exists
                    return;
                }

                var markerId = _.uniqueId("marker_");
                var marker   = {};

                myLocation.markerId  = markerId;

                marker.myLocation    = myLocation;
                marker.coords        = {
                    longitude: marker.myLocation.longitude,
                    latitude: marker.myLocation.latitude
                };
                marker.type          = "searchLocation";
                marker.id            = markerId;
                marker.show          = $rootScope.searchParams.myLocations[myLocation.id];
                marker.windowOptions = {
                    boxClass: "InfoBox search-location-marker",
                    closeBoxURL: "",
                    disableAutoPan: true,
                    maxWidth: 96,
                    pixelOffset: new google.maps.Size(-48, -23), // 15 (line) + 2 (border) + 1 (padding) + 5 (triangle)
                    zIndex: 1000 - index
                };

                googleMap.addMarker(marker);
            });

            if (vm.mapFit) {
                // Refit
                _fitMap();
            }
        }

        function _fitMap() {
            if (! googleMap || ! mapContainer) {
                return;
            }

            var mapDimensions = {
                height: mapContainer.offsetHeight,
                width: mapContainer.offsetWidth
            }; // > updated if resized since last fit

            googleMap.fitMap(mapDimensions, true);

            vm.mapFit = true;
        }

        /**
         * Load the old search from local storage of the browser
         * @return {object|undefined} [res]
         * @return {object} [res.urlLocation]
         * @return {number[]} [res.activeLocations] - location ids that are active
         * @return {object} [res.queryLocation]
         */
        function _loadSearchConfig() {
            return ListingService.getSearchConfig(currentUser)
                .then(function (searchConfig) {
                    if (! searchConfig) {
                        return;
                    }

                    searchConfig = searchConfig || {};

                    // remove some previous search parameters depending on 'reset' url param
                    if ($stateParams.reset === "all") {
                        searchConfig = {};
                        searchConfig.activeLocations = [];
                    } else if ($stateParams.reset === "location") {
                        searchConfig.urlLocation = null;
                        searchConfig.queryLocation = null;
                        searchConfig.activeLocations = [];
                    }

                    // take the previous url location from storage if not new one
                    if (! urlLocation && searchConfig.urlLocation) {
                        urlLocation = searchConfig.urlLocation;
                    }

                    // set the previous query location if there is one
                    if (! urlLocation && searchConfig.queryLocation) {
                        previousQueryLocation = searchConfig.queryLocation;
                    }

                    // set the query mode if not already set via url
                    if (! urlParams.queryMode && searchConfig.queryMode) {
                        $rootScope.searchParams.queryMode = searchConfig.queryMode;
                    }

                    // compute the new hash of active locations from my locations and the old hash
                    if (searchConfig.activeLocations && $rootScope.myLocations) {
                        $rootScope.searchParams.myLocations = {};

                        var hashLocations = _.indexBy($rootScope.myLocations, "id");

                        _.forEach(searchConfig.activeLocations, function (locationId) {
                            if (hashLocations[locationId]) {
                                $rootScope.searchParams.myLocations[locationId] = true;
                            }
                        });
                    }

                    // if (searchConfig.listingCategoryId) {
                    //     vm.searchQuery.selectedListingCategory = searchConfig.listingCategoryId;
                    // }
                });
        }

        function _saveSearchConfig() {
            var searchConfig = {};

            if (urlLocation) {
                searchConfig.urlLocation = urlLocation;
            }

            if ($rootScope.searchParams.myLocations) {
                searchConfig.activeLocations = _.reduce($rootScope.searchParams.myLocations, function (memo, active, id) {
                    if (active) {
                        memo.push(id);
                    }
                    return memo;
                }, []);
            }

            if (_.isObject(vm.searchQuery.location)) {
                searchConfig.queryLocation = searchQueryLocation;
            }

            if ($rootScope.searchParams.queryMode) {
                searchConfig.queryMode = $rootScope.searchParams.queryMode;
            }

            // if (vm.searchQuery.selectedListingCategory) {
            //     searchConfig.listingCategoryId = vm.searchQuery.selectedListingCategory;
            // }

            return ListingService.setSearchConfig(searchConfig, currentUser);
        }

        function _startSpinners(delay) {
            spinnerTimeout = $timeout(function () {
                usSpinnerService.spin('map-spinner');
                usSpinnerService.spin('search-spinner');
                vm.hideMapOverlay = false;
                vm.backgroundOverlay = true;
                vm.showSearchOverlay = true;
            }, delay);
        }

        function _stopSpinner() {
            $timeout.cancel(spinnerTimeout);
            usSpinnerService.stop('search-spinner');
            vm.showSearchOverlay = false;
        }

        function _stopMapSpinner(delay) {
            delay = delay || 0;
            stopSpinnerTimeout = $timeout(function () {
                usSpinnerService.stop('map-spinner');
                vm.hideMapOverlay = true;
                // digest loop doest not run after hiding mapOverlay if this is not wrapped in timeout.
                // May be related to https://github.com/urish/angular-spinner/issues/26
            }, delay);

            vm.backgroundOverlay = false;
        }

        function _setSEOTags() {
            var query = vm.searchQuery.query;
            var url = platform.getBaseUrl() + $state.current.urlWithoutParams;
            var noParamsSearch = (! query && ! urlLocationName);
            var title = "Location et partage d'objets";
            var location = urlLocation || previousQueryLocation;
            var metaDesc;

            if (noParamsSearch && ! location) {
                metaDesc = "Recherche d'objets à louer, à vendre ou à partager entre particuliers.";
            } else {
                if (query) {
                    title =  query + " - " + title;
                    metaDesc = "Location / Vente" + query + " entre particuliers et matériel à partager";
                    url += "/" + ListingService.encodeUrlQuery(query);
                } else {
                    metaDesc = "Recherche d'objets à louer ou à vendre entre particuliers";
                }

                metaDesc += ".";
            }

            title += " sur Sharinplace";

            var paramsObj = {};

            if (vm.currentPage !== 1) {
                paramsObj.page = vm.currentPage;
            }

            var paramsStr = _.reduce(paramsObj, function (memo, value, key) {
                memo += (memo ? "&" : "?");
                memo += key + "=" + value;
                return memo;
            }, "");

            url += paramsStr;

            var absUrl          = $location.absUrl();
            var paginationLinks = {};

            // if it is the first page
            if (vm.currentPage === 1) {
                paginationLinks.prev = null;
            } else {
                paginationLinks.prev = _getPaginationLink(absUrl, vm.currentPage - 1);
                title += " - Page " + vm.currentPage;
                metaDesc += " Page " + vm.currentPage;
            }
            // if it is the last page
            if (vm.nbTotalListings <= vm.currentPage * vm.nbListingsPerPage) {
                paginationLinks.next = null;
            } else {
                paginationLinks.next = _getPaginationLink(absUrl, vm.currentPage + 1);
            }

            platform.setPaginationLinks(paginationLinks);
            platform.setTitle(title);
            platform.setMetaTags({ description: metaDesc });
            platform.setOpenGraph({
                "og:title": title,
                "og:type": "website",
                "og:url": url,
                "og:description": metaDesc
            });
            platform.setCanonicalLink(url);
        }

        function pageChange() {
            if (! vm.loadMap) {
                $window.scrollTo(0, 0);
            } else {
                searchContent.scrollTop = 0;
            }
            search();
        }

        function _getPaginationLink(url, num) {
            var regexPagination = /^(.*[?&]page=)(\d+)(.*)$/;

            if (regexPagination.test(url)) {
                return url.replace(regexPagination, "$1" + num + "$3");
            } else {
                if (url.indexOf("?") !== -1) {
                    return url + "&page=" + num;
                } else {
                    return url + "?page=" + num;
                }
            }
        }

        function _setSEOPaginationLinks() {
            var absUrl   = $location.absUrl();
            var interval = 500;

            return $q(function (resolve/*, reject */) {
                var setPaginationLinkHref = function () {
                    var paginationElement = document.querySelector(".pagination-container .pagination");

                    if (! paginationElement) {
                        setTimeout(setPaginationLinkHref, interval);
                        return;
                    }

                    var lis = paginationElement.getElementsByTagName("li");

                    _.forEach(lis, function (li) {
                        var link = li.getElementsByTagName("a")[0];

                        if (! li.classList.contains("disabled")) {
                            switch (link.innerHTML) {
                                case vm.paginationLinks.first:
                                    link.href = _getPaginationLink(absUrl, 1);
                                    break;

                                case vm.paginationLinks.previous:
                                    link.href = _getPaginationLink(absUrl, vm.currentPage - 1);
                                    break;

                                case vm.paginationLinks.next:
                                    link.href = _getPaginationLink(absUrl, vm.currentPage + 1);
                                    break;

                                case vm.paginationLinks.last:
                                    link.href = _getPaginationLink(absUrl, Math.ceil(vm.nbTotalListings / vm.nbListingsPerPage));
                                    break;

                                default:
                                    link.href = _getPaginationLink(absUrl, link.innerHTML);
                                    break;
                            }
                        } else {
                            link.href = "";
                        }

                        if (! link.classList.contains("prevent-default")) {
                            link.addEventListener("click", function (e) {
                                e.preventDefault();
                            });
                            link.classList.add("prevent-default");
                        }
                    });

                    resolve();
                };

                if (vm.showPagination) {
                    setPaginationLinkHref();
                } else {
                    resolve();
                }
            });
        }

        function _showListingCardCta() {
            var nbListingsVisible = Math.min(vm.nbListingsPerPage, vm.nbTotalListings);
            // Display listing-card listing creation CTA when empty space is available
            // I.e. when nbListingsVisible is not multiple of 4 (columns) on largest screens
            // Or when nbListingsVisible is odd, on small display (2 columns)
            // That's why nbListingsPerPage is set to a multiple of 2, 3 and 4, minus 1.

            if (vm.isXLarge) {
                vm.showListingCardCta = (nbListingsVisible % 4) > 0;
            } else if (vm.isDesktop || (! vm.isSmall && ! vm.isSMedium)) {
                // Desktop or Between small and s-medium: 3 columns
                vm.showListingCardCta = (nbListingsVisible % 3) > 0;
            } else {
                // Small screen or s-medium below desktop (map): 2 columns
                vm.showListingCardCta = (nbListingsVisible % 2) > 0;
            }
        }

        function _updateLayoutMediaQueries() {
            vm.isSmall   = mqSmall.matches;
            vm.isSMedium = mqSMedium.matches;
            vm.isDesktop = mqDesktop.matches;
            vm.isXLarge  = mqXLarge.matches;

            _showListingCardCta();
        }

        function uxEvent(target, type) {
            StelaceEvent.sendEvent(target + " " + type, { // E.g. Search item card cta + click
                type: type
            });
        }

    }

})();
