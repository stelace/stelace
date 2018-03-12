/* global
    Booking, EmailTemplateService, GamificationEvent, Link, Location, Reward,
    StelaceConfigService, StelaceEventService, UAService, User
*/

module.exports = {

    getLevelsOrder: getLevelsOrder,
    getLevels: getLevels,
    getBadges: getBadges,
    getActions: getActions,
    setBadges: setBadges,
    checkActions: checkActions,
    setActions: setActions,
    recompute: recompute,
    getUsersStats: getUsersStats,
    getNextLevelId: getNextLevelId

};

var moment = require('moment');
const _ = require('lodash');
const Promise = require('bluebird');
const createError = require('http-errors');

var cf = _getConfig();

// to reach the next level, users must have enough points and do the required actions
var levels = {
    BEGINNER: {
        id: "BEGINNER",
        requirements: {
            points: 20,
            actions: [
                "ADD_FIRSTNAME",
                "EMAIL_VALIDATION",
                "PHONE_VALIDATION"
            ]
        },
        rewards: {
            custom: cf.levels.customRewards.BEGINNER
        },
        hook: cf.levels.hooks.BEGINNER
    },
    BRONZE: {
        id: "BRONZE",
        requirements: {
            points: 60,
            actions: [
                "FIRST_VALID_LISTING_AD",
                "ADD_PROFILE_IMAGE"
            ]
        },
        rewards: {
            custom: cf.levels.customRewards.BRONZE
        }
    },
    SILVER: {
        id: "SILVER",
        requirements: {
            points: 180,
            actions: [
                "FIRST_COMPLETE_BOOKING",
                "FIRST_RATING",
                "A_FRIEND_REGISTERED",
                "ADD_DESCRIPTION"
            ]
        },
        rewards: {
            types: [
                "AMBASSADOR_KIT"
            ],
            custom: cf.levels.customRewards.SILVER
        }
    },
    GOLD: {
        id: "GOLD",
        requirements: {
            points: 360,
            actions: [
                "FEEDBACK",
            ]
        },
        rewards: {
            types: [
                "GOODIES"
            ],
            custom: cf.levels.customRewards.GOLD
        }
    }
};

var badges = {

};

