(function () {

    angular
        .module("app.widgets")
        .directive("stelaceTrustInfo", stelaceTrustInfo);

    function stelaceTrustInfo(StelaceConfig) {
        return {
            restrict: "EA",
            scope: {
                user: "=",
                phonePart: "=" // like ▒▒▒▒▒▒▒▒05
            },
            templateUrl: "/assets/app/widgets/trust-info/trust-info.html",
            link: link
        };

        function link(scope/*, element, attrs*/) {
            scope.isSmsActive = StelaceConfig.isFeatureActive('SMS');
            var user           = scope.user;
            var userAvgRating  = user.nbRatings && Math.min(user.ratingScore / user.nbRatings, 5);
            scope.ratingTrust  = userAvgRating && userAvgRating >= 4;
        }
    }

})();
