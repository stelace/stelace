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

const createError = require('http-errors');

async function find(req, res) {
    const conversationId = req.param('conversationId');
    const access = 'self';

    try {
        const hashAssessments = await AssessmentService.findAssessments(conversationId, req.user.id);

        hashAssessments.inputAssessment        = Assessment.expose(hashAssessments.inputAssessment, access);
        hashAssessments.outputAssessment       = Assessment.expose(hashAssessments.outputAssessment, access);
        hashAssessments.beforeInputAssessment  = Assessment.exposeBeforeAssessment(hashAssessments.beforeInputAssessment);
        hashAssessments.beforeOutputAssessment = Assessment.exposeBeforeAssessment(hashAssessments.beforeOutputAssessment);

        res.json(hashAssessments);
    } catch (err) {
        res.sendError(err);
    }
}

async function findOne(req, res) {
    const id = req.param('id');
    let access = 'others';

    try {
        const assessment = await Assessment.findOne({ id });
        if (! assessment) {
            throw createError(404);
        }

        if (Assessment.isAccessSelf(assessment, req.user)) {
            access = 'self';
        }

        res.json(Assessment.expose(assessment, access));
    } catch (err) {
        res.sendError(err);
    }
}

function create(req, res) {
    return res.forbidden();
}

async function update(req, res) {
    const id = req.param('id');
    const attrs = req.allParams();
    const access = 'self';

    try {
        const assessment = await AssessmentService.updateAssessment(id, attrs, req.user.id);

        res.json(Assessment.expose(assessment, access));
    } catch (err) {
        res.sendError(err);
    }
}

function destroy(req, res) {
    return res.forbidden();
}

async function sign(req, res) {
    var id        = req.param('id');
    var signToken = req.param('signToken');
    var access    = 'self';

    if (! signToken) {
        return res.badRequest();
    }

    try {
        const assessment = await AssessmentService.signAssessment(id, signToken, {
            userId: req.user.id,
            logger: req.logger,
            req,
        });

        res.json(Assessment.expose(assessment, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function last(req, res) {
    var listingId = req.param('listingId');
    var access = 'others';

    if (! listingId) {
        return res.badRequest();
    }

    try {
        const assessment = await Assessment.getLastSigned(listingId);

        if (Assessment.isAccessSelf(assessment, req.user)) {
            access = 'self';
        }

        res.json(Assessment.expose(assessment, access));
    } catch (err) {
        res.sendError(err);
    }
}
