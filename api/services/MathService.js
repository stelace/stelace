module.exports = {

    roundDecimal: roundDecimal,
    getMedian: getMedian

};


function roundDecimal(num, decimal, type) {
    var divisor = Math.pow(10, decimal);

    var func;
    switch (type) {
        case "floor":
            func = Math.floor;
            break;

        case "ceil":
            func = Math.ceil;
            break;

        default:
            func = Math.round;
            break;
    }

    return func(num * divisor) / divisor;
}

function getMedian(sortedArray) {
    var length = sortedArray && sortedArray.length;

    return length && (sortedArray[Math.floor((length - 1) / 2)] * 1 + sortedArray[Math.ceil((length - 1) / 2)] * 1) / 2;
}
