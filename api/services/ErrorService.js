module.exports = {

    convertErrorToObj,

};

const _ = require('lodash');

function convertErrorToObj(error, isProd) {
    if (!(error instanceof Error)) {
        return error;
    }

    var obj = {};
    obj.message = error.message;

    if (! isProd && error.stack) {
        obj.stack = error.stack.split("\n");
    }

    var omittedFields = [
        "name",
        "message",
        "stack",
        "rawStack",
        "details",
        "reason",
        "_e",
        "model",
        "invalidAttributes",
        "originalError",
        "expose",
        "log",
    ];

    _.forEach(_.keys(error), function (attr) {
        if (! _.contains(omittedFields, attr)) {
            obj[attr] = error[attr];
        }
    });

    return obj;
}
