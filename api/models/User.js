/* global
    Booking, CancellationService, GamificationService, GeneratorService, Link, Listing, Location, mangopay, Media, MicroService, OdooService, Passport,
    User, TimeService, Token, TransactionService, UserXTag
*/

/**
* User.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        id: {
            type: 'number',
            columnType: 'int',
            autoIncrement: true,
        },
        createdDate: {
            type: 'string',
            columnType: 'varchar(255)',
            maxLength: 255,
        },
        updatedDate: {
            type: 'string',
            columnType: 'varchar(255)',
            maxLength: 255,
        },
        organizationName: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        username: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        firstname: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        lastname: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        description: {
            type: 'string',
            columnType: 'longtext CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 1000,
        },
        phone: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        phoneCountryCode: {
            type: 'string',
            columnType: 'varchar(7)',
            allowNull: true,
            maxLength: 7
        },
        phoneCheck: {
            type: 'boolean',
            columnType: 'tinyint(1)',
            defaultsTo: false,
        },
        role: {
            type: 'string',
            columnType: 'varchar(255)',
            defaultsTo: 'user',
            maxLength: 255,
        },
        email: {       // email is not required in case if user recreates an account later (can be set to null)
            type: 'string',
            columnType: 'varchar(191) CHARACTER SET utf8mb4',
            allowNull: true,
            unique: true,
            maxLength: 191,
        },
        emailToken: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        emailCheck: {
            type: 'boolean',
            columnType: 'tinyint(1)',
            defaultsTo: false,
        },
        freeFeesDate: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        mediaId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        tagsIds: {
            type: 'json',
            columnType: 'json',
            defaultsTo: [],
        },
        lastConnectionDate: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        ratingScore: {
            type: 'number',
            columnType: 'int',
            defaultsTo: 0,
        },
        nbRatings: {
            type: 'number',
            columnType: 'int',
            defaultsTo: 0,
        },
        points: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        lastViewedPoints: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        levelId: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
        },
        lastViewedLevelId: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
        },
        address: {
            type: 'json',
            columnType: 'json',
        },
        registrationCompleted: {
            type: 'boolean',
            columnType: 'tinyint(1)',
            defaultsTo: false,
        },
        firstUse: {
            type: 'boolean',
            columnType: 'tinyint(1)',
            defaultsTo: true,
        },
        paymentData: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
        userType: { // 'individual' or 'organization'
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
        },
        blocked: { // use it if the user is to be banned temporarily
            type: 'boolean',
            columnType: 'tinyint(1)',
            defaultsTo: false,
        },
        destroyed: {
            type: 'boolean',
            columnType: 'tinyint(1)',
            defaultsTo: false,
        },
        newsletter: { // if true, we can send newsletter
            type: 'boolean',
            columnType: 'tinyint(1)',
            defaultsTo: true,
        },
    },

    getAccessFields,
    exposeTransform,
    get,
    beforeCreate,
    getName,

    getMangopayUserId,
    getMangopayWalletId,
    getStripeCustomerId,
    getStripeAccountId,
    hasPaymentAccount,

    isValidUserType,
    canChangeUserType,

    getMergedPaymentData,
    createMangopayUser,
    createWallet,
    createBankAccount,
    hasSameId,
    getMedia,
    createCheckEmailToken,
    syncOdooUser,
    updateTags,
    isFreeFees,
    canApplyFreeFees,
    applyFreeFees,
    getPartnerRef,
    getRefererInfo,
    generateAuthToken,
    canBeDestroyed,
    destroyUser,

};

var params = {
    maxNbLocations: 4,
    freeFees: {
        minLevelId: "BEGINNER",
        duration: { // 3 months and 1 day
            M: 3,
            d: 1
        }
    }
};

var moment = require('moment');
var uuid   = require('uuid');
const _ = require('lodash');
const Promise = require('bluebird');
const createError = require('http-errors');

function getAccessFields(access) {
    var accessFields = {
        api: [
            "id",
            "username",
            "firstname",
            "lastname",
            "description",
            "phone",
            "phoneCheck",
            "role",
            "email",
            "emailCheck",
            "freeFeesDate",
            "mediaId",
            "tagsIds",
            "ratingScore",
            "nbRatings",
            "birthday",
            "nationality",
            "countryOfResidence",
            "address",
            "registrationCompleted",
            "firstUse",
            "newsletter",
            "points",
            "lastViewedPoints",
            "levelId",
            "lastViewedLevelId",
            "createdDate",
            "lastConnectionDate",
            "userType",
        ],
        self: [
            "id",
            "username",
            "firstname",
            "lastname",
            "description",
            "phone",
            "phoneCheck",
            "role",
            "email",
            "emailCheck",
            "freeFeesDate",
            "mediaId",
            "tagsIds",
            "ratingScore",
            "nbRatings",
            "birthday",
            "nationality",
            "countryOfResidence",
            "address",
            "registrationCompleted",
            "firstUse",
            "newsletter",
            "points",
            "lastViewedPoints",
            "levelId",
            "lastViewedLevelId",
            "createdDate",
            "userType",
        ],
        others: [
            "id",
            "username",
            "firstname",
            "lastname",
            "description",
            "phoneCheck",
            "emailCheck",
            "ratingScore",
            "nbRatings",
            "points",
            "levelId",
            "createdDate",
            "userType",
        ]
    };

    return accessFields[access];
}

function exposeTransform(element, field, access) {
    let exposeFullName;

    switch (field) {

        case "lastname":
            exposeFullName = _.includes(['self', 'api'], access);
            var shortLastname = element.lastname && element.lastname.charAt(0) + ".";
            element.lastname = exposeFullName ? element.lastname : shortLastname;
            break;
    }
}

function get(prop) {
    if (prop) {
        return params[prop];
    } else {
        return params;
    }
}

async function beforeCreate(values, next) {
    try {
        User.beforeCreateDates(values);

        if (!values.username && values.email) {
            values.username = values.email.split("@")[0];
        }

        if (!values.emailToken) {
            values.emailToken = await GeneratorService.getRandomString(30);
        }

        next();
    } catch (err) {
        next(err);
    }
}

function hasSameId(user, id) {
    if (typeof user !== "object" || ! user.id) {
        return false;
    }

    if (! isNaN(id) && user.id === id) {
        return true;
    } else if (typeof id === "string" && id === ("" + user.id)) {
        return true;
    } else {
        return false;
    }
}

function getName(user, notFull) {
    if (user.firstname && user.lastname) {
        if (notFull) {
            return user.firstname + " " + user.lastname.charAt(0) + ".";
        } else {
            return user.firstname + " " + user.lastname;
        }
    } else if (user.firstname) {
        return user.firstname;
    } else if (user.email) {
        return user.email.split("@")[0];
    } else if (user.username) {
        return user.username;
    } else {
        return "";
    }
}

function getMangopayUserId(user) {
    if (!user.userType) return;

    if (user.userType === 'individual') {
        return _.get(user, 'paymentData.mangopay.naturalUserId');
    }
    if (user.userType === 'organization') {
        return _.get(user, 'paymentData.mangopay.legalUserId');
    }
}

function getMangopayWalletId(user) {
    if (!user.userType) return;

    if (user.userType === 'individual') {
        return _.get(user, 'paymentData.mangopay.naturalWalletId');
    }
    if (user.userType === 'organization') {
        return _.get(user, 'paymentData.mangopay.legalWalletId');
    }
}

function getStripeCustomerId(user) {
    return _.get(user, 'paymentData.stripe.customerId');
}

function getStripeAccountId(user) {
    return _.get(user, 'paymentData.stripe.accountId');
}

function hasPaymentAccount(user) {
    const mangopayUserId = getMangopayUserId(user);
    const stripeCustomerId = getStripeCustomerId(user);
    const stripeAccountId = getStripeAccountId(user);

    return !!(mangopayUserId || stripeCustomerId || stripeAccountId);
}

function isValidUserType(userType) {
    return _.includes(['individual', 'organization'], userType);
}

function canChangeUserType(user) {
    return !hasPaymentAccount(user);
}

function getMergedPaymentData(user, newPaymentData) {
    return _.merge({}, newPaymentData, user.paymentData || {});
}

function createMangopayUser(user, args) {
    return Promise
        .resolve()
        .then(() => {
            if (user.mangopayUserId) {
                return user;
            }

            if (! args.birthday || ! TimeService.isDateString(args.birthday, { onlyDate: true })
                || ! args.nationality
                || ! args.countryOfResidence
            ) {
                throw new Error("Missing or bad parameters");
            }

            return mangopay.Users
                .create({
                    Email: user.email,
                    FirstName: user.firstname,
                    LastName: user.lastname,
                    Birthday: parseInt(moment(new Date(args.birthday)).format("X"), 10), // unix timestamp
                    Nationality: args.nationality,
                    CountryOfResidence: args.countryOfResidence,
                    PersonType: 'NATURAL'
                })
                .then(mangopayUser => {
                    var updateAttrs = {
                        birthday: args.birthday, // can be fake birthday (client-side default). Update from client side if touched inputs
                        nationality: args.nationality,
                        countryOfResidence: args.countryOfResidence,
                        mangopayUserId: mangopayUser.Id
                    };

                    return User.updateOne(user.id, updateAttrs);
                });
        });
}

function createWallet(user) {
    return Promise
        .resolve()
        .then(() => {
            if (! user.mangopayUserId) {
                throw new Error("Missing mangopayUserId");
            }
            if (user.walletId) {
                return user;
            }

            return mangopay.Wallets
                .create({
                    Owners: [user.mangopayUserId],
                    Description: "Main wallet",
                    Currency: "EUR", // TODO: allow other currencies
                })
                .then(wallet => {
                    return User.updateOne(user.id, { walletId: wallet.Id });
                });
        });
}

function createBankAccount(user) {
    return Promise
        .resolve()
        .then(() => {
            if (! user.mangopayUserId) {
                throw new Error("Missing mangopayUserId");
            }
            if (! user.iban
                || ! user.address
                || ! user.address.name
                || (! user.address.establishment && ! user.address.street)
                || ! user.address.city
                || ! user.address.postalCode
            ) {
                throw new Error("Missing params");
            }

            if (user.bankAccountId) {
                return user;
            }

            return mangopay.Users
                .createBankAccount(user.mangopayUserId, {
                    OwnerName: User.getName(user),
                    OwnerAddress: {
                        AddressLine1: Location.getAddress(user.address, true, false),
                        City: user.address.city,
                        PostalCode: user.address.postalCode,
                        Country: "FR"
                    },
                    IBAN: user.iban,
                    Type: 'IBAN',
                })
                .then(bankAccount => {
                    return User.updateOne(user.id, { bankAccountId: bankAccount.Id });
                });
        });
}

/**
 * sync odoo user
 * @param  {object}  args
 * @param  {boolean} args.updateLocation - if set to true, update location if the user exists
 * @param  {boolean} args.doNotCreateIfNone - do nothing if there is no odoo user
 * @return {Promise<object>} user
 */
