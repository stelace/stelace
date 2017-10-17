/* global LoggerService, TokenService, UAService */

/**
 * HTTP Server Settings
 * (sails.config.http)
 *
 * Configuration for the underlying HTTP server in Sails.
 * Only applies to HTTP requests (not WebSockets)
 *
 * For more information on configuration, check out:
 * http://sailsjs.org/#/documentation/reference/sails.config/sails.config.http.html
 */

var path = require('path');
var fs   = require('fs');

module.exports.http = {

    /****************************************************************************
    *                                                                           *
    * Express middleware to use for every Sails request. To add custom          *
    * middleware to the mix, add a function to the middleware config object and *
    * add its key to the "order" array. The $custom key is reserved for         *
    * backwards-compatibility with Sails v0.9.x apps that use the               *
    * `customMiddleware` config option.                                         *
    *                                                                           *
    ****************************************************************************/

    middleware: {

        /***************************************************************************
        *                                                                          *
        * The order in which middleware should be run for HTTP request. (the Sails *
        * router is invoked by the "router" middleware below.)                     *
        *                                                                          *
        ***************************************************************************/

        order: [
            'startRequestTimer',
            'redirectToHomepageForOldBrowsers',
            'cookieParser',
            // 'session',       // disable session, use token instead
            'requestIdentifier',
            'responseEnhancement',
            'customLogger',
            // 'myRequestLogger',
            'bodyParser',
            'handleBodyParserError',
            'compress',
            'methodOverride',
            'basicAuth',
            // 'poweredBy',     // don't display it in headers because of security issues
            // 'secureResponseHeader', // disable because nginx takes care of it
            '$custom',
            'router',
            'www',
            'favicon',
            '404',
            '500'
        ],

        /****************************************************************************
        *                                                                           *
        * Example custom middleware; logs each request to the console.              *
        *                                                                           *
        ****************************************************************************/

        redirectToHomepageForOldBrowsers: function (req, res, next) {
            var isOldBrowser = UAService.isOldBrowser(req.headers["user-agent"]);

            if (req.path !== "/" && isOldBrowser) {
                return res.redirect("/");
            } else {
                next();
            }
        },

        requestIdentifier: function (req, res, next) {
            req.requestId = new Date().getTime() + "" + Math.floor(Math.random() * 1000000);

            next();
        },

        responseEnhancement: function (req, res, next) {
            res.sendError = µ.sendError(res);

            if (req.url.substr(0, 5) === "/api/") {
                res.set("Cache-Control", "no-cache");
            }

            next();
        },

        customLogger: function (req, res, next) {
            var logger = LoggerService.getLogger("app");
            var config = {
                req: req
            };

            var authorization = req.headers.authorization;
            var rawToken;
            var tokenParts;
            var decodedToken;

            if (authorization) {
                rawToken = TokenService.isValidBearerToken(authorization);

                if (rawToken) {
                    tokenParts = rawToken.split(".");

                    if (tokenParts.length === 3) {
                        try {
                            decodedToken = JSON.parse(new Buffer(tokenParts[1], "base64").toString("binary"));
                            config.decodedAuthorizationToken = decodedToken;
                        } catch (e) {
                            // do nothing
                        }
                    }
                }
            }

            req.logger = logger.child(config);

            next();
        },

        basicAuth: function (req, res, next) {
            if (! sails.config.basicAuth
             || req.cookies.basicAuth === sails.config.basicAuth
             || req.path === "/api/auth/basic") {
                return next();
            }

            if (req.wantsJSON || req.xhr) {
                res.send(403, { message: "Forbidden" });
            } else {
                getContent(function (err, content) {
                    if (err) {
                        res.send(500, { message: "Server error" });
                    } else {
                        res.send(200, content);
                    }
                });
            }



            function getContent(cb) {
                var filepath = path.join(__dirname, "../api/assets/views", "basic-auth.html");
                fs.readFile(filepath, "utf8", cb);
            }
        },

        secureResponseHeader: function (req, res, next) {
            res.set("x-frame-options", "SAMEORIGIN");
            res.set("x-xss-protection", "1; mode=block");
            res.set("x-content-type-options", "nosniff");

            res.removeHeader("x-powered-by");

            next();
        }

        // myRequestLogger: function (req, res, next) {
        //     console.log("Requested :: ", req.method, req.url);
        //     return next();
        // }


        /***************************************************************************
        *                                                                          *
        * The body parser that will handle incoming multipart HTTP requests. By    *
        * default as of v0.10, Sails uses                                          *
        * [skipper](http://github.com/balderdashy/skipper). See                    *
        * http://www.senchalabs.org/connect/multipart.html for other options.      *
        *                                                                          *
        ***************************************************************************/

        // bodyParser: require('skipper')

    },

    customMiddleware: function (/* app */) {
        // use express app
    },

    /***************************************************************************
    *                                                                          *
    * The number of seconds to cache flat files on disk being served by        *
    * Express static middleware (by default, these files are in `.tmp/public`) *
    *                                                                          *
    * The HTTP static cache is only active in a 'production' environment,      *
    * since that's the only time Express will cache flat-files.                *
    *                                                                          *
    ***************************************************************************/

    // cache: 31557600000
    cache: 2592000          // 1 month
};
