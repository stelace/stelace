(function () {

    angular
        .module("app.core")
        .factory("storage", storage);

    /** see https://github.com/ocombe/angular-localForage **/
    function storage($localForage) {
        var service = {};
        var cache = {};

        service.isCompatible = isCompatible;
        service.setDriver    = setDriver;
        service.driver       = driver;
        service.setItem      = setItem;
        service.getItem      = getItem;
        service.removeItem   = removeItem;
        service.pull         = pull;
        service.clear        = clear;
        service.key          = key;
        service.keys         = keys;
        service.length       = k_length;
        service.iterate      = iterate;

        return service;




        function isCompatible() {
            var testField = "_storageTest";

            return $localForage.setItem(testField, testField)
                .then(function () {
                    return $localForage.removeItem(testField);
                })
                .then(function () {
                    return true;
                })
                .catch(function () {
                    return false;
                });
        }

        function setDriver(driver) {
            $localForage.setDriver(driver);
        }

        function driver() {
            return $localForage.driver();
        }

        function setItem(key, value) {
            return isCompatible()
                .then(function (compatible) {
                    if (! compatible) {
                        if (typeof key !== "string") {
                            var tmpKey = JSON.stringify(key);
                            cache[tmpKey] = value;
                        } else {
                            cache[key] = value;
                        }

                        return;
                    } else {
                        return $localForage.setItem(key, value);
                    }
                });
        }

        function getItem(key) {
            return isCompatible()
                .then(function (compatible) {
                    if (! compatible) {
                        if (typeof key !== "string") {
                            var tmpKey = JSON.stringify(key);
                            return cache[tmpKey];
                        } else {
                            return cache[key];
                        }
                    } else {
                        return $localForage.getItem(key);
                    }
                });
        }

        function removeItem(key) {
            return isCompatible()
                .then(function (compatible) {
                    if (! compatible) {
                        if (typeof key !== "string") {
                            var tmpKey = JSON.stringify(key);
                            delete cache[tmpKey];
                        } else {
                            delete cache[key];
                        }

                        return;
                    } else {
                        return $localForage.removeItem(key);
                    }
                });
        }

        function pull(key) {
            var tmpKey;
            var value;

            return isCompatible()
                .then(function (compatible) {
                    if (! compatible) {
                        if (typeof key !== "string") {
                            tmpKey = JSON.stringify(key);
                        } else {
                            tmpKey = key;
                        }

                        value = _.cloneDeep(cache[tmpKey]);
                        delete cache[tmpKey];
                        return value;
                    } else {
                        return $localForage.pull(key);
                    }
                });
        }

        function clear() {
            return isCompatible()
                .then(function (compatible) {
                    if (! compatible) {
                        cache = {};
                        return;
                    } else {
                        return $localForage.clear();
                    }
                });
        }

        function key(n) {
            return isCompatible()
                .then(function (compatible) {
                    if (! compatible) {
                        return null;
                    } else {
                        return $localForage.key(n);
                    }
                });
        }

        function keys() {
            return isCompatible()
                .then(function (compatible) {
                    if (! compatible) {
                        return _.keys(cache);
                    } else {
                        return $localForage.keys();
                    }
                });
        }

        function k_length() {
            return isCompatible()
                .then(function (compatible) {
                    if (! compatible) {
                        return _.keys(cache).length;
                    } else {
                        return $localForage.length();
                    }
                });
        }

        function iterate(iteratorCallback) {
            return isCompatible()
                .then(function (compatible) {
                    if (! compatible) {
                        return null;
                    } else {
                        return $localForage.iterate(iteratorCallback);
                    }
                });
        }
    }

})();
