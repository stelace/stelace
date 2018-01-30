const { expect } = require('chai');
const request = require('supertest');

const database = require('../../database');

async function setDatabase() {
    await database.clean();
}

describe('StelaceConfigController', () => {
    beforeEach(async () => {
        await setDatabase();
    });

    describe('.installStatus()', () => {
        it('returns the install status', async () => {
            const res = await request(sails.hooks.http.app)
                .get('/api/stelace/config/install/status')
                .expect(200);

            expect(res.body.installed).to.be.false;
        });
    });

    describe('.install()', () => {
        it('install the config', async () => {
            await request(sails.hooks.http.app)
                .post('/api/stelace/config/install')
                .send({
                    serviceName: 'Stelace',
                    lang: 'en',
                    email: 'test@admin.com',
                    password: 'adminpassword',
                })
                .expect(200);
        });
    });
});
