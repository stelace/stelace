/* global FastClick, ga */

(function () {

    angular
        .module("app")
        .config(configBlock)
        .run(runBlock);

    function configBlock($compileProvider,
        $httpProvider,
        $locationProvider,
        $logProvider,
        $ngReduxProvider,
        $sceDelegateProvider,
        $translateMessageFormatInterpolationProvider,
        $translateProvider,
        $uibTooltipProvider,
        ezfbProvider,
        lazyImgConfigProvider,
        platformProvider,
        tmhDynamicLocaleProvider,
        uiGmapGoogleMapApiProvider,
        uiSelectConfig,
        usSpinnerConfigProvider
    ) {

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
        var fallbackLanguages = ['en']; // shouldn't be useful because language is forced by server

        $translateProvider
            .registerAvailableLanguageKeys(["en", "fr"], {
                "en_*": "en",
                "fr_*": "fr"
            });

        if (typeof translations === 'object') {
            $translateProvider
                .translations(lang, translations)
                .use(lang);

            var bestLocale = platformProvider.getBestLocale();
            // if the user has a specific locale of the language, register the user locale to benefit date intl format
            if (bestLocale !== lang) {
                $translateProvider
                    .translations(bestLocale, translations)
                    .use(bestLocale);
            }

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

            mf.currency = currency || 'EUR';

            mf.addFormatters({
                number: function (v, lc, p) {
                    var params = {};

                    if (p === 'integer') {
                        params = { maximumFractionDigits: 0 };
                    } else if (p === 'percent') {
                        params = { style: 'percent' };
                    } else if (p === 'currency') {
                        var currencyObj = getCurrency(mf.currency);

                        var currencyDecimal = 2;
                        if (currencyObj) {
                            currencyDecimal = currencyObj.fraction;
                        }

                        params = {
                            style: 'currency',
                            currency: mf.currency,
                            minimumFractionDigits: 0,
                            maximumFractionDigits: currencyDecimal,
                        };
                    }

                    return new Intl.NumberFormat(lc, params).format(v);
                }
            });
        });

        tmhDynamicLocaleProvider.localeLocationPattern('/assets/bower_components/angular-i18n/angular-locale_{{locale}}.js');

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
            language: lang
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

    function runBlock($ngRedux,
        $translateMessageFormatInterpolation,
        cache,
        ContentService,
        cookie,
        external,
        platform,
        tmhDynamicLocale,
        tools,
        uiGmapGoogleMapApi
    ) {
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

        var bestLocale = platform.getBestLocale();
        // change the message format locale (date, number, currency...)
        $translateMessageFormatInterpolation.setLocale(bestLocale);

        // Change the angular $locale in run time
        // https://stackoverflow.com/questions/13007430/angularjs-and-locale
        tmhDynamicLocale.set(bestLocale.toLowerCase());

        // expose functions for ouside
        external.init();

        var config = window.dataFromServer.config;

        if (config.homeHeroBgUrl) {
            ContentService.setHomeHeroBackground(config.homeHeroBgUrl);
        }

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

    function getCurrency(code) {
        var currencies = {
            AFN: {
                fraction: 2,
            },
            EUR: {
                fraction: 2,
            },
            ALL: {
                fraction: 2,
            },
            DZD: {
                fraction: 2,
            },
            USD: {
                fraction: 2,
            },
            AOA: {
                fraction: 2,
            },
            XCD: {
                fraction: 2,
            },
            ARS: {
                fraction: 2,
            },
            AMD: {
                fraction: 2,
            },
            AWG: {
                fraction: 2,
            },
            AUD: {
                fraction: 2,
            },
            AZN: {
                fraction: 2,
            },
            BSD: {
                fraction: 2,
            },
            BHD: {
                fraction: 3,
            },
            BDT: {
                fraction: 2,
            },
            BBD: {
                fraction: 2,
            },
            BYR: {
                fraction: 0,
            },
            BZD: {
                fraction: 2,
            },
            XOF: {
                fraction: 0,
            },
            BMD: {
                fraction: 2,
            },
            BTN: {
                fraction: 2,
            },
            INR: {
                fraction: 2,
            },
            BOB: {
                fraction: 2,
            },
            BOV: {
                fraction: 2,
            },
            BAM: {
                fraction: 2,
            },
            BWP: {
                fraction: 2,
            },
            NOK: {
                fraction: 2,
            },
            BRL: {
                fraction: 2,
            },
            BND: {
                fraction: 2,
            },
            BGN: {
                fraction: 2,
            },
            BIF: {
                fraction: 0,
            },
            KHR: {
                fraction: 2,
            },
            XAF: {
                fraction: 0,
            },
            CAD: {
                fraction: 2,
            },
            CVE: {
                fraction: 2,
            },
            KYD: {
                fraction: 2,
            },
            CLF: {
                fraction: 4,
            },
            CLP: {
                fraction: 0,
            },
            CNY: {
                fraction: 2,
            },
            COP: {
                fraction: 2,
            },
            COU: {
                fraction: 2,
            },
            KMF: {
                fraction: 0,
            },
            CDF: {
                fraction: 2,
            },
            NZD: {
                fraction: 2,
            },
            CRC: {
                fraction: 2,
            },
            HRK: {
                fraction: 2,
            },
            CUC: {
                fraction: 2,
            },
            CUP: {
                fraction: 2,
            },
            ANG: {
                fraction: 2,
            },
            CZK: {
                fraction: 2,
            },
            DKK: {
                fraction: 2,
            },
            DJF: {
                fraction: 0,
            },
            DOP: {
                fraction: 2,
            },
            EGP: {
                fraction: 2,
            },
            SVC: {
                fraction: 2,
            },
            ERN: {
                fraction: 2,
            },
            ETB: {
                fraction: 2,
            },
            FKP: {
                fraction: 2,
            },
            FJD: {
                fraction: 2,
            },
            XPF: {
                fraction: 0,
            },
            GMD: {
                fraction: 2,
            },
            GEL: {
                fraction: 2,
            },
            GHS: {
                fraction: 2,
            },
            GIP: {
                fraction: 2,
            },
            GTQ: {
                fraction: 2,
            },
            GBP: {
                fraction: 2,
            },
            GNF: {
                fraction: 0,
            },
            GYD: {
                fraction: 2,
            },
            HTG: {
                fraction: 2,
            },
            HNL: {
                fraction: 2,
            },
            HKD: {
                fraction: 2,
            },
            HUF: {
                fraction: 2,
            },
            ISK: {
                fraction: 0,
            },
            IDR: {
                fraction: 2,
            },
            XDR: {
                fraction: 0,
            },
            IRR: {
                fraction: 2,
            },
            IQD: {
                fraction: 3,
            },
            ILS: {
                fraction: 2,
            },
            JMD: {
                fraction: 2,
            },
            JPY: {
                fraction: 0,
            },
            JOD: {
                fraction: 3,
            },
            KZT: {
                fraction: 2,
            },
            KES: {
                fraction: 2,
            },
            KPW: {
                fraction: 2,
            },
            KRW: {
                fraction: 0,
            },
            KWD: {
                fraction: 3,
            },
            KGS: {
                fraction: 2,
            },
            LAK: {
                fraction: 2,
            },
            LBP: {
                fraction: 2,
            },
            LSL: {
                fraction: 2,
            },
            ZAR: {
                fraction: 2,
            },
            LRD: {
                fraction: 2,
            },
            LYD: {
                fraction: 3,
            },
            CHF: {
                fraction: 2,
            },
            LTL: {
                fraction: 2,
            },
            MOP: {
                fraction: 2,
            },
            MKD: {
                fraction: 2,
            },
            MGA: {
                fraction: 2,
            },
            MWK: {
                fraction: 2,
            },
            MYR: {
                fraction: 2,
            },
            MVR: {
                fraction: 2,
            },
            MRO: {
                fraction: 2,
            },
            MUR: {
                fraction: 2,
            },
            XUA: {
                fraction: 0,
            },
            MXN: {
                fraction: 2,
            },
            MXV: {
                fraction: 2,
            },
            MDL: {
                fraction: 2,
            },
            MNT: {
                fraction: 2,
            },
            MAD: {
                fraction: 2,
            },
            MZN: {
                fraction: 2,
            },
            MMK: {
                fraction: 2,
            },
            NAD: {
                fraction: 2,
            },
            NPR: {
                fraction: 2,
            },
            NIO: {
                fraction: 2,
            },
            NGN: {
                fraction: 2,
            },
            OMR: {
                fraction: 3,
            },
            PKR: {
                fraction: 2,
            },
            PAB: {
                fraction: 2,
            },
            PGK: {
                fraction: 2,
            },
            PYG: {
                fraction: 0,
            },
            PEN: {
                fraction: 2,
            },
            PHP: {
                fraction: 2,
            },
            PLN: {
                fraction: 2,
            },
            QAR: {
                fraction: 2,
            },
            RON: {
                fraction: 2,
            },
            RUB: {
                fraction: 2,
            },
            RWF: {
                fraction: 0,
            },
            SHP: {
                fraction: 2,
            },
            WST: {
                fraction: 2,
            },
            STD: {
                fraction: 2,
            },
            SAR: {
                fraction: 2,
            },
            RSD: {
                fraction: 2,
            },
            SCR: {
                fraction: 2,
            },
            SLL: {
                fraction: 2,
            },
            SGD: {
                fraction: 2,
            },
            XSU: {
                fraction: 0,
            },
            SBD: {
                fraction: 2,
            },
            SOS: {
                fraction: 2,
            },
            SSP: {
                fraction: 2,
            },
            LKR: {
                fraction: 2,
            },
            SDG: {
                fraction: 2,
            },
            SRD: {
                fraction: 2,
            },
            SZL: {
                fraction: 2,
            },
            SEK: {
                fraction: 2,
            },
            CHE: {
                fraction: 2,
            },
            CHW: {
                fraction: 2,
            },
            SYP: {
                fraction: 2,
            },
            TWD: {
                fraction: 2,
            },
            TJS: {
                fraction: 2,
            },
            TZS: {
                fraction: 2,
            },
            THB: {
                fraction: 2,
            },
            TOP: {
                fraction: 2,
            },
            TTD: {
                fraction: 2,
            },
            TND: {
                fraction: 3,
            },
            TRY: {
                fraction: 2,
            },
            TMT: {
                fraction: 2,
            },
            UGX: {
                fraction: 0,
            },
            UAH: {
                fraction: 2,
            },
            AED: {
                fraction: 2,
            },
            USN: {
                fraction: 2,
            },
            UYI: {
                fraction: 0,
            },
            UYU: {
                fraction: 2,
            },
            UZS: {
                fraction: 2,
            },
            VUV: {
                fraction: 0,
            },
            VEF: {
                fraction: 2,
            },
            VND: {
                fraction: 0,
            },
            YER: {
                fraction: 2,
            },
            ZMW: {
                fraction: 2,
            },
            ZWL: {
                fraction: 2,
            }
        };

        return currencies[code.toUpperCase()];
    }

})();
