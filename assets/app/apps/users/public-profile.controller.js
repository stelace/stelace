/* global moment */

(function () {

    angular
        .module("app.users")
        .controller("PublicProfileController", PublicProfileController);

    function PublicProfileController($location,
                                $q,
                                $rootScope,
                                $scope,
                                $state,
                                $stateParams,
                                $window,
                                gamification,
                                ItemService,
                                // LocationService,
                                loggerToServer,
                                MediaService,
                                platform,
                                RatingService,
                                // Restangular,
                                UserService,
                                StelaceConfig,
                                StelaceEvent,
                                toastr,
                                tools) {
        var userId    = parseInt($stateParams.id, 10);
        var listeners = [];
        // var oldMedia;
        // var currentMedia;
        var user;
        var currentUser;
        var userItems;
        var ratings;
        // var myLocations;

        var vm = this;

        vm.actionMap        = gamification.getActionMap();
        vm.levelMap         = gamification.getLevelMap();
        vm.medalsLabels     = gamification.getMedalsLabels();
        vm.showGamification = StelaceConfig.isFeatureActive('GAMIFICATION');
        vm.hideMissions = true;
        vm.itemsOnly    = !! $stateParams.itemsonly; // special layout for potential screenshots
        // vm.imageToUpload      = true;

        // vm.uploadImage       = uploadImage;
        // vm.cancelUploadImage = cancelUploadImage;
        vm.gameLink     = gameLink;
        vm.displayMonth = displayMonth;

        activate();



        function activate() {
            var dummyCurrentUser = userId && { id: userId };

            listeners.push(
                $rootScope.$on("isAuthenticated", function (event, isAuthenticated) {
                    if (! isAuthenticated || (isAuthenticated && ! currentUser)) { // avoid duplicate requests
                        _fetchCurrentUser().then(function () {
                            return _refreshGamificationInfo();
                        });
                    }
                })
            );

            if (StelaceConfig.isFeatureActive('GAMIFICATION')) {
                listeners.push(
                    $rootScope.$on("gamificationProgressChanged", function (event, stats) {
                        _refreshGamificationInfo(stats);
                    })
                );
            }

            $scope.$on("$destroy", function () {
                _.forEach(listeners, function (listener) {
                    listener();
                });
            });

            // query param userId is optional when authenticated
            return $q.when(dummyCurrentUser || _fetchCurrentUser())
            .then(function (usr) {
                if (! usr || ! usr.id) {
                    var error = new Error();
                    error.status = 404;
                    return _redirectTo404(error);
                } else if (! userId) {
                    userId = usr.id;
                    // No reload
                    $state.go("user", { id: usr.id }, { notify: false, location: "replace" });
                }

                StelaceEvent.sendScrollEvent("Public profile view", {
                        data: { targetUserId: userId }
                    })
                    .then(function (obj) {
                        listeners.push(obj.cancelScroll);
                    });

                return _populateView();
            });
        }

        function _populateView() {
            return $q.all({
                user: UserService.get(userId).catch(_redirectTo404),
                userRatings: RatingService.getTargetUserRatings({ targetId: userId, populateItems: true }),
                userItems: ItemService.cleanGetList({ ownerId: userId }),
                currentUser: _fetchCurrentUser()
                // myImage: MediaService.getMyImage(),
                // myItems: ItemService.getMyItems()
            }).then(function (results) {
                user        = tools.clearRestangular(results.user);
                userItems   = results.userItems;
                ratings     = results.userRatings;
                currentUser = results.currentUser;
                // vm.imageSrc           = results.myImage.url;
                // vm.myItems            = results.myItems;
                // oldMedia              = results.myImage;
                var userAvgRating = user.nbRatings && Math.min(user.ratingScore / user.nbRatings, 5);

                // Populate items
                userItems = _.filter(userItems, "validated");
                ItemService.populate(userItems);
                // Populate locations manually since it is more convenient here with full locations already populated in each item.
                _.forEach(userItems, function (item) {
                    item.vLocations  = item.locations;
                    item.ownerRating = { // expected format for item-card's rating-stars
                        ratingScore: user.ratingScore,
                        nbRatings: user.nbRatings
                    };
                });
                userItems = _.sortByOrder(userItems, ["updatedDate"], ["desc"]);

                // Populate user
                user.fullname    = user.getFullname();
                user.displayName = user.firstname || user.fullname;
                if (user && user.media) {
                    MediaService.setUrl(user.media);
                } else {
                    user.media = { url: platform.getDefaultProfileImageUrl() };
                }

                // Ratings
                _.forEach(ratings, function (rating) {
                    if (rating.userMedia) {
                        MediaService.setUrl(rating.userMedia);
                    } else {
                        rating.userMedia = { url: platform.getDefaultProfileImageUrl() };
                    }
                    rating.isReview = !! (rating.comment || rating.itemComment);
                });
                ratings = _.sortByOrder(ratings, ["isReview", "createdDate"], ["desc", "desc"]);
                ratings = _.pairs(_.groupBy(ratings, function (rating) {
                    return rating.targetType === "owner" ? "owner" : "taker";
                })); // [["owner", ownerRatingsArray], ["taker", takerRatingsArray]]
                ratings = _.sortBy(ratings, function (pair) {
                    return (pair[0] === "owner" ? 0 : 1); // ratings received as owner first
                });

                vm.ratings       = ratings;
                vm.firstRatings  = {
                    "owner": 3,
                    "taker": 3
                };
                vm.ratingTrust   = userAvgRating && userAvgRating >= 4;
                vm.userAvgRating = (Math.round(userAvgRating * 10) / 10).toLocaleString();
                vm.user          = user;
                vm.items         = userItems;

                return _refreshGamificationInfo();
            }).then(function () {
                _setSEOTags();
                platform.setPageStatus("ready");
            }).catch(function (err) {
                if (err !== "stop") {
                    platform.setMetaTags({ "status-code": 500 });
                    platform.setPageStatus("ready");
                }
            });
        }

        function _fetchCurrentUser() {
            return $q.all({
                currentUser: UserService.getCurrentUser()
                // myLocations: LocationService.getMine()
            }).then(function (results) {
                vm.currentUser = tools.clearRestangular(results.currentUser);
                currentUser = results.currentUser;
                // myLocations    = results.myLocations;
                vm.isCurrentUser = !! currentUser && (userId === currentUser.id);

                return currentUser;
            });
        }

        function _refreshGamificationInfo(stats) {
            if (!StelaceConfig.isFeatureActive('GAMIFICATION')) {
                return $q.resolve();
            }

            var refreshPromises = { gamificationParams: gamification.getParams() };

            if (! stats && vm.isCurrentUser) {
                refreshPromises.gamificationStats = gamification.getStats();
            } else if (! stats && ! vm.isCurrentUser) { // public info
                vm.userLvl  = user.levelId && user.levelId.toLowerCase();
                vm.hasMedal = gamification.hasMedal(vm.userLvl);
                return;
            } else {
                refreshPromises.gamificationStats = $q.when(stats);
            }

            return $q.all(refreshPromises)
            .then(function (results) {
                if (! results) {
                    return;
                }
                var gameParams            = results.gamificationParams;
                var gameStats             = results.gamificationStats;
                var gameActions           = _.cloneDeep(gameParams.actions);
                var nextLevelRequirements = _(gameParams)
                    .chain() // neccessary with get
                    .get("levels." + gameStats.nextLevelId + ".requirements.actions")
                    .values()
                    .value();

                // Populate actions with links and names
                _.forEach(gameActions, function (action) {
                    _.defaults(action, vm.actionMap[action.id]);
                    action.hasLink    = _hasLink(action);
                    action.isRequired = _.includes(nextLevelRequirements, action.id);
                });
                // console.log(gameActions)

                vm.gameActions     = _.groupBy(_.sortBy(gameActions, "points"), "actionType");
                vm.lastActionsIds  = _.take(gameStats.lastActions, 2);
                vm.gameStats       = gameStats;
                vm.userLvl         = gameStats.levelId && gameStats.levelId.toLowerCase();
                vm.nextLevelId     = gameStats.nextLevelId.toLowerCase();
                vm.hasMedal        = gamification.hasMedal(vm.userLvl);
                vm.willHaveMedal   = gamification.hasMedal(vm.nextLevelId);
                vm.pointsToNextLvl = gameStats.levelsPoints[user.levelId || "NONE"].next - user.points;
                // console.log(vm.gameStats)
                // console.log(gameParams)
                return gamification.getNextActions(gameStats, 3)
                    .then(function (nextActions) {
                        _.forEach(nextActions, function (action) {
                            _.defaults(action, vm.actionMap[action.id]);
                            action.hasLink    = _hasLink(action);
                            action.isRequired = _.includes(nextLevelRequirements, action.id);
                        });
                        vm.nextActions = nextActions;
                    });
            })
            .catch(function (err) {
                // Not critical
                loggerToServer.error(err);
            });
        }

        function _redirectTo404(err) {
            if (err.status === 404) {
                $state.go("404", null, { location: false });
            }

            return $q.reject("stop");
        }

        function _setSEOTags() {
            var title        = vm.user.displayName ? ("Profil de " + vm.user.displayName + " - Sharinplace") : "Profil d'un membre Sharinplace";
            var description  = (vm.user.description && tools.shrinkString(vm.user.description, 150))
                || ((vm.user.displayName ? vm.user.displayName + " - " : "") + "Membre inscrit sur Sharinplace depuis " + vm.displayMonth(vm.user.createdDate));
            var imgUrl       = platform.getBaseUrl() + vm.user.media.url + "?size=300x300";

            var urlCanonical = $location.protocol() + "://" + $location.host() + "/" + $state.current.name + "/" + userId;
            // $location protocol and host methods do not return separators and port.
            // See https://docs.angularjs.org/guide/$location#browser-in-html5-mode

            var metaTags     = {
                description: description
            };

            if (! vm.ratings.length && ! vm.items.length) {
                metaTags.robots = "noindex";
            }

            platform.setMetaTags(metaTags);
            platform.setOpenGraph({
                "og:title": "Découvrez le profil de " + (vm.user.displayName || "ce membre") + " sur Sharinplace",
                "og:type": "profile",
                "og:url": urlCanonical,
                "og:image": imgUrl,
                "og:image:secure_url": imgUrl,
                "og:image:width": 300,
                "og:image:height": 300,
                "og:description": description
            });
            platform.setTitle(title);
            platform.setCanonicalLink(urlCanonical);
        }

        function gameLink(action) {
            if (! action) {
                return;
            }

            if (action.sref) {
                $state.go(action.sref, action.srefParams || null);
            } else if (action.href) {
                $window.open(action.href);
            } else if (action.egg) {
                toastr.info(action.egg);
            } else if (action.do) {
                gamification[action.do]();
            }
        }

        function _hasLink(action) {
            if (! action) {
                return;
            }
            return (action.sref || action.href || action.egg || action.do);
        }

        function displayMonth(date) {
            return moment(date).format("MMMM YYYY");
        }

        // For future use
        // function uploadImage(file) {
        //     $q
        //         .when(true)
        //         .then(function () {
        //             return MediaService.uploadFile({
        //                 targetId: vm.currentUser.id,
        //                 field: "user",
        //                 media: file
        //             }, function (progress) {
        //                 vm.profileMediaProgress = progress;
        //                 if (progress === 100) {
        //                     delete vm.profileMediaProgress;
        //                 }
        //                 $scope.$digest();
        //             });
        //         })
        //         .then(function (media) {
        //             currentMedia = Restangular.restangularizeElement(null, media, "media");

        //             return vm.currentUser.updateMedia(media.id);
        //         })
        //         .then(function () {
        //             MediaService.setUrl(currentMedia);
        //             vm.imageSrc = currentMedia.url;
        //             vm.imageToUpload = false;

        //             $rootScope.$emit("updateProfileImage");
        //         })
        //         .catch(function () {
        //             toastr.warning("Une erreur est survenue. Veuillez réessayer plus tard.");
        //         });
        // }

        // function cancelUploadImage() {
        //     if (! currentMedia) {
        //         return;
        //     }

        //     // if there is no picture first, oldMedia id is not defined (only url is for default image)
        //     vm.currentUser
        //         .updateMedia(oldMedia.id)
        //         .then(function () {
        //             currentMedia = null;
        //             vm.imageSrc = oldMedia.url;
        //             vm.imageToUpload = true;

        //             $rootScope.$emit("updateProfileImage");
        //         })
        //         .catch(function () {
        //             toastr.warning("Une erreur est survenue. Veuillez réessayer plus tard.");
        //         });
        // }
    }

})();
