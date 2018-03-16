module.exports = {

    createCustomAnalyser,
    createTypeListingMapping,

};

async function createCustomAnalyser({ client, index }) {
    await client.indices.close({ index });

    const body = {
        analysis: {
            filter: {
                english_stop: {
                    type: 'stop',
                    stopwords: '_english_',
                },
                custom_english_stop: {
                    type: 'stop',
                    stopwords: [
                        'renting',
                        'rent',
                        'sell',
                        'selling',
                        'dollar',
                        'euro',
                        'information',
                        'contact',
                    ],
                },
                // english_keywords: {
                //     type: 'keyword_marker',
                //     keywords: [] // use this fields if some words must be protected from stemming
                // },
                english_stemmer: {
                    type: 'stemmer',
                    language: 'english',
                },
                english_possessive_stemmer: {
                    type: 'stemmer',
                    language: 'possessive_english',
                },
            },
            analyzer: {
                custom_english: {
                    tokenizer: 'standard',
                    filter: [
                        'english_possessive_stemmer',
                        'lowercase',
                        'english_stop',
                        'custom_english_stop',
                        // 'english_keywords',
                        'english_stemmer',
                    ],
                },
            },
        },
    };

    await client.indices.putSettings({ index, body });
    await client.indices.open({ index });
}

async function createTypeListingMapping({ client, index }) {
    await client.indices.putMapping({
        index,
        type: 'listing',
        body: {
            listing: {
                properties: {
                    name: {
                        type: 'text',
                        analyzer: 'custom_english',
                        fields: {
                            keyword: {
                                type: 'keyword',
                                ignore_above: 256,
                            },
                        },
                    },
                    description: {
                        type: 'text',
                        analyzer: 'custom_english',
                        fields: {
                            keyword: {
                                type: 'keyword',
                                ignore_above: 256,
                            },
                        },
                    },
                    listingCategoryLabel: {
                        type: 'text',
                        analyzer: 'custom_english',
                        fields: {
                            keyword: {
                                type: 'keyword',
                                ignore_above: 256,
                            },
                        },
                    },
                    tags: {
                        type: 'text',
                        analyzer: 'custom_english',
                        fields: {
                            keyword: {
                                type: 'keyword',
                                ignore_above: 256,
                            },
                        },
                    },
                },
            },
        },
    });
}
