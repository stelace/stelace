/* global ToolsService */

module.exports = {

    getFunnyString: getFunnyString,
    getRandomString: getRandomString

};

var crypto = require('crypto'); // eslint-disable-line

Promise.promisifyAll(crypto);

var specialCharacters = "#@!?.*-&;%";
var funnyStringMaxLength = 9;

var stuffList = [
    "tidus",
    "yuna",
    "wakka",
    "besaid",
    "choco",
    "pampa",
    "spira",
    "cloud",
    "aerith",
    "ashe",
    "bash",
    "elrond",
    "rings",
    "luke",
    "force",
    "obi",
    "casey",
    "grimes",
    "orion",
    "larkin",
    "zork",
    "cercle",
    // "keating",
    "perry",
    // "numenor",
    "cygne",
    "merry",
    "donnie",
    "locke",
    "abydos",
    "shine",
    "gump",
    "fuji",
    "back",
    "futur",
    "python",
    "gran",
    "torino",
    "wild",
    "truman",
    "atlas",
    "sonmy",
    "yali",
    "nyborg",
    "arche",
    // "twombly",
    "angus",
    "mgs",
    "snake",
    "raiden",
    "otacon",
    "rose",
    "quizas",
    "mood",
    "switch",
    "smith",
    "epoch",
    "niobe",
    "link",
    "wilson",
    "will",
    "phil",
    "reach",
    "karth",
    "geralt",
    "triss",
    "shani",
    "nate",
    "peach",
    "toad",
    "pika",
    "chu",
    "mew",
    "nimbus",
    "albus",
    "lupin",
    "eich",
    "gnu",
    "peter",
    "hooba",
    "blink"
];

function getFunnyString() {
    var stuffListNum = Math.floor(Math.random() * stuffList.length);
    var str = "";
    var deltaLength;

    str = stuffList[stuffListNum];
    deltaLength = funnyStringMaxLength - str.length;

    if (deltaLength <= 0) {
        return str;
    }

    str += specialCharacters.charAt(Math.floor(Math.random() * specialCharacters.length));
    deltaLength -= 1;

    if (deltaLength <= 0) {
        return str;
    }

    str += ToolsService.fillByCharacter(Math.floor(Math.random() * Math.pow(10, deltaLength)), deltaLength);
    return str;
}

/**
 * http://blog.tompawlak.org/how-to-generate-random-values-nodejs-javascript
 */
function getRandomString(length) {
    return crypto
        .randomBytesAsync(Math.ceil(length * 3 / 4))
        .then(function (randomArray) {
            var randomString = randomArray.toString("base64")
                                            .slice(0, length)
                                            .replace(/\+/g, '0')
                                            .replace(/\//g, '0');

            return randomString;
        });
}