var actions = {
    ADD_FIRSTNAME: {
        id: "ADD_FIRSTNAME",
        points: 2,
        suggestionOrder: 1,
        actionType: "profile",
        once: true,
        check: cf.actions.checks.ADD_FIRSTNAME,
        customApply: cf.actions.customApplies.ADD_FIRSTNAME
    },
    ADD_LASTNAME: {
        id: "ADD_LASTNAME",
        points: 2,
        suggestionOrder: 0,
        actionType: "profile",
        once: true,
        check: cf.actions.checks.ADD_LASTNAME,
        customApply: cf.actions.customApplies.ADD_LASTNAME
    },
    ADD_DESCRIPTION: {
        id: "ADD_DESCRIPTION",
        points: 2,
        suggestionOrder: 6,
        actionType: "profile",
        once: true,
        check: cf.actions.checks.ADD_DESCRIPTION,
        customApply: cf.actions.customApplies.ADD_DESCRIPTION
    },
    EMAIL_VALIDATION: {
        id: "EMAIL_VALIDATION",
        points: 3,
        suggestionOrder: 1,
        actionType: "profile",
        once: true,
        check: cf.actions.checks.EMAIL_VALIDATION,
        customApply: cf.actions.customApplies.EMAIL_VALIDATION
    },
    PHONE_VALIDATION: {
        id: "PHONE_VALIDATION",
        points: 3,
        suggestionOrder: 3,
        actionType: "profile",
        once: true,
        check: cf.actions.checks.PHONE_VALIDATION,
        customApply: cf.actions.customApplies.PHONE_VALIDATION
    },
    ADD_PROFILE_IMAGE: {
        id: "ADD_PROFILE_IMAGE",
        points: 3,
        suggestionOrder: 2.5,
        actionType: "profile",
        once: true,
        check: cf.actions.checks.ADD_PROFILE_IMAGE,
        customApply: cf.actions.customApplies.ADD_PROFILE_IMAGE
    },
    FIRST_LOCATIONS_NB_2: {
        id: "FIRST_LOCATIONS_NB_2",
        points: 2,
        suggestionOrder: 8,
        actionType: "profile",
        once: true,
        check: cf.actions.checks.FIRST_LOCATIONS_NB_2,
        customApply: cf.actions.customApplies.FIRST_LOCATIONS_NB_2
    },
    REGISTER_AS_FRIEND: {
        id: "REGISTER_AS_FRIEND",
        points: 0,
        suggestionOrder: 0,
        actionType: "wom",
        once: true,
        check: cf.actions.checks.REGISTER_AS_FRIEND,
        customApply: cf.actions.customApplies.REGISTER_AS_FRIEND,
    },
    A_FRIEND_REGISTERED: {
        id: "A_FRIEND_REGISTERED",
        points: 2,
        suggestionOrder: 4, // from 2.5
        // wait for user to discover website value
        actionType: "wom",
        check: cf.actions.checks.A_FRIEND_REGISTERED,
        customApply: cf.actions.customApplies.A_FRIEND_REGISTERED
    },
    FRIEND_BEGINNER_LEVEL_AS_REFERER: {
        id: "FRIEND_BEGINNER_LEVEL_AS_REFERER",
        points: 8,
        suggestionOrder: 0,
        actionType: "wom",
        check: cf.actions.checks.FRIEND_BEGINNER_LEVEL_AS_REFERER,
        customApply: cf.actions.customApplies.FRIEND_BEGINNER_LEVEL_AS_REFERER
    },
    FRIEND_BOOKING_AS_REFERER: {
        id: "FRIEND_BOOKING_AS_REFERER",
        points: 0,
        suggestionOrder: 101,
        actionType: "wom",
        check: cf.actions.checks.FRIEND_BOOKING_AS_REFERER,
        customApply: cf.actions.customApplies.FRIEND_BOOKING_AS_REFERER,
        hook: cf.actions.hooks.FRIEND_BOOKING_AS_REFERER
    },
    FRIEND_RENTING_OUT_AS_REFERER: {
        id: "FRIEND_RENTING_OUT_AS_REFERER",
        points: 0,
        suggestionOrder: 101,
        actionType: "wom",
        check: cf.actions.checks.FRIEND_RENTING_OUT_AS_REFERER,
        customApply: cf.actions.customApplies.FRIEND_RENTING_OUT_AS_REFERER,
        hook: cf.actions.hooks.FRIEND_RENTING_OUT_AS_REFERER
    },
    EXTERNAL_REVIEW: {
        id: "EXTERNAL_REVIEW",
        points: 5,
        suggestionOrder: 7,
        actionType: "wom",
        check: cf.actions.checks.EXTERNAL_REVIEW, // true
        customApply: cf.actions.customApplies.EXTERNAL_REVIEW
    },
    FEEDBACK: {
        id: "FEEDBACK",
        points: 10,
        suggestionOrder: 7,
        actionType: "wom",
        check: cf.actions.checks.FEEDBACK, // true
        customApply: cf.actions.customApplies.FEEDBACK
    },
    FIRST_MOBILE_CONNECTION: {
        id: "FIRST_MOBILE_CONNECTION",
        points: 2,
        suggestionOrder: 6,
        actionType: "discover",
        once: true,
        check: cf.actions.checks.FIRST_MOBILE_CONNECTION,
        customApply: cf.actions.customApplies.FIRST_MOBILE_CONNECTION
    },
    FIRST_VALID_LISTING_AD: {
        id: "FIRST_VALID_LISTING_AD",
        points: 5,
        suggestionOrder: 2,
        actionType: "discover",
        once: true,
        check: cf.actions.checks.FIRST_VALID_LISTING_AD,
        customApply: cf.actions.customApplies.FIRST_VALID_LISTING_AD
    },
    FIRST_BOOKING: {
        id: "FIRST_BOOKING",
        points: 5,
        suggestionOrder: 4,
        actionType: "discover",
        once: true,
        check: cf.actions.checks.FIRST_BOOKING,
        customApply: cf.actions.customApplies.FIRST_BOOKING
    },
    FIRST_RENTING_OUT: {
        id: "FIRST_RENTING_OUT",
        points: 5,
        suggestionOrder: 0,
        actionType: "discover",
        once: true,
        check: cf.actions.checks.FIRST_RENTING_OUT,
        customApply: cf.actions.customApplies.FIRST_RENTING_OUT
    },
    FIRST_COMPLETE_BOOKING: {
        id: "FIRST_COMPLETE_BOOKING",
        points: 5,
        suggestionOrder: 0,
        actionType: "discover",
        once: true,
        check: cf.actions.checks.FIRST_COMPLETE_BOOKING,
        customApply: cf.actions.customApplies.FIRST_COMPLETE_BOOKING
    },
    FIRST_RATING: {
        id: "FIRST_RATING",
        points: 8,
        suggestionOrder: 5,
        actionType: "discover",
        once: true,
        check: cf.actions.checks.FIRST_RATING,
        customApply: cf.actions.customApplies.FIRST_RATING
    },
    CONNECTION_OF_THE_DAY: {
        id: "CONNECTION_OF_THE_DAY",
        points: 1,
        suggestionOrder: 0,
        actionType: "explore",
        check: cf.actions.checks.CONNECTION_OF_THE_DAY,
        customApply: cf.actions.customApplies.CONNECTION_OF_THE_DAY
    },
    VALID_LISTING_AD: {
        id: "VALID_LISTING_AD",
        points: 5,
        suggestionOrder: 100,
        actionType: "explore",
        check: cf.actions.checks.VALID_LISTING_AD,
        customApply: cf.actions.customApplies.VALID_LISTING_AD
    },
    COMPLETE_BOOKING: {
        id: "COMPLETE_BOOKING",
        points: 10,
        suggestionOrder: 0,
        actionType: "explore",
        check: cf.actions.checks.COMPLETE_BOOKING,
        customApply: cf.actions.customApplies.COMPLETE_BOOKING
    },
};

function getLevelsOrder() {
    return ["BEGINNER", "BRONZE", "SILVER", "GOLD"];
}

function getLevels() {
    return levels;
}

function getBadges() {
    return badges;
}

function getActions() {
    return actions;
}

