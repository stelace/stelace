(function () {

    angular
        .module("app.widgets")
        .directive("sipMyListingCard", sipMyListingCard);

    function sipMyListingCard() {
        return {
            restrict: "EA",
            scope: {
                item: "=",
                onDelete: "="
            },
            templateUrl: "/assets/app/widgets/item/my-listing-card.html",
            controller: "MyListingCardController",
            controllerAs: "vm"
        };
    }

})();
