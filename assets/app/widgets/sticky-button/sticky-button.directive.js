(function () {

    angular
        .module("app.widgets")
        .directive("sipStickyButton", sipStickyButton);

    function sipStickyButton($document, $window, tools) {
        return {
            restrict: "A",
            link: link
        };

        function link(scope, iElement, attrs) {
            var mqLarge      = $window.matchMedia("(min-width: 1024px)"); // IE10+ support
            var wdw          = angular.element($window);
            var trigger      = attrs.sipStickyButton && $document[0].getElementById("" + attrs.sipStickyButton);
            var show         = false;
            var headerHeight = 42; // 3[rem] * 14[px] on mobile. Button shows up a bit later on tablet (should be 48px)
            var TriggerBottomViewportOffset;
            var triggerHeight;
            var scrollListener;
            var shouldShow;
            var throttledRefresh = _.throttle(_refresh, 300);

            scope.$on('$destroy', function () {
                wdw.off("resize", throttledRefresh);
                scrollListener();
                // Cleaning up DOM references
                wdw     = null;
                trigger = null;
                mqLarge = null;
            });

            wdw.on("resize", throttledRefresh);
            scrollListener = tools.onScroll(throttledRefresh);

            function _refresh() {
                if (attrs.sipStickyButton && ! trigger) {
                    trigger = $document[0].getElementById("" + attrs.sipStickyButton);
                }
                if (trigger) {
                    TriggerBottomViewportOffset = trigger.getBoundingClientRect().bottom;
                    triggerHeight               = trigger.offsetHeight;
                }
                if (mqLarge.matches) {
                    if (show) {
                        iElement.removeClass("show-cta");
                        show = false;
                    }
                    return;
                }

                shouldShow = trigger ? TriggerBottomViewportOffset < (triggerHeight + headerHeight) : false;

                if (shouldShow && ! show) {
                    // console.log("Show")
                    iElement.addClass("show-cta");
                    show = true;
                } else if (! shouldShow && show) {
                    // console.log("Hide")
                    iElement.removeClass("show-cta");
                    show = false;
                } else { // e.g. window resizing
                    // console.log(".")
                }
            }

        }
    }

})();
