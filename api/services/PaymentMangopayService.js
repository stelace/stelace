/* global BankAccount, Booking, Card, CurrencyService, Kyc, StelaceConfigService, Transaction, User */

module.exports = {

    getMangopayInstance,
    unsetMangopayInstance,

    createUser,
    createNaturalUser,
    createLegalUser,

    createWallet,
    createBankAccount,

    createCardRegistration,
    updateCardRegistration,

    fetchCard,
    createCard,
    refreshCard,
    deactivateCard,

    fetchPreauthorization,
    createPreauthorization,
    copyPreauthorization,
    cancelPreauthorization,

    createPayin,
    cancelPayin,
    createTransfer,
    cancelTransfer,
    createPayout,
}

const _ = require('lodash');
const createError = require('http-errors');
const moment = require('moment');
const Mangopay = require('mangopay2-nodejs-sdk');

let mangopayInstance;

async function getMangopayInstance() {
    if (mangopayInstance) return mangopayInstance;

    const secretData = await StelaceConfigService.getSecretData();

    const clientId = secretData.mangopay_clientId
    const passphrase = secretData.mangopay_passphrase;

    const workspace = sails.config.mangopay.workspace;

    if (!clientId || !passphrase) {
        throw createError('Missing Mangopay client credentials', { missingCredentials: true });
    }

    mangopayInstance = new Mangopay({
        clientId,
        clientPassword: passphrase,
        baseUrl: workspace === 'production' ? 'https://api.mangopay.com' : 'https://api.sandbox.mangopay.com',
        apiVersion: 'v2.01',
    });

    return mangopayInstance;
}

function unsetMangopayInstance() {
    mangopayInstance = null;
}

async function createUser(user) {
    let updatedUser;
    if (user.userType === 'individual') {
        updatedUser = await createNaturalUser(user);
    } else if (user.userType === 'organization') {
        updatedUser = await createLegalUser(user);
    } else {
        throw new Error('Missing user type');
    }

    return updatedUser;
}

async function createNaturalUser(user) {
    // already created
    if (_.get(user, 'paymentData.mangopay.naturalUserId')) {
        return user;
    }

    if (!user.email) {
        throw createError(400, 'Missing params');
    }

    const kyc = await Kyc.findOne({ userId: user.id });
    if (!kyc
     || !kyc.data.birthday
     || !kyc.data.nationality
     || !kyc.data.countryOfResidence
    ) {
        throw createError(400, 'Missing KYC');
    }

    const mangopay = await getMangopayInstance();

    const mangopayUser = await mangopay.Users.create({
        Email: user.email,
        FirstName: user.firstname,
        LastName: user.lastname,
        Birthday: parseInt(moment(new Date(kyc.data.birthday)).format("X"), 10), // unix timestamp
        Nationality: kyc.data.nationality,
        CountryOfResidence: kyc.data.countryOfResidence,
        PersonType: 'NATURAL',
    });

    const paymentData = User.getMergedPaymentData(user, { mangopay: { naturalUserId: mangopayUser.Id } });
    const updatedUser = await User.updateOne(user.id, { paymentData });
    return updatedUser;
}

