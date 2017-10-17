(function () {

    angular
        .module("app.utility")
        .directive("sipAutofocus", sipAutofocus);

    function sipAutofocus($timeout) {
        return {
            restrict: "A",
            link: link
        };

        function link(scope, element, attrs) {
            var focusTimeout;
            var setFocusTimeout = function (timeout) {
                if (timeout) {
                    focusTimeout = $timeout(function (){
                        element[0].focus();
                    }, 300);
                }
            };
            // Watch main attribute to allow autofocus reset in modals and other (app-)long-living components.
            var focusWatch = scope.$watch(attrs.sipAutofocus, setFocusTimeout);
            // Use $observe in the future if observing attribute containing interpolation -{{}}- is needed

            scope.$on('$destroy', function () {
                // clean up timeouts / watches
                $timeout.cancel(focusTimeout);
                focusWatch();
            });
        }
    }

})();
