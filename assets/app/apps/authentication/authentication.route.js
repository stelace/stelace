(function () {

    angular
        .module("app.authentication")
        .config(configBlock);

    function configBlock($stateProvider) {
        var appsPath = "/assets/app/apps";
        var appClassName = "authentication";

        $stateProvider
            .state("register", {
                url: "/register?redirect",
                urlWithoutParams: "/register",
                templateUrl: appsPath + "/authentication/register.html",
                controller: "RegisterController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true,
                title: "authentication.sign_up_greeting"
            })
            .state("login", {
                url: "/login?redirect&error",
                urlWithoutParams: "/login",
                templateUrl: appsPath + "/authentication/login.html",
                controller: "LoginController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true,
                title: "authentication.log_in_button"
            })
            .state("socialAuth", {
                url: "/social-auth",
                controller: "SocialAuthController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true
            })
            .state("lostPassword", {
                url: "/lost-password",
                templateUrl: appsPath + "/authentication/lost-password.html",
                controller: "LostPasswordController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true,
                title: "authentication.lost_password_button"
            })
            .state("recoveryPassword", {
                url: "/recovery-password/:tokenId/:tokenValue",
                templateUrl: appsPath + "/authentication/recovery.html",
                controller: "RecoveryController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true,
                metaTags: {
                    robots: "noindex"
                },
                title: "authentication.lost_password_button"
            })
            .state("emailCheck", {
                url: "/email-check",
                controller: "EmailCheckController",
                controllerAs: "vm",
                noAuthNeeded: true
            });
    }

})();
