/*
    global Assessment, AssessmentGamificationService, AssessmentService, Booking, Conversation,
    EmailTemplateService, Listing, ListingHistoryService, SmsTemplateService, User
 */

module.exports = {

    findAssessments,
    createAssessment,
    updateAssessment,
    signAssessment,

};

const moment = require('moment');
const _ = require('lodash');
const Promise = require('bluebird');
const createError = require('http-errors');

/**
 * find assessments from conversation (input, output, before input, before output)
 * before assessments are used as placeholders for the current editing assessment
 * so there can be none if no needed
 * @param  {number} conversationId
 * @param  {number} [userId] - if provided, check if the user can get those assessments
 * @return {Promise<object>} hashAssessments
 * @return {object}          hashAssessments.inputAssessment
 * @return {object}          hashAssessments.outputAssessement
 * @return {object}          hashAssessments.beforeInputAssessment
 * @return {object}          hashAssessments.beforeOutputAssessement
 */
async function findAssessments(conversationId, userId) {
    var conversation = await Conversation.findOne({ id: conversationId });
    if (! conversation) {
        throw createError(404);
    }
    if (userId && ! Conversation.isPartOfConversation(conversation, userId)) {
        throw createError(403);
    }

    var error;

    if (! conversation.listingId) {
        error = new Error("Conversation must have an listingId");
        error.conversationId = conversation.id;
        throw error;
    }

    const listingHistories = await ListingHistoryService.getListingHistories([conversation.listingId]);
    const listingHistory = listingHistories[conversation.listingId];

    var inputAssessment;
    var outputAssessment;
    var beforeInputAssessment;
    var beforeOutputAssessment;

    var manualFetchInput = false;

    var assessments = listingHistory.getAssessments();

    if (conversation.inputAssessmentId) {
        inputAssessment = _.find(assessments, { id: conversation.inputAssessmentId });

        // listing history doens't take into account bookings that isn't accepted and paid (pre-booking)
        // so fetch it manually
        if (! inputAssessment) {
            inputAssessment = await Assessment.findOne({ id: conversation.inputAssessmentId });
            manualFetchInput = true;
        }
    }
    if (conversation.outputAssessmentId) {
        outputAssessment = _.find(assessments, { id: conversation.outputAssessmentId });
    }

    if ((conversation.inputAssessmentId && ! inputAssessment)
        || (conversation.outputAssessmentId && ! outputAssessment)
    ) {
        error = new Error("Conversation assessments missing");
        error.conversationId = conversation.id;
        if (! inputAssessment) {
            error.inputAssessmentId = conversation.inputAssessmentId;
        }
        if (! outputAssessment) {
            error.outputAssessmentId = conversation.outputAssessmentId;
        }
        throw error;
    }

    var needBefore = Assessment.needBeforeAssessments(conversation, inputAssessment, outputAssessment);
    if (needBefore.input && inputAssessment) {
        beforeInputAssessment = listingHistory.getBeforeAssessment(inputAssessment.id);
    }
    if (needBefore.output && outputAssessment) {
        beforeOutputAssessment = listingHistory.getBeforeAssessment(outputAssessment.id);
    }

    if (manualFetchInput) {
        beforeInputAssessment = listingHistory.getLastSignedAssessment();
    }

    return {
        inputAssessment: inputAssessment,
        outputAssessment: outputAssessment,
        beforeInputAssessment: beforeInputAssessment,
        beforeOutputAssessment: beforeOutputAssessment
    };
}

/**
 * create assessment
 * @param  {object} args
 * @param  {object} args.booking
 * @param  {string} args.type - "start" or "end"; assessment is the start or end of the provided booking
 * @param  {object} [args.stateFields] - if not provided, take fields from before assessment
 * @param  {string} [args.stateFields.status]
 * @param  {string} [args.stateFields.comment]
 * @param  {string} [args.stateFields.commentDiff]
 * @param  {object} [args.beforeAssessment] - if not provided, fetch the last assessment
 * @return {Promise<object>} created assessment
 */
