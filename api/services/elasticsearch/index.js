const customElasticsearch = {
    en: require('./elasticsearch-en'),
    fr: require('./elasticsearch-fr'),
};

module.exports = {

    initializeIndex,

};

const _ = require('lodash');

const langs = [
    'en',
    'fr',
];

async function initializeIndex({ client, index, lang, dropIfExists = false }) {
    if (!_.includes(langs, lang)) {
        throw new Error('Invalid lang');
    }

    const exists = await client.indices.exists({ index });

    if (exists) {
        if (dropIfExists) {
            await client.indices.delete({ index });
            await client.indices.create({ index });
        }
    } else {
        await client.indices.create({ index });
    }

    const esLang = customElasticsearch[lang];

    await esLang.createCustomAnalyser({ client, index });
    await esLang.createTypeListingMapping({ client, index });
}
