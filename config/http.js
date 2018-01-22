/* global LoggerService, MicroService, TokenService, UAService */

/**
 * HTTP Server Settings
 * (sails.config.http)
 *
 * Configuration for the underlying HTTP server in Sails.
 * (for additional recommended settings, see `config/env/production.js`)
 *
 * For more information on configuration, check out:
 * https://sailsjs.com/config/http
 */

var path  = require('path');
var fs    = require('fs');
var proxy = require('http-proxy-middleware');

module.exports.http = {

    /****************************************************************************
    *                                                                           *
    * Sails/Express middleware to run for every HTTP request.                   *
    * (Only applies to HTTP requests -- not virtual WebSocket requests.)        *
    *                                                                           *
    * https://sailsjs.com/documentation/concepts/middleware                     *
    *                                                                           *
    ****************************************************************************/

    middleware: {

        /***************************************************************************
        *                                                                          *
        * The order in which middleware should be run for HTTP requests.           *
        * (This Sails app's routes are handled by the "router" middleware below.)  *
        *                                                                          *
        ***************************************************************************/

        order: [
            'redirectToHomepageForOldBrowsers',
            'cookieParser',
            // 'session',       // disable session, use token instead
            'requestIdentifier',
            'responseEnhancement',
            'customLogger',
            // 'myRequestLogger',
            'bodyParser',
            'compress',
            'basicAuth',
            'secureResponseHeader',
            '$custom', // sails customMiddleware using app object
            'router',
            'www',
            'favicon',
        ],

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
            res.sendError = MicroService.sendError(res);

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

        /***************************************************************************
        *                                                                          *
        * The body parser that will handle incoming multipart HTTP requests.       *
        *                                                                          *
        * https://sailsjs.com/config/http#?customizing-the-body-parser             *
        *                                                                          *
        ***************************************************************************/

        // bodyParser: (function _configureBodyParser(){
        //   var skipper = require('skipper');
        //   var middlewareFn = skipper({ strict: true });
        //   return middlewareFn;
        // })(),

    },

    customMiddleware: function (app) {
        if (sails.config.stelace.dashboardUrl) {
            app.use('/dashboard', proxy({
                target: sails.config.stelace.dashboardUrl,
                changeOrigin: false,
            }));
            app.use('/stelace', proxy({
                target: sails.config.stelace.dashboardUrl,
                changeOrigin: false,
            }));
        }
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
    cache: 2592000,          // 1 month
};
