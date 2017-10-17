/* global ErrorService */

module.exports = {

    getLogger: getLogger,
    getConsoleLogger: getConsoleLogger

};

var bunyan = require('bunyan');
var path   = require('path');
var mkdirp = require('mkdirp');
var moment = require('moment');
var fs     = require('fs');

var cleanCacheInterval = 86400000; // 1 day
var cache = {};

setTimeout(_cleanCache, cleanCacheInterval);

/*
 * This function dumps long stack traces for exceptions having a cause()
 * method. The error classes from
 * [verror](https://github.com/davepacheco/node-verror) and
 * [restify v2.0](https://github.com/mcavage/node-restify) are examples.
 *
 * Based on `dumpException` in
 * https://github.com/davepacheco/node-extsprintf/blob/master/lib/extsprintf.js
 */
function _getFullErrorStack(ex) {
    var ret = ex.stack || ex.toString();
    if (ex.cause && typeof (ex.cause) === 'function') {
        var cex = ex.cause();
        if (cex) {
            ret += '\nCaused by: ' + _getFullErrorStack(cex);
        }
    }
    return (ret);
}

var serializers = {};

serializers.req = function (req) {
    if (! req) {
        return req;
    }

    var obj = {
        method: req.method,
        url: req.url,
        headers: req.headers
    };

    if (req.ip) {
        obj.ip = req.ip;
    }
    if (req.ips.length) {
        obj.ips = req.ips;
    }
    if (req.requestId) {
        obj.requestId = req.requestId;
    }
    if (req.user && req.user.id) {
        obj.userId = req.user.id;
    }

    return obj;
};

serializers.err = function (err) {
    if (! err || ! err.stack) {
        return err;
    }

    // message, name and stack aren't enumerable, so explicitly set them
    var obj = {
        message: err.message,
        name: err.name,
        stack: _getFullErrorStack(err)
    };

    _.forEach(_.keys(err), function (attr) {
        if (! _.contains(["message", "name", "stack"], attr)) {
            obj[attr] = err[attr];
        }
    });

    return obj;
};

function _getAggregateDate(now) {
    var dayOfMonth = now.date();
    var aggregateDate;

    if (dayOfMonth <= 9) {
        aggregateDate = "01";
    } else if (dayOfMonth <= 19) {
        aggregateDate = "10";
    } else {
        aggregateDate = "20";
    }

    return now.format("YYYY-MM-") + aggregateDate;
}

function _cleanCache() {
    var now           = moment();
    var aggregateDate = _getAggregateDate(now);

    _.forEach(cache, function (config, date) {
        if (config._expired) {
            delete cache[date];
        }
        if (aggregateDate !== date) {
            config._expired = true;
        }
    });

    setTimeout(_cleanCache, cleanCacheInterval); // 1 day
}

function getLogger(name) {
    var now              = moment();
    var aggregateDate    = _getAggregateDate(now);
    var loggerFolderPath = path.join(__dirname, "../../logs", name);
    var filename         = name + "_" + aggregateDate + ".log";
    var filepath         = path.join(loggerFolderPath, filename);
    var logger;

    if (cache[aggregateDate] && cache[aggregateDate][name]) {
        return cache[aggregateDate][name];
    }

    if (! µ.existsSync(loggerFolderPath)) {
        mkdirp.sync(loggerFolderPath, 0o770);
    }
    if (! µ.existsSync(filepath)) {
        // equivalent of shell 'touch' file
        fs.closeSync(fs.openSync(filepath, "w"));
    }

    logger = bunyan.createLogger({
        name: name,
        streams: [
            {
                path: filepath,
                level: "info"
            }
        ],
        serializers: serializers
    });

    if (sails.config.environment === "development") {
        convertToDevLogger(logger);
    }

    if (! cache[aggregateDate]) {
        cache[aggregateDate] = {};
    }

    cache[aggregateDate][name] = logger;

    return logger;
}

function convertToDevLogger(logger) {
    addConsole(logger, "error");
    addConsole(logger, "warn");

    var customKey = "_child_custom";

    if (logger[customKey]) {
        return;
    }

    var _child = logger.child;

    logger.child = function () {
        var childLogger = _child.apply(logger, arguments);

        addConsole(childLogger, "error");
        addConsole(childLogger, "warn");

        return childLogger;
    };

    logger[customKey] = true;
}

function addConsole(logger, method) {
    var customKey = `_${method}_custom`;

    if (logger[customKey]) {
        return;
    }

    var _method = logger[method];

    logger[method] = function () {
        _method.apply(logger, arguments);

        _.forEach(arguments, arg => {
            if (typeof arg === "object") {
                if (arg.err) {
                    arg.err = ErrorService.convertErrorToObj(arg.err);
                }
                try {
                    console.log(JSON.stringify(arg, null, 2));
                } catch (e) {
                    if (e instanceof TypeError) {
                        console.log(arg);
                    } else {
                        throw e;
                    }
                }
            } else {
                console.log(arg);
            }
        });
    };

    logger[customKey] = true;
}

function ConsoleLogger() {}

function displayLogLevel(level) {
    return function () {
        console.log(`${new Date().toISOString()} - ${level}: `);
        console.log.apply(null, arguments);
    };
}

ConsoleLogger.prototype.trace = displayLogLevel("TRACE");
ConsoleLogger.prototype.debug = displayLogLevel("DEBUG");
ConsoleLogger.prototype.info  = displayLogLevel("INFO");
ConsoleLogger.prototype.warn  = displayLogLevel("WARN");
ConsoleLogger.prototype.error = displayLogLevel("ERROR");
ConsoleLogger.prototype.fatal = displayLogLevel("FATAL");

function getConsoleLogger() {
    return new ConsoleLogger();
}