function createAssessment(args) {
    var booking          = args.booking;
    var type             = args.type;
    var beforeAssessment = args.beforeAssessment;
    var stateFields      = args.stateFields;

    var filteredStateAttrs = [
        'status',
        'comment',
        'commentDiff',
    ];
    var createAttrs = _.pick(stateFields, filteredStateAttrs);

    return Promise.coroutine(function* () {
        if (! booking
            || ! _.includes(["start", "end"], type)
        ) {
            throw createError(400);
        }

        if (typeof beforeAssessment === "undefined") {
            beforeAssessment = yield Assessment.getLastSigned(booking.listingId);
        } else if (beforeAssessment.listingId !== booking.listingId) {
            throw createError(400, 'the before assessment and booking don\'t match on listing id');
        }

        if (beforeAssessment && ! stateFields) {
            _.assign(createAttrs, Assessment.getPrefilledStateFields(beforeAssessment));
        }

        createAttrs.listingId   = booking.listingId;
        createAttrs.ownerId  = booking.ownerId;
        createAttrs.takerId  = booking.takerId;

        _.assign(createAttrs, Assessment.getBookingState(booking, type));

        return yield Assessment.create(createAttrs);
    })();
}

/**
 * update assessment
 * @param  {number} assessmentId
 * @param  {object} updateAttrs
 * @param  {string} updateAttrs.workingLevel
 * @param  {string} updateAttrs.cleanlinessLevel
 * @param  {string} updateAttrs.comment
 * @param  {string} updateAttrs.commentDiff
 * @param  {number} userId
 * @return {Promise<object} updated assessment
 */
function updateAssessment(assessmentId, updateAttrs, userId) {
    var filteredAttrs = [
        'status',
        'comment',
        'commentDiff',
    ];

    updateAttrs = _.pick(updateAttrs, filteredAttrs);

    return Promise.coroutine(function* () {
        if (updateAttrs.status && !Assessment.isValidStatus(updateAttrs.status)) {
            throw createError(400);
        }

        var assessment = yield Assessment.findOne({ id: assessmentId });
        if (! assessment) {
            throw createError(404);
        }
        // the user that can edit assessment is the one that gives the listing
        if (Assessment.getRealGiverId(assessment) !== userId) {
            throw createError(403);
        }
        if (assessment.signedDate) {
            throw createError(400, 'Assessment already signed');
        }

        return yield Assessment.updateOne(assessment.id, updateAttrs);
    })();
}

/**
 * Sign assessment with token
 * @param {Number} assessmentId
 * @param {String} signToken
 * @param {Object} options
 * @param {Number} options.userId
 * @param {Object} options.logger
 * @param {Object} options.req
 * @return {Object} signed assessment
 */
