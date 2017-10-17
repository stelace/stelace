/**
* UserXTag.js
*
* @description :: Matchmaking between users searching items and potentiel owners relies on this model
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        userId: {
            type: "integer",
            index: true
        },
        tagId: {
            type: "integer",
            index: true
        }
    }

};

