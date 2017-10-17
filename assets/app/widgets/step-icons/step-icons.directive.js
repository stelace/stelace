(function () {

    angular
        .module("app.widgets")
        .directive("sipStepIcons", sipStepIcons);

    function sipStepIcons(platform) {
        return {
            restrict: "EA",
            scope: {
                steps: "="
            },
            templateUrl: "/assets/app/widgets/step-icons/step-icons.html",
            link: link
        };

        function link(scope) {
            scope.svgSpritePrefix = platform.getSpriteSvgUrl("");
        }

    }

})();
