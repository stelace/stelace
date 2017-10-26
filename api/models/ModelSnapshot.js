/* global ModelSnapshot */

/**
* ModelSnapshot.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        targetId: {
            type: "integer",
            index: true
        },
        targetType: {
            type: "string",
            index: true,
            size: 191,
            maxLength: 191
        },
        data: {
            type: "json",
            defaultsTo: {}
        }
    },

    get: get,

    isIdentical: isIdentical,
    getSnapshot: getSnapshot,
    fetch: fetch,
    exposeSnapshot: exposeSnapshot

};

var params = {
    targetTypes: ["user", "listing", "location"]
};

function get(prop) {
    if (prop) {
        return params[prop];
    } else {
        return params;
    }
}

function _exposeSnapshot(snapshot) {
    var obj = snapshot.data;
    obj.id = snapshot.id;
    obj.snapshot = true;

    return obj;
}

function getComparedFields(targetType) {
    var comparedFields;

    if (targetType === "user") {
        comparedFields = [
            "username",
            "firstname",
            "lastname",
            "description",
            "phone",
            "phoneCountryCode",
            "phoneCheck",
            "role",
            "email",
            "emailCheck",
            "mediaId",
            "ratingScore",
            "nbRatings",
            "birthday",
            "nationality",
            "countryOfResidence",
            "address",
            "mangopayUserId",
            "walletId",
            "bankAccountId",
            "iban",
            "points",
            "levelId"
        ];
    } else if (targetType === "listing") {
        comparedFields = [
            "name",
            "nameURLSafe",
            "description",
            "stateComment",
            "bookingPreferences",
            "accessories",
            "ownerId",
            "bookingStartDate",
            "bookingEndDate",
            "brandId",
            "reference",
            "listingCategoryId",
            "mediasIds",
            "instructionsMediasIds",
            "validated",
            "validationPoints",
            "ratingScore",
            "nbRatings",
            "autoBookingAcceptation",
            "locations",
            "perimeterDurationMinutes",
            "listingTypesIds",
            "soldDate",
            "sellingPrice",
            "dayOnePrice",
            "pricingId",
            "customPricingConfig",
            "deposit",
            "acceptFree"
        ];
    } else if (targetType === "location") {
        comparedFields = [
            "name",
            "alias",
            "streetNum",
            "street",
            "postalCode",
            "city",
            "department",
            "region",
            "latitude",
            "longitude",
            "transportMode",
            "userId",
            "establishment",
            "establishmentName",
            "provider",
            "remoteId"
        ];
    }

    return comparedFields;
}

function isIdentical(targetType, model, snapshot) {
    if (! _.contains(ModelSnapshot.get("targetTypes"), targetType)) {
        return false;
    }

    var comparedFields = getComparedFields(targetType);

    var modelFields    = _.pick(model, comparedFields);
    var snapshotFields = _.pick(snapshot.data, comparedFields);

    return _.isEqual(modelFields, snapshotFields);
}

function getSnapshot(targetType, model, force) {
    return Promise
        .resolve()
        .then(() => {
            if (! _.contains(ModelSnapshot.get("targetTypes"), targetType)
                || ! model || ! model.id
            ) {
                throw new Error("bad params");
            }

            // do not fetch existing snapshots
            if (force) {
                return;
            }

            return ModelSnapshot
                .findOne({
                    targetId: model.id,
                    targetType: targetType
                })
                .sort({ createdDate: -1 });
        })
        .then(snapshot => {
            if (snapshot && isIdentical(targetType, model, snapshot)) {
                return _exposeSnapshot(snapshot);
            }

            return ModelSnapshot
                .create({
                    targetId: model.id,
                    targetType: targetType,
                    data: _.pick(model, getComparedFields(targetType))
                })
                .then(snapshot => {
                    return _exposeSnapshot(snapshot);
                });
        });
}

function fetch(snapshotIdOrIds) {
    return Promise
        .resolve()
        .then(() => {
            return ModelSnapshot.find({ id: snapshotIdOrIds });
        })
        .then(snapshots => {
            var exposedSnapshots = _.map(snapshots, function (snapshot) {
                return _exposeSnapshot(snapshot);
            });

            if (! _.isArray(snapshotIdOrIds)) {
                if (snapshots.length) {
                    return exposedSnapshots[0];
                } else {
                    return null;
                }
            } else {
                return exposedSnapshots;
            }
        });
}

function exposeSnapshot(snapshot, originalId) {
    var obj = _exposeSnapshot(snapshot);

    if (originalId) {
        obj.id = snapshot.targetId;
    }

    return obj;
}
