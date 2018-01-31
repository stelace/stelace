/* global LoggerService, ErrorService */

const http = require('http');

module.exports = function serverError(error) {
    const req = this.req;
    const res = this.res;

    if (!(error instanceof Error)) {
        return res.status(500).send(http.STATUS_CODES[500]);
    }

    const isProd = (sails.config.environment === 'production');
    const status = error.status || 500;

    const logError = (typeof error.log === 'boolean' ? error.log : status >= 500);

    res.status(status);

    const jsonError = ErrorService.convertErrorToObj(error, isProd);

    if (logError) {
        let logger = req.logger || LoggerService.getLogger('app', { req });
        logger.error({ err: error, errorStatus: status });
    }

    if (isProd) {
        delete jsonError.stack;
    } else {
        jsonError._stack = jsonError.stack;
        delete jsonError.stack;
    }

    if (!error.expose) {
        if (!isProd) {
            jsonError._message = jsonError.message;
        }
        jsonError.message = http.STATUS_CODES[status];
    }

    res.send(jsonError);
};

