/* global GamificationService, SmsService, Sms, StelaceConfigService, User */

/**
 * SmsController
 *
 * @description :: Server-side logic for managing SMS
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

module.exports = {

    find: find,
    findOne: findOne,
    create: create,
    update: update,
    destroy: destroy,

    sendVerify: sendVerify,
    checkVerify: checkVerify

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

function update(req, res) {
    return res.forbidden();
}

function destroy(req, res) {
    return res.forbidden();
}

function sendVerify(req, res) {
    var filteredAttrs = [
        "to",
        "countryCode"
    ];
    var createAttrs  = _.pick(req.allParams(), filteredAttrs);
    createAttrs.from   = Sms.get("senderId");

    var error;

    if (! createAttrs.to
     || ! createAttrs.countryCode
    ) {
        return res.badRequest();
    }

    // remove leading zeros and prepend countryCode
    var internationalFormatPhone = "" + createAttrs.countryCode + parseInt(createAttrs.to, 10);

    return Promise
        .resolve()
        .then(() => {
            return StelaceConfigService.isFeatureActive('SMS');
        })
        .then(active => {
            if (!active) {
                throw new ForbiddenError('Sms disabled');
            }
        })
        .then(() => {
            if (req.user.phone && req.user.phoneCheck) {
                return;
            }

            // update the user phone only if the phone isn't checked
            return User
                .updateOne(req.user.id, { phone: createAttrs.to })
                .then(u => {
                    req.user.phone = u.phone;
                });
        })
        .then(() => {
            return Sms.findOne({
                userId: req.user.id,
                type: "verify",
                reason: "phoneCheck",
                verifyStatus: "0",
                to: createAttrs.to
            });
        })
        .then(sms => {
            if (sms) {
                return User
                    .updateOne(req.user.id, {
                        phone: createAttrs.to,
                        phoneCheck: true
                    })
                    .then(() => {
                        res.json({
                            verifyId: sms.verifyId,
                            providerStatusCode: sms.providerStatusCode,
                            alreadyChecked: true
                        });
                    });
            } else {
                return getVerifySms()
                    .then(sms => {
                        res.json({
                            verifyId: sms.verifyId,
                            providerStatusCode: sms.providerStatusCode,
                            alreadyChecked: false
                        });
                    });
            }
        })
        .catch(res.sendError);


    function getVerifySms() {
        return SmsService
            .verifyNumber({
                from: createAttrs.from,
                to: internationalFormatPhone
            })
            .then(verifyResponse => {
                if (! verifyResponse) {
                    throw new Error("No response from provider");
                }

                verifyResponse.status = "" + verifyResponse.status;

                // if no success or throttle
                if (! _.contains(["0", "1", "10"], verifyResponse.status)) {
                    error = new Error("Sms verify response fail");
                    error.verifyResponse = verifyResponse;
                    throw error;
                }

                createAttrs.userId             = req.user.id;
                createAttrs.type               = "verify";
                createAttrs.reason             = "phoneCheck";
                createAttrs.verifyId           = verifyResponse.request_id;
                createAttrs.providerStatusCode = verifyResponse.status;
                createAttrs.providerError      = verifyResponse.error_text;

                return Sms.create(createAttrs);
            });
    }
}

function checkVerify(req, res) {
    var checkAttrs = {};

    checkAttrs.request_id = req.param("verifyId");
    checkAttrs.code       = req.param("signCode");

    if (! checkAttrs.request_id
     || ! checkAttrs.code
    ) {
        return res.badRequest();
    }

    return Promise
        .resolve()
        .then(() => {
            return StelaceConfigService.isFeatureActive('SMS');
        })
        .then(active => {
            if (!active) {
                throw new ForbiddenError('Sms disabled');
            }
        })
        .then(() => {
            return Sms.findOne({ verifyId: checkAttrs.request_id });
        })
        .then(sms => {
            if (! sms) {
                throw new Error("Verify not found");
            }

            return [
                sms,
                SmsService.checkVerifyRequest(checkAttrs)
            ];
        })
        .spread((sms, checkVerifyResponse) => {
            checkVerifyResponse.status = "" + checkVerifyResponse.status;

            var updateAttrs = {
                messageId: checkVerifyResponse.event_id,
                price: checkVerifyResponse.price,
                verifyStatus: checkVerifyResponse.status,
                providerError: checkVerifyResponse.error_text,
                updateCount: sms.updateCount + 1
            };

            return [
                Sms.updateOne(sms.id, updateAttrs),
                checkVerifyResponse
            ];
        })
        .spread((sms, checkVerifyResponse) => {
            if (sms.verifyStatus !== "0") {
                return [checkVerifyResponse];
            }

            return User
                .updateOne(req.user.id, {
                    phoneCheck: true,
                    phone: sms.to
                })
                .then(user => {
                    return [
                        checkVerifyResponse,
                        user
                    ];
                });
        })
        .spread((checkVerifyResponse, user) => {
            if (user) {
                GamificationService.checkActions(user, ["PHONE_VALIDATION"], null, req.logger, req);
            }

            res.json({
                verifyStatus: checkVerifyResponse.status,
                providerError: checkVerifyResponse.error_text
            });
        })
        .catch(res.sendError);
}
