(function () {

    angular
        .module("app.landings")
        .config(configBlock);

    function configBlock($stateProvider) {
        var appsPath = "/assets/app/apps";
        var appClassName = "landings";

        $stateProvider
            .state("home", {
                url: "/",
                templateUrl: appsPath + "/landings/home.html",
                controller: "HomeController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true,
                title: "landing.homepage.title",
                metaTags: {
                    description: "landing.homepage.meta_description"
                },
            })
            .state("terms", {
                url: "/terms",
                templateUrl: appsPath + "/landings/terms.html",
                controller: "TermsController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true,
                title: "Conditions Générales de Services et d'Utilisation - Sharinplace"
            })
            .state("404", {
                url: "/404",
                templateUrl: appsPath + "/landings/app404.html",
                controller: "App404Controller",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true,
                metaTags: {
                    robots: "noindex"
                },
                title: "Page introuvable :( - Sharinplace"
            })
            .state("contact", {
                url: "/contact",
                templateUrl: appsPath + "/landings/contact.html",
                controller: "ContactController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true,
                title: "Contactez l'équipe Sharinplace"
            })
            .state("help", {
                url: "/help",
                templateUrl: appsPath + "/landings/help.html",
                controller: "HelpController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true,
                title: "Questions fréquentes - Sharinplace"
            })
            .state("friendReferral", {
                url: "/friend/:slug?s",
                urlWithoutParams: "/friend",
                templateUrl: appsPath + "/landings/friend-referral.html",
                controller: "FriendReferralController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true,
                metaTags: {
                    robots: "noindex"
                },
                title: "Votre parrain vous offre des cadeaux Sharinplace"
            })
            .state("invite", {
                url: "/invite",
                urlWithoutParams: "/invite",
                templateUrl: appsPath + "/landings/invite.html",
                controller: "InviteController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true,
                title: "Obtenez des récompenses en parrainant vos amis sur Sharinplace"
            });
    }

})();
