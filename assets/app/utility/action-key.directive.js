(function () {

    angular
        .module("app.utility")
        .directive("sipActionKey", sipActionKey);

    // About tab accessibility guidelines, see https://www.w3.org/TR/WCAG20-TECHS/SCR29.html

    function sipActionKey($timeout) {
        return {
            restrict: "A",
            priority: -1,   // cause out postLink function to execute before native ngClick's
                            // ensuring that we can stop the propagation of the "click" event
                            // before it reaches ngClick's listener
            link: link
        };

        function link(scope, iElement, attrs) {
            var disabled    = false; // Debounce. Use sip-action-once="0" attribute to disable debouncing
            var delay       = 500; // mininum milliseconds between actions
            var customDelay = parseInt(attrs.sipActionOnce, 10);

            if (! isNaN(customDelay)) {
                delay = customDelay;
            }

            scope.$on('$destroy', function () {
                iElement.off();
            });

            iElement.on("keydown", watchActionKey);

            function watchActionKey(event) {
                var watchKey = parseInt(attrs.sipActionKeyNumber, 10) || 13;
                // Enter is default key code. If listening for special keys combinations such as alt+, should also listen to keypress event
                // See http://unixpapa.com/js/key.html and http://stackoverflow.com/questions/17470790/how-to-use-a-keypress-event-in-angularjs
                var key = typeof event.which === "undefined" ? event.keyCode : event.which;

                if (key === watchKey) {
                    if (disabled) {
                        event.stopImmediatePropagation();
                    } else {
                        disabled = true;
                        $timeout(function () { disabled = false; }, delay, false);

                        scope.$evalAsync(attrs.sipActionKey || attrs.ngClick);
                    }

                   event.preventDefault();
               }
            }

        }
    }

})();
