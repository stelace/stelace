const { escapeFixture } = require('../database');

const now = new Date().toISOString();

const stelaceConfigs = [
    {
        id: 1,
        createdDate: escapeFixture(now),
        updatedDate: escapeFixture(now),
        config: escapeFixture({
            SERVICE_NAME: 'Stelace',
            lang: 'en',
        }),
        features: escapeFixture({
            GAMIFICATION: true,
            TAGS: true,
            EVENTS: true,
            SOCIAL_LOGIN: true,
            INCOME_REPORT: true,
            SMS: true,
            MAP: true,
        }),
    },
];

module.exports = {
    stelaceConfigs,
};
