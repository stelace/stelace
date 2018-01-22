/* global EmailTracking, EmailTrackingService, ToolsService */

/**
 * EmailTrackingController
 *
 * @description :: Server-side logic for managing emailtrackings
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

module.exports = {

    find: find,
    findOne: findOne,
    create: create,
    update: update,
    destroy: destroy,

    sparkpost,
    mandrill,

};

const _ = require('lodash');
const Promise = require('bluebird');

function find(req, res) {
    return res.forbidden();
}

function findOne(req, res) {
    return res.forbidden();
}

function create(req, res) {
    return res.forbidden();
}

async function sparkpost(req, res) {
    if (req.method === 'HEAD') {
        return res.ok();
    }
    if (req.method !== "POST" || ! req.body) {
        return res.forbidden();
    }

    const batchId = req.headers['x-messagesystems-batch-id'];

    const credentials = sails.config.sparkpost.webhook;
    const authorization = req.headers['authorization'];
    const sparkpostEvents = req.body;

    if (!batchId
     || (!authorization || !EmailTrackingService.isSparkpostRequest(authorization, credentials))
     || (!sparkpostEvents || !_.isArray(sparkpostEvents))
    ) {
        return res.forbidden();
    }

    const savedEvents = await EmailTracking.find({ sparkpostBatchId: batchId }); // already saved events for this batch
    const indexedSavedEvents = _.indexBy(savedEvents, 'sparkpostMessageId');

    const emailTrackings = [];

    try {
        await Promise.each(sparkpostEvents, sparkpostEvent => {
            const event = _.values(sparkpostEvent.msys)[0];

            // already saved this event, skip it
            if (indexedSavedEvents[event.message_id]) {
                return;
            }

            return EmailTrackingService.saveSparkpostEvent(event, batchId)
                .then(emailTracking => {
                    emailTrackings.push(emailTracking);
                });
        });

        res.ok();
    } catch(e) {
        req.logger({ err: e }, 'Sparkpost webhook events saving');
        res.serverError();
    }

    try {
        await EmailTrackingService.processSparkpostEvents(emailTrackings);
    } catch (e) {
        req.logger({ err: e }, 'Sparkpost webhook processing events');
    }
}

function mandrill(req, res) {
    if (req.method === "HEAD") {
        return res.ok();
    }
    if (req.method !== "POST" || ! req.body) {
        return res.forbidden();
    }

    var mandrillSignatureHeader = req.headers["x-mandrill-signature"];

    if (! EmailTrackingService.isMandrillRequest(req.body, mandrillSignatureHeader)) {
        req.logger.warn({ mandrillSignature: mandrillSignatureHeader }, "Bad Mandrill header");
        return res.badRequest();
    }

    var mandrillEvents = req.body.mandrill_events;
    mandrillEvents     = ToolsService.getParsedJson(mandrillEvents);
    if (! mandrillEvents) {
        return res.badRequest();
    }

    return Promise.coroutine(function* () {
        yield EmailTrackingService.saveEvents(mandrillEvents, req.logger);

        var mandrillMessageIds = EmailTrackingService.getMandrillMessageIds(mandrillEvents);

        yield EmailTrackingService.saveEventsContent(mandrillMessageIds, req.logger);

        res.ok();
    })()
    .catch(res.sendError);
}

function update(req, res) {
    return res.forbidden();
}

function destroy(req, res) {
    return res.forbidden();
}

