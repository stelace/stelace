(function () {

    angular
        .module("app.utility")
        .directive("clickNotHere", clickNotHere);

    function clickNotHere($document) {
        return {
            restrict: "A",
            link: link
        };

        function link(scope, element, attrs) {
            var bounds;
            var excludedContainers;

            if (attrs.clickNotHereBoundsId) {
                bounds = $document[0].getElementById(attrs.clickNotHereBoundsId);
            }
            if (attrs.clickNotHereExcludeClass) {
                excludedContainers = $document[0].getElementsByClassName(attrs.clickNotHereExcludeClass);
            }

            bounds = (bounds && angular.element(bounds)) || $document;

            bounds.on("click", handler);

            scope.$on("$destroy", function () {
                bounds.off("click", handler);
                bounds = null;
                excludedContainers = null;
            });

            function handler(event) {
                if (attrs.clickNotHereExcludeClass) {
                    excludedContainers = $document[0].getElementsByClassName(attrs.clickNotHereExcludeClass);
                }

                var isExcluded = _.reduce(excludedContainers, function (containsTarget, excluded) {
                    return containsTarget || excluded.contains(event.target);
                }, false);

                if (! element[0].contains(event.target) && ! isExcluded) {
                    // use $evalAsync instead of $apply
                    // because digest cycle may already be in progress
                    scope.$evalAsync(attrs.clickNotHere);
                 }
            }
        }
    }

})();
