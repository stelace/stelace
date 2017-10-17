(function () {

    angular
        .module("app.data")
        .factory("ItemService", ItemService);

    function ItemService(
        $http,
        $location,
        $q,
        apiBaseUrl,
        cache,
        CleanService,
        diacritics,
        Item,
        LocationService,
        map,
        MediaService,
        platform,
        pricing,
        Restangular,
        StelaceConfig,
        tools
    ) {
        var cacheFields = {};
        cacheFields.myItems       = "myItems";
        cacheFields.itemLocations = "itemLocations"; // prepend item ID

        var service = Restangular.all("item");
        service.queryItems              = queryItems;
        service.getMyItems              = getMyItems;
        service.clearMyItems            = clearMyItems;
        service.getLocations            = getLocations;
        service.getItemSlug             = getItemSlug;
        service.populate                = populate;
        service.search                  = search;
        service.getSearchFilters        = getSearchFilters;
        service.getSearchConfig         = getSearchConfig;
        service.setSearchConfig         = setSearchConfig;
        service.getNewItemTmp           = getNewItemTmp;
        service.setNewItemTmp           = setNewItemTmp;
        service.getMediasSelector       = getMediasSelector;
        service.uploadMedias            = uploadMedias;
        service.getUploadMediasManager  = getUploadMediasManager;
        service.getFbOfferTypes         = getFbOfferTypes;
        service.getFbSellingPrice       = getFbSellingPrice;
        service.getFbRentingDayOnePrice = getFbRentingDayOnePrice;
        service.getItemAction           = getItemAction;
        service.getRecommendedPrices    = getRecommendedPrices;
        service.normalizeName           = normalizeName;
        service.encodeUrlQuery          = encodeUrlQuery;
        service.decodeUrlQuery          = decodeUrlQuery;
        service.encodeUrlFullQuery      = encodeUrlFullQuery;
        service.decodeUrlFullQuery      = decodeUrlFullQuery;
        service.isSearchState           = isSearchState;

        CleanService.clean(service);

        Restangular.extendModel("item", function (obj) {
            return Item.mixInto(obj);
        });

        return service;



        function queryItems(query, noLabel) {
            if (! query) {
                return $q.resolve([]);
            }

            return $http.get(apiBaseUrl + "/item/query?q=" + query)
                .then(function (res) {
                    var items = res.data;

                    if (noLabel) {
                        return items;
                    } else {
                        return _.map(items, function (item) {
                            var label = item.id;

                            if (item.name) {
                                label += " - " + item.name;
                            }

                            item.label = label;

                            return item;
                        });
                    }
                });
        }

        function getMyItems(clearCache) {
            return $q.when()
                .then(function () {
                    if (clearCache) {
                        cache.set(cacheFields.myItems, null);
                    }

                    if (cache.get(cacheFields.myItems)) {
                        return cache.get(cacheFields.myItems);
                    } else {
                        return service.customGETLIST("my")
                            .then(function (items) {
                                items = tools.clearRestangular(items);

                                cache.set(cacheFields.myItems, items);
                                return cache.get(cacheFields.myItems);
                            })
                            .catch(function (err) {
                                return $q.reject(err);
                            });
                    }
                });
        }

        function clearMyItems() {
            cache.set(cacheFields.myItems, null);
        }

        function getLocations(itemId) { // sending only id avoids to wait for item request
            var item = Restangular.restangularizeElement(null, { id: itemId }, "item");  // empty item

            return item.customGETLIST("locations")
                .then(function (locations) {
                    locations = tools.clearRestangular(locations);

                    _.forEach(locations, function (location) {
                        location.displayAddress = map.getPlaceName(location);
                    });

                    return locations;
                });
        }

        function getItemSlug(item) {
            if (item && item.nameURLSafe && item.id) {
                return item.nameURLSafe + "-" + item.id;
            } else {
                return "";
            }
        }

        function populate(itemOrItems, args) {
            args = args || {};
            var brands         = args.brands ? _.indexBy(args.brands, "id") : null;
            var itemCategories = args.itemCategories ? _.indexBy(args.itemCategories, "id") : null;
            var locations      = args.locations ? _.indexBy(args.locations, "id") : null;
            var nbDaysPricing  = args.nbDaysPricing;

            var _populate = function (item) {
                if (item.brandId && brands) {
                    item.brandName = brands[item.brandId].name;
                }
                if (item.itemCategoryId && itemCategories) {
                    item.itemCategoryName = itemCategories[item.itemCategoryId].name;
                }
                if (item.medias && item.medias.length) {
                    _.forEach(item.medias, function (media) {
                        MediaService.setUrl(media);
                    });
                    item.url = item.medias[0].url;
                    item.urlPlaceholder = item.medias[0].placeholder;
                } else {
                    item.url = platform.getDefaultItemImageUrl();
                }
                if (item.instructionsMedias && item.instructionsMedias.length) {
                    _.forEach(item.instructionsMedias, function (media) {
                        MediaService.setUrl(media);
                    });
                }
                if (locations && item.locations && item.locations.length) {
                    item.vLocations = _.map(item.locations, function (locationId) {
                        return locations[locationId];
                    });
                }
                if (item.ownerMedia && item.ownerMedia.url !== platform.getDefaultProfileImageUrl()) {
                    MediaService.setUrl(item.ownerMedia);
                } else {
                    item.ownerMedia = { url: platform.getDefaultProfileImageUrl() };
                }
                if (item.lastBookerMedia) {
                    MediaService.setUrl(item.lastBookerMedia);
                } else {
                    item.lastBookerMedia = { url: platform.getDefaultProfileImageUrl() };
                }
                if (nbDaysPricing) {
                    item.prices = pricing.getPrice({
                        config: item.customPricingConfig || item.pricing.config,
                        nbDays: nbDaysPricing,
                        dayOne: item.dayOnePrice,
                        custom: !! item.customPricingConfig,
                        array: true
                    });
                }
            };

            if (_.isArray(itemOrItems)) {
                _.forEach(itemOrItems, function (item) {
                    _populate(item);
                });
            } else {
                _populate(itemOrItems);
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
                        items: res.items,
                        timestamp: res.timestamp
                    };

                    return obj;
                });
        }

        function getSearchFilters(filter) {
            var filters = {
                transactionTypes: [
                    { label: "Location / Vente", value: "all" },
                    { label: "Location", value: "rental" },
                    { label: "Vente", value: "sale" }
                ],
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

        function getNewItemTmp(user) {
            var prop = "newItem";
            var key  = (user ? user.id : "anonymous");

            return tools.getLocalData(prop, key);
        }

        function setNewItemTmp(user, item) {
            var prop = "newItem";
            var key  = (user ? user.id : "anonymous");

            var newItem;

            try {
                newItem = JSON.parse(JSON.stringify(item || {})); // remove unnecessary functions
            } catch (e) {
                return;
            }

            if (newItem.tags && ! newItem.tags.length) {
                delete newItem.tags;
            }

            return tools.setLocalData(prop, key, newItem);
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

        function uploadMedias(itemId, newMedias, oldMedias, onProgress) {
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
                                field: "item",
                                targetId: itemId,
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

        function getFbOfferTypes(item) {
            var types = [];

            if (item.rentable) {
                types.push("renting");

                if (item.dayOnePrice === 0) {
                    types.push("sharing");
                }
            }
            if (item.sellable) {
                types.push("purchase");

                if (item.sellingPrice === 0) {
                    types.push("giving");
                }
            }

            return types;
        }

        function getFbSellingPrice(item) {
            if (! item.sellable) {
                return;
            }

            return item.sellingPrice;
        }

        function getFbRentingDayOnePrice(item) {
            if (! item.rentable) {
                return;
            }

            return item.dayOnePrice;
        }

        function getItemAction(item, config) {
            if (item.rentable && item.sellable) {
                return config.rentableAndSellable;
            } else if (item.rentable) {
                return config.rentable;
            } else if (item.sellable) {
                return config.sellable;
            }
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
            const simpleEncodedQuery = encodeUrlQuery(query);
            const fullEncodedQuery = _encodeUrlFullQuery(query);

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
    }

})();
