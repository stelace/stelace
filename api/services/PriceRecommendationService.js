module.exports = {

    getRecommendedPrices: getRecommendedPrices,
    getTimeUnitPriceFromSellingPrice: getTimeUnitPriceFromSellingPrice

};

const request = require('request');
const _ = require('lodash');
const Promise = require('bluebird');

Promise.promisifyAll(request, { multiArgs: true });

const config = {
    higherValueThreshold: 100,
    // set range width on selling price rather than renting price
    sellingPriceMultiplicator: 0.9,
    lowSellingPriceMultiplicator: 0.7,
    highSellingPriceMultiplicator: 1.1,
};

async function getRecommendedPrices(query) {
    const apiUrl = sails.config.priceRecommendationUrl;

    if (!apiUrl) {
        throw new Error('No price recommendation api url provided');
    }
    if (!query) {
        throw new Error("Expected query");
    }

    const url = apiUrl + '?query=' + encodeURIComponent(query);
    const estimatedValue = await doRequest({ url });

    let recommendedPrices = await getTimeUnitPriceFromSellingPrice(estimatedValue);

    recommendedPrices.price = Math.round(estimatedValue);

    if (sails.config.environment === "development") {
        console.info("recommendedPrices", recommendedPrices);
    }

    return Promise.resolve(recommendedPrices);
}

function getTimeUnitPriceFromSellingPrice(value) {
    if (! _.isFinite(value)) {
        throw new Error("Expecting a number to get renting price recommendation.");
    }

    return Promise.resolve({
        timeUnitPrice: getTimeUnitPriceFromValue(value, config.sellingPriceMultiplicator),
        lowTimeUnitPrice: getTimeUnitPriceFromValue(value, config.lowSellingPriceMultiplicator),
        highTimeUnitPrice: getTimeUnitPriceFromValue(value, config.highSellingPriceMultiplicator)
    });
}

/**
 * Use selling price or other reference to derive timeUnitPrice
 * @param  {object} value - usually sellingPrice
 * @param  {object} multiplicator
 * @return {object} timeUnitPrice
 */
function getTimeUnitPriceFromValue(value, multiplicator) {
    const absolute = Math.sqrt(value * multiplicator)
        - 4 // shift downwards for low value listings
        // Balancing sqrt for high-value listings (1 % of value > higherValueThreshold)
        + (Math.max(value, config.higherValueThreshold) - config.higherValueThreshold) / config.higherValueThreshold;

    return Math.round(Math.max(absolute, 1));
}

/**
 * do request
 * @param  {object} args
 * @return {string} args.url
 * @return {object} args.headers
 */
function doRequest(args) {
    return request.getAsync({
        url: args.url,
        headers: args.headers
    })
    .spread((response, body) => {
        if (response.statusCode !== 200) {
            throw body;
        }

        return body;
    });
}
