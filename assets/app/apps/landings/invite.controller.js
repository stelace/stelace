/* global ga */

(function () {

    angular
        .module("app.landings")
        .controller("InviteController", InviteController);

    function InviteController($document,
                                $q,
                                $rootScope,
                                $scope,
                                $state,
                                $stateParams,
                                $timeout,
                                authenticationModal,
                                cache,
                                ezfb,
                                ItemService,
                                loggerToServer,
                                MediaService,
                                platform,
                                referral,
                                StelaceConfig,
                                StelaceEvent,
                                toastr,
                                tools,
                                User,
                                UserService) {

        var listeners = [];
        var currentUser;
        var canonicalUrl;
        var currentEmailInput;
        var sendingEmails;
        var showEmailInputTimeout;
        var refreshFriendsTimeout;

        var vm = this;
        vm.referSteps = [{
            label: "Inviter",
            content: "Invitez simplement vos amis à rejoindre la communauté Sharinplace en partageant votre lien de parrainage, via Facebook, par email ou sur votre blog.",
            icon: "megaphone"
        }, {
            label: "Encourager",
            content: "Aidez vos filleuls à faire leurs premiers pas sur la plateforme en les encourageant à déposer leurs annonces.",
            icon: "chat-bubble-two"
        }, {
            label: "Profiter",
            content: "Vous êtes récompensés à chaque fois qu'un nouveau filleul s'inscrit, complète son profil, vend, loue ou réserve du matériel pour la première fois.",
            icon: "trophy"
        }];
        vm.friends                  = [];
        vm.emailInviteList          = [];
        vm.hideEmailInvite          = true;
        vm.emailAddressError        = false;
        vm.activateSendEmailsButton = false;
        vm.footerTestimonials       = true;

        vm.login             = login;
        vm.register          = register;
        vm.toggleEmailInvite = toggleEmailInvite;
        vm.emailTag          = emailTag;
        vm.currentEmailTag   = currentEmailTag;
        vm.sendEmailsInvite  = sendEmailsInvite;
        vm.shareEvent        = shareEvent;

        activate();



        function activate() {
            if (!StelaceConfig.isFeatureActive('REFERRAL')) {
                return $state.go('404');
            }

            canonicalUrl = platform.getBaseUrl() + $state.current.urlWithoutParams;

            listeners.push(
                $rootScope.$on("isAuthenticated", function (event, isAuthenticated) {
                    if (! isAuthenticated) {
                        currentUser    = null;
                        vm.currentUser = null;
                        vm.friends     = [];
                    } else if (isAuthenticated && ! currentUser) { // avoid duplicate requests
                        _populateView();
                    }
                })
            );

            $scope.$on("$destroy", function () {
                _.forEach(listeners, function (listener) {
                    listener();
                });
                $timeout.cancel(showEmailInputTimeout);
                $timeout.cancel(refreshFriendsTimeout);
            });

            return _populateView()
                .then(_populateFriends)
                .then(function () {
                    if (currentUser && vm.inviteUrl) {
                        var description = "Profitez d'objets en libre-service "
                            + (vm.currentUser.displayName ? "grâce au parrainage de " + vm.currentUser.displayName + " " : "");

                        description    = encodeURIComponent(description + "en vous inscrivant dès maintenant sur Sharinplace.");

                         vm.twInviteUrl = "https://twitter.com/intent/tweet?"
                         + "url=" + UserService.getRefererUrl(vm.currentUser, "twitter")
                         + "&text=" + description;
                         // + "&hashtags=cadeau,partage"; // no char left
                    }

                    StelaceEvent.sendEvent("Invite view");

                    _setSEOTags();
                    platform.setPageStatus("ready");
                })
                .catch(function (err) {
                    platform.setMetaTags({ "status-code": 500 });
                    platform.setPageStatus("ready");

                    loggerToServer.error(err);
                });
        }

        function _populateView() {
            return UserService.getCurrentUser()
                .then(function (user) {
                    if (! user) {
                        currentUser    = null;
                        vm.currentUser = null;
                        return;
                    }

                    currentUser = user;

                    currentUser.fullname = User.getFullname.call(currentUser);
                    currentUser.displayName = currentUser.firstname || currentUser.fullname;

                    vm.currentUser = currentUser;
                    vm.inviteUrl   = UserService.getRefererUrl(vm.currentUser);
                });
        }

        function _populateFriends() {
            return currentUser && referral
                .getFriends()
                .then(function (friends) {
                    _.forEach(friends, function (friend) {
                        if (friend.media) {
                            MediaService.setUrl(friend.media);
                        } else {
                            friend.media = { url: platform.getDefaultProfileImageUrl() };
                        }
                    });
                    vm.friends = friends;
                });
        }

        function _setSEOTags() {
            var description = "En parrainant vos amis, empruntez nos objets Sharinplace en libre-service et gagnez d'autres récompenses.";
            var title       = "Obtenez des récompenses en parrainant vos amis";

            platform.setTitle(title + " sur Sharinplace");
            platform.setMetaTags({ description: description });
            platform.setOpenGraph({
                "og:url": canonicalUrl,
                "og:title": title,
                "og:description": description,
                "og:type": "website"
            });
            platform.setTwitterCard({
                "twitter:title": title,
                "twitter:description": description
            });
            platform.setCanonicalLink(canonicalUrl);
        }

        function login() {
            var authModalOptions = {
                greeting: "Connectez-vous pour parrainer vos amis et obtenir des récompenses."
            };
            return UserService.getCurrentUser()
                .then(function (currentUser) {
                    if (currentUser) {
                        return _populateView();
                    }

                    return authenticationModal.process("login", authModalOptions)
                        .then(function (isAuth) {
                            if (isAuth) {
                                return toastr.success("Vous progresserez sur Sharinplace à chaque inscription ou échange d'un de vos filleuls.",
                                    "Plus on est de fous...", {
                                        timeOut: 15000
                                });
                            } else {
                                return toastr.info("Vous pouvez recevoir de nombreuses récompenses en parrainant d'autres membres sur Sharinplace.",
                                    "Plus vous participez, plus vous êtes récompensés", {
                                        timeOut: 15000
                                });
                            }
                        });
                });
        }

        function register() {
            var authModalOptions = {
                greeting: "Inscrivez-vous pour profiter de nos objets en libre-service ou pour vendre et louer vos propres objets sur Sharinplace."
            };
            return UserService.getCurrentUser()
                .then(function (currentUser) {
                    if (currentUser) {
                        return _populateView();
                    }

                    return authenticationModal.process("register", authModalOptions)
                        .then(function (isAuth) {
                           if (isAuth) {
                               return toastr.success("Vous progresserez sur Sharinplace à chaque inscription ou échange d'un de vos filleuls.",
                                    "Plus on est de fous...", {
                                        timeOut: 0,
                                        closeButton: true
                               });
                           } else {
                               return toastr.info("Vous pouvez recevoir de nombreuses récompenses en parrainant d'autres membres sur Sharinplace.",
                                    "Plus vous participez, plus vous êtes récompensés", {
                                        timeOut: 15000
                               });
                           }
                        });
                });
        }

        function toggleEmailInvite() {
            vm.hideEmailInvite = ! vm.hideEmailInvite;

            if (! vm.hideEmailInvite) {
                showEmailInputTimeout = $timeout(function () {
                    $scope.$broadcast("emailInputFocus");
                }, 300);
            }
        }

        function emailTag(email) {
            if (! email) {
                return;
            } else if (email[email.length - 1] === ',') {
                // Fix ui-select bug: tag string can include comma if used as a separator, due to tagging-label being false
                // See https://github.com/angular-ui/ui-select/issues/757
                // But not using tagging label causes others issues... https://github.com/angular-ui/ui-select/issues/755
                email = email.slice(0, -1);
            }

            if (currentUser && currentUser.email === email) {
                toastr.info("Vous avez sans doute des amis qui aimeraient vous rejoindre sur Sharinplace\xa0:)", "Vous êtes déjà inscrit\xa0:o");
            } else if (tools.isEmail(email) && email !== currentUser.email) {
                vm.emailAddressError = false;
                return {
                    email: email
                };
            } else {
                vm.emailAddressError = true;
                // toastr.info("Oups, il semble que l'adresse indiquée soit erronée.", "Adresse invalide");
            }
        }

        function currentEmailTag(query) {
            if (tools.isEmail(query)) {
                currentEmailInput = query;
                vm.activateSendEmailsButton = true;
            } else {
                currentEmailInput = null;
                vm.activateSendEmailsButton = false;
            }
        }

        function sendEmailsInvite() {
            var emailsToSend = _.pluck(vm.emailInviteList, "email");
            var nbEmails;

            if (sendingEmails) {
                return;
            } else if (currentEmailInput && typeof emailTag(currentEmailInput) === "object") { // valid email tag
                emailsToSend.push(currentEmailInput);
                currentEmailInput = null;
            }

            nbEmails = emailsToSend.length;

            if (! nbEmails) {
                return;
            }

            vm.activateSendEmailsButton = false;
            sendingEmails               = true;

            return referral
                .sendFriendEmails(emailsToSend)
                .then(function () {
                    toastr.success("Vous commencerez à recevoir des récompenses dès l'inscription de vos amis.",
                        vm.emailInviteList.length > 1 ? "Invitations envoyées" : "Invitation envoyée");
                    vm.emailAddressError = false;

                    var gaLabel = 'Medium: "' + nbEmails + 'email' + (nbEmails > 1 ? 's"' : '"');
                    ga('send', 'event', 'Accounts', 'Invite', gaLabel);

                    StelaceEvent.sendEvent("Invite email", { // can be checked on facebook only (without SDKs)
                        type: "click",
                        data: {
                            emailAddresses: emailsToSend
                        }
                    });

                    vm.emailInviteList = [];
                })
                .then(function () {
                    refreshFriendsTimeout = $timeout(function () {
                        return _populateFriends();
                    }, 1000);
                })
                .catch(function (err) {
                    toastr.warning("Nous sommes désolés et cherchons à résoudre le problème. Veuillez recommencer plus tard.",
                        "Oups, une erreur s'est produite");
                    loggerToServer.error(err);
                })
                .finally(function () {
                    sendingEmails = false;
                });
        }

        function shareEvent(site) {
            var gaLabel          = 'Medium: "' + site + '"';
            var stlShareEventData = { site: site }; // facebook, twitter
            var stlShareEvent;

            ga('send', 'event', 'Accounts', 'Invite', gaLabel);

            StelaceEvent.sendEvent("Invite social share intent", { // can be checked afterwards for facebook only (without SDKs)
                type: "click",
                data: stlShareEventData
            })
            .then(function (stelaceEvent) {
                stlShareEvent = stelaceEvent;
            });

            if (site === "facebook") {
                ezfb.ui({
                    method: "share",
                    href: UserService.getRefererUrl(vm.currentUser, "facebook")
                }, function (response) {
                    // In Graph API v2.8, response after effective sharing is []
                    if (response && ! response.error_code) { // error corde only for fb authorized users
                        toastr.success("Vous commencerez à recevoir des récompenses dès l'inscription de vos amis\xa0;)",
                            "Merci d'avoir partagé\xa0!");
                        stlShareEventData.success = true;
                        stlShareEvent.update({ data: stlShareEventData });
                    }
                });
            }

        }

    }

})();
