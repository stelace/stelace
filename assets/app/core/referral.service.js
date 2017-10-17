(function () {

    angular
        .module("app.core")
        .factory("referral", referral);

    function referral($q, $http, $state, apiBaseUrl, cache, StelaceConfig, StelaceEvent, toastr) {
        var doingReferral = false;

        var service = {};
        service.createReferredBy  = createReferredBy;
        service.afterRegister     = afterRegister;
        service.getFriends        = getFriends;
        service.getReferer        = getReferer;
        service.sendFriendEmails  = sendFriendEmails;

        return service;



        function createReferredBy(referrerId, date, source) {
            var params = {
                fromUserId: referrerId,
                date: date,
                source: source
            };

            return $http.post(apiBaseUrl + "/link/referredBy", params)
                .then(function (res) {
                    return res.data;
                });
        }

        function afterRegister(referrerId, date, source) {
            if (doingReferral) {
                return $q.resolve();
            }

            doingReferral = true;

            return createReferredBy(referrerId, date, source)
                .then(function (res) {
                    if (res.message === "SUCCESS") {
                        cache.set("refreshUserAfterReferral", true);
                        toastr.success("Votre compte a été crédité d'un cadeau Sharinplace supplémentaire.", "Bravo, parrainage pris en compte\xa0!", {
                            timeOut: 10000
                        });
                        StelaceEvent.sendEvent("Friend referral success");
                    }
                })
                .catch(function (err) {
                    if (err.data && err.data.message) {
                        if (err.data.message === "ALREADY_REFERER"
                         || err.data.message === "ONE_REFERRAL_PER_USER"
                        ) {
                            return toastr.success("Parrainez de nouveaux membres actifs pour recevoir de belles récompenses.", "Vous êtes déjà inscrit(e) :o", {
                                timeOut: 10000
                            });
                        }
                    }
                })
                .finally(function () {
                    doingReferral = false;
                });
        }

        /**
         * friend has the following format:
         * {
         *     email: ..., [can be null if coming from social network]
         *     media: ..., [can be null]
         *     referralStatus: "registered" || "registered-by-other" || "pending",
         *     source: "facebook" || "twitter" || "email" || null,
         *     linkUpdatedDate: ...,
         *     other optional fields, among which gamification actionsIds booleans...
         * }
         */
        function getFriends() {
            return $http.get(apiBaseUrl + "/link/friends")
                .then(function (res) {
                    return res.data;
                });
        }

        function getReferer() {
            return $http.get(apiBaseUrl + "/link/referer")
                .then(function (res) {
                    if (res.data.none) {
                        return null;
                    } else {
                        return res.data;
                    }
                });
        }

        function sendFriendEmails(emails) {
            var params = {
                emails: emails
            };

            return $http.post(apiBaseUrl + "/link/sendFriendEmails", params);
        }
    }

})();
