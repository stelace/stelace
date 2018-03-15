const schema = {
    properties: {
        name: {
            type: 'string',
        },
        enabledBasicRoles: {
            type: 'array',
            items: {
                type: 'string',
            },
        },
        maxNbListingTypes: {
            type: ['number', 'null'],
        },
        maxNbCustomAttributes: {
            type: ['number', 'null'],
        },
        maxNbLanguages: {
            type: ['number', 'null'],
        },
        maxNbStaffAccounts: {
            type: ['number', 'null'],
        },
        maxNbWebhooks: {
            type: ['number', 'null'],
        },
        permissions: {
            type: ['array'],
            items: [
                {
                    type: 'object',
                    required: ['resource', 'actions'],
                    properties: {
                        resource: {
                            type: 'string',
                        },
                        actions: {
                            type: ['array', 'boolean'],
                            items: {
                                type: 'string',
                            },
                        },
                    },
                },
            ],
        },
    },
};

module.exports = (ajv) => {
    return {
        validate: ajv.compile(schema),
    };
};
