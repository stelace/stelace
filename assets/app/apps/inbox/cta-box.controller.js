/* global moment */

(function () {

    angular
        .module("app.inbox")
        .controller("CtaBoxController", CtaBoxController);

    function CtaBoxController($q,
                                $rootScope,
                                $scope,
                                $timeout,
                                BookingService,
                                cache,
                                finance,
                                LocationService,
                                map,
                                Restangular,
                                pricing,
                                toastr,
                                tools,
                                uiGmapGoogleMapApi,
                                UserService,
                                usSpinnerService) {
        var listeners         = [];
        var displayFormatDate = "DD/MM/YYYY";
        var newAddress;
        var loadIBANForm;

        var vm = this;
        vm.ctaTitle              = "";
        vm.missingAddress        = false;
        vm.badIban               = false;
        vm.isGoogleMapSDKReady   = cache.get("isGoogleMapSDKReady") || false;
        vm.currentUser           = null;
        vm.mainLocation          = null;
        vm.showBankAccountForm   = false;
        vm.bankAccountActive     = false;
        vm.showBankAccountToggle = false;
        vm.thisYear              = moment().year();
        vm.thisMonth             = moment().month() + 1;
        vm.birthDay              = "23";  // http://www.ladepeche.fr/article/2013/09/23/1715135-23-septembre-jour-plus-naissance.html
        vm.birthMonth            = "09";
        vm.birthYear             = 1990; // int required for default to match in ng-options
        vm.birthYears            = _.range((vm.thisYear - 18), 1900, -1);
        vm.showContract          = false;
        vm.contractUrl           = null;
        vm.contractTarget        = "_blank";
        vm.isNoTime              = false;
        vm.bookingStatus         = "";

        // Google Places ngAutocomplete options
        vm.ngAutocompleteOptions = {
            country: 'fr',
            watchEnter: true
        };

        vm.reveal            = reveal;
        vm.accept            = accept;
        vm.afterAccept       = afterAccept;
        vm.afterReject       = afterReject;
        vm.afterMessage      = afterMessage;
        vm.createBankAccount = createBankAccount;



        activate();

        function activate() {
            // conversation bookingStatus is more accurate since updated
            vm.ctaTitle = _getCtaTitle((vm.conversation && vm.conversation.bookingStatus) || vm.message.bookingStatus);

            // no booking if booking status is 'info'
            if (vm.booking) {
                vm.booking = Restangular.restangularizeElement(null, vm.booking, "booking");

                vm.isNoTime = BookingService.isNoTime(vm.booking);

                if (!vm.isNoTime) {
                    // get contract url
                    vm.booking
                        .getContractToken()
                        .then(function (res) {
                            vm.contractUrl = BookingService.getContractUrl(vm.booking.id, res.value);
                            vm.contractTarget = "sip-booking-contract_" + vm.booking.id;
                            vm.showContract = vm.message.isCtaActive;
                        });
                }

                if (! vm.isNoTime) {
                    vm.startDate = moment(vm.booking.startDate).format(displayFormatDate);
                    vm.endDate   = moment(vm.booking.endDate).format(displayFormatDate);
                } else {
                    if (vm.isOwner) {
                        if (vm.booking.takerPrice) {
                            vm.bookingStatus = "Vente";
                        } else {
                            vm.bookingStatus = "Don";
                        }
                    } else {
                        vm.bookingStatus = "Achat";
                    }
                }

                _setBookingState();
                _setFees();
            }

            vm.validateCollapse = true; // deprecated
            vm.rejectCollapse   = true;

            loadIBANForm = vm.isOwner && vm.booking.takerPrice;

            if (loadIBANForm) {
                $q.all({
                    currentUser: UserService.getCurrentUser(),
                    myLocations: LocationService.getMine(true),
                    uiGmapGoogleMapApi: uiGmapGoogleMapApi,
                }).then(function (results) {
                    vm.isGoogleMapSDKReady = true;
                    cache.set("isGoogleMapSDKReady", true);

                    vm.currentUser  = results.currentUser;
                    vm.myLocations = results.myLocations;

                    if (vm.currentUser.address) {
                        vm.addressInput = vm.currentUser.address.name;
                    }

                    vm.identity = {
                        birthday: vm.currentUser.birthday,
                        nationality: vm.currentUser.nationality || "FR",
                        countryOfResidence: vm.currentUser.countryOfResidence || "FR"
                    };

                    // Populate account form
                    vm.firstName          = vm.currentUser.firstname;
                    vm.lastName           = vm.currentUser.lastname;
                    vm.iban               = vm.currentUser.iban;
                    vm.hasBankAccount     = vm.currentUser.bankAccount;
                    vm.bankAccountMissing = loadIBANForm && ! vm.hasBankAccount;

                    if (vm.currentUser.birthday) {
                        var birth = vm.currentUser.birthday.split('-');
                        if (birth.length === 3) {
                            vm.birthYear  = parseInt(birth[0], 10); // required for match in ng-options
                            vm.birthMonth = birth[1];
                            vm.birthDay   = birth[2];
                        }
                    }

                    vm.showBankAccountForm = true;

                    // For now, bank account user editing is not possible
                    // Prompt user to contact our team for bank info editing only after accepting
                    vm.showBankAccountToggle = vm.hasBankAccount && !! vm.booking.acceptedDate;
                    vm.bankAccountActive     = ! vm.hasBankAccount && !! vm.booking.acceptedDate;
                });
            }

            listeners.push(
                $rootScope.$on("refreshInbox", function () {
                    _setBookingState();
                })
            );

            $scope.$on("$destroy", function () {
                _.forEach(listeners, function (listener) {
                    listener();
                });
            });

            $scope.$watch("vm.addressLocation", function (newLocation) {
                if (! newLocation || typeof newLocation !== "object") { // second condition returns false if object or null !
                    return;
                }

                map.getGooglePlaceData(newLocation)
                    .then(function (place) {
                        newAddress = place;
                    });
            });

            $scope.$watch("vm.hasBankAccount", function (newStatus, oldStatus) {
                if (oldStatus === false && newStatus === true) {
                    vm.bankAccountActive  = false;
                    vm.bankAccountMissing = false; // (loadIBANForm && ! vm.hasBankAccount)
                }
            });

        }

        function reveal(type) {
            var timeoutDuration = (vm.validateCollapse && vm.rejectCollapse ? 0 : 300);

            if (type === "validate" && vm.validateCollapse) {
                vm.rejectCollapse = true;
                $timeout(function () {
                    vm.validateCollapse = false;
                }, timeoutDuration);
            } else if (type === "reject" && vm.rejectCollapse) {
                vm.validateCollapse = true;
                $timeout(function () {
                    vm.rejectCollapse = false;
                }, timeoutDuration);
            } else if (type === "none") {
                vm.validateCollapse = true;
                vm.rejectCollapse = true;
            }
        }

        function accept() {
            if (vm.currentRequest) { // debounce
                return;
            }
            vm.currentRequest = true;

            usSpinnerService.spin('booking-validation-spinner');
            // error messages handled in the function
            vm.onAccept(vm.ctaAnswerMessage, vm.booking, vm.afterAccept);
        }

        function afterAccept(param) {
            _setBookingState();
            usSpinnerService.stop('booking-validation-spinner');
            vm.currentRequest = false;
            if (param === "missingMessage") {
                vm.missingCtaAnswerMessage = true;
            } else {
                vm.missingCtaAnswerMessage = false;
                // Allow user to contact our team only after accepting to edit bank account info
                vm.showBankAccountToggle = vm.hasBankAccount;
                vm.bankAccountActive     = ! vm.hasBankAccount;
            }
        }

        function afterReject(param) {
            _setBookingState();
            usSpinnerService.stop('booking-validation-spinner');
            vm.currentRequest = false;
            if (param === "missingMessage") {
                vm.missingCtaAnswerMessage = true;
            } else {
                vm.missingCtaAnswerMessage = false;
            }
        }

        function afterMessage(param) {
            usSpinnerService.stop('booking-validation-spinner');
            vm.currentRequest = false;
            if (param === "missingMessage") {
                vm.missingCtaAnswerMessage = true;
            } else {
                vm.missingCtaAnswerMessage = false;
                vm.ctaAnswerMessage        = null;
                vm.ctaPublicMessage        = null;
            }
        }

        function createBankAccount() {
            var editingCurrentUser = Restangular.copy(vm.currentUser);

            if (vm.currentRequest) { // debounce
                return;
            }

            vm.identity.birthday = "" + vm.birthYear + "-" + vm.birthMonth + "-" + vm.birthDay; // ISO

            // Check if all needed info was provided to create MangopayAccount/wallet
            // For creation only: e.g. do not prevent Sharinplace user from removing its lastname attribute...
            if ((! vm.currentUser.mangopayAccount
                || ! vm.currentUser.wallet)
                && (
                    ! vm.identity.birthday
                    || ! vm.identity.nationality
                    || ! vm.identity.countryOfResidence
                    || ! vm.firstName
                    || ! vm.lastName
                )
            ) {
                toastr.warning("Il manque des informations nécessaires à la validation de la réservation.", "Informations bancaires");
                vm.currentRequest = false;
                return;
            }

            editingCurrentUser.firstname = vm.firstName;
            editingCurrentUser.lastname  = vm.lastName;
            editingCurrentUser.iban      = vm.iban;

            if (vm.birthDay !== "23"
             || vm.birthMonth !== "09"
             || vm.birthYear !== 1990
            ) {
                editingCurrentUser.birthday = vm.identity.birthday;
            }

            return $q.when(true)
                .then(function () {
                    usSpinnerService.spin('booking-validation-spinner');

                    var updateAttrs = [
                        "firstname",
                        "lastname",
                        "birthday",
                        "iban"
                    ];

                    if (! _.isEqual(_.pick(editingCurrentUser, updateAttrs), _.pick(vm.currentUser, updateAttrs))) {
                        return editingCurrentUser.patch();
                    }

                    return;
                })
                .then(function () {
                    if (vm.currentUser.mangopayAccount && vm.currentUser.wallet) {
                        return true;
                    }

                    return finance.createAccount({
                        birthday: vm.identity.birthday,
                        nationality: vm.identity.nationality,
                        countryOfResidence: vm.identity.countryOfResidence
                    }).catch(function (err) {
                        toastr.warning("Nous sommes désolés, veuillez réessayez plus tard.", "Oups, une erreur est survenue.");
                        return $q.reject(err);
                    });
                })
                .then(function () {
                    var updatingAddress = null;
                    var missingAddress  = false;

                    if (newAddress) {
                        updatingAddress = newAddress;
                    } else if (! vm.currentUser.address) {
                        missingAddress = true;
                    }

                    if (missingAddress) {
                        vm.missingAddress = true;
                    } else {
                        vm.missingAddress = false;
                    }

                    if (updatingAddress) {
                        return editingCurrentUser
                            .updateAddress(updatingAddress)
                            .then(function () {
                                newAddress = null;
                                vm.currentUser.address = updatingAddress;

                                // if the user has no locations, add it
                                if (! vm.myLocations.length) {
                                    // no error handling
                                    LocationService
                                        .post(_.omit(updatingAddress, ["id"]))
                                        .then(function (newLocation) {
                                            LocationService.add(newLocation);
                                            vm.myLocations.push(newLocation);
                                        });
                                }
                            })
                            .catch(function (err) {
                                toastr.warning("Veuillez renseigner une adresse correcte.", "Adresse incorrecte");
                                return $q.reject(err);
                            });
                    } else if (missingAddress) {
                        toastr.warning("Veuillez renseigner votre adresse.", "Adresse manquante");
                        return $q.reject("no address");
                    } else {
                        return;
                    }
                })
                .then(function () {
                    if (! vm.iban) {
                        toastr.warning("Veuillez renseigner votre IBAN.", "IBAN manquant");
                        vm.badIban = true;
                        return $q.reject("no iban");
                    }

                    return finance.createBankAccount()
                        .then(function () {
                            vm.hasBankAccount        = true;
                            vm.bankAccountActive     = false;
                            vm.showBankAccountToggle = true;
                            _getCtaTitle();
                            toastr.success("Merci\xa0! Nous pourrons vous transférer le montant de la location après signature de l'état des lieux initial.",
                                "Coordonnées bancaires enregistrées");
                        })
                        .catch(function (err) {
                            toastr.warning("Veuillez vérifier votre IBAN.", "Erreur lors de l'enregistrement de vos informations bancaires");
                            vm.badIban = true;
                            return $q.reject(err);
                        });
                })
                .finally(function () {
                    usSpinnerService.stop('booking-validation-spinner');
                    vm.currentRequest = false;
                });
        }

        function _setBookingState() {
            if (! vm.booking) {
                return;
            }

            if (vm.booking.cancellationId) {
                vm.bookingState = "cancelled";
            } else if (! vm.message.isCtaActive) {
                vm.bookingState = "updated";
            } else if (vm.booking.acceptedDate && vm.booking.paidDate) {
                vm.bookingState = "paidAndValidated";
                vm.payDate      = moment(vm.booking.paidDate).format(displayFormatDate);
            } else if (vm.booking.paidDate) {
                vm.bookingState = "paid";
                vm.payDate      = moment(vm.booking.paidDate).format(displayFormatDate);
            } else if (vm.booking.acceptedDate) {
                vm.bookingState = "validated";
                vm.acceptDate   = moment(vm.booking.acceptedDate).format(displayFormatDate);
            }
        }

        function _getCtaTitle(bookingStatus) {
            switch (bookingStatus) {
                case "info":
                case "pre-booking":
                    if (vm.booking && vm.booking.acceptedDate && vm.isOwner && ! vm.hasBankAccount) {
                        return "Coordonnées requises";
                    }
                    return "Demande d'information";

                default:
                    if (vm.booking && vm.booking.acceptedDate && vm.isOwner && ! vm.hasBankAccount) {
                        return "Coordonnées requises";
                    }
                    return "Demande de réservation";
            }
        }

        function _setFees() {
            var priceResult = pricing.getPriceAfterRebateAndFees({ booking: vm.booking });

            vm.listingBasePrice = priceResult.ownerPriceAfterRebate;
            vm.ownerNetIncome  = priceResult.ownerNetIncome;
            vm.ownerFeesString = vm.booking.ownerFees ? vm.booking.ownerFees + "€" : "Offerts";
            vm.takerFeesString = vm.booking.takerFees ? vm.booking.takerFees + "€" : "Offerts";
        }

    }

})();
