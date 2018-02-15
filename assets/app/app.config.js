/* global FastClick, ga */

(function () {

    angular
        .module("app")
        .config(configBlock)
        .run(runBlock);

    function configBlock($compileProvider,
                            $locationProvider,
                            $logProvider,
                            $httpProvider,
                            $sceDelegateProvider,
                            $translateMessageFormatInterpolationProvider,
                            $uibTooltipProvider,
                            ezfbProvider,
                            lazyImgConfigProvider,
                            $ngReduxProvider,
                            platformProvider,
                            $translateProvider,
                            uiGmapGoogleMapApiProvider,
                            uiSelectConfig,
                            usSpinnerConfigProvider) {

        var reducers = window.Redux.combineReducers(window.reducers || {});
        $ngReduxProvider.createStoreWith(reducers, null, null, _populateState({}));

        if (platformProvider.getEnvironment() === "prod") {
            $compileProvider.debugInfoEnabled(false);
            $logProvider.debugEnabled(false);
        }

        // Allow to load whitelisted resources
        $sceDelegateProvider.resourceUrlWhitelist([
            "self",
            "https://stelace.com/**"
        ]);

        $httpProvider.useApplyAsync(true);

        $locationProvider
            .html5Mode(true);

        var lang = window.dataFromServer.lang;
        var currency = window.dataFromServer.currency;
        var translations = window.dataFromServer.translations;
        var fallbackLanguages = ['en'];

        $translateProvider
            .registerAvailableLanguageKeys(["en", "fr"], {
                "en_*": "en",
                "fr_*": "fr"
            });

        if (typeof translations === 'object') {
            $translateProvider
                .translations(lang, translations)
                .use(lang);

            fallbackLanguages = [lang];
        }

        $translateProvider
            .fallbackLanguage(fallbackLanguages)
            .useMessageFormatInterpolation()
            .useSanitizeValueStrategy("sceParameters") // better than "santitize" for UTF-8 chars
            // .useLocalStorage()
            // .useLoaderCache('$translationCache')
            .useStaticFilesLoader({
                prefix: "/api/contents/entries/",
                suffix: ""
            });

        $translateMessageFormatInterpolationProvider.messageFormatConfigurer(function (mf) {
            mf.intlSupport = true;

            if (currency) {
                mf.currency = currency;
            }
        });

        lazyImgConfigProvider.setOptions({
            offset: 100, // how early you want to load image (default = 100)
            errorClass: 'error-lazyload', // in case of loading image failure what class should be added (default = null)
            successClass: 'success-lazyload', // in case of loading image success what class should be added (default = null)
            // onError: function (image) {}, // function fired on loading error
            // onSuccess: function (image) {}, // function fired on loading success
            // container: angular.element(scrollable) // if scrollable container is not $window then provide it here. This can also be an array of elements.
        });

        $uibTooltipProvider.setTriggers({
            "customMouseenter" : "customMouseleave"
        }); // To use with uib-popover-hoverable directive on trigger's parent or trigger itself

        // Facebook SDK
        ezfbProvider.setLocale("fr_FR");
        // Uncomment for development debugging
        // if (_.includes(["dev", "preprod"], platformProvider.getEnvironment())) {
        //     var devLoadSDKFunction = [
        //         "$window", "$document", "$timeout", "ezfbAsyncInit", "ezfbLocale",
        //         function ($window,   $document,   $timeout,   ezfbAsyncInit,   ezfbLocale) {
        //             // Load the SDK's source Asynchronously
        //             (function (d){
        //                 var insertScript = function () {
        //                     var js, id = "facebook-jssdk", ref = d.getElementsByTagName("script")[0];
        //                     if (d.getElementById(id)) { return; }
        //                     js = d.createElement("script"); js.id = id; js.async = true;
        //                     // js.src = "//connect.facebook.net/" + ezfbLocale + "/sdk.js";
        //                     js.src = "//connect.facebook.net/" + ezfbLocale + "/sdk/debug.js";  // debug
        //                     ref.parentNode.insertBefore(js, ref);
        //                 };
        //                 $timeout(insertScript, 0, false);
        //             })($document[0]);

        //             $window.fbAsyncInit = ezfbAsyncInit;
        //     }];
        //     ezfbProvider.setLoadSDKFunction(devLoadSDKFunction);
        // }

        // Set the right FB app before loading SDK
        var facebookAppId = platformProvider.getFacebookAppId();
        if (facebookAppId) {
            ezfbProvider.setInitParams({
                appId: facebookAppId,
                version: "v2.8",
                status: true
            });
        }

        var googleMapConfig = {
            //    key: 'your api key',
            v: "3.30",
            libraries: "places",
            // sensor: false, // not required anymore since 3.22
            language: "fr"
        };

        var googleMapApiKey = platformProvider.getGoogleMapApiKey();
        if (googleMapApiKey) {
            googleMapConfig.key = googleMapApiKey;
        }

        uiGmapGoogleMapApiProvider.configure(googleMapConfig);

        uiSelectConfig.theme = "bootstrap";

        usSpinnerConfigProvider.setDefaults({
            lines: 10, // The number of lines to draw
            length: 0, // The length of each line
            width: 10, // The line thickness
            radius: 20, // The radius of the inner circle
            scale: 1, // Scales overall size of the spinner
            corners: 1, // Corner roundness (0..1)
            // rotate: 0, // The rotation offset
            // direction: 1, // 1: clockwise, -1: counterclockwise
            color: ['#00578E', '#00AA3C', '#FF7800', '#B60030', '#78287D'], // #rgb or #rrggbb or array of colors
            speed: 2, // Rounds per second
            trail: 58, // Afterglow percentage
            // shadow: false, // Whether to render a shadow
            hwaccel: true, // Whether to use hardware acceleration, see https://github.com/fgnass/spin.js/issues/132
            className: 'spinner', // The CSS class to assign to the spinner
            // zIndex: 2e9, // The z-index (defaults to 2000000000)
            // top: '50%', // Top position relative to parent
            // left: '50%' // Left position relative to parent
        });
        usSpinnerConfigProvider.setTheme('fiveColors', {
            lines: 5, // The number of lines to draw
            length: 0, // The length of each line
            width: 10, // The line thickness
            radius: 8, // The radius of the inner circle
            scale: 1, // Scales overall size of the spinner
            corners: 1, // Corner roundness (0..1)
            rotate: 55, // The rotation offset
            color: ['#FF7800', '#B60030', '#78287D', '#00578E', '#00AA3C'],
            speed: 2, // Rounds per second
            trail: 58, // Afterglow percentage
            hwaccel: true,
            className: 'spinner',
        });
    }

    function runBlock($ngRedux, $translate, cache, uiGmapGoogleMapApi, tools, cookie) {
        // auth token
        var authTokenField = "setAuthToken";

        var authToken = cookie.get(authTokenField);
        if (authToken) {
            localStorage.setItem("authToken", authToken);
            cookie.remove(authTokenField);
        }

        // uncomment it to debug performance
        // setTimeout(function () {
        //     showAngularStats();
        // });

        /// New method to avoid fastclick bugs on mobile with google places search
        // See https://github.com/ftlabs/fastclick/pull/347#issuecomment-187906439
        var needsClick = FastClick.prototype.needsClick;
        FastClick.prototype.needsClick = function (target) {
            if ((target.className || '').indexOf('pac-item') > -1) {
                return true;
            } else if ((target.parentNode.className || '').indexOf('pac-item') > -1) {
                return true;
            } else {
                return needsClick.apply(this, arguments);
            }
        };
        FastClick.attach(document.body);

        // WARNING : Foundation for apps inits viewport buggyfill in 1.2 release, patch it after each update
        // Must force buggyfill to avoid layouts vh bug (Resolved Wontfix) on iOS 8 (100vh is higher than visible viewport)...
        // See https://github.com/rodneyrehm/viewport-units-buggyfill/issues/50
        // Still true for Safari in iOS 9 and maybe for Chrome in the future
        // See http://nicolas-hoizey.com/2015/02/viewport-height-is-taller-than-the-visible-part-of-the-document-in-some-mobile-browsers.html#march-4th-update
        // So this is a short-term fix only
        if (tools.isIOS()) {
            window.viewportUnitsBuggyfill.init({ force: true });
        } else {
            window.viewportUnitsBuggyfill.init();
        }

        uiGmapGoogleMapApi.then(function () {
            cache.set("isGoogleMapSDKReady", true);
        });

        if (! tools.isPhantomBot()) {
            window.svg4everybody();
        }

        if (! window.gaFake) {
            ga(function (tracker) {
                var existingGaConfig = localStorage.getItem("gaConfig");

                if (! existingGaConfig
                 || existingGaConfig.clientId !== tracker.get("clientId")) {
                    localStorage.setItem("gaConfig", JSON.stringify({
                        clientId: tracker.get("clientId"),
                        referrer: tracker.get("referrer")
                    }));
                }
            });
        }

        // expose this function so translations can be refreshed from outside
        window.refreshTranslation = function () {
            $translate.refresh();
        };

        // Force $ngRedux.subscribe in rootScope with dispatch
        var overwriteState = _populateState({});

        $ngRedux.dispatch(window.actions.ConfigActions.setConfig(overwriteState.config));
        $ngRedux.dispatch(window.actions.FeaturesActions.setFeatures(overwriteState.features));
    }

    function _populateState(emptyState) {
        var state = emptyState || {};

        if (window.dataFromServer) {
            state.features = window.dataFromServer.features || {};
            state.config = window.dataFromServer.config || {};
        }

        return state;
    }

})();
