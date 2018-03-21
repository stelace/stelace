/* global Tag, ToolsService */

/**
* Tag.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        id: {
            type: 'number',
            columnType: 'int',
            autoIncrement: true,
        },
        createdDate: {
            type: 'string',
            columnType: 'varchar(255)',
            maxLength: 255,
        },
        updatedDate: {
            type: 'string',
            columnType: 'varchar(255)',
            maxLength: 255,
        },
        name: {
            type: 'string',
            columnType: 'varchar(191) CHARACTER SET utf8mb4',
            required: true,
            maxLength: 191,
        },
        nameURLSafe: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        listingCategoryIds: {
            type: 'json',
            columnType: 'json',
            defaultsTo: [],
        },
        validated: {
            type: 'boolean',
            columnType: 'tinyint(1)',
            defaultsTo: false,
        },
        priorityScore: {
            type: 'number',
            columnType: 'int',
            defaultsTo: 0,
        },
        timesSearched: {
            type: 'number',
            columnType: 'int',
            defaultsTo: 0,
        },
        timesSearchedSimilar: {
            type: 'number',
            columnType: 'int',
            defaultsTo: 0,
        },
        timesAdded: {
            type: 'number',
            columnType: 'int',
            defaultsTo: 0,
        },
        data: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
    },

    getAccessFields,
    beforeCreate,
    beforeUpdate,
    existTags,

};

const _ = require('lodash');

function getAccessFields(access) {
    var accessFields = {
        others: [
            "id",
            "name",
            "nameURLSafe",
            "listingCategoryIds",
            "validated",
            "priorityScore",
            "timesSearched",
            "timesSearchedSimilar",
            "timesAdded"
        ]
    };

    return accessFields[access];
}

function beforeCreate(values, next) {
    Tag.beforeCreateDates(values);
    beforeChange(values);

    next();
}

function beforeUpdate(values, next) {
    Tag.beforeUpdateDates(values);
    beforeChange(values);

    next();
}

function beforeChange(values) {
    if (values.name) {
        values.nameURLSafe = ToolsService.getURLStringSafe(values.name);
    }
}

async function existTags(tagsIds) {
    if (!tagsIds || !tagsIds.length) {
        return true;
    }

    const tags = await Tag.find({ id: _.uniq(tagsIds) });
    return tags.length === tagsIds.length;
}
