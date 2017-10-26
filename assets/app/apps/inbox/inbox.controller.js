/* global moment */

(function () {

    angular
        .module("app.inbox")
        .controller("InboxController", InboxController);

    function InboxController($interval,
                                $q,
                                $rootScope,
                                $scope,
                                $stateParams,
                                AssessmentService,
                                MessageService,
                                StelaceEvent,
                                tools,
                                User,
                                UserService) {
        var listeners = [];
        var intervals = [];
        var currentUser;
        var activated;

        var vm = this;
        vm.statusMap = {
            "automatic": "Accepté",
            "agreed": "Accepté",
            "rejected": "Rejeté",
            "rejected-by-other": "Rejeté",
            "pending": "En attente",
            "pending-giver": "En attente",
            "cancelled": "Annulé",
            "recall": "Rappel"
        };


        activate();



        function activate() {
            moment.locale("fr");

            if (typeof $stateParams.f !== "undefined") {
                if ($stateParams.f === "t") { // transactions that require user attention (bookingId)
                    vm.filter = "transactions";
                }
            }

            // Avoid two refreshes on app load
            var throttledRefresh = _.throttle(_refreshInbox, 5000, { "trailing": false });

            throttledRefresh();

            listeners.push(
                $rootScope.$on("refreshInbox", function () {
                    throttledRefresh();
                })
            );
            $scope.$on("$destroy", function () {
                _.forEach(listeners, function (listener) {
                    listener();
                });
                _.forEach(intervals, function (interval) {
                    $interval.cancel(interval);
                });
                throttledRefresh.cancel();
            });
        }

        function _displayDate(date) {
            return moment(date).format("Do MMMM");
        }

        function _refreshInbox() {
            var uxEventData;

            return UserService.getCurrentUser()
                .then(function (user) {
                    currentUser = user;
                    return MessageService.getConversations({ userId: user.id });
                }).then(function (conversations) {
                    MessageService.populate(conversations, currentUser);

                    if (! conversations.length) {
                        vm.noConversation = true;
                    }

                    _.forEach(conversations, function (conversation) {
                        populateConversation(conversation);
                    });

                    if (vm.filter) {
                        conversations = _.filter(conversations, function (conv) {
                            if (vm.filter === "transactions") {
                                return conv.bookingId;
                            } else {
                                return true;
                            }
                        });
                    }

                    // TODO : sort by a new custom updatedDate, only updated when new content in conversation
                    vm.conversations = _.sortByOrder(conversations, ["isNewMessage", "newContentDate"], ["desc", "desc"]);

                    if (! activated) {
                        uxEventData = { nbConversations: vm.conversations.length };
                        if (vm.filter) {
                            uxEventData.filter = vm.filter;
                        }
                        StelaceEvent.sendEvent("Inbox view", {
                            data: uxEventData
                        });
                        activated = true;
                    }
                });



            function populateConversation(conversation) {
                if (conversation.inputAssessmentId) {
                    if (conversation.inputAssessment.signedDate) {
                        conversation.signedAssessment = true;
                    }
                    // Manage cancelled status
                    if (conversation.inputAssessment.cancellationId
                     && ! conversation.outputAssessment
                     && conversation.agreementStatus !== "rejected"
                    ) {
                        conversation.agreementStatus = "cancelled";
                    }
                }
                if (conversation.outputAssessmentId) {
                    if (conversation.outputAssessment.signedDate) {
                        conversation.signedAssessment = true;
                    } else {
                        conversation.signedAssessment = false;
                    }
                }

                // TODO: ratings (to prompt user if needed)

                var interlocutor      = (currentUser.id === conversation.senderId) ? conversation.receiver : conversation.sender;
                var interlocutorMedia = (currentUser.id === conversation.senderId) ? conversation.receiverMedia : conversation.senderMedia;

                interlocutor.fullname          = User.getFullname.call(interlocutor);
                interlocutor.displayName       = interlocutor.firstname || interlocutor.fullname;
                conversation.interlocutor      = interlocutor;
                conversation.interlocutorMedia = interlocutorMedia;
                conversation.lastDateString    = _displayDate(conversation.newContentDate);

                if (conversation.startDate && conversation.endDate) {
                    conversation.bookingDates = (conversation.startDate !== conversation.endDate)
                     ? _displayDate(conversation.startDate) + ' - ' + _displayDate(conversation.endDate) : _displayDate(conversation.endDate);
                }

                var isSender   = currentUser.id === conversation.senderId;
                var isReceiver = currentUser.id === conversation.receiverId;

                if ((isSender && conversation.senderRead === false)
                 || (isReceiver && conversation.receiverRead === false)
                ) {
                    conversation.isNewMessage = true;
                } else {
                    conversation.isNewMessage = false;
                }

                // Warn user when action is required
                if ((conversation.agreementStatus === 'pending' && moment(conversation.startDate).add(3, "days").isAfter()) // (booking startDate not older than 2 days)
                 || (conversation.agreementStatus === 'pending-giver' && ! conversation.answerDelay) // require an answer
                ) {
                    conversation.statusWarning = true;
                }

                _setCountdown(conversation);
            }
        }

        function _setCountdown(conversation) {
            if (! (conversation.booking
             && conversation.booking.paidDate
             && conversation.booking.takerId !== currentUser.id
             && (conversation.agreementStatus === "pending" || conversation.agreementStatus === "pending-giver")
            )) {
                conversation.countdown = null;
                $interval.cancel(conversation.countdownInterval);
                return;
            }

            var countdown, hours, minutes, seconds;

            conversation.countdownInterval = $interval(function () {
                var targetDate = moment(conversation.booking.paidDate).add(36, "h");
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
                    conversation.countdownWarning = "Annulation imminente";
                } else if (secondsLeft < -43200) {
                    countdown = "";
                    conversation.countdownWarning = "";
                }

                conversation.countdown = countdown;
            }, 1000);

            intervals.push(conversation.countdownInterval);
        }

    }

})();
