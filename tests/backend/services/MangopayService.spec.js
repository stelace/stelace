var chai = require('chai'); // jshint ignore:line
var expect = chai.expect;

var MangopayService = require('../../../api/services/MangopayService');
var config          = require('../../../config/mangopay');

var mangopay = new MangopayService.getSingleton({
    username: config.mangopay.sandbox.clientId,
    password: config.mangopay.sandbox.passphrase,
    production: false
});

var checkHook = function (hook) {
    expect(hook).to.have.property("Url");
    expect(hook).to.have.property("Status");
    expect(hook).to.have.property("Validity");
    expect(hook).to.have.property("EventType");
    expect(hook).to.have.property("Id");
    expect(hook).to.have.property("Tag");
    expect(hook).to.have.property("CreationDate");
};

var checkUser = function (user) {
    expect(user).to.have.property("FirstName");
    expect(user).to.have.property("LastName");
    expect(user).to.have.property("Address");
    expect(user).to.have.property("Birthday");
    expect(user).to.have.property("Nationality");
    expect(user).to.have.property("CountryOfResidence");
    expect(user).to.have.property("Occupation");
    expect(user).to.have.property("IncomeRange");
    expect(user).to.have.property("ProofOfIdentity");
    expect(user).to.have.property("ProofOfAddress");
    expect(user).to.have.property("PersonType");
    expect(user).to.have.property("Email");
    expect(user).to.have.property("KYCLevel");
    expect(user).to.have.property("Id");
    expect(user).to.have.property("Tag");
    expect(user).to.have.property("CreationDate");
};

var checkUserLegal = function (user) {
    expect(user).to.have.property("Name");
    expect(user).to.have.property("LegalPersonType");
    expect(user).to.have.property("HeadquartersAddress");
    expect(user).to.have.property("LegalRepresentativeFirstName");
    expect(user).to.have.property("LegalRepresentativeLastName");
    expect(user).to.have.property("LegalRepresentativeEmail");
    expect(user).to.have.property("LegalRepresentativeBirthday");
    expect(user).to.have.property("LegalRepresentativeNationality");
    expect(user).to.have.property("LegalRepresentativeCountryOfResidence");
    expect(user).to.have.property("ProofOfRegistration");
    expect(user).to.have.property("ShareholderDeclaration");
    expect(user).to.have.property("LegalRepresentativeAddress");
    expect(user).to.have.property("Statute");
    expect(user).to.have.property("PersonType");
    expect(user).to.have.property("Email");
    expect(user).to.have.property("Id");
    expect(user).to.have.property("Tag");
    expect(user).to.have.property("CreationDate");
    expect(user).to.have.property("KYCLevel");
};

var checkWallet = function (wallet) {
    expect(wallet).to.have.property("Owners");
    expect(wallet).to.have.property("Description");
    expect(wallet).to.have.property("Balance");
    expect(wallet).to.have.property("Currency");
    expect(wallet).to.have.property("Id");
    expect(wallet).to.have.property("Tag");
    expect(wallet).to.have.property("CreationDate");
};

var checkCard = function (card) {
    expect(card).to.have.property("ExpirationDate");
    expect(card).to.have.property("Alias");
    expect(card).to.have.property("CardType");
    expect(card).to.have.property("CardProvider");
    expect(card).to.have.property("Country");
    expect(card).to.have.property("Product");
    expect(card).to.have.property("BankCode");
    expect(card).to.have.property("Active");
    expect(card).to.have.property("Currency");
    expect(card).to.have.property("Validity");
    expect(card).to.have.property("UserId");
    expect(card).to.have.property("Id");
    expect(card).to.have.property("Tag");
    expect(card).to.have.property("CreationDate");
};

