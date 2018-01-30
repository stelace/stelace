const { escapeFixture } = require('../database');

const now = new Date().toISOString();

const users = [
    {
        id: 1,
        createdDate: escapeFixture(now),
        updatedDate: escapeFixture(now),
        email: 'admin@test.com',
        role: 'admin',
        emailCheck: false,
        phoneCheck: false,
        ratingScore: 0,
        nbRatings: 0,
        registrationCompleted: false,
        firstUse: true,
        blocked: false,
        destroyed: false,
        newsletter: true,
    },
];

module.exports = {
    users,
};
