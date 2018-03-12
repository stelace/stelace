/* global moment */

(function () {

    angular
        .module("app.inbox")
        .controller("AssessmentController", AssessmentController);

    function AssessmentController($interval,
                                    $q,
                                    $rootScope,
                                    $scope,
                                    $timeout,
                                    $translate,
                                    AssessmentService,
                                    BookingService,
                                    ContentService,
                                    gamification,
                                    ListingTypeService,
                                    RatingService,
                                    Restangular,
                                    toastr,
                                    tools,
                                    UserService,
                                    usSpinnerService) {
        var listeners = [];
        var debouncedAction = tools.debounceAction(_save);
        var currentUser;
        var showButtonInterval;
        var collapseTimeout;

        var vm = this;
        vm.showAssessmentSaveButton = false;
        vm.showRatingSaveButton = false;
        vm.isOwner        = false;
        vm.scoreMap       = {
            1: $translate.instant("rating.score.very_negative"),
            2: $translate.instant("rating.score.negative"),
            3: $translate.instant("rating.score.average"),
            4: $translate.instant("rating.score.quite_good"),
            5: $translate.instant("rating.score.good")
        };
        vm.scoreMapSelect = _(vm.scoreMap)
            .map(function (value, key) {
                return {
                    score: parseInt(key, 10),
                    label: value
                };
            })
            .sortBy(function (map) {
                return - map.score;
            })
            .value();

        vm.showContract       = false;
        vm.contractUrl        = null;
        vm.contractTarget     = "_blank";
        vm.facebookPagePlugin = $rootScope.facebookUser;

        vm.save       = save;
        vm.sign       = sign;
        vm.saveRating = saveRating;

        activate();



        function activate() {
            if (vm.showRatingsOnly) {
                vm.assessment = {};
            }

            // avoid to show an inactive save button
            showButtonInterval = $interval(_setShowButton, 600000);

            listeners.push(
                $rootScope.$on("facebookUser", function () {
                    vm.facebookPagePlugin = $rootScope.facebookUser;
                })
            );

            $scope.$on("$destroy", function () {
                $interval.cancel(showButtonInterval);
                $timeout.cancel(collapseTimeout);
            });

            // prefill the assessment with the previous one
            if (vm.previousAssessment && (! vm.assessment || ! vm.assessment.id)) {
                vm.assessment = _.defaults(vm.assessment || {}, _preFillAssessment(vm.previousAssessment));
            }

            // set to the good status by default
            vm.assessment.status = vm.assessment.status || 'good';

            if (vm.assessment && vm.assessment.signedDate
             && (! vm.ratings || (vm.ratings.my && vm.ratings.my.comment))
            ) { // if ratings are relevant (output assessment), collapse assessment only if user has rated AND written a comment
                vm.collapse = true;
            } else {
                vm.collapse = false;
            }

            _setSignInfo();
            _setRatings();

            // prefill empty assessment with listing info
            if (! vm.assessment.comment) {
                vm.assessment.comment = vm.listing.stateComment;
            }

            $q.all({
                currentUser: UserService.getCurrentUser()
            }).then(function (results) {
                currentUser = results.currentUser;

                vm.isOwner = (vm.listing.ownerId === currentUser.id);
                vm.isTaker = (vm.booking.takerId === currentUser.id);

                vm.listingTypeProperties = ListingTypeService.getProperties(vm.booking.listingType);

                var config = vm.booking.listingType.config;

                if (config.hasBookingContract) {
                    var booking = Restangular.restangularizeElement(null, vm.booking, "booking");

                    // get contract url
                    booking
                        .getContractToken()
                        .then(function (res) {
                            vm.contractUrl    = BookingService.getContractUrl(booking.id, res.value);
                            vm.contractTarget = "sip-booking-contract_" + booking.id;
                            vm.showContract   = true;
                        });
                }

                var properties = vm.booking.listingType.properties;
                vm.uniqueAssessment = properties.ASSESSMENTS === 'ONE_STEP';
                vm.dynamicPricing = properties.DYNAMIC_PRICING === 'DYNAMIC';
                vm.isConfirmation = vm.uniqueAssessment && !vm.dynamicPricing;

                _setShowButton();
            });
        }

        function save() {
            return debouncedAction.process();
        }

        function _save() {
            if (vm.listingTypeProperties.isAssessmentNone) {
                return saveRating();
            }

            if (! vm.assessment
             || ! vm.assessment.status
            ) {
                ContentService.showNotification({
                    titleKey: 'assessment.notification.missing_fields_title',
                    messageKey: 'assessment.notification.missing_fields_message',
                    type: 'warning'
                });
                return;
            }

            if (_isMissingComment()) {
                ContentService.showNotification({
                    titleKey: 'assessment.notification.missing_comment_title',
                    messageKey: 'assessment.notification.missing_comment_message',
                    type: 'warning'
                });
                return;
            }

            return $q.when(true)
                .then(function () {
                    if (vm.assessment.signedDate) {
                        return;
                    }

                    usSpinnerService.spin('save-assessment-spinner');

                    if (vm.assessment.id) {
                        return vm.assessment.patch();
                    }

                    return vm.assessment.save();
                })
                .then(function () {
                    return sign();
                })
                .then(function () {
                    if (vm.onSave && vm.assessment) {
                        vm.onSave(vm.assessment);
                    }
                })
                .then(function () {
                    _setShowButton();
                })
                .finally(function () {
                    usSpinnerService.stop('save-assessment-spinner');
                });
        }

        function _isMissingComment() {
            if (vm.assessment.status === 'good') {
                return false;
            }

            if (vm.stepType !== 'end' && !vm.assessment.comment) {
                return true;
            } else if (vm.stepType === 'end' && !vm.assessment.commentDiff) {
                return true;
            }

            return false;
        }

        function sign() {
            if (! vm.assessment.id || ! vm.assessment.status) {
                return;
            }
            if (_isMissingComment()) {
                return;
            }
            if (vm.assessment.signedDate) {
                return;
            }

            return vm.assessment.sign()
                .then(function (newAssessment) {
                    gamification.checkStats();
                    vm.assessment.signedDate = newAssessment.signedDate;
                    _setSignInfo();

                    // ugly hack to get signed date display synchronized
                    // because vm.assessment is changed in inbox-conversation controller
                    $scope.$watch("vm.assessment", function () {
                        _setSignInfo();
                    });

                    // refresh the inbox in case there is an output assessment after signing input assessment
                    $rootScope.$emit("refreshInbox");

                    if (vm.listingTypeProperties.isAssessmentOneStep && !vm.ratings) {
                        vm.ratings = {};
                        _setRatings();
                    } else if (vm.listingTypeProperties.isAssessmentTwoSteps && vm.stepType === 'end' && !vm.ratings) {
                        vm.ratings = {};
                        _setRatings();
                    }

                    ContentService.showNotification({
                        messageKey: 'assessment.notification.transaction_validated_message',
                        type: 'success',
                        options: {
                            timeOut: 0,
                            closeButton: true
                        }
                    });
                })
                .catch(function () {
                    ContentService.showNotification({
                        titleKey: 'error.unknown_happened_title',
                        messageKey: 'error.unknown_happened_message',
                        type: 'warning'
                    });
                });
        }

        function saveRating() {
            if (!vm.ratings || vm.ratingsVisible) return;

            return $q.when(true)
                .then(function () {
                    return _saveRating();
                })
                .then(function () {
                    if (!vm.myRating) {
                        return;
                    }

                    if (! vm.myRating.comment) {
                        ContentService.showNotification({
                            titleKey: 'rating.notification.remaining_comment_title',
                            messageKey: 'rating.notification.remaining_comment_message',
                            messageValues: {
                                userName: vm.interlocutor.fullname
                            },
                            type: 'success',
                            options: {
                                timeOut: 10000
                            }
                        });
                    } else {
                        ContentService.showNotification({
                            messageKey: 'rating.notification.rating_saved_message',
                            type: 'success'
                        });
                    }
                });
        }

        function _saveRating() {
            if (! vm.myRating) {
                return;
            }
            if (! vm.myRating.score) {
                ContentService.showNotification({
                    titleKey: 'rating.notification.missing_score_title',
                    messageKey: 'rating.notification.missing_score_message',
                    type: 'warning'
                });
                return;
            }

            if (! vm.myRating.id) {
                vm.myRating.bookingId = vm.booking.id;

                return RatingService
                    .post(vm.myRating)
                    .then(function (newRating) {
                        gamification.checkStats();
                        vm.myRating = newRating;
                        vm.hasRated = true;
                        if (vm.myRating.comment) {
                            collapseTimeout = $timeout(function () {
                                vm.collapse = true;
                            }, 500);
                        }
                        return vm.myRating;
                    });
            } else {
                return vm.myRating.patch();
            }
        }

        function _preFillAssessment(assessment) {
            var preFilledAssessment = {};

            preFilledAssessment.status  = assessment.status;
            preFilledAssessment.comment = assessment.comment;

            return preFilledAssessment;
        }

        function _setSignInfo() {
            if (vm.assessment && vm.assessment.signedDate) {
                $translate('assesment.comment_separator')
                    .then(function (separator) {
                        vm.assessment.globalComment = (vm.assessment.comment || "")
                            + (vm.assessment.commentDiff ? "\n\n" + separator + "\n" + vm.assessment.commentDiff : "");
                    });
            }
        }

        function _setRatings() {
            if (! vm.ratings) {
                return;
            }

            // outputAssessment ratings object is defined in conversation controller
            if (vm.ratings.my) {
                vm.hasRated = true;
                vm.myRating = vm.ratings.my;
                if (vm.myRating.visibleDate) {
                    vm.ratingsVisible = (vm.myRating.visibleDate < moment().toISOString());
                }
            } else {
                vm.myRating = {
                    score: 5 // default score
                };
            }

            // vm.ratings.other can be "null", if we don't rate the other person but it does
            if (vm.ratings.other) {
                if (vm.ratings.other === "complete") {
                    vm.otherRatingComplete = true;
                } else {
                    vm.otherRating = vm.ratings.other;
                    if (vm.otherRating.visibleDate) {
                        vm.ratingsVisible = (vm.otherRating.visibleDate < moment().toISOString());
                    }
                }
            } else if (vm.ratings.other === null) {
                vm.otherRatingCreated = true;
            }
        }

        function _setShowButton() {
            vm.showAssessmentSaveButton = ! vm.assessment || ! vm.assessment.signedDate;
            vm.showRatingSaveButton = vm.ratings && ! vm.ratingsVisible;
        }
    }

})();
