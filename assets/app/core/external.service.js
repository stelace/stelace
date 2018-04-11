(function () {

    angular
        .module("app.core")
        .factory("external", external);

    function external(ContentService) {
        var service = {};
        service.init = init;

        return service;



        function init() {
            window.stelaceExternal = {};
            window.stelaceExternal.refreshTranslation = ContentService.refreshTranslation;
            window.stelaceExternal.setHeroBackground = ContentService.setHeroBackground;
            window.stelaceExternal.setLogo = ContentService.setLogo;
        }
    }

})();
