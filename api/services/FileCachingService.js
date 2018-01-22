/* global MicroService */

module.exports = {

    getCache: getCache

};

var fs = require('fs');
const Promise = require('bluebird');

var defaultSaveInterval = 300000; // 5 minutes

/**
 * get cache
 * @param  {object} args
 * @param  {object} filepath - the file path where the file is saved
 * @param  {object} [saveInterval] - in milliseconds
 * @return {object} cache
 */
function getCache(args) {
    return new Cache(args);
}

function Cache(args) {
    this.filepath     = args.filepath;
    this.saveInterval = args.saveInterval || defaultSaveInterval;
    this.data         = {};
    this.dataChanged  = false;
    this.loaded       = false;
    this.scheduled    = setInterval(() => {
        this.saveToFile()
            .catch(() => { /* do nothing */ });
    }, this.saveInterval);
}

Cache.prototype.getAll = function () {
    return this.data;
};

Cache.prototype.get = function (key) {
    return this.data[key];
};

Cache.prototype.set = function (key, value) {
    this.dataChanged = true;

    this.data[key] = value;
};

Cache.prototype.unset = function (key) {
    this.dataChanged = true;

    delete this.data[key];
};

Cache.prototype.isReady = function () {
    return this.loaded;
};

Cache.prototype.loadFromFile = function () {
    var _this = this;

    return Promise.coroutine(function* () {
        if (_this.loaded) {
            return _this.data;
        }

        if (! MicroService.existsSync(_this.filepath)) {
            // equivalent of shell 'touch' file
            fs.closeSync(fs.openSync(_this.filepath, "w"));

            return _this.data;
        }

        try {
            var rawData = yield fs.readFileAsync(_this.filepath, "utf8");
            rawData = JSON.parse(rawData);

            _this.data = rawData;
        } catch (e) {
            // do nothing
        } finally {
            _this.loaded = true;
        }

        return _this.data;
    })();
};

Cache.prototype.saveToFile = function () {
    var _this = this;

    return Promise.coroutine(function* () {
        if (! _this.dataChanged) {
            return;
        }

        yield fs.writeFileAsync(_this.filepath, JSON.stringify(_this.data, null, 2));

        _this.dataChanged = false;
    })();
};

Cache.prototype.free = function () {
    clearInterval(this.scheduled);
};
