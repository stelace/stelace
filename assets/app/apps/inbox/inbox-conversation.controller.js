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
                                            BookingService,
                                            ezfb,
                                            ListingService,
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

        var vm = this;
        vm.duplicateActionMessage     = null;
        vm.showDuplicateActionMessage = false;
        vm.showAssessment             = false;
        vm.forms                      = {};
        vm.showShouldObfuscateMessage = false;

        vm.sendMessage             = sendMessage;
        vm.resetConversationForm   = resetConversationForm;
        vm.displayDate             = displayDate;
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
                                toastr.info("Vous avez un nouveau message.", {
                                    timeOut: 0, // will sitck
                                    closeButton: true
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
                    var title    = "Conversation avec " + (vm.interlocutor.firstname || vm.interlocutor.fullname) + " - Sharinplace";
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
                messages: MessageService.conversation(conversationId)
            }).then(function (results) {
                conversation = results.conversation;
                currentUser  = results.currentUser;
                messages     = results.messages;

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
                }

                // Show a toast for contact details obfuscation
                var isLastMessageObfuscated = lastMessage.privateContent && lastMessage.privateContent.indexOf("▒") >= 0; // UTF8 HTML Hex: &#x2592;
                if (isLastMessageObfuscated && lastMessage.senderId === currentUser.id) {
                    toastr.info("Vos coordonnées sont masquées par mesure de sécurité avant la validation de cette réservation.",
                        "Coordonnées protégées", {
                        timeOut: 15000
                    });
                } else if (isLastMessageObfuscated && lastMessage.receiverId === currentUser.id) {
                    toastr.info("Les coordonnées de " + (vm.interlocutor.firstname || vm.interlocutor.fullname)
                        + " sont masquées par mesure de sécurité avant la validation de cette réservation. Elles vous seront alors transmises par email.",
                        "Coordonnées protégées", {
                            timeOut: 15000
                    });
                }

                vm.hasBankAccount = currentUser.bankAccount;

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

            if ((! conversation.inputAssessmentId
             && ! conversation.outputAssessmentId)
            ) {
                return;
            }

            return AssessmentService
            .getAssociatedToConversation(conversation.id)
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

                input.heading = "État des lieux initial";
                output.heading = "État des lieux final";

                var showRating = (input.showForm && inputAssessment && !!inputAssessment.signedDate)
                    || (output.showForm && outputAssessment && !!outputAssessment.signedDate);
                var bookingId;

                if (showRating) {
                    bookingId = conversation.bookingId;
                }

                return $q.all({
                    inputAssessment: inputAssessment,
                    outputAssessment: outputAssessment,
                    ratings: bookingId ? RatingService.getFromBooking(bookingId) : null
                });
            })
            .then(function (results) {
                var inputAssessment  = results.inputAssessment;
                var outputAssessment = results.outputAssessment;
                var ratings          = results.ratings;

                vm.assessmentInput  = input;
                vm.assessmentOutput = output;

                if (outputAssessment) {
                    output.ratings = ratings;
                } else if (inputAssessment) {
                    // there is no output assessment for purchase booking
                    if (BookingService.isNoTime(vm.booking)) {
                        input.ratings = ratings;
                    }
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

            var countdown, countdownWarning, hours, minutes, seconds;

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
                    countdownWarning = "L'annulation de cette réservation est imminente. Merci d'accepter ou de refuser rapidement "
                     + "la demande de " + vm.interlocutor.fullname + " ou de nous contacter en cas de difficultés.";
                } else if (secondsLeft < -43200) {
                    countdown = "";
                    countdownWarning = "Merci d'accepter ou de refuser rapidement "
                     + "la demande de " + vm.interlocutor.fullname + " ou de nous contacter en cas de difficultés.";
                }

                vm.countdown = {
                    text: countdown,
                    warning: countdownWarning
                };
            }, 1000);

            intervals.push(countdownInterval);
        }

        function acceptBooking(message, booking, afterAcceptation) {
            if (! message && ! _.find(vm.messages, { senderId: vm.conversation.receiverId })) {
                // Force user to leave a message if no answer yet
                toastr.warning("Veuillez saisir un message.");
                afterAcceptation("missingMessage"); // must stop spinner
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

                    toastr.success("Merci ! Nous avons informé " + vm.interlocutor.fullname + " de votre acceptation.",
                        "Demande de réservation acceptée", {
                            timeOut: 0,
                            closeButton: true
                    });

                    if (_.isEmpty(messageCreateAttrs)) { // manual update needed when no message is created
                        return vm.conversation.updateMeta(conversationUpdateAttrs);
                    }
                })
                .finally(function () {
                    afterAcceptation("ok");
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
                            var errMsg = (booking.acceptedDate && booking.paidDate) ? "Veuillez rafraîchir la page pour faire apparaître l'état des lieux."
                             : "Nous sommes désolés et cherchons à résoudre le problème.";
                            toastr.warning(errMsg, "Oups, une erreur est survenue.");
                            loggerToServer.error(err);
                        });
                });
        }

        function rejectBooking(message, booking, afterReject) {
            if (! message) {
                toastr.warning("Veuillez saisir un message.");
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

                    toastr.success("Demande de réservation rejetée", {
                        timeOut: 0,
                        closeButton: true
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
                            toastr.warning("Nous sommes désolés et cherchons à résoudre le problème.", "Oups, une erreur est survenue.");
                            loggerToServer.error(err);
                        });
                });
        }

        function sendMessage(manualMessages, afterMessage) {
            // Allow to bypass view textareas (cta-box directive)
            manualMessages = _.defaults(manualMessages || {}, { privateMessage: "", publicMessage: "" });

            if (afterMessage && ! manualMessages.privateMessage && ! manualMessages.publicMessage) {
                toastr.info("Veuillez rédiger un message avant l'envoi.", "Message vide");
                afterMessage("missingMessage");
                return;
            } else if (! vm.privateMessage && ! vm.publicMessage && ! manualMessages.privateMessage && ! manualMessages.publicMessage) {
                toastr.info("Veuillez rédiger un message avant l'envoi.", "Message vide");
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
                        toastr.success("Message envoyé");
                    } else {
                        toastr.info("Vous avez déjà envoyé un message avec un contenu identique récemment.", "Message déjà envoyé");
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
                    toastr.warning("Nous sommes désolés et cherchons à résoudre le problème.", "Oups, une erreur s'est produite lors de l'envoi");
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

        function displayDate(date) {
            var m = moment(date);
            return (m.isSame(moment(), 'd') ? m.format("HH:mm") : m.format("Do MMMM HH:mm"));
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
