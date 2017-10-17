/**
* Reward.js
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
        type: "string",
        triggerType: "string",
        triggerId: "string",
        targetType: "string",
        targetId: "integer",
        reference: "json",
        usedDate: "string"
    }

};

