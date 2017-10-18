(function () {

    angular
        .module("app.landings")
        .controller("HomeController", HomeController);

    function HomeController($interval,
                                $location,
                                $q,
                                $rootScope,
                                $scope,
                                $state,
                                $timeout,
                                $window,
                                authenticationModal,
                                cache,
                                ItemService,
                                ListingTypeService,
                                // LocationService,
                                map,
                                platform,
                                Restangular,
                                StelaceEvent,
                                toastr,
                                tools,
                                uiGmapGoogleMapApi,
                                UserService) {

        var listeners = [];

        var mqSmall        = $window.matchMedia("(max-width: 639px)");
        var currentUser;
        var items;

        var vm = this;

        vm.searchLocation      = null;
        vm.isGoogleMapSDKReady = cache.get("isGoogleMapSDKReady") || false;
        vm.facebookPagePlugin  = $rootScope.facebookUser;
        vm.isSmall             = mqSmall.matches;

        // Google Places ngAutocomplete options
        vm.ngAutocompleteOptions = {
            country: 'fr',
            watchEnter: true
        };

        vm.search  = search;

        activate();



        function activate() {
            StelaceEvent.sendScrollEvent("Home view")
                .then(function (obj) {
                    listeners.push(obj.cancelScroll);
                });

            platform.setCanonicalLink(platform.getBaseUrl());

            listeners.push(
                $rootScope.$on("facebookUser", function () {
                    vm.facebookPagePlugin  = $rootScope.facebookUser;
                })
            );

            $scope.$on('$destroy', function () {
                _.forEach(listeners, function (listener) {
                    listener();
                });
            });

            $q.all({
                currentUser: UserService.getCurrentUser(),
                items: ItemService.cleanGetList({ landing: true }),
                listingTypes: ListingTypeService.cleanGetList()
            })
            .then(function (results) {
                currentUser = tools.clearRestangular(results.currentUser);
                items       = vm.isSmall ? _.sample(results.items, 6) : results.items;
                vm.listingTypes = results.listingTypes;

                ItemService.populate(items, {
                    listingTypes: vm.listingTypes
                });

                vm.items     = items;

                return uiGmapGoogleMapApi;
            })
            .then(function (map) {
                if (map && typeof map === "object" && map.places) {
                    vm.isGoogleMapSDKReady = true;
                    cache.set("isGoogleMapSDKReady", true);
                }
            })
            .finally(function () {
                platform.setPageStatus("ready");
            });
        }

        function search() {
            if (! vm.searchQuery) {
                return $state.go("search");
            }

            $q.when(true)
                .then(function () {
                    // timeout is necessary to get the real location autocomplete
                    return $timeout(function () {}, 300);
                })
                .then(function () {
                    if (! vm.searchLocation) {
                        return;
                    }

                    return map.getGooglePlaceData(vm.searchLocation);
                })
                .then(function (location) {
                    var searchConfig = {};

                    if (vm.searchLocation) {
                        searchConfig.urlLocation = location;
                        searchConfig.activeLocations = [];
                    }

                    return ItemService.setSearchConfig(searchConfig, currentUser);
                })
                .then(function () {
                    var stateParams = {
                        query: vm.searchQuery,
                        queryMode: "default",
                    };

                    $state.go("searchWithQuery", stateParams);
                });
        }
    }

})();
