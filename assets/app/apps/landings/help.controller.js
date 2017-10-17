(function () {

    angular
        .module("app.landings")
        .controller("HelpController", HelpController);

    function HelpController($location,
                            $scope,
                            StelaceEvent) {
        var listeners = [];
        var hash      = $location.hash();

        var vm = this;
        vm.showSchema1  = true;
        vm.showAnswer1  = true;
        vm.showSchema2  = true;
        vm.showAnswer32 = true;

        vm.footerTestimonials = true;


        activate();



        function activate() {
            if (hash && hash === "tax") {
                vm.showAnswer16ter = true;
            }

            StelaceEvent.sendScrollEvent("Help view")
                .then(function (obj) {
                    listeners.push(obj.cancelScroll);
                });

            $scope.$on('$destroy', function () {
                _.forEach(listeners, function (listener) {
                    listener();
                });
            });
        }

    }

})();
