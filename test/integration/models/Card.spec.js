/* global Card */

const { expect } = require('chai');

describe('Card', () => {
    describe('.parseMangopayExpirationDate()', () => {
        it('returns the expiration month and year', () => {
            const { expirationMonth, expirationYear } = Card.parseMangopayExpirationDate('0718');
            expect(expirationMonth).to.equal(7);
            expect(expirationYear).to.equal(2018);
        });
    });

    describe('.parseMangopayData()', () => {
        it('parses the mangopay raw object', () => {
            const rawCard = {
                Id: '8494514',
                UserId: '8494514',
                CreationDate: 12926321,
                Tag: 'custom meta',
                ExpirationDate: '1019',
                Alias: '497010XXXXXX4414',
                CardProvider: 'Mangopay Ltd',
                CardType: 'CB_VISA_MASTERCARD',
                Country: 'FR',
                Product: 'G',
                BankCode: '00152',
                Active: true,
                Currency: 'EUR',
                Validity: 'VALID',
                Fingerprint: '50a6a8da09654c4cab901814a741f924',
            };

            const parsedData = Card.parseMangopayData(rawCard);
            const expected = {
                paymentProvider: 'mangopay',
                resourceOwnerId: '8494514',
                resourceId: '8494514',
                expirationMonth: 10,
                expirationYear: 2019,
                currency: 'EUR',
                provider: 'Mangopay Ltd',
                type: 'CB_VISA_MASTERCARD',
                alias: '497010XXXXXX4414',
                active: true,
                validity: 'VALID',
                fingerprint: '50a6a8da09654c4cab901814a741f924',
                country: 'FR',
                data: {
                    product: 'G',
                    bankCode: '00152',
                },
            };
            expect(parsedData).to.deep.equal(expected);
        });
    });
});
