/* global MicroService, PhantomService */

module.exports = {

    init,

};

const querystring = require('querystring');
const fs          = require('fs');
const path        = require('path');
const cheerio     = require('cheerio');
const Uuid        = require('uuid');
const _ = require('lodash');
const Promise = require('bluebird');
const moment = require('moment');

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

SeoSnapshot.prototype.getCache = async function getCache() {
    if (this.cache) {
        return this.cache;
    }

    if (! MicroService.existsSync(this.cacheFilepath)) {
        // equivalent of shell 'touch' file
        fs.closeSync(fs.openSync(this.cacheFilepath, "w"));

        this.cache = {};
        return this.cache;
    }

    try {
        let data = await fs.readFileAsync(this.cacheFilepath, 'utf8');
        data = JSON.parse(data);

        this.cache = data;
        return this.cache;
    } catch (e) {
        this.cache = {};
        return this.cache;
    }
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

SeoSnapshot.prototype.setSnapshotData = function setSnapshotData(url, { uuid, status, createdDate } = {}) {
    if (! this.cache[url]) {
        this.cache[url] = {};
    }

    const snapshotData = this.cache[url];

    if (!snapshotData.uuid) {
        snapshotData.uuid = uuid || Uuid.v4();
    }
    if (status) {
        snapshotData.status = status;
    }
    if (createdDate) {
        snapshotData.createdDate = createdDate;
    }
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

SeoSnapshot.prototype.createSnapshot = async function (args) {
    var urlBody          = args.urlBody;
    var urlPath          = args.urlPath;
    var snapshotFilename = args.snapshotFilename;
    var snapshotFilepath = path.join(this.snapshotsDirPath, snapshotFilename);
    var uuid             = args.uuid;

    await PhantomService.snapshotHtml({
        url: urlBody + urlPath,
        filePath: snapshotFilename,
        spa: true,
    });

    const data = await fs.readFileAsync(snapshotFilepath, 'utf8');

    const $ = cheerio.load(data);
    let status = $('meta[name="status-code"]').attr('content');
    status = status ? parseInt(status, 10) : 200;

    const createdDate = new Date().toISOString();

    this.setSnapshotData(urlPath, { uuid, status, createdDate });
    this.isThereNewSnapshots = true;

    return status;
};

SeoSnapshot.prototype.serveSnapshot = async function serveSnapshot(urlBody, urlPath, req, res) {
    await this.getCache();

    const standardizedUrl  = this.standardizeUrl(urlPath);
    const snapshotData     = this.getSnapshotData(standardizedUrl);
    const snapshotFilename = snapshotData.uuid + '.html';
    const snapshotFilepath = path.join(this.snapshotsDirPath, snapshotFilename);

    let status;

    const expirationDays = sails.config.stelace.snapshotsDurationInDays || 7;
    const minCreatedDate = moment().subtract({ d: expirationDays }).toISOString();

    let takeSnapshot = !_.includes([200, 204], snapshotData.status)
        || !MicroService.existsSync(snapshotFilepath)
        || !snapshotData.createdDate || snapshotData.createdDate < minCreatedDate;

    if (takeSnapshot) {
        const snapshotArgs = {
            uuid: snapshotData.uuid,
            urlBody: urlBody,
            urlPath: standardizedUrl,
            snapshotFilename: snapshotFilename,
        };

        status = await this.createSnapshot(snapshotArgs);
    } else {
        status = snapshotData.status;
    }

    res.status(status).sendFile(snapshotFilepath);
};
