(function () {

    angular
        .module("app.core")
        .factory("StelaceConfig", StelaceConfig);

    function StelaceConfig($ngRedux) {
        var service = {};
        service.getListFeatures = getListFeatures;
        service.isFeatureActive = isFeatureActive;

        activate();

        return service;



        function activate() {

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

    }

})();
