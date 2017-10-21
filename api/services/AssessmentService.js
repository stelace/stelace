/*
    global Assessment, AssessmentGamificationService, AssessmentService, Booking, Conversation,
    EmailTemplateService, Item, ListingHistoryService, SmsTemplateService, User
 */

module.exports = {

    findAssessments,
    createAssessment,
    updateAssessment,
    signAssessment,

};

const moment = require('moment');

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
        throw new NotFoundError();
    }
    if (userId && ! Conversation.isPartOfConversation(conversation, userId)) {
        throw new ForbiddenError();
    }

    var error;

    if (! conversation.itemId) {
        error = new Error("Conversation must have an itemId");
        error.conversationId = conversation.id;
        throw error;
    }

    const listingHistories = await ListingHistoryService.getListingHistories([conversation.itemId]);
    const listingHistory = listingHistories[conversation.itemId];

    var inputAssessment;
    var outputAssessment;
    var beforeInputAssessment;
    var beforeOutputAssessment;

    var manualFetchInput = false;

    var assessments = listingHistory.getAssessments();

    if (conversation.inputAssessmentId) {
        inputAssessment = _.find(assessments, { id: conversation.inputAssessmentId });

        // item journey doens't take into account bookings that isn't validated and confirmed (pre-booking)
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
 * @param  {string} [args.stateFields.workingLevel]
 * @param  {string} [args.stateFields.cleanlinessLevel]
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
        "workingLevel",
        "cleanlinessLevel",
        "comment",
        "commentDiff"
    ];
    var createAttrs = _.pick(stateFields, filteredStateAttrs);

    return Promise.coroutine(function* () {
        if (! booking
            || ! _.includes(["start", "end"], type)
        ) {
            throw new BadRequestError();
        }

        if (typeof beforeAssessment === "undefined") {
            beforeAssessment = yield Assessment.getLastSigned(booking.itemId);
        } else if (beforeAssessment.itemId !== booking.itemId) {
            throw new BadRequestError("the before assessment and booking don't match on item id");
        }

        if (beforeAssessment && ! stateFields) {
            _.assign(createAttrs, Assessment.getPrefilledStateFields(beforeAssessment));
        }

        createAttrs.itemId   = booking.itemId;
        createAttrs.itemMode = booking.itemMode;
        createAttrs.ownerId  = booking.ownerId;
        createAttrs.takerId  = booking.bookerId;

        _.assign(createAttrs, Assessment.getBookingState(booking, type));

        var snapshots = yield Assessment.getSnapshots(createAttrs);
        _.assign(createAttrs, Assessment.getSnapshotsIds(snapshots));

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
        "workingLevel",
        "cleanlinessLevel",
        "comment",
        "commentDiff"
    ];

    updateAttrs = _.pick(updateAttrs, filteredAttrs);

    return Promise.coroutine(function* () {
        if ((updateAttrs.workingLevel && ! _.contains(Assessment.get("workingLevels"), updateAttrs.workingLevel))
            || (updateAttrs.cleanlinessLevel && ! _.contains(Assessment.get("cleanlinessLevels"), updateAttrs.cleanlinessLevel))
        ) {
            throw new BadRequestError();
        }

        var assessment = yield Assessment.findOne({ id: assessmentId });
        if (! assessment) {
            throw new NotFoundError();
        }
        // the user that can edit assessment is the one that gives the item
        if (Assessment.getRealGiverId(assessment) !== userId) {
            throw new ForbiddenError();
        }
        if (assessment.signedDate) {
            throw new ForbiddenError("assessment signed");
        }

        return yield Assessment.updateOne(assessment.id, updateAttrs);
    })();
}

/**
 * sign assessment with the token
 * @param  {number} assessmentId
 * @param  {string} signToken
 * @param  {number} userId
 * @param  {object} logger
 * @param  {object} [req] - useful for gamification
 * @return {Promise<object>} signed assessment
 */
async function signAssessment(assessmentId, signToken, userId, logger, req) {
    const now = moment().toISOString();

    let assessment = await Assessment.findOne({ id: assessmentId });
    if (! assessment) {
        throw new NotFoundError();
    }
    // the user that can sign assessment is the one that gives the item
    if (Assessment.getRealGiverId(assessment) !== userId) {
        throw new ForbiddenError();
    }
    if (! assessment.workingLevel
        || ! assessment.cleanlinessLevel
    ) {
        throw new BadRequestError('assessment missing required fields');
    }
    if (assessment.signedDate) {
        throw new BadRequestError('assessment already signed');
    }
    if (assessment.signToken !== signToken) {
        const error = new BadRequestError('wrong token');
        error.expose = true;
        throw error;
    }

    let startBooking;
    let outputAssessment;

    if (assessment.startBookingId) {
        startBooking = await Booking.findOne({ id: assessment.startBookingId });
        if (! startBooking) {
            const error = new Error('Assessment start booking not found');
            error.assessmentId = assessment.id;
            error.bookingId    = assessment.startBookingId;
            throw error;
        }

        // create an assessment only if this is a process with two steps
        const { ASSESSMENTS } = startBooking.listingType.properties;
        if (ASSESSMENTS === 'TWO_STEPS') {
            outputAssessment = await createOutputAssessment(assessment, startBooking);
        }
    }

    const data = {
        assessment: assessment,
        newAssessment: outputAssessment,
        logger: logger
    };

    await _sendAssessmentEmailsSms(data);

    if (assessment.endBookingId) {
        await setEndOfBooking(assessment, now);
    }

    const updateAttrs = {
        signedDate: now
    };

    // refresh snapshots to have the last version before freezing the assessment
    const snapshots = await Assessment.getSnapshots(assessment);
    _.assign(updateAttrs, Assessment.getSnapshotsIds(snapshots));

    assessment = await Assessment.updateOne(assessment.id, updateAttrs);

    AssessmentGamificationService.afterAssessmentSigned(assessment, logger, req);

    return assessment;
}

