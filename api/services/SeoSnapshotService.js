/* global PhantomService */

module.exports = {

    init: init

};

var querystring = require('querystring');
var fs          = require('fs');
var path        = require('path');
var cheerio     = require('cheerio');
var uuid        = require('uuid');

Promise.promisifyAll(fs);

function init(args) {
    return new SeoSnapshot(args);
}

function SeoSnapshot(args) {
    args = args || {};

    this.cache               = null;
    this.saveInterval        = args.saveInterval || 300000; // 5 minutes
    this.snapshotsDirPath    = args.snapshotsDirPath;
    this.cacheFilepath       = path.join(this.snapshotsDirPath, "cache.json");
    this.isThereNewSnapshots = false;

    setInterval(() => {
        if (this.isThereNewSnapshots) {
            this.saveCache()
                .then(() => {
                    this.isThereNewSnapshots = false;
                })
                .catch(() => { /* do nothing */ }); // do not handle error
        }
    }, this.saveInterval);
}

SeoSnapshot.prototype.getCache = function getCache() {
    return Promise
        .resolve()
        .then(() => {
            if (this.cache) {
                return this.cache;
            }

            if (! µ.existsSync(this.cacheFilepath)) {
                // equivalent of shell 'touch' file
                fs.closeSync(fs.openSync(this.cacheFilepath, "w"));

                this.cache = {};
                return this.cache;
            }

            return fs
                .readFileAsync(this.cacheFilepath, "utf8")
                .then(JSON.parse)
                .then(data => {
                    this.cache = data;
                    return this.cache;
                })
                .catch((/* err */) => {
                    this.cache = {};
                    return this.cache;
                });
        });
};

SeoSnapshot.prototype.saveCache = function saveCache() {
    return fs.writeFileAsync(this.cacheFilepath, JSON.stringify(this.cache, null, 2));
};

SeoSnapshot.prototype.getSnapshotData = function getSnapshotData(url) {
    if (! this.cache[url]) {
        this.setSnapshotData(url);
    }

    return this.cache[url];
};

SeoSnapshot.prototype.setSnapshotData = function setSnapshotData(url, status) {
    if (! this.cache[url]) {
        this.cache[url] = {};
    }

    var snapshotData = this.cache[url];

    if (! snapshotData.uuid) {
        snapshotData.uuid = uuid.v4();
    }
    snapshotData.status = status;
};

SeoSnapshot.prototype.standardizeUrl = function standardizeUrl(urlPath) {
    // remove the last character if equals to '/' in order to prevent double snapshot
    // the url '/s' is the same as '/s/'
    if (urlPath !== "/" && urlPath.slice(-1) === "/") {
        urlPath = urlPath.substring(0, urlPath.length - 1);
    }

    // reconstitute the urlPath with the query parameters, but without the parameter '_escaped_fragment_'
    var urlSplit = urlPath.split("?");
    var parsedQuery = querystring.parse(urlSplit.length >= 2 ? urlSplit[1] : "");

    var parsedQueryWithoutEF = _.reduce(parsedQuery, (memo, value, key) => {
        if (key !== "_escaped_fragment_") {
            memo[key] = value;
        }
        return memo;
    }, {});

    var stringifiedQueryWithoutEF = querystring.stringify(parsedQueryWithoutEF);

    urlPath = urlSplit[0] + (stringifiedQueryWithoutEF ? "?" + stringifiedQueryWithoutEF : "");

    return urlPath;
};

SeoSnapshot.prototype.createSnapshot = function (args) {
    var urlBody          = args.urlBody;
    var urlPath          = args.urlPath;
    var snapshotFilename = args.snapshotFilename;
    var snapshotFilepath = path.join(this.snapshotsDirPath, snapshotFilename);

    return Promise
        .resolve()
        .then(() => {
            return PhantomService.snapshotHtml({
                url: urlBody + urlPath,
                filePath: snapshotFilename,
                spa: true
            });
        })
        .then(() => {
            return fs.readFileAsync(snapshotFilepath, "utf8");
        })
        .then(data => {
            var $ = cheerio.load(data);
            var status = $("meta[name='status-code']").attr("content");
            status = status ? parseInt(status, 10) : 200;

            this.setSnapshotData(urlPath, status);
            this.isThereNewSnapshots = true;

            return status;
        });
};

SeoSnapshot.prototype.serveSnapshot = function serveSnapshot(urlBody, urlPath, req, res) {
    return this.getCache()
        .then(() => {
            var standardizedUrl  = this.standardizeUrl(urlPath);
            var snapshotData     = this.getSnapshotData(standardizedUrl);
            var snapshotFilename = snapshotData.uuid + ".html";
            var snapshotFilepath = path.join(this.snapshotsDirPath, snapshotFilename);


            // if the snapshot exists and the status is 202 or 404, serve it
            if (_.contains([200, 204], snapshotData.status) && µ.existsSync(snapshotFilepath)) {
                return [
                    snapshotData.status,
                    snapshotFilepath
                ];
            }

            var snapshotArgs = {
                urlBody: urlBody,
                urlPath: standardizedUrl,
                snapshotFilename: snapshotFilename
            };

            return this.createSnapshot(snapshotArgs)
                .then(status => {
                    return [
                        status,
                        snapshotFilepath
                    ];
                });
        })
        .spread((status, snapshotFilepath) => {
            res
                .status(status)
                .sendfile(snapshotFilepath);
        })
        .catch(res.sendError);
};
