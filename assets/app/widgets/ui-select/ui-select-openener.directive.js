// See https://github.com/angular-ui/ui-select/issues/428

(function () {

    angular
        .module("app.widgets")
        .directive("uiSelectOpener", uiSelectOpenOpener);

    function uiSelectOpenOpener($timeout) {
        return {
            require: "uiSelect",
            restrict: "A",
            link: link
        };

        function link($scope, el, attrs, uiSelect) {
            var prefix = attrs.uiSelectOpener; // Optional, to avoid conflicts in parent scope

            $scope.$on(prefix + "UiSelectOpen", function () {
                $timeout(function () {
                    uiSelect.activate();
                });
            });

            $scope.$on(prefix + "UiSelectClose", function () {
                $timeout(function () {
                    uiSelect.close();
                });
            });
        }
    }

})();
