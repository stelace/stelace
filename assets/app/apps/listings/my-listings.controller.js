/* global fbq, ga, moment */

(function () {

    angular
        .module("app.listings")
        .controller("MyListingsController", MyListingsController);

    function MyListingsController($http,
                                $location,
                                $q,
                                $rootScope,
                                $scope,
                                $state,
                                $stateParams,
                                $timeout,
                                $translate,
                                authentication,
                                authenticationModal,
                                // BrandService,
                                ContentService,
                                crossTabCommunication,
                                diacritics,
                                ezfb,
                                ListingCategoryService,
                                ListingService,
                                ListingTypeService,
                                LocationService,
                                loggerToServer,
                                MediaService,
                                Modal,
                                platform,
                                pricing,
                                promptInfoModal,
                                Restangular,
                                StelaceConfig,
                                StelaceEvent,
                                TagService,
                                time,
                                tools,
                                UserService,
                                usSpinnerService) {
        var formatDate = 'YYYY-MM-DD';
        var listeners               = [];
        var listingValidationFields    = ["title", "category", "description", "media", "price", "sellingPrice", "deposit"];
        var initialDefaultDeposit   = 50; // EUR
        var nbTimeUnits             = 7;
        var timeUnitBreakpointsNbUnits = [3, 7, 14, 28];
        var lastTimeUnitBreakpoint  = _.last(timeUnitBreakpointsNbUnits);
        var listingId               = parseInt($stateParams.id, 10);
        var listingTypeId           = parseInt($stateParams.listingTypeId, 10);
        var tags                    = [];  // save tag bindings until search
        var mediaSelectionInitiated = false;
        var savingListing              = false;
        var listingNameChanged         = false;
        var listing;
        var myListings;
        var listingCategories;
        var stepProgressDone;
        var myLocations;
        var isAdmin;
        var currentUser;
        var newListingTmp;
        var anonymousListingTmp;
        var debouncedSaveListing;
        var debouncedPriceRecommendation;
        var refreshLocations;
        var mediasSelector;
        var stlEvent;
        var stlEventData;
        var startDateOpenedOnce;
        var endDateOpenedOnce;
        var todayDate           = new Date();
        var dateOptions         = {
            minDate: todayDate,
            startingDay: 1,
            showWeeks: false,
            maxMode: "day",
            initDate: todayDate
            // Bug with use of datepicker-options for inline datepickers if initDate is not set
        };
        var stlConfig = StelaceConfig.getConfig();


        var vm = this;

        vm.forms = {};

        // Use autoblur directive on iOS to prevent browser UI toolbar and cursor from showing up on iOS Safari, despite readonly status
        // Accessibility issue: this fix prevents from tabing rapidly to submit button
        // See http://stackoverflow.com/questions/25928605/in-ios8-safari-readonly-inputs-are-handled-incorrectly
        // Also see angular-ui pull request, rejected for accessibility reasons: https://github.com/angular-ui/bootstrap/pull/3720
        vm.iOS                   = tools.isIOS();

        vm.activeTags           = StelaceConfig.isFeatureActive('TAGS');
        vm.showListingCategories = StelaceConfig.isFeatureActive('LISTING_CATEGORIES');
        vm.isListingCategoriesRequired = !!stlConfig.listing_categories__required;
        vm.listingType          = null;
        vm.listingType  = null;
        vm.listingTypes         = [];
        vm.showListingTypes     = false;
        vm.formatDate           = "dd/MM/yyyy";

        vm.isActivePriceRecommendation = StelaceConfig.isFeatureActive('PRICE_RECOMMENDATION');
        vm.isSmsActive          = StelaceConfig.isFeatureActive('SMS');
        vm.showPromptPhone      = vm.isSmsActive
                                    && (typeof stlConfig.phone_prompt__owner_level === 'undefined'
                                        || _.includes(['show', 'require'], stlConfig.phone_prompt__owner_level));
        vm.isPhoneRequired      = vm.isSmsActive && stlConfig.phone_prompt__owner_level === 'require';
        vm.showTags             = false;
        vm.viewCreate           = ($state.current.name === "listingCreate");
        vm.myListingsView          = ($state.current.name === "myListings");
        vm.showListingEditor       = !! listingId;
        vm.listingTypeId        = listingTypeId;
        vm.listingId               = listingId;
        vm.showSocialLogin      = authentication.isSocialLoginAllowed();
        vm.useSocialLogin       = false;
        vm.isAuthenticated      = false;
        vm.createAccount        = false;
        vm.factorDeposit        = 4;
        vm.defaultTimeUnitPrice = 0;
        vm.defaultDeposit       = initialDefaultDeposit;
        vm.maxDeposit           = 600; // EUR
        vm.listingBookingPrices    = _.map(timeUnitBreakpointsNbUnits, function (nbUnits) { return { nbUnits: nbUnits }; });
        vm.tags                 = [];
        vm.myListings              = [];
        vm.selectedListingToSocialShare = null;
        // vm.brands            = [];
        vm.listingCategoriesLvl1 = [];
        vm.listingCategoriesLvl2 = [];
        vm.listingTags             = [];
        vm.configMedias         = [];
        vm.isMoveModeAllowed    = false;
        vm.mediaMode            = "edit";
        vm.showTotalMediaUpload = false;
        vm.totalMediaUpload     = 0;
        vm.footerTestimonials   = true;
        vm.stickyOffset         = 208;
        vm.recommendedPrices    = {};
        vm.listingTypesProperties = {};
        vm.showFacebookShare    = !!platform.getFacebookAppId();
        vm.pricingSlider        = {
            options: {
                floor: 0,
                ceil: 2000,
                maxLimit: 10000,
                hideLimitLabels: true,
                enforceStep: false,
                translate: function (value) {
                    return "<strong>" + (value || 0) + "€</strong>";
                },
                customValueToPosition: sliderValueToPosition,
                customPositionToValue: sliderPositionToValue
            },
            overlay: {}
        };
        vm.showSideHelper = !vm.viewCreate && vm.showFacebookShare;

        vm.socialLogin                    = socialLogin;
        vm.selectListingCategoryLvl2         = selectListingCategoryLvl2;
        vm.categoryChanged                = categoryChanged;
        vm.saveListing                       = saveListing;
        // vm.updateBrandList             = updateBrandList;
        vm.showStep2                      = showStep2;
        vm.showStep3AndUpdatePrice        = showStep3AndUpdatePrice;
        vm.updateDeposit                  = updateDeposit;
        vm.onDeleteListing                   = onDeleteListing;
        vm.tagTransform                   = tagTransform;
        vm.getTags                        = getTags;
        vm.lostPasswordModal              = lostPasswordModal;
        vm.setDefaultPrices               = setDefaultPrices;
        vm.saveLocal                      = saveLocal;
        vm.touchMedia                     = touchMedia;
        vm.selectMedia                    = selectMedia;
        vm.removeMedia                    = removeMedia;
        vm.prevMedia                      = prevMedia;
        vm.nextMedia                      = nextMedia;
        vm.changeMediaMode                = changeMediaMode;
        vm.facebookShareMyListing         = facebookShareMyListing;
        vm.fixCustomPricing               = fixCustomPricing;
        vm.openDatepicker                 = openDatepicker;
        vm.selectListingTypeFromView      = selectListingTypeFromView;
        vm.addTimeAvailability            = addTimeAvailability;
        vm.removeListingAvailability      = removeListingAvailability;

        activate();


        function activate() {
            listeners.push(
                $rootScope.$on("isAuthenticated", function (event, isAuthenticated) {
                    vm.isAuthenticated = isAuthenticated;
                    currentUser = isAuthenticated ? currentUser : null;

                    if (! vm.isAuthenticated && ! vm.viewCreate) {
                        return $state.go("listingCreate");
                    } else if (! vm.isAuthenticated) {
                        vm.myListings = [];
                    }

                    return _fetchUserInfo();
                })
            );

            listeners.push(
                crossTabCommunication.subscribe("socialLogin", function (newValue) {
                    if (newValue === "success") {
                        UserService.unsetCurrentUser();
                        $rootScope.$emit("isAuthenticated", true);
                        authentication.setAuthenticated(true);
                        vm.useSocialLogin = true;
                        afterAuthentication(true);
                    }
                })
            );

            listeners.push(function () {
                if (mediasSelector) {
                    mediasSelector.clear();
                }
            });

            $scope.$on("$destroy", function () {
                _.forEach(listeners, function (listener) {
                    listener();
                });
            });

            debouncedPriceRecommendation = tools.debounceAction(getPriceRecommendation, 1000).process;

            if (vm.viewCreate) {
                StelaceEvent.sendEvent("Listing creation view")
                    .then(function (stelaceEvent) {
                        stlEvent = stelaceEvent;
                    });

                stlEventData = {
                    completed: {
                        type: false,
                        category: false,
                        name: false,
                        price: false,
                        sellingPrice: false,
                        picture: false,
                        description: false
                    }
                    // touchedLast: null // absence is meaningful
                };
            }

            $q.all({
                currentUser: UserService.getCurrentUser(),
                // brands: BrandService.getList(),
                listingCategories: ListingCategoryService.cleanGetList(),
                tags: vm.activeTags ? TagService.cleanGetList() : [],
                listingTypes: ListingTypeService.cleanGetList(),
                newListingTmp: ListingService.getNewListingTmp(null)
            }).then(function (results) {
                // brands                = results.brands;
                // vm.brands             = brands;
                currentUser           = results.currentUser;
                listingCategories     = results.listingCategories;
                myLocations           = tools.clearRestangular(results.myLocations);
                tags                  = _.sortBy(results.tags, function (tag) {
                    return - (tag.timesSearched + tag.timesAdded);
                }); // return most used and most searched tags first

                vm.listingTypes = results.listingTypes;
                vm.showListingTypes = vm.listingTypes.length > 1;

                if (vm.listingTypes.length === 1) {
                    vm.uniqueListingType = vm.listingTypes[0];
                }

                if (!listingId && vm.listingTypeId) {
                    var listingType = _.find(vm.listingTypes, function (listingType) {
                        return listingType.id === vm.listingTypeId;
                    });
                    if (listingType) {
                        vm.urlListingType = listingType;
                    }
                }

                vm.isAuthenticated    = !! currentUser;
                vm.createAccount      = ! currentUser;

                if (listingCategories.length) {
                    vm.listingCategoriesLvl1 = _selectListingCategory();
                } else {
                    vm.showListingCategories = false;
                    vm.isListingCategoriesRequired = false;
                }

                return _fetchUserInfo();
            }).then(function () {
                var urlCanonical = platform.getBaseUrl() + "/l/n";

                platform.setCanonicalLink(urlCanonical);
            });
        }

        function _fetchUserInfo() {
            var userPromises;

            return UserService.getCurrentUser()
                .then(function (user) {
                    currentUser  = user;
                    userPromises = {
                        newListingTmp: ListingService.getNewListingTmp(currentUser || null)
                    };

                    if (currentUser) {
                        _.assign(userPromises, {
                            myLocations: LocationService.getMine(),
                            myListings: ListingService.getMyListings(),
                            myImage: MediaService.getMyImage(),
                            isAdmin: UserService.isAdmin(),
                            anonymousListingTmp: ListingService.getNewListingTmp(null)
                        });
                    }

                    return $q.all(userPromises);
                })
                .then(function (results) {
                    newListingTmp       = results.newListingTmp;
                    myListings          = _.sortBy(results.myListings || [], function (listing) {
                        return - (listing.updatedDate);
                    });
                    myLocations      = results.myLocations;
                    isAdmin          = results.isAdmin;
                    anonymousListingTmp = results.anonymousListingTmp;

                    var shouldRecycleAnonymousListingTmp = currentUser
                        && (! newListingTmp || (newListingTmp && ! (newListingTmp.name && newListingTmp.listingCategoryId)));
                    // Keep work of anonymous user who has just authenticated
                    // Old user draft automatic locations or prices alone do not count for much if listing name is missing
                    if (shouldRecycleAnonymousListingTmp) {
                        newListingTmp = anonymousListingTmp;
                        ListingService.setNewListingTmp(null, null); // Avoid to pass input data to another future user
                    }

                    debouncedSaveListing = _getDebouncedSaveListing();

                    if (currentUser) {
                        currentUser.fullname = currentUser.getFullname();
                        vm.displayName       = currentUser.firstname || currentUser.fullname;
                        // save initial values
                        vm.noImage           = (results.myImage.url === platform.getDefaultProfileImageUrl());
                        vm.existingPhone     = currentUser.phoneCheck;

                        if (listingId) {
                            var index = _.findIndex(myListings, function (listing) {
                                return listing.id === listingId;
                            });
                            if (index === -1) {
                                $state.go("listingCreate");
                                return;
                            }
                            listing = myListings[index];
                        } else if (! vm.viewCreate && myListings.length === 0) { // myListings
                            return $state.go("listingCreate");
                        }

                        _.forEach(myListings, function (listing) {
                            listing.slug        = ListingService.getListingSlug(listing);
                            listing.ownerRating = { // expected format for listing-card's rating-stars
                                ratingScore: currentUser.ratingScore,
                                nbRatings: currentUser.nbRatings
                            };
                        });

                        vm.myListings = _.cloneDeep(myListings);

                        ListingService.populate(vm.myListings, {
                            // brands: brands,
                            listingCategories: listingCategories,
                            locations: myLocations,
                            nbTimeUnits: nbTimeUnits,
                            listingTypes: vm.listingTypes
                        });

                        vm.showSideHelper = !vm.viewCreate && !!vm.myListings.length && vm.showFacebookShare;

                        vm.selectedListingToSocialShare = vm.myListings.length ? vm.myListings[0] : null;

                        if (vm.activeTags) {
                            vm.showTags         = isAdmin;
                        }
                    }

                    if (listing) {
                        return fetchListingAvailabilities(listing.id);
                    } else {
                        initListingAvailabilities();
                    }
                })
                .then(function () {
                    if (! savingListing) {
                        _initListing();
                    }
                });
        }

        function _initListing() {
            if (! listing && ! newListingTmp) { // new listing from scratch
                vm.listing                  = {};
                vm.listingMedias            = [];
                vm.stepProgress             = 0;
                vm.step2                    = false;
                vm.step3                    = false;
                vm.saveListingBtnDisabled   = false;
                vm.validPrice               = false;
                vm.selectedListingCategoryLvl1 = null;
                vm.selectedListingCategoryLvl2 = null;
                vm.listingType              = vm.uniqueListingType || vm.urlListingType || null;
                vm.mediasMaxNbReached       = false;
                vm.listing.listingTypesIds  = [];
                vm.listing.quantity         = 1;
                vm.listing.recurringDatesPattern = '* * * * *';
                stepProgressDone            = {};

                vm.listingFullValidation       = true;
                vm.listingValidationFields     = {};
                _.forEach(listingValidationFields, function (field) {
                    vm.listingValidationFields[field] = false;
                });

                if (vm.listingType) {
                    selectListingType(vm.listingType);
                }

                if (currentUser) {
                    vm.listing.listLocations = _.map(myLocations, function (location) {
                        var l = _.clone(location);
                        l.checked = true;
                        return l;
                    });
                }

                vm.listingTags = [];
            } else if (! listing && newListingTmp) { // when using local storage
                vm.listing                  = _.cloneDeep(newListingTmp);
                vm.listingMedias            = [];
                vm.stepProgress             = 0;
                vm.step2                    = false;
                vm.step3                    = false;
                vm.saveListingBtnDisabled   = false;
                vm.validPrice               = false;
                vm.selectedListingCategoryLvl1 = null;
                vm.selectedListingCategoryLvl2 = null;

                if (newListingTmp.listingTypesIds) {
                    var indexedListingTypes = _.indexBy(vm.listingTypes, 'id');

                    vm.listing.listingTypesIds = newListingTmp.listingTypesIds;
                    vm.listingType = indexedListingTypes[newListingTmp.listingTypesIds[0]];
                }

                vm.listing.recurringDatesPattern = vm.listing.recurringDatesPattern || '* * * * *';
                vm.listing.quantity         = vm.listing.quantity || 1;
                stepProgressDone            = {};
                vm.mediasMaxNbReached       = false;

                vm.listingFullValidation       = true;
                vm.listingValidationFields     = {};
                _.forEach(listingValidationFields, function (field) {
                    vm.listingValidationFields[field] = false;
                });

                if (vm.listingType) {
                    selectListingType(vm.listingType);
                }

                if (currentUser
                    && (! vm.listing.listLocations || ! vm.listing.listLocations.length)
                ) {
                    // Possibly no location yet if using old anonymous ListingTmp
                    vm.listing.listLocations = _.map(myLocations, function (location) {
                        var l = _.clone(location);
                        l.checked = true;
                        return l;
                    });
                }

                _populateTags();
                _populateListingCategories();

                setDefaultPrices();
                showStep2();

                platform.debugDev("step 3 init newListingTmp", vm.listing)

                if (_.isFinite(vm.listing.sellingPrice) || _.isFinite(vm.listing.timeUnitPrice)) {
                    platform.debugDev("step 3 from new init")
                    showStep3AndUpdatePrice();
                }
            } else { // existing listing and user
                vm.listing = _.cloneDeep(listing);

                ListingService.populate(vm.listing, {
                    // brands: brands,
                    listingCategories: listingCategories,
                    locations: myLocations,
                    nbTimeUnits: nbTimeUnits,
                    listingTypes: vm.listingTypes
                });

                vm.listingMedias            = vm.listing.medias;
                vm.stepProgress             = 100;
                vm.step2                    = true;
                vm.step3                    = true;
                vm.validPrice               = true;
                vm.selectedListingCategoryLvl1 = null;
                vm.selectedListingCategoryLvl2 = null;
                stepProgressDone            = {};
                vm.viewCreate               = false;

                _loadListingType();

                _populateTags();
                _populateListingCategories();

                setDefaultPrices();

                _.forEach(vm.listingMedias, function (media) {
                    media.url += "?size=450x300";
                });

                var listingLocations = listing.locations;
                vm.listing.listLocations = _.map(myLocations, function (location) {
                    var l = _.clone(location);
                    var found = _.find(listingLocations, function (loc) {
                        return loc === location.id;
                    });
                    l.checked = !! found;
                    return l;
                });

                vm.selectedListingToSocialShare = vm.listing;

                vm.saveListingBtnDisabled = !listing.quantity && vm.listingTypeProperties.isTimeNone;
            }

            mediasSelector = ListingService.getMediasSelector({
                medias: vm.listingMedias
            });
            vm.configMedias      = mediasSelector.getConfigMedias();
            vm.isMoveModeAllowed = mediasSelector.isMoveModeAllowed();
            vm.mediaMode         = "edit";

            _initPrice();
            _computeDateConstraints(vm.editingListingAvailabilities);
            showStep2();

            listeners.push($scope.$watch("vm.listing.name", _.debounce(_nameChanged, vm.isActivePriceRecommendation ? 1500 : 0)));
            listeners.push($scope.$watch("vm.listing.sellingPrice", _.throttle(_sellingPriceChanged, 300)));
            listeners.push($scope.$watch("vm.listing.timeUnitPrice", _.throttle(_timeUnitPriceChanged, 300)));
        }

        function _loadListingType() {
            if (vm.listing.listingTypesIds.length) {
                var listingType = _.find(vm.listingTypes, function (listingType) {
                    return listingType.id === vm.listing.listingTypesIds[0];
                });
                selectListingType(listingType);
            }
        }

        function saveLocal(field) {
            if (vm.viewCreate && debouncedSaveListing) {
                debouncedSaveListing(field);
            }
        }

        function _getDebouncedSaveListing() {
            return _.debounce(function (field) {
                var newListing = _.cloneDeep(vm.listing);

                if (vm.showListingCategories) {
                    if (vm.selectedListingCategoryLvl2) {
                        newListing.listingCategoryId = vm.selectedListingCategoryLvl2.id;
                    } else if (vm.selectedListingCategoryLvl1) {
                        newListing.listingCategoryId = vm.selectedListingCategoryLvl1.id;
                    }
                }

                if (vm.activeTags) {
                    TagService.deduplicateTagsByInsensitiveName(vm.listingTags, tags);
                    newListing.tags = _.pluck(vm.listingTags, "id");
                }

                if (vm.listingType) {
                    newListing.listingTypesIds = [vm.listingType.id];
                }

                _updateUxEventData(field);

                return ListingService.setNewListingTmp(currentUser || null, newListing);
            }, 1000);
        }

        function _populateTags() {
            if (!vm.activeTags) {
                return;
            }

            var hashTags = _.indexBy(tags, "id");

            vm.listingTags = _.reduce(vm.listing.tags, function (memo, tagId) {
                var tag = hashTags[tagId];
                if (tag) {
                    memo.push(tag);
                }
                return memo;
            }, []);
        }

        function _populateListingCategories() {
            if (!vm.showListingCategories) {
                return;
            }

            if (vm.listing.listingCategoryId) {
                var cat = _.find(listingCategories, function (listingCat) {
                    return listingCat.id === vm.listing.listingCategoryId;
                });
                if (! cat.parentId) {
                    vm.selectedListingCategoryLvl1 = cat;
                } else {
                    vm.selectedListingCategoryLvl2 = cat;
                    vm.selectedListingCategoryLvl1 = _.find(listingCategories, function (listingCat) {
                        return listingCat.id === cat.parentId;
                    });
                }
                selectListingCategoryLvl2();
            }
        }

        function selectListingCategoryLvl2() {
            if (!vm.showListingCategories) {
                return;
            }

            vm.listingCategoriesLvl2 = _selectListingCategory(vm.selectedListingCategoryLvl1.id);
            updateBrandList();

            var selectedCatLvl2 = vm.selectedListingCategoryLvl2 ? _.find(vm.listingCategoriesLvl2, function (cat) {
                return cat.id === vm.selectedListingCategoryLvl2.id;
            }) : null;
            if (! selectedCatLvl2) {
                vm.selectedListingCategoryLvl2 = null;
            }

            if (! stepProgressDone.catLvl2) {
                vm.stepProgress += 25;
                stepProgressDone.catLvl2 = true;
            }
        }

        function _selectListingCategory(id) {
            return _.filter(listingCategories, function (listingCategory) {
                if (id) {
                    return listingCategory.parentId === id;
                } else {
                    return ! listingCategory.parentId;
                }
            });
        }

        function categoryChanged() {
            selectListingCategoryLvl2();
            showStep2();
            saveLocal("category");
        }

        function updateBrandList() {
            // var listingCategoryId;

            // if (vm.selectedListingCategoryLvl2) {
            //     listingCategoryId = vm.selectedListingCategoryLvl2.id;
            // } else if (vm.selectedListingCategoryLvl1) {
            //     listingCategoryId = vm.selectedListingCategoryLvl1.id;
            // }

            // BrandService
            //     .getList({ listingCategoryId: listingCategoryId })
            //     .then(function (brands) {
            //         vm.brands = brands;
            //     });
        }

        function _nameChanged(newName, oldName) {
            listingNameChanged = listingNameChanged || newName !== oldName;
            platform.debugDev("_nameChanged:", listingNameChanged, newName, "<=", oldName)

            if (! listingNameChanged
                || ! newName
            ) {
                return;
            }

            showStep2();
            $rootScope.$apply();
            saveLocal("name");
        }

        function showStep2() {
            if (!vm.listingType) {
                return;
            }
            if (! vm.listing || ! vm.listing.name) {
                return;
            }

            if (! vm.selectedListingCategoryLvl1 && vm.isListingCategoriesRequired) {
                return;
            }

            if (vm.isActivePriceRecommendation) {
                debouncedPriceRecommendation();
            }

            platform.debugDev("show step 2");
            vm.step2 = true;

            if (! stepProgressDone.listingName) {
                vm.stepProgress += 25;
                stepProgressDone.listingName = true;
            }
        }

        function getPriceRecommendation() {
            var lettersRegex = /[a-zA-Z]{2,}/; // at least 2 letters
            var nameTooShort = ! vm.listing.name || ! lettersRegex.test(diacritics.remove(vm.listing.name));
            var start = moment();

            platform.debugDev("call recommendation, listingNameChanged:", !! listingNameChanged);

            // useless to get recommandation for same existing listing name
            if (nameTooShort
                || ! listingNameChanged
            ) {
                platform.debugDev("Abort recommendation, name too short:", nameTooShort);
                return;
            }

            usSpinnerService.spin("price-recommendation-spinner");
            vm.recommendedPrices.status = "pending";

            return ListingService.getRecommendedPrices(vm.listing.name)
                .then(function (prices) {
                    var recommendedValue = prices && prices.price;
                    if (! recommendedValue) {
                        return;
                    }

                    _.assign(vm.recommendedPrices, prices);

                    vm.pricingSlider.options.ceil       = getPricingSliderCeil(recommendedValue);
                    vm.pricingSlider.options.ticksArray = [0, Math.round(recommendedValue * 0.7), Math.round(recommendedValue * 1.1)];
                    vm.recommendedPrices.status         = "ok";

                    vm.pricingSliderOverlayLeft  = sliderValueToPosition(vm.pricingSlider.options.ticksArray[1]) * 100  + "%";
                    vm.pricingSliderOverlayRight = (1 - sliderValueToPosition(vm.pricingSlider.options.ticksArray[2])) * 100 + "%";

                    platform.debugDev(vm.pricingSlider, vm.pricingSliderOverlayLeft, vm.pricingSliderOverlayRight)

                    if (typeof vm.listing.sellingPrice === "undefined") {
                        vm.listing.sellingPrice = vm.recommendedPrices.price;
                        platform.debugDev("step 3 from price reco");
                        showStep3AndUpdatePrice();
                    }

                    platform.debugDev("step 2 reco end");
                })
                .finally(function() {
                    vm.recommendedPrices.delay = moment().diff(start);
                    stopRecommendationSpinner(vm.recommendedPrices.delay);

                    if (vm.recommendedPrices.status !== "ok") {
                        vm.recommendedPrices.status  = "fail";
                        vm.pricingSliderOverlayLeft  = "100%";
                        vm.pricingSliderOverlayRight = 0;
                    }

                    _updateUxEventData();
                    listingNameChanged = false;
                });

            function stopRecommendationSpinner(delay) {
                if (delay < 1000) {
                    return tools.delay(1000 - delay)
                        .then(function () {
                            usSpinnerService.stop("price-recommendation-spinner");
                        });
                }
                usSpinnerService.stop("price-recommendation-spinner");
            }
        }

        function sliderValueToPosition(val, minVal, maxVal) {
            // when using outside of angular slider logic
            minVal = _.isFinite(minVal) ? minVal : vm.pricingSlider.options.floor;
            maxVal = _.isFinite(maxVal) ? maxVal : vm.pricingSlider.options.ceil;

            val = Math.sqrt(val);
            minVal = Math.sqrt(minVal);
            maxVal = Math.sqrt(maxVal);
            var range = maxVal - minVal;
            return (val - minVal) / range;
        }

        function sliderPositionToValue(percent, minVal, maxVal) {
            minVal = Math.sqrt(minVal);
            maxVal = Math.sqrt(maxVal);
            var value = percent * (maxVal - minVal) + minVal;
            return Math.pow(value, 2);
        }

        function getPricingSliderCeil(reference) {
            var ceil = tools.clampNumber(reference * 4, 500, vm.pricingSlider.options.maxLimit);

            return tools.roundDecimal(ceil, -2, "ceil");
        }

        function _sellingPriceChanged(newPrice, oldPrice) {
            var sellingPriceChanged = newPrice !== oldPrice;
            platform.debugDev("_sellingPriceChanged:", sellingPriceChanged, newPrice, "<=", oldPrice)

            if (! sellingPriceChanged || ! _.isFinite(newPrice)) { // init watch
                return;
            }

            showStep3AndUpdatePrice();
        }

        function _timeUnitPriceChanged(newPrice, oldPrice) {
            var priceChanged = newPrice !== oldPrice;
            platform.debugDev("_timeUnitPriceChanged:", priceChanged, newPrice, "<=", oldPrice)

            if (! priceChanged || ! _.isFinite(newPrice)) { // init watch
                return;
            }

            showStep3AndUpdatePrice();
        }

        function showStep3AndUpdatePrice() {
            if (! vm.listing
                || !vm.listingType
                || (typeof vm.listing.sellingPrice === "undefined" && !vm.listingTypeProperties.isTimeFlexible)
                || (typeof vm.listing.timeUnitPrice === "undefined" && vm.listingTypeProperties.isTimeFlexible)
            ) {
                return;
            }
            platform.debugDev("show step 3 begin");

            vm.step3 = true;

            if (! stepProgressDone.listingPrice) {
                vm.stepProgress += 25;
                stepProgressDone.listingPrice = true;
            }

            setDefaultPrices();
            vm.saveLocal('price');
        }

        function _initPrice() {
            if (vm.listing.sellingPrice) {
                $timeout(function () {
                    // let ng-model selling price trickle down to slider
                    vm.pricingSlider.options.ceil = getPricingSliderCeil(vm.listing.sellingPrice);
                    // $scope.$broadcast('rzSliderForceRender');
                });
            }

            if (!vm.listing.customPricingConfig
             || !vm.listing.customPricingConfig.duration
            ) {
                return;
            }

            var customPrices = pricing.getDurationPrice({
                customConfig: vm.listing.customPricingConfig,
                timeUnitPrice: vm.listing.timeUnitPrice,
                nbTimeUnits: _.last(vm.listingBookingPrices).nbUnits,
                array: true
            });

            _.forEach(vm.listingBookingPrices, function (booking) {
                var customPrice = customPrices[booking.nbUnits - 1];
                if (booking.defaultPrice !== customPrice) {
                    booking.price = customPrice;
                }
            });
        }

        function setDefaultPrices() {
            if (!vm.listingTypeProperties) {
                return;
            }

            var sellingPrice = getSellingPrice();
            var timeUnitPrice = getTimeUnitPrice();

            platform.debugDev("setDefaultPrices begin");

            if (!vm.listingTypeProperties.isTimeFlexible && _.isFinite(sellingPrice)) {
                vm.validPrice = true;
            } else if (vm.listingTypeProperties.isTimeFlexible && _.isFinite(timeUnitPrice)) {
                vm.validPrice = true;

                var prices = pricing.getDurationPrice({
                    timeUnitPrice: timeUnitPrice,
                    nbTimeUnits: lastTimeUnitBreakpoint,
                    array: true
                });

                _.forEach(vm.listingBookingPrices, function (booking) {
                    booking.defaultPrice = prices[booking.nbUnits - 1];
                });

                vm.defaultDeposit = getDefaultDeposit(timeUnitPrice);
                fixCustomPricing();
            }

            if (vm.validPrice) {
                showStep2();
            } else {
                vm.defaultTimeUnitPrice = 0;
                vm.defaultDeposit     = 0;

                _.forEach(vm.listingBookingPrices, function (booking) {
                    booking.defaultPrice = 0;
                });
            }
        }

        function updateDeposit() {
            if (vm.listing.deposit && vm.listing.deposit > vm.maxDeposit) {
                vm.listing.deposit = vm.maxDeposit;
                vm.showDepositWarning = true;
            } else {
                vm.showDepositWarning = false;
            }
        }

        function socialLogin(provider) {
            authentication.socialLogin(provider);
        }

        function saveListing() {
            var updatingListing;

            savingListing       = true;
            // refresh after promptModal only if no current locations
            refreshLocations = !! vm.listing.listLocations;

            var notificationOptions = {
                timeOut: 0,
                closeButton: true
            };

            if (! vm.listing.name) {
                return ContentService.showNotification({
                    titleKey: 'listing.error.missing_title_title',
                    messageKey: 'listing.error.missing_title_message',
                    options: notificationOptions
                });
            }
            if (isNaN(parseFloat(vm.listing.sellingPrice)) && !vm.listingTypeProperties.isTimeFlexible) {
                return ContentService.showNotification({
                    titleKey: 'listing.error.missing_price_title',
                    messageKey: 'listing.error.missing_price_message',
                    options: notificationOptions
                });
            }
            if (isNaN(parseFloat(vm.listing.timeUnitPrice)) && vm.listingTypeProperties.isTimeFlexible) {
                return ContentService.showNotification({
                    titleKey: 'listing.error.missing_time_unit_price_title',
                    messageKey: 'listing.error.missing_time_unit_price_message',
                    options: notificationOptions
                });
            }
            if (! vm.listing.description) {
                return ContentService.showNotification({
                    titleKey: 'listing.error.missing_description_title',
                    messageKey: 'listing.error.missing_description_message',
                    options: notificationOptions
                });
            }
            if (vm.listingMedias.length === 0) {
                return ContentService.showNotification({
                    titleKey: 'listing.error.missing_image_title',
                    messageKey: 'listing.error.missing_image_message',
                    options: notificationOptions
                });
            }

            if (! vm.isAuthenticated
                && (! vm.email || ! vm.password)
            ) {
                return ContentService.showNotification({ messageKey: 'authentication.error.missing' });
            }
            if (! vm.isAuthenticated
                && ! tools.isEmail(vm.email)
            ) {
                vm.invalidAddress = true;
                return ContentService.showNotification({ messageKey: 'authentication.error.invalid_email', type: 'warning' });
            }

            vm.useSocialLogin      = false;

            vm.saveListingBtnDisabled = true;
            usSpinnerService.spin('save-listing-spinner');

            $q.when(true)
                .then(function () {
                    if (vm.isAuthenticated && listing) {
                        updatingListing = true;
                        return _updateListing();
                    } else if (vm.isAuthenticated) {
                        return true;
                    } else if (vm.createAccount) {
                        return _register();
                    } else {
                        return _login();
                    }
                })
                .then(function (isAuthenticated) {
                    return ! updatingListing && afterAuthentication(isAuthenticated);
                })
                .catch(afterAuthenticationErrorHandler)
                .finally(function () {
                    usSpinnerService.stop('save-listing-spinner');
                    vm.saveListingBtnDisabled = false;
                    savingListing             = false;
                });
        }

        function afterAuthentication(isAuthenticated) {
            return $q.when(isAuthenticated)
                .then(function (isAuthenticated) {
                    if (isAuthenticated) {
                        var askInfo = [
                            'email',
                            'mainLocation',
                        ];

                        if (vm.isPhoneRequired) {
                            askInfo.push('phone');
                        }

                        return promptInfoModal.ask(askInfo, { isListingOwner: true });
                    } else {
                        return $q.reject("not authenticated");
                    }
                })
                .then(function (promptResults) {
                    if (! promptResults.email) {
                        return $q.reject("missing email");
                    }

                    return LocationService.getMine(refreshLocations);
                })
                .then(function (locations) {
                    myLocations = locations;

                    // New user can't select specific locations yet
                    if (! vm.listing.listLocations || ! vm.listing.listLocations.length) {
                        vm.listing.listLocations = _.map(myLocations, function (location) {
                            var l = _.clone(location);
                            l.checked = true;
                            return l;
                        });
                    }

                    if (locations && locations.length) {
                        return _createListing();
                    } else {
                        ContentService.showNotification({
                            titleKey: 'listing.error.missing_location_title',
                            messageKey: 'listing.error.missing_location_message'
                        });
                        return false;
                    }

                    // return _createListing();
                })
                .catch(afterAuthenticationErrorHandler);
        }

        function afterAuthenticationErrorHandler(err) {
            if (err === "missing email") {
                ContentService.showNotification({
                    titleKey: 'listing.error.missing_email_title',
                    messageKey: 'listing.error.missing_email_message',
                    type: 'warning'
                });
            } else if (err === "not authenticated") {
                ContentService.showNotification({
                    titleKey: 'listing.error.account_required_title',
                    messageKey: 'listing.error.account_required_message',
                    type: 'info'
                });
            } else if (err !== "wrong password") {
                ContentService.showError(err);
            }
        }

        function _setSaveAttrs(attrs) {
            var sellingPrice = getSellingPrice();
            var timeUnitPrice = getTimeUnitPrice();

            var validPrice = false;

            if (!vm.listingTypeProperties.isTimeFlexible && _.isFinite(sellingPrice)) {
                validPrice = true;
                attrs.sellingPrice = sellingPrice;
            } else if (vm.listingTypeProperties.isTimeFlexible && _.isFinite(timeUnitPrice)) {
                validPrice = true;
                attrs.timeUnitPrice = timeUnitPrice;
                attrs.deposit = getDeposit(timeUnitPrice);
            }

            if (!validPrice) {
                return;
            }

            if (vm.showListingCategories) {
                if (vm.selectedBrand) {
                    attrs.brandId = vm.selectedBrand.id;
                }
                if (vm.selectedListingCategoryLvl2) {
                    attrs.listingCategoryId = vm.selectedListingCategoryLvl2.id;
                } else if (vm.selectedListingCategoryLvl1) {
                    attrs.listingCategoryId = vm.selectedListingCategoryLvl1.id;
                }
            }

            if (vm.listingTypeProperties.isTimeFlexible) {
                var customPricing = getCustomPricingConfig(timeUnitPrice);
                attrs.customPricingConfig = {
                    duration: customPricing
                };
            }

            attrs.locations = _.reduce(vm.listing.listLocations, function (memo, location) {
                if (location.checked) {
                    memo.push(location.id);
                }
                return memo;
            }, []);

            if (! attrs.locations.length) {
                ContentService.showNotification({
                    titleKey: 'listing.error.missing_location_title',
                    messageKey: 'listing.error.missing_location_message',
                    timeOut: 20000
                });
            }
        }

        function _createListing() {
            var createAttrs = _.pick(vm.listing, [
                "name",
                "reference",
                "description",
                "stateComment",
                "quantity",
                "bookingPreferences",
                "acceptFree",
                "listingTypesIds",
                "recurringDatesPattern"
            ]);

            vm.listingMedias           = mediasSelector.getMedias();
            var uploadMediasManager = ListingService.getUploadMediasManager({
                medias: vm.listingMedias,
                notify: _refreshMediaProgressBar
            });

            var validationFields = _.filter(listingValidationFields, function (field) {
                return vm.listingValidationFields[field];
            });
            if (vm.listingFullValidation) {
                createAttrs.validation = true;
                createAttrs.validationFields = ["All"]; // easier to read for backoffice than full list
            } else {
                if (validationFields.length) {
                    createAttrs.validation       = true;
                    createAttrs.validationFields = validationFields;
                } else {
                    createAttrs.validation = false;
                }
            }

            createAttrs.listingTypesIds = [vm.listingType.id];
            createAttrs.quantity = parseInt(createAttrs.quantity, 10); // get an integer

            var mediasIds = [];
            var createdListing;

            return $q.when(createAttrs)
                .then(_setSaveAttrs)
                .then(function () {
                    TagService.deduplicateTagsByInsensitiveName(vm.listingTags, tags);

                    return _createNewTags();
                })
                .then(function () {
                    createAttrs.tags = _.pluck(vm.listingTags, "id");
                    return ListingService.post(createAttrs);
                })
                .then(function (newListing) {
                    createdListing = newListing;
                    return updateListingAvailabilities(createdListing);
                })
                .then(function () {
                    // useful because other functions use it below
                    ListingService.populate(createdListing, {
                        listingTypes: vm.listingTypes
                    });

                    vm.totalMediaUpload     = 0;
                    vm.showTotalMediaUpload = true;

                    uploadMediasManager.start();

                    return ListingService
                        .uploadMedias(createdListing.id, vm.listingMedias, [], function (mediaId, progress) {
                            uploadMediasManager.updateProgress(mediaId, progress);
                        })
                        .then(function (result) {
                            _.forEach(vm.configMedias, function (configMedia) {
                                configMedia.progress = null;
                            });
                            vm.showTotalMediaUpload = false;

                            uploadMediasManager.stop();

                            if (result.uploadFail) {
                                var mediaUploadError = new Error("Media upload failed during listing creation");
                                ContentService.showError(mediaUploadError);
                            }
                            if (result.change) {
                                mediasIds = _.union(mediasIds, result.mediasIds);
                                return createdListing.updateMedias(result.mediasIds);
                            }
                        });
                })
                .then(function () {
                    return ListingService.getMyListings(true);
                })
                .then(function (myListings) {
                    if (vm.createAccount && ! vm.useSocialLogin) {
                        ContentService.showNotification({
                            messageKey: 'user.account.email_validation_link_sent',
                            timeOut: 0,
                            closeButton: true
                        });
                    }

                    vm.myListings = _.cloneDeep(myListings);

                    ListingService.populate(vm.myListings, {
                        // brands: brands,
                        listingCategories: listingCategories,
                        locations: myLocations,
                        nbTimeUnits: nbTimeUnits,
                        listingTypes: vm.listingTypes
                    });

                    ListingService.setNewListingTmp(null, null);
                    ListingService.setNewListingTmp(currentUser, null);

                    newListingTmp       = null;
                    vm.createAccount = false;

                    _initListing(); // reset form content if viewCreate (no listingId in URL)
                    $rootScope.$emit("refreshStickySidebarPosition");
                    _resetMyListingsEditorState();

                    ContentService.showNotification({
                        titleKey: 'listing.edition.listing_saved',
                        messageKey: 'listing.edition.publication_status',
                        messageValues: {
                            published: !createdListing.validated ? 'after_validation' : 'now',
                            SERVICE_NAME: stlConfig.SERVICE_NAME
                        },
                        type: 'success'
                    });

                    // default listing creation: no medias
                    // so if none, do not perform update media
                    if (mediasIds.length) {
                        return createdListing.updateMedias(mediasIds);
                    } else {
                        return true;
                    }
                })
                .finally(function () {
                    if (createdListing) {
                        // Always send Google Analytics since user is engaged
                        var gaLabel = 'listingId: ' + createdListing.id;
                        ga('send', 'event', 'Listings', 'Create', gaLabel);
                        // Facebook event
                        var fbEventParams = {
                            content_name: createdListing.name,
                            content_ids: [createdListing.id],
                            stelace_offer_types: ListingService.getFbOfferTypes(createdListing)
                        };

                        var fbTimeUnitPrice = ListingService.getFbTimeUnitPrice(createdListing);
                        var fbSellingPrice  = ListingService.getFbSellingPrice(createdListing);
                        if (typeof fbTimeUnitPrice === "number") {
                            fbEventParams.stelace_time_unit_price = fbTimeUnitPrice;
                        }
                        if (typeof fbSellingPrice === "number") {
                            fbEventParams.stelace_price = fbSellingPrice;
                        }

                        fbq('trackCustom', 'AddListing', fbEventParams);
                    }
                });
        }

        function _updateListing() {
            vm.listingMedias           = mediasSelector.getMedias();
            var uploadMediasManager = ListingService.getUploadMediasManager({
                medias: vm.listingMedias,
                notify: _refreshMediaProgressBar
            });

            return $q.when(vm.listing)
            .then(_setSaveAttrs)
            .then(function () {
                    Restangular.restangularizeElement(null, vm.listing, "listing");

                    TagService.deduplicateTagsByInsensitiveName(vm.listingTags, tags);

                    return _createNewTags();
                })
                .then(function () {
                    vm.listing.tags = _.pluck(vm.listingTags, "id");
                    return vm.listing.patch();
                })
                .then(function () {
                    return updateListingAvailabilities(vm.listing);
                })
                .then(function () {
                    vm.totalMediaUpload     = 0;
                    vm.showTotalMediaUpload = true;

                    uploadMediasManager.start();

                    return ListingService
                        .uploadMedias(vm.listing.id, vm.listingMedias, listing.medias, function (mediaId, progress) {
                            uploadMediasManager.updateProgress(mediaId, progress);
                        })
                        .then(function (result) {
                            _.forEach(vm.configMedias, function (configMedia) {
                                configMedia.progress = null;
                            });
                            vm.showTotalMediaUpload = false;

                            uploadMediasManager.stop();

                            if (result.uploadFail) {
                                var mediaUploadError = new Error("Media upload failed during listing update");
                                ContentService.showError(mediaUploadError);
                            }
                            if (result.change) {
                                return vm.listing.updateMedias(result.mediasIds);
                            }
                        });
                })
                .then(function () {
                    return ListingService.getMyListings(true);
                })
                .then(function (myListings) {
                    listing = _.find(myListings, function (i) {
                        return listing.id === i.id;
                    });

                    vm.myListings = _.cloneDeep(myListings);

                    ListingService.populate(vm.myListings, {
                        // brands: brands,
                        listingCategories: listingCategories,
                        locations: myLocations,
                        nbTimeUnits: nbTimeUnits,
                        listingTypes: vm.listingTypes
                    });

                    return fetchListingAvailabilities(listing.id);
                })
                .then(function () {
                    _initListing();
                    ContentService.showSaved();
                });
        }

        // See ListingService.getUploadMediasManager for info about parameters
        function _refreshMediaProgressBar(totalProgress, configProgress) {
            var indexedConfigMedias = _.indexBy(vm.configMedias, "id");

            vm.totalMediaUpload = totalProgress;

            _.forEach(configProgress, function (obj) {
                indexedConfigMedias[obj.id].progress = obj.progress;
            });

            $scope.$digest();
        }

        function _createNewTags() {
            var newTags = _.filter(vm.listingTags, function (tag) {
                return tag.isNew;
            });

            return $q.all(
                _.map(newTags, function (tag) {
                    var createAttrs = {
                        name: tag.name
                    };
                    return TagService.post(createAttrs)
                        .then(function (newTag) {
                            tag.id = newTag.id;
                        });
                })
            ).then(function () {
                if (newTags.length) {
                    return TagService
                        .cleanGetList()
                        .then(function (tgs) {
                            tags = tgs;
                        });
                }
            });
        }

        function onDeleteListing(listingId) {
            var index = _.findIndex(vm.myListings, function (listing) {
                return listing.id === listingId;
            });
            vm.myListings.splice(index, 1);
        }

        function tagTransform(tag) {
            return {
                id: _.uniqueId("tag_"),
                name: tag,
                isNew: true
            };
        }

        function getTags(query) {
            if (query && query.length > 1) {
                vm.tags = tags;
            } else {
                vm.tags = [];
            }
        }

        function lostPasswordModal() {
            authenticationModal.process("lost");
        }

        function _login() {
            return authentication
                .login(vm.email, vm.password)
                .then(function (res) {
                    return authentication.setToken(res.data.access_token);
                })
                .then(function () {
                    authentication.setAuthenticated(true);

                    $rootScope.$emit("isAuthenticated", true);

                    return true;
                })
                .catch(function (/* err */) {
                    vm.password = null;
                    ContentService.showNotification({
                        messageKey: 'authentication.error.incorrect',
                        type: 'warning'
                    });
                    return $q.reject("wrong password");
                });
        }

        function _register() {
            return authentication
                .register(vm.email, vm.password)
                .then(function (/* res */) {
                    return authentication.login(vm.email, vm.password);
                })
                .then(function (res) {
                    // Google Analytics event
                    var url = $location.protocol() + "://" + $location.host() + ($state.current.urlWithoutParams || "");
                    ga('send', 'event', 'Accounts', 'Register', 'url: ' + url);
                    // Facebook event
                    fbq('track', 'CompleteRegistration');
                    return authentication.setToken(res.data.access_token);
                })
                .then(function () {
                    authentication.setAuthenticated(true);

                    $rootScope.$emit("isAuthenticated", true);

                    return UserService.getCurrentUser();
                })
                .then(function (user) {
                    if (vm.firstname) {
                        user.firstname = vm.firstname;
                        return user.patch();
                    } else {
                        return true;
                    }
                })
                .catch(function (err) {
                    if (err.data && err.data.message === "email exists") {
                        return authentication
                            .login(vm.email, vm.password)
                            .then(function (res) {
                                return authentication.setToken(res.data.access_token);
                            })
                            .then(function () {
                                authentication.setAuthenticated(true);

                                $rootScope.$emit("isAuthenticated", true);

                                return true;
                            })
                            .catch(function (/* err */) {
                                // Log user in if password is correct but help her to remember if not.
                                ContentService.showNotification({
                                    messageKey: 'authentication.error.email_already_used'
                                });
                                return $q.reject("wrong password");
                            });
                    } else {
                        return $q.reject(err);
                    }
                })
                .finally(function () {
                    vm.password = null;
                });
        }

        function _resetMyListingsEditorState() {
            vm.forms.myListingsEditor.$setPristine();
            vm.forms.myListingsEditor.$setUntouched();
        }

        function touchMedia(/* mediaId */) {
            _currentMediaSelection();
        }

        function selectMedia(mediaId, file) {
            mediasSelector
                .select(mediaId, file)
                .then(function () {
                    vm.isMoveModeAllowed = mediasSelector.isMoveModeAllowed();
                    vm.listingMedias        = mediasSelector.getMedias();
                    _updateUxEventData("picture");
                });
        }

        function removeMedia(mediaId) {
            mediasSelector.remove(mediaId);
            vm.isMoveModeAllowed = mediasSelector.isMoveModeAllowed();
            vm.listingMedias        = mediasSelector.getMedias();
        }

        function prevMedia(mediaId) {
            mediasSelector.prev(mediaId);
        }

        function nextMedia(mediaId) {
            mediasSelector.next(mediaId);
        }

        function changeMediaMode() {
            if (vm.mediaMode === "edit") {
                vm.mediaMode = "move";
            } else {
                vm.mediaMode = "edit";
            }
            mediasSelector.setMode(vm.mediaMode);
        }

        function fixCustomPricing() {
            var timeUnitPrice = getTimeUnitPrice();

            var customPricing = getCustomPricingConfig(timeUnitPrice);

            if (customPricing
                && ! pricing.isValidCustomDurationConfig(customPricing)
            ) {
                var lastPrice;

                _.forEach(customPricing.breakpoints, function (breakpoint, index) {
                    if (index !== 0
                        && breakpoint.price < lastPrice
                    ) {
                        breakpoint.price = lastPrice;
                    }

                    lastPrice = breakpoint.price;
                });

                _.forEach(vm.listingBookingPrices, function (bookingPrice, index) {
                    // difference of index because bookingPrices doesn't include nbUnits=1 price
                    var correctPrice = customPricing.breakpoints[index + 1].price;

                    if (bookingPrice.defaultPrice !== correctPrice) {
                        bookingPrice.price = correctPrice;
                    }
                });
            }
        }

        function _currentMediaSelection() {
            mediaSelectionInitiated = true;
            _updateUxEventData("picture");
        }

        function _updateUxEventData(lastTouchedField) {
            if (! vm.viewCreate) {
                return;
            }

            var fields = _.reject(_.keys(stlEventData.completed), function (k) {
                return (k === "picture");
            });
            var nbPictures = mediasSelector.getMedias().length;
            var formField;

            _.forEach(fields, function (field) {
                formField = vm.forms.myListingsEditor["listing" + tools.toStartCase(field)];

                if (formField && formField.$touched && formField.$invalid) {
                    stlEventData.completed[field] = "failed";
                } else if (formField && formField.$valid) {
                    stlEventData.completed[field] = true;
                }
            });

            if (nbPictures > 0) {
                stlEventData.completed.picture = true;
            } else if (mediaSelectionInitiated) {
                stlEventData.completed.picture = "failed";
            }

            if (lastTouchedField) {
                stlEventData.touchedLast = lastTouchedField;
            }

            _addPriceRecommendationInfoToEventData(stlEventData);

            stlEvent.update({ data: stlEventData });
        }

        function _addPriceRecommendationInfoToEventData(data) {
            if (vm.recommendedPrices.queryId) {
                data.priceRecommendation = {
                    status: vm.recommendedPrices.status,
                    queryId: vm.recommendedPrices.queryId,
                    sourceQueryId: vm.recommendedPrices.sourceQueryId,
                    reuse: vm.recommendedPrices.queryId !== vm.recommendedPrices.sourceQueryId,
                    delay: vm.recommendedPrices.delay
                };
            }
        }

        function facebookShareMyListing() {
            if (! vm.selectedListingToSocialShare || ! vm.selectedListingToSocialShare.slug) {
                return;
            }

            usSpinnerService.spin("share-listing-spinner");

            var shareUtmTags = {
                utmSource: "facebook",
                utmMedium: "social",
                utmCampaign: "listing-share-owner",
                utmContent: "picture"
            };
            var listingUrl     = platform.getListingShareUrl(vm.selectedListingToSocialShare.slug, shareUtmTags);
            var description = "Ajouté(e) par " + vm.displayName + " en (presque) un éclair. "
                + "Empruntez ou achetez l'objet de vos rêves en toute sécurité ou, comme " + vm.displayName + ", créez vos propres annonces sur Sharinplace.";
            var stlEventData = {
                tagsIds: vm.selectedListingToSocialShare.tags,
                origin: listingId ? "editListing" : "myListings",
                isOwner: true
            };
            var stlEvent;

            StelaceEvent.sendEvent("Listing social share", {
                type: "click",
                listingId: vm.selectedListingToSocialShare.id,
                data: stlEventData
            })
            .then(function (stelaceEvent) {
                stlEvent = stelaceEvent;

                ezfb.ui({
                    method: "share",
                    href: listingUrl,
                    // Parameters not documented
                    // See http://stackoverflow.com/questions/23781698/fb-ui-share-set-the-title-message-and-image#answer-33924247
                    description: description,
                    // picture: "https://sharinplace.fr/api/media/get/57/f461de3c-d882-43bc-bfbd-c1c90b294a38?size=300x300",
                    // title: "Enjoy"
                }, function (response) {
                    // In Graph API v2.8, response after effective sharing is []
                    if (response && ! response.error_code) { // error code only for fb authorized users
                        ContentService.showNotification({
                            messageKey: 'notification.shared'
                        });
                        stlEventData.success = true;
                        stlEvent.update({ data: stlEventData });
                    }
                });
            })
            .finally(function () {
                usSpinnerService.stop("share-listing-spinner");
            });
        }

        function getCustomPricingConfig(timeUnitPrice) {
            if (typeof timeUnitPrice !== 'number') {
                return;
            }

            var defaultPrices = pricing.getDurationPrice({
                timeUnitPrice: timeUnitPrice,
                nbTimeUnits: lastTimeUnitBreakpoint,
                array: true
            });
            var customPricing = {
                breakpoints: []
            };
            var customPrice = false;

            customPricing.breakpoints.push({
                nbUnits: 1,
                price: timeUnitPrice
            });

            _.forEach(timeUnitBreakpointsNbUnits, function (nbUnits) {
                var bookingPrice = _.find(vm.listingBookingPrices, function (bookingPrice) {
                    return bookingPrice.nbUnits === nbUnits;
                });
                var custom = (typeof bookingPrice.price !== "undefined" && bookingPrice.price !== null);
                var newBreakpoint = {
                    nbUnits: nbUnits,
                    price: custom ? bookingPrice.price : defaultPrices[nbUnits - 1]
                };

                if (custom) {
                    customPrice = true;
                }

                customPricing.breakpoints.push(newBreakpoint);
            });

            return customPrice ? customPricing : null;
        }

        function getSellingPrice() {
            if (typeof vm.listing.sellingPrice === "undefined") {
                return;
            }

            var sellingPrice = parseFloat(vm.listing.sellingPrice);

            if (isNaN(sellingPrice)) {
                return;
            }

            return sellingPrice;
        }

        function getTimeUnitPrice(defaultTimeUnitPrice) {
            if (typeof vm.listing.timeUnitPrice === "undefined") {
                return defaultTimeUnitPrice;
            }

            var timeUnitPrice = parseFloat(vm.listing.timeUnitPrice);

            if (isNaN(timeUnitPrice)) {
                return defaultTimeUnitPrice;
            } else {
                return timeUnitPrice;
            }
        }

        // function getDefaultTimeUnitPrice(sellingPrice) {
        //     return $q.when(sellingPrice)
        //         .then(pricing.rentingPriceRecommendation)
        //         .then(function(recommendation) {
        //             _.assign(vm.recommendedPrices, recommendation);

        //             vm.defaultTimeUnitPrice = _.get(recommendation, "timeUnitPrice") || vm.defaultTimeUnitPrice;

        //             return vm.defaultTimeUnitPrice;
        //         });
        // }

        function getDeposit(timeUnitPrice) {
            var defaultDeposit = getDefaultDeposit(timeUnitPrice);

            var deposit;

            if (typeof vm.listing.deposit === "undefined") {
                return defaultDeposit;
            }

            deposit = parseFloat(vm.listing.deposit);

            if (! isNaN(deposit)) {
                return deposit;
            } else {
                return defaultDeposit;
            }
        }

        function getDefaultDeposit(timeUnitPrice) {
            return tools.clampNumber(timeUnitPrice * vm.factorDeposit, initialDefaultDeposit, vm.maxDeposit);
        }

        function selectListingTypeFromView(listingType) {
            selectListingType(listingType);
            showStep2();
            saveLocal('type');
        }

        function selectListingType(listingType) {
            if (!listingType) return;

            vm.listingType = listingType;
            vm.listingTypeProperties = ListingTypeService.getProperties(listingType);

            vm.showPeriodAvailability = vm.listingTypeProperties.isTimeFlexible;
            vm.showDateAvailability = vm.listingTypeProperties.isTimePredefined;
        }

        // Ensure modal is not re-opened with ng-focus. This maybe overkill with recent (v1.1.2) ui-bootstrap udpate
        // But this library is rather dynamic/unstable...
        // See implemented fix: https://github.com/angular-ui/bootstrap/issues/5027#issuecomment-162546292
        function openDatepicker(datepicker) {
            if (datepicker.indexOf("start") >= 0 && ! startDateOpenedOnce) {
                startDateOpenedOnce = true;
            } else if (datepicker.indexOf("end") >= 0 && ! endDateOpenedOnce) {
                endDateOpenedOnce = true;
            }

            if (datepicker === "start" && ! vm.startDateOpened) {
                vm.startDateOpened = true;
            } else if (datepicker === "end" && ! vm.endDateOpened) {
                vm.endDateOpened = true;
            }
        }

        function updateListingAvailabilities(listing) {
            var oldListingAvailabilitiesIds = _.pluck(vm.listingAvailabilities, 'id');
            var newListingAvailabilitiesIds = _.pluck(vm.editingListingAvailabilities, 'id');

            var listingAvailabilitiesToAdd = _.filter(vm.editingListingAvailabilities, function (l) {
                return !!l.fakeId;
            });

            var listingAvailabilitiesIdsToRemove = _.difference(oldListingAvailabilitiesIds, newListingAvailabilitiesIds);

            var removePromises = [];
            _.forEach(listingAvailabilitiesIdsToRemove, function (id) {
                removePromises.push(ListingService.removeListingAvailabilities(listing.id, {
                    listingAvailabilityId: id
                }));
            });

            var addPromises = [];
            _.forEach(listingAvailabilitiesToAdd, function (l) {
                addPromises.push(ListingService.createListingAvailabilities(listing.id, {
                    startDate: l.startDate,
                    endDate: l.endDate,
                    quantity: 0
                }));
            });

            // removing before adding because of time constraints
            return $q.all(removePromises)
                .then(function () {
                    return $q.all(addPromises);
                });
        }

        function getISODate(date) {
            return moment(date).format(formatDate) + 'T00:00:00.000Z';
        }

        function getNextISODate(date) {
            return moment(date).add({ d: 1 }).format(formatDate) + 'T00:00:00.000Z';
        }

        function _computeDateConstraints(listingAvailabilities) {
            listingAvailabilities = listingAvailabilities || [];
            var refDate = moment().format(formatDate) + 'T00:00:00.000Z';

            var _disableStartDate = function (data) {
                var startDate = getISODate(data.date);

                if (startDate < refDate) {
                    return true;
                }

                var isWithinRange = _.reduce(listingAvailabilities, function (memo, listingAvailability) {
                    if (listingAvailability.startDate <= startDate && startDate < listingAvailability.endDate) {
                        return memo || true;
                    }
                    return memo;
                }, false);

                if (isWithinRange) {
                    return true;
                }

                return false;
            };

            var _disableEndDate = function (data) {
                var endDate = getISODate(data.date);

                if (endDate < refDate) {
                    return true;
                }

                var isWithinRange = _.reduce(listingAvailabilities, function (memo, listingAvailability) {
                    if (listingAvailability.startDate <= endDate && endDate < listingAvailability.endDate) {
                        return memo || true;
                    }
                    return memo;
                }, false);

                if (isWithinRange) {
                    return true;
                }

                return false;
            };

            vm.startDateOptions = _.assign({}, dateOptions, { dateDisabled: _disableStartDate });
            vm.endDateOptions   = _.assign({}, dateOptions, { dateDisabled: _disableEndDate });
        }

        function addTimeAvailability() {
            if (!vm.startDate
             || !vm.endDate
             || vm.endDate < vm.startDate) {
                vm.incorrectAvailabilityDates = true;
                return;
            }

            var startDate = getISODate(vm.startDate);
            var endDate = getNextISODate(vm.endDate);

            var isWithinRange = time.isIntersection(vm.editingListingAvailabilities, {
                startDate: startDate,
                endDate: endDate
            });

            if (isWithinRange) {
                return ContentService.showNotification({
                    messageKey: 'time.error.overlapping_dates'
                });
            }

            vm.editingListingAvailabilities.push({
                id: _.uniqueId('listing-availability_'),
                fakeId: true,
                startDate: startDate,
                endDate: endDate
            });

            _computeDateConstraints(vm.editingListingAvailabilities);
            _processEditingListingAvailabilities();

            vm.startDate = null;
            vm.endDate = null;
        }

        function removeListingAvailability(listingAvailabilityId) {
            vm.editingListingAvailabilities = _.filter(vm.editingListingAvailabilities, function (l) {
                return l.id !== listingAvailabilityId;
            });

            _computeDateConstraints(vm.editingListingAvailabilities);
        }

        function _processEditingListingAvailabilities() {
            vm.editingListingAvailabilities = _.sortBy(vm.editingListingAvailabilities, function (listingAvailability) {
                return listingAvailability.startDate;
            });

            _.forEach(vm.editingListingAvailabilities, function (l) {
                l.displayStartDate = l.startDate;
                l.displayEndDate = moment(l.endDate).add({ d: -1 }).format('YYYY-MM-DD') + 'T00:00:00.000Z';
            });
        }

        function fetchListingAvailabilities(listingId) {
            return ListingService.getListingAvailabilities(listingId)
                .then(function (listingAvailabilities) {
                    initListingAvailabilities(listingAvailabilities);
                });
        }

        function initListingAvailabilities(listingAvailabilities) {
            listingAvailabilities = listingAvailabilities || [];
            vm.listingAvailabilities = listingAvailabilities;
            vm.editingListingAvailabilities = _.clone(listingAvailabilities);
            _processEditingListingAvailabilities();
        }
    }

})();
