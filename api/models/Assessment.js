/* global Assessment, Conversation, GeneratorService, ListingHistoryService, MicroService */

/**
* Assessment.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        id: {
            type: 'number',
            columnType: 'int',
            autoIncrement: true,
        },
        createdDate: {
            type: 'string',
            columnType: 'varchar(255)',
            maxLength: 255,
        },
        updatedDate: {
            type: 'string',
            columnType: 'varchar(255)',
            maxLength: 255,
        },
        status: { // not required because we want to generate an empty assessment
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        comment: {
            type: 'string',
            columnType: 'longtext CHARACTER SET utf8mb4',
            allowNull: true,
        },
        commentDiff: {
            type: 'string',
            columnType: 'longtext CHARACTER SET utf8mb4',
            allowNull: true,
        },
        listingId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
            // index: true,
        },
        startBookingId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
            // index: true,
        },
        endBookingId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
            // index: true,
        },
        ownerId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
            // index: true,
        },
        takerId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
            // index: true,
        },
        signToken: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            allowNull: true,
            maxLength: 255,
        },
        signedDate: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        cancellationId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
            // index: true,
        },
        data: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
    },

    getAccessFields,
    beforeCreate,
    isAccessSelf,
    isValidStatus,
    getLastSigned,
    getBookingState,
    getRealTakerId,
    getRealGiverId,
    getPrefilledStateFields,
    filterConversationAssessments,
    exposeBeforeAssessment,
    needBeforeAssessments,

};

const _ = require('lodash');

function getAccessFields(access) {
    var accessFields = {
        self: [ // req.user.id in (ownerId || takerId)
            'id',
            'status',
            'comment',
            'commentDiff',
            'listingId',
            'listingSnapshotId',
            'startBookingId',
            'endBookingId',
            'ownerId',
            'ownerSnapshotId',
            'takerId',
            'takerSnapshotId',
            'signedDate',
            'cancellationId',
        ],
        others: [
            'id',
            'status',
            'comment',
            'commentDiff',
            'listingId',
            'listingSnapshotId',
            'signedDate',
            'cancellationId',
        ]
    };

    return accessFields[access];
}

var beforeAssessmentFields = [
    'status',
    'comment',
    'commentDiff'
];

function beforeCreate(values, next) {
    Assessment.beforeCreateDates(values);
    values.signToken = values.signToken || GeneratorService.getFunnyString();

    next();
}

function isAccessSelf(assessment, user) {
    var selfFields = [
        'ownerId',
        'takerId'
    ];

    return _.contains(_.pick(assessment, selfFields), user.id);
}

function isValidStatus(status) {
    return _.includes(['good', 'bad'], status);
}

async function getLastSigned(listingIdOrIds) {
    let onlyOne;
    let listingsIds;

    if (_.isArray(listingIdOrIds)) {
        listingsIds = _.uniq(listingIdOrIds);
        onlyOne = false;
    } else {
        listingsIds = [listingIdOrIds];
        onlyOne = true;
    }

    const listingHistories = await ListingHistoryService.getListingHistories(listingsIds);

    if (onlyOne) {
        return listingHistories[listingIdOrIds].getLastSignedAssessment();
    } else {
        return _.reduce(listingHistories, (memo, listingHistory, listingId) => {
            memo[listingId] = listingHistory.getLastSignedAssessment();
            return memo;
        }, {});
    }
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

function getPrefilledStateFields(assessment) {
    let comment = null;

    if (assessment.comment) {
        comment = assessment.comment;
    }
    if (assessment.commentDiff) {
        comment = (comment || '') + '\n\n' + assessment.commentDiff;
    }

    return {
        status: assessment.status,
        comment,
    };
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
    const assessmentsIds = MicroService.escapeListForQueries(_.pluck(assessments, 'id'));

    const result = {
        assessments: [],
        hashAssessments: {},
    };

    if (!assessmentsIds.length) {
        return result;
    }

    const conversations = await Conversation.find({
        or: [
            { inputAssessmentId: assessmentsIds },
            { outputAssessmentId: assessmentsIds },
        ],
    });

    const indexedInput  = _.indexBy(conversations, 'inputAssessmentId');
    const indexedOutput = _.indexBy(conversations, 'outputAssessmentId');

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
