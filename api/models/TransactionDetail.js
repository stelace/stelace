/**
* TransactionDetail.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        transactionId: {
            type: "integer",
            index: true
        },
        credit: {
            type: "float",
            defaultsTo: 0
        },
        debit: {
            type: "float",
            defaultsTo: 0
        },
        payment: {
            type: "float",
            defaultsTo: 0
        },
        cashing: {
            type: "float",
            defaultsTo: 0
        },
        label: "string"
    }

};

