/* global CountryService, CurrencyService */

const Ajv = require('ajv');

const ajv = new Ajv();

ajv.addKeyword('currency', {
    validate: (schema, data) => {
        if (!schema) return true;
        if (data === null) return true;

        return CurrencyService.isValidCurrency(data);
    },
    errors: false,
});

ajv.addKeyword('country', {
    validate: (schema, data) => {
        if (!schema) return true;
        if (data === null) return true;

        return CountryService.isCountry(data);
    },
    errors: false,
});

module.exports = {

    config: require('./config')(ajv),
    secretData: require('./secretData')(ajv),

};
