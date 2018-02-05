/* global BankAccount */

const { expect } = require('chai');

describe('BankAccount', () => {
    describe('.parseMangopayData()', () => {
        it('parses the mangopay raw object', () => {
            const rawBankAccount = {
                Id: '8494514',
                CreationDate: 12926321,
                Tag: 'custom meta',
                Type: 'IBAN',
                OwnerAddress: {
                    AddressLine1: '1 Mangopay Street',
                    AddressLine2: 'The Loop',
                    City: 'Paris',
                    Region: 'Ile de France',
                    PostalCode: '75001',
                    Country: 'FR'
                },
                OwnerName: 'Joe Blogs',
                UserId: '8494514',
                Active: true,
                IBAN: 'FR3020041010124530725S03383',
                BIC: 'CRLYFRPP',
            };

            const parsedData = BankAccount.parseMangopayData(rawBankAccount);
            const expected = {
                paymentProvider: 'mangopay',
                resourceOwnerId: '8494514',
                resourceId: '8494514',
                active: true,
                ownerName: 'Joe Blogs',
                data: {
                    type: 'IBAN',
                    iban: 'FR3020041010124530725S03383',
                    bic: 'CRLYFRPP',
                    ownerAddress: {
                        AddressLine1: '1 Mangopay Street',
                        AddressLine2: 'The Loop',
                        City: 'Paris',
                        Region: 'Ile de France',
                        PostalCode: '75001',
                        Country: 'FR'
                    },
                },
            };
            expect(parsedData).to.deep.equal(expected);
        });
    });

    describe('.parseStripeData()', () => {
        it('parses the stripe raw object', () => {
            const rawBankAccount = {
                id: 'ba_1BrrjC2eZvKYlo2Cogd6j83P',
                object: 'bank_account',
                account: 'acct_1032D82eZvKYlo2C',
                account_holder_name: 'Jane Austen',
                account_holder_type: 'individual',
                bank_name: 'STRIPE TEST BANK',
                country: 'US',
                currency: 'usd',
                default_for_currency: false,
                fingerprint: '1JWtPxqbdX5Gamtc',
                last4: '6789',
                metadata: {
                },
                routing_number: '110000000',
                status: 'new',
            };

            const parsedData = BankAccount.parseStripeData(rawBankAccount);
            const expected = {
                paymentProvider: 'stripe',
                resourceOwnerId: 'acct_1032D82eZvKYlo2C',
                resourceId: 'ba_1BrrjC2eZvKYlo2Cogd6j83P',
                fingerprint: '1JWtPxqbdX5Gamtc',
                status: 'new',
                active: true,
                ownerName: 'Jane Austen',
                data: {
                    accountHolderType: 'individual',
                    bankName: 'STRIPE TEST BANK',
                    country: 'US',
                    currency: 'usd',
                    last4: '6789',
                },
            };
            expect(parsedData).to.deep.equal(expected);
        });
    });
});
