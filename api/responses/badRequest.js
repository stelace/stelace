/* global ErrorService, LoggerService */

/**
 * 400 (Bad Request) Handler
 *
 * Usage:
 * return res.badRequest();
 * return res.badRequest(data);
 * return res.badRequest(data, 'some/specific/badRequest/view');
 *
 * e.g.:
 * ```
 * return res.badRequest(
 *   'Please choose a valid `password` (6-12 characters)',
 *   'trial/signup'
 * );
 * ```
 */

module.exports = function badRequest(data, options) {

    var defaultData = { message: "bad request" };

    // Get access to `req`, `res`, & `sails`
    var req = this.req;
    var res = this.res;
    var sails = req._sails;

    if (data) {
        var logger = req.logger || LoggerService.getLogger("app", { req: req });
        logger = logger.child({ errorStatus: 400 });
        logger.error({ err: data });
    }

    // Set status code
    res.status(400);

    // Log error to console
    if (typeof data !== "undefined") {
        sails.log.verbose('Sending 400 ("Bad Request") response: \n', data);
    } else {
        sails.log.verbose('Sending 400 ("Bad Request") response');
    }

    // Only include errors in response if application environment
    // is not set to 'production'.  In production, we shouldn't
    // send back any identifying information about errors.
    var isProd = (sails.config.environment === "production");

    if (data instanceof Error) {
        if (! isProd || (isProd && data.expose === true)) {
            data = ErrorService.convertErrorToObj(data, isProd);
        } else {
            data = defaultData;
        }
    } else {
        if (isProd && (! options || options.forceData !== true)) {
            data = defaultData;
        }
    }

    // If the user-agent wants JSON, always respond with JSON
    if (req.wantsJSON) {
        return res.jsonx(data);
    }

    // If second argument is a string, we take that to mean it refers to a view.
    // If it was omitted, use an empty object (`{}`)
    options = (typeof options === 'string') ? { view: options } : options || {};

    // If a view was provided in options, serve it.
    // Otherwise try to guess an appropriate view, or if that doesn't
    // work, just send JSON.
    if (options.view) {
        return res.view(options.view, { data: data });
    }

    // If no second argument provided, try to serve the implied view,
    // but fall back to sending JSON(P) if no view can be inferred.
    else { // eslint-disable-line
        return res.guessView({ data: data }, function couldNotGuessView() {
            return res.jsonx(data);
        });
    }

};

