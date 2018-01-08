/**
 * Default model configuration
 * (sails.config.models)
 *
 * Unless you override them, the following properties will be included
 * in each of your models.
 *
 * For more info on Sails models, see:
 * http://sailsjs.org/#/documentation/concepts/ORM
 */

module.exports.models = {

    /***************************************************************************
    *                                                                          *
    * Your app's default connection. i.e. the name of one of your app's        *
    * connections (see `config/connections.js`)                                *
    *                                                                          *
    ***************************************************************************/

    connection: 'MySQLServer',

    // migrate: "safe", // production
    migrate: "alter",

    autoCreatedAt: false,
    autoUpdatedAt: false,

    attributes: {
        createdDate: 'string',
        updatedDate: 'string'
    },

    beforeCreate,
    beforeUpdate,
    getAccessFields,
    expose,
    exposeAll,
    exposeTransform,
    updateOne,
    getCollection,
    getDefinition,
    getKnex,
    buildQuery,
    executeQuery,

};

/////////////
// WARNING //
/////////////

/*

=> https://github.com/balderdashy/sails-postgresql/issues/159
- NOT NULL criteria must be after the others

=> http://sailsjs.org/documentation/reference/waterline-orm/records/save
- Avoid to use waterline instance method like save() in promises as it NOT transactional (record can be corrupted during update)

=> afterUpdate() isn't triggered when multiple models are targeted

*/

/**
 * Model "before" life cycle customization:
 * provide .postBeforeCreate() to add customization after dates set
 * provide .beforeCreateCustom() to replace completely the behaviour of .beforeCreate()
 *
 * Same thing for .beforeUpdate()
 */

var moment = require('moment');

const knex = require('knex')({
    client: 'mysql',
});

function beforeCreate(values, next) {
    var model = this;

    return Promise.coroutine(function* () {
        if (typeof model.beforeCreateCustom === "function") {
            yield Promise.resolve().then(() => model.beforeCreateCustom(values));
        } else {
            beforeCreateDates(values);

            if (typeof model.postBeforeCreate === "function") {
                yield Promise.resolve().then(() => model.postBeforeCreate(values));
            }
        }
    })()
    .asCallback(next);
}

function beforeCreateDates(values) {
    var now = moment().toISOString();
    values.createdDate = now;
    values.updatedDate = now;
}

function beforeUpdate(values, next) {
    var model = this;

    return Promise.coroutine(function* () {
        if (typeof model.beforeUpdateCustom === "function") {
            yield Promise.resolve().then(() => model.beforeUpdateCustom(values));
        } else {
            beforeUpdateDates(values);

            if (typeof model.postBeforeUpdate === "function") {
                yield Promise.resolve().then(() => model.postBeforeUpdate(values));
            }
        }
    })()
    .asCallback(next);
}

function beforeUpdateDates(values) {
    var now = moment().toISOString();
    values.updatedDate = now;
    delete values.createdDate;
}

function getAccessFields(access) {
    var accessFields = {};
    return accessFields[access];
}

function expose(element, access) {
    var model = this;

    access = access || "others";
    var object = _.cloneDeep(element);

    if (access === "admin") {
        return object;
    }

    if (typeof element === "undefined" || element === null) {
        return null;
    }

    var accessFields = model.getAccessFields(access);
    if (! accessFields) {
        return {};
    } else {
        _.forEach(accessFields, function (field) {
            model.exposeTransform(object, field, access);
        });
        return _.pick(object, accessFields);
    }
}

function exposeAll(elements, access) {
    var model = this;

    if (! _.isArray(elements)) {
        throw new Error("exposeAll: expected array");
    }

    return _.reduce(elements, function (memo, element) {
        memo.push(model.expose(element, access));
        return memo;
    }, []);
}

function exposeTransform(/* element, field, access */) {
    // do nothing (only for template, exposeTransform on model override)
}

function updateOne(queryIdOrObj, updateAttrs) {
    var model = this;
    var error;

    return Promise.coroutine(function* () {
        var query = (typeof queryIdOrObj === "object" ? queryIdOrObj : { id: queryIdOrObj });

        var records = yield model.update(query, updateAttrs);

        if (! records.length) {
            error = new NotFoundError("Update one - not found");
            error.model = model.globalId;
            error.query = queryIdOrObj;
            throw error;
        }
        if (records.length > 1) {
            error = new Error("Update one - multiple instances");
            error.model = model.globalId;
            error.query = queryIdOrObj;
            throw error;
        }

        return records[0];
    })();
}

function getCollection() {
    return this.adapter.collection;
}

function getDefinition() {
    return this.definition;
}

function getKnex() {
    return knex;
}

function buildQuery() {
    const collection = this.getCollection();
    return knex.from(collection);
}

async function executeQuery(queryObj) {
    const queryString = await queryObj.toString();
    const res = await this.query(queryString);

    const definition = this.getDefinition();
    const jsonFields = {};

    _.forEach(definition, (value, key) => {
        if (value === 'json'
         || typeof value === 'object' && value.type === 'json'
        ) {
            jsonFields[key] = true;
        }
    });

    if (!_.keys(jsonFields).length) {
        return res;
    }

    _.forEach(res, line => {
        _.forEach(jsonFields, (value, field) => {
            if (typeof line[field] === 'string' && line[field]) {
                try {
                    line[field] = JSON.parse(line[field]);
                } catch (e) {
                    // do nothing
                }
            }
        });
    });

    return res;
}
