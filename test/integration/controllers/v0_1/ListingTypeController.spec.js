const { expect } = require('chai');
const request = require('supertest');

const database = require('../../../database');
const { apiKeys } = require('../../../fixtures/apiKeys');
const { listingTypes } = require('../../../fixtures/listingTypes');

const apiKey = apiKeys[0].key;

async function setDatabase() {
    await database.clean();

    const dataSpec = {
        apikey: apiKeys,
        listingtype: listingTypes,
    };
    await database.create(dataSpec);
}

describe('v0.1 | ListingTypeController', () => {
    beforeEach(async () => {
        await setDatabase();
    });

    describe('.find()', () => {
        it('returns active listing types', async () => {
            const res = await request(sails.hooks.http.app)
                .get('/api/v0.1/listing-types')
                .query({ active: 1 })
                .set('x-api-key', apiKey)
                .expect(200);

            const listingTypes = res.body;
            expect(listingTypes.length).to.equal(2);
        });

        it('returns all listing types', async () => {
            const res = await request(sails.hooks.http.app)
                .get('/api/v0.1/listing-types')
                .set('x-api-key', apiKey)
                .expect(200);

            const listingTypes = res.body;
            expect(listingTypes.length).to.equal(3);
        });
    });

    describe('.findOne()', () => {
        it('returns the selected listing type', async () => {
            const res = await request(sails.hooks.http.app)
                .get('/api/v0.1/listing-types/1')
                .set('x-api-key', apiKey)
                .expect(200);

            const listingType = res.body;
            expect(typeof listingType).to.equal('object');
            expect(listingType.id).to.equal(1);
        });
    });

    describe('.create()', () => {
        it('creates a listing type', async () => {
            const res = await request(sails.hooks.http.app)
                .post('/api/v0.1/listing-types')
                .send({ name: 'new listing type' })
                .set('x-api-key', apiKey)
                .expect(200);

            const listingType = res.body;
            expect(typeof listingType).to.equal('object');
            expect(listingType.name).to.equal('new listing type');
        });
    });

    describe('.update()', () => {
        it('updates the listing type', async () => {
            const res = await request(sails.hooks.http.app)
                .put('/api/v0.1/listing-types/1')
                .send({ name: 'new name' })
                .set('x-api-key', apiKey)
                .expect(200);

            const listingType = res.body;
            expect(typeof listingType).to.equal('object');
            expect(listingType.id).to.equal(1);
            expect(listingType.name).to.equal('new name');
        });
    });

    describe('.destroy()', () => {
        it('removes the listing type', async () => {
            await request(sails.hooks.http.app)
                .get('/api/v0.1/listing-types/1')
                .set('x-api-key', apiKey)
                .expect(200);

            await request(sails.hooks.http.app)
                .delete('/api/v0.1/listing-types/1')
                .set('x-api-key', apiKey)
                .expect(200);

            await request(sails.hooks.http.app)
                .get('/api/v0.1/listing-types/1')
                .set('x-api-key', apiKey)
                .expect(404);
        });
    });
});
