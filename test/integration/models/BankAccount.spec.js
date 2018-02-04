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
});
