(function () {

    angular
        .module("app.core")
        .factory("StelaceConfig", StelaceConfig);

    function StelaceConfig($ngRedux, $http, $rootScope, apiBaseUrl) {
        var service = {};
        service.getConfig       = getConfig;
        service.getListFeatures = getListFeatures;
        service.isFeatureActive = isFeatureActive;

        service.updateConfig   = updateConfig;
        service.updateFeatures = updateFeatures;

        activate();

        return service;



        function activate() {
            $ngRedux.subscribe(function () {
                $rootScope.config = getConfig();
                $rootScope.features = getListFeatures();
            });
        }

        function getConfig() {
            var state = $ngRedux.getState();
            return state.config || {};
        }

        function getListFeatures() {
            var state = $ngRedux.getState();
            return state.features || {};
        }

        function isFeatureActive(name) {
            var state = $ngRedux.getState();

            if (typeof state.features[name] === 'undefined') {
                throw new Error('Unknown feature');
            }

            return !!state.features[name];
        }

        function updateConfig(config) {
            return $http.put(apiBaseUrl + "/stelace/config", { config: config })
                .then(function (result) {
                    window.actions.ConfigActions.setConfig(result.config);
                });
        }

        function updateFeatures(features) {
            return $http.put(apiBaseUrl + "/stelace/config", { features: features })
                .then(function (result) {
                    window.actions.FeaturesActions.setFeatures(result.features);
                });
        }

    }

})();
