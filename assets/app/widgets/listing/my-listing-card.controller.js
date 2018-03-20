/* global moment */

(function () {

    angular
        .module("app.widgets")
        .controller("MyListingCardController", MyListingCardController);

    function MyListingCardController($scope,
                                $state,
                                $timeout,
                                $translate,
                                ContentService,
                                FoundationApi,
                                ListingService,
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
        vm.listing          = $scope.listing;

        vm.controlSpinnerId = "pending-control-spinner-" + vm.listing.id;

        vm.deleteListing       = deleteListing;
        vm.togglePauseListing  = togglePauseListing;

        activate();

        function activate() {

            // See http://stackoverflow.com/questions/20068526/angularjs-directive-does-not-update-on-scope-variable-changes
            $scope.$watch('listing', function (newListing) {
                vm.listing = newListing;
                _showPauseState()
                _showStats();
            });

            $scope.$on("$destroy", function () {
                $timeout.cancel(controlSpinnerTimeout);
            });
        }

        function _showStats() {
            // Sanitize data
            vm.nbContacts = vm.listing.nbContacts || 0;
            vm.nbViews = Math.max(vm.listing.nbViews || 0, vm.nbContacts);
            vm.showStats = (vm.nbViews >= 1);

            vm.nbViewsTooltip    = $translate.instant('listing.owner_stats.views', { views: vm.nbViews });
            vm.nbContactsTooltip = $translate.instant('listing.owner_stats.contacts', { contacts: vm.nbContacts });
        }

        function deleteListing(e) {
            _stopEventPropagation(e);

            var deleteListing = function (deletingListing) {
                deleting = true;

                var resListing = Restangular.restangularizeElement(null, deletingListing, "listing");
                resListing.remove()
                    .then(function () {
                        ContentService.showNotification({
                            messageKey: 'listing.notification.removed_success_message',
                            type: 'success'
                        });

                        return ListingService.getMyListings();
                    })
                    .then(function (listings) {
                        var index = _.findIndex(listings, function (listing) {
                            return listing.id === resListing.id;
                        });

                        listings.splice(index, 1);

                        if ($scope.onDelete) {
                            $scope.onDelete(resListing.id);
                        }
                    })
                    .finally(function () {
                        modals.deleteListing.destroy();
                        deleting = false;
                    });
            };

            var vm = {
                listing: $scope.listing,
                deleteListing: deleteListing
            };

            var modalId = "deleteListingConfirm-modal";

            modals.deleteListing = new Modal({
                id: modalId,
                className: "tiny dialog",
                templateUrl: "/assets/app/modals/deleteListingConfirm.html",
                overlayClose: false,
                contentScope: {
                    vm: vm
                }
            });
            modals.deleteListing.activate();

            FoundationApi.subscribe(modalId, function (msg) {
                if (! deleting && msg === "close") {
                    modals.deleteListing.destroy();
                }
            });
        }

        function togglePauseListing(e) {
            _stopEventPropagation(e);
            var resListing = Restangular.restangularizeElement(null, vm.listing, "listing");

            // Do not spin when latency is low;
            controlSpinnerTimeout = _spinPendingControlSpinner();

            resListing.pause()
                .then(function (listing) {
                    vm.listing = listing;

                    _showPauseState();

                    if (listing.locked && vm.listingPaused) {
                        ContentService.showNotification({
                            messageKey: 'listing.notification.deactivated_success_message',
                            messageValues: { paused_until_date: vm.listing.pausedUntil },
                            timeOut: 15000
                        });
                    } else if (listing.locked && ! vm.listingPaused) {
                        ContentService.showNotification({ messageKey: 'listing.notification.deactivated_success_message' });
                    } else {
                        ContentService.showNotification({
                            messageKey: 'listing.notification.activated_success_message',
                            type: 'success'
                        });
                    }
                })
                .finally(function () {
                    vm.controlPending = false;
                    $timeout.cancel(controlSpinnerTimeout);
                    usSpinnerService.stop(vm.controlSpinnerId);
                });
        }

        function _showPauseState() {
            var pauseDate = moment(vm.listing.pausedUntil).isValid();

            vm.listingPaused = vm.listing.locked && pauseDate;
            vm.listingLocked = vm.listing.locked && ! pauseDate;
            vm.pauseIcon  = platform.getSpriteSvgUrl(vm.listingPaused ? "play" : "pause");
            vm.pauseActionKey = vm.listingPaused ? 'listing.publish_again_action' : 'listing.pause_action';
            vm.daysPaused = pauseDate && Math.abs(moment().diff(vm.listing.pausedUntil, "d")) + 1;
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
