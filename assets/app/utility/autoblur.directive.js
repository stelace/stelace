(function () {

    angular
        .module("app.utility")
        .directive("sipAutoblur", sipAutoblur);

    function sipAutoblur($timeout) {
        return {
            restrict: "A",
            link: link
        };

        function link(scope, element, attrs) {
            var delay          = attrs.blurDelay || 0;
            var condition      = attrs.sipAutoblur;
            var blurTimeout;
            var setBlurTimeout = function () {
                if (! condition || (condition && scope.$eval(condition))) {
                    blurTimeout = $timeout(function (){
                        element[0].blur();
                    }, delay);
                }
            };

            element.on("focus", setBlurTimeout);

            scope.$on('$destroy', function () {
                $timeout.cancel(blurTimeout);
            });
        }
    }

})();
