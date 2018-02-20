const schema = {
    properties: {
        stripe_secretKey: {
            type: ['string', 'null'],
        },
        mangopay_clientId: {
            type: ['string', 'null'],
        },
        mangopay_passphrase: {
            type: ['string', 'null'],
        },
        socialLogin_facebook_clientId: {
            type: ['string', 'null'],
        },
        socialLogin_facebook_clientSecret: {
            type: ['string', 'null'],
        },
        socialLogin_google_clientId: {
            type: ['string', 'null'],
        },
        socialLogin_google_clientSecret: {
            type: ['string', 'null'],
        },
    },
};

module.exports = (ajv) => {
    return {
        validate: ajv.compile(schema),
    };
};
