/* global LoggerService */

/**
 * ClientLogController
 *
 * @description :: Server-side logic for managing clientlogs
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {

    error: error

};

function error(req, res) {
    var error = req.param("error");
    var url   = req.param("url");

    var logger = LoggerService.getLogger("client");
    logger = logger.child({ req: req });

    logger.error({
        url: url,
        err: error
    });

    res.sendStatus(200);
}
