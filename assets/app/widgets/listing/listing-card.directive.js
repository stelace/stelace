(function () {

    angular
        .module("app.widgets")
        .directive("stelaceListingCard", stelaceListingCard);

    function stelaceListingCard() {
        return {
            restrict: "EA",
            scope: {
                listing: "=",
                onDelete: "=",
                displayDuration: "@",
                locname: "@",
                // target: "@",
                position: "@"
            },
            templateUrl: "/assets/app/widgets/listing/listing-card.html",
            controller: "ListingCardController",
            controllerAs: "vm"
            // link: link
        };

        // function link(scope, element/*, attrs */) {
        //     // Add target (new tab) attribute in search only
        //     if (scope.target === "true" && scope.listing) {
        //         var cardLinkElement = angular.element(element.children()[0]);
        //         var targetName = 'stelace-listing_' + scope.listing.id;
        //         cardLinkElement.attr("target", targetName);
        //     }
        // }
    }

})();
