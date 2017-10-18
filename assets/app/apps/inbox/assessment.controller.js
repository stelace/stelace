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
                                    AssessmentService,
                                    BookingService,
                                    gamification,
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
        vm.showSaveButton = false;
        vm.isOwner        = false;
        vm.scoreMap       = {
            1: "Très négatif",
            2: "Négatif",
            3: "Moyen",
            4: "Assez positif",
            5: "Positif"
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
        vm.ratingSave = ratingSave;

        activate();



        function activate() {
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

            if (vm.assessment && vm.assessment.signedDate
             && (! vm.ratings || (vm.ratings.my && vm.ratings.my.comment))
            ) { // if ratings are relevant (output assessment), collapse assessment only if user has rated AND written a comment
                vm.collapse = true;
            } else {
                vm.collapse = false;
            }

            _setSignInfo();
            _setRatings();

            // prefill empty assessment with item info
            if (! vm.assessment.comment) {
                vm.assessment.comment = vm.item.stateComment;
            }

            $q.all({
                currentUser: UserService.getCurrentUser()
            }).then(function (results) {
                currentUser = results.currentUser;

                vm.isOwner = (vm.item.ownerId === currentUser.id);

                _getBooking()
                    .then(function (booking) {
                        if (! booking
                         || BookingService.isNoTime(booking)
                        ) {
                            return;
                        }

                        booking = Restangular.restangularizeElement(null, booking, "booking");

                        // get contract url
                        booking
                            .getContractToken()
                            .then(function (res) {
                                vm.contractUrl    = BookingService.getContractUrl(booking.id, res.value);
                                vm.contractTarget = "sip-booking-contract_" + booking.id;
                                vm.showContract   = true;
                            });
                    });

                _setShowButton();
            });
        }

        function save() {
            return debouncedAction.process();
        }

        function _save() {
            if (! vm.assessment
             || ! vm.assessment.workingLevel
             || ! vm.assessment.cleanlinessLevel
            ) {
                toastr.warning("Merci de renseigner l'état de fonctionnement et la propreté de l'objet.", "État de fonctionnement / Propreté");
                return;
            }

            return $q.when(true)
                .then(function () {
                    if (vm.assessment.signedDate) {
                        return;
                    }

                    usSpinnerService.spin('save-assessment-spinner');

                    if (! vm.assessment.id) {
                        var createAttrs = _.clone(vm.assessment);
                        createAttrs.itemId = vm.item.id;
                        createAttrs.toUserId = vm.toUser.id;

                        if (vm.booking) {
                            createAttrs.bookingId = vm.booking.id;
                        }

                        return AssessmentService.post(createAttrs);
                    } else {
                        return vm.assessment.save();
                    }
                })
                .then(function (newAssessment) {
                    // assessment creation
                    if (! vm.assessment.id) {
                        vm.assessment = newAssessment;
                    }

                    if (! vm.assessment.signedDate && ! vm.signToken) {
                        toastr.info("Pour valider définitivement l'état des lieux, vous devez "
                            + (vm.bankAccountMissing ? "renseigner vos coordonnées bancaires pour recevoir le virement et " : "")
                            + "saisir le code remis par " + vm.interlocutor.fullname,
                            "Brouillon enregistré", {
                                timeOut: 0,
                                closeButton: true
                        });
                    }

                    if (! vm.assessment.signedDate && vm.signToken && vm.bankAccountMissing) {
                        toastr.info("Avant de pouvoir signer cet état des lieux, vous devez "
                            + "renseigner vos coordonnées bancaires pour recevoir votre virement.",
                            "Informations bancaires requises", {
                                timeOut: 0,
                                closeButton: true
                        });
                        vm.signToken = null;
                    } else if (vm.signToken && ! vm.assessment.signedDate) {
                        return sign();
                    }

                    return;
                })
                .then(function () {
                    if (vm.myRating && ! vm.ratingsVisible) {
                        return ratingSave();
                    }

                    return;
                })
                .then(function (newRating) {
                    if (newRating && vm.assessment.signedDate) {
                        if (vm.myRating && ! vm.myRating.comment) {
                            toastr.success("N'oubliez pas d'écrire dès que possible un petit commentaire à " + vm.interlocutor.fullname + " pour le remercier.", "Avis enregistré", {
                                timeOut: 10000
                            });
                        } else {
                            toastr.success("Merci !", "Évaluation enregistrée");
                        }
                    }

                    _setShowButton();

                    if (vm.onSave) {
                        vm.onSave(vm.assessment);
                    }
                })
                .finally(function () {
                    usSpinnerService.stop('save-assessment-spinner');
                });
        }

        function sign() {
            if (! vm.assessment.id
             || ! vm.assessment.workingLevel
             || ! vm.assessment.cleanlinessLevel
            ) {
                return;
            }

            return vm.assessment.sign({ signToken: vm.signToken })
                .then(function (newAssessment) {
                    gamification.checkStats();
                    vm.assessment.signedDate = newAssessment.signedDate;
                    _setSignInfo();

                    // ugly hack to get signed date display synchronized
                    // because vm.assessment is changed in inbox-conversation controller
                    $scope.$watch("vm.assessment", function () {
                        _setSignInfo();
                    });

                    // display output assessment after signing input assessment in classic
                    if (vm.assessment.itemMode === "classic") {
                        $rootScope.$emit("refreshInbox");
                    }

                    // when ratings are relevant, only collapse assessment if user has written a comment
                    if (! vm.ratings || (vm.ratings && vm.myRating.comment)) {
                    // Second vm.ratings expression is just there for clarity's sake. vm.myRating is then always defined in _setRatings
                        collapseTimeout = $timeout(function () {
                            vm.collapse = true;
                        }, 500);
                    }

                    toastr.success("État des lieux signé et enregistré.", "Parfait !", {
                        timeOut: 0,
                        closeButton: true
                    });
                })
                .catch(function (err) {
                    if (err.status === 400 && err.data && err.data.message === "wrong token") {
                        toastr.warning("Veuillez vérifier le code transmis par " + vm.interlocutor.fullname
                            + " en échange de l'objet. Les autres champs ont été sauvegardés.", "Code erroné");
                    }
                });
        }

        function ratingSave() {
            if (! vm.myRating) {
                return;
            }
            if (! vm.myRating.score) {
                toastr.warning("Il manque votre note pour enregistrer votre évaluation.", "Note manquante");
                return;
            }

            if (! vm.myRating.id) {
                vm.myRating.assessmentId = vm.ratingAssessmentId || vm.assessment.id;

                return RatingService
                    .post(vm.myRating)
                    .then(function (newRating) {
                        gamification.checkStats();
                        vm.myRating = newRating;
                        vm.hasRated = true;
                        if (vm.assessment && vm.assessment.signedDate && vm.myRating.comment) {
                            collapseTimeout = $timeout(function () {
                                vm.collapse = true;
                            }, 500);
                        }
                        return vm.myRating;
                    });
            } else {
                return vm.myRating.save();
            }
        }

        function _preFillAssessment(assessment) {
            var preFilledAssessment = {};
            var comment = null;

            if (assessment.comment) {
                comment = assessment.comment;
            }
            if (assessment.commentDiff) {
                comment += "\n\n" + assessment.commentDiff;
            }

            preFilledAssessment.workingLevel     = assessment.workingLevel;
            preFilledAssessment.cleanlinessLevel = assessment.cleanlinessLevel;
            preFilledAssessment.comment          = comment;

            return preFilledAssessment;
        }

        function _setSignInfo() {
            if (vm.assessment && vm.assessment.signedDate) {
                var signedDate = moment(vm.assessment.signedDate);
                vm.assessment.signedDateDisplay = signedDate.format("DD/MM/YYYY") + " à " + signedDate.format("HH:mm");
                vm.assessment.globalComment = (vm.assessment.comment || "") + (vm.assessment.commentDiff ? "\n\nObservations lors de la restitution:\n" + vm.assessment.commentDiff : "");
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
            vm.showSaveButton = (! vm.assessment || ! vm.assessment.signedDate || (vm.ratings && ! vm.ratingsVisible));
        }

        function _getBooking() {
            return $q
                .when()
                .then(function () {
                    if (vm.booking) {
                        return vm.booking;
                    } else if (vm.assessment.endBookingId) {
                        return BookingService.get(vm.assessment.endBookingId);
                    } else {
                        return;
                    }
                });
        }
    }

})();