function setBadges(user, badgesIds, req) {
    var sessionId = _getSessionId(req, user);

    return Promise
        .resolve()
        .then(() => {
            return GamificationEvent.find({ userId: user.id });
        })
        .then(gamificationEvents => {
            var userStats = _getUserStats(gamificationEvents);

            return Promise
                .resolve(badgesIds)
                .mapSeries(badgeId => {
                    return _setBadge(user, badgeId, userStats, sessionId);
                })
                .then(statesOfUser => {
                    return _.last(statesOfUser);
                });
        });
}

function checkActions(user, actionsIds, actionsData, logger, req) {
    actionsIds  = _.uniq(actionsIds);
    actionsData = actionsData || {};
    var actions = getActions();

    if (! actionsIds.length) {
        return Promise.resolve(user);
    }

    var sessionId = _getSessionId(req, user);
    var active;

    return Promise
        .resolve()
        .then(() => {
            return StelaceConfigService.isFeatureActive('GAMIFICATION')
                .then(result => {
                    active = result;
                });
        })
        .then(() => {
            if (!active) return;

            return GamificationEvent.find({ userId: user.id });
        })
        .then(gamificationEvents => {
            if (!active) return;

            var userStats = _getUserStats(gamificationEvents);

            return Promise
                .resolve(actionsIds)
                .mapSeries(actionId => {
                    var action = actions[actionId];

                    if (! action) {
                        var error = new Error("Unknown action id");
                        error.actionId = actionId;
                        throw error;
                    }

                    // do not set action if it is only once and already done
                    if (action.once && userStats.actions[actionId]) {
                        return [user];
                    }

                    var checkAndSetAction = function (data) {
                        return Promise
                            .resolve()
                            .then(() => {
                                if (typeof action.check === "undefined") {
                                    return false;
                                } else if (typeof action.check === "boolean") {
                                    return action.check;
                                } else if (typeof action.check === "function") {
                                    return action.check(user, data, userStats);
                                } else {
                                    throw new Error('Missing action check');
                                }
                            })
                            .then(checked => {
                                if (! checked) {
                                    return;
                                }

                                return _setAction(user, actionId, data, userStats, logger, sessionId);
                            });
                    };

                    // if array provided, check and set action multiple times
                    if (_.isArray(actionsData[actionId])) {
                        return Promise
                            .resolve(actionsData[actionId])
                            .mapSeries((data, index) => {
                                // do not set action if it is only once and already done
                                if (action.once && userStats.actions[actionId]) {
                                    return user;
                                }

                                actionsData[actionId][index] = actionsData[actionId][index] || {};
                                return checkAndSetAction(actionsData[actionId][index]);
                            })
                            .then(statesOfUser => _.last(statesOfUser));
                    } else {
                        actionsData[actionId] = actionsData[actionId] || {};
                        return checkAndSetAction(actionsData[actionId]);
                    }
                })
                .then(statesOfUser => _.last(statesOfUser));
        })
        .catch(err => {
            logger.warn({ err: err }, "Gamification check actions fail");
        });
}

// Exposed function to set actions manually
function setActions(user, actionsIds, actionsData, logger, userStats, req) {
    actionsIds  = _.uniq(actionsIds);
    actionsData = actionsData || {};
    var actions = getActions();

    if (! actionsIds.length) {
        return Promise.resolve(user);
    }

    var sessionId = _getSessionId(req, user);
    var active;

    return Promise
        .resolve()
        .then(() => {
            return StelaceConfigService.isFeatureActive('GAMIFICATION')
                .then(result => {
                    active = result;
                });
        })
        .then(() => {
            if (!active) return;
            if (! userStats) {
                return GamificationEvent.find({ userId: user.id });
            }
        })
        .then(gamificationEvents => {
            if (!active) return;

            userStats = userStats || _getUserStats(gamificationEvents);

            return Promise
                .resolve(actionsIds)
                .mapSeries(actionId => {
                    var action = actions[actionId];

                    if (! action) {
                        var error = new Error("Unknown action id");
                        error.actionId = actionId;
                        throw error;
                    }

                    // do not set action if it is only once and already done
                    if (action.once && userStats.actions[actionId]) {
                        return [user];
                    }

                    // if array provided, check and set action multiple times
                    if (_.isArray(actionsData[actionId])) {
                        return Promise
                            .resolve(actionsData[actionId])
                            .mapSeries((data, index) => {
                                // do not set action if it is only once and already done
                                if (action.once && userStats.actions[actionId]) {
                                    return user;
                                }

                                actionsData[actionId][index] = actionsData[actionId][index] || {};
                                return _setAction(user, actionId, actionsData[actionId][index], userStats, logger, sessionId);
                            })
                            .then(statesOfUser => _.last(statesOfUser));
                    } else {
                        actionsData[actionId] = actionsData[actionId] || {};
                        return _setAction(user, actionId, actionsData[actionId], userStats, logger, sessionId);
                    }
                })
                .then(statesOfUser => _.last(statesOfUser));
        })
        .catch(err => {
            logger.error({ err: err }, "Gamification set actions fail");
        });
}