async function createLegalUser(user) {
    // already created
    if (_.get(user, 'paymentData.mangopay.legalUserId')) {
        return user;
    }

    if (!user.email
     || !user.organizationName
    ) {
        throw createError(400, 'Missing params');
    }

    const kyc = await Kyc.findOne({ userId: user.id });
    if (!kyc
     || !kyc.data.legalPersonType
     || !kyc.data.legalRepresentativeBirthday
     || !kyc.data.legalRepresentativeCountryOfResidence
     || !kyc.data.legalRepresentativeNationality
     || !kyc.data.legalRepresentativeFirstname
     || !kyc.data.legalRepresentativeLastname
    ) {
        throw createError(400, 'Missing KYC');
    }

    const mangopay = await getMangopayInstance();

    const mangopayUser = await mangopay.Users.create({
        Email: user.email,
        Name: user.organizationName,
        LegalRepresentativeBirthday: parseInt(moment(new Date(kyc.data.legalRepresentativeBirthday)).format("X"), 10), // unix timestamp
        LegalRepresentativeCountryOfResidence: kyc.data.legalRepresentativeCountryOfResidence,
        LegalRepresentativeNationality: kyc.data.legalRepresentativeNationality,
        LegalRepresentativeFirstName: kyc.data.legalRepresentativeFirstname,
        LegalRepresentativeLastName: kyc.data.legalRepresentativeLastname,
        PersonType: 'LEGAL',
    });

    const paymentData = User.getMergedPaymentData(user, { mangopay: { legalUserId: mangopayUser.Id } });
    const updatedUser = await User.updateOne(user.id, { paymentData });
    return updatedUser;
}

async function createWallet(user, { currency = 'EUR' } = {}) {
    if (!user.userType) {
        throw new Error('Missing user type');
    }
    if (!User.getMangopayUserId(user)) {
        throw new Error('Create the user first');
    }
    if (!CurrencyService.isValidCurrency(currency)) {
        throw createError(400, 'Incorrect currency');
    }

    // already created
    if (User.getMangopayWalletId(user)) {
        return user;
    }

    let walletField;
    if (user.userType === 'individual') {
        walletField = 'naturalWalletId';
    } else { // user.userType === 'organization'
        walletField = 'legalWalletId';
    }

    const mangopayUserId = User.getMangopayUserId(user);

    const mangopay = await getMangopayInstance();

    const mangopayWallet = await mangopay.Wallets.create({
        Owners: [mangopayUserId],
        Description: 'Main wallet',
        Currency: currency,
    });

    const paymentData = User.getMergedPaymentData(user, { mangopay: { [walletField]: mangopayWallet.Id } });
    const updatedUser = await User.updateOne(user.id, { paymentData });
    return updatedUser;
}

async function createBankAccount(user, { ownerAddress, ownerName, iban } = {}) {
    if (!User.getMangopayUserId(user)) {
        throw new Error('Create the user first');
    }

    if (!ownerName
     || !iban
     || typeof ownerAddress !== 'object'
     || !ownerAddress.AddressLine1
     || !ownerAddress.City
     || !ownerAddress.PostalCode
     || !ownerAddress.Country
    ) {
        throw createError(400, 'Missing params');
    }

    const mangopayUserId = User.getMangopayUserId(user);

    const mangopay = await getMangopayInstance();

    const mangopayBankAccount = await mangopay.Users.createBankAccount(mangopayUserId, {
        OwnerName: ownerName,
        OwnerAddress: ownerAddress,
        IBAN: iban,
        Type: 'IBAN',
    });

    const parsedBankAccount = BankAccount.parseMangopayData(mangopayBankAccount);
    parsedBankAccount.userId = user.id;
    const bankAccount = await BankAccount.create(parsedBankAccount);
    return bankAccount;
}

async function createCardRegistration(user, { currency = 'EUR', cardType } = {}) {
    if (!user.userType) {
        throw new Error('Missing user type');
    }
    if (!User.getMangopayUserId(user)) {
        throw new Error('Create the user first');
    }

    if (!CurrencyService.isValidCurrency(currency)) {
        throw createError(400, 'Incorrect currency');
    }

    const mangopayUserId = User.getMangopayUserId(user);

    const mangopay = await getMangopayInstance();

    const cardRegistration = await mangopay.CardRegistrations.create({
        UserId: mangopayUserId,
        Currency: currency,
        CardType: cardType,
    });

    return cardRegistration;
}

async function updateCardRegistration({ cardRegistrationId, registrationData }) {
    const mangopay = await getMangopayInstance();

    const cardRegistration = await mangopay.CardRegistrations.update({
        Id: cardRegistrationId,
        RegistrationData: registrationData,
    });

    return cardRegistration;
}

