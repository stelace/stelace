(function () {

    angular
        .module("app.utility")
        .directive("sipImgonload", sipImgonload);

    function sipImgonload() {
        return {
            restrict: "A",
            link: link
        };

        function link(scope, element, attrs) {
           element.bind("load", function () {
                // call the function passed by scope
                scope.$evalAsync(attrs.imageonload);
            });
        }
    }

})();
