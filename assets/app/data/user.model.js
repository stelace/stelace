(function () {

    angular
        .module("app.data")
        .factory("User", User);

    function User($http, $q, apiBaseUrl, CryptoJS, $injector, MessageService) {
        var service = {};
        service.mixInto         = mixInto;
        service.getFullname     = getFullname;
        service.getMessageStats = getMessageStats;
        service.updatePassword  = updatePassword;
        service.updateMedia     = updateMedia;
        service.updateAddress   = updateAddress;
        service.updatePhone     = updatePhone;
        service.updateEmail     = updateEmail;
        service.applyFreeFees   = applyFreeFees;

        return service;



        function mixInto(obj) {
            return angular.extend(obj, this);
        }

        function getFullname(full, noPeriod) {
            var user = this;

            if (user.firstname && user.lastname) {
                if (full) {
                    return user.firstname + " " + user.lastname;
                } else if (noPeriod) {
                    // For ending context sentence the same way in all cases.
                    return user.firstname + " " + user.lastname.charAt(0);
                } else {
                    return user.firstname + " " + user.lastname.charAt(0) + ".";
                }
            } else if (user.firstname) {
                return user.firstname;
            } else if (user.username) {
                return user.username.split("@")[0];
            } else if (user.email) {
                return user.email.split("@")[0];
            } else {
                return "";
            }
        }

        function getMessageStats(maxDelayView) {
            var user     = this;
            maxDelayView = maxDelayView || 3600 * 48;

            return MessageService
                .getConversations({ receiverId: user.id })
                .then(function (conversations) {
                    var avgAnswerDelay;
                    var answerRate;

                    if (! conversations.length) {
                        avgAnswerDelay = -1;
                        answerRate = -1;
                    } else {
                        avgAnswerDelay = _.reduce(conversations, function (memo, conv, index, conversations) {
                             // min to avoid penalizing too much very late answers
                            return Math.min(memo, 1.5 * maxDelayView) + (conv.answerDelay / conversations.length);
                        }, 0);
                        answerRate = _.reduce(conversations, function (memo, conv, index, conversations) {
                            return memo + ((conv.answerDelay ? 1 : 0) / conversations.length);
                        }, 0);
                        answerRate *= 100;
                    }

                    if (conversations.length === 1 && (answerRate < 0.001 || avgAnswerDelay > maxDelayView)) {
                        // give some time to user to build stats
                        avgAnswerDelay = -1;
                        answerRate = -1;
                    }

                    return $q.when({
                        answerDelay: avgAnswerDelay,
                        answerRate: answerRate,
                        maxDelayView: maxDelayView
                    });
                });
        }

        function updatePassword(newPassword, oldPassword) {
            var user = this;

            var query = {};

            query.newPassword = CryptoJS.SHA256(newPassword).toString();

            if (oldPassword) {
                query.oldPassword = CryptoJS.SHA256(oldPassword).toString();
            }

            return $q.when()
                .then(function () {
                    if (! newPassword) {
                        return $q.reject("empty new password");
                    }

                    return user.customPUT(query, "password")
                        .then(function (res) {
                            return res.data;
                        });
                });
        }

        function updateMedia(mediaId) {
            var user = this;

            return $q.when(true)
                .then(function () {
                    return user.customPUT({ mediaId: mediaId }, "media");
                })
                .then(function () {
                    var gamification = $injector.get("gamification");
                    gamification.checkStats();
                    user.mediaId = mediaId;
                });
        }

        function updateAddress(address) {
            var user = this;

            return $q.when()
                .then(function () {
                    if (! address) {
                        return $q.reject("missing params");
                    }

                    return user.customPUT(address, "address")
                        .then(function (u) {
                            user.address = u.address;
                        });
                });
        }

        function updatePhone(phone) {
            var user = this;

            return $q.when()
                .then(function () {
                    if (! phone) {
                        return $q.reject("missing params");
                    }

                    return user.customPUT({ phone: phone } , "phone")
                        .then(function (u) {
                            user.phone = u.phone;
                            user.phoneCheck = u.phoneCheck;
                        });
                });
        }

        function updateEmail(email) {
            var user = this;

            return $q.when()
                .then(function () {
                    if (! email) {
                        return $q.reject("missing params");
                    }

                    return user.customPUT({ email: email }, "email")
                        .then(function () {
                            user.email = email;
                        });
                });
        }

        function applyFreeFees() {
            var user = this;

            return $http.post(apiBaseUrl + "/user/freeFees")
                .then(function (res) {
                    var newUser = res.data;
                    user.freeFeesDate = newUser.freeFeesDate;

                    return user;
                });
        }

    }

})();
