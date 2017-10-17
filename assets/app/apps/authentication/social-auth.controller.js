/* global ga */

(function () {

    angular
        .module("app.authentication")
        .controller("SocialAuthController", SocialAuthController);

    function SocialAuthController(cookie, StelaceEvent) {
        var tokenField = "authToken";

        activate();


        function activate() {
            var authToken = cookie.get(tokenField);

            if (authToken) {
                if (! window.gaFake) {
                    var gaConfig = localStorage.getItem("gaConfig");
                    var referrer;

                    try {
                        gaConfig = JSON.parse(gaConfig);
                        referrer = gaConfig.referrer;
                    } catch (e) {
                        // do nothing
                    }

                    ga("set", "referrer", referrer || "");
                }

                sendStelaceEvent();

                localStorage.setItem(tokenField, authToken);
                cookie.remove(tokenField);

                localStorage.setItem("socialLogin", "success");
                localStorage.removeItem("socialLogin");
            }

            window.close();
        }

        function sendStelaceEvent() {
            var socialLoginConfig = localStorage.getItem("socialLoginConfig");
            var label  = "Login social";
            var params = {};

            try {
                socialLoginConfig = JSON.parse(socialLoginConfig);
            } catch (e) {
                socialLoginConfig = {};
            }

            if (socialLoginConfig.provider) {
                label += " - " + socialLoginConfig.provider;
            }
            if (socialLoginConfig.srcUrl) {
                params.srcUrl = socialLoginConfig.srcUrl;
            }

            localStorage.removeItem("socialLoginConfig");
            StelaceEvent.sendEvent(label, params);
        }
    }

})();