function syncOdooUser(user, args) {
    args = args || {};

    return Promise.coroutine(function* () {
        var odooId = yield OdooService.getPartnerId(user.id);

        if (odooId) {
            return yield update(odooId, user, args);
        } else {
            if (! args.doNotCreateIfNone) {
                return yield create(user);
            }
        }
    })()
    .then(odooId => {
        // odooId is not always defined
        user.odooId = odooId;
        return user;
    });



    function create(user) {
        return Promise.coroutine(function* () {
            var location = yield Location.getBillingLocation(user);

            return yield OdooService.createPartner({
                userId: user.id,
                name: User.getName(user),
                email: user.email,
                phone: user.phone,
                street: location ? location.street : null,
                postalCode: location ? location.postalCode : null,
                city: location ? location.city : null
            });
        })();
    }

    function update(odooId, user, args) {
        return Promise.coroutine(function* () {
            var params = {
                name: User.getName(user),
                email: user.email,
                phone: user.phone
            };

            if (args.updateLocation) {
                var location = Location.getBillingLocation(user);
                if (location) {
                    params.street     = location.street;
                    params.postalCode = location.postalCode;
                    params.city       = location.city;
                }
            }

            return yield OdooService.updatePartner(odooId, params);
        })()
        .then(() => odooId);
    }
}

