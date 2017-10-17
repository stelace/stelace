(function () {

    angular
        .module("app.data")
        .factory("Message", Message);

    function Message() {
        var service = {};
        service.mixInto    = mixInto;
        service.markAsRead = markAsRead;
        service.updateMeta = updateMeta;

        return service;



        function mixInto(obj) {
            return angular.extend(obj, this);
        }

        function markAsRead(args) {
            args = args || {};
            return this.customPUT(args, "mark-read");
                // .then(function (updatedConversation) {
                //     return updatedConversation.plain();
                // });
        }

        function updateMeta(args) {
            args = args || {};
            return this.customPUT(args, "update-meta");
                // .then(function (updatedConversation) {
                //     return updatedConversation.plain();
                // });
        }

    }

})();
