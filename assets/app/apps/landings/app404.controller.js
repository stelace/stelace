(function () {

    angular
        .module("app.landings")
        .controller("App404Controller", App404Controller);

    function App404Controller($location, $q, $state, ListingService, platform, toastr, UserService) {

        var url404       = $location.url();
        var listingStateUrl = _.get($state.get("listing"), "urlWithoutParams", "listing");
        var listingId;

        var vm = this;

        activate();



        function activate() {
            if (_.contains(url404, listingStateUrl)) {
                listingId = _.last(url404.split(/[-/]+/)); // split / or - or /-

                if (listingId && ! isNaN(listingId)) {
                    $q.all({
                        listing: ListingService.get(listingId),
                        currentUser: UserService.getCurrentUser()
                    })
                    .then(function (results) {
                        var listing    = results.listing;
                        var ownerId = listing && listing.ownerId;
                        var userId  = results.currentUser && results.currentUser.id;

                        if (ownerId === userId && _.isEmpty(listing.locations)) {
                            toastr.info("Votre annonce ne peut pas être publiée sans localisation. "
                                + "<a href=\"/location\">Cliquez ici pour ajouter un lieu à votre compte</a> ou "
                                + "<a href=\"/my-listings/" + listing.id + "\">ici pour modifier votre annonce</a>. "
                                + "Votre adresse complète n'apparaîtra jamais publiquement.",
                                "Lieu de disponibilité requis", {
                                    timeOut: 0,
                                    closeButton: true,
                                    allowHtml: true
                                });
                        }
                    })
                    .catch(); // not critical
                }
            }

            return ListingService.cleanGetList({ landing: true })
                .then(function (results) {
                    var nbListings = results.length;
                    if (nbListings) {
                        var listing = results[Math.floor(Math.random() * (nbListings))];
                        vm.randomListing = listing;
                    }
                })
                .finally(function () {
                    platform.setMetaTags({ "status-code": 404 });
                    platform.setPageStatus("ready");
                });
        }

    }

})();
