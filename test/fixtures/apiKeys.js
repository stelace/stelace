const { escapeFixture } = require('../database');

const now = new Date().toISOString();

const apiKeys = [
    {
        id: 1,
        createdDate: escapeFixture(now),
        updatedDate: escapeFixture(now),
        key: 'apikey1',
    },
];

module.exports = {
    apiKeys,
};
