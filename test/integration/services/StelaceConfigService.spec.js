/* global StelaceConfig, StelaceConfigService, User */

const { expect } = require('chai');
const database = require('../../database');

const { users } = require('../../fixtures/users');
const { stelaceConfigs } = require('../../fixtures/stelaceConfigs');

async function setDatabase() {
    await database.clean();
}

describe('StelaceConfigService', () => {
    beforeEach(async () => {
        await setDatabase();
    });

    describe('.isInstallationComplete()', () => {
        it('returns false for an empty database', async () => {
            const installationComplete = await StelaceConfigService.isInstallationComplete();
            expect(installationComplete).to.be.false;
        });

        it('returns true when there is a config and an admin user', async () => {
            const dataSpec = {
                user: users[0],
                stelaceconfig: stelaceConfigs,
            };
            await database.create(dataSpec);

            const installationComplete = await StelaceConfigService.isInstallationComplete();
            expect(installationComplete).to.be.true;
        });
    });

    describe('.install()', () => {
        it('creates a config and an admin user', async () => {
            await StelaceConfigService.install({
                lang: 'fr',
                serviceName: 'Stelace',
                email: 'test@admin.com',
                password: 'adminpassword',
            });

            const stelaceConfigs = await StelaceConfig.find();
            expect(stelaceConfigs.length).to.equal(1);

            const users = await User.find({ role: 'admin' });
            expect(users.length).to.equal(1);
        });
    });
});