async function signAssessment(assessmentId, signToken, { userId, logger, req } = {}) {
    const now = moment().toISOString();

    let assessment = await Assessment.findOne({ id: assessmentId });
    if (! assessment) {
        throw createError(404);
    }
    // the user that can sign assessment is the one that gives the listing
    if (Assessment.getRealGiverId(assessment) !== userId) {
        throw createError(403);
    }
    if (! assessment.workingLevel
        || ! assessment.cleanlinessLevel
    ) {
        throw createError(400, 'Assessment missing required fields');
    }
    if (assessment.signedDate) {
        throw createError(400, 'Assessment already signed');
    }

    let outputAssessment;

    if (assessment.startBookingId) {
        const startBooking = await Booking.findOne({ id: assessment.startBookingId });
        if (! startBooking) {
            const error = new Error('Assessment start booking not found');
            error.assessmentId = assessment.id;
            error.bookingId    = assessment.startBookingId;
            throw error;
        }

        // create an assessment only if this is a process with two steps
        const { ASSESSMENTS } = startBooking.listingType.properties;
        const config = startBooking.listingType.config;

        if (config.assessment.useConfirmationCode) {
            if (assessment.signToken !== signToken) {
                throw createError(400, 'wrong token');
            }
        }

        if (ASSESSMENTS === 'TWO_STEPS') {
            outputAssessment = await createOutputAssessment(assessment, startBooking);
        // set the completed date if this is a one-step assessment
        } else if (ASSESSMENTS === 'ONE_STEP') {
            await Booking.update({ id: startBooking.id }, { completedDate: now });
        }
    } else if (assessment.endBookingId) {
        const endBooking = await Booking.findOne({ id: assessment.endBookingId });
        if (! endBooking) {
            var error = new Error("Assessment end booking not found");
            error.assessmentId = assessment.id;
            error.bookingId    = assessment.endBookingId;
            throw error;
        }

        const config = endBooking.listingType.config;

        if (config.assessment.useConfirmationCode) {
            if (assessment.signToken !== signToken) {
                throw createError(400, 'wrong token');
            }
        }

        await Booking.updateBookingEndState(endBooking, now);
    }

    const data = {
        assessment: assessment,
        newAssessment: outputAssessment,
        logger: logger
    };

    await _sendAssessmentEmailsSms(data);

    const updateAttrs = {
        signedDate: now
    };

    assessment = await Assessment.updateOne(assessment.id, updateAttrs);

    AssessmentGamificationService.afterAssessmentSigned(assessment, logger, req);

    return assessment;
}

function createOutputAssessment(assessment, startBooking) {
    return Promise.coroutine(function* () {
        var [outputAssessment] = yield Assessment
            .find({
                listingId: assessment.listingId,
                takerId: assessment.takerId,
                ownerId: assessment.ownerId,
                endBookingId: assessment.startBookingId
            })
            .limit(1);

        if (outputAssessment) {
            return outputAssessment;
        }

        outputAssessment = yield AssessmentService.createAssessment({
            booking: startBooking,
            type: "end",
            beforeAssessment: assessment
        });

        yield Conversation.updateOne(
            { bookingId: outputAssessment.endBookingId },
            { outputAssessmentId: outputAssessment.id }
        );

        return outputAssessment;
    })();
}

/**
 * @param data
 * - *assessment
 * - *logger
 * - newAssessment
 */
