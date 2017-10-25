/* global
    AppUrlService, Assessment, Booking, EmailUtmService, PricingService, ToolsService,
    UrlService, User
*/

module.exports = {

    minifyHtml: minifyHtml,
    getEmptyHtml: getEmptyHtml,
    setAuthToken: setAuthToken,
    setUtmTags: setUtmTags,
    getFirstname: getFirstname,
    getUserName: getUserName,
    getItemMediaUrl: getItemMediaUrl,
    getItemDescription: getItemDescription,
    shrinkString: shrinkString,
    formatDate: formatDate,
    getAssessmentLevel: getAssessmentLevel,
    getGamificationLevel: getGamificationLevel,
    getHumanReadDuration: getHumanReadDuration,
    getAppUrl: getAppUrl,
    getUrl: getUrl,
    getPriceAfterRebateAndFees: getPriceAfterRebateAndFees,
    getBookingValue: getBookingValue,
    getLocationName: getLocationName,
    getContactDetails: getContactDetails,
    isMissingIban: isMissingIban,
    getNearestLocations: getNearestLocations,
    getMailTo: getMailTo,
    isNoTime: isNoTime

};

var moment = require('moment');

var noSpaceChars = {
    after: [
        "("
    ],
    before: [
        ",",
        ".",
        ")"
    ]
};
var urlFieldSuffixes = [
    "url",
    "href",
    "link"
];
var indexedNoSpaceChars;

function minifyHtml(str) {
    if (typeof str !== "string") {
        return str;
    }

    return _.reduce(str.split("\n"), (memo, line) => {
        var trimmed = line.trim();

        if (! trimmed) {
            return memo;
        }
        if (! memo) {
            return trimmed;
        }

        return memo + (addSpace(memo, trimmed) ? " " : "") + trimmed;
    }, "");
}

function addSpace(str1, str2) {
    if (! indexedNoSpaceChars) {
        indexedNoSpaceChars = {};

        indexedNoSpaceChars.after = _.reduce(noSpaceChars.after, (memo, c) => {
            memo[c] = true;
            return memo;
        }, {});

        indexedNoSpaceChars.before = _.reduce(noSpaceChars.before, (memo, c) => {
            memo[c] = true;
            return memo;
        }, {});
    }

    return ! indexedNoSpaceChars.after[_.last(str1)]
        && ! indexedNoSpaceChars.before[_.first(str2)];
}

function getEmptyHtml() {
    return `<span style="width:0;height:0;"></span>`;
}

function setAuthToken(authToken, data) {
    return _.reduce(data, (memo, value, field) => {
        if (UrlService.isUrl(value)
         && UrlService.isStelaceAppUrl(value)
         && isUrlField(field)
        ) {
            memo[field] = UrlService.addQueryParams(value, { aut: authToken });
        } else {
            memo[field] = value;
        }
        return memo;
    }, {});
}

function setUtmTags(templateName, data) {
    return _.reduce(data, (memo, value, field) => {
        if (UrlService.isUrl(value)
         && UrlService.isStelaceAppUrl(value)
         && isUrlField(field)
        ) {
            var utmTags = EmailUtmService.getUtmTags(templateName, field);
            memo[field] = UrlService.setUtmTags(value, utmTags);
        } else {
            memo[field] = value;
        }
        return memo;
    }, {});
}

function isUrlField(field) {
    var lowerField = field.toLowerCase();

    return _.reduce(urlFieldSuffixes, (memo, value) => {
        if (_.endsWith(lowerField, value)) {
            memo = memo || true;
        }
        return memo;
    }, false);
}

function getFirstname(args) {
    return args.firstname || (args.user && args.user.firstname);
}

function getUserName() {
    return User.getName.apply(null, arguments);
}

function getItemMediaUrl(medias, noDefault) {
    if (! medias || ! medias.length) {
        if (noDefault) {
            return;
        }

        return AppUrlService.getUrl("defaultItemImage");
    }

    return AppUrlService.getUrl("media", [medias[0], { size: "450x300" }]);
}

function getItemDescription(item) {
    return item.description ? ToolsService.shrinkString(item.description, 200) : null;
}

function shrinkString() {
    return ToolsService.shrinkString.apply(null, arguments);
}

function formatDate(date, type) {
    type = type || "short";

    var types = {
        short: "DD/MM/YYYY",
        long: "dddd D MMMM YYYY"
    };

    if (! types[type]) {
        throw new Error("Bad format date type");
    }

    return moment(date).format(types[type]);
}

function getAssessmentLevel() {
    return Assessment.getAssessmentLevel.apply(null, arguments);
}

