(function () {

    angular
        .module("app.widgets")
        .directive("sipItemCard", sipItemCard);

    function sipItemCard() {
        return {
            restrict: "EA",
            scope: {
                item: "=",
                isMyItem: "=",
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
        //     if (scope.target === "true" && scope.item) {
        //         var cardLinkElement = angular.element(element.children()[0]);
        //         var targetName = 'sip-item_' + scope.item.id;
        //         cardLinkElement.attr("target", targetName);
        //     }
        // }
    }

})();
