/* global Booking, BootstrapService, Card, PaymentMangopayService, TransactionService, User */

const Sails = require('sails');
const { getConfig } = require('../sailsrc');

const Promise = require('bluebird');
const createError = require('http-errors');

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



    async function createPreauthorization(user, card, booking, damageAmount) {
        const preauthorization = await PaymentMangopayService.createPreauthorization({
            user,
            card,
            amount: damageAmount,
            currency: booking.currency,
            setSecureMode: false,
        });

        if (preauthorization.Status === 'FAILED') {
            throw createError('Preauthorization failed', {
                preauthorization,
            });
        }

        await TransactionService.createPreauthorization({
            booking,
            providerData: {
                preauthorization,
            },
            preauthAmount: damageAmount,
            label: 'deposit listing damage',
        });

        return preauthorization;
    }

    async function createPayin(user, booking, preauthorization, damageAmount) {
        const payin = await PaymentMangopayService.createPayin({
            booking,
            providerData: { payin },
            amount: damageAmount,
            label: 'payment listing damage',
        });

        if (payin.Status === 'FAILED') {
            throw createError('Payin failed', {
                payin,
            });
        }

        await TransactionService.createPayin({
            booking,
            providerData: { payin },
            amount: damageAmount,
            label: 'payment listing damage',
        });

        return payin;
    }

    async function createTransfer(user, owner, booking, damageAmount) {
        const transfer = await PaymentMangopayService.createTransfer({
            booking,
            taker: user,
            owner,
            amount: damageAmount,
        });

        if (transfer.Status === 'FAILED') {
            throw createError('Transfer creation failed', {
                transfer,
            });
        }

        await TransactionService.createTransfer({
            booking,
            providerData: { transfer },
            amount: damageAmount,
            label: 'payment listing damage',
        });

        return transfer;
    }

    async function createPayout(owner, booking, damageAmount) {
        const payout = await PaymentMangopayService.createPayout({
            booking,
            owner,
            amount: damageAmount,
        });

        if (payout.Status === 'FAILED') {
            throw createError('Payout failed', {
                payout,
            });
        }

        await TransactionService.createPayout({
            booking,
            providerData: { payout },
            payoutAmount: damageAmount,
            label: 'payment listing damage',
        });

        return payout;
    }
});
