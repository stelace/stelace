/* global BootstrapService, GamificationService, LoggerService, User */

const Sails = require('sails');
const yargs = require('yargs');
const { getConfig } = require('../sailsrc');

const _ = require('lodash');
const Promise = require('bluebird');

var argv = yargs
            .usage("Usage: $0 --actionId [string] --usersIds [num[]]")
            .demand("actionId")
            .demand("usersIds")
            .argv;

var actionId = argv.actionId;
var usersIds;

if (typeof argv.actionId !== "string") {
    console.log("actionId must be a string.");
    process.exit();
}

try {
    usersIds = JSON.parse(argv.usersIds);

    var isValid = function () {
        return _.reduce(usersIds, (memo, userId) => {
            if (typeof userId !== "number") {
                memo = memo && false;
            }
            return memo;
        }, true);
    };

    if (! _.isArray(usersIds) || ! isValid()) {
        console.log("usersIds must be an array of numbers.");
        process.exit();
    }
} catch (e) {
    console.log("usersIds has a bad format.");
    process.exit();
}

Sails.load(getConfig(), async function (err, sails) {
    if (err) {
        console.log("\n!!! Fail script launch: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    var logger = LoggerService.getLogger("script");

    return Promise
        .resolve()
        .then(() => {
            var actions = GamificationService.getActions();
            if (! actions[actionId]) {
                throw new Error("Gamification action doesn't exist.");
            }

            return User.find({ id: usersIds });
        })
        .then(users => {
            var indexedUsers = _.indexBy(users, "id");
            var notFoundUsersId = _.reduce(usersIds, (memo, userId) => {
                if (! indexedUsers[userId]) {
                    memo.push(userId);
                }
                return memo;
            }, []);

            if (notFoundUsersId.length) {
                throw new Error("Not found users: " + JSON.stringify(notFoundUsersId));
            }

            return [
                users,
                GamificationService.getUsersStats(users)
            ];
        })
        .spread((users, usersStats) => {
            return Promise
                .resolve(users)
                .map(user => {
                    var actionsIds = [actionId];
                    var userStats  = usersStats[user.id];

                    return GamificationService.setActions(user, actionsIds, null, logger, userStats);
                });
        })
        .then(() => {
            console.log("Success");
        })
        .catch(err => {
            console.log(err.stack);
        })
        .finally(() => {
            sails.lowerSafe();
        });
});
