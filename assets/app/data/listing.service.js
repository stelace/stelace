(function () {

    angular
        .module("app.data")
        .factory("ListingService", ListingService);

    function ListingService(
        $http,
        $location,
        $q,
        apiBaseUrl,
        cache,
        CleanService,
        diacritics,
        Listing,
        LocationService,
        map,
        MediaService,
        platform,
        pricing,
        Restangular,
        StelaceConfig,
        time,
        tools
    ) {
        var cacheFields = {};
        cacheFields.myListings    = "myListings";
        cacheFields.listingLocations = "listingLocations"; // prepend listing ID

        var service = Restangular.all("listing");
        service.queryListings              = queryListings;
        service.getMyListings              = getMyListings;
        service.clearMyListings            = clearMyListings;
        service.getLocations            = getLocations;
        service.getListingSlug             = getListingSlug;
        service.populate                = populate;
        service.search                  = search;
        service.getSearchFilters        = getSearchFilters;
        service.getSearchConfig         = getSearchConfig;
        service.setSearchConfig         = setSearchConfig;
        service.getNewListingTmp           = getNewListingTmp;
        service.setNewListingTmp           = setNewListingTmp;
        service.getMediasSelector       = getMediasSelector;
        service.uploadMedias            = uploadMedias;
        service.getUploadMediasManager  = getUploadMediasManager;
        service.getFbOfferTypes         = getFbOfferTypes;
        service.getFbSellingPrice       = getFbSellingPrice;
        service.getFbRentingDayOnePrice = getFbRentingDayOnePrice;
        service.getRecommendedPrices    = getRecommendedPrices;
        service.normalizeName           = normalizeName;
        service.encodeUrlQuery          = encodeUrlQuery;
        service.decodeUrlQuery          = decodeUrlQuery;
        service.encodeUrlFullQuery      = encodeUrlFullQuery;
        service.decodeUrlFullQuery      = decodeUrlFullQuery;
        service.isSearchState           = isSearchState;
        service.getListingTypesProperties = getListingTypesProperties;
        service.getMaxQuantity          = getMaxQuantity;
        service.getListingAvailabilities = getListingAvailabilities;
        service.createListingAvailabilities = createListingAvailabilities;
        service.removeListingAvailabilities = removeListingAvailabilities;

        CleanService.clean(service);

        Restangular.extendModel("listing", function (obj) {
            return Listing.mixInto(obj);
        });

        return service;



        function queryListings(query, noLabel) {
            if (! query) {
                return $q.resolve([]);
            }

            return $http.get(apiBaseUrl + "/listing/query?q=" + query)
                .then(function (res) {
                    var listings = res.data;

                    if (noLabel) {
                        return listings;
                    } else {
                        return _.map(listings, function (listing) {
                            var label = listing.id;

                            if (listing.name) {
                                label += " - " + listing.name;
                            }

                            listing.label = label;

                            return listing;
                        });
                    }
                });
        }

        function getMyListings(clearCache) {
            return $q.when()
                .then(function () {
                    if (clearCache) {
                        cache.set(cacheFields.myListings, null);
                    }

                    if (cache.get(cacheFields.myListings)) {
                        return cache.get(cacheFields.myListings);
                    } else {
                        return service.customGETLIST("my")
                            .then(function (listings) {
                                listings = tools.clearRestangular(listings);

                                cache.set(cacheFields.myListings, listings);
                                return cache.get(cacheFields.myListings);
                            })
                            .catch(function (err) {
                                return $q.reject(err);
                            });
                    }
                });
        }

        function clearMyListings() {
            cache.set(cacheFields.myListings, null);
        }

        function getLocations(listingId) { // sending only id avoids to wait for listing request
            var listing = Restangular.restangularizeElement(null, { id: listingId }, "listing");  // empty listing

            return listing.customGETLIST("locations")
                .then(function (locations) {
                    locations = tools.clearRestangular(locations);

                    _.forEach(locations, function (location) {
                        location.displayAddress = map.getPlaceName(location);
                    });

                    return locations;
                });
        }

        function getListingSlug(listing) {
            if (listing && listing.nameURLSafe && listing.id) {
                return listing.nameURLSafe + "-" + listing.id;
            } else {
                return "";
            }
        }

        function populate(listingOrListings, args) {
            args = args || {};
            var brands         = args.brands ? _.indexBy(args.brands, "id") : null;
            var listingCategories = args.listingCategories ? _.indexBy(args.listingCategories, "id") : null;
            var locations      = args.locations ? _.indexBy(args.locations, "id") : null;
            var nbDaysPricing  = args.nbDaysPricing;
            var listingTypes   = args.listingTypes;

            var _populate = function (listing) {
                if (listing.brandId && brands) {
                    listing.brandName = brands[listing.brandId].name;
                }
                if (listing.listingCategoryId && listingCategories) {
                    listing.listingCategoryName = listingCategories[listing.listingCategoryId].name;
                }
                if (listing.medias && listing.medias.length) {
                    _.forEach(listing.medias, function (media) {
                        MediaService.setUrl(media);
                    });
                    listing.url = listing.medias[0].url;
                    listing.urlPlaceholder = listing.medias[0].placeholder;
                } else {
                    listing.url = platform.getDefaultListingImageUrl();
                }
                if (listing.instructionsMedias && listing.instructionsMedias.length) {
                    _.forEach(listing.instructionsMedias, function (media) {
                        MediaService.setUrl(media);
                    });
                }
                if (locations && listing.locations && listing.locations.length) {
                    listing.vLocations = _.map(listing.locations, function (locationId) {
                        return locations[locationId];
                    });
                }
                if (listing.ownerMedia && listing.ownerMedia.url !== platform.getDefaultProfileImageUrl()) {
                    MediaService.setUrl(listing.ownerMedia);
                } else {
                    listing.ownerMedia = { url: platform.getDefaultProfileImageUrl() };
                }
                if (listing.lastTakerMedia) {
                    MediaService.setUrl(listing.lastTakerMedia);
                } else {
                    listing.lastTakerMedia = { url: platform.getDefaultProfileImageUrl() };
                }
                if (nbDaysPricing) {
                    listing.prices = pricing.getPrice({
                        config: listing.customPricingConfig || listing.pricing.config,
                        nbDays: nbDaysPricing,
                        dayOne: listing.dayOnePrice,
                        custom: !! listing.customPricingConfig,
                        array: true
                    });
                }
                if (listingTypes) {
                    listing.listingTypesProperties = getListingTypesProperties(listing, listingTypes);
                }
            };

            if (_.isArray(listingOrListings)) {
                _.forEach(listingOrListings, function (listing) {
                    _populate(listing);
                });
            } else {
                _populate(listingOrListings);
            }
        }

        function search(args) {
            args = args || {};
            args.srcUrl = args.srcUrl || $location.absUrl();

            if (! args.searchQuery) {
                throw new Error("No search query provided");
            }
            if (! _.contains(["search", "similar"], args.type)) {
                throw new Error("No type provided");
            }

            return service.customPOST(args, "search")
                .then(function (res) {
                    var obj = {
                        count: res.count,
                        page: res.page,
                        limit: res.limit,
                        listings: res.listings,
                        timestamp: res.timestamp
                    };

                    return obj;
                });
        }

        function getSearchFilters(filter) {
            var filters = {
                queryModes: [
                    { label: "Optimisée", value: "default" },
                    { label: "France entière", value: "relevance" },
                    { label: "Près de chez moi", value: "distance" }
                ]
            };

            return (typeof filter === "string") ? filters[filter] : filters;
        }

        function getSearchConfig(user) {
            var prop = "searchConfig";
            var key  = (user ? user.id : "anonymous");

            if (tools.isPhantomBot() || tools.isSearchBot()) {
                return $q.when();
            }

            return tools.getLocalData(prop, key);
        }

        function setSearchConfig(config, user) {
            var prop = "searchConfig";
            var key  = (user ? user.id : "anonymous");

            if (tools.isPhantomBot() || tools.isSearchBot()) {
                return $q.when();
            }

            return tools.setLocalData(prop, key, config);
        }

        function getNewListingTmp(user) {
            var prop = "newListing";
            var key  = (user ? user.id : "anonymous");

            return tools.getLocalData(prop, key);
        }

        function setNewListingTmp(user, listing) {
            var prop = "newListing";
            var key  = (user ? user.id : "anonymous");

            var newListing;

            try {
                newListing = JSON.parse(JSON.stringify(listing || {})); // remove unnecessary functions
            } catch (e) {
                return;
            }

            if (newListing.tags && ! newListing.tags.length) {
                delete newListing.tags;
            }

            return tools.setLocalData(prop, key, newListing);
        }

        /**
         * get images selector
         * @param  {object}   args
         * @param  {object[]} [args.medias]
         * @param  {number}   [args.maxNbMedias = 10]
         * @param  {number}   [args.nbInitCtas = 3]
         * @param  {number}   [args.nbRemainingCtas = 1]
         * @param  {number}   [args.mode = "edit"]
         * @return {object}
         */
        function getMediasSelector(args) {
            args = args || {};
            var medias          = args.medias || [];
            var maxNbMedias     = args.maxNbMedias || 10;
            var nbInitCtas      = args.nbInitCtas || 3;
            var nbRemainingCtas = args.nbRemainingCtas || 1;
            var mode            = args.mode || "edit";

            var configMedias = [];

            init();

            return {
                getConfigMedias: getConfigMedias,
                getMedias: getMedias,
                isMaxReached: isMaxReached,
                isMoveModeAllowed: isMoveModeAllowed,
                setMode: setMode,
                select: select,
                add: add,
                remove: remove,
                prev: prev,
                next: next,
                clear: clear
            };



            function init() {
                if (medias && medias.length) {
                    _.forEach(medias, function (media) {
                        _add(media);
                    });
                }

                _fillCtas();

                if (mode === "move") {
                    _recomputeMoveState();
                }
            }

            function getConfigMedias() {
                return configMedias;
            }

            function getMedias() {
                var medias = _(configMedias)
                    .pluck("media")
                    .filter(function (media) {
                        return media.url;
                    })
                    .value();

                return medias;
            }

            function isMaxReached() {
                return configMedias.length >= maxNbMedias;
            }

            function isMoveModeAllowed() {
                var medias = getMedias();
                return medias.length >= 2;
            }

            function setMode(mode) {
                if (mode === "move") {
                    _.forEach(configMedias, function (configMedia, index) {
                        configMedia.selectDisabled = true;
                        configMedia.removeDisabled = true;
                        configMedia.prevDisabled   = ! _canGoPrev(index);
                        configMedia.nextDisabled   = ! _canGoNext(index);
                    });
                } else { // mode === "edit"
                    _.forEach(configMedias, function (configMedia) {
                        configMedia.selectDisabled = false;
                        configMedia.removeDisabled = ! _canRemove(configMedia.media);
                        configMedia.prevDisabled   = true;
                        configMedia.nextDisabled   = true;
                    });
                }
            }

            function select(mediaId, file) {
                var index = _.findIndex(configMedias, function (m) {
                    return m.id === mediaId;
                });

                // check file existence (empty if the user cancel the selection)
                if (index !== -1 && file) {
                    var configMedia = configMedias[index];
                    var media       = configMedia.media;

                    return MediaService
                        .getLocalUrl(file)
                        .then(function (url) {
                            media.url                  = url;
                            media.urlChanged           = true;
                            media.name                 = name;
                            media.file                 = file;
                            configMedia.removeDisabled = ! _canRemove(media);

                            _fillCtas();
                        });
                } else {
                    return $q.resolve();
                }
            }

            function add(media) {
                _add(media);
                _fillCtas();
            }

            function remove(mediaId) {
                _remove(mediaId);
                _fillCtas();
            }

            function prev(mediaId) {
                var index = _.findIndex(configMedias, function (m) {
                    return m.id === mediaId;
                });

                if (index !== -1 && index !== 0) {
                    var tmp = configMedias[index];
                    configMedias[index] = configMedias[index - 1];
                    configMedias[index - 1] = tmp;
                }

                _recomputeMoveState();
            }

            function next(mediaId) {
                var index = _.findIndex(configMedias, function (m) {
                    return m.id === mediaId;
                });

                if (index !== -1 && index !== configMedias.length - 1) {
                    var tmp = configMedias[index];
                    configMedias[index] = configMedias[index + 1];
                    configMedias[index + 1] = tmp;
                }

                _recomputeMoveState();
            }

            function clear() {
                medias       = null;
                configMedias = null;
            }

            function _add(media) {
                if (! media) {
                    media = {
                        id: _.uniqueId("media_"),
                        fakeId: true
                    };
                }

                var obj = {
                    id: media.id,
                    media: media
                };

                if (mode === "move") {
                    obj.selectDisabled = true;
                    obj.removeDisabled = true;
                    obj.prevDisabled   = false;
                    obj.nextDisabled   = false;
                } else { // mode === "edit"
                    obj.selectDisabled = false;
                    obj.removeDisabled = ! _canRemove(media);
                    obj.prevDisabled   = true;
                    obj.nextDisabled   = true;
                }

                configMedias.push(obj);
            }

            function _remove(mediaId) {
                var index = _.findIndex(configMedias, function (m) {
                    return m.id === mediaId;
                });
                if (index !== -1) {
                    configMedias.splice(index, 1);
                }
            }

            function _canRemove(media) {
                return media.url;
            }

            function _canGoPrev(index) {
                return index > 0;
            }

            function _canGoNext(index) {
                return index < configMedias.length - 1;
            }

            function _recomputeMoveState() {
                _.forEach(configMedias, function (configMedia, index) {
                    configMedia.prevDisabled = ! _canGoPrev(index);
                    configMedia.nextDisabled = ! _canGoNext(index);
                });
            }

            function _fillCtas() {
                if (! isMaxReached()) {
                    var ctas = _getCtas();

                    var initDiff = nbInitCtas - configMedias.length;
                    if (initDiff > 0) {
                        _.times(initDiff, function () {
                            _add();
                        });
                    } else {
                        var remainingDiff = nbRemainingCtas - ctas.length;
                        if (remainingDiff > 0) {
                            _.times(remainingDiff, function () {
                                _add();
                            });
                        }
                    }
                }
            }

            function _getCtas() {
                return _.filter(configMedias, function (configMedia) {
                    return ! configMedia.media.url;
                });
            }
        }

        function uploadMedias(listingId, newMedias, oldMedias, onProgress) {
            var allPromises = _.reduce(newMedias, function (memo, media) {
                memo[media.id] = $q.when()
                    .then(function () {
                        var isNewMedia = media.fakeId || media.urlChanged;

                        if (! isNewMedia) {
                            if (! media.customName) {
                                return media.id;
                            }

                            media = Restangular.restangularizeElement(null, media, "media");
                            return media.update(media.customName)
                                .then(function () {
                                    return media.id;
                                })
                                .catch(function () {
                                    return media.id;
                                });
                        } else {
                            var params = {
                                field: "listing",
                                targetId: listingId,
                                media: media.file
                            };

                            // check the url type because angular internal blob url is an object
                            if (typeof media.url === "string" && media.url) {
                                params.url = media.url;
                            }
                            params.name = media.customName || media.file.name;

                            if (media.file) {
                                params.name = media.file.name;
                            }
                            if (media.customName) {
                                params.name = media.customName;
                            }

                            // return media id if upload succeeds, false otherwise
                            return MediaService
                                .uploadFile(params, function (progress) {
                                    if (typeof onProgress === "function") {
                                        onProgress(media.id, progress);
                                    }
                                })
                                .then(function (media) {
                                    return media.id;
                                })
                                .catch(function () {
                                    return false;
                                });
                        }
                    });

                return memo;
            }, {});

            return $q.all(allPromises)
                .then(function (hashMedias) {
                    var mediasIds = [];
                    var uploadFail = false;

                    _.forEach(newMedias, function (media) {
                        if (hashMedias[media.id]) {
                            mediasIds.push(hashMedias[media.id]);
                        } else {
                            uploadFail = true;
                        }
                    });

                    var oldMediasIds = _.pluck(oldMedias, "id");

                    return {
                        uploadFail: uploadFail,
                        mediasIds: mediasIds,
                        change: ! _.isEqual(oldMediasIds, mediasIds)
                    };
                });
        }

        /**
         * get upload medias manager
         * @param  {object}   args
         * @param  {object[]} args.medias
         * @param  {function} args.notify
         * @param  {number}   [args.timeout = 300]
         * @return {object}
         */
        function getUploadMediasManager(args) {
            args = args || {};
            var medias    = args.medias;
            var notify    = args.notify;
            var timeout   = args.timeout || 300;
            var configProgress;
            var oldConfigProgress;
            var t;

            init();

            return {
                updateProgress: updateProgress,
                start: start,
                stop: stop,
                clear: clear
            };


            function init() {
                medias = _.filter(medias, function (media) {
                    return media.fakeId || media.urlChanged;
                });

                configProgress = _.reduce(medias, function (memo, media) {
                    memo[media.id] = {
                        id: media.id,
                        progress: 0
                    };
                    return memo;
                }, {});
            }

            function updateProgress(mediaId, progress) {
                configProgress[mediaId].progress = progress;
            }

            function start() {
                t = setInterval(_notify, timeout);
            }

            function stop() {
                clearInterval(t);
                clear();
            }

            function clear() {
                medias            = null;
                notify            = null;
                configProgress    = null;
                oldConfigProgress = null;
            }

            function _notify() {
                if (_.isEqual(oldConfigProgress, configProgress)) {
                    return;
                }

                var maxProgress = medias.length * 100;
                var totalProgress = _.reduce(configProgress, function (memo, config) {
                    return memo + config.progress;
                }, 0);

                oldConfigProgress = _.cloneDeep(configProgress);
                notify(parseInt(totalProgress / maxProgress * 100, 10), configProgress);
            }
        }

        function getFbOfferTypes(listing) {
            var types = [];

            if (listing.listingTypesProperties.TIME.TIME_FLEXIBLE) {
                types.push("renting");

                if (listing.dayOnePrice === 0) {
                    types.push("sharing");
                }
            }
            if (listing.listingTypesProperties.TIME.NONE) {
                types.push("purchase");

                if (listing.sellingPrice === 0) {
                    types.push("giving");
                }
            }

            return types;
        }

        function getFbSellingPrice(listing) {
            if (! listing.listingTypesProperties.TIME.NONE) {
                return;
            }

            return listing.sellingPrice;
        }

        function getFbRentingDayOnePrice(listing) {
            if (! listing.listingTypesProperties.TIME.TIME_FLEXIBLE) {
                return;
            }

            return listing.dayOnePrice;
        }

        function getRecommendedPrices(query) {
            return service.customGET("price-recommendation", { query: query })
                .catch(function (err) {
                    return $q.reject(err);
                });
        }

        function normalizeName(name) {
            var regexes = [
                /louer/i,
                /location/i,
                /vendre/i,
                /vente/i
            ];

            var slug = name;
            _.forEach(regexes, function (regex) {
                slug = slug.replace(regex, '');
            });

            slug = _.trim(slug);
            var parts = _.compact(slug.split(" "));

            parts = _.reduce(parts, function (memo, part) {
                if (! tools.isStopWord(part)) {
                    memo.push(part);
                }
                return memo;
            }, []);

            if (parts.length > 2) {
                slug = parts.slice(0, 2).join(" ");
            }

            return slug;
        }

        function encodeUrlQuery(query) {
            if (! query) {
                return "";
            }

            return diacritics.remove(query).replace(/\s+/g, "+");
        }

        function decodeUrlQuery(query) {
            if (! query) {
                return "";
            }

            return decodeURIComponent(query)
                .replace(/\+/g, " ")
                .replace(/-/g, " ");
        }

        function encodeUrlFullQuery(query) {
            var simpleEncodedQuery = encodeUrlQuery(query);
            var fullEncodedQuery = _encodeUrlFullQuery(query);

            return simpleEncodedQuery !== fullEncodedQuery ? fullEncodedQuery : "";
        }

        function _encodeUrlFullQuery(query) {
            if (! query) {
                return "";
            }

            return encodeURIComponent(query);
        }

        function decodeUrlFullQuery(query) {
            if (! query) {
                return "";
            }

            return decodeURIComponent(query);
        }

        function isSearchState($state) {
            var searchViews = [
                "search",
                "searchWithQuery"
            ];

            return _.includes(searchViews, $state.current && $state.current.name);
        }

        function getListingTypesProperties(listing, listingTypes) {
            return _.reduce(listing.listingTypesIds, function (memo, listingTypeId) {
                var listingType = _.find(listingTypes, function (l) {
                    return l.id === listingTypeId;
                });
                if (listingType) {
                    _.forEach(listingType.properties, function (property, key) {
                        memo[key] = memo[key] || {};
                        memo[key][property] = true;
                    });
                }
                return memo;
            }, {});
        }

        function getMaxQuantity(listing, listingType) {
            var AVAILABILITY = listingType.properties.AVAILABILITY;

            var maxQuantity;

            if (AVAILABILITY === 'STOCK') {
                maxQuantity = listing.quantity;
            } else if (AVAILABILITY === 'UNIQUE') {
                maxQuantity = 1;
            } else { // AVAILABILITY === 'NONE'
                maxQuantity = Infinity;
            }

            return maxQuantity;
        }

        function getListingAvailabilities(listingId) { // sending only id avoids to wait for listing request
            var listing = Restangular.restangularizeElement(null, { id: listingId }, "listing");  // empty listing

            return listing.customGETLIST("listingAvailabilities")
                .then(function (listingAvailabilities) {
                    listingAvailabilities = tools.clearRestangular(listingAvailabilities);
                    return listingAvailabilities;
                });
        }

        function createListingAvailabilities(listingId, args) { // sending only id avoids to wait for listing request
            var listing = Restangular.restangularizeElement(null, { id: listingId }, "listing");  // empty listing

            args = args || {};
            if (!args.startDate || !time.isDateString(args.startDate)
             || !args.endDate || !time.isDateString(args.endDate)
             || args.endDate <= args.startDate
            ) {
                throw new Error('Bad params');
            }

            return listing.customPOST(args, "listingAvailabilities")
                .then(function (listingAvailability) {
                    listingAvailability = tools.clearRestangular(listingAvailability);
                    return listingAvailability;
                });
        }

        function removeListingAvailabilities(listingId, args) { // sending only id avoids to wait for listing request
            var listing = Restangular.restangularizeElement(null, { id: listingId }, "listing");  // empty listing

            args = args || {};
            if (!args.listingAvailabilityId) {
                throw new Error('Missing params');
            }

            return listing.customDELETE("listingAvailabilities", { listingAvailabilityId: args.listingAvailabilityId });
        }
    }

})();