function _setAction(user, actionId, data, userStats, logger, sessionId) {
    var actions = getActions();
    var action  = actions[actionId];

    if (! action) {
        var error = new Error("Unknown action id");
        error.actionId = actionId;
        return Promise.reject(error);
    }

    // do not set action if it is only once and already done
    if (action.once && userStats.actions[actionId]) {
        return Promise.resolve(user);
    }

    return Promise
        .resolve()
        .then(() => {
            var createAttrs = {
                userId: user.id,
                type: "action",
                levelId: userStats.levelId,
                actionId: action.id,
                points: action.points || 0,
                sessionId: sessionId
            };

            return Promise
                .resolve()
                .then(() => {
                    if (typeof action.customApply === "function") {
                        return action.customApply(createAttrs, user, data, userStats, action);
                    }
                })
                .then(() => {
                    return GamificationEvent.create(Object.assign({}, createAttrs));
                });
        })
        .then(gamificationEvent => {
            userStats.actions[actionId] = userStats.actions[actionId] || 0;
            ++userStats.actions[actionId];

            userStats.actionsDetails[actionId] = userStats.actionsDetails[actionId] || [];
            userStats.actionsDetails[actionId].push(gamificationEvent);

            userStats.points += (action.points || 0);

            if (user.points !== userStats.points) {
                return User
                    .updateOne(user.id, { points: userStats.points })
                    .then(u => {
                        user.points = u.points;
                    });
            }
        })
        .then(() => {
            if (! action.rewards
             || (action.rewards.once && userStats.actionsDetails[actionId].length > 1)
            ) {
                return;
            }

            return _setRewards(user, action, "action", userStats, sessionId);
        })
        .then(() => {
            var newLevels = _getNewLevels(userStats);

            if (! newLevels.length) {
                return;
            }

            var allPromises = _.map(newLevels, levelId => _setLevel(user, levelId, userStats, logger, sessionId));
            return Promise.all(allPromises);
        })
        .then(() => {
            if (typeof action.hook === "function") {
                return action.hook(user, data, userStats, logger);
            }

            return;
        })
        .then(() => user);
}

function _setBadge(user, badgeId, userStats, sessionId) {
    var badges = getBadges();
    var badge  = badges[badgeId];

    var active;

    return Promise
        .resolve()
        .then(() => {
            return StelaceConfigService.isFeatureActive('GAMIFICATION')
                .then(result => {
                    active = result;
                });
        })
        .then(() => {
            if (! badge) {
                var error = new Error("Unknown badge id");
                error.badgeId = badgeId;
                throw error;
            }

            if (!active) {
                return;
            }
            if (userStats.badges[badgeId]) {
                return;
            }

            var createAttrs = {
                userId: user.id,
                type: "badge",
                levelId: userStats.levelId,
                badgeId: badge.id,
                sessionId: sessionId
            };

            return GamificationEvent.create(createAttrs)
                .then(() => {
                    userStats.badges[badgeId] = true;
                });
        })
        .then(() => user);
}

function _setLevel(user, levelId, userStats, logger, sessionId) {
    var levels = getLevels();
    var level  = levels[levelId];

    return Promise
        .resolve()
        .then(() => {
            if (! level) {
                var error = new Error("Unknown level id");
                error.levelId = levelId;
                throw error;
            }

            if (userStats.levelId === level.id) {
                return;
            }

            var createAttrs = {
                userId: user.id,
                type: "level",
                levelId: level.id,
                sessionId: sessionId
            };

            return GamificationEvent
                .create(createAttrs)
                .then(() => {
                    userStats.levelId = level.id;

                    return User.updateOne(user.id, { levelId: level.id })
                        .then(u => {
                            user.levelId = u.levelId;
                        });
                })
                .then(() => {
                    // if the user didn't already reach this level
                    if (userStats.levels[levelId]) {
                        return;
                    }

                    userStats.levels[levelId] = level.id;

                    return _setRewards(user, level, "level", userStats, sessionId);
                });
        })
        .then(() => {
            if (typeof level.hook === "function") {
                return level.hook(user, userStats, logger, sessionId);
            }

            return;
        })
        .then(() => user);
}

function _setRewards(user, model, modelType, userStats, sessionId) {
    return Promise
        .resolve()
        .then(() => {
            if (! _.contains(["action", "level"], modelType)) {
                throw new Error('Bad gamification model');
            }

            if (! model.rewards) {
                return;
            }

            var allPromises = [];

            if (model.rewards.badges && model.rewards.badges.length) {
                _.forEach(model.rewards.badges, badgeId => {
                    allPromises.push(_setBadge(user, badgeId, userStats, sessionId));
                });
            }
            if (model.rewards.types && model.rewards.types.length) {
                _.forEach(model.rewards.types, type => {
                    allPromises.push(setSimpleReward(user, type, model, modelType, sessionId));
                });
            }
            if (typeof model.rewards.custom === "function") {
                allPromises.push(model.rewards.custom);
            }

            return Promise.all(allPromises);
        });



    function setSimpleReward(user, type, model, modelType, sessionId) {
        var createAttrs = {
            userId: user.id,
            type: type,
            triggerType: modelType,
            triggerId: model.id,
            sessionId: sessionId
        };

        return Reward.create(createAttrs);
    }
}

