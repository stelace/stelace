(function () {

    angular
        .module("app.widgets")
        .directive("sipImg", sipImg);

    function sipImg() {
        return {
            restrict: "EA",
            scope: {
                src: "@",
                alt: "@",
                ratio: "@?", // format "w:h"
                type: "@?",
                radius: "@?",
                rounded: "@?"
            },
            replace: true,
            templateUrl: "/assets/app/widgets/media/img.html",
            link: link
        };

        function link(scope, element /*, attrs */) {
            if (scope.type === "background" || scope.type === "background-contain") {
                element.addClass("-background");
                if (scope.type === "background-contain") {
                    element.addClass("-contain");
                }
                element.empty();

                scope.$watch("src", function (src) {
                    element.css("background-image", "url(" + src + ")");
                });
            } else { // type === "img"
                var ratio = scope.ratio ? scope.ratio.split(":") : "";
                var widthRatio;
                var heightRatio;

                if (ratio.length !== 2) {
                    widthRatio = 1;
                    heightRatio = 1;
                } else {
                    widthRatio  = parseInt(ratio[0], 10) || 1;
                    heightRatio = parseInt(ratio[1], 10) || 1;
                }

                element.addClass("-img");
                element.css("paddingTop", ((heightRatio / widthRatio) * 100) + "%");

                if (scope.radius === "true") {
                    element.addClass("-img--radius");
                }

                // overlay method can fail in webkit...
                if (scope.rounded === "true") {
                    element.addClass("-img--rounded");
                }
            }
        }
    }

})();
