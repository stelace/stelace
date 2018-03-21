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
                noAuthNeeded: true,
                title: 'pages.user_profile.page_title',
                metaTags: {
                    description: 'pages.user_profile.meta_description'
                }
            })
            .state("userMe", {
                url: "/user",
                templateUrl: appsPath + "/users/public-profile.html",
                controller: "PublicProfileController",
                controllerAs: "vm",
                appClassName: appClassName,
                title: 'pages.user_profile.page_title',
                metaTags: {
                    description: 'pages.user_profile.meta_description'
                }
            })
            .state("account", {
                url: "/home",
                templateUrl: appsPath + "/users/account.html",
                controller: "AccountController",
                controllerAs: "vm",
                appClassName: appClassName,
                title: 'user.account.page_title'
            });
    }

})();