/**
 * @param {Object[]} users - Users to retrieve media for
 */
function getMedia(users) {
    var mediasIds = MicroService.escapeListForQueries(_.pluck(users, "mediaId"));

    return Promise
        .resolve()
        .then(() => {
            return Media.find({ id: mediasIds });
        })
        .then(medias => {
            var indexedMedias = _.indexBy(medias, "id");

            var hashMedias = _.reduce(users, function (memo, user) {
                if (! memo[user.id]) {
                    memo[user.id] = indexedMedias[user.mediaId];
                }
                return memo;
            }, {});

            return hashMedias;
        });
}

function createCheckEmailToken(user, email) {
    return Promise
        .resolve()
        .then(() => {
            return GeneratorService.getRandomString(30);
        })
        .then(randomString => {
            return Token.create({
                type: "EMAIL_CHECK",
                value: randomString,
                userId: user.id,
                reference: {
                    email: email
                }
            });
        });
}

/**
 * @param {integer} userId - current user id
 * @param {integer[]} tagIds - new tag ids associated to current user
 * @return {Promise<object>} user
 */
function updateTags(user, tagIds) {
    if (! tagIds) {
        return User.findOne({ id: user.id });
    } else if (! MicroService.checkArray(tagIds, "id")) {
        throw createError(400, 'Bad parameters');
    }

    return Promise.coroutine(function* () {
        var userXTags     = yield UserXTag.find({ userId: user.id });
        var oldTagIds     = _.pluck(userXTags, "tagId");
        var addedTagIds   = _.difference(tagIds, oldTagIds);
        var removedTagIds = _.difference(oldTagIds, tagIds);

        if (addedTagIds.length) {
            yield Promise
                .resolve(addedTagIds)
                .each(function (tagId) {
                    return UserXTag
                        .create({
                            userId: user.id,
                            tagId: tagId
                        });
                });
        }
        if (removedTagIds.length) {
            yield UserXTag
                .destroy({
                    userId: user.id,
                    tagId: removedTagIds
                });
        }

        return yield User.updateOne(user.id, { tagsIds: MicroService.escapeListForQueries(tagIds) });
    })();
}

