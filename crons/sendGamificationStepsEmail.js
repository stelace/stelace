/* global BootstrapService, EmailTemplateService, GamificationEvent, GamificationService, LoggerService, MicroService, User */

const Sails  = require('sails');
const { getConfig } = require('../sailsrc');
const moment = require('moment');

var cronTaskName = "sendGamificationStepsEmail";

const _ = require('lodash');
const Promise = require('bluebird');

Sails.load(getConfig(), async function (err, sails) {
    if (err) {
        console.log("\n!!! Fail cron task: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    var limitDate = moment().subtract(1, "d").toISOString();

    var logger = LoggerService.getLogger("cron");
    logger = logger.child({ cronTaskName: cronTaskName });

    logger.info("Start cron");

    return Promise
        .resolve()
        .then(() => {
            return GamificationEvent.find({
                createdDate: { '>': limitDate },
                type: "level"
            });
        })
        .then(gamificationEvents => {
            var usersIds = _.pluck(gamificationEvents, "userId");

            return [
                User.find({ id: MicroService.escapeListForQueries(usersIds) }),
                gamificationEvents
            ];
        })
        .spread((users, gamificationEvents) => {
            var hash = getHash(users, gamificationEvents);

            return Promise
                .resolve(_.values(hash))
                .map(info => {
                    var user   = info.user;
                    var levels = info.levels;

                    if (_.isEmpty(levels)) {
                        return null;
                    }

                    levels = _.keys(levels);
                    levels = getSortedLevels(levels);

                    return Promise
                        .resolve(levels)
                        .each(level => sendEmail(user, level))
                        .catch(err => {
                            logger.error({
                                err: err,
                                userId: user.id
                            });
                        });
                })
                .catch(err => {
                    logger.error({ err: err });
                });
        })
        .catch(err => {
            logger.error({ err: err });
        })
        .finally(() => {
            logger.info("End cron");
            sails.lowerSafe();
        });



    function getHash(users, gamificationEvents) {
        var indexedGamificationEvents = _.groupBy(gamificationEvents, "userId");

        var hash = _.reduce(users, (memo, user) => {
            if (! memo[user.id]) {
                memo[user.id] = {
                    user: user,
                    gamificationEvents: indexedGamificationEvents[user.id] || [],
                    levels: {}
                };
            }

            _.forEach(indexedGamificationEvents[user.id], gamificationEvent => {
                if (gamificationEvent.type === "level") {
                    memo[user.id].levels[gamificationEvent.levelId] = true;
                }
            });

            return memo;
        }, {});

        return hash;
    }

    function getSortedLevels(levels) {
        var levelsOrder = GamificationService.getLevelsOrder();

        return _(levels)
            .map(level => {
                return {
                    level: level,
                    index: _.indexOf(levelsOrder, level)
                };
            })
            .sortBy("index")
            .map(config => config.level)
            .value();
    }

    function sendEmail(user, levelId) {
        switch (levelId) {
            case "BEGINNER":
                return EmailTemplateService.sendEmailTemplate('gamification_lvl_up_beginner', { user });

            case "BRONZE":
                return EmailTemplateService.sendEmailTemplate('gamification_lvl_up_bronze', { user });

            // case "SILVER":
            //     return EmailTemplateService.sendEmailTemplate('gamification_lvl_up_silver', { user });

            // case "GOLD":
            //     return EmailTemplateService.sendEmailTemplate('gamification_lvl_up_gold', { user });
        }
    }
});