function recompute(users) {
    return Promise
        .resolve()
        .then(() => {
            return getUsersStats(users);
        })
        .then(usersStats => {
            return Promise
                .resolve(users)
                .map(user => {
                    var userStats = usersStats[user.id];

                    if (user.points !== userStats.points
                     || user.levelId !== userStats.levelId
                    ) {
                        return User
                            .updateOne(user.id, {
                                points: userStats.points,
                                levelId: userStats.levelId
                            })
                            .then(u => {
                                user.points  = u.points;
                                user.levelId = u.levelId;
                                return user;
                            });
                    } else {
                        return user;
                    }
                });
        });
}

function getUsersStats(users) {
    return Promise
        .resolve()
        .then(() => {
            var usersIds = _.pluck(users, "id");

            return [
                usersIds,
                GamificationEvent.find({ userId: usersIds })
            ];
        })
        .spread((usersIds, gamificationEvents) => {
            var indexedGamificationEvents = _.groupBy(gamificationEvents, "userId");

            return _.reduce(usersIds, (memo, userId) => {
                memo[userId] = _getUserStats(indexedGamificationEvents[userId]);
                return memo;
            }, {});
        });
}

function _getUserStats(gamificationEvents) {
    var stats       = {
        points: 0,
        levelId: null,
        nextLevelId: null,
        levels: {},
        nextLevelsPoints: {},
        badges: {},
        actions: {},
        actionsDetails: {},
        lastActions: []
    };

    var sortedGamificationEvents = _.sortBy(gamificationEvents, "createdDate");

    _.forEach(sortedGamificationEvents, gamificationEvent => {
        if (gamificationEvent.type === "level") {
            stats.levels[gamificationEvent.levelId] = true;
            stats.levelId = gamificationEvent.levelId;
        } else if (gamificationEvent.type === "badge") {
            stats.badges[gamificationEvent.badgeId] = true;
        } else if (gamificationEvent.type === "action") {
            if (! stats.actions[gamificationEvent.actionId]) {
                stats.actions[gamificationEvent.actionId]        = 1;
                stats.actionsDetails[gamificationEvent.actionId] = [gamificationEvent];
            } else {
                ++stats.actions[gamificationEvent.actionId];
                stats.actionsDetails[gamificationEvent.actionId].push(gamificationEvent);
            }
            stats.points += (gamificationEvent.points || 0);
        }
    });

    stats.nextLevelId  = getNextLevelId(stats.levelId);
    stats.levelsPoints = _getLevelsPoints();

    stats.lastActions = _(sortedGamificationEvents)
                            .filter({ type: "action" })
                            .reverse()
                            .pluck("actionId")
                            .uniq()
                            .take(3)
                            .value();

    return stats;
}

function _getNewLevels(userStats) {
    var levelsOrder = getLevelsOrder();
    var levels      = getLevels();
    var newLevels   = [];
    var finished    = false;

    var levelIndex = levelsOrder.indexOf(userStats.levelId);

    _.forEach(levelsOrder, (levelId, index) => {
        if (finished || index <= levelIndex) {
            return;
        }

        var level = levels[levelId];

        var hasAllAttributes = (array, obj) => {
            return _.reduce(array, (memo, key) => {
                if (! obj[key]) {
                    memo = memo && false;
                }
                return memo;
            }, true);
        };

        var hasPointsRequirements = ! level.requirements
                                        || ! level.requirements.points
                                        || level.requirements.points <= userStats.points;

        var hasActionsRequirements = ! level.requirements
                                        || ! level.requirements.actions
                                        || hasAllAttributes(level.requirements.actions, userStats.actions);

        if (hasPointsRequirements && hasActionsRequirements) {
            newLevels.push(levelId);
        } else {
            finished = true;
        }
    });

    return newLevels;
}

function getNextLevelId(levelId) {
    var levelsOrder = getLevelsOrder();
    var levelIndex  = _.indexOf(levelsOrder, levelId);
    var nextLevelId   = levelsOrder[levelIndex + 1] || _.last(levelsOrder);

    return nextLevelId;
}

function _getLevelsPoints() {
    var levels       = getLevels();
    var levelsOrder  = getLevelsOrder();
    var levelsPoints = {};
    var nextLevelId;

    _.forEach(levels, function (level) {
        nextLevelId = getNextLevelId(level.id);
        levelsPoints[level.id] = {
            required: levels[level.id].requirements.points,
            next: levels[nextLevelId].requirements.points
        };
    });

    levelsPoints.NONE = {
        required: 0,
        next: levels[levelsOrder[0]].requirements.points
    };

    return levelsPoints;
}

function _getSessionId(req, user) {
    if (req && req.user && req.user.id === user.id) {
        return StelaceEventService.getSessionId(req);
    } else {
        return;
    }
}



/////////////////////////////
// Check and set functions //
/////////////////////////////