function isFreeFees(user, refDate) {
    var refDay = moment(refDate).format("YYYY-MM-DD");
    return !! (user.freeFeesDate && refDay < user.freeFeesDate);
}

/**
 * can apply free fees
 * @param  {object} user
 * @param  {object} args
 * @param  {string} args.minLevelId
 * @return {boolean}
 */
function canApplyFreeFees(user, args) {
    args = args || _.defaults({}, params.freeFees);

    var errors = {};

    if (args.minLevelId) {
        var levelsOrder   = GamificationService.getLevelsOrder();
        var minLevelIndex = _.findIndex(levelsOrder, args.minLevelId);
        var levelIndex    = _.findIndex(levelsOrder, user.levelId);

        if (levelIndex < minLevelIndex) {
            errors.MIN_LEVEL = true;
        }
    }

    return exposeResult(errors);



    function exposeResult(errors) {
        return {
            result: ! _.keys(errors).length,
            errors: errors
        };
    }
}

function getNewFreeFeesDate(user, duration) {
    var formatDate = "YYYY-MM-DD";
    var oldFreeFeesDate = user.freeFeesDate || moment().format(formatDate);
    var newFreeFeesDate = moment(oldFreeFeesDate).add(duration).format(formatDate);

    return newFreeFeesDate;
}

/**
 * apply free fees
 * @param  {object} user
 * @param  {object} args
 * @param  {string} args.minLevelId
 * @param  {object} args.duration
 * @return {Promise<object>}
 */
function applyFreeFees(user, args) {
    args = args || _.defaults({}, params.freeFees);

    return Promise.coroutine(function* () {
        if (! args.duration) {
            throw new Error("No duration provided");
        }

        var canApply = User.canApplyFreeFees(user, args);
        if (! canApply.result) {
            throw new Error("User can't apply no fees");
        }

        var newFreeFeesDate = getNewFreeFeesDate(user, args.duration);

        return yield User.updateOne(user.id, { freeFeesDate: newFreeFeesDate });
    })();
}

