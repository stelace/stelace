(function () {

    angular
        .module("app.inbox")
        .directive("sipCtaBox", sipCtaBox);

    function sipCtaBox() {
        return {
            restrict: "EA",
            scope: {
                message: "=",
                conversation: "=",
                booking: "=",
                countdown: "=",
                interlocutor: "=",
                listing: "=",
                isTaker: "=",
                isOwner: "=",
                onAccept: "=",
                onReject: "=",
                onMessage: "=",
                hasBankAccount: "=",
                bankAccountMissing: "=", // to show appropriate warnings to owner in assessment directive
                publicQuestion: "="
            },
            templateUrl: "/assets/app/apps/inbox/cta-box.html",
            controller: "CtaBoxController",
            controllerAs: "vm",
            bindToController: true
        };
    }

})();
