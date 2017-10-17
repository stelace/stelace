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
                metaTags: {
                    description: "Trouvez l'objet qui vous plaît près de chez vous, ou louez vos propres objets à d'autres particuliers en toute sécurité sur Sharinplace."
                },
                title: "Inscription ou connexion à Sharinplace"
            })
            .state("login", {
                url: "/login?redirect&error",
                urlWithoutParams: "/login",
                templateUrl: appsPath + "/authentication/login.html",
                controller: "LoginController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true,
                metaTags: {
                    description: "Connectez-vous pour acheter ou louer les objets qui vous plaisent près de chez vous, ou vendez et louez vos propres objets à d'autres particuliers en un éclair sur Sharinplace."
                },
                title:  "Connexion ou inscription à Sharinplace"
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
                metaTags: {
                    description: "Vous avez oublié votre mot de passe Sharinplace? Créez un nouveau mot de passe en quelques secondes."
                },
                title: "Mot de passe oublié - Sharinplace"
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
                title: "Mot de passe oublié - Sharinplace"
            })
            .state("emailCheck", {
                url: "/email-check",
                controller: "EmailCheckController",
                controllerAs: "vm",
                noAuthNeeded: true
            });
    }

})();
