module.exports = {

    isPrivate: isPrivate,
    requestInfo: requestInfo,
    getInfo: getInfo

};

var request   = require('request');
var NodeCache = require('node-cache');
var ipModule  = require('ip');
const Promise = require('bluebird');

Promise.promisifyAll(request, { multiArgs: true });

var IPCache = new NodeCache({ stdTTL: 5 * 60 });

function isPrivate(ip) {
    return ipModule.isPrivate(ip);
}

function requestInfo(ip) {
    return Promise.coroutine(function* () {
        const telizeUrl = sails.config.telize.url;

        if (!telizeUrl || isPrivate(ip)) {
            return { ip: ip };
        }

        try {
            var url = telizeUrl + "/geoip" + (ip ? "/" + ip : "");
            var res = yield request.getAsync(url, { json: true });

            var response = res[0];
            var body     = res[1];

            if (response.statusCode !== 200) {
                throw body;
            } else {
                return body;
            }
        } catch (e) {
            return { ip: ip };
        }
    })();
}

function getInfo(ip) {
    return Promise.coroutine(function* () {
        if (isPrivate(ip)) {
            return { ip: ip };
        }

        var ipInfo = IPCache.get(ip);
        if (ipInfo) {
            IPCache.set(ip, ipInfo); // to refresh TTL
            return ipInfo;
        }

        try {
            ipInfo = yield requestInfo(ip);
            IPCache.set(ip, ipInfo);
            return ipInfo;
        } catch (e) {
            return { ip: ip };
        }
    })();
}
