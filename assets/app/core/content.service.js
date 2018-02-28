(function () {

    angular
        .module("app.core")
        .factory("ContentService", ContentService);

    function ContentService($ngRedux, $q, $translate, toastr) {
        var homeHeroBgStyle;

        var service = {};
        service.refreshTranslation = refreshTranslation;
        service.setHomeHeroBackground = setHomeHeroBackground;
        service.setLogo = setLogo;
        service.showNotification = showNotification;

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

        /**
         * Provide translations keys to show notification message
         * @param {String} [titleKey]
         * @param {String} messageKey
         * @param {Object} [titleValues]
         * @param {Object} [messageValues]
         * @param {String} [type = 'info'] - possible values: 'success', 'info', 'warning', 'error'
         */
        function showNotification(args) {
            var titleKey = args.titleKey;
            var messageKey = args.messageKey;
            var titleValues = args.titleValues;
            var messageValues = args.messageValues;
            var type = args.type || 'info';
            var options = args.options;

            if (typeof messageKey !== 'string') {
                throw new Error('Message key required');
            }
            if (titleKey && typeof titleKey !== 'string') {
                throw new Error('Title key must be a string');
            }

            return $q.all({
                title: titleKey ? $translate(titleKey, titleValues) : null,
                message: $translate(messageKey, messageValues),
            }).then(function (results) {
                if (results.title) {
                    toastr[type](results.message, results.title, options);
                } else {
                    toastr[type](results.message, options);
                }
            })
            .catch(function (missingKey) {
                throw new Error('Missing notification translation key: ' + missingKey);
            });
        }
    }

})();
