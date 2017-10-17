(function () {

    angular
        .module("app.widgets")
        .directive("sipRatingStars", sipRatingStars);

    function sipRatingStars() {
        return {
            restrict: "EA",
            scope: {
                userScore: "@",
                userRatings: "@",
                itemScore: "@",
                itemRatings: "@",
                // itemprop: "@", // along with count, affects markup
                name: "@",
                isMyItem: "@", // idem
                count: "@",
                noTooltip: "@",
                tooltipMsg: "@", // overrides default
                appendToBody: "=" // overflow fix
            },
            templateUrl: "/assets/app/widgets/rating-stars/rating-stars.html",
            link: link
        };

        function link(scope, element/*, attrs */) {
            var itemScore      = parseInt(scope.itemScore, 10);
            var itemRatings    = parseInt(scope.itemRatings, 10);
            var userScore      = parseInt(scope.userScore, 10);
            var userRatings    = parseInt(scope.userRatings, 10);
            var avgRating;
            var itemStars, userStars;

            scope.showCount = (scope.count && scope.count !== "false");

            // var ownerAvgRating = Math.min(userScore / ownerNbRatings, 5);
            if (itemScore && itemRatings) {
                itemStars  = _setStars(itemScore, itemRatings);
            } else if (userScore && userRatings) {
                userStars = _setStars(userScore, userRatings);
            } else if (userScore) { // single item rating's stars
                itemStars = _setStars(userScore, 1);
            }

            element.addClass("rating-stars");

            scope.avgRating  = (Math.round(avgRating * 10) / 10); // round to first decimal. Used in microdata
            scope.displayAvg = scope.avgRating.toLocaleString();
            scope.nbRatings  = userRatings || 0;

            if (itemStars) {
                scope.stars = itemStars;
                scope.type  = "item";
            } else if (userStars) {
                scope.stars = userStars;
                scope.type  = "user";
            }


            if (! scope.noTooltip) {
                var tooltipRole;

                if (scope.isMyItem) {
                    tooltipRole = "Vous\xa0avez";
                } else {
                    tooltipRole = "Le\xa0propriétaire a";
                }

                scope.tooltipMsg = scope.tooltipMsg
                 || ((scope.name || tooltipRole)
                    + "\xa0reçu " + userRatings + "\xa0évaluation"
                    + (userRatings > 1 ?  "s" : "")
                    + (itemScore ? (" dont " + itemRatings + " pour cet objet.") : ".")
                );
            }

            function _setStars(score, nbRatings) {
                avgRating  = Math.min(score / nbRatings, 5);

                var stars = _.times(Math.floor(avgRating) - 1, function () {
                    return "full";
                });

                if (avgRating - stars.length >= 0.75) {
                    stars.push("full");
                } else if (avgRating - stars.length >= 0.25) {
                    stars.push("half");
                }

                return stars;
            }
        }
    }

})();
