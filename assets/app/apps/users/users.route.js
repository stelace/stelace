(function () {

    angular
        .module("app.users")
        .config(configBlock);

    function configBlock($stateProvider) {
        var appsPath = "/assets/app/apps";
        var appClassName = "users";

        $stateProvider
            .state("user", {
                url: "/user/:id?listingsonly",
                templateUrl: appsPath + "/users/public-profile.html",
                controller: "PublicProfileController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true
            })
            .state("userMe", {
                url: "/user",
                templateUrl: appsPath + "/users/public-profile.html",
                controller: "PublicProfileController",
                controllerAs: "vm",
                appClassName: appClassName
            })
            .state("account", {
                url: "/home",
                templateUrl: appsPath + "/users/account.html",
                controller: "AccountController",
                controllerAs: "vm",
                appClassName: appClassName
            });
    }

})();
