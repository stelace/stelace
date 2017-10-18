/* global fbq, ga, moment */

(function () {

    angular
        .module("app.items")
        .controller("MyItemsController", MyItemsController);

    function MyItemsController($http,
                                $location,
                                $q,
                                $rootScope,
                                $scope,
                                $state,
                                $stateParams,
                                $timeout,
                                authentication,
                                authenticationModal,
                                // BrandService,
                                crossTabCommunication,
                                diacritics,
                                ezfb,
                                ItemCategoryService,
                                ItemService,
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
                                toastr,
                                tools,
                                UserService,
                                usSpinnerService) {
        var listeners               = [];
        var itemValidationFields    = ["title", "category", "description", "media", "price", "sellingPrice", "deposit"];
        var initialDefaultDeposit   = 50; // EUR
        var nbDaysPricing           = 7;
        var breakpointDays          = [3, 7, 14, 28];
        var lastBreakpointDay       = _.last(breakpointDays);
        var itemId                  = parseInt($stateParams.id, 10);
        var tags                    = [];  // save tag bindings until search
        var mediaSelectionInitiated = false;
        var savingItem              = false;
        var itemNameChanged         = false;
        // var ratioDayOneSellingPrice = 25;
        var item;
        var myItems;
        // var brands;
        var itemCategories;
        var itemPricing;
        var stepProgressDone;
        var myLocations;
        var isAdmin;
        var currentUser;
        var newItemTmp;
        var anonymousItemTmp;
        var debouncedSaveItem;
        var debouncedPriceRecommendation;
        var refreshLocations;
        var mediasSelector;
        var stlEvent;
        var stlEventData;

        var vm = this;
        vm.activeTags           = StelaceConfig.isFeatureActive('TAGS');
        vm.showItemCategories   = StelaceConfig.isFeatureActive('ITEM_CATEGORIES');
        vm.listingTypes         = [];
        vm.showListingTypes     = false;

        vm.isActivePriceRecommendation = StelaceConfig.isFeatureActive('PRICE_RECOMMENDATION');
        vm.showTags             = false;
        vm.viewCreate           = ($state.current.name === "itemCreate");
        vm.myItemsView          = ($state.current.name === "myItems");
        vm.showItemEditor       = !! itemId;
        vm.listingType          = $stateParams.t;
        vm.itemId               = itemId;
        vm.showSocialLogin      = authentication.isSocialLoginAllowed();
        vm.useSocialLogin       = false;
        vm.isAuthenticated      = false;
        vm.createAccount        = false;
        vm.factorDeposit        = 15;
        vm.defaultDayOnePrice   = 0;
        vm.defaultDeposit       = initialDefaultDeposit;
        vm.maxDeposit           = 600; // EUR
        vm.itemBookingPrices    = _.map(breakpointDays, function (day) { return { day: day }; });
        vm.myItemsEditor        = {};
        vm.tags                 = [];
        vm.myItems              = [];
        vm.selectedShareItem    = null;
        // vm.brands            = [];
        vm.itemCategoriesLvl1   = [];
        vm.itemCategoriesLvl2   = [];
        vm.itemTags             = [];
        vm.configMedias         = [];
        vm.isMoveModeAllowed    = false;
        vm.mediaMode            = "edit";
        vm.showTotalMediaUpload = false;
        vm.totalMediaUpload     = 0;
        vm.footerTestimonials   = true;
        vm.stickyOffset         = 208;
        vm.recommendedPrices    = {};
        vm.listingTypesProperties = {};
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
                customValueToPosition: sliderValueToPositon,
                customPositionToValue: sliderPositionToValue
            },
            overlay: {}
        };

        vm.trustSteps           = [{
            label: "Confiance",
            content: "Les évaluations et la vérification des coordonnées des membres garantissent le bon déroulement des transactions. "
                + "Aucune information personnelle n’est révélée avant la validation d’une réservation.",
            icon: "star"
        }, {
            label: "Sécurité",
            content: "Notre prestataire de paiements sécurisés transfère l’argent sur votre compte dans les jours qui suivent la vente ou la location. "
                + "Un dépôt de garantie est bloqué sur la carte bancaire de l’emprunteur pendant chaque location.",
            icon: "lock-check"
        }, {
            label: "Gratuité",
            content: "Sharinplace vous permet de publier et promouvoir vos annonces en un clin d'œil. "
                + "Le dépôt d’annonces est gratuit et illimité. Et il le restera. Obtenez encore davantage de récompenses en participant.",
            icon: "gift"
        }];

        vm.socialLogin                    = socialLogin;
        vm.selectItemCategoryLvl2         = selectItemCategoryLvl2;
        vm.categoryChanged                = categoryChanged;
        vm.saveItem                       = saveItem;
        // vm.updateBrandList             = updateBrandList;
        vm.showStep2                      = showStep2;
        vm.showStep3AndUpdatePrice        = showStep3AndUpdatePrice;
        vm.updateDeposit                  = updateDeposit;
        vm.onDeleteItem                   = onDeleteItem;
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
        vm.facebookShareMyItem            = facebookShareMyItem;
        vm.fixCustomPricing               = fixCustomPricing;
        vm.toggleItemListingTimeProperty  = toggleItemListingTimeProperty;

        activate();


        function activate() {
            listeners.push(
                $rootScope.$on("isAuthenticated", function (event, isAuthenticated) {
                    vm.isAuthenticated = isAuthenticated;
                    currentUser = isAuthenticated ? currentUser : null;

                    if (! vm.isAuthenticated && ! vm.viewCreate) {
                        return $state.go("itemCreate");
                    } else if (! vm.isAuthenticated) {
                        vm.myItems = [];
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
                StelaceEvent.sendEvent("Item creation view")
                    .then(function (stelaceEvent) {
                        stlEvent = stelaceEvent;
                    });

                stlEventData = {
                    completed: {
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
                itemCategories: ItemCategoryService.cleanGetList(),
                itemPricing: pricing.getPricing(),
                tags: vm.activeTags ? TagService.cleanGetList() : [],
                listingTypes: ListingTypeService.cleanGetList(),
                newItemTmp: ItemService.getNewItemTmp(null)
            }).then(function (results) {
                // brands                = results.brands;
                // vm.brands             = brands;
                currentUser           = results.currentUser;
                itemCategories        = results.itemCategories;
                myLocations           = tools.clearRestangular(results.myLocations);
                itemPricing           = results.itemPricing;
                tags                  = _.sortBy(results.tags, function (tag) {
                    return - (tag.timesSearched + tag.timesAdded);
                }); // return most used and most searched tags first

                vm.listingTypes = results.listingTypes;
                vm.showListingTypes = vm.listingTypes.length > 1;
                vm.timeNoneListingType = _.find(vm.listingTypes, function (listingType) {
                    return listingType.properties.TIME === 'NONE';
                });
                vm.timeFlexibleListingType = _.find(vm.listingTypes, function (listingType) {
                    return listingType.properties.TIME === 'TIME_FLEXIBLE';
                });

                vm.isAuthenticated    = !! currentUser;
                vm.createAccount      = ! currentUser;
                vm.itemCategoriesLvl1 = _selectItemCategory();

                return _fetchUserInfo();
            }).then(function () {
                var urlCanonical = platform.getBaseUrl() + "/item/new";
                var imgUrl       = platform.getBaseUrl() + "/assets/img/app/background/Janet_Ramsden_Attribution_Bokeh_Gift_Small.jpg";
                var title        = "";
                var description  = "Pour prolonger l'esprit de Noël, Sharinplace reverse à des associations 10% du montant des ventes"
                    + " entre particuliers et 1€ pour chaque annonce créée.";
                var og           = {
                    "og:title": title,
                    "og:type": "website", // TODO: create custom namespace in facebook app
                    "og:url": urlCanonical,
                    "og:description": description
                };

                // Meta description and title are set in items.route

                og["og:image"]            = imgUrl;
                og["og:image:secure_url"] = imgUrl;
                og["og:image:width"]      = 1280;
                og["og:image:height"]     = 850;

                platform.setOpenGraph(og);
                platform.setTwitterCard({
                    "twitter:title": title,
                    "twitter:description": description,
                    "twitter:image": imgUrl
                });

                platform.setCanonicalLink(urlCanonical);
            });
        }

        function _fetchUserInfo() {
            var userPromises;

            return UserService.getCurrentUser()
                .then(function (user) {
                    currentUser  = user;
                    userPromises = {
                        newItemTmp: ItemService.getNewItemTmp(currentUser || null)
                    };

                    if (currentUser) {
                        _.assign(userPromises, {
                            myLocations: LocationService.getMine(),
                            myItems: ItemService.getMyItems(),
                            myImage: MediaService.getMyImage(),
                            isAdmin: UserService.isAdmin(),
                            anonymousItemTmp: ItemService.getNewItemTmp(null)
                        });
                    }

                    return $q.all(userPromises);
                })
                .then(function (results) {
                    newItemTmp       = results.newItemTmp;
                    myItems          = _.sortBy(results.myItems || [], function (item) {
                        return - (item.updatedDate);
                    });
                    myLocations      = results.myLocations;
                    isAdmin          = results.isAdmin;
                    anonymousItemTmp = results.anonymousItemTmp;


                    var shouldRecycleAnonymousItmTmp = currentUser
                        && (! newItemTmp || (newItemTmp && ! (newItemTmp.name && newItemTmp.itemCategoryId)));
                    // Keep work of anonymous user who has just authenticated
                    // Old user draft automatic locations or prices alone do not count for much if item name is missing
                    if (shouldRecycleAnonymousItmTmp) {
                        newItemTmp = anonymousItemTmp;
                        ItemService.setNewItemTmp(null, null); // Avoid to pass input data to another future user
                    }

                    debouncedSaveItem = _getDebouncedSaveItem();

                    if (currentUser) {
                        currentUser.fullname = currentUser.getFullname();
                        vm.displayName       = currentUser.firstname || currentUser.fullname;
                        // save initial values
                        vm.noImage           = (results.myImage.url === platform.getDefaultProfileImageUrl());
                        vm.existingPhone     = currentUser.phoneCheck;

                        if (itemId) {
                            var index = _.findIndex(myItems, function (item) {
                                return item.id === itemId;
                            });
                            if (index === -1) {
                                $state.go("itemCreate");
                                return;
                            }
                            item = myItems[index];
                        } else if (! vm.viewCreate && myItems.length === 0) { // myItems
                            return $state.go("itemCreate");
                        }

                        _.forEach(myItems, function (item) {
                            item.slug        = ItemService.getItemSlug(item);
                            item.ownerRating = { // expected format for item-card's rating-stars
                                ratingScore: currentUser.ratingScore,
                                nbRatings: currentUser.nbRatings
                            };
                        });

                        vm.myItems = _.cloneDeep(myItems);

                        ItemService.populate(vm.myItems, {
                            // brands: brands,
                            itemCategories: itemCategories,
                            locations: myLocations,
                            nbDaysPricing: nbDaysPricing,
                            listingTypes: vm.listingTypes
                        });

                        vm.selectedShareItem = vm.myItems.length ? vm.myItems[0] : null;

                        if (vm.activeTags) {
                            vm.showTags         = isAdmin;
                        }
                    }

                    if (! savingItem) {
                        _initItem();
                    }
                });
        }

        function _initItem() {
            if (! item && ! newItemTmp) { // new item from scratch
                vm.item                     = {};
                vm.itemMedias               = [];
                vm.stepProgress             = 0;
                vm.step2                    = false;
                vm.step3                    = false;
                vm.saveItemBtnDisabled      = false;
                vm.validPrice               = false;
                vm.selectedItemCategoryLvl1 = null;
                vm.selectedItemCategoryLvl2 = null;
                vm.mediasMaxNbReached       = false;
                vm.item.listingTypesIds     = [];
                stepProgressDone            = {};

                vm.itemFullValidation       = true;
                vm.itemValidationFields     = {};
                _.forEach(itemValidationFields, function (field) {
                    vm.itemValidationFields[field] = false;
                });

                if (currentUser) {
                    vm.item.listLocations = _.map(myLocations, function (location) {
                        var l = _.clone(location);
                        l.checked = true;
                        return l;
                    });
                }

                vm.item.mode = "classic";

                vm.itemTags = [];
            } else if (! item && newItemTmp) { // when using local storage
                vm.item                     = _.cloneDeep(newItemTmp);
                vm.itemMedias               = [];
                vm.stepProgress             = 0;
                vm.step2                    = false;
                vm.step3                    = false;
                vm.saveItemBtnDisabled      = false;
                vm.validPrice               = false;
                vm.selectedItemCategoryLvl1 = null;
                vm.selectedItemCategoryLvl2 = null;
                vm.item.listingTypesIds     = vm.item.listingTypesIds || [];
                stepProgressDone            = {};
                vm.mediasMaxNbReached       = false;

                vm.itemFullValidation       = true;
                vm.itemValidationFields     = {};
                _.forEach(itemValidationFields, function (field) {
                    vm.itemValidationFields[field] = false;
                });

                if (currentUser
                    && (! vm.item.listLocations || ! vm.item.listLocations.length)
                ) {
                    // Possibly no location yet if using old anonymous ItemTmp
                    vm.item.listLocations = _.map(myLocations, function (location) {
                        var l = _.clone(location);
                        l.checked = true;
                        return l;
                    });
                }

                vm.item.mode = "classic";

                _populateTags();
                _populateItemCategories();

                setDefaultPrices();
                showStep2();

                platform.debugDev("step 3 init newItemTmp", vm.item)

                if (_.isFinite(vm.item.sellingPrice)) {
                    platform.debugDev("step 3 from new init")
                    showStep3AndUpdatePrice();
                }
            } else { // existing item and user
                vm.item = _.cloneDeep(item);

                ItemService.populate(vm.item, {
                    // brands: brands,
                    itemCategories: itemCategories,
                    locations: myLocations,
                    nbDaysPricing: nbDaysPricing,
                    listingTypes: vm.listingTypes
                });

                vm.itemMedias               = vm.item.medias;
                vm.stepProgress             = 100;
                vm.step2                    = true;
                vm.step3                    = true;
                vm.saveItemBtnDisabled      = !! item.soldDate;
                vm.validPrice               = true;
                vm.selectedItemCategoryLvl1 = null;
                vm.selectedItemCategoryLvl2 = null;
                stepProgressDone            = {};
                vm.viewCreate               = false;

                _populateTags();
                _populateItemCategories();

                setDefaultPrices();

                _.forEach(vm.itemMedias, function (media) {
                    media.url += "?size=450x300";
                });

                var itemLocations = item.locations;
                vm.item.listLocations = _.map(myLocations, function (location) {
                    var l = _.clone(location);
                    var found = _.find(itemLocations, function (loc) {
                        return loc === location.id;
                    });
                    l.checked = !! found;
                    return l;
                });

                vm.selectedShareItem = vm.item;
            }

            mediasSelector = ItemService.getMediasSelector({
                medias: vm.itemMedias
            });
            vm.configMedias      = mediasSelector.getConfigMedias();
            vm.isMoveModeAllowed = mediasSelector.isMoveModeAllowed();
            vm.mediaMode         = "edit";

            _computeListingTypesProperties();
            _initPrice();

            listeners.push($scope.$watch("vm.item.name", _.debounce(_nameChanged, 1500)));
            listeners.push($scope.$watch("vm.item.sellingPrice", _.throttle(_sellingPriceChanged, 2000)));
        }

        function saveLocal(field) {
            if (vm.viewCreate && debouncedSaveItem) {
                debouncedSaveItem(field);
            }
        }

        function _getDebouncedSaveItem() {
            return _.debounce(function (field) {
                var newItem = _.cloneDeep(vm.item);

                if (vm.showItemCategories) {
                    if (vm.selectedItemCategoryLvl2) {
                        newItem.itemCategoryId = vm.selectedItemCategoryLvl2.id;
                    } else if (vm.selectedItemCategoryLvl1) {
                        newItem.itemCategoryId = vm.selectedItemCategoryLvl1.id;
                    }
                }

                if (vm.activeTags) {
                    TagService.deduplicateTagsByInsensitiveName(vm.itemTags, tags);
                    newItem.tags = _.pluck(vm.itemTags, "id");
                }

                _updateUxEventData(field);

                return ItemService.setNewItemTmp(currentUser || null, newItem);
            }, 1000);
        }

        function _populateTags() {
            if (!vm.activeTags) {
                return;
            }

            var hashTags = _.indexBy(tags, "id");

            vm.itemTags = _.reduce(vm.item.tags, function (memo, tagId) {
                var tag = hashTags[tagId];
                if (tag) {
                    memo.push(tag);
                }
                return memo;
            }, []);
        }

        function _populateItemCategories() {
            if (!vm.showItemCategories) {
                return;
            }

            if (vm.item.itemCategoryId) {
                var cat = _.find(itemCategories, function (itemCat) {
                    return itemCat.id === vm.item.itemCategoryId;
                });
                if (! cat.parentId) {
                    vm.selectedItemCategoryLvl1 = cat;
                } else {
                    vm.selectedItemCategoryLvl2 = cat;
                    vm.selectedItemCategoryLvl1 = _.find(itemCategories, function (itemCat) {
                        return itemCat.id === cat.parentId;
                    });
                }
                selectItemCategoryLvl2();
            }
        }

        function selectItemCategoryLvl2() {
            if (!vm.showItemCategories) {
                return;
            }

            vm.itemCategoriesLvl2 = _selectItemCategory(vm.selectedItemCategoryLvl1.id);
            updateBrandList();

            var selectedCatLvl2 = vm.selectedItemCategoryLvl2 ? _.find(vm.itemCategoriesLvl2, function (cat) {
                return cat.id === vm.selectedItemCategoryLvl2.id;
            }) : null;
            if (! selectedCatLvl2) {
                vm.selectedItemCategoryLvl2 = null;
            }

            if (! stepProgressDone.catLvl2) {
                vm.stepProgress += 25;
                stepProgressDone.catLvl2 = true;
            }
        }

        function _selectItemCategory(id) {
            return _.filter(itemCategories, function (itemCategory) {
                if (id) {
                    return itemCategory.parentId === id;
                } else {
                    return ! itemCategory.parentId;
                }
            });
        }

        function categoryChanged() {
            selectItemCategoryLvl2();
            showStep2();
            saveLocal("category");
        }

        function updateBrandList() {
            // var itemCategoryId;

            // if (vm.selectedItemCategoryLvl2) {
            //     itemCategoryId = vm.selectedItemCategoryLvl2.id;
            // } else if (vm.selectedItemCategoryLvl1) {
            //     itemCategoryId = vm.selectedItemCategoryLvl1.id;
            // }

            // BrandService
            //     .getList({ itemCategoryId: itemCategoryId })
            //     .then(function (brands) {
            //         vm.brands = brands;
            //     });
        }

        function _nameChanged(newName, oldName) {
            itemNameChanged = itemNameChanged || newName !== oldName;
            platform.debugDev("_nameChanged:", itemNameChanged, newName, "<=", oldName)

            if (! itemNameChanged
                || ! newName
            ) {
                return;
            }

            saveLocal("name");
            showStep2();
        }

        function showStep2() {
            if (! vm.item || ! vm.item.name) {
                return;
            }
            // No listingType
            if (vm.showListingTypes && !_.keys(vm.item.listingTypesIds).length) {
                return;
            }

            if (! vm.selectedItemCategoryLvl1 && vm.showItemCategories) {
                return;
            }

            if (vm.isActivePriceRecommendation) {
                debouncedPriceRecommendation();
            }

            platform.debugDev("show step 2");
            vm.step2 = true;

            if (! stepProgressDone.itemName) {
                vm.stepProgress += 25;
                stepProgressDone.itemName = true;
            }
        }

        function getPriceRecommendation() {
            var lettersRegex = /[a-zA-Z]{2,}/; // at least 2 letters
            var nameTooShort = ! vm.item.name || ! lettersRegex.test(diacritics.remove(vm.item.name));
            var start = moment();

            platform.debugDev("call recommendation, itemNameChanged:", !! itemNameChanged);

            // useless to get recommandation for same existing item name
            if (nameTooShort
                || ! itemNameChanged
            ) {
                platform.debugDev("Abort recommendation, name too short:", nameTooShort);
                return;
            }

            usSpinnerService.spin("price-recommendation-spinner");
            vm.recommendedPrices.status = "pending";

            return ItemService.getRecommendedPrices(vm.item.name)
            // return $q.when({ // testing
            //       "price": 15,
            //       "dayOnePrice": 3.9,
            //       "lowDayOnePrice": 3,
            //       "highDayOnePrice": 4
            //     })
                .then(function (prices) {
                    var recommendedValue = prices && prices.price;
                    if (! recommendedValue) {
                        return;
                    }

                    _.assign(vm.recommendedPrices, prices);

                    vm.pricingSlider.options.ceil       = getPricingSliderCeil(recommendedValue);
                    vm.pricingSlider.options.ticksArray = [0, Math.round(recommendedValue * 0.7), Math.round(recommendedValue * 1.1)];
                    vm.recommendedPrices.status         = "ok";

                    vm.pricingSliderOverlayLeft  = sliderValueToPositon(vm.pricingSlider.options.ticksArray[1]) * 100  + "%";
                    vm.pricingSliderOverlayRight = (1 - sliderValueToPositon(vm.pricingSlider.options.ticksArray[2])) * 100 + "%";

                    platform.debugDev(vm.pricingSlider, vm.pricingSliderOverlayLeft, vm.pricingSliderOverlayRight)

                    if (typeof vm.item.sellingPrice === "undefined") {
                        vm.item.sellingPrice = vm.recommendedPrices.price;
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
                    itemNameChanged = false;
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

        function sliderValueToPositon(val, minVal, maxVal) {
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

        function showStep3AndUpdatePrice() {
            if (! vm.item
                || typeof vm.item.sellingPrice === "undefined"
            ) {
                return;
            }
            platform.debugDev("show step 3 begin");

            vm.step3 = true;

            if (! stepProgressDone.itemPrice) {
                vm.stepProgress += 25;
                stepProgressDone.itemPrice = true;
            }

            setDefaultPrices();
            vm.saveLocal('price');
        }

        function _initPrice() {
            if (vm.item.sellingPrice) {
                $timeout(function () {
                    // let ng-model selling price trickle down to slider
                    vm.pricingSlider.options.ceil = getPricingSliderCeil(vm.item.sellingPrice);
                    // $scope.$broadcast('rzSliderForceRender');
                });
            }

            if (! vm.item.customPricingConfig) {
                return;
            }

            var customPrices = pricing.getPrice({
                config: vm.item.customPricingConfig,
                nbDays: _.last(vm.itemBookingPrices).day,
                custom: true,
                array: true
            });

            _.forEach(vm.itemBookingPrices, function (booking) {
                var customPrice = customPrices[booking.day - 1];
                if (booking.defaultPrice !== customPrice) {
                    booking.price = customPrice;
                }
            });
        }

        function setDefaultPrices() {
            var sellingPrice = getSellingPrice();

            platform.debugDev("setDefaultPrices begin");

            if (_.isFinite(sellingPrice)) {
                vm.validPrice = true;

                return $q.when(sellingPrice)
                    .then(getDefaultDayOnePrice)
                    .then(function (defaultDayOnePrice) {
                        var dayOnePrice = getDayOnePrice(vm.defaultDayOnePrice);

                        showStep2();

                        var prices = pricing.getPrice({
                            dayOne: dayOnePrice,
                            nbDays: lastBreakpointDay,
                            config: vm.item.id ? vm.item.pricing.config : itemPricing.config,
                            array: true
                        });

                        _.forEach(vm.itemBookingPrices, function (booking) {
                            booking.defaultPrice = prices[booking.day - 1];
                        });

                        vm.defaultDeposit = getDefaultDeposit(dayOnePrice);

                        fixCustomPricing(defaultDayOnePrice);
                    });
            }

            vm.defaultDayOnePrice = 0;
            vm.defaultDeposit     = 0;
            getDayOnePrice(); // for view

            _.forEach(vm.itemBookingPrices, function (booking) {
                booking.defaultPrice = 0;
            });
        }

        function updateDeposit() {
            if (vm.item.deposit && vm.item.deposit > vm.maxDeposit) {
                vm.item.deposit = vm.maxDeposit;
                vm.showDepositWarning = true;
            } else {
                vm.showDepositWarning = false;
            }
        }

        function socialLogin(provider) {
            authentication.socialLogin(provider);
        }

        function saveItem() {
            var updatingItem;

            savingItem       = true;
            // refresh after promptModal only if no current locations
            refreshLocations = !! vm.item.listLocations;

            if (! vm.item.name) {
                return toastr.info("Veuillez renseigner un titre pour votre annonce. Un titre clair et précis (marque, modèle...) attirera l'attention des membres.",
                    "Titre requis", {
                        timeOut: 0,
                        closeButton: true
                });
            }
            if (isNaN(parseFloat(vm.item.sellingPrice))) {
                return toastr.info("Veuillez renseigner la valeur de l'objet.",
                    "Prix manquant", {
                        timeOut: 0,
                        closeButton: true
                });
            }
            if (! vm.item.description) {
                return toastr.info("Veuillez renseigner une description. Ceci encouragera les autres membres à vous contacter.",
                    "Description requise", {
                        timeOut: 0,
                        closeButton: true
                });
            }
            if (!vm.item.listingTypesIds.length) {
                return toastr.info("Veuillez renseigner un type d'annonce (location, vente…)", "Type d'annonce manquant", {
                    timeOut: 0,
                    closeButton: true
                });
            }
            if (vm.itemMedias.length === 0) {
                return toastr.info("Et si vous ajoutiez une image pour mettre toutes les chances de votre côté\xa0?", "Photographie manquante", {
                    timeOut: 0,
                    closeButton: true
                });
            }

            if (! vm.isAuthenticated
                && (! vm.email || ! vm.password)
            ) {
                return toastr.info("Merci de renseigner les identifiants de votre compte.");
            }
            if (! vm.isAuthenticated
                && ! tools.isEmail(vm.email)
            ) {
                vm.invalidAddress = true;
                return toastr.warning("Merci de renseigner une adresse email valide.");
            }

            vm.useSocialLogin      = false;

            vm.saveItemBtnDisabled = true;
            usSpinnerService.spin('save-item-spinner');

            $q.when(true)
                .then(function () {
                    if (vm.isAuthenticated && item) {
                        updatingItem = true;
                        return _updateItem();
                    } else if (vm.isAuthenticated) {
                        return true;
                    } else if (vm.createAccount) {
                        return _register();
                    } else {
                        return _login();
                    }
                })
                .then(function (isAuthenticated) {
                    return ! updatingItem && afterAuthentication(isAuthenticated);
                })
                .catch(afterAuthenticationErrorHandler)
                .finally(function () {
                    usSpinnerService.stop('save-item-spinner');
                    vm.saveItemBtnDisabled = false;
                    savingItem             = false;
                });
        }

        function afterAuthentication(isAuthenticated) {
            return $q.when(isAuthenticated)
                .then(function (isAuthenticated) {
                    if (isAuthenticated) {
                        return promptInfoModal.ask(["email", "mainLocation", "phone"]);
                    } else {
                        return $q.reject("not authenticated");
                    }
                })
                .then(function (promptResults) {
                    if (! promptResults.email) {
                        return $q.reject("missing email");
                    }
                    // if (! promptResults.mainLocation) {
                    //     toastr.warning("Vous devrez indiquer la localisation de votre objet dans votre compte afin de finaliser la création de votre annonce.",
                    //         "Adresse ou ville requise", {
                    //         timeOut: 0,
                    //         closeButton: true
                    //     });
                    // }
                    return LocationService.getMine(refreshLocations);
                })
                .then(function (locations) {
                    myLocations = locations;

                    // New user can't select specific locations yet
                    if (! vm.item.listLocations || ! vm.item.listLocations.length) {
                        vm.item.listLocations = _.map(myLocations, function (location) {
                            var l = _.clone(location);
                            l.checked = true;
                            return l;
                        });
                    }

                    if (locations && locations.length) {
                        return _createItem();
                    } else {
                        toastr.warning("Nous ne pouvons malheureusement pas enregistrer votre objet sans localisation.", "Adresse ou ville requise");
                        return false;
                    }

                    // return _createItem();
                })
                .catch(afterAuthenticationErrorHandler);
        }

        function afterAuthenticationErrorHandler(err) {
            if (err === "missing email") {
                toastr.warning("L'annonce de l'objet ne peut être enregistré sans email.", "Adresse email manquante");
            } else if (err === "not authenticated") {
                toastr.info("Veuillez créez un compte en quelques secondes ou vous connecter pour publier votre annonce", "Compte requis");
            } else if (err !== "wrong password") {
                toastr.warning("Nous sommes désolés, veuillez réessayez plus tard.", "Oups, une erreur est survenue.");
                loggerToServer.error(err);
            }
        }

        function _setSaveAttrs(attrs) {
            var sellingPrice = getSellingPrice();

            if (! _.isFinite(sellingPrice)) {
                return;
            }

            return getDefaultDayOnePrice(sellingPrice)
                .then(function (defaultDayOnePrice) {
                    var dayOnePrice        = getDayOnePrice(defaultDayOnePrice);

                    attrs.sellingPrice = sellingPrice;
                    attrs.dayOnePrice  = dayOnePrice;
                    attrs.deposit      = getDeposit(dayOnePrice);

                    if (vm.showItemCategories) {
                        if (vm.selectedBrand) {
                            attrs.brandId = vm.selectedBrand.id;
                        }
                        if (vm.selectedItemCategoryLvl2) {
                            attrs.itemCategoryId = vm.selectedItemCategoryLvl2.id;
                        } else {
                            attrs.itemCategoryId = vm.selectedItemCategoryLvl1.id;
                        }
                    }

                    var customPricing = getCustomPricingConfig(dayOnePrice);

                    attrs.customPricingConfig = customPricing;

                    attrs.locations = _.reduce(vm.item.listLocations, function (memo, location) {
                        if (location.checked) {
                            memo.push(location.id);
                        }
                        return memo;
                    }, []);

                    if (! attrs.locations.length) {
                        toastr.info("Votre annonce ne pourra malheureusement pas être publiée sans localisation. "
                            + "Votre adresse complète n'apparaîtra jamais publiquement.",
                            "Adresse ou ville requise", {
                                timeOut: 20000
                            });
                    }
                });
        }

        function _createItem() {
            var createAttrs = _.pick(vm.item, [
                "name",
                "reference",
                "description",
                "stateComment",
                "bookingPreferences",
                "acceptFree",
                "listingTypesIds"
            ]);
            createAttrs.mode = vm.item.mode;

            vm.itemMedias           = mediasSelector.getMedias();
            var indexedConfigMedias = _.indexBy(vm.configMedias, "id");
            var uploadMediasManager = ItemService.getUploadMediasManager({
                medias: vm.itemMedias,
                notify: function (totalProgress, configProgress) {
                    vm.totalMediaUpload = totalProgress;

                    _.forEach(configProgress, function (obj) {
                        indexedConfigMedias[obj.id].progress = obj.progress;
                    });

                    $scope.$digest();
                }
            });

            var validationFields = _.filter(itemValidationFields, function (field) {
                return vm.itemValidationFields[field];
            });
            if (vm.itemFullValidation) {
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

            var mediasIds = [];
            var createdItem;

            return $q.when(createAttrs)
                .then(_setSaveAttrs)
                .then(function () {
                    TagService.deduplicateTagsByInsensitiveName(vm.itemTags, tags);

                    return _createNewTags();
                })
                .then(function () {
                    createAttrs.tags = _.pluck(vm.itemTags, "id");
                    return ItemService.post(createAttrs);
                })
                .then(function (newItem) {
                    createdItem = newItem;

                    // useful because other functions use it below
                    ItemService.populate(createdItem, {
                        listingTypes: vm.listingTypes
                    });

                    vm.totalMediaUpload     = 0;
                    vm.showTotalMediaUpload = true;

                    uploadMediasManager.start();

                    return ItemService
                        .uploadMedias(createdItem.id, vm.itemMedias, [], function (mediaId, progress) {
                            uploadMediasManager.updateProgress(mediaId, progress);
                        })
                        .then(function (result) {
                            _.forEach(vm.configMedias, function (configMedia) {
                                configMedia.progress = null;
                            });
                            vm.showTotalMediaUpload = false;

                            uploadMediasManager.stop();

                            if (result.uploadFail) {
                                toastr.warning("Nous sommes désolés, veuillez réessayer d'ajouter les images manquantes un peu plus tard.", "Image(s) non enregistrée(s)");
                            }
                            if (result.change) {
                                mediasIds = _.union(mediasIds, result.mediasIds);
                                return createdItem.updateMedias(result.mediasIds);
                            }
                        });
                })
                .then(function () {
                    return ItemService.getMyItems(true);
                })
                .then(function (myItems) {
                    if (vm.createAccount && ! vm.useSocialLogin) {
                        toastr.success("Veuillez confirmer votre adresse " + vm.email + " en cliquant sur le lien que nous venons de vous envoyer par email.", "Vérification de votre adresse", {
                            timeOut: 0,
                            closeButton: true
                        });
                    }

                    vm.myItems = _.cloneDeep(myItems);

                    ItemService.populate(vm.myItems, {
                        // brands: brands,
                        itemCategories: itemCategories,
                        locations: myLocations,
                        nbDaysPricing: nbDaysPricing,
                        listingTypes: vm.listingTypes
                    });

                    ItemService.setNewItemTmp(null, null);
                    ItemService.setNewItemTmp(currentUser, null);

                    newItemTmp       = null;
                    vm.createAccount = false;

                    _initItem(); // reset form content if viewCreate (no itemId in URL)
                    $rootScope.$emit("refreshStickySidebarPosition");
                    _resetMyItemsEditorState();

                    toastr.success((createAttrs.validation ? "Votre annonce sera publiée très prochainement après validation." : "Votre annonce a bien été publiée."),
                        "Bravo, objet ajouté\xa0!"
                    );

                    // default item creation: no medias
                    // so if none, do not perform update media
                    if (mediasIds.length) {
                        return createdItem.updateMedias(mediasIds);
                    } else {
                        return true;
                    }
                })
                .finally(function () {
                    // Always send Google Analytics since user is engaged
                    var gaLabel = 'itemId: ' + createdItem.id;
                    ga('send', 'event', 'Items', 'Create', gaLabel);
                    // Facebook event
                    var fbEventParams = {
                        content_name: createdItem.name,
                        content_ids: [createdItem.id],
                        sip_offer_types: ItemService.getFbOfferTypes(createdItem)
                    };

                    var fbRentingDayOnePrice = ItemService.getFbRentingDayOnePrice(createdItem);
                    var fbSellingPrice       = ItemService.getFbSellingPrice(createdItem);
                    if (typeof fbRentingDayOnePrice === "number") {
                        fbEventParams.sip_renting_day_one_price = fbRentingDayOnePrice;
                    }
                    if (typeof fbSellingPrice === "number") {
                        fbEventParams.sip_selling_price = fbSellingPrice;
                    }

                    fbq('trackCustom', 'AddItem', fbEventParams);

                    // Stelace event
                    var stelaceData = { nbPictures: mediasIds.length };
                    _addPriceRecommendationInfoToEventData(stelaceData);
                    StelaceEvent.sendEvent("Item creation", {
                        itemId: createdItem.id,
                        type: "click",
                        data: stelaceData
                    });
                });
        }

        function _updateItem() {
            vm.itemMedias           = mediasSelector.getMedias();
            var indexedConfigMedias = _.indexBy(vm.configMedias, "id");
            var uploadMediasManager = ItemService.getUploadMediasManager({
                medias: vm.itemMedias,
                notify: function (totalProgress, configProgress) {
                    vm.totalMediaUpload = totalProgress;

                    _.forEach(configProgress, function (obj) {
                        indexedConfigMedias[obj.id].progress = obj.progress;
                    });

                    $scope.$digest();
                }
            });

            return $q.when(vm.item)
            .then(_setSaveAttrs)
            .then(function () {
                    Restangular.restangularizeElement(null, vm.item, "item");

                    TagService.deduplicateTagsByInsensitiveName(vm.itemTags, tags);

                    return _createNewTags();
                })
                .then(function () {
                    vm.item.tags = _.pluck(vm.itemTags, "id");
                    return vm.item.put();
                })
                .then(function () {
                    vm.totalMediaUpload     = 0;
                    vm.showTotalMediaUpload = true;

                    uploadMediasManager.start();

                    return ItemService
                        .uploadMedias(vm.item.id, vm.itemMedias, item.medias, function (mediaId, progress) {
                            uploadMediasManager.updateProgress(mediaId, progress);
                        })
                        .then(function (result) {
                            _.forEach(vm.configMedias, function (configMedia) {
                                configMedia.progress = null;
                            });
                            vm.showTotalMediaUpload = false;

                            uploadMediasManager.stop();

                            if (result.uploadFail) {
                                toastr.warning("Nous sommes désolés, veuillez réessayer d'ajouter les images manquantes un peu plus tard.", "Image(s) non enregistrée(s)");
                            }
                            if (result.change) {
                                return vm.item.updateMedias(result.mediasIds);
                            }
                        });
                })
                .then(function () {
                    return ItemService.getMyItems(true);
                })
                .then(function (myItems) {
                    item = _.find(myItems, function (i) {
                        return item.id === i.id;
                    });

                    vm.myItems = _.cloneDeep(myItems);

                    ItemService.populate(vm.myItems, {
                        // brands: brands,
                        itemCategories: itemCategories,
                        locations: myLocations,
                        nbDaysPricing: nbDaysPricing,
                        listingTypes: vm.listingTypes
                    });

                    _initItem();
                    toastr.success("Objet modifié");
                });
        }

        function _createNewTags() {
            var newTags = _.filter(vm.itemTags, function (tag) {
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

        function onDeleteItem(itemId) {
            var index = _.findIndex(vm.myItems, function (item) {
                return item.id === itemId;
            });
            vm.myItems.splice(index, 1);
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
                    toastr.warning("Veuillez vérifier vos identifiants. Vous pouvez réinitialiser votre mot de passe en cliquant sur \"Mot de passe oublié\".",
                        "Adresse email ou mot de passe erronés");
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
                        return user.put();
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
                                toastr.warning("Veuillez réessayer de saisir votre mot de passe. Vous pouvez également le réinitialiser en cliquant sur \"Mot de passe oublié\"",
                                    "Mot de passe erroné");
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

        function _resetMyItemsEditorState() {
            vm.myItemsEditor.$setPristine();
            vm.myItemsEditor.$setUntouched();
        }

        function touchMedia(/* mediaId */) {
            _currentMediaSelection();
        }

        function selectMedia(mediaId, file) {
            mediasSelector
                .select(mediaId, file)
                .then(function () {
                    vm.isMoveModeAllowed = mediasSelector.isMoveModeAllowed();
                    vm.itemMedias        = mediasSelector.getMedias();
                    _updateUxEventData("picture");
                });
        }

        function removeMedia(mediaId) {
            mediasSelector.remove(mediaId);
            vm.isMoveModeAllowed = mediasSelector.isMoveModeAllowed();
            vm.itemMedias        = mediasSelector.getMedias();
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

        function fixCustomPricing(defaultDayOnePrice) {
            var dayOnePrice = getDayOnePrice(defaultDayOnePrice);

            var customPricing      = getCustomPricingConfig(dayOnePrice);

            if (customPricing
                && ! pricing.isValidCustomConfig(customPricing)
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

                _.forEach(vm.itemBookingPrices, function (bookingPrice, index) {
                    // difference of index because bookingPrices doesn't include dayOne price
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
                formField = vm.myItemsEditor["item" + tools.toStartCase(field)];

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

        function facebookShareMyItem() {
            if (! vm.selectedShareItem || ! vm.selectedShareItem.slug) {
                return;
            }

            usSpinnerService.spin("share-item-spinner");

            var shareUtmTags = {
                utmSource: "facebook",
                utmMedium: "social",
                utmCampaign: "item-share-owner",
                utmContent: "picture"
            };
            var itemUrl     = platform.getItemShareUrl(vm.selectedShareItem.slug, shareUtmTags);
            var description = "Ajouté(e) par " + vm.displayName + " en (presque) un éclair. "
                + "Empruntez ou achetez l'objet de vos rêves en toute sécurité ou, comme " + vm.displayName + ", créez vos propres annonces sur Sharinplace.";
            var stlEventData = {
                tagsIds: vm.selectedShareItem.tags,
                origin: itemId ? "editItem" : "myItems",
                isOwner: true
            };
            var stlEvent;

            StelaceEvent.sendEvent("Item social share", {
                type: "click",
                itemId: vm.selectedShareItem.id,
                data: stlEventData
            })
            .then(function (stelaceEvent) {
                stlEvent = stelaceEvent;

                ezfb.ui({
                    method: "share",
                    href: itemUrl,
                    // Parameters not documented
                    // See http://stackoverflow.com/questions/23781698/fb-ui-share-set-the-title-message-and-image#answer-33924247
                    description: description,
                    // picture: "https://sharinplace.fr/api/media/get/57/f461de3c-d882-43bc-bfbd-c1c90b294a38?size=300x300",
                    // title: "Enjoy"
                }, function (response) {
                    // In Graph API v2.8, response after effective sharing is []
                    if (response && ! response.error_code) { // error code only for fb authorized users
                        toastr.success("Merci d'avoir partagé\xa0!");
                        stlEventData.success = true;
                        stlEvent.update({ data: stlEventData });
                    }
                });
            })
            .finally(function () {
                usSpinnerService.stop("share-item-spinner");
            });
        }

        function getCustomPricingConfig(dayOnePrice) {
            var defaultPrices = pricing.getPrice({
                dayOne: dayOnePrice,
                nbDays: lastBreakpointDay,
                config: vm.item.id ? vm.item.pricing.config : itemPricing.config,
                array: true
            });
            var customPricing = {
                breakpoints: []
            };
            var customPrice = false;

            customPricing.breakpoints.push({
                day: 1,
                price: dayOnePrice
            });

            _.forEach(breakpointDays, function (breakpointDay) {
                var bookingPrice = _.find(vm.itemBookingPrices, function (bookingPrice) {
                    return bookingPrice.day === breakpointDay;
                });
                var custom = (typeof bookingPrice.price !== "undefined" && bookingPrice.price !== null);
                var newBreakpoint = {
                    day: breakpointDay,
                    price: custom ? bookingPrice.price : defaultPrices[breakpointDay - 1]
                };

                if (custom) {
                    customPrice = true;
                }

                customPricing.breakpoints.push(newBreakpoint);
            });

            return customPrice ? customPricing : null;
        }

        function getSellingPrice() {
            if (typeof vm.item.sellingPrice === "undefined") {
                return;
            }

            var sellingPrice = parseFloat(vm.item.sellingPrice);

            if (isNaN(sellingPrice)) {
                return;
            }

            return sellingPrice;
        }

        function getDayOnePrice(defaultDayOnePrice) {
            if (typeof vm.item.dayOnePrice === "undefined") {
                return defaultDayOnePrice;
            }

            var dayOnePrice = parseFloat(vm.item.dayOnePrice);

            if (isNaN(dayOnePrice)) {
                return defaultDayOnePrice;
            } else {
                return dayOnePrice;
            }
        }

        function getDefaultDayOnePrice(sellingPrice) {
            return $q.when(sellingPrice)
                .then(pricing.rentingPriceRecommendation)
                .then(function(recommendation) {
                    _.assign(vm.recommendedPrices, recommendation);

                    vm.defaultDayOnePrice = _.get(recommendation, "dayOnePrice") || vm.defaultDayOnePrice;

                    return vm.defaultDayOnePrice;
                });
        }

        function getDeposit(dayOnePrice) {
            var defaultDeposit = getDefaultDeposit(dayOnePrice);

            var deposit;

            if (typeof vm.item.deposit === "undefined") {
                return defaultDeposit;
            }

            deposit = parseFloat(vm.item.deposit);

            if (! isNaN(deposit)) {
                return deposit;
            } else {
                return defaultDeposit;
            }
        }

        function getDefaultDeposit(dayOnePrice) {
            return tools.clampNumber(dayOnePrice * vm.factorDeposit, initialDefaultDeposit, vm.maxDeposit);
        }

        function toggleItemListingTimeProperty(propertyName) {
            vm.listingTypesProperties.TIME = vm.listingTypesProperties.TIME || {};
            vm.listingTypesProperties.TIME[propertyName] = !vm.listingTypesProperties.TIME[propertyName];

            vm.item.listingTypesIds = [];

            if (vm.listingTypesProperties.TIME.NONE) {
                vm.item.listingTypesIds.push(vm.timeNoneListingType.id);
            }
            if (vm.listingTypesProperties.TIME.TIME_FLEXIBLE) {
                vm.item.listingTypesIds.push(vm.timeFlexibleListingType.id);
            }
        }

        function _computeListingTypesProperties() {
            // not a created item
            if (!vm.item.id) {
                // TODO: take the url filter into account
                _.forEach(vm.listingTypes, function (listingType) {
                    vm.item.listingTypesIds.push(listingType.id);
                })
            }

            vm.listingTypesProperties = ItemService.getListingTypesProperties(vm.item, vm.listingTypes);
        }
    }

})();
