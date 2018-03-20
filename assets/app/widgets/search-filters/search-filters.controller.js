(function () {

    angular
        .module("app.widgets")
        .controller("SearchFiltersController", SearchFiltersController);

    function SearchFiltersController($document,
                                    $q,
                                    $rootScope,
                                    $scope,
                                    $state,
                                    ListingService,
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

        var vm = this;

        vm.fetchedListingTypes = false;
        vm.listingTypes = [];

        vm.search                  = search;
        vm.toggleLocation          = toggleLocation;
        vm.removeTmpLocation       = removeTmpLocation;
        vm.selectAllListingTypes   = selectAllListingTypes;
        vm.deselectAllListingTypes = deselectAllListingTypes;
        vm.updateListingTypes = updateListingTypes;


        activate();

        function activate() {
            $scope.$watch("vm.config.showAdvancedSearch", manageScroll);

            $scope.$watch(function() {
                return $rootScope.myLocations;
            }, function() {
                vm.myLocations = $rootScope.myLocations;
            }, true);

            $scope.$watch(function() {
                return $rootScope.searchParams.listingTypesIds;
            }, function(newValue, oldValue) {
                if (!_.isEqual(newValue, oldValue)) {
                    _setListingTypes(newValue);
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

                    if (vm.listingTypes.length === 1) {
                        vm.selectedListingType = vm.listingTypes[0];
                        vm.params.listingTypesIds = [vm.selectedListingType.id];
                    }

                    vm.fetchedListingTypes = true;

                    if ($rootScope.searchParams.listingTypesIds.length) {
                        _setListingTypes($rootScope.searchParams.listingTypesIds);
                    } else {
                        selectAllListingTypes();
                    }

                    vm.myLocations = results.myLocations;
                    vm.isAuthenticated = !! currentUser;

                    return _loadSearchConfig();
                });
        }

        function _setListingTypes(listingTypesIds) {
            if (!vm.fetchedListingTypes) {
                return;
            }

            var indexedListingTypes = _.indexBy(listingTypesIds);

            _.forEach(vm.listingTypes, function (listingType) {
                var active = indexedListingTypes[listingType.id];

                vm.params.activeListingTypesIds[listingType.id] = !!active;
            });
        }

        function search() {
            return _saveSearchConfig()
                .then(function () {
                    if (!isAllListingTypesSelected(vm.params.listingTypesIds)) {
                        vm.params.t = vm.params.listingTypesIds;
                    }
                    vm.params.qm = 'default'; // TODO: allow users to change the query mode

                    platform.debugDev("Header advanced search params", vm.params);

                    vm.config.showAdvancedSearch = false;

                    if (ListingService.isSearchState($state)) {
                        $rootScope.$emit("triggerSearch");
                    } else {
                        $state.go("searchWithQuery", vm.params);
                    }
                });
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

        function updateListingTypes() {
            vm.params.listingTypesIds = [];
            _.forEach(vm.params.activeListingTypesIds, function (active, listingTypeId) {
                if (active) {
                    vm.params.listingTypesIds.push(parseInt(listingTypeId, 10));
                }
            });

            if (vm.config.searchOnChange) {
                search();
            }
        }

        function selectAllListingTypes() {
            vm.params.listingTypesIds = [];
            _.forEach(vm.listingTypes, function (listingType) {
                vm.params.activeListingTypesIds[listingType.id] = true;
                vm.params.listingTypesIds.push(listingType.id);
            });
        }

        function deselectAllListingTypes() {
            vm.params.listingTypesIds = [];
            _.forEach(vm.listingTypes, function (listingType) {
                vm.params.activeListingTypesIds[listingType.id] = false;
            });
        }

        function isAllListingTypesSelected(listingTypesIds) {
            return listingTypesIds.length === vm.listingTypes.length
                || !listingTypesIds.length;
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

                    // if (searchConfig.queryMode) {
                    //     vm.params.queryMode = searchConfig.queryMode;
                    // }

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

            // if (vm.params.queryMode) {
            //     searchConfig.queryMode = vm.params.queryMode;
            // }

            return ListingService.setSearchConfig(searchConfig, currentUser);
        }

    }

})();
