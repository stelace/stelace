(function () {

    angular
        .module("app.items")
        .config(configBlock);

    function configBlock($stateProvider) {
        var appsPath = "/assets/app/apps";
        var appClassName = "items";

        var itemStateConfig = {
            url: "/s",
            urlWithoutParams: "/s",
            templateUrl: appsPath + "/items/item-search.html",
            controller: "ItemSearchController",
            controllerAs: "vm",
            appClassName: appClassName,
            noAuthNeeded: true
        };

        $stateProvider
            .state("itemCreate", {
                url: "/item/new?t", // listing type sell or rent
                urlWithoutParams: "/item/new",
                templateUrl: appsPath + "/items/my-items.html",
                controller: "MyItemsController",
                controllerAs: "vm",
                appClassName: "landings",
                noAuthNeeded: true,
                metaTags: {
                    description: "Publiez gratuitement votre annonce de location en quelques clics. Bricolage, High-Tech, Electroménager..."
                },
                title: "Louez vos objets entre particuliers sur Sharinplace"
            })
            .state("myItems", {
                url: "/my-items",
                urlWithoutParams: "/my-items",
                templateUrl: appsPath + "/items/my-items.html",
                controller: "MyItemsController",
                controllerAs: "vm",
                appClassName: "landings",
                noAuthNeeded: true,
                title: "Mes objets - Sharinplace"
            })
            .state("editItem", {
                url: "/my-items/:id",
                templateUrl: appsPath + "/items/my-items.html",
                controller: "MyItemsController",
                controllerAs: "vm",
                appClassName: "landings",
                noAuthNeeded: true,
                title: "Modifier une annonce - Sharinplace"
            })
            .state("item", {
                url: "/item/:slug",
                urlWithoutParams: "/item",
                templateUrl: appsPath + "/items/item-view.html",
                controller: "ItemViewController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true
            })
            .state("search", _.defaults({
                url: "/s?page&l&qm&t&free&reset"
            }, itemStateConfig))
            .state("searchWithQuery", _.defaults({
                url: "/s/:query?page&l&qm&t&free&reset&q"
            }, itemStateConfig));
    }

})();
