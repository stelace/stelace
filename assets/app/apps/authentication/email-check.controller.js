(function () {

    angular
        .module("app.authentication")
        .controller("EmailCheckController", EmailCheckController);

    function EmailCheckController($location, $state, authentication, toastr) {
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
                toastr.warning("Le lien est incorrect");
                _redirectToHome();
                return;
            }

            authentication.emailCheck(params)
                .then(function () {
                    toastr.success("Votre adresse email a été validée !");
                })
                .catch(function () {
                    toastr.warning("Une erreur est survenue. Veuillez réessayer plus tard.");
                })
                .finally(function () {
                    _redirectToHome();
                });
        }

        function _redirectToHome() {
            $state.go("home", null, { location: "replace" });
        }
    }

})();
