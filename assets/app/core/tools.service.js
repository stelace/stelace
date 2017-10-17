(function () {

    angular
        .module("app.core")
        .factory("tools", tools);

    function tools($document, $q, $timeout, $window, cache, diacritics, Restangular, storage) {
        var stopwords;

        var service = {};
        service.isEmail          = isEmail;
        service.getDeviceType    = getDeviceType;
        service.roundDecimal     = roundDecimal;
        service.clampNumber      = clampNumber;
        service.replaceObjectFit = replaceObjectFit;
        service.fillByCharacter  = fillByCharacter;
        service.shrinkString     = shrinkString;
        service.trim             = trim;
        service.toStartCase      = toStartCase;
        service.getURLStringSafe = getURLStringSafe;
        service.isIOS            = isIOS;
        service.isIOSSafari      = isIOSSafari;
        service.isPhantomBot     = isPhantomBot;
        service.isSearchBot      = isSearchBot;
        service.onScroll         = onScroll;
        service.clearRestangular = clearRestangular;
        service.delay            = delay;
        service.debounceAction   = debounceAction;
        service.getLocalData     = getLocalData;
        service.setLocalData     = setLocalData;
        service.isStopWord       = isStopWord;
        service.shouldObfuscateMessage = shouldObfuscateMessage;

        return service;



        function isEmail(emailToTest, maxLength) {
            maxLength = maxLength || 255;
            var emailRegex = /^[a-z0-9._-]+@[a-z0-9._-]{2,}\.[a-z]{2,}$/;
            return (typeof emailToTest === "string") && (emailRegex.test(emailToTest)) && (emailToTest.length < maxLength);
        }

        function getDeviceType() {
            var types = {
                mobile: {
                    min: 0,
                    max: 640
                },
                tablet: {
                    min: 641,
                    max: 1024
                },
                desktop: {
                    min: 1025,
                    max: 1400
                },
                large: {
                    min: 1401
                }
            };

            var width = $window.outerWidth;
            var deviceType;
            var found = false;

            _.forEach(types, function (type, key) {
                if (found) {
                    return;
                }

                if ((! type.min || type.min <= width)
                 && (! type.max || width <= type.max)
                ) {
                    deviceType = key;
                    found = true;
                }
            });

            return deviceType;
        }

        function roundDecimal(num, decimal, type) {
            var divisor = Math.pow(10, decimal);

            var func;
            switch (type) {
                case "floor":
                    func = Math.floor;
                    break;

                case "ceil":
                    func = Math.ceil;
                    break;

                default:
                    func = Math.round;
                    break;
            }

            return func(num * divisor) / divisor;
        }

        function clampNumber(number, minimum, maximum) {
            var min = parseFloat(minimum);
            var max = parseFloat(maximum);

            if (isNaN(min) || isNaN(max)) {
                return number;
            } else {
                return Math.max(min, Math.min(number, max));
            }
        }

        function replaceObjectFit() {
            // Try to use <img> instead of background-image when <img> is content related (SEO)
            // Care when using this in complex flexbox items, may break object-fit (Chrome/Webkit)
            // use a fixed aspect ratio container and generate image server-side is preferred whenever possible
            var fitImagesContainers = document.getElementsByClassName("fit-replace");

            if (! Modernizr.objectfit) {
                for (var i = 0; i < fitImagesContainers.length; i++) {
                    angular.element(fitImagesContainers[i]).addClass("fit-replace-true");
                }
            } else {
                for (var j = 0; j < fitImagesContainers.length; j++) {
                    angular.element(fitImagesContainers[j]).addClass("fit-replace-false");
                }
            }
        }

        function fillByCharacter(stringOrNumber, length, options) {
            options = _.defaults(options || {}, {
                character: "0",
                direction: "left"
            });

            if (typeof stringOrNumber === "number") {
                stringOrNumber = "" + stringOrNumber;
            }

            if (length <= stringOrNumber.length) {
                return stringOrNumber;
            }

            var stringToAppend = new Array(length - stringOrNumber.length + 1).join(options.character);
            if (options.direction === "left") {
                return stringToAppend + stringOrNumber;
            } else { // options.direction === "right"
                return stringOrNumber + stringToAppend;
            }
        }

        function shrinkString(str, nbChar, nbWords) {
            var endCharacters = "…";

            if (! str) {
                return "";
            }

            if (nbWords) {
                var words      = str.split(" ");
                var firstWords = str.split(" ", nbWords).join(" ");

                if (nbWords < words.length && firstWords.length <= nbChar) {
                    return firstWords + endCharacters;
                } else {
                    return shrink(str, nbChar);
                }
            } else {
                return shrink(str, nbChar);
            }



            function shrink(str, nbChar) {
                if (str.length <= nbChar) {
                    return str;
                }

                return str.substr(0, nbChar) + endCharacters;
            }
        }

        function trim(str) {
            return str.replace(/^\s+|\s+$/g, '');
        }

        // lowerCase non-first letters in each word (separated with [space : ' -]) and works well with UTF-8
        function toStartCase(str) {
            return str.replace(/([^\s:'-])([^\s:'-]*)/g, function ($0, $1, $2){
                return $1.toUpperCase() + $2.toLowerCase();
            });
        }

        function getURLStringSafe(str) {
            return diacritics.remove(str).replace(/\W/gi, "-");
        }

        function isIOS() {
            var userAgent = $window.navigator.userAgent;
            return (/(iPhone|iPod|iPad).+AppleWebKit/i).test(userAgent);
                // && (function () {
                //     var iOSversion = userAgent.match(/OS (\d)/);
                //     return iOSversion && iOSversion.length > 1 && parseInt(iOSversion[1], 10) <= 9;
                // })();
        }

        function isIOSSafari() {
            var userAgent = $window.navigator.userAgent;
            return isIOS() && !(/(CriOS|OPiOS|FxiOS)/).test(userAgent);
        }

        function isPhantomBot(str) {
            str = str || $window.navigator.userAgent;

            var phantomRegex = /phantomjs/gi;
            return phantomRegex.test(str);
        }

        function isSearchBot(str) {
            str = str || $window.navigator.userAgent;

            var botRegex = /googlebot|crawl|slurp|bingbot/gi;
            return botRegex.test(str);
        }

        function onScroll(handler) {
            var customHandler = function () {
                // (scroll, total)
                handler($window.pageYOffset, $document[0].body.scrollHeight - $window.innerHeight);
            };

            $window.addEventListener("scroll", customHandler);

            return function () {
                $window.removeEventListener("scroll", customHandler);
            };
        }

        /**
         * Wrapper for Restangular stripRestangualr function to safely clean models instances
         * WARNING: returns another instance, not object reference. So only appropriate for one-way/time use
         * @param {object|array} elem - The object or array (of restangularized elements) to be stripped of Restangular
         */
        function clearRestangular(elem) {
            if (_.isEmpty(elem) && ! (elem && elem.restangularized)) { // Also clean empty restangularized objects
                return elem;
            }

            return Restangular.stripRestangular(elem);
        }

        function delay(duration) {
            return $q(function (resolve) {
                setTimeout(resolve, duration || 0);
            });
        }

        function debounceAction(action, additionalDelay) {
            var obj = {
                processing: false,
                process: process,
                action: action
            };

            return obj;



            function process() {
                if (obj.processing) {
                    return;
                }

                obj.processing = true;

                var args = arguments;

                return $q
                    .when()
                    .then(function () {
                        return obj.action.apply(this, args);
                    })
                    .finally(function () {
                        $timeout(function () {
                            obj.processing = false;
                            args = null;
                        }, additionalDelay || 0);
                    });
            }
        }

        function getLocalData(prop, key) {
            return $q.when()
                .then(function () {
                    var hash = cache.get(prop);

                    if (typeof hash !== "undefined") {
                        return hash;
                    }

                    return storage.getItem(prop);
                })
                .then(function (hash) {
                    hash = (hash && typeof hash === "object") ? hash : {};
                    cache.set(prop, hash);

                    return hash[key];
                })
                .catch(function () {
                    return;
                });
        }

        function setLocalData(prop, key, value, doNotDestroyIfEmpty) {
            return $q.when()
                .then(function () {
                    var hash = cache.get(prop);

                    if (typeof hash !== "undefined") {
                        return hash;
                    }

                    return storage.getItem(prop);
                })
                .then(function (hash) {
                    hash = (hash && typeof hash === "object") ? hash : {};

                    if (! doNotDestroyIfEmpty && isEmpty(value)) {
                        delete hash[key];
                    } else {
                        hash[key] = value;
                    }

                    cache.set(prop, hash);

                    if (_.isEmpty(hash)) {
                        return storage.removeItem(prop);
                    } else {
                        return storage.setItem(prop, hash);
                    }
                })
                .catch(function () {
                    return;
                });



            function isEmpty(value) {
                return typeof value === "undefined"
                    || value === null
                    || (typeof value === "object" && _.isEmpty(value));
            }
        }

        function isStopWord(word) {
            if (! stopwords) {
                // https://github.com/apache/lucene-solr/blob/master/lucene/analysis/common/src/resources/org/apache/lucene/analysis/snowball/french_stop.txt
                stopwords = [
                    "à",
                    "au",
                    "aux",
                    "avec",
                    "ce",
                    "ces",
                    "dans",
                    "de",
                    "des",
                    "du",
                    "elle",
                    "en",
                    "et",
                    "eux",
                    "il",
                    "je",
                    "la",
                    "le",
                    "leur",
                    "lui",
                    "ma",
                    "mais",
                    "me",
                    "même",
                    "mes",
                    "moi",
                    "mon",
                    "ne",
                    "nos",
                    "notre",
                    "nous",
                    "on",
                    "ou",
                    "par",
                    "pas",
                    "pour",
                    "qu",
                    "que",
                    "qui",
                    "sa",
                    "se",
                    "ses",
                    "son",
                    "sur",
                    "ta",
                    "te",
                    "tes",
                    "toi",
                    "ton",
                    "tu",
                    "un",
                    "une",
                    "vos",
                    "votre",
                    "vous",
                    "étant",
                    "ayant",
                    "ceci",
                    "cela",
                    "celà",
                    "cet",
                    "cette",
                    "ici",
                    "les",
                    "leurs",
                    "quel",
                    "quels",
                    "quelle",
                    "quelles",
                    "sans",
                    "soi"
                ];
            }

            return _.includes(stopwords, word);
        }

        function shouldObfuscateMessage(text) {
            if (typeof text !== "string") {
                return false;
            }

            var phoneRegEx = /\b(?:(?:\.|-|\/|\s)*[0-9]+){5,}\b/g; // Filters 0612345678, 06.12-34//56 78, but also 12345 Revolutionnary Road (not 1234)
            var emailRegEx = /\b[a-zA-Z0-9._%+-]+(?:@|AT|\[at\]|\[At\]|arobase|Arobase)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}\b/g;

            return phoneRegEx.test(text) || emailRegEx.test(text);
        }
    }

})();
