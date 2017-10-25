/* global moment */

(function () {

    angular
        .module("app.backoffice")
        .controller("BackofficeController", BackofficeController);

    function BackofficeController(
        $http,
        $q,
        $scope,
        $state,
        apiBaseUrl,
        authentication,
        BackofficeService,
        BookingService,
        gamification,
        ItemService,
        platform,
        pricing,
        StelaceConfig,
        TagService,
        toastr,
        tools,
        User,
        UserService
    ) {
        var listeners = [];

        var vm = this;

        var selectGamificationActionsIds = [
            "FEEDBACK",
            "EXTERNAL_REVIEW"
        ];
        var realUserId        = null;
        var formatDate        = "YYYY-MM-DD";
        var formatDateDisplay = "DD-MM-YYYY";

        vm.selectedGamificationActionId = null;
        vm.incompleteBookings           = [];
        vm.selectGamificationActions    = [];
        vm.selectedGamificationUsers    = [];

        vm.selectedLoginUsers           = [];
        vm.loginUsers                   = [];
        vm.queryLoginUsers              = [];

        vm.selectedEditItems            = [];
        vm.editItems                    = [];
        vm.queryEditItems               = [];
        vm.editItemLink                 = null;

        vm.queryGamificationUsers       = [];
        vm.selectedGamificationUsers    = [];
        vm.showGamification             = StelaceConfig.isFeatureActive('GAMIFICATION');

        vm.bookingIdToCancel            = null;
        vm.bookingToCancel              = null;
        vm.cannotCancelBooking          = false;
        vm.cannotCancelBookingReason    = null;
        vm.defaultCancelBookingActionId = "reimbursePaymentAndFees";
        vm.selectedCancelBookingAction  = null;
        vm.selectedReasonType           = null;
        vm.reasonTypes                  = [];
        vm.allReasonTypes               = [
            { id: "no-action", "label": "Ni paiement ni validation" },
            { id: "no-validation", label: "Pas de validation" },
            { id: "no-payment", label: "Pas de paiement" },
            { id: "rejected", label: "Annulation due au propriétaire / donneur" },
            { id: "taker-cancellation", label: "Annulation due à l'emprunteur" },
            { id: "assessment-missed", label: "Rendez-vous manqué (force majeure)" },
            { id: "assessment-refused", label: "Refus de l'objet lors de l'état des lieux" },
            { id: "other", label: "Autre" }
        ];
        vm.showTrigger     = false;
        vm.selectedTrigger = null;
        vm.triggers        = [];
        vm.allTriggers     = [
            { id: "owner", label: "Propriétaire" },
            { id: "taker", label: "Emprunteur" }
        ];
        vm.reason            = null;
        vm.cancellingBooking = false;

        // vm.createListingCategory = createListingCategory;
        // vm.removeListingCategory = removeListingCategory;
        // vm.createBrand        = createBrand;
        // vm.listBrand          = listBrand;
        vm.loginAs              = loginAs;
        vm.setAction            = setAction;
        vm.selectLoginUser      = selectLoginUser;
        vm.getLoginUsers        = getLoginUsers;
        vm.selectEditItem       = selectEditItem;
        vm.getEditItems         = getEditItems;
        vm.getGamificationUsers = getGamificationUsers;
        vm.destroyTag           = destroyTag;

        vm.fetchBookingData     = fetchBookingData;
        vm.getShowTrigger       = getShowTrigger;
        vm.cancelBooking        = cancelBooking;

        activate();



        function activate() {
            resetCancelBookingForm();

            vm.selectGamificationActions = _(gamification.getActionMap())
                .pick(selectGamificationActionsIds)
                .map(function (value, key) {
                    return {
                        id: key,
                        label: value.name
                    };
                })
                .value();

            $scope.$on('$destroy', function () {
                _.forEach(listeners, function (listener) {
                    listener();
                });
            });

            return $q
                .all({
                    currentUser: UserService.getCurrentUser(),
                    incompleteBookings: BackofficeService.getImcompleteBookings(),
                    tagsList: TagService.getList()
                })
                .then(function (res) {
                    realUserId = res.currentUser.id;

                    var incompleteBookings = res.incompleteBookings;

                    vm.incompleteBookings = _populateIncompleteBookings(incompleteBookings);

                    vm.tagsList = _.sortBy(res.tagsList, function (tag) {
                        return tag.timesSearched;
                    });
                });

            // $q.all({
            //     listingCategories: _renderListingCategoriesList(),
            //     brands: BrandService.getList()
            // })
            // .then(function (results) {
            //     vm.brands = results.brands;
            // });
        }

        function _populateIncompleteBookings(incompleteBookings) {
            var info          = "status-info";
            var warningLight  = "status-warning-light";
            var warning       = "status-warning";
            var warningStrong = "status-warning-strong";

            var now = moment().toISOString();

            var bookings        = incompleteBookings.bookings;
            var assessmentsHash = incompleteBookings.assessmentsHash || {};
            var indexedUsers    = _.indexBy(incompleteBookings.users || [], "id");
            var indexedItems    = _.indexBy(incompleteBookings.items || [], "id");

            return _.map(bookings, function (booking) {
                var owner  = indexedUsers[booking.ownerId] || {};
                var taker  = indexedUsers[booking.takerId] || {};
                var item   = indexedItems[booking.itemId] || {};

                var hash             = assessmentsHash[booking.id];
                var inputAssessment  = hash.inputAssessment;
                var outputAssessment = hash.outputAssessment;

                var paidDate = booking.paidDate
                    ? moment(booking.paidDate).format(formatDateDisplay)
                    : null;

                var acceptedDate = booking.acceptedDate
                    ? moment(booking.acceptedDate).format(formatDateDisplay)
                    : null;

                var inputAssessmentDate  = inputAssessment && inputAssessment.signedDate;
                var outputAssessmentDate = outputAssessment && outputAssessment.signedDate;

                var inputAssessmentDateDisplay  = inputAssessmentDate
                    ? moment(inputAssessmentDate).format(formatDateDisplay)
                    : null;
                var outputAssessmentDateDisplay = outputAssessmentDate
                    ? moment(outputAssessmentDate).format(formatDateDisplay)
                    : null;

                var nbExtraDays = inputAssessmentDate
                    ? moment(moment(now).format(formatDate)).diff(booking.startDate, "d")
                    : 0;

                var isNoTime = BookingService.isNoTime(booking);

                var obj = {
                    id: booking.id,
                    itemId: item.id,
                    itemName: { value: tools.shrinkString(item.name, 40), title: item.name },
                    ownerId: owner.id,
                    ownerName: User.getFullname.call(owner, true),
                    takerId: taker.id,
                    takerName: User.getFullname.call(taker, true),
                    isNoTime: isNoTime,
                    startDate: ! isNoTime ? moment(booking.startDate).format(formatDateDisplay) : null,
                    endDate: ! isNoTime ? moment(booking.endDate).format(formatDateDisplay) : null,
                    nbTimeUnits: booking.nbTimeUnits,
                    nbExtraDays: { value: nbExtraDays },
                    paidDate: { value: paidDate },
                    acceptedDate: { value: acceptedDate },
                    takerPrice: booking.takerPrice,
                    inputAssessmentDate: { value: inputAssessmentDateDisplay },
                    outputAssessmentDate: { value: outputAssessmentDateDisplay }
                };

                var duration;

                if (isWithinRange(nbExtraDays, "[1,3[")) {
                    obj.nbExtraDays.status = info;
                } else if (isWithinRange(nbExtraDays, "[3,7[")) {
                    obj.nbExtraDays.status = warningLight;
                } else if (isWithinRange(nbExtraDays, "[7,14[")) {
                    obj.nbExtraDays.status = warning;
                } else if (isWithinRange(nbExtraDays, "[14,Inf[")) {
                    obj.nbExtraDays.status = warningStrong;
                }


                // booking not accepted by owner
                if (! booking.acceptedDate) {
                    duration = moment(now).diff(booking.paidDate, "h");

                    if (duration >= 0) {
                        obj.acceptedDate.clock = true;

                        obj.acceptedDate.title = "En attente de validation depuis "
                            + (duration > 48
                                ? moment(now).diff(booking.paidDate, "d") + "j"
                                : duration + "h");
                    }

                    if (isWithinRange(duration, "[36,96[")) {
                        obj.acceptedDate.status = warningLight;
                    } else if (isWithinRange(duration, "[96,120[")) {
                        obj.acceptedDate.status = warning;
                    } else if (isWithinRange(duration, "[120,168[")) {
                        obj.acceptedDate.status = warningStrong;
                    } else if (isWithinRange(duration, "[168,Inf[")) { // one week
                        obj.acceptedDate.clock = false;
                        obj.acceptedDate.status = warningStrong;
                        obj.acceptedDate.remove = true;

                        obj.acceptedDate.title = "Paiement expiré, réservation à annuler";
                    }
                }

                // booking not paid
                if (! booking.paidDate) {
                    duration = moment(now).diff(booking.acceptedDate, "h");

                    if (duration >= 0) {
                        obj.paidDate.clock = true;

                        obj.paidDate.title = "Validation de la réservation il y a "
                            + (duration > 48
                                ? moment(now).diff(booking.acceptedDate, "d") + "j"
                                : duration + "h");
                    }

                    if (! isNoTime) {
                        duration = moment(now).diff(booking.endDate, "d");

                        if (duration > 0) {
                            obj.paidDate.clock  = false;
                            obj.paidDate.remove = true;

                            if (duration > 7) {
                                obj.paidDate.status = warningLight;
                            }

                            obj.paidDate.title = "Date de fin dépassée depuis "
                                + duration
                                + " j, réservation à annuler";
                        }
                    }
                }

                if (booking.acceptedDate && booking.paidDate) {
                    if (! inputAssessmentDate) {
                        var dueDate = BookingService.getDueDate(booking, "start");

                        duration = moment(now).diff(dueDate, "h");

                        if (duration >= 24) {
                            obj.inputAssessmentDate.clock = true;

                            obj.inputAssessmentDate.title = "État des lieux initial prévu il y a "
                                + moment(now).diff(dueDate, "d") + "j";
                        }

                        if (isWithinRange(duration, "[72,96[")) {
                            obj.inputAssessmentDate.status = warningLight;
                        } else if (isWithinRange(duration, "[96,120[")) {
                            obj.inputAssessmentDate.status = warning;
                        } else if (isWithinRange(duration, "[120,Inf[")) {
                            obj.inputAssessmentDate.status = warningStrong;
                        }
                    } else if (! outputAssessmentDate) {
                        if (! isNoTime) {
                            duration = moment(now).diff(booking.endDate, "h");

                            if (duration >= 24) {
                                obj.outputAssessmentDate.clock = true;

                                obj.outputAssessmentDate.title = "État des lieux final prévu il y a "
                                    + moment(now).diff(booking.endDate, "d") + "j";
                            }

                            if (isWithinRange(duration, "[72,96[")) {
                                obj.outputAssessmentDate.status = warningLight;
                            } else if (isWithinRange(duration, "[96,120[")) {
                                obj.outputAssessmentDate.status = warning;
                            } else if (isWithinRange(duration, "[120,Inf[")) {
                                obj.outputAssessmentDate.status = warningStrong;
                            }
                        }
                    }
                }

                return obj;
            });
        }

        // function createListingCategory(newListingCategory) {
        //     var createAttrs = {
        //         name: newListingCategory.name
        //     };

        //     if (newListingCategory.parentName) {
        //         var parentCategory = _.find(vm.listingCategories, function (listingCategory) {
        //             return listingCategory.name === newListingCategory.parentName;
        //         });

        //         if (! parentCategory) {
        //             toastr.warning("parent name error");
        //             return;
        //         }

        //         createAttrs.parentId = parentCategory.id;
        //     }

        //     ListingCategoryService.post(createAttrs)
        //         .then(function () {
        //             newListingCategory.name = null;
        //             newListingCategory.parentName = null;

        //             return _renderListingCategoriesList();
        //         });
        // }

        // function removeListingCategory(listingCategory) {
        //     listingCategory
        //         .remove()
        //         .then(function () {
        //             return _renderListingCategoriesList();
        //         });
        // }

        // function _renderListingCategoriesList() {
        //     return ListingCategoryService
        //         .getList()
        //         .then(function (listingCategories) {
        //             vm.listingCategories = _getFormattedListingCategories(listingCategories);
        //         });
        // }

        // function _getFormattedListingCategories(listingCategories) {
        //     listingCategories = _.sortBy(listingCategories, function (listingCategory) {
        //         return listingCategory.lft;
        //     });

        //     _.each(listingCategories, function (listingCategory) {
        //         if (! listingCategory.parentId) {
        //             listingCategory.level = 0;
        //         } else {
        //             var parentCategory = _.find(listingCategories, function (i) {
        //                 return i.id === listingCategory.parentId;
        //             });
        //             listingCategory.level = parentCategory.level + 1;
        //         }
        //     });

        //     listingCategories = _.map(listingCategories, function (listingCategory) {
        //         var levelName = "";
        //         for (var i = 0; i < listingCategory.level; ++i) {
        //             levelName += "....";
        //         }

        //         listingCategory.levelName = (levelName + listingCategory.name);
        //         return listingCategory;
        //     });

        //     return listingCategories;
        // }

        // function listBrand() {
        //     var listingCategory = _.find(vm.listingCategories, function (listingCategory) {
        //         return listingCategory.name === vm.brandSearch;
        //     });

        //     var params = {};
        //     if (listingCategory) {
        //         params.listingCategoryId = listingCategory.id;
        //     }

        //     BrandService
        //         .getList(params)
        //         .then(function (brands) {
        //             vm.brands = brands;
        //         });
        // }

        // function createBrand(newBrand) {
        //     var createAttrs = {
        //         name: newBrand.name
        //     };

        //     if (newBrand.listingCategoryName) {
        //         var listingCategory = _.find(vm.listingCategories, function (listingCategory) {
        //             return listingCategory.name === newBrand.listingCategoryName;
        //         });

        //         if (! listingCategory) {
        //             toastr.warning("listing category name error");
        //             return;
        //         }

        //         createAttrs.listingCategoryId = listingCategory.id;
        //     }

        //     BrandService.post(createAttrs)
        //         .then(function () {
        //             newBrand.name = null;
        //             newBrand.listingCategoryName = null;

        //             listBrand();
        //         });
        // }

        function selectLoginUser(user) {
            vm.selectedLoginUsers = [user];
        }

        function getLoginUsers(query) {
            return UserService
                .queryUsers(query)
                .then(function (users) {
                    var selectedUsersIds = _.pluck(vm.selectedLoginUsers, "id");

                    users = _.filter(users, function (user) {
                        return ! _.contains(selectedUsersIds, user.id);
                    });

                    vm.queryLoginUsers = users;
                })
                .catch(function () {
                    toastr.warning("Une erreur est survenue. Veuillez réessayer plus tard.");
                });
        }

        function selectEditItem(item) {
            vm.selectedEditItems = [item];

            return $q.resolve()
                .then(function () {
                    if (realUserId === item.ownerId) {
                        return;
                    }

                    return _loginAs(item.ownerId)
                        .then(function () {
                            realUserId = item.ownerId;
                        });
                })
                .then(function () {
                    vm.editItemLink = "/my-items/" + item.id;
                })
                .catch(function () {
                    vm.editItemLink = null;
                });
        }

        function getEditItems(query) {
            return ItemService
                .queryItems(query)
                .then(function (items) {
                    var selectedItemsIds = _.pluck(vm.selectedEditItems, "id");

                    items = _.filter(items, function (item) {
                        return ! _.contains(selectedItemsIds, item.id);
                    });

                    vm.queryEditItems = items;
                });
        }

        function loginAs() {
            var user = vm.selectedLoginUsers.length ? vm.selectedLoginUsers[0] : null;

            if (! user) {
                return toastr.warning("Aucun utilisateur sélectionné");
            }

            return _loginAs(user.id)
                .then(function () {
                    $state.go("home");
                    window.location.reload(); // reload the page
                });
        }

        function _loginAs(userId) {
            return authentication.loginAs(userId)
                .catch(function (err) {
                    if (err.status === 404) {
                        toastr.warning("Utilisateur introuvable");
                    } else {
                        toastr.warning("Une erreur est survenue");
                    }
                    return $q.reject(err);
                });
        }

        function setAction() {
            if (! vm.selectedGamificationActionId
             || ! vm.selectedGamificationUsers.length
            ) {
                return toastr.warning("Il manque l'action ou les utilisateurs à récompenser");
            }

            var usersIds = _.pluck(vm.selectedGamificationUsers, "id");

            return BackofficeService.setAction(vm.selectedGamificationActionId, usersIds)
                .then(function () {
                    vm.selectedGamificationActionId = null;
                    vm.selectedGamificationUsers    = [];

                    toastr.success("Action récompensée");
                })
                .catch(function () {
                    toastr.warning("Une erreur est survenue. Veuillez réessayer plus tard.");
                });
        }

        function getGamificationUsers(query) {
            if (!StelaceConfig.isFeatureActive('GAMIFICATION')) {
                return;
            }

            return UserService
                .queryUsers(query)
                .then(function (users) {
                    var selectedUsersIds = _.pluck(vm.selectedGamificationUsers, "id");

                    users = _.filter(users, function (user) {
                        return ! _.contains(selectedUsersIds, user.id);
                    });

                    vm.queryGamificationUsers = users;
                })
                .catch(function () {
                    toastr.warning("Une erreur est survenue. Veuillez réessayer plus tard.");
                });
        }

        function destroyTag() {
            vm.tagToDestroy.remove()
                .then(function (results) {
                    vm.tagsList = _.reject(vm.tagsList, function (tag) {
                        return tag.id === vm.tagToDestroy.id;
                    });
                    toastr.success("Tag retiré de " + results.nbUsers + " utilisateur(s) et " + results.nbItems + " objet(s)",
                        "Tag supprimé", {
                        timeOut: 10000
                    });
                    vm.tagToDestroy = null;
                });
        }

        function isWithinRange(value, str) {
            var limitMin = str.slice(0, 1);
            var limitMax = str.slice(-1);
            var parts   = str.slice(1, -1).split(",");

            var isValid = isAllowedLimitChar(limitMin)
                && isAllowedLimitChar(limitMax)
                && parts.length === 2;

            if (! isValid) {
                throw new Error("Not valid range");
            }

            var min = parts[0];
            var max = parts[1];

            min = (min === "Inf" ? null : parseInt(min, 10));
            max = (max === "Inf" ? null : parseInt(max, 10));

            if (isNaN(min) || isNaN(max)) {
                throw new Error("Not valid range numbers");
            }

            var result = true;

            if (typeof min === "number") {
                if (limitMin === "[") {
                    result = result && min <= value;
                } else {
                    result = result && min < value;
                }
            }

            if (typeof max === "number") {
                if (limitMax === "[") {
                    result = result && value < max;
                } else {
                    result = result && value <= max;
                }
            }

            return result;
        }

        function isAllowedLimitChar(c) {
            return c === "]" || c === "[";
        }

        function fetchBookingData(bookingId) {
            if (! bookingId || isNaN(bookingId)) {
                resetBookingData();
            }

            return BackofficeService.getBooking(bookingId)
                .then(function (booking) {
                    resetBookingData(booking);

                    var priceResult = pricing.getPriceAfterRebateAndFees({ booking: booking });

                    var isNoTime = BookingService.isNoTime(booking);

                    vm.bookingToCancel.isNoTime = isNoTime;
                    vm.bookingToCancel.ownerName  = User.getFullname.call(booking.owner, true);
                    vm.bookingToCancel.talerName  = User.getFullname.call(booking.taler, true);

                    if (! isNoTime) {
                        vm.bookingToCancel.startDateDisplay = moment(booking.startDate).format(formatDateDisplay);
                        vm.bookingToCancel.endDateDisplay   = moment(booking.endDate).format(formatDateDisplay);
                        vm.bookingToCancel.durationDays     = moment(booking.endDate).diff(booking.startDate, "d") + 1;
                    }

                    vm.bookingToCancel.paidDateDisplay = moment(booking.paidDate).format(formatDateDisplay);
                    vm.bookingToCancel.acceptedDateDisplay = moment(booking.acceptedDate).format(formatDateDisplay);
                    vm.bookingToCancel.ownerNetIncome       = priceResult.ownerNetIncome;

                    if (booking.cancellationId) {
                        vm.cannotCancelBooking = true;
                        vm.cannotCancelBookingReason = "Réservation déjà annulée";
                    } else if (booking.inputAssessment && booking.inputAssessment.signedDate) {
                        vm.cannotCancelBooking = true;
                        vm.cannotCancelBookingReason = "L'état des lieux initial a déjà été signé";
                    }
                })
                .catch(function (err) {
                    if (err.status === 404) {
                        toastr.warning("Ce numéro ne correspond à aucune réservation :(");
                    } else {
                        toastr.warning("Une erreur est survenue. Veuillez réessayer plus tard.", "Oups");
                    }
                });
        }

        function cancelBooking() {
            if (vm.cancellingBooking) {
                return;
            }

            vm.cancellingBooking = true;

            if (! vm.selectedReasonType) {
                return toastr.warning("Il manque le motif de l'annulation");
            }

            var cancelConfig = {};
            var str = "Confirmation de l'annulation de la réservation n°" + vm.bookingIdToCancel + " :\n";

            switch (vm.selectedCancelBookingAction) {
                case "reimbursePaymentAndFees":
                    str += "- Rembourser paiement et commission";
                    cancelConfig.payment   = true;
                    cancelConfig.takerFees = true;
                    break;

                case "reimbursePayment":
                    str += "- Rembourser paiement uniquement";
                    cancelConfig.payment   = true;
                    cancelConfig.takerFees = false;
                    break;

                case "noReimburse":
                    str += "- Rembourser ni paiement ni commission";
                    cancelConfig.payment   = false;
                    cancelConfig.takerFees = false;
                    break;
            }
            str += "\n";

            var reasonType = _.find(vm.reasonTypes, function (r) {
                return r.id === vm.selectedReasonType;
            });
            str += "- Motif : " + reasonType.label;

            var confirmation = window.confirm(str); // eslint-disable-line
            if (! confirmation) {
                return;
            }

            var params = {
                reasonType: vm.selectedReasonType,
                reason: vm.reason,
                trigger: vm.selectedTrigger,
                cancel: cancelConfig
            };

            // display a waiting message if the cancelling lasts for more than 1 second
            setTimeout(function () {
                if (vm.cancellingBooking) {
                    toastr.info("L'opération peut prendre quelques instants...", "Réservation en cours d'annulation");
                }
            }, 1000);

            return BackofficeService.cancelBooking(vm.bookingIdToCancel, params)
                .then(function () {
                    toastr.success("Réservation annulée ;)");
                    resetBookingData();
                    resetCancelBookingForm();
                })
                .catch(function () {
                    toastr.warning("Une erreur est survenue. Veuillez réessayer plus tard.", "Oups");
                })
                .finally(function () {
                    vm.cancellingBooking = false;
                });
        }

        function resetBookingData(booking) {
            vm.bookingIdToCancel         = booking ? booking.id : null;
            vm.bookingToCancel           = booking;
            vm.cannotCancelBooking       = false;
            vm.cannotCancelBookingReason = null;

            if (booking) {
                var triggerFields = ["taker", "owner"];

                vm.triggers = _.filter(vm.allTriggers, function (trigger) {
                    return _.includes(triggerFields, trigger.id);
                });

                var reasonTypeFields     = [];
                var omitReasonTypeFields = [];
                if (! booking.paidDate && ! booking.acceptedDate) {
                    reasonTypeFields = ["no-action"];
                } else if (! booking.paidDate) {
                    reasonTypeFields = ["no-payment"];
                } else if (! booking.acceptedDate) {
                    reasonTypeFields = ["no-validation"];
                } else {
                    omitReasonTypeFields = [
                        "no-action",
                        "no-payment",
                        "no-validation"
                    ];
                }

                if (! reasonTypeFields.length && ! omitReasonTypeFields.length) {
                    vm.reasonTypes = vm.allReasonTypes;
                }

                if (reasonTypeFields.length) {
                    vm.reasonTypes = _.filter(vm.allReasonTypes, function (reason) {
                        return _.includes(reasonTypeFields, reason.id);
                    });
                } else if (omitReasonTypeFields.length) {
                    vm.reasonTypes = _.reject(vm.allReasonTypes, function (reason) {
                        return _.includes(omitReasonTypeFields, reason.id);
                    });
                }
            }
        }

        function resetCancelBookingForm() {
            vm.selectedCancelBookingAction = vm.defaultCancelBookingActionId;
            vm.selectedReasonType          = null;
            vm.reason                      = null;
            vm.selectedTrigger             = null;
            vm.showTrigger                 = getShowTrigger();
        }

        function getShowTrigger() {
            if (! vm.selectedReasonType) {
                return false;
            }

            var reasonTypes = [
                "assessment-refused",
                "other"
            ];

            return _.includes(reasonTypes, vm.selectedReasonType);
        }

    }

})();
