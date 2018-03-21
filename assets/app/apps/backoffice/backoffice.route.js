(function () {

    angular
        .module("app.backoffice")
        .config(configBlock);

    function configBlock($stateProvider, platformProvider) {
        var appsPath = "/assets/app/apps";
        var appClassName = "backoffice";

        $stateProvider
            .state("backoffice", {
                url: "/backoffice",
                templateUrl: appsPath + "/backoffice/backoffice.html",
                controller: "BackofficeController",
                controllerAs: "vm",
                appClassName: appClassName,
                resolve: platformProvider.getAdminResolve(),
                title: "service.page_title"
            });
    }

})();