function getGamificationLevel(levelId) {
    var levelMap = {
        BEGINNER: "Initié",
        BRONZE: "Bronze",
        SILVER: "Argent",
        GOLD: "Or"
    };

    return levelMap[levelId];
}

function getHumanReadDuration(nbSeconds) {
    var objDuration = moment.duration({ seconds: nbSeconds });
    var hours       = objDuration.hours();
    var minutes     = objDuration.minutes();
    var duration;

    if (hours > 1) {
        duration = hours + " heure" + (hours > 1 ? "s" : "")
                    + " " + minutes + " minute" + (minutes > 1 ? "s" : "");
    } else if (minutes > 1) {
        duration = minutes + " minute" + (minutes > 1 ? "s" : "");
    } else {
        duration = "moins d'une minute";
    }

    return duration;
}

function getAppUrl() {
    return AppUrlService.getAppUrl();
}

function getUrl() {
    return AppUrlService.getUrl.apply(null, arguments);
}

/**
 * Get formated and localized prices. Can return theoric prices when fees are missing.
 * @param {object}  booking
 * @param {number}  booking.ownerPrice
 * @param {number}  [booking.ownerFees]              Theoric fees are computed when missing
 * @param {number}  [booking.takerFees]              Theoric fees are computed when missing
 *
 * @return {object} prices
 * @return {number} prices.ownerPriceAfterRebate
 * @return {number} prices.ownerPriceAfterRebateStr
 * @return {number} prices.ownerNetIncome
 * @return {number} prices.ownerNetIncomeStr
 * @return {number} prices.takerPrice
 * @return {number} prices.takerPriceStr
 * @return {number} prices.ownerFees
 * @return {number} prices.ownerFeesStr
 * @return {number} prices.ownerFeesPercent
 * @return {number} prices.takerFees
 * @return {number} prices.takerFeesStr
 * @return {number} prices.takerFeesPercent
 */
function getPriceAfterRebateAndFees(booking) {
    var formatLocale   = "fr-FR";
    var currencyFormat = new Intl.NumberFormat(formatLocale, {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 0
    }).format;
    var prices         = PricingService.getPriceAfterRebateAndFees({ booking: booking });

    _.forEach(prices, (value, key) => {
        if (typeof value === "number" && ! _.includes(key.toLowerCase(), "percent")) {
            prices[key + "Str"] = currencyFormat(value).replace(/\s/g, ""); // trim special spaces
        }
    });

    return prices;
}

function getBookingValue(booking) {
    return PricingService.getPrice({
        config: booking.customPricingConfig || PricingService.getPricing(booking.pricingId).config,
        dayOne: booking.timeUnitPrice,
        nbDays: booking.nbTimeUnits,
        custom: !! booking.customPricingConfig,
        array: false
    });
}

function getLocationName(location, noHtmlTags) {
    var str;

    if (location.alias) {
        if (noHtmlTags) {
            str = location.alias;
        } else {
            str = `<strong>${location.alias}</strong>`;
        }

        str += ` (${location.name})`;
    } else {
        str = location.name;
    }

    return str;
}

function getContactDetails(user) {
    var str = ``;

    if (user.phoneCheck && user.phone) {
        str = `téléphone&nbsp;: ${user.phone}`;
    }

    // user email is not exposed in emails anymore
    // if (user.email) {
    //     str += (user.phoneCheck && user.phone) ? ` et ` : ``;
    //     str += `email&nbsp;: ${user.email}`;
    // }

    return str;
}

function isMissingIban(owner, booking) {
    return booking.takerPrice && ! owner.iban;
}

function getNearestLocations(journeys, locations, limit) {
    limit = limit || 2;

    var obj = {
        nearestLocation: null,
        otherLocations: []
    };

    if (! journeys
     || ! locations
     || ! journeys.length
     || ! locations.length
    ) {
        return obj;
    }

    obj.nearestLocation = locations[journeys[0].toIndex];

    var remainingJourneys = _.reject(journeys, (journey) => journey.toIndex === journeys[0].toIndex);
    remainingJourneys = _.uniq(remainingJourneys, "toIndex");

    if (remainingJourneys.length) {
        obj.otherLocations = _.map(_.take(remainingJourneys, limit), journey => {
            return locations[journey.toIndex];
        });
    }

    return obj;
}

function getMailTo(email, subject) {
    var str = `mailto:${email}`;

    if (subject) {
        str += `?subject=${subject}`;
    }

    return encodeURIComponent(str);
}

function isNoTime(booking) {
    return Booking.isNoTime(booking);
}
