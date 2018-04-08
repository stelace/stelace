(function () {

    angular
        .module("app.core")
        .provider("platform", platform);

    function platform() {
        var provider = {};
        var env;
        var facebookAppId;
        provider.getEnvironment     = getEnvironment;
        provider.getFacebookAppId   = getFacebookAppId;
        provider.getAdminResolve    = getAdminResolve;
        provider.getGoogleMapApiKey = getGoogleMapApiKey;
        provider.getBestLocale      = getBestLocale;

        /* @ngInject */
        provider.$get = function ($injector, $location, $q, urlService) {
            var addedMetaTagsNames = [];

            var service = {};
            service.getEnvironment            = getEnvironment;
            service.debugDev                  = debugDev;
            service.setTitle                  = setTitle;
            service.setPageStatus             = setPageStatus;
            service.getSpriteSvgUrl           = getSpriteSvgUrl;
            service.getDefaultListingImageUrl = getDefaultListingImageUrl;
            service.getDefaultProfileImageUrl = getDefaultProfileImageUrl;
            service.getBaseUrl                = getBaseUrl;
            service.getListingShareUrl        = getListingShareUrl;
            service.getShareUrl               = getShareUrl;
            service.setMetaTags               = setMetaTags;
            service.unsetMetaTags             = unsetMetaTags;
            service.setOpenGraph              = setOpenGraph;
            service.setTwitterCard            = setTwitterCard;
            service.setPaginationLinks        = setPaginationLinks;
            service.isSelfCanonical           = isSelfCanonical;
            service.setCanonicalLink          = setCanonicalLink;
            service.unsetCanonicalLink        = unsetCanonicalLink;
            service.isTranslationKeyFormat    = isTranslationKeyFormat;
            service.getFacebookAppId          = getFacebookAppId;
            service.getDataFromServer         = getDataFromServer;
            service.getLang                   = getLang;
            service.getBestLocale             = getBestLocale;
            service.getUserLocales            = getUserLocales;
            service.parseLocale               = parseLocale;

            return service;



            function setTitle(title) {
                var translation = _getTranslationFromKey(title)

                return $q.when(_setTitle(translation));

                function _setTitle(title) {
                    document.title = title;
                    return title;
                }
            }

            function setPageStatus(status) {
                document.body.setAttribute("data-status", status);
            }

            function getSpriteSvgUrl(iconName) {
                return "/assets/build/icons/sprite.svg#" + iconName;
            }

            function getDefaultListingImageUrl() {
                return "/assets/img/app/default/default-listing.png";
            }

            function getDefaultProfileImageUrl() {
                return "/assets/img/app/default/default-user.png";
            }

            function getBaseUrl() {
                var baseUrl = $location.protocol() + "://" + $location.host();

                if (getEnvironment() === "dev") {
                    baseUrl += ":" + $location.port();
                }

                return baseUrl;
            }

            /**
             * Get listing share url with given utmTags
             * @param {string}  listingSlug                   - E.g. "Videoprojecteur-BenQ-1080ST--Full-HD-2"
             * @param {object}  [utmTags]
             * @param {string}  [utmTags.utmSource]
             * @param {string}  [utmTags.utmMedium]
             * @param {string}  [utmTags.utmCampaign]
             * @param {string}  [utmTags.utmContent]
             * @return {string} listingShareUrl
             */
            function getListingShareUrl(listingSlug, utmTags) {
                var devEnv = _.includes(["dev", "preprod"], getEnvironment());
                var listingShareUrl;

                if (devEnv) {
                    listingShareUrl = "https://stelace.com"; // fixed Url that can be crawled by Facebook
                } else {
                    listingShareUrl = getBaseUrl() + (listingSlug ? "/l/" + listingSlug : "");
                }

                if (! _.isEmpty(utmTags) && ! devEnv) {
                    // avoid false utm being tracked by prod
                    listingShareUrl = urlService.setUtmTags(listingShareUrl, utmTags);
                }

                debugDev("tagged listing url: ", urlService.setUtmTags(getBaseUrl() + "/l/" + listingSlug, utmTags));

                return listingShareUrl;
            }

            /**
             * Get share url with given utmTags
             * @param {string}  urlPath                   - must include a leading "/"
             * @param {object}  [utmTags]
             * @param {string}  [utmTags.utmSource]
             * @param {string}  [utmTags.utmMedium]
             * @param {string}  [utmTags.utmCampaign]
             * @param {string}  [utmTags.utmContent]
             * @return {string} shareUrl
             */
            function getShareUrl(urlPath, utmTags) {
                var devEnv = _.includes(["dev", "preprod"], getEnvironment());
                var shareUrl;

                if (devEnv) {
                    shareUrl = "https://stelace.com"; // fixed Url that can be crawled by Facebook
                } else {
                    shareUrl = getBaseUrl() + (urlPath || "");
                }

                if (! _.isEmpty(utmTags) && ! devEnv) {
                    // avoid false utm being tracked by prod
                    shareUrl = urlService.setUtmTags(shareUrl, utmTags);
                }

                debugDev("tagged share url: ", urlService.setUtmTags(getBaseUrl() + urlPath, utmTags));

                return shareUrl;
            }

            function setMetaTags(metaTags) {
                var head = document.getElementsByTagName("head")[0];
                var elements = [];

                _.forEach(metaTags, function (metaTagContentOrAttrs, metaName) {
                    var element = {
                        name: metaName
                    };

                    if (metaTagContentOrAttrs && typeof metaTagContentOrAttrs === "object") {
                        _.assign(element, metaTagContentOrAttrs);
                    } else {
                        element.content =
                            (isTranslationKeyFormat(metaTagContentOrAttrs) && _getTranslationFromKey(metaTagContentOrAttrs))
                            || metaTagContentOrAttrs;
                    }

                    elements.push(element);
                    addedMetaTagsNames.push(metaName);
                });

                unsetMetaTags(_.pluck(elements, "name"));
                _setElements(elements, "meta", head);
            }

            function unsetMetaTags(metaTagsNames) {
                var head = document.getElementsByTagName("head")[0];

                var removedMetaTagsNames = metaTagsNames || addedMetaTagsNames;

                _.forEach(removedMetaTagsNames, function (name) {
                    var meta = head.querySelector("meta[name='" + name + "']");
                    if (meta && meta.remove) {
                        meta.remove();
                    }
                });

                addedMetaTagsNames = _.difference(addedMetaTagsNames, removedMetaTagsNames);
            }

            function setOpenGraph(newOgTags) {
                var $rootScope = $injector.get("$rootScope");
                var head       = document.getElementsByTagName("head")[0];

                var existingOgTags = {
                    "og:type": head.querySelector("meta[property='og:type']"),
                    "og:title": head.querySelector("meta[property='og:title']"),
                    "og:url": head.querySelector("meta[property='og:url']"),
                    "og:image": head.querySelector("meta[property='og:image']"),
                    "og:image:secure_url": head.querySelector("meta[property='og:image:secure_url']"),
                    "og:image:width": head.querySelector("meta[property='og:image:width']"),
                    "og:image:height": head.querySelector("meta[property='og:image:height']"),
                    "og:description": head.querySelector("meta[property='og:description']")
                };

                var defaultOgContents = {
                    "og:type": "website",
                    "og:title": "pages.homepage.page_title",
                    "og:url": $rootScope.config.website__url,
                    "og:image": $rootScope.config.hero_background__home__url
                        || "https://stelace.com/img/brand/stelace-social-header.png",
                    "og:image:secure_url": $rootScope.config.hero_background__home__url
                        || "https://stelace.com/img/brand/stelace-social-header.png",
                    "og:image:width": 1200, // header dimensions, to update for any other image
                    "og:image:height": 630, // See https://developers.facebook.com/docs/sharing/best-practices#images
                    "og:description": "pages.homepage.meta_description"
                };

                _updateSocialMetaTags(newOgTags, existingOgTags, defaultOgContents);
            }

            function setTwitterCard(newOgTags) {
                var $rootScope = $injector.get("$rootScope");
                var head           = document.getElementsByTagName("head")[0];
                var existingOgTags = {
                    "twitter:card": head.querySelector("meta[name='twitter:card']"),
                    "twitter:site": head.querySelector("meta[name='twitter:site']"),
                    "twitter:title": head.querySelector("meta[name='twitter:title']"),
                    "twitter:description": head.querySelector("meta[name='twitter:description']"),
                    "twitter:image": head.querySelector("meta[name='twitter:image']")
                };

                var defaultOgContents = {
                    "twitter:card": "summary_large_image",
                    "twitter:site": "@" + ($rootScope.config.twitter_username || "stelaceAI"),
                    "twitter:title": "pages.homepage.page_title",
                    "twitter:description": "pages.homepage.meta_description",
                    "twitter:image": $rootScope.config.hero_background__home__url
                        || "https://stelace.com/img/brand/stelace-social-header.png"
                };

                _updateSocialMetaTags(newOgTags, existingOgTags, defaultOgContents);
            }

            function _updateSocialMetaTags(newOgTags, existingOgTags, defaultOgContents) {
                _.forEach(existingOgTags, function (ogTag, property) {
                    if (! ogTag) {
                        return;
                    }

                    var newContent;

                    if (newOgTags && newOgTags[property]) {
                        newContent = newOgTags[property];
                    } else {
                        newContent = defaultOgContents[property];
                    }

                    if (isTranslationKeyFormat(newContent)) {
                        newContent = _getTranslationFromKey(newContent);
                    }

                    ogTag.content = newContent;
                });
            }

            function setPaginationLinks(paginationLinks) {
                var head = document.getElementsByTagName("head")[0];
                var elements = [];

                var setPaginationLink = function (type) {
                    var element = { rel: type };
                    var attrsOrHref = paginationLinks[type];

                    if (typeof attrsOrHref === "undefined") {
                        return;
                    }

                    var previousElement = head.querySelector("link[rel='" + type + "']");
                    if (previousElement && previousElement.remove) {
                        previousElement.remove();
                    }

                    if (attrsOrHref === null) {
                        return;
                    }

                    if (typeof attrsOrHref === "object") {
                        _.assign(element, attrsOrHref);
                    } else if (typeof attrsOrHref === "string") {
                        element.href = attrsOrHref;
                    }

                    elements.push(element);
                };

                setPaginationLink("prev");
                setPaginationLink("next");

                _setElements(elements, "link", head);
            }

            function isSelfCanonical(canonicalUrl) {
                var url = $location.url();
                url = (url !== "/" ? url : ""); // no trailing "/" expected in canonicalUrl

                return (canonicalUrl === getBaseUrl() + url);
            }

            function setCanonicalLink(canonicalUrl) {
                var head                  = document.getElementsByTagName("head")[0];
                var existingCanonicalLink = head.querySelector("link[rel='canonical']");
                var isCanonical           = isSelfCanonical(canonicalUrl);

                if (isCanonical) {
                    if (existingCanonicalLink && existingCanonicalLink.remove) {
                        existingCanonicalLink.remove();
                    }
                    return;
                }

                if (existingCanonicalLink) {
                    existingCanonicalLink.href = canonicalUrl;
                } else {
                    var element = {
                        rel: "canonical",
                        href: canonicalUrl
                    };

                    _setElements([element], "link", head);
                }
            }

            function unsetCanonicalLink() {
                var canonicalLink = document.querySelector("head link[rel='canonical']");
                if (canonicalLink && canonicalLink.remove) {
                    canonicalLink.remove();
                }
            }

            function _setElements(elements, elementType, container) {
                var frag = document.createDocumentFragment();

                _.forEach(elements, function (attrs) {
                    var newElement = document.createElement(elementType);

                    _.forEach(attrs, function (value, key) {
                        newElement.setAttribute(key, value);
                    });

                    frag.appendChild(newElement);
                });

                container.appendChild(frag);
            }

            function _getTranslationFromKey(key) {
                var $translate = $injector.get("$translate");
                var $rootScope = $injector.get("$rootScope");

                // Handling asynchronous translation from route.js files in an ugly way for now
                if (isTranslationKeyFormat(key)) {
                    return $translate.instant(key, { SERVICE_NAME: $rootScope.config.SERVICE_NAME }); // key is a translation key
                }

                return key;
            }

            // Reasonably assume that dot-namespaced lowercase strings with no space are translation keys
            function isTranslationKeyFormat(keyCandidate) {
                return typeof keyCandidate === "string"
                    && keyCandidate.indexOf((".") >= 1) // namespace.subkey
                    && keyCandidate.indexOf((" ") < 0)
                    && keyCandidate.toLowerCase() === keyCandidate;
            }
        };

        return provider;



        function getEnvironment() {
            if (! env) {
                env = document.body.getAttribute("data-env");
            }

            if (_.includes(["dev", "prod", "preprod"], env)) {
                return env;
            } else {
                return "prod";
            }
        }

        function debugDev() {
            var userAgent = window.navigator.userAgent;
            var isIOS = (/(iPhone|iPod|iPad).+AppleWebKit/i).test(userAgent);
            var devEnv = _.includes(["dev", "preprod"], getEnvironment());

            if (! devEnv || isIOS || userAgent.indexOf('Trident/') >= 0) {
                return; // avoid type bugs
            }

            var err    = new Error("Debug error");
            var args   = Array.prototype.slice.call(arguments);

            args.push(err.stack && err.stack.split("\n").slice(2, 5).join("\n <= "));

            console.info.apply(null, args); // eslint-disable-line no-console
        }

        function getFacebookAppId() {
            if (facebookAppId) {
                return facebookAppId;
            }

            var head  = document.getElementsByTagName("head")[0];
            var appId = head.querySelector("meta[property='fb:app_id']");

            facebookAppId = (appId && appId.content);

            return facebookAppId;
        }

        function getDataFromServer() {
            if (window.dataFromServer && typeof window.dataFromServer === 'object') {
                return window.dataFromServer;
            }
        }

        function getLang() {
            var dataFromServer = getDataFromServer();
            return dataFromServer.lang;
        }

        function getBestLocale() {
            var lang = getLang();
            var userLocales = getUserLocales();

            var bestLocale;

            _.forEach(userLocales, function (locale) {
                if (bestLocale) return; // best locale already found

                var localeInfo = parseLocale(locale);
                if (localeInfo.language === lang) {
                    bestLocale = locale;
                }
            });

            if (!bestLocale) {
                bestLocale = lang;
            }

            return bestLocale;
        }

        function getUserLocales() {
            return navigator.languages || [navigator.language || navigator.userLanguage];
        }

        function parseLocale(locale) {
            var localeRegex = /([a-z]{2})(?:[_-]([a-z]{2}))?/i;
            var regexResult = localeRegex.exec(locale);
            var language = regexResult[1];
            var region = regexResult[2];

            var result = {
                language: null,
                region: null
            };

            if (language) {
                result.language = language.toLowerCase();
            }
            if (region) {
                result.region = region.toUpperCase();
            }

            return result;
        }

        function getAdminResolve() {
            return {
                $q: "$q",
                $state: "$state",
                UserService: "UserService",

                /* @ngInject */
                isAdmin: function ($q, $state, UserService) {
                    return UserService
                        .isAdmin()
                        .then(function (admin) {
                            if (! admin) {
                                $state.go("home");
                                return $q.reject();
                            }

                            return admin;
                        });
                }
            };
        }

        function getGoogleMapApiKey() {
            return window.googleMapApiKey;
        }
    }

})();