function _getConfig() {
    var cf = {};
    _setConfigLevels(cf);
    _setConfigBadges(cf);
    _setConfigActions(cf);

    return cf;



    function _setConfigLevels(cf) {
        cf.levels               = {};
        cf.levels.customRewards = {};
        cf.levels.hooks         = {};

        cf.levels.hooks.BEGINNER = function (user, userStats, logger) {
            return Promise
                .resolve()
                .then(() => {
                    return Link
                        .find({
                            toUserId: user.id,
                            relationship: "refer"
                        })
                        .then(links => links[0]);
                })
                .then(link => {
                    if (! link) {
                        return;
                    }

                    return User
                        .findOne({ id: link.fromUserId })
                        .then(referer => {
                            if (! referer) {
                                throw createError('Referer not found');
                            }

                            var actionsIds = ["FRIEND_BEGINNER_LEVEL_AS_REFERER"];
                            var actionsData = {
                                FRIEND_BEGINNER_LEVEL_AS_REFERER: {
                                    link: link,
                                    friend: user
                                }
                            };

                            return checkActions(referer, actionsIds, actionsData, logger);
                        });
                });
        };
    }

    function _setConfigBadges(cf) {
        cf.badges = {};
    }

    function _setConfigActions(cf) {
        cf.actions               = {};
        cf.actions.checks        = {};
        cf.actions.customApplies = {};
        cf.actions.customRewards = {};
        cf.actions.hooks         = {};

        cf.actions.checks.ADD_FIRSTNAME = function (user) {
            return user.firstname;
        };

        cf.actions.customApplies.ADD_FIRSTNAME = function (createAttrs, user) {
            createAttrs.reference = {
                firstname: user.firstname
            };
        };

        cf.actions.checks.ADD_LASTNAME = function (user) {
            return user.lastname;
        };

        cf.actions.customApplies.ADD_LASTNAME = function (createAttrs, user) {
            createAttrs.reference = {
                lastname: user.lastname
            };
        };

        cf.actions.checks.EMAIL_VALIDATION = function (user) {
            return user.emailCheck;
        };

        cf.actions.customApplies.EMAIL_VALIDATION = function (createAttrs, user) {
            createAttrs.reference = {
                email: user.email
            };
        };

        cf.actions.checks.PHONE_VALIDATION = function (user) {
            return user.phoneCheck;
        };

        cf.actions.customApplies.PHONE_VALIDATION = function (createAttrs, user) {
            createAttrs.reference = {
                phone: user.phone
            };
        };

        cf.actions.checks.ADD_PROFILE_IMAGE = function (user) {
            return user.mediaId;
        };

        cf.actions.customApplies.ADD_PROFILE_IMAGE = function (createAttrs, user) {
            createAttrs.reference = {
                mediaId: user.mediaId
            };
        };

        cf.actions.checks.ADD_DESCRIPTION = function (user) {
            return typeof user.description === "string" && user.description.length >= 15;
        };

        cf.actions.customApplies.ADD_DESCRIPTION = function (createAttrs, user) {
            createAttrs.reference = {
                description: user.description
            };
        };

        cf.actions.checks.FIRST_LOCATIONS_NB_2 = function (user, data) {
            var limit = 2;

            return Location
                .find({ userId: user.id })
                .then(locations => {
                    if (locations.length >= limit) {
                        data.computed = { locations: _.take(locations, limit) };
                        return true;
                    } else {
                        return false;
                    }
                });
        };

        cf.actions.customApplies.FIRST_LOCATIONS_NB_2 = function (createAttrs, user, data) {
            var limit     = 2;
            var locations = _.take(data.computed.locations, limit);

            createAttrs.reference = {
                locationsIds: _.pluck(locations, "id")
            };
        };

        cf.actions.checks.A_FRIEND_REGISTERED = function (user, data, userStats) {
            var link = data.link;

            var alreadySet = _.find(userStats.actionsDetails.A_FRIEND_REGISTERED, line => {
                if (! line.reference) {
                    return false;
                }

                return line.reference.friendUserId === link.toUserId;
            });

            return ! alreadySet
                && link.fromUserId === user.id
                && link.relationship === "refer"
                && link.validated;
        };

        cf.actions.customApplies.A_FRIEND_REGISTERED = function (createAttrs, user, data) {
            var link = data.link;

            createAttrs.reference = {
                linkId: link.id,
                friendUserId: link.toUserId
            };
        };

        cf.actions.checks.REGISTER_AS_FRIEND = function (user, data) {
            var link = data.link;

            return link.toUserId === user.id
                && link.relationship === "refer"
                && link.validated;
        };

        cf.actions.customApplies.REGISTER_AS_FRIEND = function (createAttrs, user, data) {
            var link = data.link;

            createAttrs.reference = {
                linkId: link.id,
                refererUserId: link.fromUserId
            };
        };

        cf.actions.checks.FRIEND_BOOKING_AS_REFERER = function (user, data, userStats) {
            var booking = data.booking;
            var link    = data.link;

            var alreadySet = _.find(userStats.actionsDetails.FRIEND_BOOKING_AS_REFERER, line => {
                if (! line.reference) {
                    return false;
                }

                return line.reference.friendUserId === link.toUserId;
            });

            return ! alreadySet
                && link.fromUserId === user.id
                && booking.takerId === link.toUserId
                && link.relationship === "refer"
                && link.validated
                && booking.paidDate
                && booking.acceptedDate
                && ! booking.cancellationId;
        };

        cf.actions.customApplies.FRIEND_BOOKING_AS_REFERER = function (createAttrs, user, data) {
            var booking = data.booking;
            var link    = data.link;

            createAttrs.reference = {
                bookingId: booking.id,
                linkId: link.id,
                friendUserId: link.toUserId
            };
        };

        cf.actions.hooks.FRIEND_BOOKING_AS_REFERER = function (user, data, userStats, logger) {
            var link = data.link;

            return Promise
                .resolve()
                .then(() => {
                    return User.findOne({ id: link.toUserId });
                })
                .then(friend => {
                    if (! friend) {
                        var error = new Error("Friend not found");
                        error.linkId   = link.id;
                        error.friendId = link.toUserId;
                        throw error;
                    }

                    return EmailTemplateService.sendEmailTemplate('friend-booking-reward-referer', {
                        user: user,
                        friend: friend
                    });
                })
                .catch(err => {
                    logger.error({ err: err }, "Action FRIEND_BOOKING_AS_REFERER hook");
                });
        };

        cf.actions.checks.FRIEND_RENTING_OUT_AS_REFERER = function (user, data, userStats) {
            var booking = data.booking;
            var link    = data.link;

            var alreadySet = _.find(userStats.actionsDetails.FRIEND_RENTING_OUT_AS_REFERER, line => {
                if (! line.reference) {
                    return false;
                }

                return line.reference.friendUserId === link.toUserId;
            });

            return ! alreadySet
                && link.fromUserId === user.id
                && booking.ownerId === link.toUserId
                && link.relationship === "refer"
                && link.validated
                && booking.paidDate
                && booking.acceptedDate
                && ! booking.cancellationId;
        };

        cf.actions.customApplies.FRIEND_RENTING_OUT_AS_REFERER = function (createAttrs, user, data) {
            var booking = data.booking;
            var link    = data.link;

            createAttrs.reference = {
                bookingId: booking.id,
                linkId: link.id,
                friendUserId: link.toUserId
            };
        };

        cf.actions.hooks.FRIEND_RENTING_OUT_AS_REFERER = function (user, data, userStats, logger) {
            var link = data.link;

            return Promise
                .resolve()
                .then(() => {
                    return User.findOne({ id: link.toUserId });
                })
                .then(friend => {
                    if (! friend) {
                        var error = new Error("Friend not found");
                        error.linkId   = link.id;
                        error.friendId = link.toUserId;
                        throw error;
                    }

                    return EmailTemplateService.sendEmailTemplate('friend-booking-reward-referer', {
                        user: user,
                        friend: friend
                    });
                })
                .catch(err => {
                    logger.error({ err: err }, "Action FRIEND_RENTING_OUT_AS_REFERER hook");
                });
        };

        cf.actions.checks.FRIEND_BEGINNER_LEVEL_AS_REFERER = function (user, data, userStats) {
            var friend = data.friend;
            var link   = data.link;

            var alreadySet = _.find(userStats.actionsDetails.FRIEND_BEGINNER_LEVEL_AS_REFERER, line => {
                return line.reference && line.reference.friendUserId === friend.id;
            });

            var levelsOrder        = getLevelsOrder();
            var beginnerLevelIndex = _.indexOf(levelsOrder, "BEGINNER");
            var friendLevelIndex   = _.indexOf(levelsOrder, friend.levelId);

            return ! alreadySet
                && link.fromUserId === user.id
                && link.toUserId === friend.id
                && link.relationship === "refer"
                && beginnerLevelIndex <= friendLevelIndex;
        };

        cf.actions.customApplies.FRIEND_BEGINNER_LEVEL_AS_REFERER = function (createAttrs, user, data) {
            var friend = data.friend;
            var link   = data.link;

            createAttrs.reference = {
                linkId: link.id,
                friendUserId: friend.id
            };
        };

        cf.actions.checks.FIRST_MOBILE_CONNECTION = function (user, data) {
            var userAgent = data.userAgent;

            return userAgent && UAService.isMobile(userAgent);
        };

        cf.actions.customApplies.FIRST_MOBILE_CONNECTION = function (createAttrs, user, data) {
            var userAgent = data.userAgent;

            createAttrs.reference = {
                userAgent: userAgent
            };
        };

        cf.actions.checks.FIRST_BOOKING = function (user, data) {
            var booking = data.booking;

            return booking.takerId === user.id
                && (booking.depositDate || booking.paymentDate)
                && ! booking.cancellationId;
        };

        cf.actions.customApplies.FIRST_BOOKING = function (createAttrs, user, data) {
            var booking = data.booking;

            createAttrs.reference = {
                bookingId: booking.id
            };
        };

        cf.actions.checks.FIRST_RENTING_OUT = function (user, data) {
            var booking = data.booking;

            return booking.ownerId === user.id
                && booking.acceptedDate
                && ! booking.cancellationId;
        };

        cf.actions.customApplies.FIRST_RENTING_OUT = function (createAttrs, user, data) {
            var booking = data.booking;

            createAttrs.reference = {
                bookingId: booking.id
            };
        };

        cf.actions.checks.FIRST_COMPLETE_BOOKING = function (user, data) {
            var booking = data.booking;

            if (! _.contains([booking.ownerId, booking.takerId], user.id)) {
                return false;
            }

            return Booking
                .getAssessments([booking])
                .then(hashBookings => {
                    var hash = hashBookings[booking.id];
                    return Booking.isComplete(booking, hash.inputAssessment, hash.outputAssessment);
                });
        };

        cf.actions.customApplies.FIRST_COMPLETE_BOOKING = function (createAttrs, user, data) {
            var booking = data.booking;

            createAttrs.reference = {
                bookingId: booking.id
            };
        };

        cf.actions.checks.FIRST_RATING = function (user, data) {
            var rating = data.rating;

            return rating.comment;
        };

        cf.actions.customApplies.FIRST_RATING = function (createAttrs, user, data) {
            var rating = data.rating;

            createAttrs.reference = {
                ratingId: rating.id
            };
        };

        cf.actions.checks.FIRST_VALID_LISTING_AD = function (user, data) {
            var listing = data.listing;

            return listing.ownerId === user.id
                && listing.validated;
        };

        cf.actions.customApplies.FIRST_VALID_LISTING_AD = function (createAttrs, user, data) {
            var listing = data.listing;

            createAttrs.reference = {
                listingId: listing.id
            };
        };

        cf.actions.checks.VALID_LISTING_AD = function (user, data, userStats) {
            var listing = data.listing;

            var alreadySet = _.find(userStats.actionsDetails.VALID_LISTING_AD, line => {
                return line.reference && line.reference.listingId === listing.id;
            });

            return ! alreadySet
                && listing.ownerId === user.id
                && listing.validated;
        };

        cf.actions.customApplies.VALID_LISTING_AD = function (createAttrs, user, data) {
            var listing = data.listing;

            createAttrs.points = listing.validationPoints || createAttrs.points;

            createAttrs.reference = {
                listingId: listing.id
            };
        };

        cf.actions.checks.FEEDBACK = function () {
            return true;
        };

        cf.actions.customApplies.FEEDBACK = function () {
            // do nothing
        };

        cf.actions.checks.EXTERNAL_REVIEW = function () {
            return true;
        };

        cf.actions.customApplies.EXTERNAL_REVIEW = function () {
            // do nothing
        };

        cf.actions.checks.CONNECTION_OF_THE_DAY = function (user, data, userStats) {
            var connectionDate = data.connectionDate;

            var localizedDate = moment(connectionDate).format().substr(0, 10);

            return ! _.find(userStats.actionsDetails.CONNECTION_OF_THE_DAY || [], line => {
                return line.reference && line.reference.localizedDate === localizedDate;
            });
        };

        cf.actions.customApplies.CONNECTION_OF_THE_DAY = function (createAttrs, user, data) {
            var connectionDate = data.connectionDate;

            var date = moment(connectionDate);

            createAttrs.reference = {
                ISODate: connectionDate,
                localizedDate: date.format().substr(0, 10),
                hours: date.hours(),
                minutes: date.minutes()
            };
        };

        cf.actions.checks.COMPLETE_BOOKING = function (user, data, userStats) {
            var booking = data.booking;

            var alreadySet = _.find(userStats.actionsDetails.COMPLETE_BOOKING, line => {
                return line.reference && line.reference.bookingId === booking.id;
            });

            if (alreadySet
             || ! _.contains([booking.ownerId, booking.takerId], user.id)
            ) {
                return false;
            }

            return Booking
                .getAssessments([booking])
                .then(hashBookings => {
                    var hash = hashBookings[booking.id];
                    return Booking.isComplete(booking, hash.inputAssessment, hash.outputAssessment);
                });
        };

        cf.actions.customApplies.COMPLETE_BOOKING = function (createAttrs, user, data) {
            var booking = data.booking;

            createAttrs.reference = {
                bookingId: booking.id
            };
        };
    }
}

