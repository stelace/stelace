/* global fbq, ga, moment */

(function () {

    angular
        .module("app.bookings")
        .controller("BookingConfirmationController", BookingConfirmationController);

    function BookingConfirmationController($q,
                                        $scope,
                                        $state,
                                        $stateParams,
                                        $location,
                                        $timeout,
                                        $window,
                                        BookingService,
                                        gamification,
                                        ListingCategoryService,
                                        ListingService,
                                        map,
                                        MediaService,
                                        MessageService,
                                        platform,
                                        pricing,
                                        StelaceEvent,
                                        storage,
                                        toastr,
                                        tools,
                                        User,
                                        UserService,
                                        usSpinnerService) {
        var cardId;
        var statusIcon;
        var bookingPaymentMessages;

        var vm = this;
        vm.error                  = false;
        vm.paymentProcessing      = false;
        vm.paymentDone            = false;
        vm.showBookingDuration    = false;

        activate();



        function activate() {

            $scope.$on("$destroy", function () {
                $timeout.cancel(vm.paymentRedirectionTimeout);
            });

            $q.all({
                booking: BookingService.get($stateParams.id),
                currentUser: UserService.getCurrentUser(true),
                bookingPaymentMessages: MessageService.getBookingPaymentMessageTmp($stateParams.id),
                myImage: MediaService.getMyImage()
            }).then(function (results) {
                vm.booking             = results.booking;
                vm.currentUser         = results.currentUser;
                vm.noImage             = (results.myImage.url === platform.getDefaultProfileImageUrl());
                bookingPaymentMessages = results.bookingPaymentMessages || {};

                if (vm.currentUser.id !== vm.booking.takerId) {
                    $state.go("listing", { id: vm.booking.listingId });
                    return $q.reject("User is not taker");
                }

                if (vm.booking.paidDate) {
                    vm.paymentDone = true;
                }

                return $q.all({
                    conversations: MessageService.getConversations({
                        listingId: vm.booking.listingId,
                        senderId: vm.currentUser.id,
                        receiverId: vm.booking.ownerId,
                        bookingId: vm.booking.id
                    }),
                    listing: ListingService.get(vm.booking.listingId),
                    listingCategories: ListingCategoryService.cleanGetList(),
                    listingLocations: ListingService.getLocations(vm.booking.listingId),
                    cardId: tools.getLocalData("cardId", vm.currentUser.id)
                });
            })
            .then(function (results) {
                var conversations  = results.conversations;
                var listing           = results.listing;
                var listingCategories = results.listingCategories;
                cardId             = results.cardId;


                if (conversations.length) {
                    // Finding right conversation is done server-side (Booking Controller)
                    // var bookingConversation = _.find(conversations, { 'bookingId' : vm.booking.id });
                    // conversations = _.sortBy(conversations, function (conversation) {
                    //     return - conversation.createdDate;
                    // });
                    // vm.conversation  = bookingConversation || conversations[0];
                    vm.conversation = conversations[0];
                }

                ListingService.populate(listing, {
                    locations: results.listingLocations
                });

                vm.owner = listing.owner;
                vm.owner.fullname = User.getFullname.call(vm.owner);

                vm.listingLocations = listing.vLocations;

                _.forEach(vm.listingLocations, function (location) {
                    location.displayAddress = map.getPlaceName(location);
                });

                vm.listing            = listing;
                vm.bookingDuration = vm.booking.nbTimeUnits + " jour" + (vm.booking.nbTimeUnits > 1 ? "s" : "");

                if (vm.booking.startDate && vm.booking.endDate) {
                    vm.startDate           = _displayDate(vm.booking.startDate);
                    vm.endDate             = _displayDate(moment(vm.booking.endDate).subtract({ d: 1 }));
                    vm.showBookingDuration = true;
                } else {
                    vm.showBookingDuration = false;
                }

                vm.listingCategoryName = ListingCategoryService.findListingCategory(listing, listingCategories);
                vm.notCategoryTags     = ListingCategoryService.notCategoryTags(listing.completeTags, vm.listingCategoryName);

                var locationSearch = $location.search();

                if (locationSearch.error) {
                    vm.error = true;

                    if (locationSearch.error === "fail" && locationSearch.resultCode) {
                        var errorTitle = "Échec du paiement";
                        var errorMessage;

                        switch (locationSearch.resultCode) {
                            case "101399":
                                errorMessage = "Votre carte bancaire ne supporte malheureusement pas la procédure de sécurité \"Verified by Visa\". Nous vous invitons à utiliser une autre carte.";
                                break;

                            case "101301":
                                errorMessage = "La procédure de sécurité \"Verified by Visa\" a échoué. Nous vous invitons à recommencer.";
                                break;

                            case "101105":
                                errorMessage = "Votre carte a expiré. Nous vous invitons à saisir un autre numéro de carte bancaire.";
                                break;

                            case "101106":
                            case "101410":
                                errorMessage = "L'enregistrement de votre carte bancaire a échoué. Veuillez saisir de nouveau le numéro de votre carte ou renseigner un autre numéro.";
                                break;

                            default:
                                errorMessage = "Le paiement a échoué. Veuillez vérifier que vous disposez des fonds suffisants sur votre compte et "
                                    + "que le plafond de votre carte bancaire n'a pas été atteint.";
                                break;
                        }

                        _redirectToPayment();

                        toastr.error(errorMessage, errorTitle, {
                            timeOut: 0,
                            closeButton: true
                        });
                    }

                    return $q.reject();
                }

                // at this point, deposit must be done
                if (! vm.booking.depositDate) {
                    return $q.reject();
                }

                if (! vm.booking.paymentDate) {
                    vm.firstTime = true;
                    vm.paymentProcessing = true;
                    return vm.booking
                        .payment({
                            cardId: cardId,
                            operation: "payment"
                        })
                        .catch(function (err) {
                            return $q.reject(err);
                        });
                } else {
                    return true;
                }
            }).then(function (res) {
                var booking;

                if (! res) {
                    return $q.reject("no booking");
                }

                if (res.redirectURL) {
                    $window.location.href = res.redirectURL;
                    return;
                } else {
                    booking = res;
                }

                if (booking.paidDate) {
                    vm.paymentProcessing = false;
                    vm.paymentDone = true;
                }
                statusIcon = "success";

                gamification.checkStats();

                // Only register successful payments in Google Analytics
                var gaLabel = 'bookingId: ' + vm.booking.id;
                ga('send', 'event', 'Listings', 'Payment', gaLabel, vm.booking.ownerPrice);
                // Facebook event
                var fbEventParams = {
                    value: vm.booking.ownerPrice,
                    currency: "EUR",
                    content_name: vm.listing.name,
                    content_ids: [vm.listing.id],
                    content_category: ListingCategoryService.getCategoriesString(vm.listingCategoryName, vm.notCategoryTags[0]),
                    stl_transaction_type: BookingService.getFbTransactionType(vm.booking)
                };
                fbq('track', 'Purchase', fbEventParams);

                if (bookingPaymentMessages) {
                    vm.privateContent = bookingPaymentMessages.privateContent;
                    vm.publicContent  = bookingPaymentMessages.publicContent;
                }

                // Get newly created conversation if needed
                // (created server side in BookingController during Payment)
                if (vm.conversation) {
                    return;
                } else {
                    return MessageService.getConversations({
                        listingId: vm.booking.listingId,
                        senderId: vm.currentUser.id,
                        receiver: vm.booking.ownerId,
                        bookingId: vm.booking.id
                    });
                }
            })
            .then(function (conversations) {
                if (conversations) {
                    vm.conversation = conversations[0];
                }
            })
            .catch(function (/* err */) {
                statusIcon = "failure";
                vm.error = true;
            })
            .finally(function () {
                vm.showStatusIcon = statusIcon;
                vm.paymentProcessing = false;
                usSpinnerService.stop('payment-spinner'); // autostart on load
            });
        }

        function _displayDate(date) {
            return moment(date).format("ddd D MMM YYYY");
        }

        function _redirectToPayment() {
            vm.paymentRedirectionTimeout = $timeout(function () {
                $state.go("bookingPayment", { id: vm.booking.id });
            }, 6000);
        }
    }

})();
