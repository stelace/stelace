(function () {

    angular
        .module("app.widgets")
        .directive("sipItemCard", sipItemCard);

    function sipItemCard() {
        return {
            restrict: "EA",
            scope: {
                listing: "=",
                isMyListing: "=",
                onDelete: "=",
                displayDuration: "@",
                locname: "@",
                // target: "@",
                position: "@"
            },
            templateUrl: "/assets/app/widgets/item/item-card.html",
            controller: "ItemCardController",
            controllerAs: "vm"
            // link: link
        };

        // function link(scope, element/*, attrs */) {
        //     // Add target (new tab) attribute in search only
        //     if (scope.target === "true" && scope.listing) {
        //         var cardLinkElement = angular.element(element.children()[0]);
        //         var targetName = 'sip-item_' + scope.listing.id;
        //         cardLinkElement.attr("target", targetName);
        //     }
        // }
    }

})();
