/* global Booking, BootstrapService, Card, mangopay, Transaction, User */

const Sails = require('sails');
const { getConfig } = require('../sailsrc');

const Promise = require('bluebird');

Sails.load(getConfig(), async function (err, sails) {
    if (err) {
        console.log("\n!!! Fail script launch: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    var damageAmount = 10;
    var userId       = 121;
    var ownerId      = 1; // give damage compensation to this user
    var bookingId    = 28;
    var cardId       = 18;

    return Promise
        .resolve()
        .then(() => {
            return [
                User.findOne({ id: userId }),
                User.findOne({ id: ownerId }),
                Booking.findOne({ id: bookingId }),
                Card.findOne({ id: cardId })
            ];
        })
        .spread((user, owner, booking, card) => {
            if (! user
             || ! owner
             || ! booking
             || ! card
            ) {
                throw new Error("missing references");
            }
            if (card.userId !== userId) {
                throw new Error("bad card");
            }

            console.log("Preauthorization creating");

            return createPreauthorization(user, card, booking, damageAmount)
                .then(preauthorization => {
                    console.log("Preauthorization created");

                    return [
                        user,
                        owner,
                        booking,
                        preauthorization
                    ];
                });
        })
        .spread((user, owner, booking, preauthorization) => {
            console.log("Payin creating");

            return createPayin(user, booking, preauthorization, damageAmount)
                .then(() => {
                    console.log("Payin created");

                    return [
                        user,
                        owner,
                        booking
                    ];
                });
        })
        .spread((user, owner, booking) => {
            console.log("Transfer creating");

            return createTransfer(user, owner, booking, damageAmount)
                .then(() => {
                    console.log("Transfer created");

                    return [
                        owner,
                        booking
                    ];
                });
        })
        .spread((owner, booking) => {
            console.log("Payout creating");

            return createPayout(owner, booking, damageAmount)
                .then(() => {
                    console.log("Payout created");
                });
        })
        .catch(err => {
            console.log(err.message);
            console.log(err.stack);
        })
        .finally(() => {
            sails.lowerSafe();
        });



    function createPreauthorization(user, card, booking, damageAmount) {
        return mangopay.preauthorization
            .create({
                body: {
                    AuthorId: user.mangopayUserId,
                    DebitedFunds: { Amount: Math.round(damageAmount * 100), Currency: "EUR" },
                    SecureMode: "DEFAULT",
                    CardId: card.mangopayId,
                    SecureModeReturnURL: "https://example.com" // fake url because secure mode isn't triggered
                }
            })
            .then(preauthorization => {
                if (preauthorization.Status === "FAILED") {
                    var error = new Error("Preauthorization failed");
                    error.preauthorization = preauthorization;
                    throw error;
                }

                var config = {
                    booking: booking,
                    preauthorization: preauthorization,
                    preauthAmount: damageAmount,
                    label: "deposit item damage"
                };

                return Transaction
                    .createPreauthorization(config)
                    .then(() => preauthorization);
            });
    }

    function createPayin(user, booking, preauthorization, damageAmount) {
        return mangopay.payin
            .preauthorizedDirect({
                body: {
                    AuthorId: user.mangopayUserId,
                    DebitedFunds: { Amount: Math.round(damageAmount * 100), Currency: "EUR" },
                    Fees: { Amount: 0, Currency: "EUR" },
                    CreditedWalletId: user.walletId,
                    PreauthorizationId: preauthorization.Id
                }
            })
            .then(payin => {
                if (payin.Status === "FAILED") {
                    var error = new Error("Payin failed");
                    error.payin = payin;
                    throw error;
                }

                var config = {
                    booking: booking,
                    payin: payin,
                    amount: damageAmount,
                    label: "payment item damage"
                };

                return Transaction.createPayin(config)
                    .then(() => payin);
            });
    }

    function createTransfer(user, owner, booking, damageAmount) {
        return mangopay.wallet
            .createTransfer({
                body: {
                    AuthorId: user.mangopayUserId,
                    DebitedFunds: { Amount: damageAmount * 100, Currency: "EUR" },
                    Fees: { Amount: 0, Currency: "EUR" },
                    DebitedWalletId: user.walletId,
                    CreditedWalletId: owner.walletId
                }
            })
            .then(transfer => {
                if (transfer.Status === "FAILED") {
                    var error = new Error("Transfer creation failed");
                    error.transfer = transfer;

                    throw error;
                }

                var config = {
                    booking: booking,
                    transfer: transfer,
                    amount: damageAmount,
                    ownerFees: 0,
                    takerFees: 0,
                    label: "payment item damage"
                };

                return Transaction.createTransfer(config)
                    .then(() => transfer);
            });
    }

    function createPayout(owner, booking, damageAmount) {
        return mangopay.payout
            .create({
                body: {
                    AuthorId: owner.mangopayUserId,
                    DebitedWalletId: owner.walletId,
                    DebitedFunds: { Amount: Math.round(damageAmount * 100), Currency: "EUR" },
                    Fees: { Amount: 0, Currency: "EUR" },
                    BankAccountId: owner.bankAccountId
                }
            })
            .then(payout => {
                if (payout.Status === "FAILED") {
                    var error = new Error("Payout failed");
                    error.payout = payout;
                    throw error;
                }

                var config = {
                    booking: booking,
                    payout: payout,
                    payoutAmount: damageAmount,
                    label: "payment item damage"
                };

                return Transaction.createPayout(config)
                    .then(() => payout);
            });
    }
});
