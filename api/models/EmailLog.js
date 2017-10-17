/**
* EmailLog.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        userId: {
            type: "integer",
            index: true
        },
        fromEmail: "string",
        fromName: "string",
        toEmail: "string",
        toName: "string",
        replyTo: "string",
        specificTemplateName: { // templateName can be a generic template
            type: "string",
            size: 191,
            maxLength: 191,
            index: true
        },
        templateName: "string",
        subject: "string",
        data: "json",
        tags: "array",
        sentDate: "string",
        status: "string",
        mandrillMessageId: {
            type: "string",
            index: true,
            size: 191,
            maxLength: 191
        },
        sparkpostTransmissionId: {
            type: "string",
            index: true,
            size: 191,
            maxLength: 191,
        },
        html: 'text',
    }

};