function createOutputAssessment(assessment, startBooking) {
    return Promise.coroutine(function* () {
        var outputAssessment = yield Assessment.findOne({
            itemId: assessment.itemId,
            takerId: assessment.takerId,
            ownerId: assessment.ownerId,
            endBookingId: assessment.startBookingId
        });

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

function setEndOfBooking(assessment, now) {
    return Promise.coroutine(function* () {
        var endBooking = yield Booking.findOne({ id: assessment.endBookingId });

        if (! endBooking) {
            var error = new Error("Assessment end booking not found");
            error.assessmentId = assessment.id;
            error.bookingId    = assessment.endBookingId;
            throw error;
        }

        return yield Booking.updateBookingEndState(endBooking, now);
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
                throw new BadRequestError("missing args");
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
                    Item.findOne({ id: assessment.itemId }),
                    assessment.startBookingId ? Booking.findOne({ id: assessment.startBookingId }) : null,
                    assessment.endBookingId ? Booking.findOne({ id: assessment.endBookingId }) : null,
                    User.findOne({ id: assessment.ownerId }),
                    User.findOne({ id: assessment.takerId }),
                    getConversation(assessment)
                ];
            })
            .spread((item, startBooking, endBooking, owner, taker, conversation) => {
                if (! item
                    || ! owner
                    || ! taker
                    || (assessment.startBookingId && ! startBooking)
                    || (assessment.endBookingId && ! endBooking)
                ) {
                    var error = new Error("Booking confirm missing references");
                    if (! item) {
                        error.itemId = assessment.itemId;
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
                data.item          = item;
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
            .findOne({
                or: [
                    { outputAssessmentId: assessment.id },
                    { inputAssessmentId: assessment.id }
                ]
            })
            .sort({ createdDate: -1 });
    }

    function sendEmails(data) {
        var logger        = data.logger;
        var assessment    = data.assessment;
        var newAssessment = data.newAssessment;
        var item          = data.item;
        var startBooking  = data.startBooking;
        var endBooking    = data.endBooking;
        var owner         = data.owner;
        var taker         = data.taker;
        var conversation  = data.conversation;

        return Promise
            .resolve()
            .then(() => {
                // return;

                // Classic : send booking-checkout emails to taker and owner if startBookingId, or item-return emails to owner and taker if endBookingId
                if (item.mode === "classic") {
                    if (assessment.startBookingId) {
                        if (! newAssessment && ! Booking.isNoTime(startBooking)) {
                            throw new BadRequestError("newAssessment missing");
                        }

                        return Promise.all([
                            sendEmailClassicBookingCheckoutToTaker(),
                            sendEmailClassicBookingCheckoutToOwner(),
                            sendSmsClassicBookingPendingToOwner()
                        ]);
                    } else if (assessment.endBookingId) {
                        return Promise.all([
                            sendEmailClassicItemReturnToTaker(),
                            sendEmailClassicItemReturnToOwner()
                        ]);
                    }
                }
            });



        function sendEmailClassicBookingCheckoutToTaker() {
            return EmailTemplateService
                .sendEmailTemplate('booking-checkout-taker', {
                    user: taker,
                    item: item,
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

        function sendEmailClassicBookingCheckoutToOwner() {
            return EmailTemplateService
                .sendEmailTemplate('booking-checkout-owner', {
                    user: owner,
                    item: item,
                    booking: startBooking,
                    booker: taker,
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

        function sendSmsClassicBookingPendingToOwner() {
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

        function sendEmailClassicItemReturnToTaker() {
            return EmailTemplateService
                .sendEmailTemplate('item-return-taker', {
                    user: taker,
                    item: item,
                    booking: endBooking,
                    owner: owner,
                    assessment: assessment,
                    conversation: conversation
                })
                .catch(err => {
                    logger.error({ err: err }, "send email booking return to taker");
                });
        }

        function sendEmailClassicItemReturnToOwner() {
            return EmailTemplateService
                .sendEmailTemplate('item-return-owner', {
                    user: owner,
                    item: item,
                    booking: endBooking,
                    booker: taker,
                    assessment: assessment,
                    conversation: conversation
                })
                .catch(err => {
                    logger.error({ err: err }, "send email booking return to owner");
                });
        }
    }
}
