(function () {

    angular
        .module("app.layout")
        .controller("HeaderController", HeaderController);

    function HeaderController($interval,
                                $q,
                                $rootScope,
                                $scope,
                                $state,
                                $timeout,
                                $window,
                                authentication,
                                authenticationModal,
                                cache,
                                FoundationApi,
                                gamification,
                                ItemService,
                                LocationService,
                                loggerToServer,
                                MediaService,
                                MessageService,
                                platform,
                                StelaceConfig,
                                tools,
                                UserService) {

        var listeners              = [];
        var stopFetchingMessages   = false;
        var stopFetchingStats      = false;
        var mqTinyMobile           = $window.matchMedia("(max-width: 319px)");
        var mqMobile               = $window.matchMedia("(max-width: 639px)");
        var mqSMedium              = $window.matchMedia("(min-width: 768px)");
        var mqDesktop              = $window.matchMedia("(min-width: 1024px)");
        var mqXLarge               = $window.matchMedia("(min-width: 768px)");
        var mqSmallDesktopProgress = $window.matchMedia("(min-width: 640px) and (max-width: 859px)");
        var pendingConvsCount      = 0;
        var currentUser;
        var isLoggedAs;
        var updateMsgInterval;
        var updateGamificationInterval;
        var GamificationViewedTimeout;
        var GamificationViewedServerTimeout;
        var changeProgressColorTimeout;
        var emptyProgressBarTimeout;
        var closeProgressPopoverTimeout;
        var throttledActionPopover;
        var oldGamificationStats;
        var newGamificationStats;

        var vm = this;
        vm.showMap              = StelaceConfig.isFeatureActive('MAP');
        vm.isAuthenticated      = false;
        vm.profileImgSrc        = null;
        vm.userFirstname        = null;
        vm.newMessagesCount     = 0;
        vm.isTinyMobile         = mqTinyMobile.matches;
        vm.isMobile             = mqMobile.matches; // show mobile popover
        vm.isSMedium            = mqSMedium.matches; // rootscope
        vm.isDesktop            = mqDesktop.matches; // show logo over search
        vm.isXLarge             = mqXLarge.matches; // rootscope
        vm.smallDesktopProgress = mqSmallDesktopProgress.matches;
        vm.openGamePopover      = false;
        vm.maxLvlPoints         = 100000; // instead of 100 (bootstrap default)
        vm.points               = 0;
        vm.lastActionsIds       = [];
        vm.actionMap            = gamification.getActionMap();
        vm.levelMap             = gamification.getLevelMap();
        vm.showGamification     = StelaceConfig.isFeatureActive('GAMIFICATION');

        vm.search               = search;
        vm.authenticate         = authenticate;
        vm.logout               = logout;
        vm.toggleMenu           = toggleMenu;

        activate();



        function activate() {
            // Avoid spamming popover after accomplished actions
            throttledActionPopover = _.throttle(_openProgressPopoverAfterAction, 90000, { leading: true, trailing: false });

            if (typeof document.hidden !== "undefined") { // Page Visibility API support
                document.addEventListener("visibilitychange", _handleVisibilityChange);
            }

            listeners.push(
                $rootScope.$on("updateProfileImage", function () {
                    MediaService
                    .getMyImage(true)
                    .then(function (media) {
                        vm.profileImgSrc = media.url + '?size=128x128';
                    });
                })
            );
            listeners.push(
                $rootScope.$on("updateWelcomeMessage", function (e, firstname) {
                    vm.userFirstname = firstname;
                })
            );
            listeners.push(
                $rootScope.$on("isAuthenticated", function (event, isAuthenticated) {
                    if (isAuthenticated && ! vm.isAuthenticated) { // avoid duplicate requests
                        vm.isAuthenticated = true;
                        _getUserInfo();
                    } else if (isAuthenticated === false) {
                        vm.isAuthenticated  = false;
                        vm.newMessagesCount = 0;

                        $interval.cancel(updateMsgInterval);
                        $interval.cancel(updateGamificationInterval);

                        currentUser = null;
                    }
                })
            );
            listeners.push(
                $rootScope.$on("refreshMessagesBadge", function () {
                    _updateMessages();
                })
            );

            if (StelaceConfig.isFeatureActive('GAMIFICATION')) {
                listeners.push(
                    $rootScope.$on("gamificationProgressChanged", function (event, stats) {
                        GamificationViewedTimeout = $timeout(function () {
                            _updateGamificationProgress(stats);
                        }, 2000);
                    })
                );
            }

            // MatchMedia Listeners for progress-bar
            // Switch between mobile and desktop progress to avoid bugs with popovers
            var _resizeProgress = _.throttle(function () {
                $timeout(function () {
                    vm.isTinyMobile         = mqTinyMobile.matches;
                    vm.isMobile             = mqMobile.matches;
                    vm.smallDesktopProgress = mqSmallDesktopProgress.matches;
                    vm.isDesktop            = mqDesktop.matches;
                });
            }, 300);
            angular.element($window).on("resize", _resizeProgress);

            $scope.$on("$destroy", function () {
                _.forEach(listeners, function (listener) {
                    listener();
                });

                angular.element($window).off("resize", _resizeProgress);
                document.removeEventListener("visibilitychange", _handleVisibilityChange);

                $interval.cancel(updateMsgInterval);
                $interval.cancel(updateGamificationInterval);
                // update progress bar timeouts
                $timeout.cancel(GamificationViewedTimeout);
                $timeout.cancel(GamificationViewedServerTimeout);
                // change level timeouts
                $timeout.cancel(changeProgressColorTimeout);
                $timeout.cancel(emptyProgressBarTimeout);
                $timeout.cancel(closeProgressPopoverTimeout);
            });

            $rootScope.searchFiltersConfig = $rootScope.searchFiltersConfig || { showAdvancedSearch: false };
            $rootScope.searchParams        = $rootScope.searchParams || {
                queryMode: "default",
                myLocations: []
            };
            $rootScope.showMap = vm.showMap;

            _getUserInfo();
        }

        function search() {
            if ($rootScope.searchParams.listingTypeId) {
                $rootScope.searchParams.t = $rootScope.searchParams.listingTypeId;
            }
            $rootScope.searchParams.qm = $rootScope.searchParams.queryMode;
            platform.debugDev("Search from header", $rootScope.searchParams);

            if ($rootScope.searchParams.query) {
                $rootScope.searchParams.fullQuery = ItemService.encodeUrlFullQuery($rootScope.searchParams.query);
                $rootScope.searchParams.q = $rootScope.searchParams.fullQuery;
            }

            $rootScope.searchFiltersConfig.showAdvancedSearch = false;

            if (ItemService.isSearchState($state)) {
                $rootScope.$emit("triggerSearch", { newQuery: true });
            } else {
                $state.go("searchWithQuery", $rootScope.searchParams);
            }
        }

        function authenticate(formType) {
            authenticationModal.process(formType);
        }

        function logout() {
            authentication.logout()
                .then(function () { vm.isAuthenticated = false; });
        }

        function toggleMenu(e) {
            if (e) {
                e.stopPropagation();
                e.preventDefault(); // prevent mobile browser UI from showing up too early
            }
            $rootScope.$emit("offCanvasMenuState", "toggle");
        }

        function _getUserInfo() {
            return UserService.getCurrentUser()
                .then(function (user) {
                    if (user) {
                        currentUser          = user;
                        vm.isAuthenticated   = true;
                        vm.userFirstname     = user.firstname;

                        _setUpdateIntervals();

                        MediaService.getMyImage()
                            .then(function (myImage) {
                                if (myImage) {
                                    vm.profileImgSrc = myImage.url + '?size=128x128';
                                }
                            });
                        return UserService.isLoggedAs(user);
                    }
                })
                .then(function (loggedAs) {
                    if (typeof loggedAs !== "undefined") {
                        isLoggedAs = loggedAs;

                        _updateMessages();

                        return _updateStats(1000);
                    }
                });
        }

        function _updateMessages() {
            var sortedConversations;

            if (! currentUser || stopFetchingMessages) {
                return;
            }

            return MessageService
                .getConversations({ userId : currentUser.id })
                .then(function (conversations) {
                    sortedConversations = _.groupBy(conversations, function (conv) {
                        return conv.receiverId === currentUser.id;
                    });
                    var oldCount = vm.newMessagesCount;
                    vm.newMessagesCount = _.filter(sortedConversations.true, { receiverRead : false }).length
                    + _.filter(sortedConversations.false, { senderRead : false }).length;
                    $rootScope.headerNewMessagesCount = vm.newMessagesCount;

                    // Refresh inbox if user has just accepted a booking (read statu can be unchanged)
                    var oldPendingConvsCount = pendingConvsCount;
                    pendingConvsCount = _.filter(conversations, function (conv) {
                        return conv.booking
                            && (conv.agreementStatus === "pending" || conv.agreementStatus === "pending-giver");
                    }).length;

                    if (oldCount !== vm.newMessagesCount || oldPendingConvsCount !== pendingConvsCount) {
                        $rootScope.$emit("refreshInbox", { newMessagesCount: vm.newMessagesCount }); // in case conversation view or inbox view are active
                    }
                })
                .catch(function (err) {
                    if (err.data && err.data.message && _.contains(["AuthenticationNeeded", "ForceAuthentication"], err.data.message)) {
                        stopFetchingMessages = true;
                    } else {
                        loggerToServer.error(err);
                    }
                });
        }

        function _updateStats(delay) {
            if (! currentUser || stopFetchingStats || !StelaceConfig.isFeatureActive('GAMIFICATION')) {
                return $q.when(false);
            }

            return gamification.checkStats(delay)
                .then(_setProgressBar)
                .catch(function (err) {
                    if (err.data && err.data.message && _.contains(["AuthenticationNeeded", "ForceAuthentication"], err.data.message)) {
                        stopFetchingStats = true;
                    } else {
                        loggerToServer.error(err);
                    }
                });
        }

        function _setProgressBar(stats) {
            if (! stats) {
                return;
            }
            newGamificationStats = stats;

            var levelPoints      = stats.levelsPoints[stats.lastViewedLevelId || "NONE"];
            vm.points            = stats.lastViewedPoints - levelPoints.required; // current level progression
            vm.userLvl           = stats.lastViewedLevelId && stats.lastViewedLevelId.toLowerCase();
            vm.maxLvlPoints      = levelPoints.next - levelPoints.required;

            return _updateGamificationActions();
        }

        function _updateGamificationProgress(stats) {
            if (!StelaceConfig.isFeatureActive('GAMIFICATION')) {
                return;
            }

            oldGamificationStats = {
                points: vm.points,
                userLvl: vm.userLvl,
                maxLvlPoints: vm.maxLvlPoints,
                lastActions: stats.lastActions
            };

            newGamificationStats = {};

            var nextLevelPoints               = stats.levelsPoints[stats.levelId || "NONE"];
            newGamificationStats.points       = stats.points - nextLevelPoints.required;
            newGamificationStats.userLvl      = stats.levelId && stats.levelId.toLowerCase();
            newGamificationStats.maxLvlPoints = nextLevelPoints.next - nextLevelPoints.required;
            newGamificationStats.actions      = stats.actions;

            _.defaults(newGamificationStats, oldGamificationStats);

            // console.log("levelChanged", stats.levelChanged, "pointsChanged", stats.pointsChanged)
            _updateGamificationActions();

            // updating progress-bar
            if ($rootScope.noGamificationDistraction || isLoggedAs) {
                vm.showActionGreeting  = false;
                return; // Prevent popover or animation in critical views such as booking-payment
            } else if (stats.levelChanged) {
                vm.showLevelGreeting = true;
                vm.points            = newGamificationStats.points;

                changeProgressColorTimeout = $timeout(function () {
                    vm.userLvl = newGamificationStats.userLvl;
                }, 1000);

                emptyProgressBarTimeout = $timeout(function () {
                    vm.maxLvlPoints        = newGamificationStats.maxLvlPoints;
                    vm.points              = newGamificationStats.points;
                    vm.openProgressPopover = true;

                    closeProgressPopoverTimeout = $timeout(function () {
                        vm.openProgressPopover = false;
                        vm.showLevelGreeting   = false;
                    }, 20000);
                }, 2000);

            } else if (stats.pointsChanged) {
                vm.points = newGamificationStats.points;
                throttledActionPopover();
            }

            // Consider that user has seen gamification changes only after 3 seconds (animations ended)
            GamificationViewedServerTimeout = (stats.levelChanged || stats.pointsChanged) && $timeout(function () {
                return gamification.updateProgressView({
                        points: stats.pointsChanged,
                        levelId: stats.levelChanged
                })
                .then(function (viewingUser) {
                    currentUser = viewingUser;
                });
            }, 3000);
        }

        function _updateGamificationActions() {
            vm.lastActionsIds  = newGamificationStats.lastActions || [];

            return gamification.getNextActions(newGamificationStats, 3)
                .then(function (nextActions) {
                    // Highlight only one of these in popover
                    var firstHighlightActionIndex = _.findIndex(nextActions, function (action) {
                        return (action.id === "A_FRIEND_REGISTERED"
                            || action.id === "FIRST_VALID_ITEM_AD"
                        );
                    });
                    if (firstHighlightActionIndex > -1) {
                        nextActions[firstHighlightActionIndex].hId = nextActions[firstHighlightActionIndex].id;
                    }
                    vm.nextActions = nextActions;
                });
        }

        function _setUpdateIntervals() {
            stopFetchingMessages       = false;
            stopFetchingStats          = false;
            updateMsgInterval          = $interval(_updateMessages, 60000);
            updateGamificationInterval = $interval(function () {
                return _updateStats(0);
            }, 60000);
        }

        function _handleVisibilityChange() {
            if (document.hidden) {
                $interval.cancel(updateMsgInterval);
                $interval.cancel(updateGamificationInterval);
                } else {
                gamification.checkStats(); // default delay
                _updateMessages();
                _setUpdateIntervals();
                }
        }

        function _openProgressPopoverAfterAction() {
            if (!StelaceConfig.isFeatureActive('GAMIFICATION')) {
                return;
            }

            if (vm.isMobile && vm.lastActionsIds.length && vm.lastActionsIds[0] === "CONNECTION_OF_THE_DAY") {
                // Silent event on mobile to avoid clutter
                return;
            }
            vm.showActionGreeting  = true;
            vm.openProgressPopover = true;

            closeProgressPopoverTimeout = $timeout(function () {
                vm.openProgressPopover = false;
                vm.showActionGreeting  = false;
            }, 20000);
        }

    }

})();