var checkTransaction = function (transaction) {
    expect(transaction).to.have.property("Id");
    expect(transaction).to.have.property("Tag");
    expect(transaction).to.have.property("CreationDate");
    expect(transaction).to.have.property("AuthorId");
    expect(transaction).to.have.property("CreditedUserId");
    expect(transaction).to.have.property("DebitedFunds");
    expect(transaction).to.have.property("CreditedFunds");
    expect(transaction).to.have.property("Fees");
    expect(transaction).to.have.property("Status");
    expect(transaction).to.have.property("ResultCode");
    expect(transaction).to.have.property("ResultMessage");
    expect(transaction).to.have.property("ExecutionDate");
    expect(transaction).to.have.property("Type");
    expect(transaction).to.have.property("Nature");
    expect(transaction).to.have.property("CreditedWalletId");
    expect(transaction).to.have.property("DebitedWalletId");
};

var checkTransfer = function (transfer) {
    expect(transfer).to.have.property("Id");
    expect(transfer).to.have.property("Tag");
    expect(transfer).to.have.property("AuthorId");
    expect(transfer).to.have.property("CreditedUserId");
    expect(transfer).to.have.property("DebitedFunds");
    expect(transfer).to.have.property("Fees");
    expect(transfer).to.have.property("DebitedWalletId");
    expect(transfer).to.have.property("CreditedWalletId");
    expect(transfer).to.have.property("CreationDate");
    expect(transfer).to.have.property("CreditedFunds");
    expect(transfer).to.have.property("Status");
    expect(transfer).to.have.property("ResultCode");
    expect(transfer).to.have.property("ResultMessage");
    expect(transfer).to.have.property("ExecutionDate");
};

var checkCardRegistration = function (cardRegistration) {
    expect(cardRegistration).to.have.property("Id");
    expect(cardRegistration).to.have.property("UserId");
    expect(cardRegistration).to.have.property("Currency");
    expect(cardRegistration).to.have.property("AccessKey");
    expect(cardRegistration).to.have.property("PreregistrationData");
    expect(cardRegistration).to.have.property("CardRegistrationURL");
    expect(cardRegistration).to.have.property("RegistrationData");
    expect(cardRegistration).to.have.property("CardType");
    expect(cardRegistration).to.have.property("CardId");
    expect(cardRegistration).to.have.property("ResultCode");
    expect(cardRegistration).to.have.property("ResultMessage");
    expect(cardRegistration).to.have.property("Status");
    expect(cardRegistration).to.have.property("CreationDate");
    expect(cardRegistration).to.have.property("Tag");
};

var checkPreauthorization = function (preauthorization) {
    expect(preauthorization).to.have.property("Id");
    expect(preauthorization).to.have.property("Tag");
    expect(preauthorization).to.have.property("CreationDate");
    expect(preauthorization).to.have.property("AuthorId");
    expect(preauthorization).to.have.property("DebitedFunds");
    expect(preauthorization).to.have.property("AuthorizationDate");
    expect(preauthorization).to.have.property("Status");
    expect(preauthorization).to.have.property("PaymentStatus");
    expect(preauthorization).to.have.property("ExpirationDate");
    expect(preauthorization).to.have.property("PayInId");
    expect(preauthorization).to.have.property("ResultCode");
    expect(preauthorization).to.have.property("ResultMessage");
    expect(preauthorization).to.have.property("SecureMode");
    expect(preauthorization).to.have.property("CardId");
    expect(preauthorization).to.have.property("SecureModeReturnURL");
    expect(preauthorization).to.have.property("SecureModeRedirectURL");
    expect(preauthorization).to.have.property("SecureModeNeeded");
    expect(preauthorization).to.have.property("PaymentType");
    expect(preauthorization).to.have.property("ExecutionType");
};

var checkRefund = function (refund) {
    expect(refund).to.have.property("Id");
    expect(refund).to.have.property("Tag");
    expect(refund).to.have.property("CreationDate");
    expect(refund).to.have.property("AuthorId");
    expect(refund).to.have.property("CreditedUserId");
    expect(refund).to.have.property("DebitedFunds");
    expect(refund).to.have.property("CreditedFunds");
    expect(refund).to.have.property("Fees");
    expect(refund).to.have.property("Status");
    expect(refund).to.have.property("ResultCode");
    expect(refund).to.have.property("ExecutionDate");
    expect(refund).to.have.property("Type");
    expect(refund).to.have.property("Nature");
    expect(refund).to.have.property("InitialTransactionId");
    expect(refund).to.have.property("DebitedWalletId");
    expect(refund).to.have.property("CreditedWalletId");
    expect(refund).to.have.property("RefundReason");
};

