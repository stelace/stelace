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

        /* @ngInject */
        provider.$get = function ($injector, $location, $q, urlService) {
            var addedMetaTagsNames = [];

            var service = {};
            service.getEnvironment            = getEnvironment;
            service.debugDev                  = debugDev;
            service.setTitle                  = setTitle;
            service.setPageStatus             = setPageStatus;
            service.getSpriteSvgUrl           = getSpriteSvgUrl;
            service.getDefaultItemImageUrl    = getDefaultItemImageUrl;
            service.getDefaultProfileImageUrl = getDefaultProfileImageUrl;
            service.getBaseUrl                = getBaseUrl;
            service.getItemShareUrl           = getItemShareUrl;
            service.getShareUrl               = getShareUrl;
            service.setMetaTags               = setMetaTags;
            service.unsetMetaTags             = unsetMetaTags;
            service.setOpenGraph              = setOpenGraph;
            service.setTwitterCard            = setTwitterCard;
            service.setPaginationLinks        = setPaginationLinks;
            service.isSelfCanonical           = isSelfCanonical;
            service.setCanonicalLink          = setCanonicalLink;
            service.unsetCanonicalLink        = unsetCanonicalLink;
            service.getFacebookAppId          = getFacebookAppId;
            service.getDataFromServer         = getDataFromServer;

            return service;



            function setTitle(title) {
                return _checkMetaTranslationKey(title)
                    .then(function (translationIds) {
                        return _setTitle(translationIds[title]);
                    })

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

            function getDefaultItemImageUrl() {
                return "/assets/img/app/default/default-item.png";
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
             * Get item share url with given utmTags
             * @param {string}  itemSlug                   - E.g. "Videoprojecteur-BenQ-1080ST--Full-HD-2"
             * @param {object}  [utmTags]
             * @param {string}  [utmTags.utmSource]
             * @param {string}  [utmTags.utmMedium]
             * @param {string}  [utmTags.utmCampaign]
             * @param {string}  [utmTags.utmContent]
             * @return {string} itemShareUrl
             */
            function getItemShareUrl(itemSlug, utmTags) {
                var devEnv = _.includes(["dev", "preprod"], getEnvironment());
                var itemShareUrl;

                if (devEnv || ! itemSlug) {
                    itemShareUrl = "https://sharinplace.fr/item/27"; // fixed Url that can be crawled by Facebook
                } else {
                    itemShareUrl = getBaseUrl() + "/item/" + itemSlug;
                }

                if (! _.isEmpty(utmTags) && ! devEnv) {
                    itemShareUrl = urlService.setUtmTags(itemShareUrl, utmTags);
                }

                if (devEnv) { // avoid false utm being tracked by prod
                    console.log("tagged item url: ", urlService.setUtmTags(getBaseUrl() + "/item/" + itemSlug, utmTags));
                }

                return itemShareUrl;
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

                if (devEnv || ! urlPath) {
                    shareUrl = "https://sharinplace.fr"; // fixed Url that can be crawled by Facebook
                } else {
                    shareUrl = getBaseUrl() + urlPath;
                }

                if (! _.isEmpty(utmTags) && ! devEnv) {
                    shareUrl = urlService.setUtmTags(shareUrl, utmTags);
                }

                if (devEnv) { // avoid false utm being tracked by prod
                    console.log("tagged share url: ", urlService.setUtmTags(getBaseUrl() + urlPath, utmTags));
                }

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
                        element.content = metaTagContentOrAttrs;
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
                var head           = document.getElementsByTagName("head")[0];
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
                    "og:title": "Sharinplace: Soyez égoïstes, partagez\xa0!",
                    "og:url": "https://sharinplace.fr",
                    "og:image": "https://sharinplace.fr/assets/img/common/SharinplaceHeader.png",
                    "og:image:secure_url": "https://sharinplace.fr/assets/img/common/SharinplaceHeader.png",
                    "og:image:width": 1200, // Sharinplace header dimensions, to update for any other image
                    "og:image:height": 630, // See https://developers.facebook.com/docs/sharing/best-practices#images
                    "og:description": "Achetez, vendez et louez vos objets entre particuliers. Matériel high-tech, bricolage, mode, loisirs… Dépôt d’annonce gratuit."
                };

                _.forEach(existingOgTags, function (ogTag, property) {
                    if (! ogTag) {
                        return;
                    }
                    if (newOgTags && newOgTags[property]) {
                        ogTag.content = newOgTags[property];
                    } else {
                        ogTag.content = defaultOgContents[property];
                    }
                });
            }

            function setTwitterCard(newOgTags) {
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
                    "twitter:site": "@sharinplace",
                    "twitter:title": "Partage d'objets en libre-service et location entre particuliers",
                    "twitter:description": "Achetez, vendez et louez vos objets entre particuliers. Matériel high-tech, bricolage, mode, loisirs… Dépôt d’annonce gratuit.",
                    "twitter:image": "https://sharinplace.fr/assets/img/common/SharinplaceHeader.png"
                };

                _.forEach(existingOgTags, function (ogTag, property) {
                    if (! ogTag) {
                        return;
                    }
                    if (newOgTags && newOgTags[property]) {
                        ogTag.content = newOgTags[property];
                    } else {
                        ogTag.content = defaultOgContents[property];
                    }
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

            function _checkMetaTranslationKey(key) {
                var $translate = $injector.get("$translate");
                var $rootScope = $injector.get("$rootScope");
                var mockedTranslation = {};

                // Handling asynchronous translation from route.js files in an ugly way for now
                // presume that strings without any space are not keys
                if (typeof key === "string" && key.indexOf(" ") <= 0) {
                    return $translate([key], { service_name: $rootScope.SERVICE_NAME }); // key is a translation key
                }

                mockedTranslation[key] = key; // not a real key
                return $q.when(mockedTranslation);
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

            if (isIOS || userAgent.indexOf('Trident/') >= 0) {
                return; // avoid type bugs
            }

            var devEnv = _.includes(["dev", "preprod"], getEnvironment());
            var err    = new Error("Debug error");
            var args   = Array.prototype.slice.call(arguments);

            args.push(err.stack && err.stack.split("\n").slice(2, 5).join("\n <= "));

            if (devEnv) {
                console.info.apply(null, args);
            }
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
