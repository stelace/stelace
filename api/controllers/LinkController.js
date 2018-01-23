/* global EmailTemplateService, GamificationService, GamificationEvent, Link, Media, MicroService, StelaceConfigService, StelaceEventService, User */

/**
 * LinkController
 *
 * @description :: Server-side logic for managing links
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {

    find: find,
    findOne: findOne,
    create: create,
    update: update,
    destroy: destroy,

    createReferredBy: createReferredBy,
    getFriends: getFriends,
    getReferer: getReferer,
    sendFriendEmails: sendFriendEmails

};

var moment = require('moment');
const _ = require('lodash');
const Promise = require('bluebird');
const createError = require('http-errors');

function find(req, res) {
    return res.forbidden();
}

function findOne(req, res) {
    return res.forbidden();
}

function create(req, res) {
    return res.forbidden();
}

function update(req, res) {
    return res.forbidden();
}

function destroy(req, res) {
    return res.forbidden();
}

function createReferredBy(req, res) {
    var fromUserId   = req.param("fromUserId");
    var source       = req.param("source");
    var date         = req.param("date");
    var relationship = "refer";

    if (fromUserId === req.user.id) {
        return res.badRequest();
    }

    return Promise
        .resolve()
        .then(() => {
            return StelaceConfigService.isFeatureActive('REFERRAL');
        })
        .then(active => {
            if (!active) {
                throw createError(403, 'Referral disabled');
            }
        })
        .then(() => {
            return [
                fromUserId ? User.findOne({ id: fromUserId }) : null,
                Link.find({
                    fromUserId: req.user.id,
                    relationship: relationship
                }),
                Link.find({
                    toUserId: req.user.id,
                    relationship: relationship
                })
            ];
        })
        .spread((fromUser, linksAsFromUser, linksAsToUser) => {
            if (fromUserId && ! fromUser) {
                throw createError(404);
            }

            var validatedLinksAsToUser = _.filter(linksAsToUser, { validated: true });

            if (linksAsFromUser.length) {
                // already member because he refered other people
                res.badRequest({ message: "ALREADY_REFERER" });
            } else if (validatedLinksAsToUser.length) {
                // only one referral link as friend
                res.badRequest({ message: "ONE_REFERRAL_PER_USER" });
            } else {
                return getEmailLinkInfo(req.user)
                    .then(emailLinkInfo => {
                        if (fromUser) {
                            if (emailLinkInfo) {
                                // take the most recent referral action
                                if (date && emailLinkInfo.link.createdDate < date) {
                                    return getNewValidatedLink(null, fromUser, req.user, source, req.logger);
                                } else {
                                    return getNewValidatedLink(emailLinkInfo.link, emailLinkInfo.fromUser, req.user, null, req.logger);
                                }
                            } else {
                                return getNewValidatedLink(null, fromUser, req.user, source, req.logger);
                            }
                        } else {
                            if (emailLinkInfo) {
                                return getNewValidatedLink(emailLinkInfo.link, emailLinkInfo.fromUser, req.user, null, req.logger);
                            } else {
                                return;
                            }
                        }
                    })
                    .then(link => {
                        if (!link) return;

                        return StelaceEventService.createEvent({
                            req,
                            res,
                            label: 'friend_referral.succeeded',
                            type: 'core',
                            targetUserId: link.fromUserId,
                        })
                        .then(() => link);
                    })
                    .then(link => {
                        if (link) {
                            res.json({ message: "SUCCESS" });
                        } else {
                            res.json({ message: "NONE" });
                        }
                    });
            }
        })
        .catch(res.sendError);



    function getEmailLinkInfo(toUser) {
        return Promise
            .resolve()
            .then(() => {
                return Link
                    .find({
                        email: toUser.email,
                        relationship: relationship,
                        source: "email"
                    })
                    .limit(1)
                    .then(links => links[0]);
            })
            .then(link => {
                if (! link) {
                    return;
                }

                return User
                    .findOne({ id: link.fromUserId })
                    .then(fromUser => {
                        if (! fromUser) {
                            var error = new Error("Fail to fetch from user in email link");
                            error.fromUserId = link.fromUserId;
                            error.linkId = link.id;
                            throw error;
                        }

                        return {
                            link: link,
                            fromUser: fromUser
                        };
                    });
            });
    }

    function getNewValidatedLink(link, fromUser, toUser, source, logger) {
        return Promise
            .resolve()
            .then(() => {
                if (link) {
                    var updateAttrs = {
                        toUserId: toUser.id,
                        validated: true
                    };
                    if (source) {
                        updateAttrs.source = source;
                    }

                    return Link.updateOne(link.id, updateAttrs);
                } else {
                    return Link.create({
                        fromUserId: fromUser.id,
                        toUserId: toUser.id,
                        email: toUser.email,
                        relationship: relationship,
                        validated: true,
                        source: source
                    });
                }
            })
            .then(link => {
                setGamification(fromUser, toUser, link, logger, req);
                return link;
            });
    }

    function setGamification(fromUser, toUser, link, logger, req) {
        GamificationService.checkActions(
            toUser,
            ["REGISTER_AS_FRIEND"],
            { REGISTER_AS_FRIEND: { link: link } },
            logger,
            req
        );
        GamificationService.checkActions(
            fromUser,
            ["A_FRIEND_REGISTERED"],
            { A_FRIEND_REGISTERED: { link: link } },
            logger,
            req
        );
    }
}

function getFriends(req, res) {
    var access        = "others";

    return Promise
        .resolve()
        .then(() => {
            return [
                Link.find({
                    fromUserId: { '!=': req.user.id },
                    relationship: "refer",
                    validated: true,
                    email: { '!=': null }
                }),
                Link
                    .find({
                        fromUserId: req.user.id,
                        relationship: "refer"
                    })
                    .sort('createdDate DESC')
            ];
        })
        .spread((otherLinks, myLinks) => {
            var indexedEmails = {};

            // if multiple same email links, take only most recent one
            var myDeduplicateLinks = _.reduce(myLinks, (memo, link) => {
                if (link.email) {
                    if (! indexedEmails[link.email]) {
                        indexedEmails[link.email] = true;
                        memo.push(link);
                    }
                } else {
                    memo.push(link);
                }

                return memo;
            }, []);

            return [
                otherLinks,
                myDeduplicateLinks,
                _getUsers(_.compact(_.pluck(myDeduplicateLinks, "toUserId")), access)
            ];
        })
        .spread((otherLinks, myDeduplicateLinks, users) => {
            var indexedOtherLinks = _.groupBy(otherLinks, "email");
            var indexedUsers      = _.indexBy(users, "id");

            var friends = _.map(myDeduplicateLinks, link => {
                var obj = {
                    referralStatus: null,
                    email: null,
                    media: null
                };

                if (link.toUserId) {
                    _.assign(obj, indexedUsers[link.toUserId] || {});
                }
                if (link.email) {
                    obj.email = obj.email || link.email;
                }

                if (link.validated) {
                    obj.referralStatus = "registered";
                } else {
                    if (link.email && indexedOtherLinks[link.email] && indexedOtherLinks[link.email].length) {
                        obj.referralStatus = "registered-by-other";
                    } else {
                        obj.referralStatus = "pending";
                    }
                }

                // Client-side ordering
                obj.linkUpdatedDate = link.updatedDate;
                obj.source          = link.source;

                return obj;
            });

            return populateFriendsActions(req.user.id, friends);
        })
        .then(friends => {
            res.json(friends);
        })
        .catch(res.sendError);



    function populateFriendsActions(userId, friends) {
        var friendActions = [
            "FRIEND_BEGINNER_LEVEL_AS_REFERER",
            "FRIEND_BOOKING_AS_REFERER",
            "FRIEND_RENTING_OUT_AS_REFERER"
        ];

        return GamificationEvent
            .find({
                userId: userId,
                type: "action",
                actionId: friendActions
            })
            .then(gamificationEvents => {
                var indexedFriends = _.indexBy(friends, "id");

                _.forEach(gamificationEvents, event => {
                    if (! event.reference || ! event.reference.friendUserId) {
                        return;
                    }

                    var friend = indexedFriends[event.reference.friendUserId];
                    if (friend) {
                        friend[event.actionId] = true;
                    }
                });

                return friends;
            })
            .catch(() => friends);
    }
}

function getReferer(req, res) {
    var access = "others";

    return Promise
        .resolve()
        .then(() => {
            return Link
                .find({
                    toUserId: req.user.id,
                    relationship: "refer",
                    validated: true
                })
                .limit(1)
                .then(links => links[0]);
        })
        .then(link => {
            if (! link) {
                return res.json({ none: true });
            }

            return _getUsers([link.fromUserId], access)
                .then(users => {
                    if (! users.length) {
                        throw createError(404);
                    }

                    res.json(users[0]);
                });
        })
        .catch(res.sendError);
}

function sendFriendEmails(req, res) {
    var emails = req.param("emails");
    var referrerMedia;

    if (! emails || ! _.isArray(emails)) {
        return res.badRequest();
    }

    emails = _(emails).uniq()
        .filter(email => MicroService.isEmail(email))
        .value();

    return Promise
        .resolve()
        .then(() => {
            return StelaceConfigService.isFeatureActive('REFERRAL');
        })
        .then(active => {
            if (!active) {
                throw createError(403, 'Referral disabled');
            }
        })
        .then(() => {
            return [
                User.find({
                    email: { '!=': null }
                }),
                Link.find({
                    relationship: "refer",
                    validated: true,
                    email: { '!=': null }
                }),
                Link
                    .find({
                        fromUserId: req.user.id,
                        relationship: "refer"
                    })
                    .sort('createdDate ASC'),
                User
                    .getMedia([req.user])
            ];
        })
        .spread((users, validatedEmailLinks, ownLinks, media) => {
            emails        = getNonValidatedEmails(emails, users, validatedEmailLinks);
            emails        = getDebouncedEmails(emails, ownLinks);
            referrerMedia = media && media[req.user.id];

            return emails;
        })
        .then(emails => {
            return Promise
                .resolve(emails)
                .map(email => {
                    sendInviteEmail(req.user, email, referrerMedia);

                    return Link
                        .create({
                            fromUserId: req.user.id,
                            relationship: "refer",
                            email: email,
                            source: "email"
                        })
                        .catch(err => {
                            req.logger.warn({
                                err: err,
                                userId: req.user.id,
                                email: email
                            }, "Fail to create email friend link");
                        });
                });
        })
        .then(() => res.sendStatus(200))
        .catch(res.sendError);



    function getNonValidatedEmails(emails, users, links) {
        var userEmails          = _.pluck(users, "email");
        var validatedEmailLinks = _.pluck(links, "email");

        return _.difference(emails, userEmails.concat(validatedEmailLinks));
    }

    function getDebouncedEmails(emails, links) {
        var durationDays = 7;
        var indexedLinks = _.groupBy(links, "email");

        var debouncedEmails = _.filter(emails, email => {
            if (! indexedLinks[email]) {
                return true;
            }

            var lastLink = _.last(indexedLinks[email]);

            return lastLink.createdDate < moment().subtract(durationDays, "d").toISOString();
        });

        return debouncedEmails;
    }

    function sendInviteEmail(user, email, referrerMedia) {
        return EmailTemplateService
            .sendEmailTemplate('invite-friend', {
                email: email,
                referrer: user,
                referrerMedia: referrerMedia
            })
            .catch(err => {
                req.logger.warn({
                    err: err,
                    userId: req.user.id,
                    email: email
                }, "Fail to send friend email");
            });
    }
}

function _getUsers(usersIds, access) {
    access = access || "others";

    return Promise
        .resolve()
        .then(() => {
            return User.find({ id: usersIds });
        })
        .then(users => {
            return [
                users,
                User.getMedia(users)
            ];
        })
        .spread((users, hashMedias) => {
            users = _.map(users, user => {
                var email = user.email;
                user       = User.expose(user, access);
                user.email = email; // if access === "others", email isn't exposed
                user.media = Media.expose(hashMedias[user.id], access);
                return user;
            });

            return users;
        });
}