async function fetchCard(providerCardId) {
    const mangopay = await getMangopayInstance();

    const card = await mangopay.Cards.get(providerCardId);
    return card;
}

async function createCard({ userId, providerCardId, forget }) {
    const providerCard = await fetchCard(providerCardId);
    const parsedCard = Card.parseMangopayData(providerCard);
    parsedCard.userId = userId;

    if (typeof forget !== 'undefined') {
        parsedCard.forget = forget;
    }

    const card = await Card.create(parsedCard);
    return card;
}

async function refreshCard(card) {
    const providerCard = await fetchCard(card.resourceId);
    const parsedCard = Card.parseMangopayData(providerCard);

    const updatedCard = await Card.updateOne(card.id, parsedCard);
    return updatedCard;
}

async function deactivateCard(card) {
    const mangopay = await getMangopayInstance();

    await mangopay.Cards.update(card.resourceId, {
        Active: false,
    });

    const updatedCard = await Card.updateOne(card.id, { active: false });
    return updatedCard;
}

async function fetchPreauthorization(preauthorizationId) {
    const mangopay = await getMangopayInstance();

    const preauthorization = await mangopay.CardPreAuthorizations.get(preauthorizationId);
    return preauthorization;
}

/**
 * @param {Object} user
 * @param {Object} card
 * @param {Number} amount
 * @param {String} currency
 * @param {Boolean} [setSecureMode = false]
 * @param {String} [returnUrl]
 */
async function createPreauthorization({
    user,
    card,
    amount,
    currency,
    setSecureMode = false,
    returnUrl,
}) {
    if (setSecureMode && !returnUrl) {
        throw new Error('Missing return url');
    }

    const mangopay = await getMangopayInstance();

    const mangopayUserId = User.getMangopayUserId(user);

    const preauthorization = mangopay.CardPreAuthorizations.create({
        AuthorId: mangopayUserId,
        DebitedFunds: {
            Amount: CurrencyService.getISOAmount(amount, currency),
            Currency: currency,
        },
        SecureMode: setSecureMode ? 'FORCE' : 'DEFAULT',
        CardId: card.resourceId,
        SecureModeReturnURL: returnUrl || 'https://example.com', // fake a real url
    });

    return preauthorization;
}

async function copyPreauthorization({ transaction, amount }) {
    const mangopay = await getMangopayInstance();

    const preauth = await mangopay.CardPreAuthorizations.get(transaction.resourceId);

    const currency = preauth.DebitedFunds.Currency;

    const newPreauth = await mangopay.CardPreAuthorizations.create({
        AuthorId: preauth.AuthorId,
        DebitedFunds: {
            Amount: CurrencyService.getISOAmount(amount, currency),
            Currency: currency,
        },
        SecureMode: 'DEFAULT',
        CardId: preauth.CardId,
        SecureModeReturnURL: 'https://example.com', // use a real url for mangopay
    });

    return newPreauth;
}

async function cancelPreauthorization({ transaction }) {
    if (Transaction.isPreauthorizationCancellable(transaction)) {
        const mangopay = await getMangopayInstance();

        await mangopay.CardPreAuthorizations.update(transaction.resourceId, {
            PaymentStatus: 'CANCELED',
        });
    }
}

async function createPayin({
    booking,
    transaction,
    taker,
    amount,
    takerFees = 0,
}) {
    const mangopay = await getMangopayInstance();

    const mangopayUserId = User.getMangopayUserId(taker);

    const payin = await mangopay.PayIns.create({
        AuthorId: mangopayUserId,
        DebitedFunds: {
            Amount: CurrencyService.getISOAmount(amount, booking.currency),
            currency: booking.currency,
        },
        Fees: {
            Amount: CurrencyService.getISOAmount(takerFees, booking.currency),
            currency: booking.currency,
        },
        CreditedWalletId: User.getMangopayWalletId(taker),
        PreauthorizationId: transaction.resourceId,
        Tag: Booking.getBookingRef(booking.id),
        PaymentType: 'PREAUTHORIZED',
        ExecutionType: 'DIRECT',
    });

    if (payin.Status === "FAILED") {
        throw createError('Payin creation failed', {
            bookingId: booking.id,
            payin,
        });
    }

    return payin;
}

