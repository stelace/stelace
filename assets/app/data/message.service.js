(function () {

    angular
        .module("app.data")
        .factory("MessageService", MessageService);

    function MessageService($q, Restangular, MediaService, Message, platform, tools) {
        var service = Restangular.all("message");
        service.conversation                  = conversation;
        service.conversationMeta              = conversationMeta;
        service.getPublicMessages             = getPublicMessages;
        service.getConversations              = getConversations;
        service.populate                      = populate;

        service.getBookingPaymentMessageTmp   = getBookingPaymentMessageTmp;
        service.setBookingPaymentMessageTmp   = setBookingPaymentMessageTmp;
        service.getConversationMainMessageTmp = getConversationMainMessageTmp;
        service.setConversationMainMessageTmp = setConversationMainMessageTmp;


        Restangular.extendModel("message", function (obj) {
            return Message.mixInto(obj);
        });

        return service;

        function conversation(conversationId) {
            return service.customGETLIST("conversation", { conversationId: conversationId })
                .then(function (messages) {
                    return messages.plain();
                });
        }

        function conversationMeta(conversationId) {
            return service.customGET("conversation-meta", { conversationId: conversationId })
                .then(function (conversation) {
                    return conversation; // keep restangular methods to update (read status in particular)
                });
        }

        function getPublicMessages(listingId) {
            return service.customGETLIST("listing", { listingId: listingId })
                .then(function (messages) {
                    return messages.plain();
                });
        }

        function getConversations(args) {
            args = args || {}; // bookingId and/or listingId and/or senderId and/or receiverId (use "userId" for (receiver or sender) only)
            return service.customGETLIST("get-conversations", args)
                .then(function (conversations) {
                    return conversations.plain();
                });
        }

        function populate(records/*, user*/) { // conversations or messages
            _.forEach(records, function (record) {
                if (record.senderMedia) {
                    MediaService.setUrl(record.senderMedia);
                } else {
                    record.senderMedia = { url: platform.getDefaultProfileImageUrl() };
                }
                if (record.receiverMedia) {
                    MediaService.setUrl(record.receiverMedia);
                } else {
                    record.receiverMedia = { url: platform.getDefaultProfileImageUrl() };
                }

                // if (user) {
                //     record.interlocutor          = (user.id === record.senderId) ? record.receiver : record.sender;
                //     record.interlocutorMedia     = (user.id === record.senderId) ? record.receiverMedia : record.senderMedia;
                // }
            });
        }

        function getBookingPaymentMessageTmp(bookingId) {
            var prop = "bookingPaymentMessages";
            var key  = bookingId;

            return tools.getLocalData(prop, key);
        }

        function setBookingPaymentMessageTmp(bookingId, messages) {
            var prop = "bookingPaymentMessages";
            var key  = bookingId;

            return tools.setLocalData(prop, key, messages);
        }

        function getConversationMainMessageTmp(userId, conversationId) {
            var prop = "conversationMainMessage";
            var key  = "" + userId + "-" + conversationId;

            return tools.getLocalData(prop, key);
        }

        function setConversationMainMessageTmp(userId, conversationId, message) {
            var prop = "conversationMainMessage";
            var key  = "" + userId + "-" + conversationId;

            return tools.setLocalData(prop, key, message);
        }
    }

})();
