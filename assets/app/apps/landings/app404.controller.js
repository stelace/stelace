(function () {

    angular
        .module("app.landings")
        .controller("App404Controller", App404Controller);

    function App404Controller($location, $q, $state, ItemService, platform, toastr, UserService) {

        var url404       = $location.url();
        var itemStateUrl = _.get($state.get("item"), "urlWithoutParams", "item");
        var itemId;

        var vm = this;

        activate();



        function activate() {
            if (_.contains(url404, itemStateUrl)) {
                itemId = _.last(url404.split(/[-/]+/)); // split / or - or /-

                if (itemId && ! isNaN(itemId)) {
                    $q.all({
                        item: ItemService.get(itemId),
                        currentUser: UserService.getCurrentUser()
                    })
                    .then(function (results) {
                        var item    = results.item;
                        var ownerId = item && item.ownerId;
                        var userId  = results.currentUser && results.currentUser.id;

                        if (ownerId === userId && _.isEmpty(item.locations)) {
                            toastr.info("Votre annonce ne peut pas être publiée sans localisation. "
                                + "<a href=\"/location\">Cliquez ici pour ajouter un lieu à votre compte</a> ou "
                                + "<a href=\"/my-items/" + item.id + "\">ici pour modifier votre annonce</a>. "
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

            return ItemService.cleanGetList({ landing: true })
                .then(function (results) {
                    var nbItems = results.length;
                    if (nbItems) {
                        var item = results[Math.floor(Math.random() * (nbItems))];
                        vm.randomItem = item;
                    }
                })
                .finally(function () {
                    platform.setMetaTags({ "status-code": 404 });
                    platform.setPageStatus("ready");
                });
        }

    }

})();
