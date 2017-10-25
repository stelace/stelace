/* global moment */

(function () {

    angular
        .module("app.widgets")
        .controller("MyListingCardController", MyListingCardController);

    function MyListingCardController($scope,
                                $state,
                                $timeout,
                                FoundationApi,
                                ItemService,
                                Modal,
                                platform,
                                Restangular,
                                StelaceEvent,
                                toastr,
                                usSpinnerService) {

        var modals          = {};
        var deleting        = false;
        var controlSpinnerTimeout;

        var vm              = this;
        vm.item             = $scope.item;

        vm.controlSpinnerId = "pending-control-spinner-" + vm.item.id;

        vm.deleteItem       = deleteItem;
        vm.togglePauseItem  = togglePauseItem;

        activate();

        function activate() {

            // See http://stackoverflow.com/questions/20068526/angularjs-directive-does-not-update-on-scope-variable-changes
            $scope.$watch('item', function (newItem) {
                vm.item = newItem;
                _showPauseState()
                _displayBookingInfo();
                _showStats();
            });

            $scope.$on("$destroy", function () {
                $timeout.cancel(controlSpinnerTimeout);
            });
        }

        function _displayBookingInfo() {
            vm.imageAlt = vm.item.name + " à louer sur Sharinplace"; // default

            if (vm.item.listingTypesProperties.TIME.NONE && vm.item.sellingPrice) {
                vm.bookingDescription = vm.item.sellingPrice + "€";
                vm.sellableIconUrl = platform.getSpriteSvgUrl("tag");
                vm.sellableTooltip = "En vente à " + vm.item.sellingPrice + "€"
                vm.imageAlt        = vm.item.name + " à vendre sur Sharinplace";
            } else if (vm.item.listingTypesProperties.TIME.NONE) {
                vm.bookingDescription = "Don";
                vm.sellableIconUrl = platform.getSpriteSvgUrl("euro-crossed");
                vm.sellableTooltip = "Il s'agit d'un don du propriétaire."
                vm.imageAlt        = vm.item.name + " à donner sur Sharinplace";
            }
        }

        function _showStats() {
            // Sanitize data
            vm.nbContacts = vm.item.nbContacts || 0;
            vm.nbViews = Math.max(vm.item.nbViews || 0, vm.nbContacts);
            vm.showStats = (vm.nbViews >= 1);
        }

        function deleteItem(e) {
            _stopEventPropagation(e);

            var deleteItem = function (deletingItem) {
                deleting = true;

                var resItem = Restangular.restangularizeElement(null, deletingItem, "item");
                resItem.remove()
                    .then(function () {
                        toastr.success("Annonce supprimée");

                        return ItemService.getMyItems();
                    })
                    .then(function (items) {
                        var index = _.findIndex(items, function (item) {
                            return item.id === resItem.id;
                        });

                        items.splice(index, 1);

                        if ($scope.onDelete) {
                            $scope.onDelete(resItem.id);
                        }
                    })
                    .finally(function () {
                        modals.deleteItem.destroy();
                        deleting = false;
                    });
            };

            var vm = {
                item: $scope.item,
                deleteItem: deleteItem
            };

            var modalId = "deleteItemConfirm-modal";

            modals.deleteItem = new Modal({
                id: modalId,
                className: "tiny dialog",
                templateUrl: "/assets/app/modals/deleteItemConfirm.html",
                overlayClose: false,
                contentScope: {
                    vm: vm
                }
            });
            modals.deleteItem.activate();

            FoundationApi.subscribe(modalId, function (msg) {
                if (! deleting && msg === "close") {
                    modals.deleteItem.destroy();
                }
            });
        }

        function togglePauseItem(e) {
            _stopEventPropagation(e);
            var resItem = Restangular.restangularizeElement(null, vm.item, "item");

            // Do not spin when latency is low;
            controlSpinnerTimeout = _spinPendingControlSpinner();
            var wasPaused = vm.item.locked;

            resItem.pause()
                .then(function (item) {
                    vm.item = item;

                    _showPauseState();

                    if (item.locked && vm.pausedUntil) {
                        toastr.success(
                        "Vous pouvez réactiver votre annonce plus tôt si vous le souhaitez.",
                        "Annonce en pause jusqu'au " + vm.pausedUntil, {
                            timeOut: 15000
                        });
                    } else if (item.locked && ! vm.pausedUntil) {
                        toastr.info("Annonce désactivée");
                    } else {
                        toastr.success("Annonce réactivée\xa0!");
                    }

                    var stelaceEventData = {
                        pause: ! wasPaused
                    };
                    if (vm.itemLocked) {
                        stelaceEventData.systemLocked = true;
                    }

                    StelaceEvent.sendEvent("Item pause toggle", {
                        type: "click",
                        itemId: vm.item.id,
                        data: stelaceEventData
                    });
                })
                .finally(function () {
                    vm.controlPending = false;
                    $timeout.cancel(controlSpinnerTimeout);
                    usSpinnerService.stop(vm.controlSpinnerId);
                });
        }

        function _showPauseState() {
            var pauseDate = moment(vm.item.pausedUntil).isValid();

            vm.itemPaused = vm.item.locked && pauseDate;
            vm.itemLocked = vm.item.locked && ! pauseDate;
            vm.pauseIcon  = platform.getSpriteSvgUrl(vm.itemPaused ? "play" : "pause");
            vm.pauseStr   = vm.itemPaused ? "Re-publier" : "Mettre en pause";
            vm.daysPaused = pauseDate && Math.abs(moment().diff(vm.item.pausedUntil, "d")) + 1;
            vm.pausedUntil = pauseDate && moment(vm.item.pausedUntil).format("DD/MM/YY");
        }

        function _spinPendingControlSpinner() {
            vm.controlPending = true;
            return $timeout(function() {
                usSpinnerService.spin(vm.controlSpinnerId);
            }, 800);
        }

        function _stopEventPropagation(e) {
            if (e && e.stopPropagation) {
                e.stopPropagation();
                // necessary with ui-sref. See https://github.com/angular-ui/ui-router/pull/592#issuecomment-29330705
            }
        }
    }

})();
