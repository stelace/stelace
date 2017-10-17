(function () {

    angular
        .module("app.widgets")
        .directive("sipPromptImage", sipPromptImage);

    function sipPromptImage() {
        return {
            restrict: "EA",
            scope: {
            },
            templateUrl: "/assets/app/widgets/prompt-image/prompt-image.html",
            controller: "PromptImageController",
            controllerAs: "vm"
        };

    }

})();
