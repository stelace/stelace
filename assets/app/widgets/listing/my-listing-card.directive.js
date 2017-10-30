(function () {

    angular
        .module("app.widgets")
        .directive("stelaceMyListingCard", stelaceMyListingCard);

    function stelaceMyListingCard() {
        return {
            restrict: "EA",
            scope: {
                listing: "=",
                onDelete: "="
            },
            templateUrl: "/assets/app/widgets/listing/my-listing-card.html",
            controller: "MyListingCardController",
            controllerAs: "vm"
        };
    }

})();
