/* global Assessment, AssessmentService */

/**
 * AssessmentController
 *
 * @description :: Server-side logic for managing assessments
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

module.exports = {

    find: find,
    findOne: findOne,
    create: create,
    update: update,
    destroy: destroy,

    sign: sign,
    last: last

};

function find(req, res) {
    var conversationId = req.param("conversationId");
    var access = "self";

    return Promise.coroutine(function* () {
        var hashAssessments = yield AssessmentService.findAssessments(conversationId, req.user.id);

        hashAssessments.inputAssessment        = Assessment.expose(hashAssessments.inputAssessment, access);
        hashAssessments.outputAssessment       = Assessment.expose(hashAssessments.outputAssessment, access);
        hashAssessments.beforeInputAssessment  = Assessment.exposeBeforeAssessment(hashAssessments.beforeInputAssessment);
        hashAssessments.beforeOutputAssessment = Assessment.exposeBeforeAssessment(hashAssessments.beforeOutputAssessment);

        res.json(hashAssessments);
    })()
    .catch(res.sendError);
}

function findOne(req, res) {
    var id = req.param("id");
    var access = "others";

    return Promise.coroutine(function* () {
        var assessment = yield Assessment.findOne({ id: id });
        if (! assessment) {
            throw new NotFoundError();
        }

        if (Assessment.isAccessSelf(assessment, req.user)) {
            access = "self";
        }

        res.json(Assessment.expose(assessment, access));
    })()
    .catch(res.sendError);
}

function create(req, res) {
    return res.forbidden();
}

function update(req, res) {
    var id = req.param("id");
    var filteredAttrs = [
        "workingLevel",
        "cleanlinessLevel",
        "comment",
        "commentDiff"
    ];
    var updateAttrs = _.pick(req.allParams(), filteredAttrs);
    var access = "self";

    return Promise.coroutine(function* () {
        var assessment = yield AssessmentService.updateAssessment(id, updateAttrs, req.user.id);

        res.json(Assessment.expose(assessment, access));
    })()
    .catch(res.sendError);
}

function destroy(req, res) {
    return res.forbidden();
}

function sign(req, res) {
    var id        = req.param("id");
    var signToken = req.param("signToken");
    var access    = "self";

    if (! signToken) {
        return res.badRequest();
    }

    return Promise.coroutine(function* () {
        var assessment = yield AssessmentService.signAssessment(id, signToken, req.user.id, req.logger, req);

        res.json(Assessment.expose(assessment, access));
    })()
    .catch(res.sendError);
}

function last(req, res) {
    var itemId = req.param("itemId");
    var access = "others";

    if (! itemId) {
        return res.badRequest();
    }

    return Promise.coroutine(function* () {
        var assessment = yield Assessment.getLastSigned(itemId);

        if (Assessment.isAccessSelf(assessment, req.user)) {
            access = "self";
        }

        res.json(Assessment.expose(assessment, access));
    })()
    .catch(res.sendError);
}
