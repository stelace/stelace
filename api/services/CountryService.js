module.exports = {

    isCountry,

};

const Country = require('countryjs');

function isCountry(country) {
    if (typeof country !== 'string') return false;
    return !!Country.info(country.toUpperCase(), 'ISO2');
}
