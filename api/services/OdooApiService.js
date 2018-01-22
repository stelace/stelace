module.exports = {

    isEnabled: isEnabled,

    getInstance: getInstance

};

var request = require('request');
var jayson  = require('jayson');
const _ = require('lodash');
const Promise = require('bluebird');

Promise.promisifyAll(request, { multiArgs: true });

function isEnabled() {
    var odooConfig = sails.config.odoo;
    return odooConfig && odooConfig.enabled;
}

/**
 * Get custom Odoo instance
 * @param {object} options
 * @param {string} [options.protocol]
 * @param {string} options.host
 * @param {number} options.port
 * @param {string} options.database
 * @param {string} options.username
 * @param {string} options.password
 * @param {number} [options.sessionDuration]
 * @return {CustomOdoo}
 */
function getInstance(options) {
    return new CustomOdoo(options);
}

function CustomOdoo(options) {
    this.protocol           = options.protocol || "http:";
    this.host               = options.host;
    this.port               = options.port;
    this.database           = options.database;
    this.username           = options.username;
    this.password           = options.password;
    this.sessionDuration    = options.sessionDuration || 86400; // 1 day in seconds
    this.lastConnectionDate = null;
    this.session            = null;
    this.session_id         = null;
    this.context            = null;
    this.uid                = null;
    this.sid                = null;
}

CustomOdoo.prototype.getBaseUrl = function getBaseUrl() {
    return this.protocol + "//"
        + this.host
        + (this.port ? ":" + this.port : "");
};

CustomOdoo.prototype.isSessionExpired = function isSessionExpired() {
    return ! this.lastConnectionDate
        || this.lastConnectionDate.getTime() < new Date().getTime() - this.sessionDuration;
};

CustomOdoo.prototype.getSession = function getSession() {
    return this._refreshSession()
        .then(() => {
            return (this.session ? _.cloneDeep(this.session) : {});
        });
};

CustomOdoo.prototype.getContext = function getContext() {
    return this._refreshSession()
        .then(() => {
            return (this.context ? _.cloneDeep(this.context) : {});
        });
};

CustomOdoo.prototype._refreshSession = function _refreshSession() {
    if (this.isSessionExpired()) {
        return this.connect();
    } else {
        return Promise.resolve();
    }
};

CustomOdoo.prototype._getCustomContext = function _getCustomContext(context) {
    if (! context) {
        return this.context;
    } else if (context._override) {
        return _.omit(context, ["_override"]);
    } else {
        return _.assign({}, this.context, context);
    }
};

CustomOdoo.prototype.connect = function connect() {
    if (! isEnabled()) {
        this.session            = {};
        this.context            = {};
        this.lastConnectionDate = new Date();
        return Promise.resolve();
    }

    var params = {
        db: this.database,
        login: this.username,
        password: this.password
    };

    var options = {
        url: "/web/session/authenticate",
        baseUrl: this.getBaseUrl(),
        body: { params: params },
        json: true
    };

    return request.postAsync(options)
        .spread((response, body) => {
            if (response.statusCode !== 200) {
                throw body;
            }
            if (body.error) {
                throw body.error;
            }

            var res = body.result;

            if (! res.uid) {
                throw new Error("Odoo connection error");
            }

            this.uid        = res.uid;
            this.sid        = response.headers["set-cookie"][0].split(";")[0];
            this.session_id = res.session_id;
            this.context    = res.user_context;

            this.lastConnectionDate = new Date();

            return res;
        });
};

CustomOdoo.prototype.search = function search(model, params, context) {
    if (! params.domain) {
        return Promise.reject(new Error("Must provide a search domain"));
    }

    var endpoint = "/web/dataset/call_kw";
    var customParams = {
        model: model,
        method: "search",
        args: [params.domain],
        kwargs: {
            context: this._getCustomContext(context)
        }
    };

    return this.rpcCall(endpoint, customParams);
};

CustomOdoo.prototype.searchRead = function searchRead(model, params, context) {
    if (! params.domain) {
        return Promise.reject(new Error("'domain' parameter required. Must provide a search domain."));
    }
    if (! params.limit) {
        return Promise.reject(new Error("'limit' parameter required. Must specify max. number of results to return."));
    }

    var endpoint = "/web/dataset/call_kw";
    var customParams = {
        model: model,
        method: "search_read",
        args: [],
        kwargs: {
            context: this._getCustomContext(context),
            domain: params.domain,
            offset: params.offset,
            limit: params.limit,
            order: params.order,
            fields: params.fields
        }
    };

    return this.rpcCall(endpoint, customParams);
};

CustomOdoo.prototype.get = function get(model, params) {
    if (! params.ids) {
        return Promise.reject(new Error("Must provide a list of IDs."));
    }

    var endpoint = "/web/dataset/call_kw";
    var customParams = {
        model: model,
        method: "read",
        args: [params.ids],
        kwargs: {
            fields: params.fields
        }
    };

    return this.rpcCall(endpoint, customParams);
};

CustomOdoo.prototype.browseById = function browseById(model, params, context) {
    params.domain = [["id", ">", "0"]];

    return this.searchRead(model, params, context);
};

CustomOdoo.prototype.create = function create(model, params, context) {
    var endpoint = "/web/dataset/call_kw";
    var customParams = {
        model: model,
        method: "create",
        args: [params],
        kwargs: {
            context: this._getCustomContext(context)
        }
    };

    return this.rpcCall(endpoint, customParams);
};

CustomOdoo.prototype.update = function update(model, id, params, context) {
    if (! id) {
        return Promise.reject(new Error("Missing id"));
    }

    var endpoint = "/web/dataset/call_kw";
    var customParams = {
        model: model,
        method: "write",
        args: [[id], params],
        kwargs: {
            context: this._getCustomContext(context)
        }
    };

    return this.rpcCall(endpoint, customParams);
};

CustomOdoo.prototype.delete = function del(model, id, context) {
    if (! id) {
        return Promise.reject(new Error("Missing id"));
    }

    var endpoint = "/web/dataset/call_kw";
    var customParams = {
        model: model,
        method: "unlink",
        args: [[id]],
        kwargs: {
            context: this._getCustomContext(context)
        }
    };

    return this.rpcCall(endpoint, customParams);
};

CustomOdoo.prototype.rpcCall = function rpcCall(endpoint, params) {
    if (! params.model) {
        return Promise.reject(new Error("Missing model"));
    }

    if (! isEnabled()) {
        return Promise.resolve();
    }

    return this._refreshSession()
        .then(() => {
            return this._request(endpoint, params);
        });
};

CustomOdoo.prototype._request = function _request(path, params) {
    params = params || {};

    var options = {
        host: this.host,
        port: this.port,
        path: path || "/",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Cookie: this.sid + ";"
        }
    };

    var client;

    if (this.protocol === "https:") {
        client = jayson.client.https(options);
    } else {
        client = jayson.client.http(options);
    }

    return new Promise((resolve, reject) => {
        client.request("call", params, function (e, err, res) {
            var error = e || err;

            if (error) {
                reject(error);
            } else {
                resolve(res);
            }
        });
    });
};
