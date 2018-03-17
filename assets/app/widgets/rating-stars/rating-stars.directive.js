(function () {

    angular
        .module("app.widgets")
        .directive("sipRatingStars", sipRatingStars);

    function sipRatingStars($translate) {
        return {
            restrict: "EA",
            scope: {
                userScore: "@",
                userRatings: "@",
                listingScore: "@",
                listingRatings: "@",
                // itemprop: "@", // along with count, affects markup
                name: "@",
                count: "@",
                noTooltip: "@",
                tooltipMsg: "@", // overrides default
                appendToBody: "=" // overflow fix
            },
            templateUrl: "/assets/app/widgets/rating-stars/rating-stars.html",
            link: link
        };

        function link(scope, element/*, attrs */) {
            var listingScore      = parseInt(scope.listingScore, 10);
            var listingRatings    = parseInt(scope.listingRatings, 10);
            var userScore      = parseInt(scope.userScore, 10);
            var userRatings    = parseInt(scope.userRatings, 10);
            var avgRating;
            var listingStars, userStars;

            scope.showCount = (scope.count && scope.count !== "false");

            // var ownerAvgRating = Math.min(userScore / ownerNbRatings, 5);
            if (listingScore && listingRatings) {
                listingStars  = _setStars(listingScore, listingRatings);
            } else if (userScore && userRatings) {
                userStars = _setStars(userScore, userRatings);
            } else if (userScore) { // single listing rating's stars
                listingStars = _setStars(userScore, 1);
            }

            element.addClass("rating-stars");

            scope.avgRating  = (Math.round(avgRating * 10) / 10); // round to first decimal. Used in microdata
            scope.displayAvg = scope.avgRating.toLocaleString();
            scope.nbRatings  = userRatings || 0;

            if (listingStars) {
                scope.stars = listingStars;
                scope.type  = "listing";
            } else if (userStars) {
                scope.stars = userStars;
                scope.type  = "user";
            }


            if (! scope.noTooltip) {
                scope.tooltipMsg = $translate.instant('ratings.ratings_received_including_this_listing', {
                    nb_ratings: userRatings || 0,
                    for_this_listing: listingRatings || undefined
                });
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
