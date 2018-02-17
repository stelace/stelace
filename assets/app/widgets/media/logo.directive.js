(function () {

    angular
        .module("app.widgets")
        .directive("sipLogo", sipLogo);

    function sipLogo($ngRedux) {
        return {
            restrict: "EA",
            scope: {

            },
            templateUrl: "/assets/app/widgets/media/logo.html",
            link: link
        };

        function link(scope /*, element, attrs */) {
            setLogo(scope);

            var unsubscribeConfig = $ngRedux.subscribe(function () {
                setLogo(scope);
            });

            scope.$on("$destroy", function () {
                unsubscribeConfig();
            });
        }

        function getConfig() {
            var state = $ngRedux.getState();
            return state.config;
        }

        function setLogo(scope) {
            var config = getConfig();
            scope.hasLogo = !!config.logoUrl;
            scope.logoUrl = config.logoUrl;
        }
    }

})();
