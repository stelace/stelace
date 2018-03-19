(function () {

    angular
        .module("app.listings")
        .config(configBlock);

    function configBlock($stateProvider) {
        var appsPath = "/assets/app/apps";
        var appClassName = "listings";

        var listingStateConfig = {
            url: "/s",
            urlWithoutParams: "/s",
            templateUrl: appsPath + "/listings/listing-search.html",
            controller: "ListingSearchController",
            controllerAs: "vm",
            appClassName: appClassName,
            noAuthNeeded: true
        };

        $stateProvider
            .state("listingCreate", {
                url: "/listing/new?listingTypeId",
                urlWithoutParams: "/listing/new",
                templateUrl: appsPath + "/listings/my-listings.html",
                controller: "MyListingsController",
                controllerAs: "vm",
                appClassName: "landings",
                noAuthNeeded: true,
                metaTags: {
                    description: "listing.edition.new_listing_meta_description"
                },
                title: "listing.edition.new_listing_title"
            })
            .state("myListings", {
                url: "/my-listings",
                urlWithoutParams: "/my-listings",
                templateUrl: appsPath + "/listings/my-listings.html",
                controller: "MyListingsController",
                controllerAs: "vm",
                appClassName: "landings",
                noAuthNeeded: true,
                title: "Mes objets - Sharinplace"
            })
            .state("editListing", {
                url: "/my-listings/:id",
                templateUrl: appsPath + "/listings/my-listings.html",
                controller: "MyListingsController",
                controllerAs: "vm",
                appClassName: "landings",
                noAuthNeeded: true,
                title: "Modifier une annonce - Sharinplace"
            })
            .state("listing", {
                url: "/listing/:slug",
                urlWithoutParams: "/listing",
                templateUrl: appsPath + "/listings/listing-view.html",
                controller: "ListingViewController",
                controllerAs: "vm",
                appClassName: appClassName,
                noAuthNeeded: true
            })
            .state("search", _.defaults({
                url: "/s?page&l&qm&t&free&reset"
            }, listingStateConfig))
            .state("searchWithQuery", _.defaults({
                url: "/s/:query?page&l&qm&t&free&reset&q"
            }, listingStateConfig));
    }

})();
