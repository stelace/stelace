(function () {

    angular
        .module("app.widgets")
        .controller("SearchFiltersController", SearchFiltersController);

    function SearchFiltersController($document,
                                    $q,
                                    $rootScope,
                                    $scope,
                                    $state,
                                    ItemService,
                                    ListingTypeService,
                                    LocationService,
                                    platform,
                                    tools,
                                    UserService) {
        var listeners = [];
        var doc = $document[0].documentElement;
        var lockScrollClass = "modal-opened";
        var lockTarget;
        var currentUser;
        var fetchedListingTypes = false;

        var vm = this;
        vm.queryModes = ItemService.getSearchFilters("queryModes");
        vm.timeProperties = {
            NONE: true,
            TIME_FLEXIBLE: true,
        };

        vm.search                = search;
        vm.updateListingTime     = updateListingTime;
        vm.toggleLocation        = toggleLocation;
        vm.removeTmpLocation     = removeTmpLocation;


        activate();

        function activate() {
            $scope.$watch("vm.config.showAdvancedSearch", manageScroll);

            $scope.$watch(function() {
                return $rootScope.myLocations;
            }, function() {
                vm.myLocations = $rootScope.myLocations;
            }, true);

            $scope.$watch(function() {
                return $rootScope.searchParams.listingTypeId;
            }, function(newValue, oldValue) {
                if (newValue !== oldValue) {
                    _setTimeProperties(newValue);
                }
            });

            $scope.$watch("vm.params.myLocations", function() {
                $rootScope.nbActiveLocations = _.filter(vm.params.myLocations, function(loc) {
                    return loc;
                }).length;
            }, true);

            listeners.push($rootScope.$on("isAuthenticated", _getUserInfo));


            $scope.$on("$destroy", function () {
                _.forEach(listeners, function (listener) {
                    listener();
                });

                lockTarget.removeClass(lockScrollClass);
                doc = null;
                lockTarget = null;
            });

            if (vm.config.lockScrollId) {
                lockTarget = $document[0].getElementById(vm.config.lockScrollId);

            }

            lockTarget = angular.element(lockTarget || doc);

            return _getUserInfo();
        }

        function _getUserInfo(delay) {
            // give some time to view to avoid duplicate requests
            return tools.delay(_.isFinite(delay) ? delay : 3000)
                .then(function () {
                    return $q.all({
                        myLocations: LocationService.getMine(),
                        ipLocation: LocationService.getGeoInfo(),
                        currentUser: UserService.getCurrentUser(),
                        listingTypes: ListingTypeService.cleanGetList(),
                    });
                }).then(function (results) {
                    $rootScope.myLocations = results.myLocations;
                    $rootScope.ipLocation  = results.ipLocation;
                    currentUser            = results.currentUser;
                    vm.listingTypes = results.listingTypes;
                    vm.timeNoneListingType = _.find(vm.listingTypes, function (listingType) {
                        return listingType.properties.TIME === 'NONE';
                    });
                    vm.timeFlexibleListingType = _.find(vm.listingTypes, function (listingType) {
                        return listingType.properties.TIME === 'TIME_FLEXIBLE';
                    });

                    fetchedListingTypes = true;

                    _setTimeProperties($rootScope.searchParams.listingTypeId);

                    vm.myLocations = results.myLocations;
                    vm.isAuthenticated = !! currentUser;

                    return _loadSearchConfig();
                });
        }

        function _setTimeProperties(listingTypeId) {
            if (!fetchedListingTypes) {
                return;
            }

            // all listing
            if (!listingTypeId) {
                vm.timeProperties = {
                    NONE: true,
                    TIME_FLEXIBLE: true
                };
            } else if (vm.timeNoneListingType.id === listingTypeId) {
                vm.timeProperties = {
                    NONE: true,
                    TIME_FLEXIBLE: false
                };
            } else if (vm.timeFlexibleListingType.id === listingTypeId) {
                vm.timeProperties = {
                    NONE: false,
                    TIME_FLEXIBLE: true
                };
            }
        }

        function search() {
            return _saveSearchConfig()
                .then(function () {
                    if (vm.params.listingTypeId) {
                        vm.params.t = vm.params.listingTypeId;
                    }
                    vm.params.qm = vm.params.queryMode;

                    platform.debugDev("Header advanced search params", vm.params);

                    vm.config.showAdvancedSearch = false;

                    if (ItemService.isSearchState($state)) {
                        $rootScope.$emit("triggerSearch");
                    } else {
                        $state.go("searchWithQuery", vm.params);
                    }
                });
        }

        function updateListingTime(type) {
            // force one type
            if (!vm.timeProperties.TIME_FLEXIBLE && !vm.timeProperties.NONE) {
                var field = (type === 'NONE' ? 'TIME_FLEXIBLE' : 'NONE');
                vm.timeProperties[field] = true;
            }

            if (vm.timeProperties.TIME_FLEXIBLE && vm.timeProperties.NONE) {
                vm.params.listingTypeId = null;
            } else {
                vm.params.listingTypeId = vm.timeProperties.TIME_FLEXIBLE ? vm.timeFlexibleListingType.id : vm.timeNoneListingType.id;
            }

            if (vm.config.searchOnChange) {
                vm.search();
            }
        }

        function manageScroll(lock) {
            if (lock) {
                lockTarget.addClass(lockScrollClass);
            } else {
                lockTarget.removeClass(lockScrollClass);
            }
        }

        function removeTmpLocation(location) {
            LocationService.remove(location);
            delete vm.params.myLocations[location.id];
        }

        function toggleLocation(locId) {
            vm.params.myLocations[locId] = ! vm.params.myLocations[locId];
        }

        /**
     * Load the old search from local storage of the browser
     * @return {object|undefined} [res]
     * @return {object} [res.urlLocation]
     * @return {number[]} [res.activeLocations] - location ids that are active
     * @return {object} [res.queryLocation]
     */
    function _loadSearchConfig() {
        return ItemService.getSearchConfig(currentUser)
            .then(function (searchConfig) {
                if (! searchConfig) {
                    return;
                }

                if (searchConfig.queryMode) {
                    vm.params.queryMode = searchConfig.queryMode;
                }

                // compute the new hash of active locations from my locations and the old hash
                if (searchConfig.activeLocations && $rootScope.myLocations) {
                    vm.params.myLocations = {};

                    var hashLocations = _.indexBy($rootScope.myLocations, "id");

                    _.forEach(searchConfig.activeLocations, function (locationId) {
                        if (hashLocations[locationId]) {
                            vm.params.myLocations[locationId] = true;
                        }
                    });
                }
            });
    }

    function _saveSearchConfig() {
        var searchConfig = {};

        if (vm.params.myLocations) {
            searchConfig.activeLocations = _.reduce(vm.params.myLocations, function (memo, active, id) {
                if (active) {
                    memo.push(id);
                }
                return memo;
            }, []);
        }

        // if (_.isObject(vm.params.location)) {
        //     searchConfig.queryLocation = paramsLocation;
        // }

        if (vm.params.queryMode) {
            searchConfig.queryMode = vm.params.queryMode;
        }

        return ItemService.setSearchConfig(searchConfig, currentUser);
    }

    }

})();
