const schema = {
    properties: {
        stripe__secret_key: {
            type: ['string', 'null'],
        },
        mangopay__client_id: {
            type: ['string', 'null'],
        },
        mangopay__passphrase: {
            type: ['string', 'null'],
        },
        social_login__facebook__client_id: {
            type: ['string', 'null'],
        },
        social_login__facebook__client_secret: {
            type: ['string', 'null'],
        },
        social_login__google__client_id: {
            type: ['string', 'null'],
        },
        social_login__google__client_secret: {
            type: ['string', 'null'],
        },
    },
};

module.exports = (ajv) => {
    return {
        validate: ajv.compile(schema),
    };
};
