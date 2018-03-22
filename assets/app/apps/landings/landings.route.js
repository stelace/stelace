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
                title: "pages.homepage.page_title",
                metaTags: {
                    description: "pages.homepage.meta_description"
                },
            })
            .state("terms", {
                url: "/terms",
                templateUrl: appsPath + "/landings/terms.html",
                controller: "TermsController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true,
                title: "pages.terms.page_title"
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
                title: "pages.not_found.page_title"
            })
            .state("contact", {
                url: "/contact",
                templateUrl: appsPath + "/landings/contact.html",
                controller: "ContactController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true,
                title: "pages.contact.page_title"
            })
            .state("help", {
                url: "/help",
                templateUrl: appsPath + "/landings/help.html",
                controller: "HelpController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true,
                title: "pages.help.page_title"
            })
            .state("friendReferral", {
                url: "/friend/:slug?s",
                urlWithoutParams: "/friend",
                templateUrl: appsPath + "/landings/friend-referral.html",
                controller: "FriendReferralController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true,
                title: "pages.friend_referral.page_title",
                metaTags: {
                    robots: "noindex",
                    description: "pages.friend_referral.meta_description"
                }
            })
            .state("invite", {
                url: "/invite",
                urlWithoutParams: "/invite",
                templateUrl: appsPath + "/landings/invite.html",
                controller: "InviteController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true,
                title: "pages.invite.page_title",
                metaTags: {
                    description: "pages.invite.meta_description"
                }
            });
    }

})();