function _sendAssessmentEmailsSms(data) {
    var assessment    = data.assessment;
    var newAssessment = data.newAssessment;
    var logger        = data.logger;

    return Promise
        .resolve()
        .then(() => {
            if (! assessment
                || ! logger
            ) {
                throw createError('Missing args');
            }

            return getData(assessment, newAssessment, logger);
        })
        .then(data => {
            return sendEmails(data);
        });



    function getData(assessment, newAssessment, logger) {
        return Promise
            .resolve()
            .then(() => {
                return [
                    Listing.findOne({ id: assessment.listingId }),
                    assessment.startBookingId ? Booking.findOne({ id: assessment.startBookingId }) : null,
                    assessment.endBookingId ? Booking.findOne({ id: assessment.endBookingId }) : null,
                    User.findOne({ id: assessment.ownerId }),
                    User.findOne({ id: assessment.takerId }),
                    getConversation(assessment)
                ];
            })
            .spread((listing, startBooking, endBooking, owner, taker, conversation) => {
                if (! listing
                    || ! owner
                    || ! taker
                    || (assessment.startBookingId && ! startBooking)
                    || (assessment.endBookingId && ! endBooking)
                ) {
                    var error = new Error("Booking accept missing references");
                    if (! listing) {
                        error.listingId = assessment.listingId;
                    }
                    if (! owner) {
                        error.ownerId = assessment.ownerId;
                    }
                    if (! taker) {
                        error.takerId = assessment.takerId;
                    }
                    if (assessment.startBookingId && ! startBooking) {
                        error.startBookingId = assessment.startBookingId;
                    }
                    if (assessment.endBookingId && ! endBooking) {
                        error.endBookingId = assessment.endBookingId;
                    }
                    if (! conversation) {
                        error.bookingId = assessment.startBookingId || assessment.endBookingId;
                    }

                    throw error;
                }

                var data = {};
                data.assessment    = assessment;
                data.newAssessment = newAssessment;
                data.listing          = listing;
                data.startBooking  = startBooking;
                data.endBooking    = endBooking;
                data.owner         = owner;
                data.taker         = taker;
                data.conversation  = conversation;
                data.logger        = logger;

                return data;
            });
    }

    function getConversation(assessment) {
        return Conversation
            .find({
                or: [
                    { outputAssessmentId: assessment.id },
                    { inputAssessmentId: assessment.id }
                ]
            })
            .sort('createdDate DESC')
            .then(conversations => conversations[0]);
    }

    function sendEmails(data) {
        var logger        = data.logger;
        var assessment    = data.assessment;
        var newAssessment = data.newAssessment;
        var listing          = data.listing;
        var startBooking  = data.startBooking;
        var endBooking    = data.endBooking;
        var owner         = data.owner;
        var taker         = data.taker;
        var conversation  = data.conversation;

        return Promise
            .resolve()
            .then(() => {
                // send booking-checkout emails to taker and owner if startBookingId, or listing-return emails to owner and taker if endBookingId
                if (assessment.startBookingId) {
                    const { TIME } = startBooking.listingType.properties;

                    if (! newAssessment && TIME === 'TIME_FLEXIBLE') {
                        throw createError('newAssessment missing');
                    }

                    return Promise.all([
                        sendEmailBookingCheckoutToTaker(),
                        sendEmailBookingCheckoutToOwner(),
                        sendSmsBookingPendingToOwner()
                    ]);
                } else if (assessment.endBookingId) {
                    return Promise.all([
                        sendEmailListingReturnToTaker(),
                        sendEmailListingReturnToOwner()
                    ]);
                }
            });



        function sendEmailBookingCheckoutToTaker() {
            return EmailTemplateService
                .sendEmailTemplate('booking-checkout-taker', {
                    user: taker,
                    listing: listing,
                    booking: startBooking,
                    owner: owner,
                    assessment: assessment,
                    conversation: conversation
                })
                .catch(err => {
                    // not critical
                    logger.error({ err: err }, "send email booking checkout to taker");
                });
        }

        function sendEmailBookingCheckoutToOwner() {
            return EmailTemplateService
                .sendEmailTemplate('booking-checkout-owner', {
                    user: owner,
                    listing: listing,
                    booking: startBooking,
                    taker: taker,
                    assessment: assessment,
                    newAssessment: newAssessment,
                    conversation: conversation
                })
                .catch(err => {
                    // critical since contains signToken
                    logger.error({ err: err }, "send email booking checkout to owner");

                    throw err;
                });
        }

        function sendSmsBookingPendingToOwner() {
            if (! owner.phoneCheck) {
                return;
            }

            return SmsTemplateService
                .sendSmsTemplate('booking-pending-owner', {
                    user: owner,
                    startBooking,
                })
                .catch(err => {
                    // not critical since email must be sent anyway
                    logger.error({ err: err }, "send sms pending booking to owner");
                });
        }

        function sendEmailListingReturnToTaker() {
            return EmailTemplateService
                .sendEmailTemplate('listing-return-taker', {
                    user: taker,
                    listing: listing,
                    booking: endBooking,
                    owner: owner,
                    assessment: assessment,
                    conversation: conversation
                })
                .catch(err => {
                    logger.error({ err: err }, "send email booking return to taker");
                });
        }

        function sendEmailListingReturnToOwner() {
            return EmailTemplateService
                .sendEmailTemplate('listing-return-owner', {
                    user: owner,
                    listing: listing,
                    booking: endBooking,
                    taker: taker,
                    assessment: assessment,
                    conversation: conversation
                })
                .catch(err => {
                    logger.error({ err: err }, "send email booking return to owner");
                });
        }
    }
}
