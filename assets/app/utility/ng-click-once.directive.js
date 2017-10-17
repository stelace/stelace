(function () {

    angular
        .module("app.utility")
        .directive("ngClick", ngClick);

        // WARNING: throttle clicks on all ng-click elements duplicate actions
        // Use sip-click-once="0" to disable this behaviour on element with ng-click attribute
        // Enough for non AJAX related clicks (in this case, add timed ng-disabled and spinner in controller)

        // Directive inspired by https://github.com/angular/angular.js/issues/9826

    function ngClick($timeout) {
        return {
            restrict: "A",
            priority: -1,   // cause out postLink function to execute before native ngClick's
                            // ensuring that we can stop the propagation of the "click" event
                            // before it reaches ngClick's listener
            link: link
        };

        function link(scope, element, attrs) {
            var disabled    = false;
            var delay       = 500; // mininum milliseconds between effective clicks
            var customDelay = parseInt(attrs.sipClickOnce, 10);

            if (! isNaN(customDelay)) {
                delay = customDelay;
            }

            scope.$on("$destroy", function () {
                element.off("click", onClick);
            });

            element.on("click", onClick);

            function onClick(evt) {
                if (disabled) {
                    evt.preventDefault();
                    evt.stopImmediatePropagation();
                } else {
                    disabled = true;
                    $timeout(function () { disabled = false; }, delay, false);
                }
            }

        }
    }

})();
