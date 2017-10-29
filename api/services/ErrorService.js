module.exports = {

    init: init,
    convertErrorToObj: convertErrorToObj

};

var BadRequestError = require('./errors/BadRequestError');
var ForbiddenError  = require('./errors/ForbiddenError');
var NotFoundError   = require('./errors/NotFoundError');

function init() {
    global.BadRequestError = BadRequestError;
    global.ForbiddenError  = ForbiddenError;
    global.NotFoundError   = NotFoundError;
}

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
    ];

    _.forEach(_.keys(error), function (attr) {
        if (! _.contains(omittedFields, attr)) {
            obj[attr] = error[attr];
        }
    });

    return obj;
}
