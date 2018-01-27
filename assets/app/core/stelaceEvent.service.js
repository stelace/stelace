(function () {

    angular
        .module("app.core")
        .factory("StelaceEvent", StelaceEvent);

    function StelaceEvent($http, $location, $q, apiBaseUrl, loggerToServer, StelaceConfig, tools) {
        var sessionId;
        var sessionToken;
        var version;

        var service = {};
        service.sendEvent       = sendEvent;
        service.sendScrollEvent = sendScrollEvent;
        service.updateEvent     = updateEvent;

        activate();

        return service;



        function activate() {
            var body = document.body;

            var id    = parseInt(body.getAttribute("data-session-id"), 10);
            var token = body.getAttribute("data-session-token");
            var ver   = parseInt(body.getAttribute("data-ux-version"), 10);

            if (id && token) {
                sessionId = id;
                sessionToken = token;
            }

            if (ver) {
                version = ver;
            }
        }

        function sendEvent(label, args) {
            var mockObject = {
                update: function () {}
            };

            if (! label) {
                return $q.reject("missing params");
            }
            if (!StelaceConfig.isFeatureActive('EVENTS')) {
                return $q.resolve(mockObject);
            }

            // console.log(label, args)

            args = args || {};

            var params = {
                label: label,
                srcUrl: $location.absUrl(),
                targetUrl: args.targetUrl,
                listingId: args.listingId,
                targetUserId: args.targetUserId,
                type: args.type,
                resetUser: args.resetUser,
                data: args.data,
                scrollPercent: args.scrollPercent,
                width: args.width || window.innerWidth,
                height: args.height || window.innerHeight,
                version: version
            };

            if (sessionId && sessionToken) {
                params.sessionId    = sessionId;
                params.sessionToken = sessionToken;
            }

            return $http.post(apiBaseUrl + "/stelace/event", params)
                .then(function (res) {
                    if (! res.data
                     || ! res.data.sessionId
                     || ! res.data.sessionToken
                     || ! res.data.eventId
                     || ! res.data.eventToken
                    ) {
                        return $q.reject("bad response format");
                    }

                    sessionId    = res.data.sessionId;
                    sessionToken = res.data.sessionToken;

                    return StlEvent(res.data.eventId, res.data.eventToken);
                })
                .catch(function () {
                    return mockObject;
                });
        }

        function sendScrollEvent(label, args, throttleDuration) {
            var mockObject = {
                stelaceEvent: null,
                cancelScroll: function () {}
            };

            if (!StelaceConfig.isFeatureActive('EVENTS')) {
                return $q.resolve(mockObject);
            }

            args = args || {};
            args.scrollPercent = args.scrollPercent || 0;
            throttleDuration = (typeof throttleDuration !== "undefined" ? throttleDuration : 3000);

            var maxScroll = 0;

            return sendEvent(label, args)
                .then(function (stelaceEvent) {
                    var sendScrollInfo = function (scroll, total) {
                        var scrollPercent = Math.round(scroll / total * 100);

                        if (maxScroll < scrollPercent) {
                            stelaceEvent.update({
                                scrollPercent: scrollPercent
                            });

                            maxScroll = scrollPercent;
                        }
                    };

                    var cancelScroll = tools.onScroll(_.throttle(sendScrollInfo, throttleDuration, {
                        "leading": false
                    }));

                    return {
                        stelaceEvent: stelaceEvent,
                        cancelScroll: cancelScroll
                    };
                })
                .catch(function () {
                    return mockObject;
                });
        }

        function updateEvent(id, token, args) {
            return StlEvent(id, token).update(args);
        }

        function StlEvent(id, token) {
            var obj = {
                update: update
            };

            return obj;



            function update(args) {
                args = args || {};
                args.token = token;

                if (!StelaceConfig.isFeatureActive('EVENTS')) {
                    return $q.resolve();
                }

                return $http.patch(apiBaseUrl + "/stelace/event/" + id, args);
            }
        }
    }

})();
