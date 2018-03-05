/* global ga, moment */

(function () {

    angular
        .module("app.inbox")
        .controller("InboxConversationController", InboxConversationController);

    function InboxConversationController($interval,
                                            $q,
                                            $rootScope,
                                            $scope,
                                            $state,
                                            $stateParams,
                                            $timeout,
                                            $translate,
                                            BookingService,
                                            ContentService,
                                            ezfb,
                                            finance,
                                            ListingService,
                                            ListingTypeService,
                                            loggerToServer,
                                            map,
                                            MessageService,
                                            platform,
                                            StelaceEvent,
                                            storage,
                                            toastr,
                                            tools,
                                            User,
                                            UserService,
                                            AssessmentService,
                                            RatingService,
                                            Restangular,
                                            usSpinnerService) {

        var listeners      = [];
        var intervals      = [];
        var formatDate     = "YYYY-MM-DD";
        var conversationId = parseInt($stateParams.conversationId, 10);
        var messages       = [];
        var conversation;
        var currentUser;
        var isLoggedAs;
        var debouncedSaveMessageTmp;
        var countdownInterval;
        var activated;
        var listingShareUrl;
        var bankAccounts;

        var vm = this;
        vm.duplicateActionMessage     = null;
        vm.showDuplicateActionMessage = false;
        vm.showAssessment             = false;
        vm.forms                      = {};
        vm.showShouldObfuscateMessage = false;

        vm.sendMessage             = sendMessage;
        vm.resetConversationForm   = resetConversationForm;
        vm.acceptBooking           = acceptBooking;
        vm.rejectBooking           = rejectBooking;
        vm.saveMessageTmp          = saveMessageTmp;
        vm.facebookShare           = facebookShare;
        vm.shouldObfuscateMessage  = shouldObfuscateMessage;

        activate();

        function activate() {
            moment.locale("fr");

            if (! $stateParams.conversationId || isNaN(conversationId)) {
                return $state.go("inbox"); // must return to prevent populateConversation from triggering
            }

            listeners.push(
                $rootScope.$on("refreshInbox", function () {
                    if (! activated) {
                        return;
                    }
                    var oldMessagesCount = messages.length;
                    _populateConversation()
                        .then(function () {
                            if (oldMessagesCount < messages.length) {
                                ContentService.showNotification({
                                    messageKey: 'inbox.new_message_notification_message',
                                    options: {
                                        timeOut: 0, // will sitck
                                        closeButton: true
                                    }
                                });
                            }
                            return _populateAssessments(); // refreshInbox emited after signing input assessment
                        });
                })
            );

            $scope.$on("$destroy", function () {
                _.forEach(listeners, function (listener) {
                    listener();
                });
                _.forEach(intervals, function (interval) {
                    $interval.cancel(interval);
                });
            });

            $scope.$watch("vm.bankAccountMissing", function (newStatus, oldStatus) {
                if (activated && oldStatus === true && newStatus === false) {
                    return _populateMessageCTA();
                }
            });

            return _populateConversation()
                .then(function () {
                    return $translate('inbox.conversation_with', {
                        interlocutorName: vm.interlocutor.firstname || vm.interlocutor.fullname
                    });
                })
                .then(function (title) {
                    var shareUtm = {
                        utmSource: "facebook",
                        utmMedium: "social",
                        utmCampaign: vm.isOwner ? "listing-share-owner" : "listing-share",
                        utmContent: "picture"
                    };

                    vm.listingSlug  = ListingService.getListingSlug(vm.listing);
                    listingShareUrl = platform.getListingShareUrl(vm.listingSlug, shareUtm);

                    _populateAssessments();
                    platform.setTitle(title);
                    activated = true;

                    StelaceEvent.sendEvent("Conversation view", {
                        data: {
                            listingId: vm.listing.id,
                            bookingId: vm.booking && vm.booking.id,
                            targetUserId: vm.interlocutor.id,
                            nbMessages: messages.length
                        }
                    });
                });
        }

        function _populateConversation() {
            return $q.all({
                conversation: MessageService.conversationMeta(conversationId),
                currentUser: UserService.getCurrentUser(),
                messages: MessageService.conversation(conversationId),
                bankAccounts: finance.getBankAccounts(),
            }).then(function (results) {
                conversation = results.conversation;
                currentUser  = results.currentUser;
                messages     = results.messages;
                bankAccounts = results.bankAccounts;

                MessageService.populate([conversation], currentUser);

                var lastMessage  = _.last(messages);
                var firstMessage = _.first(messages);

                vm.isSender   = currentUser.id === conversation.senderId;
                vm.isReceiver = currentUser.id === conversation.receiverId;
                // redirect if not a member of conversation
                if (! vm.isSender && ! vm.isReceiver) {
                    $state.go("inbox");
                } else if (messages.length === 0) { // or if conversation is empty
                    var error = new Error("Should not expose empty conversation");
                    loggerToServer.error(error);
                    $state.go("inbox");
                }

                messages = _.uniq(messages, function (message) {
                    // Only display last payment attempt without message for UX and to avoid several bookings in same conversation
                    // E.g., taker can book several dates after conversation is created
                    // For non empty messages, debounce for each day
                    var content = "" + message.privateContent + message.publicContent;
                    return (content ? (moment(message.createdDate).format("YYYY-MM-DD") + content) : content); // only one empty (payment) message
                });

                if (vm.isReceiver
                 && firstMessage.publicContent // only first message can contain public question
                 && ! _.find(messages, function (message) {
                    return (message.senderId === conversation.receiverId) && message.publicContent;
                 }) // allow to answer public question later on
                ) {
                    vm.promptPublic = true;
                } else {
                    vm.promptPublic = false;
                }

                // asynchronous
                getMainMessageTmp(currentUser.id, conversationId)
                    .then(function (messages) {
                        vm.privateMessage = messages.privateMessage;
                        vm.publicMessage  = messages.publicMessage;

                        shouldObfuscateMessage();
                    });

                debouncedSaveMessageTmp = _.debounce(function () {
                    return setMainMessageTmp(currentUser.id, conversationId);
                }, 1000);

                var interlocutor       = vm.isSender ? conversation.receiver : conversation.sender;
                interlocutor.media     = vm.isSender ? conversation.receiverMedia : conversation.senderMedia;
                interlocutor.fullname  = User.getFullname.call(interlocutor);
                interlocutor.seniority = _displaySeniority(interlocutor.createdDate);
                interlocutor.showPhone = !! parseInt(interlocutor.phonePart, 10);

                vm.interlocutor = interlocutor;
                vm.myMedia      = vm.isSender ? conversation.senderMedia : conversation.receiverMedia;
                vm.conversation = conversation;
                vm.messages     = messages;

                if (conversation.booking) {
                    conversation.booking = Restangular.restangularizeElement(null, conversation.booking, "booking");
                    vm.booking = conversation.booking;
                    vm.isTaker = (vm.booking.takerId === currentUser.id);
                    vm.listingTypeProperties = ListingTypeService.getProperties(vm.booking.listingType);
                }

                var now = new Date().toISOString();
                _.forEach(messages, function (message) {
                    message.showDisplayDate = !moment(message.createdDate).isSame(now, 'd');
                });

                // Show a toast for contact details obfuscation
                var isLastMessageObfuscated = lastMessage.privateContent && lastMessage.privateContent.indexOf("▒") >= 0; // UTF8 HTML Hex: &#x2592;
                if (isLastMessageObfuscated && lastMessage.senderId === currentUser.id) {
                    ContentService.showNotification({
                        titleKey: 'inbox.contact_details_hidden_title',
                        messageKey: 'inbox.self_contact_details_hidden_message',
                        options: {
                            timeOut: 15000
                        }
                    });
                } else if (isLastMessageObfuscated && lastMessage.receiverId === currentUser.id) {
                    ContentService.showNotification({
                        titleKey: 'inbox.contact_details_hidden_title',
                        messageKey: 'inbox.self_contact_details_hidden_message',
                        messageValues: {
                            interlocutorName: vm.interlocutor.firstname || vm.interlocutor.fullname
                        },
                        options: {
                            timeOut: 15000
                        }
                    });
                }

                vm.hasBankAccount = bankAccounts.length;

                _populateMessageCTA();
                _setCountdown();

                return $q.all({
                        listing: ListingService.get(vm.conversation.listingId, { snapshot: true }), // take listing snapshot if needed (deleted listing)
                        isLoggedAs: UserService.isLoggedAs(currentUser)
                    })
                    .then(function (results) {
                        var listing   = results.listing;
                        isLoggedAs = results.isLoggedAs;

                        if (! listing.snapshot) {
                            return ListingService.getLocations(vm.conversation.listingId)
                                .then(function (listingLocations) {
                                    return {
                                        listing: listing,
                                        listingLocations: listingLocations
                                    };
                                });
                        } else {
                            return {
                                listing: listing,
                                listingLocations: []
                            };
                        }
                    });
            }).then(function (results) {
                var listing = results.listing;

                // Give appropriate listing info in conversation
                vm.listingLocations = results.listingLocations;

                listing.owner.fullname = User.getFullname.call(listing.owner);

                _.forEach(vm.listingLocations, function (location) {
                    location.displayAddress = map.getPlaceName(location);
                });

                ListingService.populate(listing, {
                    locations: results.listingLocations
                });

                vm.listing = listing;
                vm.isOwner = (listing.ownerId === currentUser.id);

                var updateArgs = {};
                if (vm.isSender) {
                    updateArgs.senderRead = true;
                } else if (vm.isReceiver) {
                    updateArgs.receiverRead = true;
                } else {
                    return $q.reject(new Error("Not a member of conversation")); // just in case
                }

                return (! isLoggedAs && conversation.markAsRead(updateArgs));
            }).then(function (/*updatedConversation*/) {
                if ((vm.isSender && conversation.senderRead === false)
                 || (vm.isReceiver && conversation.receiverRead === false)
                ) {
                    $rootScope.$emit("refreshMessagesBadge"); // to update header badge
                }
                return $q.when(true);
            });
        }

        function _populateMessageCTA(messages) {
            var msgs = _.sortByOrder(vm.messages || messages, "createdDate", "desc");

            // Do not replicate original cta if associated message is not far below
            // Can happen when several messages have been sent in conversation before active (pre-)booking
            vm.duplicateCtaOffset = 0;

            _.forEach(msgs, function (message, index) {
                if (index > 0 && ! vm.showDuplicateActionMessage) {
                    vm.duplicateCtaOffset++;
                }
                if (! message.booking) {
                    return;
                }

                message.booking     = Restangular.restangularizeElement(null, message.booking, "booking");
                message.isTaker     = (message.booking.takerId === currentUser.id);
                message.isOwner     = (message.booking.ownerId === currentUser.id);
                message.isCtaActive = (message.booking.id === vm.booking.id);

                vm.ownerActionRequired = ! vm.booking.acceptedDate && ! vm.booking.cancellationId && message.isOwner;
                vm.takerActionRequired = ! vm.booking.paidDate && message.isTaker;
                vm.bankAccountMissing  = vm.booking.takerPrice && message.isOwner && ! vm.hasBankAccount;

                vm.actionRequired = vm.takerActionRequired || vm.ownerActionRequired || vm.bankAccountMissing;

                if ((! vm.duplicateActionMessage || ! vm.showDuplicateActionMessage)
                 && message.bookingStatus
                 && message.isCtaActive
                ) {
                    vm.duplicateActionMessage = message;
                }

                vm.showDuplicateActionMessage = vm.actionRequired;
            });
        }

        function _populateAssessments() {
            var input  = {};
            var output = {};

            if (!conversation.booking) return;

            // only show ratings if there is no assessments
            if (vm.listingTypeProperties.isAssessmentNone) {
                return RatingService.getFromBooking(conversation.bookingId)
                    .then(function (ratings) {
                        input.showRatingsOnly = true;
                        input.ratings = ratings;

                        vm.assessmentInput = input;
                        vm.showAssessment = true;
                    });
            }

            // stop the process if there is no assessment ids
            if (! conversation.inputAssessmentId && ! conversation.outputAssessmentId) {
                return;
            }

            return AssessmentService.getAssociatedToConversation(conversation.id)
                .then(function (conversationAssessments) {
                    var inputAssessment        = conversationAssessments.inputAssessment;
                    var outputAssessment       = conversationAssessments.outputAssessment;
                    var beforeInputAssessment  = conversationAssessments.beforeInputAssessment;
                    var beforeOutputAssessment = conversationAssessments.beforeOutputAssessment;

                    if (inputAssessment) {
                        input.assessment         = inputAssessment;
                        input.previousAssessment = beforeInputAssessment;

                        input.showForm = !! inputAssessment.signedDate
                            || AssessmentService.getRealGiverId(inputAssessment) === currentUser.id;
                    }
                    if (outputAssessment) {
                        output.assessment         = outputAssessment;
                        output.previousAssessment = inputAssessment || beforeOutputAssessment;

                        output.showForm = !! outputAssessment.signedDate
                            || AssessmentService.getRealGiverId(outputAssessment) === currentUser.id;
                    }

                    var showRating = (input.showForm && inputAssessment && !!inputAssessment.signedDate)
                        || (output.showForm && outputAssessment && !!outputAssessment.signedDate);

                    if (showRating) {
                        return RatingService.getFromBooking(conversation.bookingId);
                    }
                })
                .then(function (ratings) {
                    if (output.assessment) {
                        output.ratings = ratings;
                    } else if (input.assessment && vm.listingTypeProperties.isAssessmentOneStep) {
                        input.ratings = ratings;
                    }

                    var isTaker = input.assessment && input.assessment.takerId && (input.assessment.takerId === currentUser.id);
                    // Do not show assessment to taker if booking has not been paid yet to improve conversion
                    if (isTaker && ! _.find(messages, function (message) {
                        return (message.booking && message.booking.paidDate);
                    })) {
                        vm.showAssessment = false;
                    } else {
                        vm.showAssessment = true;
                    }

                    if (vm.listingTypeProperties.isAssessmentTwoSteps) {
                        input.stepType = 'start';
                        output.stepType = 'end';
                    }

                    vm.assessmentInput  = input;
                    vm.assessmentOutput = output;
                });
        }

        function _setCountdown() {
            if (! (vm.booking
             && vm.booking.paidDate
             && vm.booking.takerId !== currentUser.id
             && (vm.conversation.agreementStatus === "pending" || vm.conversation.agreementStatus === "pending-giver")
            )) {
                vm.countdown = null;
                $interval.cancel(countdownInterval);
                return;
            }

            var countdown, showWarning, isImpending, hours, minutes, seconds;

            countdownInterval = $interval(function () {
                var targetDate = moment(vm.booking.paidDate).add(36, "h");
                var timeLeft   = targetDate.diff();

                var secondsLeft = timeLeft / 1000;


                if (secondsLeft > 0) {
                    hours = Math.floor(secondsLeft / 3600);
                    secondsLeft = secondsLeft % 3600;

                    minutes = Math.floor(secondsLeft / 60);
                    seconds = Math.floor(secondsLeft % 60);

                    countdown = tools.fillByCharacter(hours, 2) + ":"
                     + tools.fillByCharacter(minutes, 2) + ":"
                     + tools.fillByCharacter(seconds, 2);
                } else if (secondsLeft >= -43200) { // 12 hours more to accept
                    countdown = "";
                    showWarning = true;
                    isImpending = true;
                } else if (secondsLeft < -43200) {
                    countdown = "";
                    showWarning = true;
                    isImpending = false;
                }

                vm.countdown = {
                    text: countdown,
                    showWarning: showWarning,
                    isImpending: isImpending
                };
            }, 1000);

            intervals.push(countdownInterval);
        }

        function acceptBooking(message, booking, afterAcceptance) {
            if (! message && ! _.find(vm.messages, { senderId: vm.conversation.receiverId })) {
                // Force user to leave a message if no answer yet
                ContentService.showNotification({
                    titleKey: 'inbox.missing_message_title',
                    messageKey: 'inbox.missing_message_message',
                    type: 'warning'
                });
                afterAcceptance("missingMessage"); // must stop spinner
                return;
            }
            var messageCreateAttrs;
            var conversationUpdateAttrs;

            if (message) {
                messageCreateAttrs = {
                    conversationId: conversationId,
                    privateContent: message,
                    bookingId: booking.id,
                    receiverId: vm.interlocutor.id,
                    senderId: currentUser.id,
                    listingId: vm.listing.id,
                    agreementStatus: "agreed"
                };
            } else {
                conversationUpdateAttrs = {
                    bookingId: booking.id,
                    agreementStatus: "agreed",
                    senderRead: false
                };
            }

            return $q.when(true)
                .then(function () {
                    // TODO: look why the booking model isn't correctly restangularized
                    return booking.customPOST({ userMessage: messageCreateAttrs }, "accept");
                })
                .then(function (b) {
                    booking.acceptedDate = b.acceptedDate;

                    ContentService.showNotification({
                        titleKey: 'inbox.booking_acceptance_success_title',
                        messageKey: 'inbox.booking_acceptance_success_message',
                        type: 'success',
                        options: {
                            timeOut: 0,
                            closeButton: true
                        }
                    });

                    if (_.isEmpty(messageCreateAttrs)) { // manual update needed when no message is created
                        return vm.conversation.updateMeta(conversationUpdateAttrs);
                    }
                })
                .finally(function () {
                    afterAcceptance("ok");
                    // Always send Google Analytics since user is engaged
                    var gaLabel = '{bookingId: ' + booking.id
                     + ', status: "acceptBooking"'
                     + '}';
                    ga('send', 'event', 'Listings', 'BookingValidation', gaLabel);

                    return _populateConversation()
                        .then(function () {
                            return _populateAssessments();
                        })
                        .catch(function (err) {
                            var messageKey = 'error.unknown_happened_message';
                            if (booking.acceptedDate && booking.paidDate) {
                                messageKey = 'inbox.error_refresh_page_message';
                            }

                            ContentService.showNotification({
                                titleKey: 'error.unknown_happened_title',
                                messageKey: messageKey,
                                type: 'warning'
                            });
                            loggerToServer.error(err);
                        });
                });
        }

        function rejectBooking(message, booking, afterReject) {
            if (! message) {
                ContentService.showNotification({
                    titleKey: 'inbox.missing_message_title',
                    messageKey: 'inbox.missing_message_message',
                    type: 'warning'
                })
                afterReject("missingMessage");
                return;
            }

            var messageCreateAttrs = {
                conversationId: conversationId,
                privateContent: message,
                bookingId: booking.id,
                receiverId: vm.interlocutor.id,
                senderId: currentUser.id,
                listingId: vm.listing.id,
                agreementStatus: "rejected"
            };

            return $q.when(true)
                .then(function () {
                    // TODO: look why the booking model isn't correctly restangularized
                    return booking.customPOST({
                        reasonType: "rejected",
                        userMessage: messageCreateAttrs
                    }, "cancel");
                })
                .then(function (b) {
                    booking.cancellationId = b.cancellationId;

                    ContentService.showNotification({
                        messageKey: 'inbox.booking_rejection_success_message',
                        type: 'success',
                        options: {
                            timeOut: 0,
                            closeButton: true
                        }
                    });
                })
                .finally(function () {
                    afterReject();

                    // Always send Google Analytics since user is engaged
                    var gaLabel = '{bookingId: ' + booking.id
                     + ', status: "rejectBooking"'
                     + '}';
                    ga('send', 'event', 'Listings', 'BookingValidation', gaLabel);

                    return _populateConversation()
                        .catch(function (err) {
                            ContentService.showNotification({
                                titleKey: 'unknown_happened_title',
                                messageKey: 'unknown_happened_message',
                                type: 'warning'
                            });
                            loggerToServer.error(err);
                        });
                });
        }

        function sendMessage(manualMessages, afterMessage) {
            // Allow to bypass view textareas (cta-box directive)
            manualMessages = _.defaults(manualMessages || {}, { privateMessage: "", publicMessage: "" });

            if (afterMessage && ! manualMessages.privateMessage && ! manualMessages.publicMessage) {
                ContentService.showNotification({
                    titleKey: 'inbox.missing_message_title',
                    messageKey: 'inbox.missing_message_message'
                });
                afterMessage("missingMessage");
                return;
            } else if (! vm.privateMessage && ! vm.publicMessage && ! manualMessages.privateMessage && ! manualMessages.publicMessage) {
                ContentService.showNotification({
                    titleKey: 'inbox.missing_message_title',
                    messageKey: 'inbox.missing_message_message'
                });
                return;
            }

            if (vm.sendingMessage) {
                return;
            } else {
                vm.sendingMessage = true;
            }

            var createAttrs = {
                conversationId: conversationId,
                privateContent: vm.privateMessage || manualMessages.privateMessage || null,
                publicContent: vm.publicMessage || manualMessages.publicMessage || null,
                startDate: vm.conversation.startDate ? moment(vm.conversation.startDate).format(formatDate) : null, // keep same dates
                endDate: vm.conversation.endDate ? moment(vm.conversation.endDate).format(formatDate) : null,
                listingId: vm.listing.id,
                receiverId: vm.interlocutor.id,
                senderId: currentUser.id
            };

            var isDuplicate = _.find(messages, function (msg) {
                // notify that duplicate message will not be visible by receiver (even if saved in database)
                var sameDay     = moment().isSame(msg.createdDate, "day");
                var sameContent = (("" + createAttrs.privateContent + createAttrs.publicContent) === ("" + msg.privateContent + msg.publicContent));
                return (sameDay && sameContent);
            });

            MessageService.post(createAttrs)
                .then(function (/*message*/) {
                    vm.privateMessage = null;
                    vm.publicMessage  = null;
                    if (! isDuplicate) {
                        ContentService.showNotification({
                            messageKey: 'inbox.message_sent_success',
                            type: 'success'
                        });
                    } else {
                        ContentService.showNotification({
                            titleKey: 'inbox.message_sent_duplicate_title',
                            messageKey: 'inbox.message_sent_duplicate_message'
                        });
                    }

                    return setMainMessageTmp(currentUser.id, conversation.id);
                })
                .then(function () {
                    if (afterMessage) {
                        afterMessage();
                    }
                    return _populateConversation();
                })
                .catch(function (err) {
                    ContentService.showNotification({
                        titleKey: 'unknown_happened_title',
                        messageKey: 'unknown_happened_message',
                        type: 'warning'
                    });
                    loggerToServer.error(err);
                })
                .finally(function () {
                    vm.sendingMessage = false;
                });
        }

        function resetConversationForm() {
            vm.forms.conversationForm.$setPristine();
            vm.forms.conversationForm.$setUntouched();
        }

        function _displaySeniority(date) {
            return moment(date).format("MMMM YYYY");
        }

        function shouldObfuscateMessage(type) {
            var text = (type === 'private' ? vm.privateMessage : vm.publicMessage);

            var noMessage = ! text;
            var bookingPaid = vm.booking && vm.booking.paidDate;

            if (noMessage || bookingPaid) {
                vm.showShouldObfuscateMessage = false;
            } else {
                vm.showShouldObfuscateMessage = tools.shouldObfuscateMessage(text);
            }
        }

        function saveMessageTmp() {
            return debouncedSaveMessageTmp();
        }

        function getMainMessageTmp(userId, conversationId) {
            return MessageService.getConversationMainMessageTmp(userId, conversationId)
                .then(function (messages) {
                    messages = messages || {};

                    if (! vm.promptPublic) {
                        messages.publicMessage = null;
                    }

                    return messages;
                });
        }

        function setMainMessageTmp(userId, conversationId) {
            var messages = vm.privateMessage || vm.publicMessage ? {
                privateMessage: vm.privateMessage
            } : {};

            if (vm.promptPublic && vm.publicMessage) {
                messages.publicMessage = vm.publicMessage;
            }

            return MessageService.setConversationMainMessageTmp(userId, conversationId, messages);
        }

        function facebookShare() {
            if (! listingShareUrl) {
                return;
            }

            usSpinnerService.spin("share-listing-spinner");

            var stlEventData = {
                tagsIds: vm.listing.tags,
                bookingId: vm.booking && vm.booking.id,
                origin: "conversation",
                isOwner: !! vm.isOwner
            };
            var stlEvent;

            return StelaceEvent.sendEvent("Listing social share", {
                type: "click",
                listingId: vm.listing.id,
                data: stlEventData
            })
            .then(function (stelaceEvent) {
                stlEvent = stelaceEvent;

                ezfb.ui({
                    method: "share",
                    href: listingShareUrl
                }, function (response) {
                    // In Graph API v2.8, response after effective sharing is []
                    if (response && ! response.error_code) { // error corde only for fb authorized users
                        toastr.success("Merci d'avoir partagé\xa0!");
                        stlEventData.success = true;
                        stlEvent.update({ data: stlEventData });
                    }
                });
            })
            .finally(function () {
                usSpinnerService.stop("share-listing-spinner");
            });
        }
    }

})();
