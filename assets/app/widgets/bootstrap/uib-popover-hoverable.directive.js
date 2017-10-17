(function () {

    angular
        .module("app.widgets")
        .directive("uibPopoverHoverable", uibPopoverHoverable);

    function uibPopoverHoverable($document, $rootScope, $timeout) {
        return {
            restrict: "A",
            link: link,
            controller: controller
        };

        function link(scope, iElement, attrs) {
            // e.g. triggerEl = clickable uib-progress element (nested in iElement or not, or same element)
            var triggerEl = attrs.uibPopoverHoverableTriggerId ? $document[0].getElementById("" + attrs.uibPopoverHoverableTriggerId) : iElement[0];
            var opened    = false;
            var showTimeout;
            var hideTimeout;

            scope.$on('$destroy', function () {
                $timeout.cancel(showTimeout);
                $timeout.cancel(hideTimeout);
                iElement.off();
            });

            $rootScope.insidePopover = false;

            iElement.on("mouseenter", function () {
                scope.showGamificationPopover();
            });
            iElement.on('mouseleave', function () {
                scope.hideGamificationPopover();
            });

            scope.hideGamificationPopover = function () {
                $timeout.cancel(showTimeout);
                // console.log("popover closing scheduled")
                hideTimeout = $timeout(function () {
                    // if (! $rootScope.insidePopover) {
                    // Check is not useful anymore with timeouts in controller
                    // Comment this check since insidePopover state can be wrong (e.g. just after using close button)
                    triggerEl.dispatchEvent(new CustomEvent("customMouseleave"));
                    opened = false;
                    // }
                }, 400);
            }

            scope.showGamificationPopover = function () {
                $timeout.cancel(hideTimeout);
                // console.log("popover opening scheduled")
                showTimeout = $timeout(function () {
                    // if (! $rootScope.insidePopover) {
                    // Same comments as above
                    triggerEl.dispatchEvent(new CustomEvent("customMouseenter"));
                    if (! opened) {
                        scope.attachEvents(iElement, triggerEl);
                    }
                    opened = true;
                    // }
                }, 200);
            }
        }

        function controller($document, $rootScope, $scope, $timeout) {
            var isChildPopover;

            // Must be called each time popover is opened
            $scope.attachEvents = function (iElement, triggerEl) {
                var popover = $document[0].getElementsByClassName("popover");
                // popover can be iElement's sibling, child or can be appended to body
                var popoverEl;

                if (popover.length) {
                    // check on each call from link.
                    isChildPopover = isChildPopover || (iElement[0] === popover[0].parentNode);

                    popoverEl = angular.element(popover[0]);
                    popoverEl.on("mouseenter", function () {
                        // console.log("enter popover")
                        $rootScope.insidePopover = true;
                        if (! isChildPopover) { // Manual trigger needed
                            $scope.showGamificationPopover();
                        }
                    });
                    popoverEl.on("mouseleave", function () {
                        // console.log("leave popover")
                        $rootScope.insidePopover = false;
                        if (! isChildPopover) {
                            $scope.hideGamificationPopover();
                        }
                    });
                }
            }
        }
    }

})();
