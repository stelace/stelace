(function () {

    angular
        .module("app.widgets")
        .controller("MapControlController", MapControlController);

    function MapControlController($rootScope, $scope, LocationService) {
        var listeners = [];

        var vm = $scope;
        vm.addButtonDisable = true;

        vm.addLocation = addLocation;

        activate();



        function activate() {
            LocationService
                .getMine()
                .then(function (locations) {
                    if (locations.length >= LocationService.getMaxLocations()) {
                        vm.addButtonDisable = true;
                    }
                });

            listeners.push(
                $rootScope.$on("mapControl_addLocationDisable", function () {
                    vm.addButtonDisable = true;
                })
            );

            listeners.push(
                $rootScope.$on("mapControl_addLocationEnable", function () {
                    vm.addButtonDisable = false;
                })
            );

            $scope.$on("$destroy", function () {
                _.forEach(listeners, function (listener) {
                    listener();
                });
            });
        }

        function addLocation() {
            $rootScope.$emit("mapControl_addLocation");
        }
    }

})();
