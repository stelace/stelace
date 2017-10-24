/* global Conversation, GeneratorService, Item, ListingHistoryService, ModelSnapshot, User */

/**
* Assessment.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        workingLevel: "string",     // not required because we want to generate an empty assessment
        cleanlinessLevel: "string", // not required because we want to generate an empty assessment
        itemAccessories: "array",
        comment: "text",
        commentDiff: "text",
        itemId: {
            type: "integer",
            index: true
        },
        itemSnapshotId: {
            type: "integer",
            index: true
        },
        startBookingId: {
            type: "integer",
            index: true
        },
        endBookingId: {
            type: "integer",
            index: true
        },
        ownerId: {
            type: "integer",
            index: true
        },
        ownerSnapshotId: {
            type: "integer",
            index: true
        },
        ownerMainLocationSnapshotId: {
            type: "integer",
            index: true
        },
        takerId: {
            type: "integer",
            index: true
        },
        takerSnapshotId: {
            type: "integer",
            index: true
        },
        takerMainLocationSnapshotId: {
            type: "integer",
            index: true
        },
        signToken: "string",
        signedDate: "string",
        cancellationId: {
            type: "integer",
            index: true
        }
    },

    getAccessFields: getAccessFields,
    get: get,
    // beforeValidate: beforeValidate,
    postBeforeCreate: postBeforeCreate,
    // isValidItemAccessories: isValidItemAccessories,
    isAccessSelf: isAccessSelf,
    getLastSigned: getLastSigned,
    getBookingState: getBookingState,
    getRealTakerId: getRealTakerId,
    getRealGiverId: getRealGiverId,
    getSnapshots: getSnapshots,
    getSnapshotsIds: getSnapshotsIds,
    getPrefilledStateFields: getPrefilledStateFields,
    getAssessmentLevel: getAssessmentLevel,
    filterConversationAssessments: filterConversationAssessments,
    exposeBeforeAssessment: exposeBeforeAssessment,
    needBeforeAssessments: needBeforeAssessments

};

var params = {
    workingLevels: ["good", "average", "bad"],
    cleanlinessLevels: ["good", "average", "bad"]
};

function getAccessFields(access) {
    var accessFields = {
        self: [ // req.user.id in (ownerId || takerId)
            "id",
            "workingLevel",
            "cleanlinessLevel",
            "itemAccessories",
            "comment",
            "commentDiff",
            "itemId",
            "itemSnapshotId",
            "startBookingId",
            "endBookingId",
            "ownerId",
            "ownerSnapshotId",
            "takerId",
            "takerSnapshotId",
            "signedDate",
            "cancellationId"
        ],
        others: [
            "id",
            "workingLevel",
            "cleanlinessLevel",
            "itemAccessories",
            "comment",
            "commentDiff",
            "itemId",
            "itemSnapshotId",
            "signedDate",
            "cancellationId"
        ]
    };

    return accessFields[access];
}

var beforeAssessmentFields = [
    "workingLevel",
    "cleanlinessLevel",
    "itemAccessories",
    "comment",
    "commentDiff"
];

function get(prop) {
    if (prop) {
        return params[prop];
    } else {
        return params;
    }
}

// function beforeValidate(values, next) {
//     if (! values.itemAccessories) {
//         next();
//         return;
//     }

//     if (Assessment.isValidItemAccessories(values.itemAccessories)) {
//         next();
//     } else {
//         next({ error: "item accessories bad format" });
//     }
// }

function postBeforeCreate(values) {
    values.signToken = values.signToken || GeneratorService.getFunnyString();
}

// function isValidItemAccessories(itemAccessories) {
//     return µ.checkArray(itemAccessories, "string", { maxLength: Item.get("maxLengthAccessoryName") })
//         && itemAccessories.length <= Item.get("maxNbAccessories");
// }

function isAccessSelf(assessment, user) {
    var selfFields = [
        "ownerId",
        "takerId"
    ];

    return _.contains(_.pick(assessment, selfFields), user.id);
}

function getLastSigned(itemIdOrIds) {
    return Promise.coroutine(function* () {
        var onlyOne;
        var itemsIds;

        if (_.isArray(itemIdOrIds)) {
            itemsIds = _.uniq(itemIdOrIds);
            onlyOne = false;
        } else {
            itemsIds = [itemIdOrIds];
            onlyOne = true;
        }

        const listingHistories = yield ListingHistoryService.getListingHistories(itemsIds);

        if (onlyOne) {
            return listingHistories[itemIdOrIds].getLastSignedAssessment();
        } else {
            return _.reduce(listingHistories, (memo, listingHistory, itemId) => {
                memo[itemId] = listingHistory.getLastSignedAssessment();
                return memo;
            }, {});
        }
    })();
}

/**
 * get booking state
 * @param  {object} booking
 * @param  {string} type - must be "start" or "end"
 * @return {object} bookingState
 * @return {number} bookingState.startBookingId
 * @return {number} bookingState.endBookingId
 */
function getBookingState(booking, type) {
    var bookingState = {
        startBookingId: null,
        endBookingId: null
    };

    if (type === "start") {
        bookingState.startBookingId = booking.id;
    } else { // type === "end"
        bookingState.endBookingId = booking.id;
    }

    return bookingState;
}

