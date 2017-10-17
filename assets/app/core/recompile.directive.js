(function () {

    angular
        .module("app.core")
        .directive("kcdRecompile", kcdRecompile);

    function kcdRecompile($compile, $parse) {
        var template;

        return {
            scope: true,
            compile: compile
        };

        function compile(el) {
            template = getElementAsHtml(el);
            return link;
        }

        function link(scope, $el, attrs) {
            var nested = attrs.hasOwnProperty('nested');

            var stopWatching = scope.$parent.$watch(attrs.kcdRecompile, function (_new, _old) {
                var useBoolean = attrs.hasOwnProperty('useBoolean');
                if ((useBoolean && (!_new || _new === 'false')) || (!useBoolean && (!_new || _new === _old))) {
                    return;
                }
                // reset kcdRecompile to false if we're using a boolean
                if (useBoolean) {
                    $parse(attrs.kcdRecompile).assign(scope.$parent, false);
                }

                // recompile
                var newEl = $compile(template)(scope.$parent);
                $el.replaceWith(newEl);

                // Destroy old scope, reassign new scope.
                stopWatching();
                scope.$destroy();
            }, nested);
        }

        function getElementAsHtml(el) {
            return angular.element('<a></a>').append(el.clone()).html();
        }
    }

})();
