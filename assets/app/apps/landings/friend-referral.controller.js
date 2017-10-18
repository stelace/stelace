/* global moment */

(function () {

    angular
        .module("app.landings")
        .controller("FriendReferralController", FriendReferralController);

    function FriendReferralController($q,
                                        $state,
                                        $stateParams,
                                        authenticationModal,
                                        cache,
                                        ItemService,
                                        loggerToServer,
                                        MediaService,
                                        platform,
                                        referral,
                                        StelaceEvent,
                                        storage,
                                        toastr,
                                        tools,
                                        User,
                                        UserService) {

        var source = $stateParams.s || null;
        var items;
        var referrer;
        var referrerId;
        var referrerItems;
        var canonicalUrl;

        var vm = this;
        vm.rentingSteps = [{
            label: "Chercher",
            content: "Trouvez le matériel qu'il vous faut sur Sharinplace, près de chez vous et de vos lieux favoris. ",
            icon: "magnifying"
        }, {
            label: "Contacter",
            content: "Renseignez-vous sur les objets de vos rêves en contactant leurs propriétaires et utilisateurs via notre messagerie sécurisée.",
            icon: "email-envelope"
        }, {
            label: "Réserver",
            content: "Réservez en toute sécurité en ligne. Le paiement n'est effectif que si l'objet est parfaitement conforme à l'annonce.",
            icon: "check-mark"
        }];

        vm.footerTestimonials = true;

        vm.register = register;

        activate();



        function activate() {
            if ($stateParams.slug) {
                var slugId = _.last($stateParams.slug.split("-"));

                if (slugId && ! isNaN(slugId)) {
                    referrerId = slugId;
                    canonicalUrl = platform.getBaseUrl() + $state.current.urlWithoutParams + "/" + referrerId;
                } else {
                    $state.go("invite");
                    return;
                }
            } else {
                $state.go("invite");
                return;
            }

            return $q.all({
                items: ItemService.getList({ landing: true }),
                referrer: UserService.get(referrerId).catch(_handleRedirect),
                referrerItems: ItemService.getList({ ownerId: referrerId })
            })
            .then(function (results) {
                items         = results.items;
                referrer      = results.referrer;
                referrerItems = results.referrerItems.plain ? results.referrerItems.plain() : results.referrerItems;

                storage.setItem("referralInfo", {
                    referrerId: referrerId,
                    date: new Date().toISOString(),
                    source: source
                });

                // Show a referrer's item if a good one is available
                referrerItems = _(referrerItems)
                    .filter(function (item) {
                        // Only use referrer items with media and deduplicate with search results
                        return item.medias && item.medias.length && ! _.find(items, "id", item.id);
                    })
                    .sortBy(function (item) { // ascending order
                        return item.nbRatings || 0;
                    })
                    .value();

                if (referrerItems.length) {
                    items.unshift(_.last(referrerItems));
                }

                ItemService.populate(items);
                _.forEach(items, function (item) {
                    item.vLocations = item.locations;
                });

                referrer.fullname = User.getFullname.call(referrer);
                referrer.displayName = referrer.firstname || referrer.fullname;
                if (referrer.media) {
                    MediaService.setUrl(referrer.media);
                }

                vm.referrer = referrer;
                vm.items    = items;

                StelaceEvent.sendEvent("Friend referral view");

                _setSEOTags();
                platform.setPageStatus("ready");
            })
            .catch(function (err) {
                platform.setMetaTags({ "status-code": 500 });
                platform.setPageStatus("ready");
                // Testing error interception
                loggerToServer.error(err);
            });
        }

        function _setSEOTags() {
            var description = "Empruntez nos objets en libre-service "
                + (vm.referrer.displayName ? "grâce au parrainage de " + vm.referrer.displayName + " " : "");
            var title       = (vm.referrer.displayName ? vm.referrer.displayName + " vous offre jusqu'à 30€ d'économies"
                : "Faites jusqu'à 30€ d'économies grâce à ce parrainage");

            description += "en vous inscrivant dès maintenant sur Sharinplace.";

            platform.setTitle(title + " - Sharinplace");
            platform.setMetaTags({ description: description });
            platform.setOpenGraph({
                "og:url": canonicalUrl,
                "og:title": title,
                "og:description": description,
                // "og:image": "https://stelace.com/img/brand/stelace-social-header.png",
                // "og:image:secure_url": "https://stelace.com/img/brand/stelace-social-header.png",
                // "og:image:width": 1200,
                // "og:image:height": 630,
                "og:type": "website"
            });
            platform.setTwitterCard({
                "twitter:title": title,
                "twitter:description": description
                // "twitter:image": "https://stelace.com/img/brand/stelace-social-header.png"
            });
            platform.setCanonicalLink(canonicalUrl);
        }

        function _handleRedirect() {
            $state.go("invite");

            return $q.reject("stop");
        }

        function register() {
            var authModalOptions = {
                greeting: "Inscrivez-vous pour profiter de nos objets en libre-service grâce à " + (vm.referrer.displayName || "ce parrainage")
                    + " ou pour vendre et louer vos propres objets sur Sharinplace."
            };

            return UserService.getCurrentUser()
                .then(function (currentUser) {
                    if (currentUser && currentUser.id === vm.referrer.id) {
                        $state.go("invite");
                        return toastr.success("Parrainez de nouveaux membres actifs pour recevoir de belles récompenses.", "Impossible de vous auto-parrainer ;)", {
                            timeOut: 10000
                        });
                    } else if (currentUser) {
                        $state.go("invite");
                        return toastr.success("Parrainez de nouveaux membres actifs pour recevoir de belles récompenses.", "Vous êtes déjà inscrit(e) :o", {
                            timeOut: 10000
                        });
                    }

                    return authenticationModal.process("register", authModalOptions)
                        .then(function (isAuth) {
                            if (isAuth) {
                                // the redirection after registration and the creation of referral
                                // are managed by the authentication modal service

                                // user can login instead of register, check the creation date
                                return UserService
                                    .getCurrentUser()
                                    .then(function (currentUser) {
                                        if (currentUser.createdDate < moment().subtract(1, "m").toISOString()) {
                                            return toastr.success("Parrainez de nouveaux membres actifs pour recevoir de belles récompenses.", "Vous êtes déjà inscrit(e) :o", {
                                                timeOut: 10000
                                            });
                                        }
                                    });
                            } else {
                                toastr.info("Votre compte sera crédité d'un cadeau Sharinplace supplémentaire dès votre inscription.", "Profitez du parrainage de " + vm.referrer.displayName, {
                                    timeOut: 10000
                                });
                            }
                        });
                });
        }

    }

})();
