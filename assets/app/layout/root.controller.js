(function () {

    angular
        .module("app.layout")
        .controller("RootController", RootController);

    function RootController(//$rootScope,
                            // $scope,
                            // $timeout,
                            // Restangular,
                            // tools,
                            // authentication,
                            // authenticationModal
                            ) {
        // var listeners = [];

        // var vm = this;

        // vm.authenticate = authenticate;

        activate();




        function activate() {
            // $rootScope.isAuthenticatedPromise
            //     .then(function (isAuthenticated) {
            //         vm.isAuthenticated = isAuthenticated;
            //     });

            // listeners.push(
            //     $rootScope.$on("isAuthenticated", function (event, isAuthenticated) {
            //         vm.isAuthenticated = isAuthenticated;
            //     })
            // );

            // $scope.$on("$destroy", function () {
            //     _.forEach(listeners, function (listener) {
            //         listener();
            //     });
            // });
        }

        // function authenticate(formType) {
        //     authenticationModal.process(formType);
        // }

    }

})();
