module.exports = {

    createCustomAnalyser,
    createTypeListingMapping,

};

async function createCustomAnalyser({ client, index }) {
    await client.indices.close({ index });

    const body = {
        analysis: {
            filter: {
                french_elision: {
                    type: 'elision',
                    articles_case: true,
                    articles: [
                        'l', 'm', 't', 'qu', 'n', 's',
                        'j', 'd', 'c', 'jusqu', 'quoiqu',
                        'lorsqu', 'puisqu',
                    ],
                },
                french_stop: {
                    type: 'stop',
                    stopwords: '_french_',
                },
                custom_french_stop: {
                    type: 'stop',
                    stopwords: [
                        'a', // add it because 'à' is a stop word and with asciifolding, it's transformed into 'a'
                        'location',
                        'louer',
                        'vendre',
                        'vente',
                        'dollar',
                        'euro',
                        'renseignement',
                        'contact',
                    ],
                },
                // french_keywords: {
                //     type: 'keyword_marker',
                //     keywords: [], // use this fields if some words must be protected from stemming
                // },
                french_stemmer: {
                    type: 'stemmer',
                    language: 'light_french',
                },
                custom_asciifolder: {
                    type: 'asciifolding',
                    preserve_original: true,
                }
            },
            analyzer: {
                custom_french: {
                    tokenizer: 'standard',
                    filter: [
                        'french_elision',
                        'lowercase',
                        'french_stop',
                        'custom_french_stop',
                        'custom_asciifolder',
                        // 'french_keywords',
                        'french_stemmer',
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
                        analyzer: 'custom_french',
                        fields: {
                            keyword: {
                                type: 'keyword',
                                ignore_above: 256,
                            },
                        },
                    },
                    description: {
                        type: 'text',
                        analyzer: 'custom_french',
                        fields: {
                            keyword: {
                                type: 'keyword',
                                ignore_above: 256,
                            },
                        },
                    },
                    listingCategoryLabel: {
                        type: 'text',
                        analyzer: 'custom_french',
                        fields: {
                            keyword: {
                                type: 'keyword',
                                ignore_above: 256,
                            },
                        },
                    },
                    tags: {
                        type: 'text',
                        analyzer: 'custom_french',
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
