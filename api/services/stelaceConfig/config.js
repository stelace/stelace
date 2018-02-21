const nonEditableFields = [
    'stripe_complete',
    'mangopay_complete',
    'socialLogin_facebook_complete',
    'socialLogin_google_complete',
];

const schema = {
    properties: {
        SERVICE_NAME: {
            type: ['string', 'null'],
        },
        logoMediaId: {
            type: ['number', 'null'],
        },
        logoUrl: {
            type: ['string', 'null'],
        },
        homeHeroBgMediaId: {
            type: ['number', 'null'],
        },
        homeHeroBgUrl: {
            type: ['string', 'null'],
        },
        lang: {
            type: ['string', 'null'],
            enum: ['en', 'fr'],
        },
        currency: {
            type: ['string', 'null'],
            currency: true,
        },
        paymentProvider: {
            type: ['string', 'null'],
            enum: ['stripe', 'mangopay', null],
        },
        stripe_publishKey: {
            type: ['string', 'null'],
        },
        google_analytics_trackingId: {
            type: ['string', 'null'],
        },
        google_analytics_active: {
            type: ['boolean', 'null'],
        },
        facebook_pixel_id: {
            type: ['string', 'null'],
        },
        facebook_pixel_active: {
            type: ['boolean', 'null'],
        },
        facebook_app_id: {
            type: ['string', 'null'],
        },
        google_maps_apiKey: {
            type: ['string', 'null'],
        },
        stripe_complete: {
            type: ['boolean', 'null'],
        },
        mangopay_complete: {
            type: ['boolean', 'null'],
        },
        socialLogin_facebook_complete: {
            type: ['boolean', 'null'],
        },
        socialLogin_google_complete: {
            type: ['boolean', 'null'],
        },
        twitter_url: {
            type: ['string', 'null'],
        },
        facebook_url: {
            type: ['string', 'null'],
        },
        googleplus_url: {
            type: ['string', 'null'],
        },
    },
};

function getNonEditableFields() {
    return nonEditableFields;
}

module.exports = (ajv) => {
    return {
        getNonEditableFields,
        validate: ajv.compile(schema),
    };
};
