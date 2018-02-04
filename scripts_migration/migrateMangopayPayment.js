/* global BankAccount, Booking, BootstrapService, Card, Kyc, mangopay, Transaction, TransactionLog, User */

const Sails = require('sails');
const { getConfig } = require('../sailsrc');
const Promise = require('bluebird');

Sails.load(getConfig(), async function (err, sails) {
    if (err) {
        console.log("\n!!! Fail script launch: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    try {
        await migrateUser();
        await migrateTransactionLog();
        await migrateTransaction();
        await migrateBooking();
        await migrateCard();
    } catch (err) {
        console.log(err);

        if (err.stack) {
            console.log(err.stack);
        }
    } finally {
        sails.lowerSafe();
    }



    async function migrateUser() {
        await User.update({}, { paymentData: {} });

        const mangopayUsers = await User.find({ mangopayUserId: { '!=': null } });
        await Promise.each(mangopayUsers, async (user) => {
            try {
                const paymentData = {
                    mangopay: {},
                };

                paymentData.mangopay.naturalUserId = user.mangopayUserId;
                if (user.walletId) {
                    paymentData.mangopay.naturalWalletId = user.walletId;
                }

                await User.updateOne(user.id, { userType: 'individual', paymentData });

                if (user.bankAccountId) {
                    const bankAccount = await mangopay.Users.getBankAccount(user.mangopayUserId, user.bankAccountId);
                    const parsedBankAccount = BankAccount.parseMangopayData(bankAccount);
                    parsedBankAccount.userId = user.id;
                    await BankAccount.create(parsedBankAccount);
                }
            } catch (err) {
                // do nothing
            }
        });

        const users = await User.find({
            or: [
                { birthday: { '!=': null } },
                { nationality: { '!=': null } },
                { countryOfResidence: { '!=': null } },
            ],
        });

        await Promise.each(users, async (user) => {
            try {
                const data = {};
                if (user.birthday) {
                    data.birthday = user.birthday;
                }
                if (user.nationality) {
                    data.nationality = user.nationality;
                }
                if (user.countryOfResidence) {
                    data.countryOfResidence = user.countryOfResidence;
                }

                await Kyc.create({
                    userId: user.id,
                    data,
                });
            } catch (err) {
                // do nothing
            }
        });
    }

    async function migrateTransactionLog() {
        await TransactionLog.update({}, { paymentProvider: 'mangopay' });
    }

    async function migrateTransaction() {
        await Transaction.update({}, { paymentProvider: 'mangopay', currency: 'EUR' });
    }

    async function migrateBooking() {
        await Booking.update({}, { paymentProvider: 'mangopay' });
    }

    async function migrateCard() {
        const cards = await Card.find();

        await Promise.each(cards, async (card) => {
            try {
                const rawCard = await mangopay.Cards.get(card.mangopayId);
                const parsedCard = Card.parseMangopayData(rawCard);
                parsedCard.userId = card.userId;

                await Card.updateOne(card.id, parsedCard);
            } catch (err) {
                // do nothing
            }
        });
    }

});
