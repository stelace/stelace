(function () {

    angular
        .module("app.layout")
        .directive("sipRoot", sipRoot);

    function sipRoot() {
        return {
            priority: 1,
            restrict: "EA",
            replace: true,
            templateUrl: "/assets/app/layout/root.html",
            controller: "RootController",
            controllerAs: "vm"
        };
    }

})();
