(function () {

    angular
        .module("app.utility")
        .directive("sipAutoselect", sipAutoselect);

    function sipAutoselect($timeout, tools) {
        return {
            restrict: "EA",
            scope: {},
            link: link
        };

        function link(scope, iElement, attrs) {
            var fallback    = attrs.sipAutoselect;
            var useFallback = tools.isIOS();
            var selectionTimeout;

            scope.$on('$destroy', function () {
                iElement.off();
                $timeout.cancel(selectionTimeout);
            });

            iElement.on("focus", selectContent);
            iElement.on("click", selectContent);

            // Fallback div for iOS (impossible to select disabled input's content in Chrome iOS)
            // Simple div ,for now
            if (useFallback && fallback) {
                iElement[0].outerHTML = "<div class=\"input-style\">" + fallback + "</div>";
            }

            function selectContent() {
                selectionTimeout = $timeout(function () {
                    // A timeout is needed for focus selection to work in Chrome
                    iElement[0].setSelectionRange(0, iElement[0].value.length);
                });
            }

        }
    }

})();
