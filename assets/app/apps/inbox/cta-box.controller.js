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
                                KycService,
                                LocationService,
                                map,
                                Restangular,
                                pricing,
                                StelaceConfig,
                                toastr,
                                tools,
                                uiGmapGoogleMapApi,
                                UserService,
                                usSpinnerService) {
        var listeners         = [];
        var displayFormatDate = "DD/MM/YYYY";
        var newAddress;
        var loadIBANForm;
        var kyc;
        var bankAccounts;
        var paymentAccounts;

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
        vm.showContract          = false;
        vm.contractUrl           = null;
        vm.contractTarget        = "_blank";
        vm.isNoTime              = false;
        vm.bookingStatus         = "";

        // Google Places ngAutocomplete options
        vm.ngAutocompleteOptions = {
            forceGlobalSearch: true
        };

        vm.onChangeBirthday = onChangeBirthday;
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

            vm.paymentProvider = StelaceConfig.getPaymentProvider();

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
                    kyc: KycService.getMine(),
                    bankAccounts: finance.getBankAccounts(),
                    paymentAccounts: UserService.getPaymentAccounts(),
                }).then(function (results) {
                    vm.isGoogleMapSDKReady = true;
                    cache.set("isGoogleMapSDKReady", true);
                    kyc = results.kyc;
                    bankAccounts = results.bankAccounts;
                    paymentAccounts = results.paymentAccounts;

                    vm.currentUser  = results.currentUser;
                    vm.myLocations = results.myLocations;

                    if (vm.currentUser.address) {
                        vm.addressInput = vm.currentUser.address.name;
                    }

                    vm.identity = {
                        birthday: kyc.data.birthday,
                        nationality: kyc.data.nationality || "FR",
                        countryOfResidence: kyc.data.countryOfResidence || "FR"
                    };

                    // Populate account form
                    vm.firstName          = vm.currentUser.firstname;
                    vm.lastName           = vm.currentUser.lastname;
                    vm.hasBankAccount     = !!bankAccounts[0];
                    vm.bankAccountMissing = loadIBANForm && ! vm.hasBankAccount;

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

        function onChangeBirthday(date) {
            vm.identity.birthday = date;
        }

        function createBankAccount() {
            var editingCurrentUser = Restangular.copy(vm.currentUser);

            if (vm.currentRequest) { // debounce
                return;
            }

            var isCompleteMangopay = paymentAccounts.mangopayAccount && paymentAccounts.mangopayWallet;
            var isCompleteStripe = paymentAccounts.stripeAccount;
            var isComplete = (vm.paymentProvider === 'mangopay' && isCompleteMangopay)
                || (vm.paymentProvider === 'stripe' && isCompleteStripe);

            // Check if all needed info was provider for bank account
            if (!isComplete) {
                if (! vm.identity.birthday
                 || ! vm.identity.nationality
                 || ! vm.identity.countryOfResidence
                 || ! vm.firstName
                 || ! vm.lastName
                ) {
                    toastr.warning("Il manque des informations nécessaires à la validation de la réservation.", "Informations bancaires");
                    vm.currentRequest = false;
                    return;
                }
            }

            editingCurrentUser.firstname = vm.firstName;
            editingCurrentUser.lastname  = vm.lastName;

            return $q.when(true)
                .then(function () {
                    usSpinnerService.spin('booking-validation-spinner');

                    var updateAttrs = [
                        "firstname",
                        "lastname",
                        "userType",
                    ];

                    editingCurrentUser.userType = 'individual'; // TODO: the user can choose from UI

                    if (! _.isEqual(_.pick(editingCurrentUser, updateAttrs), _.pick(vm.currentUser, updateAttrs))) {
                        return editingCurrentUser.patch();
                    }

                    return;
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
                    if (isComplete) {
                        return true;
                    }

                    return KycService.updateKyc(kyc, {
                        birthday: vm.identity.birthday,
                        nationality: vm.identity.nationality,
                        countryOfResidence: vm.identity.countryOfResidence
                    })
                    .then(function (newKyc) {
                        kyc = newKyc;

                        if (vm.paymentProvider === 'mangopay') {
                            return finance.createAccount();
                        } else if (vm.paymentProvider === 'stripe') {
                            return finance.createStripeAccountToken({
                                legal_entity: {
                                    first_name: vm.currentUser.firstname,
                                    last_name: vm.currentUser.lastname,
                                    address: {
                                        line1: vm.currentUser.address.name,
                                        city: vm.currentUser.address.city,
                                        state: vm.currentUser.address.region,
                                        postal_code: vm.currentUser.address.postalCode,
                                    },
                                },
                                tos_shown_and_accepted: true
                            })
                            .then(function (res) {
                                return finance.createAccount({
                                    accountToken: res.token.id,
                                    accountType: 'account',
                                    country: kyc.data.countryOfResidence, // TODO: check the country associated with RIB
                                });
                            });
                        }
                    })
                    .catch(function (err) {
                        toastr.warning("Nous sommes désolés, veuillez réessayez plus tard.", "Oups, une erreur est survenue.");
                        return $q.reject(err);
                    });
                })
                .then(function () {
                    if (!vm.hasBankAccount && ! vm.iban) {
                        toastr.warning("Veuillez renseigner votre IBAN.", "IBAN manquant");
                        vm.badIban = true;
                        return $q.reject("no iban");
                    }

                    if (vm.paymentProvider === 'mangopay') {
                        var createBankAccountAttrs = {
                            ownerName: vm.firstName + " " + vm.lastName,
                            ownerAddress: {
                                AddressLine1: vm.currentUser.address.name,
                                City: vm.currentUser.address.city,
                                PostalCode: vm.currentUser.address.postalCode,
                                Country: vm.identity.countryOfResidence, // TODO: get the country from the address
                            },
                            iban: vm.iban,
                        };

                        return finance.createBankAccount(createBankAccountAttrs)
                            .then(_afterBankAccountCreationSuccess)
                            .catch(_afterBankAccountCreationFail);
                    } else if (vm.paymentProvider === 'stripe') {
                        return finance.createStripeBankAccountToken({
                            country: vm.identity.countryOfResidence,
                            currency: 'eur', // handle other currencies
                            routing_number: undefined,
                            account_number: vm.iban,
                            account_holder_name: vm.firstName + " " + vm.lastName,
                            account_holder_type: vm.currentUser.userType
                        })
                        .then(function (res) {
                            return finance.createBankAccount({
                                accountToken: res.token.id
                            });
                        })
                        .then(_afterBankAccountCreationSuccess)
                        .catch(_afterBankAccountCreationFail);
                    }
                })
                .finally(function () {
                    usSpinnerService.stop('booking-validation-spinner');
                    vm.currentRequest = false;
                });
        }

        function _afterBankAccountCreationSuccess() {
            vm.hasBankAccount        = true;
            vm.bankAccountActive     = false;
            vm.showBankAccountToggle = true;
            _getCtaTitle();
            toastr.success("Merci\xa0! Nous pourrons vous transférer le montant de la location après signature de l'état des lieux initial.",
                "Coordonnées bancaires enregistrées");
        }

        function _afterBankAccountCreationFail(err) {
            toastr.warning("Veuillez vérifier votre IBAN.", "Erreur lors de l'enregistrement de vos informations bancaires");
            vm.badIban = true;
            return $q.reject(err);
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
