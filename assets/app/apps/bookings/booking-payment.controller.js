/* global fbq, ga, moment */

(function () {

    angular
        .module("app.bookings")
        .controller("BookingPaymentController", BookingPaymentController);

    function BookingPaymentController($q,
                                    $rootScope,
                                    $scope,
                                    $state,
                                    $stateParams,
                                    $window,
                                    BookingService,
                                    CardService,
                                    finance,
                                    ListingCategoryService,
                                    ListingService,
                                    mangopay,
                                    map,
                                    MediaService,
                                    MessageService,
                                    platform,
                                    pricing,
                                    Restangular,
                                    toastr,
                                    tools,
                                    StelaceConfig,
                                    StelaceEvent,
                                    User,
                                    UserService,
                                    usSpinnerService) {
        var listeners = [];
        var debouncedAction = tools.debounceAction(_createPayment);

        var nbDaysPricing = 28;
        var euroCountriesIsos = ["DE", "AT", "BE", "ES", "FI", "FR", "IE", "IT", "LU", "NL", "PT", "GR", "SL", "CY", "MT", "SK", "EE", "LV", "LT"];
        var currentUser;
        var bookingPaymentMessages;
        var cardId;
        var stelaceEventObj;

        var vm = this;
        vm.booking              = null;
        vm.showEmail            = false;
        vm.newCard              = {};
        vm.thisYear             = moment().year();
        vm.thisMonth            = moment().month() + 1;
        vm.birthDay             = "23";  // http://www.ladepeche.fr/article/2013/09/23/1715135-23-septembre-jour-plus-naissance.html
        vm.birthMonth           = "09";
        vm.birthYear            = 1990; // int required for default to match in ng-options
        vm.birthYears           = _.range((vm.thisYear - 18), 1900, -1);
        vm.reuseCard            = true; // default
        vm.rememberCard         = true; // default
        vm.promptPhoneHighlight = false;
        vm.showBookingDuration  = false;
        vm.isSmsActive          = StelaceConfig.isFeatureActive('SMS');

        vm.footerTestimonials   = true;

        vm.cardsToggle   = cardsToggle;
        vm.checkCountry  = checkCountry;
        vm.createAccount = createAccount;
        vm.saveCard      = saveCard;
        vm.createPayment = createPayment;

        activate();



        function activate() {
            moment.locale("fr");

            if (! $stateParams.id) {
                return $state.go("inbox");
            }

            StelaceEvent.sendScrollEvent("Booking payment view")
                .then(function (obj) {
                    stelaceEventObj = obj;
                    listeners.push(function () {
                        stelaceEventObj.cancelScroll();
                        stelaceEventObj = null;
                    });
                });

            $rootScope.noGamificationDistraction = true; // Prevent gamification popover/animation distraction

            $scope.$on('$destroy', function () {
                _.forEach(listeners, function (listener) {
                    listener();
                });
                $rootScope.noGamificationDistraction = false;
            });

            var notFoundBooking = function (err) {
                toastr.warning("Réservation introuvable");

                if (err.status === 404) {
                    $state.go("inbox");
                    return $q.reject("stop");
                } else {
                    return $q.reject(err);
                }
            };

            $q.all({
                booking: BookingService.get($stateParams.id).catch(notFoundBooking),
                currentUser: UserService.getCurrentUser(true),
                cards: CardService.getMine(),
                myImage: MediaService.getMyImage(),
                bookingPaymentMessages: MessageService.getBookingPaymentMessageTmp($stateParams.id)
            }).then(function (results) {
                currentUser            = results.currentUser;
                bookingPaymentMessages = results.bookingPaymentMessages || {};
                cardId                 = results.cardId;

                if (currentUser.id !== results.booking.takerId) {
                    $state.go("listing", { slug: results.booking.listingId });
                    return $q.reject("User is not taker");
                }

                return tools.getLocalData("cardId", currentUser.id)
                    .then(function (cardId) {
                        results.cardId = cardId;
                        return results;
                    });
            }).then(function (results) {
                cardId = results.cardId;
                vm.booking       = results.booking;
                vm.currentUser   = currentUser;
                vm.noAccount     = ! currentUser.mangopayAccount;
                vm.cards         = results.cards;
                vm.noImage       = (results.myImage.url === platform.getDefaultProfileImageUrl());
                vm.identity      = {
                    birthday: currentUser.birthday,
                    nationality: currentUser.nationality || "FR",
                    countryOfResidence: currentUser.countryOfResidence || "FR"
                };

                if (vm.booking.cancellationId) {
                    toastr.warning("Réservation annulée");
                    $state.go("inbox");
                    return $q.reject("stop");
                }

                if (! currentUser.email) {
                    vm.showEmail = true;
                }

                if (! _.isEmpty(bookingPaymentMessages)) {
                    vm.privateContent = bookingPaymentMessages.privateContent;
                    vm.publicContent  = bookingPaymentMessages.publicContent;
                }

                if (vm.cards.length) {
                    var foundCard = (cardId && _.find(vm.cards, function (card) { return card.id === cardId; }));
                    if (foundCard) {
                        vm.selectedCard = foundCard;
                    } else {
                        vm.selectedCard = vm.cards[0];
                    }
                }

                vm.existingPhone = vm.currentUser.phoneCheck; // save initial value

                // Populate account form
                vm.firstName = vm.currentUser.firstname;
                vm.lastName  = vm.currentUser.lastname;
                if (vm.currentUser.birthday
                  && ! isNaN(new Date(vm.identity.birthday)) // valid date
                ) {
                    var birth = vm.currentUser.birthday.split('-');
                    if (birth.length === 3) {
                        vm.birthYear  = parseInt(birth[0], 10); // required for match in ng-options
                        vm.birthMonth = birth[1];
                        vm.birthDay   = birth[2];
                    }
                }

                if (vm.booking.startDate && vm.booking.endDate) {
                    vm.startDate = _displayDate(vm.booking.startDate);
                    vm.endDate   = _displayDate(moment(vm.booking.endDate).subtract({ d: 1 }));

                    vm.showBookingDuration = true;
                } else {
                    vm.showBookingDuration = false;
                }

                return $q.all({
                    conversations: MessageService.getConversations({
                        listingId: vm.booking.listingId,
                        senderId: currentUser.id
                    }),
                    listing: ListingService.get(vm.booking.listingId).catch(redirectToNotFoundListing),
                    listingLocations: ListingService.getLocations(vm.booking.listingId).catch(function () { return []; })
                });
            }).then(function (results) {
                var listing = results.listing;

                if (results.conversations.length) {
                    // pick conversation created last
                    var conversations = _.sortBy(results.conversations, function (conversation) {
                        return - conversation.createdDate;
                    });
                    vm.conversation = conversations[0];
                }
                ListingService.populate(listing, {
                    locations: results.listingLocations,
                    nbDaysPricing: Math.max(nbDaysPricing, vm.booking.nbTimeUnits)
                });
                vm.bookingDuration  = vm.booking.nbTimeUnits + " jour" + (vm.booking.nbTimeUnits > 1 ? "s" : "");

                vm.expirationYears = _.range(vm.thisYear, (vm.thisYear + 10));

                // Google Analytics event
                var gaLabel = 'bookingId: ' + vm.booking.id;
                ga('send', 'event', 'Listings', 'PaymentView', gaLabel);

                // Stelace event
                if (stelaceEventObj && stelaceEventObj.stelaceEvent) {
                    stelaceEventObj.stelaceEvent.update({
                        data: {
                            listingId: listing.id,
                            tagsIds: listing.tags,
                            bookingId: vm.booking.id
                        }
                    });
                }

                listing.owner.fullname = User.getFullname.call(listing.owner);
                vm.listing             = listing;

                vm.listingLocations = listing.vLocations;

                _.forEach(vm.listingLocations, function (location) {
                    location.displayAddress = map.getPlaceName(location);
                });

                vm.listingCategoryName = ListingCategoryService.findListingCategory(listing/*,listingCategories*/); // can be empty if listing-view was by-passed
                vm.notCategoryTags     = ListingCategoryService.notCategoryTags(listing.completeTags, vm.listingCategoryName);

                // $timeout(function () {
                //     vm.hideSummary = false; // for collapse
                // }, 500);
            })
            .catch(function (err) {
                if (err !== "stop") {
                    toastr.warning("Une erreur est survenue. Veuillez réessayer plus tard.");
                }
            });
        }

        function redirectToNotFoundListing(err) {
            if (err.status === 404) {
                $state.go("listing", { slug: vm.booking.listingId });
                return $q.reject("stop");
            }
        }

        function cardsToggle() {
            vm.reuseCard = !vm.reuseCard;
            vm.selectedCard = vm.reuseCard ? vm.cards[0] : null;
        }

        function checkCountry() {
            if (!_.includes(euroCountriesIsos, vm.identity.countryOfResidence)) {
                vm.euroCountryWarning = true;
            } else {
                vm.euroCountryWarning = false;
            }
        }

        function _displayDate(date) {
            return moment(date).format("ddd D MMM YYYY");
        }

        function createAccount() {
            var updateAttrs = [
                "firstname",
                "lastname",
                "birthday"
                // countryOfResidence is updated through Finance service
            ];
            if (vm.isSmsActive) {
                updateAttrs.push('phone');
            }

            var editingCurrentUser = Restangular.copy(vm.currentUser);
            vm.identity.birthday = "" + vm.birthYear + "-" + vm.birthMonth + "-" + vm.birthDay; // ISO
            var validBirthday    = ! isNaN(new Date(vm.identity.birthday));

            // Check if all needed info was provided
            if (! vm.identity.birthday
                || ! vm.identity.nationality
                || ! vm.identity.countryOfResidence
                || ! vm.firstName
                || ! vm.lastName
            ) {
                toastr.warning("Il manque des informations nécessaires à la validation du paiement.", "Informations de facturation");
                return false;
            }
            if (! validBirthday) {
                toastr.warning("Date de naissance invalide"); // should not happen since constructed above
                return false;
            }

            // Update User with new info
            if (! vm.currentUser.firstname && vm.firstName) {
                editingCurrentUser.firstname = vm.firstName;
            }
            if (! vm.currentUser.lastname && vm.lastName) {
                editingCurrentUser.lastname = vm.lastName;
            }
            if (validBirthday
             && ($scope.paymentForm.takerBirthDay.$dirty || $scope.paymentForm.takerBirthMonth.$dirty || $scope.paymentForm.takerBirthYear.$dirty)
            ) {
                // At least one of inputs has changed... Not very safe anyway
                editingCurrentUser.birthday = vm.identity.birthday;
            }

            return $q.when(true)
                .then(function () {
                    if (! _.isEqual(_.pick(editingCurrentUser, updateAttrs), _.pick(vm.currentUser, updateAttrs))) {
                        return editingCurrentUser.put().then(function (user) {
                            return user;
                        });
                        // needs name for mangopay account
                    }
                    return $q.when(true);
                })
                .then(function () {
                    if (vm.currentUser.mangopayAccount && vm.currentUser.wallet) {
                        return true;
                    }

                    return finance.createAccount({
                        birthday: vm.identity.birthday,
                        nationality: vm.identity.nationality,
                        countryOfResidence: vm.identity.countryOfResidence
                    });
                });
        }

        function saveCard() {
            var cardRegistration;
            vm.newCard.expirationDate = "" + vm.cardExpirationMonth + vm.cardExpirationYear.toString().slice(2, 4);

            return CardService.createCardRegistration({ cardType: "CB_VISA_MASTERCARD" }) // TODO: use angular-credit-cards to detect card-type
                .then(function (c) {
                    cardRegistration = c;
                    mangopay.cardRegistration.init(cardRegistration);
                    return mangopay.cardRegistration.registerCard({
                        cardType: cardRegistration.cardType,
                        cardNumber: vm.newCard.number,
                        cardExpirationDate: vm.newCard.expirationDate,
                        cardCvx: vm.newCard.cvx
                    });
                })
                .then(function (data) {
                    return CardService.createCard({
                        cardRegistrationId: cardRegistration.id,
                        registrationData: data,
                        cardNumber: vm.newCard.number,
                        expirationDate: vm.newCard.expirationDate,
                        forget: ! vm.rememberCard
                    });
                })
                .then(function (card) {
                    vm.cards.push(card);
                    // toastr.info("Carte bleue enregistrée");
                    return card;
                });
        }

        function createPayment() {
            return debouncedAction.process();
        }

        function _createPayment() {
            var selectedCard;

            // Register all payment attemps in Google Analytics
            var gaLabel = 'bookingId: ' + vm.booking.id;
            ga('send', 'event', 'Listings', 'PaymentAttempt', gaLabel);

            // Facebook event
            var fbEventParams = {
                content_ids: [vm.listing.id],
                content_name: vm.listing.name,
                content_category: ListingCategoryService.getCategoriesString(vm.listingCategoryName, vm.notCategoryTags[0]),
                stl_transaction_type: BookingService.getFbTransactionType(vm.booking)
            };
            fbq('track', 'AddPaymentInfo', fbEventParams);

            // Stelace event
            StelaceEvent.sendEvent("Booking payment attempt", {
                type: "click",
                data: {
                    listingId: vm.listing.id,
                    tagsIds: vm.listing.tags,
                    targetUserId: vm.booking.ownerId,
                    bookingId: vm.booking.id
                }
            });

            if (! vm.conversation && ! vm.privateContent) {
                return toastr.info("Vous devriez écrire quelques mots au propriétaire afin qu'il accepte votre demande.", "Un petit mot...");
            } else if (! vm.privateContent && ! vm.booking.acceptedDate) {
                // Automatic message if needed when user has already booked this listing before, or engaged a conversation with owner
                // But don't create automatic message if already accepted by owner...
                if (BookingService.isNoTime(vm.booking)) {
                    vm.privateContent = "Bonjour, je viens d'effectuer un paiement "
                     + "pour acheter votre " + vm.listing.name + ".\n\nAcceptez-vous ma réservation?";
                } else {
                    vm.privateContent = "Bonjour, je viens d'effectuer un "
                     + (vm.booking.takerPrice ? "paiement " : "dépôt de garantie ")
                     + "pour réserver votre " + vm.listing.name + " du "
                     + vm.startDate + " au " + vm.endDate + ".\n\nAcceptez-vous ma réservation?";
                }
            }

            // Existing cards should be valid
            // TODO : check it
            if (vm.selectedCard && vm.reuseCard) {
                selectedCard = vm.selectedCard;
            } else if (! vm.selectedCard && vm.cards.length && vm.reuseCard) {
                selectedCard = vm.cards[0]; // should not happen
            } else {
                if ($scope.paymentForm.newCardNumber.$invalid) {
                    return toastr.warning("Veuillez vérifier votre numéro de carte bancaire.", "Informations de paiement");
                }
                if (! vm.cardExpirationMonth || ! vm.cardExpirationYear) {
                    return toastr.warning("Veuillez préciser la date d'expiration de votre carte bancaire.", "Informations de paiement");
                }
                if ($scope.paymentForm.newCardCvc.$invalid) {
                    return toastr.warning("Veuillez vérifier votre code de sécurité (inscrit au dos de votre carte bancaire)", "Informations de paiement");
                }
            }

            usSpinnerService.spin('payment-spinner');

            return $q.when(true)
                .then(function () {
                    return UserService.getCurrentUser(true);
                })
                .then(function (currentUser) {
                    vm.currentUser = currentUser;

                    if (! vm.currentUser.phoneCheck && vm.isSmsActive) {
                        vm.promptPhoneHighlight = true;
                        toastr.info("Veuillez vérifier votre numéro de téléphone (fixe ou mobile).", "Informations de paiement");
                        return $q.reject("stop");
                    }

                    if (! currentUser.email && ! tools.isEmail(vm.email)) {
                        toastr.info("Veuillez renseigner une adresse email valide.");
                        return $q.reject("stop");
                    }

                    if (! currentUser.email) {
                        return currentUser.updateEmail(vm.email);
                    } else {
                        return;
                    }
                })
                .then(function () {
                    return createAccount();
                })
                .then(function (hasAccount) {
                    if (hasAccount === false) {
                        return $q.reject("no account");
                    }

                    if (selectedCard && selectedCard.id) {
                        return selectedCard;
                    }
                    return saveCard();
                })
                .then(function (card) {
                    if (! selectedCard) {
                        selectedCard = card;
                    }

                    return tools.setLocalData("cardId", currentUser.id, card.id);
                })
                .then(function () {
                    var messages = vm.privateContent || vm.publicContent ? {
                        privateContent: vm.privateContent,
                        publicContent: vm.publicContent
                    } : {};

                    return MessageService.setBookingPaymentMessageTmp(vm.booking.id, messages);
                })
                .then(function () {
                    if (vm.booking.depositDate) {
                        $state.go("bookingConfirmation", { id: vm.booking.id });
                        return;
                    }

                    return vm.booking.payment({
                        cardId: selectedCard.id,
                        operation: "deposit-payment",
                        userMessage: {
                            privateContent: vm.privateContent,
                            publicContent: vm.publicContent
                        }
                    });
                })
                .then(function (mangopayRes) {
                    if (mangopayRes) {
                        if (mangopayRes.redirectURL) {
                            $window.location.href = mangopayRes.redirectURL;
                        } else {
                            $state.go("bookingConfirmation", { id: vm.booking.id });
                        }
                    }
                })
                .catch(function (err) {
                    if (err === "stop" || err === "no account") {
                        return; // already a toastr in createAccount
                    }

                    vm.reuseCard    = false;
                    vm.selectedCard = null;

                    if (err.status === 400 && err.data && err.data.message === "expiration date too short") {
                        // TODO : check on load
                        return toastr.warning("Veuillez utiliser une carte expirant dans au moins un mois.", "Carte bientôt expirée");
                    } else if (err.status === 400 && err.data && err.data.message === "preauthorization fail") {
                        var errorTitle = "Échec du paiement";
                        var errorMessage;

                        switch (err.data.resultCode) {
                            case "101399":
                                errorMessage = "Votre carte bancaire ne supporte pas la procédure de sécurité \"Verified by Visa\".";
                                break;

                            case "101301":
                                errorMessage = "La procédure de sécurité \"Verified by Visa\" a échoué.";
                                break;

                            case "101105":
                                errorMessage = "Votre carte a expiré. Veuillez saisir un autre numéro de carte bancaire.";
                                break;

                            case "101106":
                            case "101410":
                                errorMessage = "L'enregistrement de votre carte bancaire a échoué. Merci de saisir à nouveau le numéro de votre carte ou d'enregistrer une autre carte.";
                                break;

                            default:
                                errorMessage = "Le paiement a échoué. Veuillez vérifier que vous disposez des fonds suffisants sur votre compte et "
                                    + "que le plafond de votre carte bancaire n'a pas été atteint.";
                                break;
                        }

                        return toastr.error(errorMessage, errorTitle);
                    }

                    toastr.warning("Nous sommes désolés et cherchons à résoudre le problème. Veuillez recommencer plus tard.", "Oups, une erreur s'est produite");
                })
                .finally(function () {
                    usSpinnerService.stop('payment-spinner');
                });
        }
    }

})();
