(function () {

    angular
        .module("app.widgets")
        .controller("ItemCardController", ItemCardController);

    function ItemCardController($scope,
                                $state,
                                LocationService,
                                platform) {

        var displayDuration = ($scope.displayDuration === "true");

        var vm              = this;
        vm.item             = $scope.item;
        vm.isMyItem         = $scope.isMyItem;
        vm.position         = $scope.position;

        activate();

        function activate() {

            // See http://stackoverflow.com/questions/20068526/angularjs-directive-does-not-update-on-scope-variable-changes
            $scope.$watch('item', function (newItem) {
                vm.item = newItem;
                _displayLocation();
                // _displayOwnerImage();
                _displayBookingModes();
            });

        }

        function _displayLocation() {
            if (displayDuration) {
                // durationString is defined in view controller
                // Only show if fromLocation and toLocation are not in the same city
                if (vm.item.loc && vm.item.toLoc
                    && ((vm.item.loc.city === vm.item.toLoc.city)
                    || (vm.item.loc.department === vm.item.toLoc.department && vm.item.loc.department === "Paris") // Ignore Paris' Arrondissements...
                    )
                ) {
                    vm.durationString = null;
                } else {
                    vm.durationString = vm.item.minDurationString;
                }

                // Locname is default for similarItems in item view and items in home. Not needed in search since item.loc is always defined
                if (vm.durationString) {
                    vm.closestLocationShortName = $scope.locname || (vm.item && vm.item.loc ? LocationService.getShortName(vm.item.loc) : "");
                } else {
                    vm.closestLocationShortName = (vm.item.toLoc && vm.item.toLoc.city) || (vm.item.loc && vm.item.loc.city);
                    // "À..." must be followed by city name when no duration, not by user location
                }
                vm.locationCity   = (vm.item && vm.item.toLoc ? vm.item.toLoc.city : null);
                vm.locationCoords = {
                    latitude: vm.item.toLoc && vm.item.toLoc.latitude,
                    longitude: vm.item.toLoc && vm.item.toLoc.longitude
                };
            } else if (vm.item.vLocations && vm.item.vLocations.length && vm.item.vLocations[0]) {
                vm.locationCity   = vm.item.vLocations[0].city || null;
                vm.locationRegion = vm.item.vLocations[0].region || null;
                // vm.postalCode     = vm.item.vLocations[0].postalCode || "";
                // var department    = vm.postalCode ? ("(" + vm.postalCode.substr(0, 2) + ")") : "";
            }
        }

        // function _displayOwnerImage() {
        //     if (! vm.item.ownerMedia || vm.item.ownerMedia.url === platform.getDefaultProfileImageUrl()) {
        //         vm.hideOwnerImage = true;
        //     }
        // }

        function _displayBookingModes() {
            vm.imageAlt = vm.item.name + " à louer sur Sharinplace"; // default

            if (vm.item.listingTypesProperties.TIME.NONE && vm.item.sellingPrice) {
                vm.bookingModesStr = vm.item.sellingPrice + "€";
                vm.sellableIconUrl = platform.getSpriteSvgUrl("tag");
                vm.sellableTooltip = "En vente à " + vm.item.sellingPrice + "€"
                vm.imageAlt        = vm.item.name + " à vendre sur Sharinplace";
            } else if (vm.item.listingTypesProperties.TIME.NONE) {
                vm.bookingModesStr = "Don";
                vm.sellableIconUrl = platform.getSpriteSvgUrl("euro-crossed");
                vm.sellableTooltip = "Il s'agit d'un don du propriétaire."
                vm.imageAlt        = vm.item.name + " à donner sur Sharinplace";
            }

        }
    }

})();
