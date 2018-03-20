/* global ListingTypeService */

const { expect } = require('chai');
const database = require('../../database');

const { listingTypes } = require('../../fixtures/listingTypes');

async function setDatabase() {
    await database.clean();

    const dataSpec = {
        listingtype: listingTypes,
    };
    await database.create(dataSpec);
}

describe('ListingTypeService', () => {
    beforeEach(async () => {
        await setDatabase();
    });

    describe('.getAllListingTypes()', () => {
        it('fetches all listing types', async () => {
            const listingTypes = await ListingTypeService.getAllListingTypes();
            expect(listingTypes.length).to.equal(3);
        });
    });

    describe('.getListingTypes()', () => {
        it('fetches only active listing types', async () => {
            const listingTypes = await ListingTypeService.getListingTypes();
            expect(listingTypes.length).to.equal(2);
        });
    });

    describe('.getListingType()', () => {
        it('fetches the specified listing type', async () => {
            const listingType = await ListingTypeService.getListingType(1);
            expect(typeof listingType).to.equal('object');
        });
    });

    describe('.isValidListingTypesIds()', () => {
        it('checks if the ids are existing ones', async () => {
            const valid = await ListingTypeService.isValidListingTypesIds([1,2]);
            expect(valid).to.be.equal(true);
        });

        it('has active filter', async () => {
            const valid1 = await ListingTypeService.isValidListingTypesIds([1,3], { onlyActive: false });
            expect(valid1).to.be.equal(true);

            const valid2 = await ListingTypeService.isValidListingTypesIds([1,3], { onlyActive: true });
            expect(valid2).to.be.equal(false);
        });
    });

    describe('.createListingType()', () => {
        it('creates a listing type', async () => {
            const creatingListingType = {
                name: 'test',
                properties: {
                    TIME: 'TIME_FLEXIBLE',
                },
            };

            const createdListingType = await ListingTypeService.createListingType(creatingListingType);
            expect(createdListingType.name).to.equal(creatingListingType.name);
            expect(typeof createdListingType.properties).to.equal('object');
            expect(createdListingType.properties.TIME).to.equal('TIME_FLEXIBLE');
            expect(typeof createdListingType.config).to.equal('object', 'it creates a default config');
            expect(Array.isArray(createdListingType.customAttributes)).to.equal(true);
            expect(createdListingType.customAttributes.length).to.equal(0);
        });

        it('rejects if the parameters are incorrect', async () => {
            let hasError;

            try {
                await ListingTypeService.createListingType({ name: null });
            } catch (err) {
                hasError = true;
            }

            expect(hasError).to.equal(true, 'error expected');
        });
    });

    describe('.updateListingType()', () => {
        it('updates a listing type', async () => {
            const updatingListingType = {
                name: 'test2',
                properties: {
                    TIME: 'NONE'
                },
                customAttributes: [
                    { name: 'height', label: 'Height', type: 'number', filter: false, visibility: 'all' },
                ],
            };

            const updatedListingType = await ListingTypeService.updateListingType(1, updatingListingType);
            expect(updatedListingType.name).to.equal(updatingListingType.name);
            expect(typeof updatedListingType.properties).to.equal('object');
            expect(updatedListingType.properties.TIME).to.equal('NONE');
            expect(typeof updatedListingType.config).to.equal('object');
            expect(Array.isArray(updatedListingType.customAttributes)).to.equal(true);
            expect(updatedListingType.customAttributes.length).to.equal(1);
        });

        it('rejects if the parameters are incorrect', async () => {
            let hasError;

            try {
                await ListingTypeService.updateListingType(1, { name: null });
            } catch (err) {
                hasError = true;
            }

            expect(hasError).to.equal(true, 'error expected');
        });
    });

    describe('.destroyListingType()', () => {
        it('removes a listing type', async () => {
            const listingType1 = await ListingTypeService.getListingType(1);
            await ListingTypeService.destroyListingType(1);
            const listingType2 = await ListingTypeService.getListingType(1);

            expect(listingType1).to.be.ok;
            expect(listingType2).to.not.be.ok;
        });
    });
});
