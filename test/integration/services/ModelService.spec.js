/* global ModelService */

const { expect } = require('chai');

describe('ModelService', () => {
    describe('.getI18nValue()', () => {
        it('gets the i18n value', () => {
            const listing = {
                namesI18n: {
                  en: 'Chair',
                  fr: 'Chaise'
                },
            };
            const field = 'name';
            const fieldI18n = 'namesI18n';
            const fallbackLocale = 'en';

            expect(ModelService.getI18nValue(listing, { field, fieldI18n, fallbackLocale, locale: 'en' })).to.equal('Chair');
            expect(ModelService.getI18nValue(listing, { field, fieldI18n, fallbackLocale, locale: 'fr' })).to.equal('Chaise');
        });

        it('falls back on the fallback locale', () => {
            const listing = {
                namesI18n: {
                  en: 'Chair',
                  fr: 'Chaise'
                },
            };
            const field = 'name';
            const fieldI18n = 'namesI18n';
            const fallbackLocale = 'en';

            expect(ModelService.getI18nValue(listing, { field, fieldI18n, fallbackLocale, locale: 'de' })).to.equal('Chair');
        });
    });

    describe('.setI18nValue()', () => {
        it('sets the i18n value', () => {
            const listing = {
                namesI18n: {
                  en: 'Chair',
                  fr: 'Chaise'
                },
            };
            const field = 'name';
            const fieldI18n = 'namesI18n';
            const fallbackLocale = 'en';

            const listing1 = Object.assign({}, listing);
            ModelService.setI18nValue(listing1, 'Small chair', { field, fieldI18n, fallbackLocale, locale: 'en' });
            expect(listing1.name).to.equal('Small chair');
            expect(listing1.namesI18n.en).to.equal('Small chair');

            const listing2 = Object.assign({}, listing);
            ModelService.setI18nValue(listing2, 'Petite chaise', { field, fieldI18n, fallbackLocale, locale: 'fr' });
            expect(listing2.namesI18n.fr).to.equal('Petite chaise');
        });

        it('sets the field if fallback locale does not exist', () => {
            const listing = {
                namesI18n: {
                },
            };
            const field = 'name';
            const fieldI18n = 'namesI18n';
            const fallbackLocale = 'en';

            ModelService.setI18nValue(listing, 'Small chair', { field, fieldI18n, fallbackLocale, locale: 'fr' });
            expect(listing.name).to.equal('Small chair');
            expect(listing.namesI18n.fr).to.equal('Small chair');
        });
    });

    describe('.getI18nModel()', () => {
        it('gets the i18n model', () => {
            const listing = {
                name: 'Chaise',
                namesI18n: {
                  en: 'Chair',
                  fr: 'Chaise'
                },
                description: null,
                descriptionsI18n: {
                  en: 'A small chair',
                  fr: 'Une petite chaise',
                },
                ownerId: 1,
                createdDate: '2018-01-01T00:00:00.000Z',
            };
            const fallbackLocale = 'en';
            const i18nMap = {
                name: 'namesI18n',
                description: 'descriptionsI18n',
            };

            expect(ModelService.getI18nModel(listing, { i18nMap, fallbackLocale, locale: 'en' })).to.deep.equal({
                name: 'Chair',
                namesI18n: {
                  en: 'Chair',
                  fr: 'Chaise'
                },
                description: 'A small chair',
                descriptionsI18n: {
                  en: 'A small chair',
                  fr: 'Une petite chaise'
                },
                ownerId: 1,
                createdDate: '2018-01-01T00:00:00.000Z',
            });
            expect(ModelService.getI18nModel(listing, { i18nMap, fallbackLocale, locale: 'fr' })).to.deep.equal({
                name: 'Chaise',
                namesI18n: {
                  en: 'Chair',
                  fr: 'Chaise'
                },
                description: 'Une petite chaise',
                descriptionsI18n: {
                  en: 'A small chair',
                  fr: 'Une petite chaise',
                },
                ownerId: 1,
                createdDate: '2018-01-01T00:00:00.000Z',
            });
        });

        it('falls back on the fallback locale', () => {
            const listing = {
                name: 'Chaise',
                namesI18n: {
                  en: 'Chair',
                  fr: 'Chaise'
                },
                description: null,
                descriptionsI18n: {
                  en: 'A small chair',
                  fr: 'Une petite chaise',
                },
                ownerId: 1,
                createdDate: '2018-01-01T00:00:00.000Z',
            };
            const fallbackLocale = 'en';
            const i18nMap = {
                name: 'namesI18n',
                description: 'descriptionsI18n',
            };

            expect(ModelService.getI18nModel(listing, { i18nMap, fallbackLocale, locale: 'de' })).to.deep.equal({
                name: 'Chair',
                namesI18n: {
                  en: 'Chair',
                  fr: 'Chaise'
                },
                description: 'A small chair',
                descriptionsI18n: {
                  en: 'A small chair',
                  fr: 'Une petite chaise',
                },
                ownerId: 1,
                createdDate: '2018-01-01T00:00:00.000Z',
            });
        });
    });

    describe('.getI18nModelDelta()', () => {
        it('gets the i18n model delta for database insert or update', () => {
            const listing = {
                name: 'Chaise',
                namesI18n: {
                  en: 'Chair',
                  fr: 'Chaise'
                },
                description: null,
                descriptionsI18n: {
                  en: 'A small chair',
                  fr: 'Une petite chaise',
                },
                ownerId: 1,
                createdDate: '2018-01-01T00:00:00.000Z',
            };
            const fallbackLocale = 'en';
            const i18nMap = {
                name: 'namesI18n',
                description: 'descriptionsI18n',
            };

            const delta = ModelService.getI18nModelDelta(listing, {
                name: 'A table',
                description: 'A beautiful table',
            }, { i18nMap, fallbackLocale, locale: 'en' });

            expect(delta).to.not.equal(listing);
            expect(delta).to.deep.equal({
                name: 'A table',
                namesI18n: {
                  en: 'A table',
                  fr: 'Chaise'
                },
                description: 'A beautiful table',
                descriptionsI18n: {
                  en: 'A beautiful table',
                  fr: 'Une petite chaise'
                },
            });
        });
    });

    describe('.setI18nModel()', () => {
        it('sets the i18n model', () => {
            const listing = {
                name: 'Chaise',
                namesI18n: {
                  en: 'Chair',
                  fr: 'Chaise'
                },
                description: null,
                descriptionsI18n: {
                  en: 'A small chair',
                  fr: 'Une petite chaise',
                },
                ownerId: 1,
                createdDate: '2018-01-01T00:00:00.000Z',
            };
            const fallbackLocale = 'en';
            const i18nMap = {
                name: 'namesI18n',
                description: 'descriptionsI18n',
            };

            const modifiedListing = ModelService.setI18nModel(listing, {
                name: 'A table',
                description: 'A beautiful table',
            }, { i18nMap, fallbackLocale, locale: 'en' });

            expect(modifiedListing).to.equal(listing);
            expect(modifiedListing).to.deep.equal({
                name: 'A table',
                namesI18n: {
                  en: 'A table',
                  fr: 'Chaise'
                },
                description: 'A beautiful table',
                descriptionsI18n: {
                  en: 'A beautiful table',
                  fr: 'Une petite chaise'
                },
                ownerId: 1,
                createdDate: '2018-01-01T00:00:00.000Z',
            });
        });
    });
});

