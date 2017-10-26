(function () {

    angular
        .module("app.core")
        .factory("gamification", gamification);

    function gamification($q, $http, $rootScope, apiBaseUrl, StelaceConfig, UserService) {
        var params;
        var throttledCheckStats;
        var actionMap = {
            "ADD_FIRSTNAME": {
                name: "Indiquer mon prénom dans mon profil",
                sref: "account"
            },
            "ADD_LASTNAME": {
                name: "Indiquer mon nom de famille dans mon profil",
                sref: "account"
            },
            "ADD_DESCRIPTION": {
                name: "Compléter ma description dans mon profil",
                sref: "account"
            },
            "EMAIL_VALIDATION": {
                name: "Valider mon adresse email grâce au lien de confirmation reçu",
                sref: "account"
            },
            "PHONE_VALIDATION": {
                name: "Valider mon numéro de téléphone",
                sref: "account"
            },
            "ADD_PROFILE_IMAGE": {
                name: "Ajouter ma photo de profil",
                sref: "account"
            },
            "FIRST_LOCATIONS_NB_2": {
                name: "Associer au moins deux lieux favoris à mon compte",
                sref: "account"
            },
            "REGISTER_AS_FRIEND": {
                name: "M'inscrire via un parrainage"
            },
            "A_FRIEND_REGISTERED": {
                name: "Parrainer un ami",
                sref: "invite"
            },
            "FRIEND_BEGINNER_LEVEL_AS_REFERER": {
                name: "Parrainer un ami qui atteint le niveau Initié",
                sref: "invite"
            },
            "FRIEND_BOOKING_AS_REFERER": {
                name: "Un des mes filleuls réserve un objet pour la 1\u1D49 fois",
                sref: "invite"
            },
            "FRIEND_RENTING_OUT_AS_REFERER": {
                name: "Un des mes filleuls loue ou partage un de ses objets pour la 1\u1D49 fois",
                sref: "invite"
            },
            "EXTERNAL_REVIEW": {
                name: "Donner mon avis sur un autre site (ex: Avis Google, Facebook...)",
                href: "https://www.google.fr/search?q=Sharinplace"
            },
            "FEEDBACK": {
                name: "Envoyer mes idées ou suggestions à l'équipe Sharinplace",
                sref: "contact"
            },
            "FIRST_MOBILE_CONNECTION": {
                name: "Me connecter sur mobile pour la première fois"
            },
            "FIRST_VALID_LISTING_AD": {
                name: "Créer ma première annonce validée",
                sref: "listingCreate"
            },
            "FIRST_BOOKING": {
                name: "Effectuer ma première réservation",
                sref: "search"
            },
            "FIRST_RENTING_OUT": {
                name: "Vendre, louer ou partager mon matériel pour la première fois"
            },
            "FIRST_COMPLETE_BOOKING": {
                name: "Finaliser ma première transaction (États des lieux signés)",
                sref: "inbox",
                srefParams: {
                    f: "t"
                }
            },
            "FIRST_RATING": {
                name: "Écrire mon premier commentaire sur un autre membre",
                sref: "inbox",
                srefParams: {
                    f: "t"
                }
            },
            "CONNECTION_OF_THE_DAY": {
                name: "Me connecter pour la première fois dans la journée"
            },
            "VALID_LISTING_AD": {
                name: "Créer une annonce validée",
                sref: "listingCreate"
            },
            "COMPLETE_BOOKING": {
                name: "Effectuer une transaction complète (États des lieux signés)",
                sref: "inbox",
                srefParams: {
                    f: "t"
                }
            }
        };
        var levelMap = {
            "null": "Débutant",
            "none": "Débutant",
            "beginner": "Initié",
            "bronze": "Bronze",
            "silver": "Argent",
            "gold": "Or",
            "NULL": "Débutant",
            "NONE": "Débutant",
            "BEGINNER": "Initié",
            "BRONZE": "Bronze",
            "SILVER": "Argent",
            "GOLD": "Or"
        };
        var medalsLabels = {
            "bronze": "Membre récompensé pour sa participation à l'aventure Sharinplace.",
            "silver": "Membre récompensé pour sa participation et son grand engagement dans la communauté Sharinplace.",
            "gold": "Membre distingué pour son engagement exceptionnel et son expérience sur Sharinplace."
        };

        var service                = {};
        service.getNextActions     = getNextActions;
        service.getParams          = getParams;
        service.getStats           = getStats;
        service.checkStats         = checkStats;
        service.updateProgressView = updateProgressView;
        service.getActionMap       = getActionMap;
        service.getLevelMap        = getLevelMap;
        service.getMedalsLabels    = getMedalsLabels;
        service.hasMedal           = hasMedal;

        return service;



        function getNextActions(stats, nbActions) {
            if (! stats) {
                return $q.when([]);
            }
            if (!StelaceConfig.isFeatureActive('GAMIFICATION')) {
                return $q.when([]);
            }

            var pastActions = _.keys(stats.actions);

            nbActions = nbActions || 2;

            return getParams()
                .then(function (params) {
                    var gameActions = (params && params.actions) || {};
                    return _(gameActions)
                        .omit(pastActions) // order matters: this takes and returns an object
                        .filter("suggestionOrder") // and this returns an array
                        .sortByAll(["suggestionOrder", "points"])
                        .take(nbActions)
                        .value();
                });
        }

        function getParams(clearCache) {
            if (!StelaceConfig.isFeatureActive('GAMIFICATION')) {
                return $q.when();
            }

            return $q
                .when()
                .then(function () {
                    if (clearCache) {
                        params = null;
                    }
                    if (params) {
                        return params;
                    }

                    return $http.get(apiBaseUrl + "/gamification/params")
                        .then(function (res) {
                            params = res.data;
                            return params;
                        });
                });
        }

        function getStats() {
            if (!StelaceConfig.isFeatureActive('GAMIFICATION')) {
                return $q.when();
            }

            return $http.get(apiBaseUrl + "/gamification/stats")
                .then(function (res) {
                    return res.data;
                });
        }

        function checkStats(delayDuration) {
            delayDuration = (typeof delayDuration !== "undefined") ? delayDuration : 5000;

            if (!StelaceConfig.isFeatureActive('GAMIFICATION')) {
                return $q.when();
            }

            return delay(delayDuration)
                .then(function () {
                    var throttled = getThrottledCheckStats();
                    return throttled();
                });



            function delay(duration) {
                return $q(function (resolve) {
                    setTimeout(resolve, duration);
                });
            }
        }

        function _checkStats() {
            return UserService
                .getCurrentUser()
                .then(function (currentUser) {
                    if (! currentUser) {
                        return;
                    }

                    return getStats()
                        .then(function (stats) {
                            stats.pointsChanged = currentUser.lastViewedPoints !== stats.points;
                            stats.levelChanged  = currentUser.lastViewedLevelId !== stats.levelId;

                            if (stats.pointsChanged || stats.levelChanged) {
                                $rootScope.$emit("gamificationProgressChanged", stats);
                            }
                            return stats;
                        });
                });
        }

        function getThrottledCheckStats() {
            if (! throttledCheckStats) {
                throttledCheckStats = _.throttle(_checkStats, 15000, { leading: true, trailing: true });
            }
            return throttledCheckStats;
        }

        function updateProgressView(args) {
            return UserService
                .getCurrentUser()
                .then(function (currentUser) {
                    if (!StelaceConfig.isFeatureActive('GAMIFICATION')) {
                        return currentUser;
                    }

                    return $http.put(apiBaseUrl + "/gamification/progressView", args)
                        .then(function (res) {
                            if (res && res.data) {
                                currentUser.points            = res.data.points;
                                currentUser.lastViewedPoints  = res.data.lastViewedPoints;
                                currentUser.levelId           = res.data.levelId;
                                currentUser.lastViewedLevelId = res.data.lastViewedLevelId;
                            }

                            return currentUser;
                        });
                });
        }

        function getActionMap() {
            return actionMap;
        }

        function getLevelMap() {
            return levelMap;
        }

        function getMedalsLabels() {
            return medalsLabels;
        }

        function hasMedal(userLvl) {
            if (typeof userLvl !== "string") {
                return false;
            }
            userLvl = userLvl.toLowerCase();

            return userLvl === "bronze" || userLvl === "silver" || userLvl === "gold";
        }
    }

})();
