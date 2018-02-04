module.exports = {

    isValidCurrency,
    getISOAmount,

};

const isoCurrencies = require('mobitel-iso-4217-currencies');

function isValidCurrency(currency) {
    return isoCurrencies.validate(currency);
}

function getISOAmount(amount, currency) {
    const obj = isoCurrencies.get(currency);
    if (!obj) {
        throw new Error('Invalid currency');
    }

    return Math.floor(amount * Math.pow(10, obj.minor));
}
