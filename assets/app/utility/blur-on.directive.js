(function () {

    angular
        .module("app.utility")
        .directive("sipBlurOn", sipBlurOn);

    function sipBlurOn($timeout) {
        return {
            restrict: "A",
            link: link
        };

        function link(scope, element, attrs) {
            var delay   = parseInt(attrs.sipBlurDelay, 10) || 0;
            var prevent = !! attrs.sipBlurPrevent;
            var onKey   = parseInt(attrs.sipBlurOnKey, 10) || 13; // Default: enter

            var blurTimeout = function (event) {
                var key = (typeof event.which === "undefined") ? event.keyCode : event.which;

                if (key !== onKey) {
                    return;
                }

                $timeout(function () {
                    element[0].blur();
                }, delay);

                if (prevent) {
                    event.preventDefault();
                }
            };

            element.on("keydown", blurTimeout); // http://unixpapa.com/js/key.html

            scope.$on('$destroy', function () {
                $timeout.cancel(blurTimeout);
                element.off("keydown", blurTimeout);
            });
        }
    }

})();
