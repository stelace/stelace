(function () {

    angular
        .module("app.core")
        .factory("crossTabCommunication", crossTabCommunication);

    function crossTabCommunication() {
        var mapEvents = {};

        var service = {};

        service.subscribe = subscribe;
        service.clear     = clear;

        activate();

        return service;




        function activate() {
            window.addEventListener("storage", function (e) {
                if (e.newValue === e.oldValue) {
                    return;
                }

                _.forEach(mapEvents[e.key] || [], function (handler) {
                    handler(e.newValue, e.oldValue, e);
                });
            });
        }

        function subscribe(eventType, handler) {
            mapEvents[eventType] = mapEvents[eventType] || [];
            mapEvents[eventType].push(handler);

            return function () {
                unsubscribe(eventType, handler);
            };
        }

        function unsubscribe(eventType, handler) {
            _.remove(mapEvents[eventType] || [], function (h) {
                return handler === h;
            });

            if (mapEvents[eventType] && ! mapEvents[eventType].length) {
                delete mapEvents[eventType];
            }
        }

        function clear(eventTypes) {
            if (! eventTypes) {
                mapEvents = {};
            } else {
                _.forEach(eventTypes, function (eventType) {
                    delete mapEvents[eventType];
                });
            }
        }
    }

})();
