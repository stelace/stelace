(function () {

    angular
        .module("app.core")
        .factory("promptInfoModal", promptInfoModal);

    // Modal service that requires some critical info (locations, phone...) from authenticated Users, to go on with current action

    function promptInfoModal($document,
                                $q,
                                $rootScope,
                                $timeout,
                                $translate,
                                authentication,
                                ContentService,
                                FoundationApi,
                                LocationService,
                                loggerToServer,
                                map,
                                Modal,
                                tools,
                                UserService,
                                usSpinnerService) {

        var service = {};

        service.ask            = ask;
        service.phoneSendCode  = phoneSendCode; // expose for use in app controllers
        service.phoneCheckCode = phoneCheckCode;

        var doc         = angular.element($document[0].documentElement);
        var isIOS       = tools.isIOS(); // for html scroll
        var scrollClass = "modal-opened" + (isIOS ? " lock-both" : "");
        var vm      = {
            action: action,
            addLocation: addLocation,
            bypassLocation: bypassLocation,
            phoneCheck: phoneCheck,
            phoneSendCode: phoneSendCode,
            phoneCheckCode: phoneCheckCode,
            updateEmail: updateEmail,
            sendEmailNew: sendEmailNew,
            displayPhoneCodeError: false,
            wrongCount: 0,
            step: 1,
            ngAutocompleteOptions: { // Google Places ngAutocomplete options
                forceGlobalSearch: true
            },
            emailChecked: false
        };
        var modalId = "promptInfoModal";
        var modal   = new Modal({
            id: modalId,
            className: "smaller dialog signin-form-container",
            templateUrl: "/assets/app/modals/promptInfoModal.html",
            overlayClose: false,
            // animationIn: "slideInRight",
            // animationOut: "slideOutLeft",
            contentScope: {
                vm: vm
            }
        });
        var clearCache      = true;
        var askPhone        = false;
        var askPhoneNew     = false;
        var askEmail        = false;
        var askEmailNew     = false;
        var askMainLocation = false;
        var promptedUser    = {};
        var promptFields    = [];
        var promptResults   = {};
        var subscribed;
        var deferred;

        return service;


        /**
         * Open promptInfoModal with given steps and options
         * @param {array} fields - Type of form ("login" or "register")
         * @param {object} [options] - Options related to auth process and additional modals' chaining
         * @param {object} [options.greeting] - Custom greeting messages object for modal steps
         * @param {object} [options.isListingOwner] - Greeting may be customized for owner of listings
         * @returns {object} Promise object
         */
        function ask(fields, options) {
            var missingFields   = [];
            options             = options || {};

            promptFields    = fields;
            askEmail        = _.contains(fields, "email");
            askEmailNew     = _.contains(fields, "emailNew");
            askMainLocation = _.contains(fields, "mainLocation");
            askPhone        = _.contains(fields, "phone");
            askPhoneNew     = _.contains(fields, "phoneNew");

            return UserService.getCurrentUser(clearCache)
                .then(function (currentUser) {
                    promptedUser = currentUser;
                    if (! promptedUser) {
                        throw new Error("user is not authenticated for prompt info process");
                    }
                    promptedUser  = currentUser;
                    promptResults = _.pick(promptedUser, promptFields); // user.mainLocation is undefined

                    if (askMainLocation) {
                        return LocationService
                            .getMine()
                            .then(function (locations) {
                                promptResults.mainLocation = tools.clearRestangular(LocationService.getMainLocation(locations));
                                return (!! promptResults.mainLocation);
                            });
                    } else {
                        return true; // we don't mind if user has no address here
                    }
                })
                .then(function (hasMainLocation) {
                    promptedUser.hasMainLocation = hasMainLocation;
                    missingFields = _missingFields(promptedUser, true);

                    if (missingFields.length) {
                        deferred = $q.defer();
                        return _openModal(missingFields, options);
                    } else {
                        promptResults.allInfoOk = true;
                        promptResults.noPrompt  = true;

                        return $q.when(promptResults);
                    }
                });
        }

        function _openModal(missingFields, options) {
            var ignoredFields   = [];
            var user;

            vm.displayPhoneCodeError = false;
            vm.fields                = missingFields;
            vm.info                  = vm.fields[0]; // order in vm.fields matters
            vm.autofocus             = true; // enable autofocus directive for inputs
            // Greeting can include several custom messages as attributes
            vm.greeting              = _.defaults(options.greeting || {}, {
                mainLocation: $translate.instant('user.prompt.main_location_helper', { is_listing_owner: options.isListingOwner ? 'is_owner' : '' }),
                secondLocation: $translate.instant('user.prompt.second_location_helper', { is_listing_owner: options.isListingOwner ? 'is_owner' : '' }),
                phone: $translate.instant('user.prompt.SMS_notifications', { phone_update: 'no_existing_phone' }),
                phoneNew: $translate.instant('user.prompt.SMS_notifications', { phone_update: 'phone_number_updated' }),
                email: $translate.instant('user.prompt.fill_in_email'),
                emailNew: promptedUser.email ?
                    $translate.instant('user.prompt.update_old_email', {
                        old_email: promptedUser.email
                    }) :$translate.instant('user.prompt.fill_in_email')
            });

            $rootScope.noGamificationDistraction = true; // Do not open gamification popover

            modal.activate();
            doc.addClass(scrollClass);
            // if service already subscribed to modal, useless to subscribe again to resolve new promise
            if (! subscribed) {
                // Before closing, check whether user has updated info
                FoundationApi.subscribe(modalId, function (msg) {
                    if (msg === "close" || msg === "hide") {
                        doc.removeClass(scrollClass);
                        UserService.getCurrentUser(clearCache)
                            .then(function (currentUser) {
                                if (! currentUser) {
                                    throw new Error("user has disconnected during prompt info process");
                                }
                                user          = currentUser;
                                promptResults = _.pick(user, promptFields); // user.mainLocation is undefined

                                if (askPhoneNew) {
                                    promptResults.phone = user.phone;
                                }

                                if (askMainLocation) {
                                    return LocationService
                                        .getMine()
                                        .then(function (locations) {
                                            promptResults.mainLocation = tools.clearRestangular(LocationService.getMainLocation(locations));
                                            return (!! promptResults.mainLocation);
                                        });
                                } else {
                                    return true;  // we don't mind since mainLocation is not needed
                                }
                            })
                            .then(function (hasMainLocation) {
                                user.hasMainLocation = hasMainLocation;
                                ignoredFields = _missingFields(user);

                                promptResults.allInfoOk = ! ignoredFields.length;

                                $rootScope.noGamificationDistraction = false;
                                deferred.resolve(promptResults);
                            })
                            .catch(function (err) {
                                deferred.reject(err);
                            })
                            .finally(function () {
                                // must clean things up since modal is not destroyed
                                vm.locationSearchInput = null;
                                vm.phone               = null;
                                vm.signCode            = null;
                                vm.email               = null;
                                vm.emailNew            = null;
                                vm.autofocus           = null; // reset autofocus for reopening
                                vm.step                = 1;
                            });
                    }
                });
                subscribed = true;
            }
            return deferred.promise;
        }

        function _missingFields(user, begin) {
            var fields = [];
            // order matters and is the same for all calls
            if (askEmail && ! user.email) {
                fields.push("email");
            }
            if (askMainLocation && ! user.hasMainLocation) {
                fields.push("mainLocation");
            }
            if (askPhone && (! user.phoneCheck || ! user.phone)) {
                vm.phone = user.phone || null;
                fields.push("phone");
            }
            if (askPhoneNew && (begin || (! begin && (! user.phoneCheck || ! user.phone)))) {
                fields.push("phoneNew");
            }
            if (askEmailNew && (begin || (! begin && ! user.email))) {
                fields.push("emailNew");
            }
            return fields;
        }



        function action() {
            switch (vm.info) {
                case "mainLocation":
                    vm.addLocation();
                    break;
                case "phone":
                case "phoneNew":
                    vm.phoneCheck();
                    break;
                case "email":
                    vm.updateEmail();
                    break;
                case "emailNew":
                    vm.sendEmailNew();
                    break;
            }
        }

        function addLocation() {
            if (typeof vm.locationSearchObject !== "object") {
                return;
            }
            map.getGooglePlaceData(vm.locationSearchObject)
                .then(function (addingLocation) {
                    return LocationService
                        .post(_.omit(addingLocation, ["id", "fakeId"]))
                        .then(function (newLocation) {
                            LocationService.add(newLocation);
                            if (vm.step === 1) {
                                vm.locationSearchInput  = null;
                                vm.locationSearchObject = null;
                                vm.autofocus            = null; // using same input for second location so we reset autofocus directive
                                vm.step++;
                                $timeout(function () {
                                    vm.autofocus = true;
                                    // Effectively trigger sipAutofocus directive's watch (in next digest loop)
                                });
                            } else {
                                _fieldCompleted("mainLocation");
                                ContentService.showSaved();
                            }
                        });
                })
                .catch(ContentService.showError);
        }

        function bypassLocation() {
            // user does not want to add another location but we already have one
            _fieldCompleted("mainLocation");
        }

        function phoneCheck() {
            switch (vm.step) {
                case 1:
                    vm.phoneSendCode();
                    break;
                case 2:
                    vm.phoneCheckCode();
                    break;
            }
        }

        function phoneSendCode(args) {
            var sendingInfo = {
                countryCode: "33", // hard coded for now
                // also see : https://github.com/googlei18n/libphonenumber
                to: vm.phone || args.to
            };

            usSpinnerService.spin('phone-verify-spinner');

            return authentication
                .phoneSendCode(sendingInfo)
                .then(function (res) {
                    if (! res.verifyId) {
                        throw new Error("missing response data");
                    }

                    if (res.alreadyChecked) {
                        if (_.contains(vm.fields, "phoneNew")) {
                            _fieldCompleted("phoneNew");
                        } else {
                            _fieldCompleted("phone");
                        }

                        ContentService.showNotification({
                            messageKey: 'notification.already_validated',
                            type: 'info'
                        });
                        vm.signCode = null;
                        return true; // for sanity
                    } else if (res.providerStatusCode === "10") { // No concurrent verifications
                        vm.step++;
                        ContentService.showNotification({
                            messageKey: 'notification.validation_code_already_sent'
                        });
                    } else {
                        vm.phoneVerifyId = res.verifyId;
                        vm.step++;
                    }
                    vm.phoneVerifyId = res.verifyId;
                    return vm.step;
                })
                .catch(function (err) {
                    _setFormAnimationError();
                    ContentService.showError(err);
                })
                .finally(function () {
                    usSpinnerService.stop('phone-verify-spinner');
                });
        }

        function phoneCheckCode(args) {
            var verifyInfo = {
                signCode: vm.signCode || args.signCode,
                verifyId: vm.phoneVerifyId
            };

            usSpinnerService.spin('phone-verify-spinner');

            return authentication
                .phoneCheckCode(verifyInfo)
                .then(function (res) {
                    if (res.verifyStatus === "0") {
                        vm.displayPhoneCodeError = false;

                        if (_.contains(vm.fields, "phoneNew")) {
                            _fieldCompleted("phoneNew");
                        } else {
                            _fieldCompleted("phone");
                        }

                        ContentService.showSaved();
                        vm.signCode = null;
                        return true; // for sanity
                    } else if (res.verifyStatus === "16" || res.verifyStatus === "17") {  // wrong code or to many failed attempts
                        _setFormAnimationError();
                        vm.displayPhoneCodeError = true;
                        vm.signCode = null;
                        if (++vm.wrongCount <= 1 && res.verifyStatus !== "17") {
                            return false;
                        } else if (vm.wrongCount === 2 && res.verifyStatus !== "17") {
                            ContentService.showNotification({
                                messageKey: 'notification.validation_last_attempt'
                            });
                            return false;
                        } else {
                            ContentService.showNotification({
                                messageKey: 'notification.validation_failed',
                                messageValues: {
                                    retry: 'later'
                                }
                            });
                            // ok while no other info needed
                            FoundationApi.publish(modalId, "close");
                            vm.wrongCount = 0;
                            return null; // for use in controllers > means "hide code input now"
                        }
                    } else {
                        var err = new Error("Phone verify check code error (status code: " + res.verifyStatus + ")");
                        _setFormAnimationError();
                        vm.signCode = null;
                        ContentService.showError(err);
                        return null;
                    }
                })
                .catch(function (err) {
                    _setFormAnimationError();
                    ContentService.showError(err);
                })
                .finally(function () {
                    usSpinnerService.stop('phone-verify-spinner');
                });
        }

        function updateEmail() {
            if (! tools.isEmail(vm.email)) {
                _showInvalidEmailError();
                return;
            }

            promptedUser.updateEmail(vm.email)
                .then(function () {
                    _fieldCompleted("email");
                })
                .catch(function (err) {
                    if (err.status === 400) {
                        _showInvalidEmailError();
                    } else {
                        ContentService.showError(err);
                    }

                    _setFormAnimationError();
                });
        }

        function sendEmailNew() {
            usSpinnerService.spin('email-new-check-spinner');

            authentication
                .emailNew(vm.emailNew)
                .then(function () {
                    ContentService.showNotification({
                        messageKey: 'user.account.email_validation_link_sent',
                        type: 'success'
                    });
                    _fieldCompleted("emailNew");
                })
                .catch(function (err) {
                    if (err.status === 400) {
                        if (err.data && err.data.message === "Existing email") {
                            ContentService.showNotification({
                                messageKey: 'authentication.error.email_already_used'
                            });
                        } else {
                            _showInvalidEmailError();
                        }
                    } else {
                        ContentService.showError(err);
                    }

                    _setFormAnimationError();
                })
                .finally(function () {
                    usSpinnerService.stop('email-new-check-spinner');
                });
        }


        function _setFormAnimationError() {
            vm.formAnimationError = true;

            $timeout(function () {
                vm.formAnimationError = false;
            }, 500);
        }

        function _showInvalidEmailError() {
            return ContentService.showNotification({
                messageKey: 'authentication.error.invalid_email',
                type: 'info'
            });
        }

        function _fieldCompleted(field) {
            vm.fields = _.reject(vm.fields, function (missing) { return missing === field; });

            if (vm.fields.length) {
                vm.step = 1; // reset counter for next field
                vm.info = vm.fields[0];
            } else {
                // vm.step++;
                FoundationApi.publish(modalId, "close");
            }
        }

    }

})();
