(function () {

    angular
        .module("app.authentication")
        .controller("EmailCheckController", EmailCheckController);

    function EmailCheckController($location, $state, $translate, authentication, platform, toastr) {
        var searchParams = $location.search();
        var email        = searchParams.e;
        var tokenId      = searchParams.i;
        var tokenValue   = searchParams.t;
        var firstTime    = searchParams.f;

        activate();



        function activate() {
            var params = {};

            if (email && tokenValue) {
                params.email      = email;
                params.tokenValue = tokenValue;
            } else if (tokenId && tokenValue) {
                params.tokenId    = tokenId;
                params.tokenValue = tokenValue;
                params.firstTime  = (firstTime === "1");
            } else {
                return $translate("error.invalid_link")
                    .then(function (message) {
                        toastr.warning(message);
                        _redirectToHome();
                    });
            }

            authentication.emailCheck(params)
                .then(function () {
                    $translate("authentication.email_checked")
                    .then(function (message) {
                        toastr.success(message);
                    });
                })
                .catch(platform.showErrorMessage)
                .finally(function () {
                    _redirectToHome();
                });
        }

        function _redirectToHome() {
            $state.go("home", null, { location: "replace" });
        }
    }

})();
