/* global moment*/

(function () {

    angular
        .module("app.widgets")
        .directive("sipRating", sipRating);

    function sipRating() {
        return {
            restrict: "EA",
            scope: {
                rating: "=",
                isCurrent: "=?",
                last: "=?" // ng-repeat boolean to hide last <hr>
            },
            templateUrl: "/assets/app/widgets/rating/rating.html",
            link: link
        };

        function link(scope/*, element, attrs*/) {
            scope.displayMonth = moment(scope.rating.createdDate).format("MMMM YYYY");
            if (scope.isCurrent) {
                scope.itemprop = "review";
                scope.isoDate  = moment(scope.rating.createdDate).format("YYYY-MM-DD");
            }
        }
    }

})();
