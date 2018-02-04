/* global moment */

(function () {

    angular
        .module("app.data")
        .factory("UserService", UserService);

    function UserService($http,
                            $q,
                            $rootScope,
                            apiBaseUrl,
                            authentication,
                            cache,
                            ezfb,
                            jwtHelper,
                            MediaService,
                            platform,
                            Restangular,
                            StelaceEvent,
                            tools,
                            User) {
        var service = Restangular.all("user");
        service.getParams            = getParams;
        service.getCurrentUser       = getCurrentUser;
        service.setCurrentUser       = setCurrentUser;
        service.unsetCurrentUser     = unsetCurrentUser;
        service.setUserImgUrl        = setUserImgUrl;
        service.isAdmin              = isAdmin;
        service.isLoggedAs           = isLoggedAs;
        service.getRefererUrl        = getRefererUrl;
        service.queryUsers           = queryUsers;
        service.getAuthMeans         = getAuthMeans;
        service.isFreeFees           = isFreeFees;
        service.freeFeesNextDate     = freeFeesNextDate;
        service.canApplyFreeFees     = canApplyFreeFees;
        service.getIncomeReport      = getIncomeReport;
        service.getIncomeReportUrl   = getIncomeReportUrl;
        service.getPaymentAccounts   = getPaymentAccounts;

        Restangular.extendModel("user", function (obj) {
            return User.mixInto(obj);
        });


        activate();

        return service;


        function activate() {
            $rootScope.$on("isAuthenticated", function (event, isAuthenticated) {
                if (isAuthenticated === false) {
                    unsetCurrentUser();
                }
            });

            ezfb.Event.subscribe("auth.statusChange", function (response) {
                $rootScope.facebookUser = (response && _.includes(["connected", "not_authorized"], response.status));
                $rootScope.$emit("facebookUser", response.status);
            });

            ezfb.Event.subscribe("edge.create", function (/*likedUrl*/) {
                return StelaceEvent.sendEvent("Facebook page like", { type: "click" });
            });
            ezfb.Event.subscribe("edge.remove", function (/*unlikedUrl*/) {
                return StelaceEvent.sendEvent("Facebook page unlike", { type: "click" });
            });
        }


        function getParams() {
            return $q.when()
                .then(function () {
                    var cacheUserParams = cache.get("userParams");

                    if (cacheUserParams) {
                        return cacheUserParams;
                    } else {
                        return service.customGET("params")
                            .then(function (params) {
                                params = tools.clearRestangular(params);
                                cache.set("userParams", params);
                                return params;
                            })
                            .catch(function (err) {
                                return $q.reject(err);
                            });
                    }
                });
        }

        function getCurrentUser(clearCache, authenticationOptional) {
            var prop = "currentUser";

            return $q(function (resolve, reject) {
                if (clearCache) {
                    cache.set(prop, null);
                }

                var cached = cache.get(prop);
                if (cached) {
                    resolve(cached);
                } else {
                    service.customGET("me")
                        .then(function (user) {
                            cache.set(prop, user);
                            resolve(user);
                        })
                        .catch(function (err) {
                            if (authenticationOptional) {
                                resolve();
                            } else {
                                reject(err);
                            }
                        });
                }
            });
        }

        function setCurrentUser(user) {
            var prop = "currentUser";
            user = Restangular.restangularizeElement(null, user, "user");
            cache.set(prop, user);
        }

        function unsetCurrentUser() {
            var prop = "currentUser";
            cache.unset(prop);
        }

        function setUserImgUrl(user) {
            if (user.media) {
                MediaService.setUrl(user.media);
            } else {
                user.media = {
                    url: platform.getDefaultProfileImageUrl()
                };
            }
        }

        function isAdmin() {
            return authentication
                .getToken()
                .then(function (token) {
                    if (! token) {
                        return false;
                    }

                    try {
                        var decodedToken = jwtHelper.decodeToken(token);

                        if (decodedToken.role === "admin") {
                            return "user";
                        } else if ((decodedToken.original && decodedToken.original.role === "admin")) {
                            return "originalUser";
                        } else {
                            return false;
                        }
                    } catch (e) {
                        return false;
                    }
                });
        }

        function isLoggedAs(currentUser) {
            return $q.all({
                    isAdmin: isAdmin(),
                    currentUser: currentUser || getCurrentUser()
                })
                .then(function (results) {
                    return (results.isAdmin && currentUser.role !== "admin");
                });
        }

        function getRefererUrl(user, source) {
            var src = source ? "?s=" + source : "";
            var slug;

            if (_.includes(["dev", "preprod"], platform.getEnvironment())) {
                return "https://sharinplace.fr/friend/Sharinplace-1" + src;
            }

            slug = User.getFullname.call(user, false, true);
            slug = tools.getURLStringSafe(slug);

            return platform.getBaseUrl() + "/friend/" + (slug ? slug + "-" : "") +  user.id + src;
        }

        function queryUsers(query, noLabel) {
            if (! query) {
                return $q.resolve([]);
            }

            return $http.get(apiBaseUrl + "/user?q=" + query)
                .then(function (res) {
                    var users = res.data;

                    if (noLabel) {
                        return users;
                    } else {
                        return _.map(users, function (user) {
                            var label = user.id;
                            if (user.firstname || user.lastname) {
                                label += " - " + (user.firstname || "") + " " + (user.lastname || "");
                            }

                            if (user.email) {
                                label += " - " + user.email;
                            }

                            user.label = label;
                            return user;
                        });
                    }
                });
        }

        function getAuthMeans() {
            return $http.get(apiBaseUrl + "/user/getAuthMeans")
                .then(function (res) {
                    return res.data;
                });
        }

        /**
         * Whether user has freeFees option activated
         * @param  {object}   user
         * @param  {string}   [dateISOString = now]
         * @return {boolean}
         */
        function isFreeFees(user, dateISOString) {
            if (! user) {
                return;
            }

            var now = dateISOString || moment().toISOString();

            return user.freeFeesDate && now < user.freeFeesDate;
        }

        /**
         * Compute freeFeesDate, as if applying freeFees once (more)
         * @param  {object}              user
         * @return {Promise.<string>}          - Date format: "YYYY-MM-DD"
         */
        function freeFeesNextDate(user) {
            return getParams()
                .then(function (params) {
                    var formatDate       = "YYYY-MM-DD";
                    var freeFeesDuration = _.get(params, "freeFees.duration");
                    var nextDate         = user && user.freeFeesDate // moment(null) returns invalid date
                        ? moment(user.freeFeesDate).add(freeFeesDuration).format(formatDate)
                        : moment().add(freeFeesDuration).format(formatDate);

                    return nextDate;
                });
        }

        /**
         * Whether user can apply free fees, use server defaults.
         * @param  {object}            user
         * @param  {string[]}          levelsOrder
         * @param  {object}            [args]                             - default params are defined server-side
         * @param  {string}            [args.minLevelId = "BEGINNER"]
         * @return {Promise.<object>}
         */
        function canApplyFreeFees(user, levelsOrder, args) {
            if (! user) {
                return $q.when({ result: false });
            }

            return getParams()
                .then(function (params) {
                    args = args || _.defaults({}, _.get(params, "freeFees"));

                    var errors = {};

                    // automatically free fees for sharinplace account
                    if (user.id === 1) {
                        errors.SHARINPLACE_ACCOUNT = true;
                    }
                    if (args.minLevelId) {
                        var minLevelIndex = _.findIndex(levelsOrder, args.minLevelId);
                        var levelIndex    = _.findIndex(levelsOrder, user.levelId);

                        if (levelIndex < minLevelIndex) {
                            errors.minLevel = true;
                        }
                    }

                    return exposeResult(errors);
                });


            function exposeResult(errors) {
                return {
                    result: ! _.keys(errors).length,
                    errors: errors
                };
            }
        }

        function getIncomeReport() {
            return $http.get(apiBaseUrl + "/user/income-report")
                .then(function (res) {
                    return res.data;
                });
        }

        function getIncomeReportUrl(userId, year, token) {
            return "/api/user/" + userId + "/income-report/" + year + "?t=" + token;
        }

        function getPaymentAccounts() {
            return $http.get(apiBaseUrl + '/user/payment-accounts')
                .then(function (res) {
                    return res.data;
                });
        }
    }

})();
