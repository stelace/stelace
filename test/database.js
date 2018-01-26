const sqlFixtures = require('sql-fixtures');
const Promise = require('bluebird');

let fixtureCreator;
let _sails;

function init({ sails }) {
    _sails = sails;

    const dbConfig = sails.config.datastores.MySQLServer;

    fixtureCreator = new sqlFixtures({
        client: 'mysql',
        connection: {
            host: dbConfig.host,
            user: dbConfig.user,
            password: dbConfig.password,
            database: dbConfig.database,
            port: dbConfig.port,
        },
    });
}

function create(...args) {
    return fixtureCreator.create(...args);
}

async function clean() {
    const modelNames = Object.keys(_sails.models);

    await Promise.map(modelNames, async (name) => {
        const model = _sails.models[name];
        await model.destroy({});
    });
}

function escapeString(str) {
    return str.replace(/:/g, '::');
}

/**
 * @param {Object|String} value
 * @return {Object|String}
 */
function escapeFixture(value) {
    if (typeof value === 'string') {
        return escapeString(value);
    } else if (typeof value === 'object') {
        return escapeString(JSON.stringify(value));
    }
}

module.exports = {
    init,
    create,
    clean,

    escapeFixture,
};
