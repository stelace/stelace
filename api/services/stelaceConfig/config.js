const nonEditableFields = [
    'stripe_complete',
    'mangopay_complete',
    'social_login__facebook_complete',
    'social_login__google_complete',
    'is_internal_service',
];

const schema = {
    properties: {
        SERVICE_NAME: {
            type: ['string', 'null'],
        },
        logo__media_id: {
            type: ['number', 'null'],
        },
        logo__url: {
            type: ['string', 'null'],
        },
        hero_background__home__media_id: {
            type: ['number', 'null'],
        },
        hero_background__home__url: {
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
        payment_provider: {
            type: ['string', 'null'],
            enum: ['stripe', 'mangopay', null],
        },
        stripe__publish_key: {
            type: ['string', 'null'],
        },
        listings_validation_automatic: {
            type: ['boolean', 'null'],
        },
        listings_in_unique_country: {
            type: ['string', 'null'],
            country: true,
        },
        listings_in_unique_country__active: {
            type: ['boolean', 'null']
        },
        google_analytics__tracking_id: {
            type: ['string', 'null'],
        },
        google_analytics__active: {
            type: ['boolean', 'null'],
        },
        facebook_pixel__id: {
            type: ['string', 'null'],
        },
        facebook_pixel__active: {
            type: ['boolean', 'null'],
        },
        facebook_app__id: {
            type: ['string', 'null'],
        },
        google_maps__api_key: {
            type: ['string', 'null'],
        },
        map__default_lat: {
            type: ['number', 'null'],
        },
        map__default_lng: {
            type: ['number', 'null'],
        },
        map__default_search_zoom:{
            type: ['number', 'null']
        },
        stripe_complete: {
            type: ['boolean', 'null'],
        },
        mangopay_complete: {
            type: ['boolean', 'null'],
        },
        social_login__facebook_complete: {
            type: ['boolean', 'null'],
        },
        social_login__google_complete: {
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
        is_internal_service: {
            type: ['boolean', 'null'],
        },
        user_type__default: {
            type: ['string', 'null'],
            enum: ['individual', 'organization', null],
        },
        listing_categories__required: {
            type: ['boolean', 'null'],
        },
        phone_prompt__owner_level: {
            type: ['string', 'null'],
            enum: ['show', 'require', null],
        },
        phone_prompt__taker_level: {
            type: ['string', 'null'],
            enum: ['show', 'require', null],
        },
        is_service_live: {
            type: ['boolean', 'null'],
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
