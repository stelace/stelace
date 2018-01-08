/* global StelaceConfigService */

module.exports = {

    fillByCharacter,
    getStringifiedJson,
    getParsedJson,
    obfuscateContactDetails,
    obfuscatePhone,
    obfuscateString,
    capitalizeFirstLetter,
    toStartCase,
    shrinkString,
    getURLStringSafe,
    uniqBy,
    getPeriodAttrs,
    isInteger,
    isWithinIntegerRange,
    isDurationObject,

};

var diacritics = require('diacritics');

function fillByCharacter(stringOrNumber, length, options) {
    options = _.defaults(options || {}, {
        character: "0",
        direction: "left"
    });

    if (typeof stringOrNumber === "number") {
        stringOrNumber = "" + stringOrNumber;
    }

    if (length <= stringOrNumber.length) {
        return stringOrNumber;
    }

    var stringToAppend = new Array(length - stringOrNumber.length + 1).join(options.character);
    if (options.direction === "left") {
        return stringToAppend + stringOrNumber;
    } else { // options.direction === "right"
        return stringOrNumber + stringToAppend;
    }
}

function getStringifiedJson(json) {
    if (typeof json !== "object") {
        return false;
    }

    var stringifiedJson;
    try {
        stringifiedJson = JSON.stringify(json);
    } catch (e) {
        return false;
    }

    return stringifiedJson;
}

function getParsedJson(stringifiedJson) {
    if (typeof stringifiedJson !== "string") {
        return false;
    }

    var parsedJson;
    try {
        parsedJson = JSON.parse(stringifiedJson);
    } catch (e) {
        return false;
    }
    return parsedJson;
}

function obfuscateContactDetails(text) {
    if (typeof text !== "string") {
        return;
    }

    var phoneRegEx     = /\b(?:(?:\.|-|\/|\s)*[0-9]+){5,}\b/g; // Filters 0612345678, 06.12-34//56 78, but also 12345 Revolutionnary Road (not 1234)
    var emailRegEx     = /\b[a-zA-Z0-9._%+-]+(?:@|AT|\[at\]|\[At\]|arobase|Arobase)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}\b/g;

    var obfuscatedText = text.replace(phoneRegEx, " ▒▒▒▒▒▒▒▒▒▒"); // UTF8 HTML Hex: &#x2592;
    obfuscatedText     = obfuscatedText.replace(emailRegEx, "▒▒▒▒@▒▒▒.▒▒"); // UTF8 HTML Hex: &#x2592;

    return obfuscatedText;
}

/**
 * Turns "0123456789" into "▒▒▒▒▒▒▒▒89"
 * @param {string} phoneStr - The string to obfuscate
 */
function obfuscatePhone(phoneStr) {
    return obfuscateString(phoneStr, 2, true);
}

/**
 * Turns "Frodo" into "▒▒▒▒▒"..
 * @param {string} phoneStr - The string to obfuscate
 * @param {integer} [nbRevealedChars=0] - Specifies number of characters to be revealed as in "Fro▒▒" (3)
 * @param {boolean} [revealEnd=false] - Allows to reveal nbRevealedChars last characters instead of first ones
 */
function obfuscateString(str, nbRevealedChars, revealEnd) {
    if (! str || typeof str !== "string") {
        return null;
    }
    var obfString = new Array(str.length + 1).join("▒"); // HTML Hex : &#x2592

    // integer check, see http://stackoverflow.com/questions/14636536/how-to-check-if-a-variable-is-an-integer-in-javascript/14794066
    if (typeof nbRevealedChars === "number" && (nbRevealedChars % 1) === 0) {
        obfString = revealEnd ? obfString.substr(nbRevealedChars) + str.substr(str.length - nbRevealedChars)
         : str.substr(0, nbRevealedChars) + obfString.substr(nbRevealedChars);
    }

    return obfString;
}

function capitalizeFirstLetter(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// lowerCase non-first letters in each word and works well with UTF-8
function toStartCase(str) {
    return str.replace(/([^\s:'-])([^\s:'-]*)/g, function ($0, $1, $2){
        return $1.toUpperCase() + $2.toLowerCase();
    });
}

function shrinkString(str, nbChar, nbWords) {
    var endCharacters = "..."; // not using unicode … for now (encoding issues with SMS)

    if (! str) {
        return "";
    }

    if (nbWords) {
        var words      = str.split(" ");
        var firstWords = str.split(" ", nbWords).join(" ");

        if (nbWords < words.length && firstWords.length <= nbChar) {
            return firstWords + endCharacters;
        } else {
            return shrink(str, nbChar);
        }
    } else {
        return shrink(str, nbChar);
    }



    function shrink(str, nbChar) {
        if (str.length <= nbChar) {
            return str;
        }

        return str.substr(0, nbChar) + endCharacters;
    }
}

function getURLStringSafe(str) {
    return diacritics.remove(str).replace(/\W/gi, "-");
}

function uniqBy(array, field) {
    var hash = {};

    return _.reduce(array, (memo, value) => {
        if (! hash[value[field]]) {
            memo.push(value);
            hash[value[field]] = true;
        }
        return memo;
    }, []);
}

/**
 * get period attrs
 * @param  {string} fromDate
 * @param  {string} toDate
 * @param  {object} [args]
 * @param  {object} [args.exclusiveFromDate = false] - exclude fromDate from the query
 * @param  {object} [args.exclusiveToDate = true]    - exclude toDate from the query
 * @return {object} period object that can be used in waterline
 */
function getPeriodAttrs(fromDate, toDate, args) {
    args = args || {};
    var exclusiveFromDate = (typeof args.exclusiveFromDate !== "undefined" ? args.exclusiveFromDate : false);
    var exclusiveToDate   = (typeof args.exclusiveToDate !== "undefined" ? args.exclusiveToDate : true);

    if (! fromDate && ! toDate) {
        return null;
    }

    var periodAttrs = {};
    var fromOperator = (exclusiveFromDate ? ">" : ">=");
    var toOperator   = (exclusiveToDate ? "<" : "<=");

    if (fromDate) {
        periodAttrs[fromOperator] = fromDate;
    }
    if (toDate) {
        periodAttrs[toOperator] = toDate;
    }

    return periodAttrs;
}

function isInteger(value) {
    return typeof value === 'number' && value % 1 === 0;
}

function isWithinIntegerRange(value, { min, max }) {
    let result = isInteger(value);

    if (typeof min === 'number') {
        result = result && value >= min;
    }
    if (typeof max === 'number') {
        result = result && value <= max;
    }

    return result;
}

function isDurationObject(value, { min, max }) {
    const timeGranularities = StelaceConfigService.getTimeGranularities();

    if (typeof value !== 'object') return false;

    const keys = _.keys(value);
    if (keys.length !== 1) return false;

    const unit = keys[0];
    const number = value[unit];

    return _.includes(timeGranularities, unit)
        && isWithinIntegerRange(number, { min, max });
}
