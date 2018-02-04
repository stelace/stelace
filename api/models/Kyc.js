/* global CountryService, TimeService */

/**
 * Kyc.js
 *
 * @description :: A model definition.  Represents a database table/collection/etc.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
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
        userId: {
            type: 'number',
            columnType: 'int',
            required: true,
        },
        data: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
    },

    getAccessFields,
    validateData,
    getMergedData,

};

const _ = require('lodash');

function getAccessFields(access) {
    var accessFields = {
        api: [
            'id',
            'createdDate',
            'updatedDate',
            'userId',
            'data',
        ],
        self: [
            'id',
            'createdDate',
            'updatedDate',
            'userId',
            'data',
        ],
    };

    return accessFields[access];
}

function validateData(data) {
    const valid = _.reduce(data, (memo, value, key) => {
        if (!memo) return memo;

        if (value === null) {
            return true;
        }

        switch (key) {
            case 'birthday':
                memo = TimeService.isDateString(value, { onlyDate: true });
                break;

            case 'nationality':
                memo = CountryService.isCountry(value);
                break;

            case 'countryOfResidence':
                memo = CountryService.isCountry(value);
                break;

            case 'legalPersonType':
                memo = _.includes(['BUSINESS', 'ORGANIZATION', 'SOLETRADER'], value);
                break;

            case 'legalRepresentativeBirthday':
                memo = TimeService.isDateString(value, { onlyDate: true });
                break;

            case 'legalRepresentativeCountryOfResidence':
                memo = CountryService.isCountry(value);
                break;

            case 'legalRepresentativeNationality':
                memo = CountryService.isCountry(value);
                break;

            case 'legalRepresentativeFirstname':
                memo = typeof value === 'string';
                break;

            case 'legalRepresentativeLastname':
                memo = typeof value === 'string';
                break;

            default:
                break;
        }

        return memo;
    }, true);

    return valid;
}

function getMergedData(kyc, newData) {
    return _.merge({}, newData, kyc.data || {});
}
