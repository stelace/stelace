(function () {

    angular
        .module("app.core")
        .factory("ContentService", ContentService);

    function ContentService($ngRedux, $translate) {
        var homeHeroBgStyle;

        var service = {};
        service.refreshTranslation = refreshTranslation;
        service.setHomeHeroBackground = setHomeHeroBackground;
        service.setLogo = setLogo;

        return service;



        function refreshTranslation() {
            $translate.refresh();
        }

        function setHomeHeroBackground(url) {
            if (!homeHeroBgStyle) {
                homeHeroBgStyle = document.createElement('style');
                homeHeroBgStyle.id = _.uniqueId('style_');
                document.body.appendChild(homeHeroBgStyle);
            }

            homeHeroBgStyle.innerHTML = [
                '.stelace-hero.stelace-hero__background {',
                    'background-image: url("' + url + '")',
                '}'
            ].join('');
        }

        function setLogo(url) {
            var state = $ngRedux.getState();
            var config = state.config;
            config.logoUrl = url;
            config = _.assign({}, config);

            $ngRedux.dispatch(window.actions.ConfigActions.setConfig(config));
        }
    }

})();
