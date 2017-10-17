(function () {

    angular
        .module("app.widgets")
        .directive("sipUxEvent", sipUxEvent);

    function sipUxEvent($timeout, StelaceEvent, tools) {
        return {
            restrict: "A",
            link: link
        };

        function link(scope, iElement, attrs) {
            var selector       = attrs.sipUxEvent; // .class for click listener, ^class to exclude some links only, = for self
            // all a tags by default
            var debouncedEvent = tools.debounceAction(_sendEvent);
            var targets;

            scope.$on('$destroy', function () {
                // Cleaning up DOM references
                if (targets) {
                    targets.off("click", _manageEvent);
                    targets = null;
                }
            });

            $timeout(function () { // Wait for directives in current view to compile
                // Prefer using ng-show over ng-if for children to ensure existence right now (as in root for header menus)
                if (attrs.sipUxEvent && attrs.sipUxEvent.length) {
                    switch (selector[0]) {
                        case ".":
                            targets = iElement[0].getElementsByClassName(selector.slice(1));
                            break;
                        case "=":
                            targets = iElement;
                            break;
                        default:
                            targets = iElement[0].getElementsByTagName("a");
                    }
                } else {
                    targets = iElement[0].getElementsByTagName("a");
                }

                targets = angular.element(targets);
                targets.on("click", _manageEvent);
            }, 2000);

            function _manageEvent() {
                var stelaceData  = { type: "click", data: {} };
                var excludedClass = (selector[0] === "^") ? selector.slice(1) : "";
                var id            = angular.element(this).attr("id");
                var url           = angular.element(this).attr("href");
                // "this" is addEventListener target. Even non a tags can have href with ui-sref
                // So we use jqlite attr() to safely access href
                // We use this and not e.target since child in <a> triggering the event has no href (e.g. img tag)

                if (excludedClass && angular.element(this).hasClass(excludedClass)) {
                    return;
                }

                if (url) {
                    stelaceData.targetUrl = url;
                }
                if (id) {
                    stelaceData.data.id = id;
                }

                return debouncedEvent.process(stelaceData);
            }

            function _sendEvent(stelaceData) {
                StelaceEvent.sendEvent(attrs.uxEventName || "Custom click", stelaceData);
            }

        }
    }

})();
