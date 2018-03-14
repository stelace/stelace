/* global moment */

(function () {

    angular
        .module("app.users")
        .controller("AccountController", AccountController);

    function AccountController($q,
                                    $rootScope,
                                    $scope,
                                    $timeout,
                                    authentication,
                                    cache,
                                    ContentService,
                                    gamification,
                                    ListingService,
                                    ListingTypeService,
                                    LocationService,
                                    map,
                                    MediaService,
                                    Modal,
                                    platform,
                                    promptInfoModal,
                                    Restangular,
                                    StelaceConfig,
                                    StelaceEvent,
                                    tools,
                                    uiGmapGoogleMapApi,
                                    UserService) {
        var listeners     = [];
        var updatingUser  = false;
        var sendingCheckEmail = false;

        var vm = this;
        vm.myListings               = null;
        vm.myLocations              = [];
        vm.showIncomeReport         = false;
        vm.incomeReportYears        = [];
        vm.stickyOffset             = 208;
        vm.needOldPassword          = true;
        vm.isGoogleMapSDKReady      = cache.get("isGoogleMapSDKReady") || false;
        vm.disableAddLocationButton = true;
        // Google Places ngAutocomplete options
        vm.ngAutocompleteOptions    = {
            forceGlobalSearch: true
        };
        vm.showGamification   = StelaceConfig.isFeatureActive('GAMIFICATION');
        vm.incomeReportActive = StelaceConfig.isFeatureActive('INCOME_REPORT');
        vm.isSmsActive        = StelaceConfig.isFeatureActive('SMS');

        vm.updateUser             = updateUser;
        vm.checkEmail             = checkEmail;
        vm.updateEmail            = updateEmail;
        vm.updatePhone            = updatePhone;
        vm.updateRealPhone        = updateRealPhone;
        vm.updatePassword         = updatePassword;
        vm.fetchCurrentUser       = fetchCurrentUser;
        vm.selectIncomeReportYear = selectIncomeReportYear;

        vm.addLocation         = addLocation;
        vm.removeLocation      = removeLocation;
        vm.updateLocation      = updateLocation;
        vm.updateLocationAlias = updateLocationAlias;

        activate();



        function activate() {
            vm.newMessagesCount = $rootScope.headerNewMessagesCount;
            listeners.push(
                $rootScope.$on("refreshInbox", function () {
                    vm.newMessagesCount = $rootScope.headerNewMessagesCount;
                })
            );

            $scope.$watch("vm.locationSearchObject", function (newLocation) {
                if (! newLocation || typeof newLocation !== "object") { // second condition returns false if object or null !
                    return;
                }

                map.getGooglePlaceData(newLocation)
                    .then(function (place) {
                        if (! vm.maxLocationsReached) {
                            vm.currentLocation = place;
                            vm.disableAddLocationButton = false;
                        }
                    });
            });

            $scope.$on("$destroy", function () {
                _.forEach(listeners, function (listener) {
                    listener();
                });
            });

            $q.all({
                fetchCurrentUser: fetchCurrentUser(),
                myListings: ListingService.getMyListings(),
                incomeReport: vm.incomeReportActive ? UserService.getIncomeReport() : {},
                map: uiGmapGoogleMapApi,
                listingTypes: ListingTypeService.cleanGetList()
            }).then(function (results) {
                var incomeReport = results.incomeReport;
                var myListings = results.myListings;
                vm.listingTypes = results.listingTypes;

                // use a setTimeout because the cache variable can be set after changing state
                setTimeout(function () {
                    if (cache.get("refreshUserAfterReferral")) {
                        tools.delay(3000)
                            .then(function () {
                                return UserService.getCurrentUser(true);
                            })
                            .then(function (currentUser) {
                                vm.currentUser = currentUser;
                                vm.editingPhone = vm.currentUser.phone;
                            })
                            .finally(function () {
                                cache.unset("refreshUserAfterReferral");
                            });
                    }
                }, 2000);

                if (results.map && typeof results.map === "object" && results.map.places) {
                    vm.isGoogleMapSDKReady = true;
                    cache.set("isGoogleMapSDKReady", true);
                }

                _.forEach(myListings, function (listing) {
                    listing.slug        = ListingService.getListingSlug(listing);
                    listing.ownerRating = { // expected format for listing-card's rating-stars
                        ratingScore: vm.currentUser.ratingScore,
                        nbRatings: vm.currentUser.nbRatings
                    };
                });

                vm.myListings = _.cloneDeep(myListings);

                ListingService.populate(vm.myListings, {
                    listingTypes: vm.listingTypes
                    // locations: vm.myLocations
                });

                vm.incomeReportYears = _.reduce(incomeReport, function (memo, report, year) {
                    memo.push({
                        year: year,
                        token: report.token
                    });
                    return memo;
                }, []);

                if (vm.incomeReportYears.length) {
                    vm.showIncomeReport = true;
                }
                if (moment().quarter() !== 2) { // tax declaration quarter
                    vm.collapseIncomeReports = true;
                }

                StelaceEvent.sendEvent("Account view", {
                    data: {}
                });
            });
        }

        function fetchCurrentUser(refreshUser) {
            return $q.all({
                    currentUser: UserService.getCurrentUser(refreshUser),
                    authMeans: UserService.getAuthMeans(),
                    myImage: MediaService.getMyImage(),
                    myLocations: LocationService.getMine()
                })
                .then(function (results) {
                    vm.currentUser         = results.currentUser;
                    vm.editingCurrentUser  = Restangular.copy(vm.currentUser);
                    vm.authMeans           = results.authMeans;
                    vm.nbLocations         = results.myLocations.length;

                    vm.editingPhone = vm.currentUser.phone;

                    _.forEach(results.myLocations, function (location) {
                        location.aliasEdit = location.alias;
                    });
                    vm.myLocations         = results.myLocations;
                    vm.collapseLocations   =(vm.myLocations.length >= 2);

                    _setMaxLocationsView();
            });
        }

        function updateUser() {
            var checkAttrs = [
                "firstname",
                "lastname",
                "description"
            ];
            var updateFirstname;
            if (_.isEqual(_.pick(vm.editingCurrentUser, checkAttrs), _.pick(vm.currentUser, checkAttrs))) {
                return;
            }
            if (updatingUser) {
                $timeout(updateUser, 1000);
                return;
            }

            if (vm.currentUser.firstname !== vm.editingCurrentUser.firstname) {
                updateFirstname = true;
            }

            updatingUser = true;

            vm.editingCurrentUser
                .patch()
                .then(function (user) {
                    angular.extend(vm.currentUser, user);
                    updatingUser = false;

                    if (updateFirstname) {
                        $rootScope.$emit("updateWelcomeMessage", vm.currentUser.firstname);
                    }
                    if (_.isEqual(_.pick(vm.editingCurrentUser, checkAttrs), _.pick(vm.currentUser, checkAttrs))) {
                        ContentService.showSaved({
                            timeOut: 2500,
                        });
                    }
                });
        }

        function checkEmail() {
            if (sendingCheckEmail) {
                return;
            }

            sendingCheckEmail = true;

            return authentication.emailNew(vm.currentUser.email)
                .then(function () {
                    ContentService.showNotification({
                        messageKey: 'user.account.email_validation_link_sent',
                        type: 'success'
                    });
                })
                .catch(ContentService.showError)
                .finally(function () {
                    sendingCheckEmail = false;
                });
        }

        function updateEmail() {
            vm.dummyEmail = null;

            promptInfoModal.ask(["emailNew"], { isListingOwner: true });
        }

        function updateRealPhone() {
            if (vm.isSmsActive
            || vm.editingPhone === vm.currentUser.phone
            ) {
                return;
            }

            vm.currentUser
                .updatePhone(vm.editingPhone)
                .then(function () {
                    ContentService.showSaved({
                        timeOut: 2500,
                    });
                });
        }

        function updatePhone() {
            if (!vm.isSmsActive) {
                return;
            }

            var promptType = (! vm.currentUser.phone || ! vm.currentUser.phoneCheck) ? "phone" : "phoneNew";

            vm.dummyPhone = null;

            promptInfoModal.ask([promptType], { isListingOwner: true })
                .then(function (promptResults) {
                    if (promptResults.allInfoOk === true) {
                        // Display phone without refresh
                        vm.currentUser.phone             = promptResults.phone;
                        vm.currentUser.phoneCheck        = true;
                        // Avoid to erase phone during other user updates
                        vm.editingCurrentUser.phone      = promptResults.phone;
                        vm.editingCurrentUser.phoneCheck = true;
                    }
                });
        }

        function updatePassword(newPassword, oldPassword) {
            vm.currentUser
                .updatePassword(newPassword, oldPassword)
                .then(function () {
                    ContentService.showSaved();
                    vm.needOldPassword = true;
                })
                .catch(function (err) {
                    if (err.data && err.data.message === "BadOldPassword") {
                        ContentService.showNotification({
                            messageKey: 'user.account.incorrect_current_password',
                            type: 'warning'
                        });
                    } else {
                        ContentService.showError(err);
                    }
                })
                .finally(function () {
                    vm.newPassword = null;
                    vm.oldPassword = null;
                });
        }

        function selectIncomeReportYear() {
            if (vm.selectedIncomeReport) {
                var url = UserService.getIncomeReportUrl(vm.currentUser.id, vm.selectedIncomeReport.year, vm.selectedIncomeReport.token);
                window.open(url);
                vm.selectedIncomeReport = null;
            }
        }


        function addLocation() {
            var alreadyExists = _.find(vm.myLocations, function (location) {
                return location.provider === vm.currentLocation.provider
                    && location.remoteId === vm.currentLocation.remoteId;
            });

            if (! alreadyExists) {
                var addingLocation = _.cloneDeep(vm.currentLocation);

                LocationService
                    .post(_.omit(addingLocation, ["id", "fakeId"]))
                    .then(function (newLocation) {
                        gamification.checkStats();

                        LocationService.add(newLocation);
                        _setMaxLocationsView();

                        vm.disableAddLocationButton = false;
                        vm.locationSearchQuery = null;
                        vm.locationSearchObject = null;
                        return _addLocationToListing(newLocation);
                    })
                    .catch(function (err) {
                        if (err.data) {
                            if (err.data.message === "max locations reached") {
                                ContentService.showNotification({
                                    messageKey: 'user.account.max_number_locations_reached'
                                });
                            } else if (err.data.message === "identical location") {
                                ContentService.showNotification({
                                    messageKey: 'user.account.location_already_saved'
                                });
                            }

                            LocationService.getMine(true)
                                .then(function (locations) {
                                    _.forEach(locations, function (location) {
                                        location.aliasEdit = location.alias;
                                    });

                                    vm.myLocations = locations;
                                    _setMaxLocationsView();
                                });
                        } else {
                            ContentService.showError(err);
                        }
                    });
            } else {
                ContentService.showNotification({
                    messageKey: 'user.account.location_already_saved'
                });
            }
        }

        function removeLocation(location) {
            location
                .remove()
                .then(function () {
                    LocationService.remove(location);
                    _setMaxLocationsView();

                    ListingService.clearMyListings();
                })
                .catch(ContentService.showError);
        }

        function updateLocation(location) {
            var alreadyExists = _.find(vm.myLocations, function (location) {
                return location.latitude === vm.currentLocation.latitude
                    && location.longitude === vm.currentLocation.longitude;
            });

            if (! alreadyExists) {
                var updateAttrs = [
                    "name",
                    "street",
                    "postalCode",
                    "city",
                    "latitude",
                    "longitude"
                ];

                _.forEach(updateAttrs, function (attr) {
                    location[attr] = vm.currentLocation[attr];
                });

                location.patch();
            }
        }

        function updateLocationAlias(location) {
            if (location.aliasEdit !== location.alias) {
                location.alias = location.aliasEdit;
                location.patch().then(ContentService.showSaved);
            }
        }

        function _setMaxLocationsView() {
            vm.maxLocationsReached = (vm.myLocations.length >= LocationService.getMaxLocations());
        }

        function _addLocationToListing(location) {
            return ListingService.getMyListings()
                .then(function (listings) {
                    if (listings.length) {
                        var resListings = _.map(listings, function (listing) {
                            return Restangular.restangularizeElement(null, listing, "listing");
                        });

                        return $q.all(_.map(resListings, function (listing) {
                            listing.locations.push(location.id);
                            if (listing.id) {
                                return listing.patch();
                            }
                            return listing.save();
                        }));
                    }
                });
        }
    }
})();
