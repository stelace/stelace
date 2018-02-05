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

    describe('.parseStripeData()', () => {
        it('parses the stripe raw object', () => {
            const rawCard = {
                id: 'card_1Brrj72eZvKYlo2CzrX6Na85',
                object: 'card',
                address_city: null,
                address_country: null,
                address_line1: null,
                address_line1_check: null,
                address_line2: null,
                address_state: null,
                address_zip: null,
                address_zip_check: null,
                brand: 'Visa',
                country: 'US',
                customer: 'cus_CGMd3eZanFamae',
                cvc_check: null,
                dynamic_last4: null,
                exp_month: 8,
                exp_year: 2019,
                fingerprint: 'Xt5EWLLDS7FJjR1c',
                funding: 'credit',
                last4: '4242',
                metadata: {
                },
                name: null,
                tokenization_method: null
            };

            const parsedData = Card.parseStripeData(rawCard);
            const expected = {
                paymentProvider: 'stripe',
                resourceOwnerId: 'cus_CGMd3eZanFamae',
                resourceId: 'card_1Brrj72eZvKYlo2CzrX6Na85',
                expirationMonth: 8,
                expirationYear: 2019,
                currency: null,
                provider: null,
                type: 'Visa',
                alias: '4242',
                active: true,
                validity: null,
                fingerprint: 'Xt5EWLLDS7FJjR1c',
                country: 'US',
                data: {
                    ownerName: null,
                    funding: 'credit',
                    address_city: null,
                    address_country: null,
                    address_line1: null,
                    address_line1_check: null,
                    address_line2: null,
                    address_state: null,
                    address_zip: null,
                    address_zip_check: null,
                },
            };
            expect(parsedData).to.deep.equal(expected);
        });
    });
});
