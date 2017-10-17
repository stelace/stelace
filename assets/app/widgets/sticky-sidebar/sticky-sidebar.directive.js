(function () {

    angular
        .module("app.widgets")
        .directive("sipStickySidebar", sipStickySidebar);

    function sipStickySidebar($rootScope, $timeout, $window, tools) {
        return {
            restrict: "A",
            scope: {
                offset: "@",
                headerHeight: "@",
                overlayId: "@",
                scrollCta: "@", // reveal overlay after this scroll level (overrides default)
                boundId: "@" // Sets max scroll level of sidebar relative to its bottom edge, use position absolute on sticky-side bar when used
            },
            link: link
        };

        function link(scope, iElement/*, attrs */) {
            var mqLarge     = window.matchMedia("(min-width: 1024px)"); // IE10+ support
            var wdw         = angular.element($window);

            var offs        = parseInt(scope.offset, 10);
            offs            = _.isFinite(offs) ? offs : 32; //px, 16 * 2rem
            var scrollCta   = parseInt(scope.scrollCta, 10);
            scrollCta       = _.isFinite(scrollCta) ? scrollCta : 1.5 * offs;

            var headerHeight = scope.headerHeight ? parseInt(scope.headerHeight, 10) : 48; // px = 3[rem] * 16px on desktop
            var fixed       = false;
            var positionned = false;
            var shouldStick = false;
            var stopSticky  = false;
            var stopMargin  = 16; // px, as margin-bottom
            var overlay;
            var stickyParent;
            var maxBound;
            var stickyHeight;
            var boundBottomViewportOffset;
            var topPosition;
            var scrollListener;
            var refreshPositionListener;
            var refreshPositionTimeout;
            var throttledRefresh = _.throttle(_refresh, 60); // ~ 15 fps

            if (scope.boundId) { // stop sticky at some point
                stickyParent = iElement.parent()[0];
                maxBound     = document.getElementById(scope.boundId);
            }

            scope.$on('$destroy', function () {
                wdw.off("resize", throttledRefresh);
                scrollListener();
                refreshPositionListener();
                $timeout.cancel(refreshPositionTimeout);
                // Cleaning up DOM references
                wdw          = null;
                mqLarge      = null;
                stickyParent = null;
                maxBound     = null;
            });

            wdw.on("resize", throttledRefresh);
            scrollListener = tools.onScroll(throttledRefresh);
            // do not rely on onScroll scrollTop in _refresh as there is also resize event

            // Refresh position manually when needed, if available height shrinks for instance
            // Only useful when using boundId
            refreshPositionListener = $rootScope.$on("refreshStickySidebarPosition", function () {
                iElement.addClass("content--invisible");
                refreshPositionTimeout = $timeout(function () {
                    throttledRefresh();
                    iElement.removeClass("content--invisible");
                }, 600); // Give some time for reflow (e.g. after collapsing content)
            });

            if (scope.overlayId) {
                overlay = angular.element(document.getElementById(scope.overlayId));
            }

            _refresh(); // init state before scroll



            function _refresh() {
                if (! mqLarge.matches) {
                    if (fixed) {
                        iElement.removeClass("top-fixed");
                        fixed = false;
                    }
                    return;
                }

                if (maxBound) {
                    // See http://stackoverflow.com/questions/23891892/how-do-i-get-the-actual-values-for-left-right-top-bottom-of-an-absolutely-positi
                    stickyHeight              = iElement[0].offsetHeight;
                    boundBottomViewportOffset = maxBound.getBoundingClientRect().bottom;
                    stopSticky                = (boundBottomViewportOffset < stickyHeight + stopMargin + headerHeight);
                    topPosition               = boundBottomViewportOffset - stickyParent.getBoundingClientRect().top - stickyHeight - stopMargin; // 16px as margin-bottom
                    topPosition               = Math.max(0, topPosition); // Ensures that sticky is not pulled top when available height is too small
                }

                // pageYOffset is preferred to scrollY for better cross-browser compatibility (IE10/11)
                // See https://developer.mozilla.org/fr/docs/Web/API/Window/scrollY
                shouldStick = ($window.pageYOffset >= offs);

                if (stopSticky && fixed) {
                    // console.log("Fixed to Stop")
                    // Care : parents size must stay the same when applying this class
                    iElement.removeClass("top-fixed");
                    fixed = false;
                    iElement.css("top", topPosition + "px");
                    positionned = topPosition;
                } else if (stopSticky && (positionned === false || topPosition !== positionned)) {
                    // console.log("Stop")
                    iElement.css("top", topPosition + "px");
                    positionned = topPosition;
                } else if (stopSticky) {
                    // console.log("...")
                    // stopSticky has priority over shouldStick
                    return;
                } else if (shouldStick && ! fixed) {
                    // console.log("Fixed")
                    _removeTopPosition();
                    iElement.addClass("top-fixed");
                    fixed = true;
                } else if (! shouldStick && fixed) {
                    // console.log("Unfix")
                    _removeTopPosition();
                    iElement.removeClass("top-fixed");
                    fixed = false;
                } else { // e.g. window resizing
                    // console.log(".")
                    _removeTopPosition();
                }


                if (overlay) {
                    _showOverlay();
                }
            }

            function _showOverlay() {
                if (($window.pageYOffset >= scrollCta) && fixed) {
                    overlay.addClass("show-overlay");
                } else {
                    overlay.removeClass("show-overlay");
                }
            }

            function _removeTopPosition() {
                if (maxBound && positionned) {
                    // console.log("Remove style")
                    iElement.css("top", "");
                    positionned = false;
                }
            }

        }
    }

})();