// check config
(function () {
    var levels  = getLevels();
    var badges  = getBadges();
    var actions = getActions();

    // check levels
    (function () {
        _.forEach(levels, (level, levelId) => {
            if (level.id !== levelId) {
                displayError({
                    name: "level ids not matched",
                    level: level,
                    levelId: levelId
                });
            }

            if (level.requirements && level.requirements.actions) {
                _.forEach(level.requirements.actions, actionId => {
                    if (! actions[actionId]) {
                        displayError({
                            name: "level requirements actions",
                            levelId: level.id,
                            actionId: actionId
                        });
                    }
                });
            }

            if (level.rewards && level.rewards.badges) {
                _.forEach(level.rewards.badges, badgeId => {
                    if (! badges[badgeId]) {
                        displayError({
                            name: "level rewards badges",
                            levelId: level.id,
                            badgeId: badgeId
                        });
                    }
                });
            }
        });
    })();

    // check badges
    (function () {
        _.forEach(badges, (badge, badgeId) => {
            if (badge.id !== badgeId) {
                displayError({
                    name: "badge ids not matched",
                    badge: badge,
                    badgeId: badgeId
                });
            }
        });
    })();

    // check actions
    (function () {
        _.forEach(actions, (action, actionId) => {
            if (action.id !== actionId) {
                displayError({
                    name: "action ids not matched",
                    action: action,
                    actionId: actionId
                });
            }

            if (action.rewards && action.rewards.badges) {
                _.forEach(action.rewards.badges, badgeId => {
                    if (! badges[badgeId]) {
                        displayError({
                            name: "action rewards badges",
                            actionId: action.id,
                            badgeId: badgeId
                        });
                    }
                });
            }
        });
    })();

    function displayError(error) {
        console.log(error);
        console.log("\n");
        throw new Error("bad gamification config");
    }
})();
