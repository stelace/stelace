(function () {

    angular
        .module("app.utility")
        .directive("sipMaxlength", sipMaxlength);

    function sipMaxlength() {
        return {
            restrict: "EA",
            scope: {
                content: "=",
                maxlength: "=",
                threshold: "@"
            },
            templateUrl: "/assets/app/utility/maxlength-count/maxlength-count.html",
            link: link
        };

        function link(scope) {
            scope.maxlength = parseInt(scope.maxlength, 10);
            scope.threshold = (scope.threshold && parseInt(scope.threshold, 10)) || (scope.maxlength / 2);
        }
    }

})();
