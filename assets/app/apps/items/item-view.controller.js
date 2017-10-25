/* global fbq, ga, google, moment, Modernizr */

(function () {

    angular
        .module("app.items")
        .controller("ItemViewController", ItemViewController);

    function ItemViewController($document,
                                $rootScope,
                                $scope,
                                $stateParams,
                                $state,
                                $timeout,
                                $location,
                                $q,
                                $window,
                                authenticationModal,
                                // BrandService,
                                BookingService,
                                cache,
                                FoundationApi,
                                gamification,
                                GoogleMap,
                                imgGallery,
                                ListingCategoryService,
                                ItemService,
                                ListingTypeService,
                                LocationService,
                                loggerToServer,
                                map,
                                MediaService,
                                MessageService,
                                Modal,
                                platform,
                                pricing,
                                promptInfoModal,
                                RatingService,
                                StelaceConfig,
                                StelaceEvent,
                                TagService,
                                time,
                                toastr,
                                tools,
                                uiGmapGoogleMapApi,
                                User,
                                UserService,
                                usSpinnerService) {

        var doc                 = angular.element($document[0].documentElement);
        var mapContainer        = $document[0].getElementById("map-container");
        var mqMobileTablet      = $window.matchMedia("(max-width: 1023px)"); // IE10+ support
        // var mqLarge             = window.matchMedia("(min-width: 1024px)"); // IE10+ support
        var todayDate           = new Date();
        var formatDate          = "YYYY-MM-DD";
        var nbDaysPricing       = 28;
        var listeners           = [];
        var hoveredMarkers      = [];
        var mapDimensionsObject = {};
        var startDateOpenedOnce = false;
        var endDateOpenedOnce   = false;
        var dateOptions         = {
            minDate: todayDate,
            startingDay: 1,
            showWeeks: false,
            maxMode: "day",
            initDate: todayDate // required since 1.1.2 update
            // Bug with use of datepicker-options for inline datepickers if initDate is not set
        };
        var itemId;
        var item;
        // var brands;
        var listingCategories;
        var ownerItemLocations;
        var itemLocations;
        var myLocations;
        var itemPricing;
        var questions;
        var journeys;
        var sortedJourneys;
        var closestLocations;
        var googleMap;
        var mapCenter;
        var loadMapCenter;
        var mapCenteringTimeout;
        var stopSpinnerTimeout;
        var closeModalDatepickerTimeout;
        var tilesLoaded;
        var galleryImgs;
        var questionModal;
        var searchConfig;

        var vm = this;
        vm.showMap              = StelaceConfig.isFeatureActive('MAP');
        vm.showListingCategories = StelaceConfig.isFeatureActive('LISTING_CATEGORIES');
        vm.showTags             = StelaceConfig.isFeatureActive('TAGS');
        vm.mqMobileTablet       = mqMobileTablet.matches;
        vm.formatDate           = "dd/MM/yyyy";
        vm.showDate             = false;
        vm.showIncorrectDates   = false;
        vm.dateErrorMessage     = "";
        vm.disableBookingButton = false;
        vm.item                 = null;
        vm.nbPictures           = 1;
        vm.gmap                 = null;
        vm.displayQuestions     = false;
        vm.ownerLocationAliases = [];
        vm.isOwner              = false;
        vm.levelMap             = gamification.getLevelMap();
        vm.medalsLabels         = gamification.getMedalsLabels();
        vm.applyFreeFees        = false;
        vm.bookingFeesStr       = "";
        vm.displaySnapshotView  = false;
        vm.pricingTableData     = {};
        vm.showGamification     = StelaceConfig.isFeatureActive('GAMIFICATION');
        vm.uniqueListingType    = false;
        vm.onlyNoTimeListing    = false;

        // Use autoblur directive on iOS to prevent browser UI toolbar and cursor from showing up on iOS Safari, despite readony status
        // Accessibility issue: this fix prevents from tabing rapidly to submit button
        // See http://stackoverflow.com/questions/25928605/in-ios8-safari-readonly-inputs-are-handled-incorrectly
        // Also see angular-ui pull request, rejected for accesibility reasons: https://github.com/angular-ui/bootstrap/pull/3720
        vm.iOS                   = tools.isIOS();
        vm.iOSSafari             = tools.isIOSSafari();
        // Inline datepicker is not used anymore with touch agnostic policy
        // vm.inlineDatepicker               = false;
        // vm.hideInlineStartDatepicker      = false;
        // vm.hideInlineEndDatepicker        = true;
        // vm.hideModalInlineStartDatepicker = true;
        // vm.hideModalInlineEndDatepicker   = true;
        // vm.displayMobileEndDatePicker     = true;
        vm.bookItem              = bookItem;
        vm.stickyButtonBookItem  = stickyButtonBookItem;
        // vm.changeMobileStartDate = changeMobileStartDate;
        // vm.changeMobileEndDate   = changeMobileEndDate;
        vm.displayPrice          = displayPrice;
        vm.displayFullDate       = displayFullDate;
        vm.openImgSmallGallery   = openImgSmallGallery;
        vm.openImgGallery        = openImgGallery;
        vm.sendMessage           = sendMessage;
        vm.openQuestionModal     = openQuestionModal;
        vm.openDatepicker        = openDatepicker;
        vm.closeDatepicker       = closeDatepicker;
        vm.toggleDetailBox       = _toggleDetailBox;
        // vm.toggleDetailBox       = _.throttle(_toggleDetailBox, 200, { trailing: false }) ;
        vm.myLocationCta         = myLocationCta;
        vm.toggleListingType     = toggleListingType;

        activate();

        function activate() {
            if ($stateParams.slug) {
                var slugId = _.last($stateParams.slug.split("-"));

                if (slugId && ! isNaN(slugId)) {
                    itemId = slugId;
                } else {
                    $state.go("404", null, { location: false });
                    return;
                }
            } else {
                $state.go("404", null, { location: false });
                return;
            }

            StelaceEvent.sendScrollEvent("Item view", { itemId: itemId })
                .then(function (obj) {
                    listeners.push(obj.cancelScroll);
                });

            var setCenterThrottled = _.throttle(_setCenter, 300);
            angular.element($window).on("resize", setCenterThrottled);
            listeners.push(function () {
                angular.element($window).off("resize", setCenterThrottled);
            });

            // in case Google Map fails to load fast enough
            stopSpinnerTimeout = $timeout(function () {
                if (! vm.showMap) {
                    return;
                }
                usSpinnerService.stop('map-spinner');
                if (! vm.mqMobileTablet) { // map is lower in view on mobiles
                    toastr.info("Nous sommes désolés, la carte de la page n'a pas pu être chargée pour le moment.", "Carte indisponible", {
                        timeOut: 15000
                    });
                }
            }, 45000);

            listeners.push(
                $rootScope.$on("isAuthenticated", function (event, isAuthenticated) {
                    if (! isAuthenticated || (isAuthenticated && ! vm.currentUser)) { // avoid duplicate requests
                        return _fetchUserInfo(true);
                    }
                })
            );
            $scope.$on("$destroy", function () {
                $timeout.cancel(mapCenteringTimeout);
                $timeout.cancel(stopSpinnerTimeout);
                $timeout.cancel(closeModalDatepickerTimeout);
                _.forEach(listeners, function (listener) {
                    listener();
                });
                if (questionModal) {
                    FoundationApi.unsubscribe("item-question-modal"); // Avoid fade-in animation during destruction
                    questionModal.destroy();
                }
                // cleaning up DOM references
                mapContainer = null;
                // Give some time for CSS classes cleaning up
                $timeout(function () {
                    doc = null;
                });
            });

            // Layout
            // setAspectRatio should be called in a directive. Care with watch on scroll and resize...
            _setFlexboxAspectRatio("pics-grid", 0.5);  // ratio = (1.5 + 1.5) / (4 + 2)

            // Touch detection is not reliable. We have to make UX consistent for all devices.
            // if (window.screen.width < 640
            //  || ((Modernizr.touchevents || Modernizr.pointerevents) && window.screen.width < 1280)
            // ) {
            //     // Allow native-like UX on mobiles and touch devices, with datepicker's date constraints
            //     vm.inlineDatepicker = true;
            // }

            $q.all({
                // brands: BrandService.getList(),
                currentUser: UserService.getCurrentUser(),
                item: ItemService.get(itemId, { snapshot: true }).catch(_redirectTo404),
                listingCategories: ListingCategoryService.cleanGetList(),
                listingTypes: ListingTypeService.cleanGetList(),
                ownerItemLocations: ItemService.getLocations(itemId).catch(function () { return []; }),
                myLocations: LocationService.getMine(),
                itemPricing: pricing.getPricing(),
                questions: MessageService.getPublicMessages(itemId),
                searchConfig: _getSearchConfig()
            }).then(function (results) {
                // brands             = results.brands;
                vm.currentUser     = tools.clearRestangular(results.currentUser);
                item               = tools.clearRestangular(results.item);
                listingCategories  = results.listingCategories;
                myLocations        = tools.clearRestangular(results.myLocations);
                ownerItemLocations = tools.clearRestangular(results.ownerItemLocations);
                itemPricing        = tools.clearRestangular(results.itemPricing);
                questions          = results.questions;
                searchConfig       = results.searchConfig;
                vm.listingTypes    = results.listingTypes;
                vm.uniqueListingType = item.listingTypesIds.length === 1;

                if (vm.uniqueListingType) {
                    vm.itemListingType = _.find(vm.listingTypes, function (listingType) {
                        return listingType.id === item.listingTypesIds[0];
                    });
                }

                ItemService.populate(item, {
                    listingTypes: vm.listingTypes
                });

                // TODO: create tab by listingType
                if (item.listingTypesProperties.TIME.TIME_FLEXIBLE) {
                    vm.timeFlexibleListingType = _.find(vm.listingTypes, function (listingType) {
                        return listingType.properties.TIME === 'TIME_FLEXIBLE';
                    });
                }
                if (item.listingTypesProperties.TIME.NONE) {
                    vm.timeNoneListingType = _.find(vm.listingTypes, function (listingType) {
                        return listingType.properties.TIME === 'NONE';
                    });
                }

                vm.onlyNoTimeListing = vm.uniqueListingType && item.listingTypesProperties.TIME.NONE;

                if (vm.currentUser) {
                    var now = moment().toISOString();

                    if (UserService.isFreeFees(vm.currentUser, now)) {
                        vm.applyFreeFees = true;
                    }
                }

                var noMoreAvailable = false;
                if (vm.itemListingType && vm.itemListingType.properties.TIME === 'NONE' && item.quantity === 0) {
                    noMoreAvailable = true;
                }

                if (item.snapshot || noMoreAvailable) {
                    vm.displaySnapshotView = true;
                    return _displayItemSnapshot(results);
                }

                if (! item.locations.length) {
                    $state.go("404", null, { location: false });
                    return $q.reject("item no locations");
                }

                var maxDurationBooking;
                if (vm.timeFlexibleListingType) {
                    maxDurationBooking = vm.timeFlexibleListingType.config.bookingTime.maxDuration;
                }

                ItemService.populate(item, {
                    // brands: brands,
                    listingCategories: listingCategories,
                    locations: ownerItemLocations,
                    nbDaysPricing: maxDurationBooking ? Math.max(nbDaysPricing, maxDurationBooking) : nbDaysPricing
                });

                item.owner.fullname       = User.getFullname.call(item.owner);
                item.owner.seniority      = displayMonth(item.owner.createdDate);
                vm.nbPictures             = item.medias.length;

                itemLocations = ownerItemLocations;

                vm.ownerMainLocation = _.find(ownerItemLocations, { main: true }) || ownerItemLocations[0];
                vm.ownerLvl          = item.owner.levelId && item.owner.levelId.toLowerCase();
                vm.ownerHasMedal     = gamification.hasMedal(vm.ownerLvl);

                _setBreadcrumbs();

                if (!vm.onlyNoTimeListing) {
                    _computeDateConstraints(item, vm.timeFlexibleListingType);
                }
                vm.calendarReady = true;
                vm.startDate = null;
                vm.endDate   = null;
                vm.showDate  = true;
                $scope.$watch('vm.startDate', _promptEndDate, true);

                galleryImgs  = createImgGallery(item.medias);

                _populateQuestions();

                vm.item = item;

                vm.pricingTableData.show          = false;
                vm.pricingTableData.item          = item;
                vm.pricingTableData.listingType   = vm.onlyNoTimeListing ? vm.timeNoneListingType : vm.timeFlexibleListingType;
                vm.pricingTableData.itemPricing   = itemPricing;
                vm.pricingTableData.bookingParams = {};
                vm.pricingTableData.data          = {
                    totalPrice: 0,
                    dailyPriceStr: ""
                };

                // the item is only sellable, display the pricing table
                if (vm.onlyNoTimeListing) {
                    vm.pricingTableData.bookingParams.applyFreeFees = vm.applyFreeFees;
                    vm.pricingTableData.show                        = true;
                    vm.showPrice = true;
                }

                var sellingPriceResult = pricing.getPriceAfterRebateAndFees({
                    ownerPrice: vm.item.sellingPrice,
                    ownerFeesPercent: 0, // do not care about owner fees
                    takerFeesPercent: UserService.isFreeFees(vm.currentUser) ? 0 : itemPricing.takerFeesPurchasePercent
                });
                vm.totalSellingPrice = _.get(sellingPriceResult, "takerPrice");
                vm.sellingTakerFees  = _.get(sellingPriceResult, "takerFees");

                _setDisableBookingButton();

                return _populateRatings();
            }).then(function () {
                return $q.all({
                    similarItems: _getSimilarItems()
                });
            }).then(function (results) {
                var similarItems = (results.similarItems && results.similarItems.items) || [];
                vm.similarItems  = _populateSimilarItems(similarItems);

                _setDisableBookingButton();

                _setSEOTags();
                platform.setPageStatus("ready"); // do not wait for map to take snapshot

                return _fetchUserInfo(); // all promises related to user, can be updated later
            }).then(function () {
                // Facebook tracking, no use to record details in GA
                var fbEventParams = {
                    content_name: vm.item.name,
                    content_ids: [vm.item.id],
                    content_category: ListingCategoryService.getCategoriesString(vm.breadcrumbCategory, vm.breadcrumbQuery),
                    sip_offer_types: ItemService.getFbOfferTypes(vm.item)
                };

                var fbRentingDayOnePrice = ItemService.getFbRentingDayOnePrice(vm.item);
                var fbSellingPrice       = ItemService.getFbSellingPrice(vm.item);
                if (typeof fbRentingDayOnePrice === "number") {
                    fbEventParams.sip_renting_day_one_price = fbRentingDayOnePrice;
                }
                if (typeof fbSellingPrice === "number") {
                    fbEventParams.sip_selling_price = fbSellingPrice;
                }

                fbq('track', 'ViewContent', fbEventParams);

                return vm.showMap ? uiGmapGoogleMapApi : $q.when(true);
            }).then(function () {
                if (! vm.showMap) {
                    return $q.when(true);
                }

                cache.set("isGoogleMapSDKReady", true);

                var markers = _setMarkers();  // map is populated before loading

                // must create early for angular-google-maps
                // detail Boxes (1 for item locations and 1 for user locations)
                vm.itemBox = {
                    id: _.uniqueId("marker_"),
                    show: false,
                    targetData: "itemLocation",
                    pixelOffsets: {
                        anonymous: new google.maps.Size(-75, -200), // X : 150/2 (width), Y : 190 (height) + 10 (triangle)
                        authenticated: new google.maps.Size(-75, -200) // idem
                    },
                    windowOptions: {
                        boxClass: "InfoBox item-details-marker",
                        closeBoxURL: "",
                        disableAutoPan: false,
                        maxWidth: 150,
                        zIndex: 100002 // above myLocationBox
                    },
                    parent: $scope // See https://github.com/angular-ui/angular-google-maps/issues/356#issuecomment-78063209
                };

                vm.myLocationBox = {
                    id: _.uniqueId("marker_"),
                    show: false,
                    targetData: "myLocation",
                    pixelOffsets: {
                        anonymous: new google.maps.Size(-48, -90), // Y : 80 (height) + 10 (triangle)
                        authenticated: new google.maps.Size(-48, -23) // Y : 15 (line) + 2x1 (border) + 1 (padding) + 5 (triangle)
                    },
                    windowOptions: {
                        boxClass: "InfoBox search-location-marker",
                        closeBoxURL: "",
                        disableAutoPan: false,
                        maxWidth: 96,
                        zIndex: 100001 // above markers
                    }
                };

                googleMap = new GoogleMap({
                    center: loadMapCenter,
                    zoom: 10,
                    events: {
                        click: _closeDetailBoxes,
                        tilesloaded: _setCenter // draws attention to itemLocation
                    },
                    options: {
                        scrollwheel: false
                    }
                });
                vm.gmap = googleMap.getConfig();

                _fitMap(markers);
            }).catch(function (err) {
                if (err !== "stop") {
                    platform.setMetaTags({ "status-code": 500 });
                    platform.setPageStatus("ready");
                }
            });
        }

        function _redirectTo404(err) {
            if (err.status === 404) {
                $state.go("404", null, { location: false });
            }

            return $q.reject("stop");
        }

        function _computeDateConstraints(item, listingType) {
            var refDate = moment().format(formatDate) + 'T00:00:00.000Z';
            var config = (listingType.config && listingType.config.bookingTime) || {};
            var quantity = 1; // TODO: make quantity depend on user input
            var availablePeriods = item.availablePeriods;

            var _disableStartDate = function (data) {
                if (item.locked) {
                    return true;
                }

                var startDate = getStartDate(data.date);

                var isWithinRange = BookingService.isWithinRangeStartDate({
                    refDate: refDate,
                    config: config,
                    startDate: startDate
                });

                if (!isWithinRange) {
                    return true;
                }

                var predictedQuantity = BookingService.getPredictedQuantity(startDate, availablePeriods, quantity);
                if (ItemService.getMaxQuantity(item, vm.timeFlexibleListingType) < predictedQuantity) {
                    return true;
                }

                return false;
            };

            var _disableEndDate = function (data) {
                if (item.locked) {
                    return true;
                }

                var endDate = getEndDate(data.date);

                var isWithinRange = BookingService.isWithinRangeEndDate({
                    refDate: refDate,
                    config: config,
                    endDate: endDate
                });

                if (!isWithinRange) {
                    return true;
                }

                var predictedQuantity = BookingService.getPredictedQuantity(endDate, availablePeriods, quantity);
                if (ItemService.getMaxQuantity(item, vm.timeFlexibleListingType) < predictedQuantity) {
                    return true;
                }

                return false;
            };

            /// Init datepicker
            _.assign(dateOptions, { dateDisabled: _disableStartDate });

            vm.startDateOptions = dateOptions;
            vm.endDateOptions   = _.assign({}, dateOptions, { dateDisabled: _disableEndDate });
        }

        function displayFullDate(date) {
            return moment(date).format("LL");
        }

        function displayMonth(date) {
            return moment(date).format("MMMM YYYY");
        }

        // Not using inline datepicker anymore: touch-agnostic policy
        // function changeMobileStartDate() {
        //     if (vm.displayMobileEndDatePicker) {
        //         vm.displayMobileEndDatePicker = false;
        //         vm.hideInlineEndDatepicker = false;
        //     }

        //     displayPrice();
        // }
        // function changeMobileEndDate() {
        //     if (vm.displayMobileEndDatePicker) {
        //         vm.displayMobileEndDatePicker = false;
        //     }

        //     displayPrice();
        // }

        function getStartDate(date) {
            return moment(date).format(formatDate) + 'T00:00:00.000Z';
        }

        function getEndDate(date) {
            return moment(date).add({ d: 1 }).format(formatDate) + 'T00:00:00.000Z';
        }

        function displayPrice() {
            if (! vm.startDate || ! vm.endDate) {
                return;
            }

            var startDate = getStartDate(vm.startDate);
            var endDate = getEndDate(vm.endDate);

            var refDate = moment().format(formatDate) + 'T00:00:00.000Z'; // TODO: compute ref date based on time unit

            var timeUnit = ListingTypeService.getBookingTimeUnit(vm.timeFlexibleListingType);
            vm.nbTimeUnits = BookingService.getNbTimeUnits(startDate, endDate, timeUnit);

            var isValidDates;
            var isAvailable;

            // must be a multiple of listingtype time unit (i.e. integer number)
            if (parseInt(vm.nbTimeUnits, 10) === vm.nbTimeUnits) {
                isValidDates = BookingService.isValidDates({
                    startDate: startDate,
                    nbTimeUnits: vm.nbTimeUnits,
                    refDate: refDate,
                    config: vm.timeFlexibleListingType.config.bookingTime
                });

                if (isValidDates.result) {
                    isAvailable = BookingService.checkAvailability({
                        startDate: startDate,
                        endDate: endDate,
                        item: item,
                        availablePeriods: item.availablePeriods,
                        quantity: 1, // TODO: depend on user input
                        listingType: vm.timeFlexibleListingType
                    });
                } else {
                    isAvailable = false;
                }
            }

            vm.showIncorrectDates = ! isValidDates.result || ! isAvailable;

            vm.showPrice = ! vm.showIncorrectDates;

            if (vm.showPrice) {
                vm.pricingTableData.bookingParams.startDate     = startDate;
                vm.pricingTableData.bookingParams.endDate       = endDate;
                vm.pricingTableData.bookingParams.applyFreeFees = vm.applyFreeFees;
                vm.pricingTableData.show                        = true;
            } else {
                vm.pricingTableData.show = false;
            }

            if (vm.showIncorrectDates) {
                _setErrorDateMessage(item, vm.timeFlexibleListingType, isValidDates);
            } else {
                _removeErrorDateMessage();
            }
            _setDisableBookingButton();
        }

        function _populateRatings() {
            return $q.all({
                ownerMsgStats: User.getMessageStats.call(vm.item.owner, (3600 * 48)),
                ownerRatings: RatingService.getTargetUserRatings({ targetId: vm.item.owner.id, populateItems: true })
            }).then(function (results) {
                var ownerMessageStats   = results.ownerMsgStats;
                var ownerRatings        = results.ownerRatings;
                var ownerAvgRating      = vm.item.owner.nbRatings && Math.min(vm.item.owner.ratingScore / vm.item.owner.nbRatings, 5);
                var itemAvgRating       = vm.item.nbRatings && Math.min(vm.item.ratingScore / vm.item.nbRatings, 5);
                var itemNbReviews       = 0;
                var otherItemsNbReviews = 0;

                // Populate owner Ratings (itemRatings and otherItemsRatings)
                var sortRatings = function (ratings) {
                    return _.sortByOrder(ratings, [
                        function (rating) {
                            return (rating.isReview ? "b" : "a") + rating.createdDate;
                        }
                    ], ["desc"]); // reviews first
                };
                _.forEach(ownerRatings, function (rating) {
                    if (rating.userMedia) {
                        MediaService.setUrl(rating.userMedia);
                    } else {
                        rating.userMedia = { url: platform.getDefaultProfileImageUrl() };
                    }

                    rating.currentItem = (vm.item.id === rating.itemId);

                    if (rating.comment || rating.itemComment) {
                        rating.isReview = true;
                        return (rating.currentItem ? itemNbReviews++ : otherItemsNbReviews++);
                    }
                });
                ownerRatings = sortRatings(ownerRatings);
                ownerRatings = _.groupBy(ownerRatings, function (rating) {
                    return rating.currentItem ? "currentItem" : "otherItems";
                });

                vm.ownerAvgRating      = (Math.round(ownerAvgRating * 10) / 10).toLocaleString();
                vm.itemAvgRating       = (Math.round(itemAvgRating * 10) / 10).toLocaleString();
                vm.itemRatings         = ownerRatings.currentItem;
                vm.otherItemsRatings   = ownerRatings.otherItems;
                vm.itemNbReviews       = itemNbReviews;
                vm.otherItemsNbReviews = otherItemsNbReviews;
                vm.itemFirstRatings    = (itemNbReviews >= 3 && 3) || 6; // only 3 comments if possible
                vm.othersFirstRatings  = Math.min(otherItemsNbReviews || 3, 3); // only comment(s) if 1 at least, 3 else
                // show first 3 comments when possible to save some scroll

                // Message Stats
                var computeMessageStats = function (messageStats) {
                    var answerRateString, answerDelayString;
                    if (messageStats && messageStats.answerRate > -1) {
                        answerRateString = (messageStats.answerRate < 50) ? "moins de 50%" : "" + Math.round(messageStats.answerRate) + "%";
                        if (messageStats.answerDelay < 1800) {
                            answerDelayString = "Quelques minutes";
                        } else if (messageStats.answerDelay <= 3600) {
                            answerDelayString = "Moins d'une heure";
                        } else if (messageStats.answerDelay <= 3600 * 5) {
                            answerDelayString = "Quelques heures";
                        } else if (messageStats.answerDelay <= 3600 * 12) {
                            answerDelayString = "Dans la journée";
                        } else if (messageStats.answerDelay <= 3600 * 24) {
                            answerDelayString = "Moins de 24 heures";
                        } else if (messageStats.answerDelay <= 3600 * 48) {
                            answerDelayString = "Un à deux jours";
                        } else {
                            answerDelayString = "Plus de 48 heures";
                        }
                    }
                    return {
                        answerRateString: answerRateString,
                        answerDelayString: answerDelayString
                    };
                };
                vm.ownerMessageStats = computeMessageStats(ownerMessageStats);
            });
        }

        function bookItem(bookInNoTime) {
            var listingType = _.find(vm.listingTypes, function (listingType) {
                return listingType.properties.TIME === (bookInNoTime ? 'NONE' : 'TIME_FLEXIBLE');
            });

            if (! vm.startDate && ! bookInNoTime) {
                // Hack: only way found to force datepicker to open (even with a $scope variable)
                // Without timeout, get digest loop in progress error if trying to use $apply
                // See http://stackoverflow.com/a/18626821
                $timeout(function () {
                    vm.startDateOpened = true;
                });

                if (! startDateOpenedOnce) {
                    startDateOpenedOnce = true;
                    StelaceEvent.sendEvent("Booking datepicker use", {
                        itemId: itemId,
                        type: "click",
                        data: { datepicker: "start" }
                    });
                }

                // if (vm.inlineDatepicker) { // no dropdown > must prompt user another way
                //     toastr.info("Merci de choisir la date à laquelle vous souhaitez emprunter cet objet dans le calendrier.", "Date requise");
                // }
                return;
            }

            var createAttrs = {
                itemId: vm.item.id,
                listingTypeId: listingType.id
            };

            if (! bookInNoTime) {
                createAttrs.startDate = getStartDate(vm.startDate);
                createAttrs.nbTimeUnits = vm.nbTimeUnits;
            }

            // Google Analytics event
            var gaLabel = 'itemId: ' + vm.item.id;
            ga('send', 'event', 'Items', 'Booking', gaLabel);
            // Facebook event
            var fbEventParams = {
                content_name: vm.item.name,
                content_ids: [vm.item.id],
                content_category: ListingCategoryService.getCategoriesString(vm.breadcrumbCategory, vm.breadcrumbQuery),
                stl_transaction_type: listingType.name
            };
            fbq('track', 'InitiateCheckout', fbEventParams);
            // Stelace event
            var stlEvent;
            var stlEventData = {
                itemId: itemId,
                tagsIds: vm.showTags ? _.pluck(vm.item.completeTags, "id") : null,
                type: "click",
                nbItemLocations: itemLocations.length,
                nbPictures: vm.nbPictures
            };
            StelaceEvent.sendEvent("Item booking", { data: stlEventData })
                .then(function (stelaceEvent) {
                    stlEvent = stelaceEvent;
                });

            _checkAuth()
                .then(function (isAuthenticated) {
                    if (! isAuthenticated) {
                        return $q.reject("not authenticated");
                    }

                    if (vm.item.ownerId === vm.currentUser.id) {
                        toastr.warning("Vous ne pouvez pas emprunter votre propre objet ;)");
                        return;
                    }

                    return BookingService.post(createAttrs);
                }).then(function (newBooking) {
                    if (! newBooking) {
                        return;
                    }
                    // Stelace event
                    stlEventData.bookingId = newBooking.id;
                    stlEvent.update({ data: stlEventData });

                    $state.go("bookingPayment", { id: newBooking.id });
                }).catch(function (err) {
                    if (err !== "not authenticated") {
                        toastr.warning("Une erreur est survenue. Veuillez réessayer plus tard.", "Oups");
                    }
                });
        }

        function stickyButtonBookItem() {
            StelaceEvent.sendEvent("Sticky booking button click");
            $window.scrollTo(0, 0);

            var bookInNoTime = vm.onlyNoTimeListing;
            bookItem(bookInNoTime);
        }

        function _promptEndDate(newDate, oldDate) {
            if (! newDate || (vm.endDate && oldDate && newDate <= vm.endDate)) {
                // prompt endDate only if existing startDate and no valid preexisting endDate
                return;
            }

            if (! vm.endDate) {
                var minDuration = vm.timeFlexibleListingType.config.bookingTime.minDuration;

                if (! minDuration) {
                    minDuration = 1;
                }

                vm.endDate = moment(vm.startDate).add(minDuration, "d").toDate();
            }

            $timeout(function () {
                if (vm.questionModalOpened === true) {
                    vm.endDateModalOpened = true;
                } else {
                    vm.endDateOpened = true;
                }

                if (! endDateOpenedOnce) {
                    endDateOpenedOnce = true;
                    StelaceEvent.sendEvent("Booking datepicker use", {
                        itemId: itemId,
                        type: "click",
                        data: { datepicker: "end" }
                    });
                }

                displayPrice();
            });
        }

        function _setBreadcrumbs() {
            if (vm.showListingCategories) {
                vm.breadcrumbCategory     = ListingCategoryService.findListingCategory(item, listingCategories);
                vm.breadcrumbCategoryLink = $state.href("searchWithQuery", {
                    query: tools.getURLStringSafe(vm.breadcrumbCategory)
                });
            }

            vm.breadcrumbQuery = ItemService.normalizeName(item.name);
            vm.breadcrumbQueryLink = $state.href("searchWithQuery", {
                query: ItemService.encodeUrlQuery(vm.breadcrumbQuery),
                q: ItemService.encodeUrlFullQuery(vm.breadcrumbQuery)
            });
        }

        // Create directive if used again
        function _setFlexboxAspectRatio(id, ratio) {
            // can't use padding-top trick here, since absolute positionning would possibly break child flexbox
            var el;
            var elWidth;
            var timeout;
            ratio = ratio || 0.5;

            function _resize() {
                elWidth = el.clientWidth;
                el.style.height = (elWidth * ratio) + "px";
            }

            var _throttleResize = _.throttle(_resize, 500);

            timeout = setInterval(function () {
                if ($document[0].getElementById(id)) {
                    el = $document[0].getElementById(id);
                    _resize();
                    clearInterval(timeout);
                }
            }, 1000);

            angular.element($window).on("resize", _throttleResize);
            listeners.push(function () {
                angular.element($window).off("resize", _throttleResize);
            });
        }

        function createImgGallery(medias) {
            return _.map(medias, function (media) {
                var widthLimit  = 1600;
                var heightLimit = 1200;
                var ratioWH     = media.width / media.height;
                var mediumSize  = {
                    width: media.width,
                    height: media.height
                };

                if (widthLimit < mediumSize.width) {
                    mediumSize.width = widthLimit;
                    mediumSize.height = Math.round(mediumSize.width / ratioWH);
                }
                if (heightLimit < mediumSize.height) {
                    mediumSize.height = heightLimit;
                    mediumSize.width = Math.round(mediumSize.height * ratioWH);
                }

                return {
                    originalImage: {
                        src: media.url,
                        w: media.width,
                        h: media.height
                    },
                    mediumImage: {
                        src: media.url + "?size=" + widthLimit + "x" + heightLimit + "&displayType=containOriginal",
                        w: mediumSize.width,
                        h: mediumSize.height
                    }
                };
            });
        }

        function openImgSmallGallery(event) {
            var target = event.target;

            if (! item.medias.length) {
                return;
            }

            var imgs = $document[0].getElementById("small-gallery").querySelectorAll(".img-container");
            _.forEach(imgs, function (img) {
                var index = parseInt(img.getAttribute("data-index"), 10);
                if (! isNaN(index)) {
                    galleryImgs[index].el = img;
                }
            });
            _.forEach(galleryImgs, function (img) {
                if (! img.el) {
                    img.el = imgs[0];
                }
            });

            StelaceEvent.sendEvent("Item view image gallery opening", {
                itemId: itemId,
                type: "click",
                data: {
                    gallery: "small",
                    nbPictures: item.medias.length
                }
            });

            imgGallery.render(galleryImgs, parseInt(target.getAttribute("data-index"), 10) || 0);
        }

        function openImgGallery(event) {
            var target = event.target;

            if (! item.medias.length) {
                return;
            }

            var imgs = $document[0].getElementById("pics-grid").querySelectorAll(".item__image");
            _.forEach(imgs, function (img) {
                var index = parseInt(img.getAttribute("data-index"), 10);
                if (! isNaN(index)) {
                    galleryImgs[index].el = img;
                }
            });
            _.forEach(galleryImgs, function (img) {
                if (! img.el) {
                    img.el = imgs[0];
                }
            });

            StelaceEvent.sendEvent("Item view image gallery opening", {
                type: "click",
                data: {
                    gallery: "main",
                    nbPictures: item.medias.length
                }
            });

            imgGallery.render(galleryImgs, parseInt(target.getAttribute("data-index"), 10) || 0);
        }

        function _populateSimilarItems(similarItems) {
            _.forEach(similarItems, function (item) {
                var shortestJourney  = item.journeysDurations[0]; // sorted by server (ItemController, MapService)
                var shortestLocation = _.find(vm.searchFromLocations, function (location, index) {
                    return shortestJourney.index === index;
                });
                item.loc               = shortestLocation;
                item.toLoc             = shortestJourney.toLocation;
                item.minDurationString = time.getDurationString(shortestJourney.durationSeconds);
            }, vm);
            ItemService.populate(similarItems, {
                listingTypes: vm.listingTypes
            });

            return similarItems;
        }

        function _displayItemSnapshot() {
            vm.item              = item;
            item.owner.fullname  = User.getFullname.call(item.owner);
            item.owner.seniority = displayMonth(item.owner.createdDate);
            vm.nbPictures        = item.medias.length;
            vm.ownerLvl          = item.owner.levelId && item.owner.levelId.toLowerCase();
            vm.ownerHasMedal     = gamification.hasMedal(vm.ownerLvl);
            itemLocations        = [];

            var maxDurationBooking;
            if (vm.timeFlexibleListingType) {
                maxDurationBooking = vm.timeFlexibleListingType.config.bookingTime.maxDuration;
            }

            _setBreadcrumbs();

            ItemService.populate(item, {
                listingCategories: listingCategories,
                nbDaysPricing: maxDurationBooking ? Math.max(nbDaysPricing, maxDurationBooking) : nbDaysPricing
            });

            _populateQuestions();

            galleryImgs = createImgGallery(item.medias);

            $timeout.cancel(stopSpinnerTimeout);

            return _populateRatings()
                .then(function () {
                    return _getSimilarItems();
                })
                .then(function (similarItems) {
                    vm.similarItems = _populateSimilarItems((similarItems && similarItems.items) || []);
                })
                .then(function () {
                    _setSEOTags();
                    platform.setPageStatus("ready");
                    return $q.reject("stop");
                });
        }

        function sendMessage() {
            var bookingStatus = "info";
            var agreementStatus;
            var createBooking = false;

            if ((! vm.noTimeBookingSelected && vm.startDate && vm.endDate)
                || vm.noTimeBookingSelected
            ) {
                bookingStatus = "pre-booking";
                agreementStatus = "pending";
                createBooking = true;
            }


            var createAttrs = {
                privateContent: vm.privateContent || null,
                publicContent: vm.publicContent || null,
                bookingStatus: bookingStatus,
                agreementStatus: agreementStatus,
                startDate: vm.startDate ? moment(vm.startDate).format(formatDate) : null,
                endDate: vm.endDate ? moment(vm.endDate).format(formatDate) : null,
                itemId: vm.item.id,
                receiverId: vm.item.owner.id,
                senderId: vm.currentUser.id
            };

            $q.when(true)
                .then(function () {
                    if (! createBooking) {
                        return;
                    }

                    return BookingService.post({
                        itemId: vm.item.id,
                        startDate: vm.startDate ? moment(vm.startDate).format(formatDate) : null,
                        endDate: vm.endDate ? moment(vm.endDate).format(formatDate) : null,
                        listingTypeId: vm.noTimeBookingSelected ? vm.timeNoneListingType.id : vm.timeFlexibleListingType.id // TODO: find a better way to select it
                    });
                })
                .then(function (booking) {
                    if (createBooking) {
                        createAttrs.bookingId = booking.id;
                    }
                    return MessageService.post(createAttrs);
                })
                .then(function () {
                    toastr.success("Nous vous préviendrons de la réponse à votre message par email", "Demande envoyée");
                })
                .catch(function (/* err */) {
                    toastr.warning("Oups, une erreur s'est produite.", "Erreur lors de l'envoi");
                });
        }

        function toggleListingType() {
            vm.noTimeBookingSelected = ! vm.noTimeBookingSelected;
        }

        function openQuestionModal(toUser) {
            if (! vm.item) {
                return;
            }

            var lockScrollClass      = "modal-opened" + (vm.iOS ? " lock-both" : "");
            vm.editPublicQuestion    = false;
            vm.showToggleListingType = vm.item.listingTypesIds.length > 1;
            vm.noTimeBookingSelected = vm.onlyNoTimeListing;

            vm.editPublicQuestion = true;

            if (toUser === "owner" && vm.conversation) {
                $state.go("conversation", { conversationId: vm.conversation.id });
                return;
            }

            if (! questionModal) {
                questionModal = new Modal({
                    id: "item-question-modal",
                    className: "large fluid-helper-modal",
                    templateUrl: "/assets/app/modals/itemQuestionModal.html",
                    overlayClose: true,
                    contentScope: {
                        vm: vm,
                        onOk: function onOk() {
                            questionModal.deactivate();
                            sendMessage();
                        }
                    }
                });
                FoundationApi.subscribe("item-question-modal", function (msg) {
                    if (msg === "close" || msg === "hide") {
                        doc.removeClass(lockScrollClass);
                        vm.questionModalOpened = false;
                    }
                });
            }

            var questionGreeting  = "Connectez-vous en quelques secondes pour envoyer votre demande à "
                + vm.item.owner.fullname;
            var promptInfoOptions = {
                greeting: {
                    email: "Veuillez renseigner votre adresse email pour être prévenu(e) en cas de réponse à votre question."
                }
            };

            StelaceEvent.sendEvent("Item view question", {
                itemId: itemId,
                type: "click",
                data: { receiver: toUser || "owner" }
            });

            return _checkAuth(questionGreeting)
                .then(function (isAuthenticated) {
                    if (isAuthenticated) {
                        return UserService.getCurrentUser();
                    }
                }).then(function (currentUser) {
                    if (currentUser) {
                        _setRole(currentUser);

                        if (toUser === "owner" && vm.isOwner) {
                            toastr.warning("Vous ne pouvez pas envoyer de question à vous-même ;)", "Oups");
                            return;
                        }

                        return promptInfoModal.ask(["email"], promptInfoOptions)
                            .then(function (promptResults) {
                                if (! promptResults.email) {
                                    toastr.info("Nous vous invitons à renseigner votre adresse email afin d'envoyer votre question.", "Adresse email requise");
                                    return;
                                }

                                vm.questionModalOpened = true;
                                doc.addClass(lockScrollClass);
                                questionModal.activate();
                            });
                    }
                });
        }

        // Ensure modal is not re-opened with ng-focus. This maybe overkill with recent (v1.1.2) ui-bootstrap udpate
        // But this library is rather dynamic/unstable...
        // See implemented fix: https://github.com/angular-ui/bootstrap/issues/5027#issuecomment-162546292
        function openDatepicker(datepicker) {
            if (datepicker.indexOf("start") >= 0 && ! startDateOpenedOnce) {
                startDateOpenedOnce = true;
                StelaceEvent.sendEvent("Booking datepicker use", {
                    itemId: itemId,
                    type: "click",
                    data: { datepicker: "start" }
                });
            } else if (datepicker.indexOf("end") >= 0 && ! endDateOpenedOnce) {
                endDateOpenedOnce = true;
                StelaceEvent.sendEvent("Booking datepicker use", {
                    itemId: itemId,
                    type: "click",
                    data: { datepicker: "end" }
                });
            }

            if (datepicker === "start" && ! vm.startDateOpened) {
                vm.startDateOpened = true;
            } else if (datepicker === "end" && ! vm.endDateOpened) {
                vm.endDateOpened = true;
            } else if (datepicker === "startModal" && ! vm.startDateModalOpened) {
                vm.startDateModalOpened = true;
            } else if (datepicker === "endModal" && ! vm.endDateModalOpened) {
                vm.endDateModalOpened = true;
            }
        }

        // special function is needed as datepicker does not close automatically in foundation modals (no propagation to document)
        function closeDatepicker(datepicker) {
            closeModalDatepickerTimeout = $timeout(function () {
                if (datepicker === "startModal") {
                    vm.startDateModalOpened = false;
                } else if (datepicker === "endModal") {
                    vm.endDateModalOpened = false;
                }
            }, 1500);
        }

        function _setDisableBookingButton() {
            vm.disableBookingButton = vm.item.locked || vm.showIncorrectDates;
        }

        function _checkAuth(customGreeting) {
            var authModalOptions = {
                greeting: customGreeting || ("Connectez-vous en quelques secondes pour réserver \"" + vm.item.name + "\"."),
                preventSubscriptionRedirect: true
            };

            return authenticationModal.process("register", authModalOptions)
                .then(function (isAuthenticated) {
                    // promise resolved to true or false only
                    if (isAuthenticated === false && ! customGreeting) {
                        toastr.info("Nous vous invitons à vous connecter pour effectuer votre demande.");
                    }

                    if (isAuthenticated) {
                        return UserService.getCurrentUser(true)
                            .then(function (u) {
                                vm.currentUser = u;
                                return isAuthenticated;
                            })
                            .catch(function () {
                                return isAuthenticated;
                            });
                    } else {
                        return $q.when(isAuthenticated);
                    }
                });
        }

        function _fetchUserInfo(refreshMap) {
            return $q.all({
                currentUser: UserService.getCurrentUser(),
                myLocations: LocationService.getMine()
            }).then(function (results) {
                vm.currentUser = tools.clearRestangular(results.currentUser);
                myLocations    = tools.clearRestangular(results.myLocations);

                if (vm.currentUser) {
                    var now = moment().toISOString();

                    if (UserService.isFreeFees(vm.currentUser, now)) {
                        vm.applyFreeFees = true;

                        displayPrice();
                    }
                }

                if (vm.currentUser && item.owner.id === vm.currentUser.id) {
                    // associating owner's myLocations aliases to item locations for detailBox
                    _.forEach(ownerItemLocations, function (itemLocation) {
                        var matchingMyLocation = _.find(myLocations, { id: itemLocation.id });
                        vm.ownerLocationAliases.push(matchingMyLocation.alias || matchingMyLocation.shortName);
                    });
                }

                _setRole(vm.currentUser);

                if (vm.currentUser) {
                    MediaService.getMyImage()
                        .then(function (myImage) {
                            if (myImage) {
                                vm.userImgSrc = myImage.url + '?size=128x128';
                            }
                        });
                } else { // spare request
                    vm.userImgSrc = platform.getDefaultProfileImageUrl();
                }

                if (! myLocations.length) {
                    return $q.when();
                }

                return LocationService.getJourneysDuration(myLocations, itemLocations);
            }).then(function (table) {
                journeys = table;
                sortedJourneys = _.sortBy(journeys, "durationSeconds");

                if (googleMap && refreshMap) {
                    googleMap.unsetMarkers();

                    tilesLoaded = false;
                    _fitMap(_setMarkers());
                }


                // display shortest myLocation if user has locations, else itemLocation city
                vm.breadcrumbCity = sortedJourneys.length ? myLocations[sortedJourneys[0].fromIndex].city
                    : itemLocations[0].city;
                vm.breadcrumbCityLink = $state.href("searchWithQuery", {
                    query: ItemService.encodeUrlQuery(vm.breadcrumbQuery),
                    q: ItemService.encodeUrlFullQuery(vm.breadcrumbQuery),
                    location: vm.breadcrumbCity
                });

                if (vm.currentUser) {
                    return MessageService.getConversations({
                        itemId: vm.item.id,
                        senderId: vm.currentUser.id
                    });
                }
            }).then(function (conversations) {
                if (conversations && conversations.length) {
                    vm.conversations = _.sortBy(conversations, function (conversation) {
                        return - conversation.createdDate;
                    });
                    vm.conversation  = vm.conversations[0];
                }
            });
        }

        function _closeDetailBoxes(/*map, googleEventName*/) {
            if (! googleMap) {
                return;
            }

            if (vm.myLocationBox.show) {
                vm.myLocationBox.show = false;
                googleMap.showMarker(vm.myLocationBox.originatorId);
            }
            if (vm.itemBox.show) {
                vm.itemBox.show = false;
                googleMap.showMarker(vm.itemBox.originatorId);
            }
            $scope.$digest(); // needed since google event happen outside of angular
        }

        function _setCenter(eventArgs, googleEventName) {
            if (! googleMap) {
                return;
            }

            // stop spinner before centering
            $timeout.cancel(stopSpinnerTimeout);
            usSpinnerService.stop('map-spinner');

            _getMapDimensions();

            // mapDimensionsObject.sidebarLeftOffset = sidebar.getBoundingClientRect().left;
            // mapDimensionsObject.offset            = {
            //     x: mapDimensionsObject.mapDimensions.width - mapDimensionsObject.sidebarLeftOffset
            // };

            if (eventArgs) { // on first map tilesloaded event or window resize
                if (googleEventName === "tilesloaded" && tilesLoaded) { return; }
                if (googleEventName === "tilesloaded") { tilesLoaded = true; }
                $timeout.cancel(mapCenteringTimeout);
                mapCenteringTimeout = $timeout(function () {
                    // googleMap.setOffsetCenter(mapCenter, mapDimensionsObject);
                    googleMap.setCenter(mapCenter);
                }, 1500);
            } else {
                // googleMap.setOffsetCenter(mapCenter, mapDimensionsObject);
                googleMap.setCenter(mapCenter);
            }
        }

        // click event is associated to mouseenter on touch devices, so debounce it with _.throttle in vm
        function _toggleDetailBox(markerId, detailBox, oneWay, e) {
            if (! googleMap) {
                return;
            }

            // DetailBox : "myLocationBox" or "itemBox"
            var triggerMarker  = googleMap.getMarker(markerId);
            var highestMarker  = _.max(vm.gmap.markers, "windowOptions.zIndex");

            // All hover events maxes out element z-index
            if (e && e.type === "mouseover") {
                triggerMarker.windowOptions.zIndex = highestMarker.windowOptions.zIndex + 1;
                // Angular only returns mouseover events, even when using ng-mouseenter: http://stackoverflow.com/questions/28200125/mouseenter-vs-mouseover-in-angularjs
                // So it is impossible to distinguish desktop hover from mouseover triggered by touch (as opposed to mouseenter, not triggered by touch)
                if (hoveredMarkers[markerId] === true && ! vm.iOSSafari) {
                    // Only first hover for each marker opens detailBox for simplicity (and to avoid re-opening detailBoxes accidentally with hover just after closing)
                    return;
                    // But NOT on iOS Safari, where first touch on an element triggers mouseover but not click if DOM has changed, which would make a second tap necessary...
                    // See https://developer.apple.com/library/safari/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html
                    // This behavior can be the same for minor iOS browsers (i.e. Firefox iOS) but not for Chrome iOS
                }
                // if (hoveredMarkers[markerId] === true && vm.iOSSafari) {
                //     toastr.info("iOS mouseover prevents click event")
                // }
                hoveredMarkers[markerId] = true;
            }

            // Closed opened detailBox before opening or toggling new detailBox
            if (oneWay !== "close") {
                if (vm.myLocationBox.show) {
                    vm.myLocationBox.show = false;
                    googleMap.showMarker(vm.myLocationBox.originatorId);
                }
                if (vm.itemBox.show) {
                    vm.itemBox.show = false;
                    googleMap.showMarker(vm.itemBox.originatorId);
                }
            }
            // Old behavior : handle properly previous marker that opened *current* detailBox if needed
            // if (markerId !== vm[detailBox].originatorId) {
                // vm[detailBox].show = false;
                // issues with overlapping between 2 detailBoxes
                // googleMap.showMarker(vm[detailBox]originatorId);
            // } // So finally, close gracefully all detailBoxes in code above

            // update data and metadata
            if (vm[detailBox].show && oneWay !== "open") {
                vm[detailBox].show = false;
                googleMap.showMarker(markerId);
            } else if (oneWay !== "close") {
                vm[detailBox].show          = false;
                vm[detailBox].originatorId  = markerId;
                vm[detailBox].data          = triggerMarker[vm[detailBox].targetData]; // itemLocation or myLocation
                if (vm.currentUser) {
                    vm[detailBox].anonymousUser             = false;
                    vm[detailBox].windowOptions.boxClass    = vm[detailBox].windowOptions.boxClass.replace(/ anonymous/g, "");
                    vm[detailBox].windowOptions.pixelOffset = vm[detailBox].pixelOffsets.authenticated;
                } else {
                    vm[detailBox].anonymousUser             = true;
                    vm[detailBox].windowOptions.boxClass    += " anonymous";
                    vm[detailBox].windowOptions.pixelOffset = vm[detailBox].pixelOffsets.anonymous;
                }

                googleMap.toggleMarker(markerId);

                $timeout(function () { // show on next tick to allow google maps to pan if necessary to show detailBox.
                    vm[detailBox].show = ! vm[detailBox].show;
                });

                if (detailBox === "itemBox") {
                    StelaceEvent.sendEvent("Item view map itemBox opening");
                }
            }
        }

        function myLocationCta() {
            var alreadyhasLocations  = !! vm.currentUser && !! myLocations.length; // consider autenticated user locations only
            var promptInfoOptions    = {
                greeting: {
                    mainLocation: "Quel est le principal lieu près duquel vous aimeriez trouver des objets?",
                    secondLocation: "Souhaitez-vous ajouter un autre lieu près duquel vous passez fréquemment pour améliorer vos futures recherches? Lieu de travail, gare..."
                }
            };

            return _checkAuth("Créez un compte Sharinplace en quelques secondes pour améliorer vos recherches.")
                .then(function (isAuthenticated) {
                    if (isAuthenticated) {
                        return promptInfoModal.ask(["mainLocation"], promptInfoOptions);
                    } else {
                        return false;
                    }
                }).then(function (promptResults) {
                    var ok = promptResults.allInfoOk || false; /// true if user has at least one location

                    if (ok === false && ! vm.currentUser) {
                        toastr.info("La création d'un compte vous permettra de trouver facilement les objets qu'il vous faut.", "Recherche avancée");
                        return false;
                    } else if (ok === false && vm.currentUser) { // currentUser can have been populated lately if user has just authed during checkAuth
                        toastr.info("L'ajout de lieux favoris dans votre compte vous permettra de trouver facilement les objets qu'il vous faut.", "Recherche avancée");
                        return false;
                    } else if (ok === true && alreadyhasLocations) { // promptResults.noPrompt
                        // already authenticated user with existing locations has not been prompted so far, so ok to redirect
                        $state.go("account");
                    } else { // if (ok === true && ! alreadyhasLocations) {
                        // a new user has given an adress or an old user with at least one location reconnects (refresh map)
                        return _fetchUserInfo(true).then(function () {
                            toastr.success("Les trajets depuis vos lieux favoris indiqués ont été mis à jour", "Carte mise à jour");
                        });
                    }
                });
        }

        function _setErrorDateMessage(item, listingType, isValidDates) {
            var defaultMessage = 'Les dates sont incorrectes.';
            var config = listingType.config.bookingTime;
            var str;

            if (isValidDates.errors.DURATION) {
                // TODO: get time unit
                if (isValidDates.errors.DURATION.BELOW_MIN) {
                    str = "Les emprunts durent " + config.minDuration + " jours au minimum.";
                } else if (isValidDates.errors.DURATION.ABOVE_MAX) {
                    str = "Les emprunts durent " + config.maxDuration + " jours au maximum.";
                }
            }

            if (!str) {
                str = defaultMessage;
            }

            vm.dateErrorMessage = str;
        }

        function _removeErrorDateMessage() {
            vm.dateErrorMessage = '';
        }

        function _setMarkers() {
            var newMarkers           = [];
            var itemLocationsMarkers = [];
            var myLocationsMarkers   = [];

            if (! vm.isOwner) {
                closestLocations = {
                    fromId: sortedJourneys.length ? myLocations[sortedJourneys[0].fromIndex].id : null,
                    toId: sortedJourneys.length ? itemLocations[sortedJourneys[0].toIndex].id : null
                };
            } else {
                closestLocations = {
                    fromId: itemLocations[0].id
                    // convention for fitting. Only owners have fromId but no toId in closestLocations
                    // users without locations are the opposite
                };
            }

            // Item locations markers
            _.forEach(itemLocations, function (itemLocation, index) {
                var markerId     = _.uniqueId("marker_");
                var marker       = {};
                var placeholders = ["Ici", "Et là", "Là", "Ou là", "Ou là", "Ou là", "Ou là", "Ou là"];

                itemLocation.markerId = markerId;

                marker.itemLocation         = itemLocation;
                marker.itemLocation.toIndex = index; // for journeys matching
                marker.coords               = {
                    longitude: marker.itemLocation.longitude,
                    latitude: marker.itemLocation.latitude
                };
                marker.type                 = "itemLocation";
                marker.index                = index;
                marker.id                   = markerId;
                marker.show                 = true;
                marker.windowOptions        = {
                    boxClass: "InfoBox distance-marker",
                    closeBoxURL: "",
                    disableAutoPan: true, // !!! solves autocenter issues with statics markers
                    maxWidth: 50,
                    pixelOffset: new google.maps.Size(-25, -25),
                    zIndex: 1000 - index // above user locations
                };
                marker.parent = $scope; // needed in template

                if (! myLocations.length || vm.isOwner) {
                    marker.content  = placeholders[index];
                } else {
                    var toLocationSortedJourneys = _.sortBy(_.filter(sortedJourneys, { toIndex: index }), "durationSeconds");
                    _.forEach(toLocationSortedJourneys, function (journey) {
                        journey.durationString    = time.getDurationString(journey.durationSeconds, true);
                        journey.fromLocationAlias = myLocations[journey.fromIndex].alias || myLocations[journey.fromIndex].shortName;
                    });
                    marker.itemLocation.journeys = toLocationSortedJourneys;
                    marker.content               = toLocationSortedJourneys[0].durationString; // for detailBox
                    marker.smallestDuration      = toLocationSortedJourneys[0].durationSeconds; // for map centering
                }

                itemLocationsMarkers.push(marker); // "Ici" marker is first
            });

            vm.itemCities = _.uniq(itemLocations, "city"); // defined here since we need markerId for microdata

            if (myLocations.length && ! vm.isOwner) { // if there are journeys, use closest location first
                newMarkers = _.sortBy(itemLocationsMarkers, "smallestDuration");
            } else {
                newMarkers = itemLocationsMarkers;
            }

            // User locations markers
            _.forEach(myLocations, function (myLocation, index) {
                var markerId = _.uniqueId("marker_");
                var marker   = {};

                myLocation.markerId = markerId;

                marker.myLocation           = myLocation;
                marker.myLocation.alias     = marker.myLocation.alias || marker.myLocation.shortName;
                marker.myLocation.fromIndex = index; // for journeys matching
                marker.coords               = {
                    longitude: marker.myLocation.longitude,
                    latitude: marker.myLocation.latitude
                };
                marker.type                 = "myLocation";
                marker.index                = index;
                marker.id                   = markerId;
                marker.show                 = true;
                marker.windowOptions        = {
                    boxClass: "InfoBox mylocation-marker",
                    closeBoxURL: "",
                    disableAutoPan: true,  // !!! solves autocenter issues with statics markers
                    maxWidth: 32,
                    pixelOffset: new google.maps.Size(-16, -37),
                    zIndex: 990 - index
                };

                if (! vm.isOwner && marker.myLocation.id === closestLocations.fromId) {
                    myLocationsMarkers.unshift(marker); // closest myLocation marker is first
                } else {
                    myLocationsMarkers.push(marker);
                }
            });

            // Centering
            if (myLocations.length && ! vm.isOwner) {
                loadMapCenter = { // needs a clean object for angular google maps
                    latitude: myLocationsMarkers[0].myLocation.latitude,
                    longitude: myLocationsMarkers[0].myLocation.longitude
                };
                mapCenter     = (newMarkers[0].itemLocation) || loadMapCenter; // closest itemLocation marker
                // console.log("loadMapCenter ", myLocationsMarkers[0].myLocation);
            } else {
                loadMapCenter = {
                    latitude: newMarkers[0].itemLocation.latitude, // "Ici marker"
                    longitude: newMarkers[0].itemLocation.longitude
                };
                mapCenter     = newMarkers.length > 1 ? newMarkers[1].itemLocation  // "Et là" placholder
                    : loadMapCenter;
                // console.log("anonymous loadMapCenter ", newMarkers[0].itemLocation);
            }

            newMarkers = myLocationsMarkers.concat(newMarkers);

            return newMarkers;
        }

        function _fitMap(markers) {
            if (! googleMap) {
                return;
            }

            googleMap.setMarkers(markers);

            // update center if a user logs in
            if (! _.isEqual(vm.gmap.map.center, loadMapCenter)) {
                googleMap.setCenter(loadMapCenter);
            }

            // update dimensions on each call
            _getMapDimensions();
            mapDimensionsObject.heightPadding = 16; //px
            mapDimensionsObject.widthPadding  = 0; //px
            mapDimensionsObject.zoomBounds    = [8, 13]; // zoom no lower than 8, even if remote myLocations
            // mapDimensionsObject.sidebarLeftOffset = sidebar.getBoundingClientRect().left;
            // mapDimensionsObject.offset            = {
            //     x: mapDimensionsObject.mapDimensions.width - mapDimensionsObject.sidebarLeftOffset
            // };

            googleMap.fitMap(mapDimensionsObject, false, closestLocations);

            vm.loadMap = true;
        }

        function _getMapDimensions() {
            mapContainer      = $document[0].getElementById("map-container"); // can change on window resize
            vm.mqMobileTablet = mqMobileTablet.matches;

            // mapContainer isn't defined when the user logout, so check its existence
            if (mapContainer) {
                mapDimensionsObject.width  = mapContainer.clientWidth;
                mapDimensionsObject.height = mapContainer.clientHeight;
            }
        }

        function _getSearchConfig() {
            return UserService.getCurrentUser()
                .then(function (currentUser) {
                    return ItemService.getSearchConfig(currentUser);
                });
        }

        function _populateQuestions() {
            MessageService.populate(questions);

            questions = _.groupBy(questions, "conversationId");
            questions = _.filter(questions, function (conv) {
                return conv.length > 1; // only display answered questions (questions objects are conversations)
            });

            vm.questions = _.sortBy(questions, function (conv) {
                return - conv[1].createdDate;
            });
            vm.displayQuestions = ! _.isEmpty(vm.questions);
        }

        function _getSimilarItems() {
            return $q.when(true)
                .then(function () {
                    var searchQuery = {
                        similarToItemsIds: [item.id], // force array when there is only one element
                        limit: 6,
                    }

                    // if there are no searched locations, use item's
                    if (! searchConfig
                        || ((! searchConfig.activeLocations || ! searchConfig.activeLocations.length)
                            && ! searchConfig.queryLocation)
                    ) {
                        if (itemLocations.length) {
                            searchQuery.locations = _.map(itemLocations, function (location) {
                                return _.assign({}, location, { source: "item" });
                            });
                        }
                    // otherwise use them
                    } else {
                        var searchedLocations = _.filter(myLocations, function (location) {
                            return _.contains(searchConfig.activeLocations, "" + location.id);
                        });
                        if (searchConfig.queryLocation) {
                            searchedLocations.unshift(_.assign({}, searchConfig.queryLocation, { source: "query" }));
                        }

                        searchQuery.locations = searchedLocations;
                    }

                    if (searchQuery.locations && searchQuery.locations.length) {
                        vm.similarItemsShowDuration = true;
                    } else {
                        searchQuery.locations = [];
                    }

                    vm.searchFromLocations = searchQuery.locations;

                    searchQuery.locations = _.map(searchQuery.locations, function (location) {
                        return _.pick(location, ["latitude", "longitude", "source"]);
                    });

                    return ItemService.search({ type: "similar", searchQuery: searchQuery });
                })
                .catch(loggerToServer.error);
        }

        function _setRole(currentUser) {
            if (currentUser) {
                if (currentUser.id === item.owner.id) {
                    vm.isOwner = true;
                }
            }
        }

        function _setSEOTags() {
            var title  = vm.item.name;
            var imgUrl = platform.getBaseUrl() + vm.item.url + "?size=1600x1200&displayType=containOriginal";
            var description;
            var og;

            if (vm.item.description) {
                description = tools.shrinkString(vm.item.description, 140);
            } else {
                description = (vm.breadcrumbCategory ? vm.breadcrumbCategory + " : " : "");
            }

            var urlCanonical    = platform.getBaseUrl() + $state.current.urlWithoutParams + "/" + vm.item.nameURLSafe + "-" + itemId;
            var isSelfCanonical = platform.isSelfCanonical(urlCanonical);

            if (isSelfCanonical) {
                // WARNING: should avoid duplicate meta description/title in Google Webmaster Tools (despite canonical)
                platform.setMetaTags({ description: description });
            }

            og = {
                "og:title": title,
                "og:type": "website", // TODO: create custom namespace in facebook app
                "og:url": urlCanonical,
                "og:description": description
            };

            // Default's Sharinplace header is better than item image placeholder
            if (vm.item.medias && vm.item.medias[0]) {
                og["og:image"]            = imgUrl;
                og["og:image:secure_url"] = imgUrl;
                // No upscaling: Set real img dimensions, with max 1600 * 1200 (containOriginal)
                og["og:image:width"]      = Math.min(1600, vm.item.medias[0].width);
                og["og:image:height"]     = Math.min(1200, vm.item.medias[0].height);
            }

            platform.setOpenGraph(og);
            platform.setTwitterCard({
                "twitter:title": title,
                "twitter:description": description,
                "twitter:image": imgUrl
            });
            platform.setTitle(title);
            platform.setCanonicalLink(urlCanonical);
        }

    }

})();
