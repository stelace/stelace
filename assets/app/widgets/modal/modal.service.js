(function () {

    angular
        .module("app.widgets")
        .factory("Modal", Modal);

    function Modal($http, $templateCache, $rootScope, $compile, $timeout, $q, FoundationApi) {
        return modal;

        function modal(config) {
            var self = this, //for prototype functions
                container = angular.element(config.container || document.body),
                id = config.id || FoundationApi.generateUuid(),
                attached = false,
                destroyed = false,
                html,
                element,
                fetched,
                scope;

            var props = [
                'animationIn',
                'animationOut',
                'overlay',
                'overlayClose',
                'className'
            ];

            if (config.templateUrl) {
                //get template
                fetched = $http.get(config.templateUrl, {
                    cache: $templateCache
                }).then(function (response) {
                    html = response.data;
                    assembleDirective();
                });
            } else if (config.template) {
                //use provided template
                fetched = true;
                html = config.template;
                assembleDirective();
            }

            self.activate   = activate;
            self.deactivate = deactivate;
            self.toggle     = toggle;
            self.destroy    = destroy;

            return {
                isActive: isActive,
                activate: activate,
                deactivate: deactivate,
                toggle: toggle,
                destroy: destroy
            };

            function checkStatus() {
                if (destroyed) {
                    throw "Error: Modal was destroyed. Delete the object and create a new Modal instance.";
                }
            }

            // Does not work with FA v1.2
            function isActive() {
              return (! destroyed && scope && scope.active === true);
            }

            function activate() {
                checkStatus();
                $timeout(function () {
                    init(true);
                    FoundationApi.publish(id, 'show');
                }, 0, false);
            }

            function deactivate() {
                checkStatus();
                $timeout(function () {
                    init(false);
                    FoundationApi.publish(id, 'hide');
                }, 0, false);
            }

            function toggle() {
                checkStatus();
                $timeout(function () {
                    init(true);
                    FoundationApi.publish(id, 'toggle');
                }, 0, false);
            }

            function init(state) {
                $q.when(fetched).then(function () {
                    if (! attached && html.length) {
                        container.append(element);

                        scope.active = state;
                        $compile(element)(scope);

                        attached = true;
                    }
                });
            }

            function assembleDirective() {
                // check for duplicate elements to prevent factory from cloning modals
                if (document.getElementById(id)) {
                    return;
                }

                html = '<zf-modal id="' + id + '">' + html + '</zf-modal>';

                element = angular.element(html);

                scope = $rootScope.$new();

                var prop;

                // account for directive attributes
                for (var i = 0; i < props.length; i++) {
                    prop = props[i];

                    if (typeof config[prop] !== "undefined") {
                        switch (prop) {
                            case 'animationIn':
                                element.attr('animation-in', config[prop]);
                                break;
                            case 'animationOut':
                                element.attr('animation-out', config[prop]);
                                break;
                            case 'overlayClose':
                                element.attr('overlay-close', config[prop]);
                                break;
                            case 'className':
                                element.addClass(config[prop]);
                                break;
                            default:
                                element.attr(prop, config[prop]);
                        }
                    }
                }
                // access view scope variables
                if (config.contentScope) {
                    for (prop in config.contentScope) {
                        if (config.contentScope.hasOwnProperty(prop)) {
                            scope[prop] = config.contentScope[prop];
                        }
                    }
                }
            }

            function destroy() {
                self.deactivate();
                setTimeout(function () {
                    scope.$destroy();
                    element.remove();
                    destroyed = true;
                    FoundationApi.unsubscribe(id);
                }, 500); // must be greater than animation duration
            }
        }
    }

})();
