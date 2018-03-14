/* global Hammer */

(function () {

    angular
        .module("app.layout")
        .controller("OffCanvasMenuController", OffCanvasMenuController);

    function OffCanvasMenuController($document,
                                $location,
                                $rootScope,
                                $scope,
                                $state,
                                $timeout,
                                authentication,
                                authenticationModal,
                                cache,
                                FoundationApi,
                                gamification,
                                MediaService,
                                referral,
                                StelaceConfig,
                                StelaceEvent,
                                platform) {

        var listeners = [];
        var document  = angular.element($document[0].documentElement);
        var root      = angular.element($document[0].getElementById("root-content"));
        var header    = angular.element($document[0].getElementById("header-container"));
        var offcanvas = $document[0].getElementById("offcanvas-menu");
        var content   = offcanvas.children[0];

        var vm = this;
        vm.isAuthenticated  = false;
        vm.profileImgSrc    = null;
        vm.userFirstname    = null;
        vm.memberLinks      = null;
        vm.isMenuOpen       = false;
        vm.menuTabindex     = -1; // updated upon opening for keyboard accessbility
        vm.currentUrl       = $location.url();
        vm.newMessagesCount = 0;
        vm.showGamification = StelaceConfig.isFeatureActive('GAMIFICATION');
        vm.showReferral     = StelaceConfig.isFeatureActive('REFERRAL');

        vm.authenticate      = authenticate;
        vm.closeMenu         = closeMenu;
        vm.logout            = logout;

        var memberLinks = [];

        memberLinks = memberLinks.concat([
            {
                labelKey: 'navigation.account',
                color: "blue",
                icon: "home",
                sref: "account"
            }
        ]);

        if (vm.showReferral) {
            memberLinks = memberLinks.concat([
                {
                    labelKey: 'navigation.invite',
                    color: "red",
                    icon: "megaphone",
                    sref: "invite"
                }
            ]);
        }

        memberLinks = memberLinks.concat([
            {
                labelKey: 'navigation.new_listing',
                color: "purple",
                icon: "clipboard-pencil",
                sref: "listingCreate"
            },
            {
                labelKey: 'navigation.search',
                color: "orange",
                icon: "magnifying",
                sref: "search"
            },
            {
                labelKey: 'navigation.inbox',
                color: "blue",
                icon: "email-envelope",
                sref: "inbox({ f: null })"
            },
            {
                labelKey: vm.showGamification ? 'navigation.rewards' : 'navigation.public_profile',
                color: "gold",
                icon: vm.showGamification ? "trophy" : "user",
                sref: "userMe"
            },
            {
                labelKey: 'navigation.my_listings',
                color: "purple",
                icon: "tag",
                sref: "myListings"
            },
        ]);

        activate();



        function activate() {
            // Manage swipe closing manually instead of using FA zf-swipe-close, to ensure vscroll (touch-action: pan-y)
            // Hamme sets touch-action to none by default.
            // See http://hammerjs.github.io/touch-action/
            var HammerManager = new Hammer.Manager(offcanvas, {
                touchAction: "pan-y",
                recognizers: [
                    [Hammer.Swipe]
                ]
            });
            HammerManager.get('swipe').set({
                direction: Hammer.DIRECTION_ALL,
                threshold: 5, // this is how far the swipe has to travel
                velocity: 0.3 // and this is how fast the swipe must travel
            });
            HammerManager.on("swiperight", function () {
                $rootScope.$emit("offCanvasMenuState", "close");
            });

            var hideOffCanvas = function () {
                $rootScope.$emit("offCanvasMenuState", "close");
            };

            root.on("click", hideOffCanvas); // bubbling phase by default
            header.on("click", hideOffCanvas);
            listeners.push(function () {
                root.off("click", hideOffCanvas);
                header.off("click", hideOffCanvas);
            });

            memberLinks = _.map(memberLinks, function (link) {
                link.iconUrl = platform.getSpriteSvgUrl(link.icon);
                return link;
            });
            vm.memberLinks = memberLinks;

            $timeout(_isAuthenticated, 500); // give some time to cache result from header controller

            listeners.push(
                $rootScope.$on("offCanvasMenuState", function (event, state) {
                    FoundationApi.publish("offcanvas-menu", state);
                    $timeout(function () {
                        if (state === "toggle") {
                            vm.isMenuOpen = ! vm.isMenuOpen;
                        } else if (state === "close") {
                            vm.isMenuOpen = false;
                        }

                        // Lock body scroll (except for arrows) when menu is open. Preferred to overflow:hidden CSS applied to html & body
                        // Since it can cause bugs on some devices (tested on Firefox Android 5)
                        // and it almost never retains scroll level after closing menu
                        if (vm.isMenuOpen) {
                            document.on("touchmove wheel", _lockBodyScroll);
                            StelaceEvent.sendEvent("Offcanvas menu opening", {
                                type: "click"
                            });
                        } else {
                            document.off("touchmove wheel", _lockBodyScroll);
                        }
                        vm.menuTabindex = vm.isMenuOpen ? 0 : -1;
                        // jqLite is not within the context of angular so we have to $digest (e.g. with timeout)
                        // in case call comes from hideOffcanvas function (root jqLite element listener)
                        // http://stackoverflow.com/questions/12729122/angularjs-prevent-error-digest-already-in-progress-when-calling-scope-apply
                    });
                })
            );

            listeners.push(
                $rootScope.$on("isAuthenticated", function (event, isAuthenticated) {
                    vm.isAuthenticated = isAuthenticated;
                })
            );

            listeners.push(
                $rootScope.$on("refreshInbox", function (event, data) {
                    if (data && ! isNaN(data.newMessagesCount)) {
                        vm.newMessagesCount = data.newMessagesCount;
                    }
                })
            );

            $scope.$on("$destroy", function () {
                _.forEach(listeners, function (listener) {
                    listener();
                });
                document.off("touchmove wheel", _lockBodyScroll);
                offcanvas = null;
                document  = null;
                root      = null;
                header    = null;
            });
        }

        function authenticate(formType) {
            authenticationModal.process(formType)
                .then(function (isAuth) {
                    if (isAuth) { vm.isAuthenticated = true; }
                });
        }

        function closeMenu(/*sref, e*/) {
            // $timeout(function () {
            // if (e.defaultPrevented) {
            //     console.log(e.defaultPrevented);
            // }
            $rootScope.$emit("offCanvasMenuState", "close");
            // $state.go(sref);
            // });
        }

        function logout() {
            authentication.logout()
                .then(function () {
                    vm.isAuthenticated = false;
                    $rootScope.$emit("offCanvasMenuState", "close");
                });
        }

        function _isAuthenticated() {
            authentication.isAuthenticated()
                .then(function (isAuthenticated) {
                    vm.isAuthenticated = isAuthenticated;
                });
        }

        // Lock body scroll without CSS (see above)
        // Can't lock in a simple way when offcanvas is scrollable
        function _lockBodyScroll(e) {
            var isOffcanvasScrollable = offcanvas.offsetHeight < content.offsetHeight;
            var isOffcanvasTarget     = (e.target.className || "").indexOf("offcanvas-item") > -1
                || (e.target.parentNode.className || "").indexOf("offcanvas-item") > -1;

            if (! isOffcanvasScrollable || ! isOffcanvasTarget) {
                e.preventDefault();
                e.stopPropagation();
            }
        }
    }

})();
