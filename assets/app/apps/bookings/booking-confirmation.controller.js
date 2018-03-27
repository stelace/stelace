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
                                        ContentService,
                                        gamification,
                                        ListingCategoryService,
                                        ListingService,
                                        ListingTypeService,
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
        vm.listingType            = null;
        vm.listingTypeProperties  = {};

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

                vm.listing = listing;
                vm.listingType = vm.booking.listingType;
                vm.listingTypeProperties = ListingTypeService.getProperties(vm.booking.listingType);

                if (vm.booking.startDate && vm.booking.endDate) {
                    vm.startDate = vm.booking.startDate;
                    vm.endDate   = moment(vm.booking.endDate).subtract({ d: 1 }).toISOString();
                }

                vm.listingCategoryName = ListingCategoryService.findListingCategory(listing, listingCategories);
                vm.notCategoryTags     = ListingCategoryService.notCategoryTags(listing.completeTags, vm.listingCategoryName);

                var locationSearch = $location.search();

                if (locationSearch.error || locationSearch.error_type) {
                    vm.error = true;

                    var messageKey = BookingService.mapErrorTypeToTranslationKey(locationSearch.error_type);

                    _redirectToPayment();

                    ContentService.showNotification({
                        titleKey: 'payment.error.payment_error_title',
                        messageKey: messageKey,
                        type: 'error',
                        options: {
                            timeOut: 0,
                            closeButton: true
                        }
                    });

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
                    currency: vm.booking.currency,
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

        function _redirectToPayment() {
            vm.paymentRedirectionTimeout = $timeout(function () {
                $state.go("bookingPayment", { id: vm.booking.id });
            }, 6000);
        }
    }

})();
