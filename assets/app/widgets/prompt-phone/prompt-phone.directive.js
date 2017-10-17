(function () {

    angular
        .module("app.widgets")
        .directive("sipPromptPhone", sipPromptPhone);

    function sipPromptPhone() {
        return {
            restrict: "EA",
            scope: {
            },
            templateUrl: "/assets/app/widgets/prompt-phone/prompt-phone.html",
            controller: "PromptPhoneController",
            controllerAs: "vm"
        };

    }

})();