function getRealTakerId(assessment) {
    if (assessment.startBookingId) {
        return assessment.takerId;
    } else { // assessment.endBookingId
        return assessment.ownerId;
    }
}

function getRealGiverId(assessment) {
    if (assessment.startBookingId) {
        return assessment.ownerId;
    } else { // assessment.endBookingId
        return assessment.takerId;
    }
}

function getSnapshots(assessment) {
    return Promise.coroutine(function* () {
        var usersIds = [assessment.ownerId, assessment.takerId];

        usersIds = _.uniq(usersIds);

        var results;

        results = yield Promise.props({
            item: Item.findOne({ id: assessment.itemId }),
            users: User.find({ id: usersIds })
        });

        var item  = results.item;
        var users = results.users;

        var owner = _.find(users, { id: assessment.ownerId });
        var taker = _.find(users, { id: assessment.takerId });

        if (! item
            || ! owner
            || ! taker
        ) {
            throw new NotFoundError();
        }

        results = yield Promise.props({
            itemSnapshot: ModelSnapshot.getSnapshot("item", item),
            ownerSnapshot: ModelSnapshot.getSnapshot("user", owner),
            takerSnapshot: ModelSnapshot.getSnapshot("user", taker),
            ownerLocSnapshot: Location.getMainLocationSnapshot(owner.id),
            takerLocSnapshot: Location.getMainLocationSnapshot(taker.id),
        });

        return {
            itemSnapshot: results.itemSnapshot,
            ownerSnapshot: results.ownerSnapshot,
            takerSnapshot: results.takerSnapshot,
            ownerMainLocationSnapshot: results.ownerLocSnapshot,
            takerMainLocationSnapshot: results.takerLocSnapshot,
        };
    })();
}

function getSnapshotsIds(snapshots) {
    return {
        itemSnapshotId: snapshots.itemSnapshot.id,
        ownerSnapshotId: snapshots.ownerSnapshot.id,
        takerSnapshotId: snapshots.takerSnapshot.id,
        ownerMainLocationSnapshotId: snapshots.ownerMainLocationSnapshot ? snapshots.ownerMainLocationSnapshot.id : null,
        takerMainLocationSnapshotId: snapshots.takerMainLocationSnapshot ? snapshots.takerMainLocationSnapshot.id : null
    };
}

function getPrefilledStateFields(assessment) {
    var comment = null;

    if (assessment.comment) {
        comment = assessment.comment;
    }
    if (assessment.commentDiff) {
        comment = (comment || "") + "\n\n" + assessment.commentDiff;
    }

    return {
        workingLevel: assessment.workingLevel,
        cleanlinessLevel: assessment.cleanlinessLevel,
        comment: comment
    };
}

function getAssessmentLevel(type, level) {
    var levelTypes = {
        working: {
            good: "Fonctionnel",
            average: "Moyen",
            bad: "Non fonctionnel"
        },
        cleanliness: {
            good: "Propre",
            average: "Moyen",
            bad: "Sale"
        }
    };

    var levelType = levelTypes[type];
    if (levelType) {
        return levelType[level];
    }

    return "";
}

/**
 * Make sure the returned assessments are visible through conversations
 * @param  {Object[]} assessments
 * @return {Object} res
 * @return {Object[]} res.assessments - visible assessments
 * @return {Object} res.hashAssessments - hash indexed by assessmentId
 * @return {Object} res.hashAssessments[assessmentId].conversation - assessment conversation
 * @return {Boolean} res.hashAssessments[assessmentId].isInput - is conversation input assessment
 * @return {Boolean} res.hashAssessments[assessmentId].isOutput - is conversation output assessment
 */
async function filterConversationAssessments(assessments) {
    const assessmentsIds = _.pluck(assessments, 'id');

    const conversations = await Conversation.find({
        or: [
            { inputAssessmentId: assessmentsIds },
            { outputAssessmentId: assessmentsIds },
        ],
    });

    const indexedInput  = _.indexBy(conversations, 'inputAssessmentId');
    const indexedOutput = _.indexBy(conversations, 'outputAssessmentId');

    const result = {
        assessments: [],
        hashAssessments: {},
    };

    _.forEach(assessments, assessment => {
        const conversation = indexedInput[assessment.id] || indexedOutput[assessment.id];
        if (conversation) {
            result.assessments.push(assessment);
            result.hashAssessments[assessment.id] = {
                conversation,
                isInput: !!indexedInput[assessment.id],
                isOutput: !!indexedOutput[assessment.id],
            };
        }
    });

    return result;
}

function exposeBeforeAssessment(assessment) {
    return assessment ? _.pick(assessment, beforeAssessmentFields) : null;
}

// conversation may need before assessments to have the previous state of object as placeholder
function needBeforeAssessments(conversation, inputAssessment, outputAssessment) {
    var input  = !! conversation.inputAssessmentId;
    var output = !! conversation.outputAssessmentId;

    var result = {
        input: false,
        output: false
    };

    // ! input && ! output -> no assessment means no placeholder
    // input && output -> the input assessment is the before output assessment

    // need the before input assessment if the input assessment is not signed
    if (input && ! output) {
        result.input = ! inputAssessment.signedDate;
    // need the before output assessment if the output assessment is not signed
    } else if (! input && output) {
        result.output = ! outputAssessment.signedDate;
    }

    return result;
}