async function cancelPayin({
    booking,
    transaction,
    taker,
    amount,
    refundTakerFees,
}) {
    const refundTotally = (typeof amount === 'undefined' && typeof refundTakerFees === 'undefined');

    const body = {
        AuthorId: User.getMangopayUserId(taker),
        Tag: Booking.getBookingRef(booking.id),
    };

    if (! refundTotally) {
        amount          = amount || 0;
        refundTakerFees = refundTakerFees || 0;

        body.DebitedFunds = {
            Amount: CurrencyService.getISOAmount(amount, booking.currency),
            Currency: booking.currency,
        };
        body.Fees = {
            Amount: CurrencyService.getISOAmount(-refundTakerFees, booking.currency),
            Currency: booking.currency,
        };
    }

    const mangopay = await getMangopayInstance();

    const refund = await mangopay.PayIns.createRefund(transaction.resourceId, body);

    if (refund.Status === "FAILED") {
        throw createError('Refund payin creation failed', {
            bookingId: booking.id,
            refund,
        });
    }

    return refund;
}

async function createTransfer({
    booking,
    taker,
    owner,
    amount,
    fees,
}) {
    const mangopay = await getMangopayInstance();

    const transfer = await mangopay.Transfers.create({
        AuthorId: User.getMangopayUserId(taker),
        DebitedFunds: {
            Amount: CurrencyService.getISOAmount(amount, booking.currency),
            Currency: booking.currency,
        },
        Fees: {
            Amount: CurrencyService.getISOAmount(fees, booking.currency),
            Currency: booking.currency,
        },
        DebitedWalletId: User.getMangopayWalletId(taker),
        CreditedWalletId: User.getMangopayWalletId(owner),
        Tag: Booking.getBookingRef(booking.id)
    });

    if (transfer.Status === "FAILED") {
        throw createError('Transfer creation failed', {
            bookingId: booking.id,
            transfer,
        });
    }

    return transfer;
}

async function cancelTransfer({
    booking,
    transaction,
    taker,
}) {
    const mangopay = await getMangopayInstance();

    const refund = await mangopay.Transfers.createRefund(transaction.resourceId, {
        AuthorId: User.getMangopayUserId(taker),
        Tag: Booking.getBookingRef(booking.id),
    });

    if (refund.Status === 'FAILED') {
        throw createError('Refund transfer creation failed', {
            bookingId: booking.id,
            refund,
        });
    }

    return refund;
}

async function createPayout({
    booking,
    owner,
    amount,
}) {
    const bankWireRef = Booking.getBookingRef(booking.id);

    const bankAccount = await BankAccount.findOne({
        resourceOwnerId: User.getMangopayUserId(owner),
        paymentProvider: 'mangopay',
        active: true,
    });
    if (!bankAccount) {
        throw new Error('Bank account not found');
    }

    const fees = 0;

    const mangopay = await getMangopayInstance();

    const payout = await mangopay.PayOuts.create({
        AuthorId: User.getMangopayUserId(owner),
        DebitedWalletId: User.getMangopayWalletId(owner),
        DebitedFunds: {
            Amount: CurrencyService.getISOAmount(amount, booking.currency),
            Currency: booking.currency,
        },
        Fees: {
            Amount: CurrencyService.getISOAmount(fees, booking.currency),
            Currency: booking.currency,
        },
        BankAccountId: bankAccount.resourceId,
        Tag: Booking.getBookingRef(booking.id),
        BankWireRef: bankWireRef,
        PaymentType: 'BANK_WIRE',
    });

    if (payout.Status === 'FAILED') {
        throw createError('Payout creation failed', {
            bookingId: booking.id,
            payout,
        });
    }

    return payout;
}
