(function () {

    angular
        .module("app.inbox")
        .config(configBlock);

    function configBlock($stateProvider) {
        var appsPath = "/assets/app/apps";
        var appClassName = "inbox";

        $stateProvider
            .state("inbox", {
                url: "/inbox?f&register",
                templateUrl: appsPath + "/inbox/inbox.html",
                controller: "InboxController",
                controllerAs: "vm",
                appClassName: appClassName,
                title: "inbox.page_title"
            })
            .state("conversation", {
                url: "/inbox/:conversationId?register",
                templateUrl: appsPath + "/inbox/conversation.html",
                controller: "InboxConversationController",
                controllerAs: "vm",
                appClassName: appClassName
                // title: see controller
            });
    }

})();