var checkBankAccount = function (bankAccount) {
    expect(bankAccount).to.have.property("Id");
    expect(bankAccount).to.have.property("Tag");
    expect(bankAccount).to.have.property("Type");
    expect(bankAccount).to.have.property("OwnerName");
    expect(bankAccount).to.have.property("OwnerAddress");
    expect(bankAccount).to.have.property("UserId");
    expect(bankAccount).to.have.property("CreationDate");
};

var checkPayout = function (payout) {
    expect(payout).to.have.property("Id");
    expect(payout).to.have.property("Tag");
    expect(payout).to.have.property("CreationDate");
    expect(payout).to.have.property("AuthorId");
    expect(payout).to.have.property("DebitedFunds");
    expect(payout).to.have.property("CreditedFunds");
    expect(payout).to.have.property("Fees");
    expect(payout).to.have.property("Status");
    expect(payout).to.have.property("ResultCode");
    expect(payout).to.have.property("ExecutionDate");
    expect(payout).to.have.property("Type");
    expect(payout).to.have.property("Nature");
    expect(payout).to.have.property("DebitedWalletId");
    expect(payout).to.have.property("BankAccountId");
    expect(payout).to.have.property("BankWireRef");
};

xdescribe("Mangopay", function () {

    xdescribe("#getSingleton()", function () {
        it("should return the same instance if called multiple times", function () {
            var mangopay1 = new MangopayService.getSingleton({
                username: "Aladdin",
                password: "open sesame",
                production: false
            });
            var mangopay2 = new MangopayService.getSingleton({
                username: "Aladdin",
                password: "open sesame",
                production: false
            });
            var mangopay3 = new MangopayService.getSingleton({
                username: "Aladdin",
                password: "open sesame",
                production: true
            });
            var mangopay4 = new MangopayService.getSingleton({
                username: "Aladdinn",
                password: "open sesame",
                production: false
            });

            expect(mangopay1).to.equal(mangopay2);
            expect(mangopay2).not.to.equal(mangopay3);
            expect(mangopay1).not.to.equal(mangopay4);
        });
    });

    xdescribe("#HttpClient.getBasicAuthToken()", function () {
        it("should return basic auth token", function () {
            var tmpMangopay = new MangopayService.getInstance({
                username: "Aladdin",
                password: "open sesame",
                production: false
            });

            expect(tmpMangopay.httpClient.getBasicAuthToken()).to.equal("Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==");
        });
    });

    xdescribe("#HttpClient.getOAuth2Token()", function () {
        it("should return the same OAuth2 token if multiple times", function (done) {
            var cacheToken;

            return mangopay.httpClient
                .getOAuth2Token()
                .then(firstToken => {
                    cacheToken = firstToken;

                    return mangopay.httpClient.getOAuth2Token();
                })
                .then(secondToken => {
                    expect(secondToken).to.equal(cacheToken);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#event.list()", function () {
        it("should fetch events", function (done) {
            return mangopay.event
                .list()
                .then(events => {
                    if (events.length) {
                        var event = events[0];
                        expect(event).to.have.property("ResourceId");
                        expect(event).to.have.property("EventType");
                        expect(event).to.have.property("Date");
                    }

                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#hook.list()", function () {
        it("should fetch hooks", function (done) {
            return mangopay.hook
                .list()
                .then(hooks => {
                    if (hooks.length) {
                        var hook = hooks[0];
                        checkHook(hook);
                    }

                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#hook.fetch()", function () {
        it("should fetch a hook", function (done) {
            return mangopay.hook
                .fetch({ hookId: 8974315 })
                .then(hook => {
                    checkHook(hook);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#hook.create()", function () {
        it("should create a hook", function (done) {
            return mangopay.hook
                .create({
                    body: {
                        Url: "http://requestb.in/sxfj2gsx",
                        EventType: "PAYIN_NORMAL_SUCCEEDED",
                        Tag: "Test payin hook"
                    }
                })
                .then(hook => {
                    checkHook(hook);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#hook.edit()", function () {
        it("should edit a hook", function (done) {
            return mangopay.hook
                .edit({
                    hookId: 8974315,
                    body: {
                        Url: "http://requestb.in/sxfj2gsx",
                        Status: "ENABLED",
                        Tag: "Test payin hook"
                    }
                })
                .then(hook => {
                    checkHook(hook);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#user.fetch()", function () {
        it("should fetch a user", function (done) {
            return mangopay.user
                .fetch({ userId: 3695015 })
                .then(user => {
                    checkUser(user);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#user.wallets()", function () {
        it("should fetch wallets", function (done) {
            return mangopay.user
                .wallets({ userId: 3695015 })
                .then(wallets => {
                    if (wallets.length) {
                        var wallet = wallets[0];
                        checkWallet(wallet);
                    }

                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#user.list()", function () {
        it("should fetch users", function (done) {
            return mangopay.user
                .list()
                .then(users => {
                    if (users.length) {
                        var user = users[0];
                        expect(user).to.have.property("PersonType");
                        expect(user).to.have.property("Email");
                        expect(user).to.have.property("KYCLevel");
                        expect(user).to.have.property("Id");
                        expect(user).to.have.property("Tag");
                    }

                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#user.cards()", function () {
        it("should fetch cards", function (done) {
            return mangopay.user
                .cards({ userId: 3762495 })
                .then(cards => {
                    if (cards.length) {
                        var card = cards[0];
                        checkCard(card);
                    }

                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#user.transactions()", function () {
        it("should fetch transactions", function (done) {
            return mangopay.user
                .transactions({ userId: 3762482 })
                .then(transactions => {
                    if (transactions.length) {
                        var transaction = transactions[0];
                        checkTransaction(transaction);
                    }

                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#user.fetchNatural()", function () {
        it("should fetch a natural user", function (done) {
            return mangopay.user
                .fetchNatural({ userId: 3762482 })
                .then(user => {
                    checkUser(user);
                    expect(user.PersonType).to.equal("NATURAL");
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#user.createNatural()", function () {
        it("should create a natural user", function (done) {
            return mangopay.user
                .createNatural({
                    body: {
                        Email: "pl@aton.com",
                        FirstName: "Platon",
                        LastName: "Grec",
                        Birthday: 1000,
                        Nationality: "GR",
                        CountryOfResidence: "GR"
                    }
                })
                .then(user => {
                    checkUser(user);
                    expect(user.PersonType).to.equal("NATURAL");
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#user.editNatural()", function () {
        it("should edit a natural user", function (done) {
            return mangopay.user
                .editNatural({
                    userId: 7189437,
                    body: {
                        Email: "plat@on.com",
                        Birthday: 60000,
                        Nationality: "FR"
                    }
                })
                .then(user => {
                    checkUser(user);
                    expect(user.PersonType).to.equal("NATURAL");
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#user.fetchLegal()", function () {
        it("should fetch a legal user", function (done) {
            return mangopay.user
                .fetchLegal({ userId: 3762482 })
                .then(user => {
                    checkUserLegal(user);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#user.createLegal()", function () {
        it("should create a legal user", function (done) {
            return mangopay.user
                .createLegal({
                    body: {
                        Email: "Toto@land.com",
                        Name: "TotoLand",
                        LegalPersonType: "BUSINESS",
                        LegalRepresentativeFirstName: "Toto",
                        LegalRepresentativeLastName: "TOTO",
                        LegalRepresentativeBirthday: 153000,
                        LegalRepresentativeNationality: "FR",
                        LegalRepresentativeCountryOfResidence: "FR"
                    }
                })
                .then(user => {
                    checkUserLegal(user);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#user.editLegal()", function () {
        it("should edit a legal user", function (done) {
            return mangopay.user
                .editLegal({
                    userId: 7189472,
                    body: {
                        Email: "Toto@land.com",
                        Name: "TotoLand2",
                        LegalPersonType: "ORGANIZATION",
                        Tag: "Custom",
                        HeadquartersAddress: "Tour Eiffel"
                    }
                })
                .then(user => {
                    checkUserLegal(user);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#wallet.fetch()", function () {
        it("should fetch wallets", function (done) {
            return mangopay.wallet
                .fetch({ walletId: 3765599 })
                .then(wallet => {
                    checkWallet(wallet);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#wallet.create()", function () {
        it("should create a wallet", function (done) {
            return mangopay.wallet
                .create({
                    body: {
                        Owners: [7189472],
                        Description: "Test wallet",
                        Currency: "EUR"
                    }
                })
                .then(wallet => {
                    checkWallet(wallet);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#wallet.edit()", function () {
        it("should edit a wallet", function (done) {
            return mangopay.wallet
                .edit({
                    walletId: 7191353,
                    body: {
                        Description: "Test wallet modified",
                    }
                })
                .then(wallet => {
                    checkWallet(wallet);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#wallet.fetchTransfer()", function () {
        it("should fetch a transfer", function (done) {
            return mangopay.wallet
                .fetchTransfer({ transferId: 7191549 })
                .then(transfer => {
                    checkTransfer(transfer);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#wallet.createTransfer()", function () {
        it("should create a transfer", function (done) {
            return mangopay.wallet
                .createTransfer({
                    body: {
                        AuthorId: 3762495,
                        DebitedFunds: { Currency: "EUR", Amount: 1000 },
                        Fees: { Currency: "EUR", Amount: 100 },
                        DebitedWalletId: 3765596,
                        CreditedWalletId: 7191353
                    }
                })
                .then(transfer => {
                    checkTransfer(transfer);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#payin.fetch()", function () {
        it("should fetch a payin", function (done) {
            return mangopay.payin
                .fetch({ payinId: 7373852 })
                .then(payin => {
                    expect(payin).to.have.property("Id");
                    expect(payin).to.have.property("Tag");
                    expect(payin).to.have.property("CreationDate");
                    expect(payin).to.have.property("AuthorId");
                    expect(payin).to.have.property("CreditedUserId");
                    expect(payin).to.have.property("DebitedFunds");
                    expect(payin).to.have.property("CreditedFunds");
                    expect(payin).to.have.property("Fees");
                    expect(payin).to.have.property("Status");
                    expect(payin).to.have.property("ResultCode");
                    expect(payin).to.have.property("ResultMessage");
                    expect(payin).to.have.property("ExecutionDate");
                    expect(payin).to.have.property("Type");
                    expect(payin).to.have.property("Nature");
                    expect(payin).to.have.property("CreditedWalletId");
                    expect(payin).to.have.property("DebitedWalletId");
                    expect(payin).to.have.property("PaymentType");
                    expect(payin).to.have.property("ExecutionType");
                    expect(payin).to.have.property("SecureMode");
                    expect(payin).to.have.property("CardId");
                    expect(payin).to.have.property("SecureModeReturnURL");
                    expect(payin).to.have.property("SecureModeRedirectURL");
                    expect(payin).to.have.property("SecureModeNeeded");

                    done();
                })
                .catch(err => done(err));
        });
    });

    // not tested
    xdescribe("#payin.cardWeb()", function () {
        it("should create a payin card web", function (done) {
            return mangopay.payin
                .cardWeb({ payinId: 3765648 })
                .then(() => {
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#payin.cardDirect()", function () {
        it("should create a payin card web", function (done) {
            return mangopay.payin
                .cardDirect({
                    body: {
                        AuthorId: 3695014,
                        CreditedUserId: 7189472,
                        DebitedFunds: { Amount: 10000, Currency: "EUR" },
                        Fees: { Amount: 500, Currency: "EUR" },
                        CreditedWalletId: 7191353,
                        SecureModeReturnURL: "http://www.test.com",
                        CardId: 7370325
                    }
                })
                .then(payin => {
                    expect(payin).to.have.property("Id");
                    expect(payin).to.have.property("Tag");
                    expect(payin).to.have.property("CreationDate");
                    expect(payin).to.have.property("AuthorId");
                    expect(payin).to.have.property("CreditedUserId");
                    expect(payin).to.have.property("DebitedFunds");
                    expect(payin).to.have.property("CreditedFunds");
                    expect(payin).to.have.property("Fees");
                    expect(payin).to.have.property("Status");
                    expect(payin).to.have.property("ResultCode");
                    expect(payin).to.have.property("ResultMessage");
                    expect(payin).to.have.property("ExecutionDate");
                    expect(payin).to.have.property("Type");
                    expect(payin).to.have.property("Nature");
                    expect(payin).to.have.property("CreditedWalletId");
                    expect(payin).to.have.property("DebitedWalletId");
                    expect(payin).to.have.property("PaymentType");
                    expect(payin).to.have.property("ExecutionType");
                    expect(payin).to.have.property("SecureMode");
                    expect(payin).to.have.property("CardId");
                    expect(payin).to.have.property("SecureModeReturnURL");
                    expect(payin).to.have.property("SecureModeRedirectURL");
                    expect(payin).to.have.property("SecureModeNeeded");

                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#payin.preauthorizedDirect()", function () {
        it("should create a payin preauthorized direct", function (done) {
            return mangopay.payin
                .preauthorizedDirect({
                    body: {
                        AuthorId: 3695014,
                        DebitedFunds: { Amount: 1000, Currency: "EUR" },
                        Fees: { Amount: 500, Currency: "EUR" },
                        CreditedWalletId: 3765602,
                        PreauthorizationId: 7373929
                    }
                })
                .then(payin => {
                    expect(payin).to.have.property("Id");
                    expect(payin).to.have.property("Tag");
                    expect(payin).to.have.property("CreationDate");
                    expect(payin).to.have.property("ResultCode");
                    expect(payin).to.have.property("ResultMessage");
                    expect(payin).to.have.property("AuthorId");
                    expect(payin).to.have.property("CreditedUserId");
                    expect(payin).to.have.property("DebitedFunds");
                    expect(payin).to.have.property("CreditedFunds");
                    expect(payin).to.have.property("Fees");
                    expect(payin).to.have.property("Status");
                    expect(payin).to.have.property("ExecutionDate");
                    expect(payin).to.have.property("Type");
                    expect(payin).to.have.property("Nature");
                    expect(payin).to.have.property("CreditedWalletId");
                    expect(payin).to.have.property("DebitedWalletId");
                    expect(payin).to.have.property("PaymentType");
                    expect(payin).to.have.property("ExecutionType");
                    expect(payin).to.have.property("PreauthorizationId");

                    done();
                })
                .catch(err => done(err));
        });
    });

    // not tested
    xdescribe("#payin.bankwireDirect()", function () {
        it("should create a payin bankwire direct", function (done) {
            return mangopay.payin
                .bankwireDirect({ payinId: 3765648 })
                .then(() => {
                    done();
                })
                .catch(err => done(err));
        });
    });

    // not tested
    xdescribe("#payin.directDebitWeb()", function () {
        it("should create a payin direct debit web", function (done) {
            return mangopay.payin
                .directDebitWeb({ payinId: 3765648 })
                .then(() => {
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#card.fetch()", function () {
        it("should fetch a card", function (done) {
            return mangopay.card
                .fetch({ cardId: 3765648 })
                .then(card => {
                    checkCard(card);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#card.edit()", function () {
        it("should edit a card", function (done) {
            return mangopay.card
                .edit({
                    cardId: 3765648,
                    body: {
                        Active: false
                    }
                })
                .then(card => {
                    checkCard(card);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#card.createRegistration()", function () {
        it("should create a card registration", function (done) {
            return mangopay.card
                .createRegistration({
                    body: {
                        UserId: 3695014,
                        Currency: "EUR"
                    }
                })
                .then(cardRegistration => {
                    checkCardRegistration(cardRegistration);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#card.editRegistration()", function () {
        it("should edit a card registration", function (done) {
            return mangopay.card
                .editRegistration({
                    cardRegistrationId: 7370310,
                    body: {
                        RegistrationData: "data=nyE9OPhlGammVS88Gn2dO9iS2AuYccPhsNANnK-2TbJijW9wabZ_B4Ylz9EI3LUjSUx9kROdBT46Z_cfkvEw-y_sV5ssoDPtj8_6CDMEHkan591UZ_FeHAhkDZ01wxj4UJP50u7T6WfgfL0-XpoDvQ"
                    }
                })
                .then(cardRegistration => {
                    checkCardRegistration(cardRegistration);
                    expect(cardRegistration.Status).to.equal("VALIDATED");
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#preauthorization.fetch()", function () {
        it("should fetch a preauthorization", function (done) {
            return mangopay.preauthorization
                .fetch({
                    preauthorizationId: 7373929
                })
                .then(preauthorization => {
                    checkPreauthorization(preauthorization);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#preauthorization.create()", function () {
        it("should create a preauthorization", function (done) {
            return mangopay.preauthorization
                .create({
                    body: {
                        AuthorId: "3695014",
                        DebitedFunds: { Amount: 1000, Currency: "EUR" },
                        SecureMode: "DEFAULT",
                        CardId: "7370325",
                        SecureModeReturnURL: "http://www.test.com"
                    }
                })
                .then(preauthorization => {
                    checkPreauthorization(preauthorization);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#preauthorization.edit()", function () {
        it("should edit a preauthorization", function (done) {
            return mangopay.preauthorization
                .edit({
                    preauthorizationId: "7370357",
                    body: {
                        PaymentStatus: "canceled"
                    }
                })
                .then(preauthorization => {
                    checkPreauthorization(preauthorization);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#refund.fetch()", function () {
        it("should fetch a refund", function (done) {
            return mangopay.refund
                .fetch({
                    refundId: 7373929
                })
                .then(refund => {
                    checkRefund(refund);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#refund.transfer()", function () {
        it("should create a refund from transfer", function (done) {
            return mangopay.refund
                .transfer({
                    transferId: 7375194,
                    body: {
                        AuthorId: 3762495
                    }
                })
                .then(refund => {
                    checkRefund(refund);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#refund.payin()", function () {
        it("should create a refund from payin", function (done) {
            return mangopay.refund
                .payin({
                    payinId: 7373848,
                    body: {
                        AuthorId: 3695014,
                        DebitedFunds: { Amount: 200, Currency: "EUR" },
                        Fees: { Amount: 100, Currency: "EUR" }
                    }
                })
                .then(refund => {
                    checkRefund(refund);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#bankAccount.list()", function () {
        it("should fetch bank accounts", function (done) {
            return mangopay.bankAccount
                .list({ userId: 3695014 })
                .then(bankAccounts => {
                    if (bankAccounts.length) {
                        var bankAccount = bankAccounts[0];
                        checkBankAccount(bankAccount);
                    }
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#bankAccount.fetch()", function () {
        it("should fetch a bank account", function (done) {
            return mangopay.bankAccount
                .fetch({
                    userId: 3695014,
                    bankAccountId: 9030143
                })
                .then(bankAccount => {
                    checkBankAccount(bankAccount);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#bankAccount.create()", function () {
        it("should create a bank account", function (done) {
            return mangopay.bankAccount
                .create({
                    userId: 3695014,
                    type: "IBAN",
                    body: {
                        OwnerName: "Victor Hugo",
                        OwnerAddress: {
                            AddressLine1: "10 Place du Panthéon",
                            City: "Paris",
                            PostalCode: "75005",
                            Country: "FR"
                        },
                        IBAN: "FR1420041010050500013M02606"
                    }
                })
                .then(bankAccount => {
                    checkBankAccount(bankAccount);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#payout.fetch()", function () {
        it("should fetch a payout", function (done) {
            return mangopay.payout
                .fetch({ payoutId: 9030213 })
                .then(payout => {
                    checkPayout(payout);
                    done();
                })
                .catch(err => done(err));
        });
    });

    xdescribe("#payout.create()", function () {
        it("should create a payout", function (done) {
            return mangopay.payout
                .create({
                    body: {
                        AuthorId: 3695014,
                        DebitedWalletId: 3765602,
                        DebitedFunds: { Amount: 200, Currency: "EUR" },
                        Fees: { Amout: 0, Currency: "EUR" },
                        BankAccountId: 9030143
                    }
                })
                .then(payout => {
                    checkPayout(payout);
                    done();
                })
                .catch(err => done(err));
        });
    });

});