function getPartnerRef(userId) {
    return `USR_${userId}`;
}

function getRefererInfo(user) {
    return Promise.coroutine(function* () {
        var [link] = yield Link
            .find({
                toUserId: user.id,
                relationship: "refer",
                validated: true
            })
            .limit(1);

        if (! link) {
            return;
        }

        var referer = yield User.findOne({ id: link.fromUserId });
        if (! referer) {
            throw createError(404, 'Referer not found', { userId: link.fromUserId });
        }

        return {
            link: link,
            referer: referer
        };
    })();
}

async function generateAuthToken(userId) {
    const expirationDuration = 30; // 30 days

    const token = await Token.create({
        type: 'authToken',
        value: uuid.v4(),
        userId,
        expirationDate: moment().add({ d: expirationDuration }).toISOString(),
    });
    return token;
}

/**
 * Determine if users can be destroyed
 * @param {Object[]} users
 * @param {Object} [options]
 * @param {Boolean} [options.keepCommittedBookings = true]
 * @return {Object} res
 * @return {Object} res.hashUsers
 * @return {Boolean} res.hashUsers[userId] - true if can be destroyed
 * @return {Boolean} res.allDestroyable - true if all users can be destroyed
 */
async function canBeDestroyed(users, { keepCommittedBookings = true } = {}) {
    const usersIds = _.pluck(users, 'id');

    const [
        bookings,
        listings,
    ] = await Promise.all([
        Booking.find({
            takerId: MicroService.escapeListForQueries(usersIds),
            completedDate: null,
            cancellationId: null,
        }),
        Listing.find({ ownerId: usersIds }),
    ]);

    const { hashBookings } = await Booking.canBeCancelled(bookings);
    const { hashListings } = await Listing.canBeDestroyed(listings, { keepCommittedBookings });

    const groupTakerBookings = _.groupBy(bookings, 'takerId');
    const groupListings = _.groupBy(listings, 'ownerId');

    const isCommittedBooking = booking => !!(booking.paidDate && booking.acceptedDate);

    const hashUsers = {};
    _.forEach(users, user => {
        const bookings = groupTakerBookings[user.id] || [];
        const listings = groupListings[user.id] || [];

        const bookingCancellable = _.reduce(bookings, (memo, booking) => {
            // user cannot be destroyed if there is committed bookings
            if (keepCommittedBookings && isCommittedBooking(booking)) {
                return false;
            }
            // if booking cannot be cancelled
            if (!hashBookings[booking.id]) {
                return false;
            }
            return memo;
        }, true);

        const listingDestroyable = _.reduce(listings, (memo, listing) => {
            if (!hashListings[listing.id]) {
                return false;
            }
            return memo;
        }, true);

        // user can be destroyed if booking is cancellable and listing is destroyable
        hashUsers[user.id] = bookingCancellable && listingDestroyable;
    });

    const allDestroyable = _.reduce(hashUsers, (memo, value) => {
        if (!value) {
            return false;
        }
        return memo;
    }, true);

    return {
        hashUsers,
        allDestroyable,
    };
}

async function destroyUser(user, { trigger, reasonType = 'user-removed' }, { req, res } = {}) {
    const [
        bookings,
        listings,
    ] = await Promise.all([
        Booking.find({
            takerId: user.id,
            completedDate: null,
            cancellationId: null,
        }),
        Listing.find({ ownerId: user.id }),
    ]);

    const transactionManagers = await TransactionService.getBookingTransactionsManagers(_.pluck(bookings, 'id'));

    await Promise.each(bookings, async (booking) => {
        const transactionManager = transactionManagers[booking.id];

        await CancellationService.cancelBooking(booking, transactionManager, {
            reasonType,
            trigger,
            cancelPayment: true,
        });
    });

    await Promise.each(listings, async (listing) => {
        await Listing.destroyListing(listing, { trigger, reasonType }, { req, res });
    });

    await Passport.destroy({ user: user.id });

    await User.updateOne(user.id, {
        username: null,
        firstname: null,
        lastname: null,
        description: null,
        phone: null,
        phoneCheck: false,
        email: null,
        emailCheck: false,
        mediaId: null,
        destroyed: true,
    });
}
