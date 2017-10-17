/* global Assessment, Item, ModelSnapshot, PhantomService, PricingService, ToolsService, User */

module.exports = {

    getContractId: getContractId,
    getContractName: getContractName,
    getContractFilepath: getContractFilepath

};

var fs         = require('fs');
var Handlebars = require('handlebars');
var path       = require('path');
var moment     = require('moment');
var uuid       = require('uuid');

Promise.promisifyAll(fs);

function getContractId() {
    return "renting_2015-12-05_V1";
}

function getContractName() {
    return "Convention de location d'objet entre particuliers";
}

function getContractFilepath(booking, userId) {
    return Promise
        .resolve()
        .then(() => {
            return _getData(booking);
        })
        .then(data => {
            return _transformData(data, userId);
        })
        .then(data => {
            return fs
                .readFileAsync(_getContractPath(booking.contractId), "utf8")
                .then(rawHtml => {
                    return [
                        Handlebars.compile(rawHtml),
                        data
                    ];
                });
        })
        .spread((template, data) => {
            var contractContent = template(data);

            var htmlFilepath = path.join(sails.config.tmpDir, uuid.v4() + ".html");

            return fs
                .writeFileAsync(htmlFilepath, contractContent)
                .then(() => htmlFilepath);
        })
        .then(htmlFilepath => {
            var pdfFilepath = path.join(sails.config.tmpDir, uuid.v4() + ".pdf");

            var destroyHtmlFile = () => {
                return fs
                    .unlinkAsync(htmlFilepath)
                    .catch(() => { return; });
            };

            return PhantomService
                .exportToPdf({
                    urlOrFilepath: htmlFilepath,
                    destPath: pdfFilepath
                })
                .then(() => {
                    destroyHtmlFile();
                    return pdfFilepath;
                })
                .catch(err => {
                    destroyHtmlFile();
                    throw err;
                });
        });
}

function _getContractPath(contractId) {
    return path.join(__dirname, "../assets/templates/contracts/" + contractId + ".html");
}

function _getData(booking) {
    return Promise
        .resolve()
        .then(() => {
            return Assessment.find({
                or: [
                    { startBookingId: booking.id },
                    { endBookingId: booking.id }
                ]
            });
        })
        .then(assessments => {
            var initialAssessment = _.last(_.filter(assessments, { startBookingId: booking.id }));
            var finalAssessment   = _.last(_.filter(assessments, { endBookingId: booking.id }));

            var snapshotsIds = [];

            if (initialAssessment) {
                snapshotsIds = [
                    initialAssessment.itemSnapshotId,
                    initialAssessment.ownerSnapshotId,
                    initialAssessment.takerSnapshotId
                ];
                if (initialAssessment.ownerMainLocationSnapshotId) {
                    snapshotsIds.push(initialAssessment.ownerMainLocationSnapshotId);
                }
                if (initialAssessment.takerMainLocationSnapshotId) {
                    snapshotsIds.push(initialAssessment.takerMainLocationSnapshotId);
                }
            }

            var getSnapshots = (snapshotsIds) => {
                return ModelSnapshot
                    .fetch(snapshotsIds)
                    .then(snapshots => {
                        if (snapshotsIds.length !== snapshots.length) {
                            throw new NotFoundError();
                        }

                        return snapshots;
                    });
            };

            var initialAssessmentSigned = (initialAssessment && initialAssessment.signedDate);

            return [
                initialAssessment,
                finalAssessment,
                ! initialAssessmentSigned ? Item.findOne({ id: booking.itemId }) : null,
                ! initialAssessmentSigned ? User.findOne({ id: booking.ownerId }) : null,
                ! initialAssessmentSigned ? User.findOne({ id: booking.bookerId }) : null,
                ! initialAssessmentSigned ? getMainLocation(booking.ownerId) : null,
                ! initialAssessmentSigned ? getMainLocation(booking.bookerId) : null,
                initialAssessment ? getSnapshots(snapshotsIds) : []
            ];
        })
        .spread((initialAssessment, finalAssessment, item, owner, taker, ownerMainLocation, takerMainLocation, snapshots) => {
            var indexedSnapshots = _.indexBy(snapshots, "id");
            var itemSnapshot              = initialAssessment ? indexedSnapshots[initialAssessment.itemSnapshotId] : null;
            var ownerSnapshot             = initialAssessment ? indexedSnapshots[initialAssessment.ownerSnapshotId] : null;
            var takerSnapshot             = initialAssessment ? indexedSnapshots[initialAssessment.takerSnapshotId] : null;
            var ownerMainLocationSnapshot = initialAssessment && initialAssessment.ownerMainLocationSnapshotId ? indexedSnapshots[initialAssessment.ownerMainLocationSnapshotId] : null;
            var takerMainLocationSnapshot = initialAssessment && initialAssessment.takerMainLocationSnapshotId ? indexedSnapshots[initialAssessment.takerMainLocationSnapshotId] : null;

            var data = {};

            data.booking           = booking;
            data.initialAssessment = initialAssessment;
            data.finalAssessment   = finalAssessment;

            // before signin, take the most recent changes
            // after signin, take snapshots
            if (initialAssessment) {
                data.item  = (initialAssessment.signedDate ? itemSnapshot : (item || itemSnapshot));
                data.owner = (initialAssessment.signedDate ? ownerSnapshot : (owner || ownerSnapshot));
                data.taker = (initialAssessment.signedDate ? takerSnapshot : (taker || takerSnapshot));
            } else {
                data.item  = item;
                data.owner = owner;
                data.taker = taker;

                if (! item || ! owner || ! taker) {
                    var error = new Error("Missing references");
                    error.bookingId = booking.id;
                    throw error;
                }
            }

            if (data.owner && data.owner.address) {
                data.ownerMainLocation = data.owner.address;
            } else {
                data.ownerMainLocation = ownerMainLocation || ownerMainLocationSnapshot;
            }

            if (data.taker && data.taker.address) {
                data.takerMainLocation = data.taker.address;
            } else {
                data.takerMainLocation = takerMainLocation || takerMainLocationSnapshot;
            }

            return data;
        });



    function getMainLocation(userId) {
        return Location.findOne({
            userId: userId,
            main: true
        });
    }
}

function _transformData(data, userId) {
    var formatDate     = "DD/MM/YYYY";
    var signFormatDate = "LLL";
    var isOwner        = userId === data.booking.ownerId;
    var isTaker        = userId === data.booking.bookerId;
    var obfuscate      = ! (data.booking.confirmedDate && data.booking.validatedDate);

    // booking date variables are modified so take a snapshot here
    var startDate = data.booking.startDate;
    var endDate   = data.booking.endDate;

    var priceResult = PricingService.getPriceAfterRebateAndFees({ booking: data.booking });

    data.booking.ownerNetIncome = priceResult.ownerNetIncome;

    if (data.initialAssessment) {
        data.initialAssessment.workingLevelString     = Assessment.getAssessmentLevel("working", data.initialAssessment.workingLevel);
        data.initialAssessment.cleanlinessLevelString = Assessment.getAssessmentLevel("cleanliness", data.initialAssessment.cleanlinessLevel);
        if (data.initialAssessment.signedDate) {
            data.initialAssessment.signedDate = moment(data.initialAssessment.signedDate).format(signFormatDate);
        }
    }
    if (data.finalAssessment) {
        data.finalAssessment.workingLevelString     = Assessment.getAssessmentLevel("working", data.finalAssessment.workingLevel);
        data.finalAssessment.cleanlinessLevelString = Assessment.getAssessmentLevel("cleanliness", data.finalAssessment.cleanlinessLevel);
        if (data.finalAssessment.signedDate) {
            data.finalAssessment.signedDate = moment(data.finalAssessment.signedDate).format(signFormatDate);
        }
    }

    data.currentDate = moment().format(formatDate);

    if (data.ownerMainLocation) {
        data.owner.mainLocation = Location.getAddress(data.ownerMainLocation, true);
    }
    if (data.takerMainLocation) {
        data.taker.mainLocation = Location.getAddress(data.takerMainLocation, true);
    }

    data.booking.startDate  = moment(startDate).format(formatDate);
    data.booking.endDate    = moment(endDate).format(formatDate);

    // Obfuscate contact info before booking confirmation and validation
    if (! isOwner && obfuscate) {
        _obfuscateContactInfo("owner", data);
    }
    if (! isTaker && obfuscate) {
        _obfuscateContactInfo("taker", data);
    }

    return data;
}

function _obfuscateContactInfo(userType, data) {
    var lastName = data[userType].lastname;

    data[userType].phone        = ToolsService.obfuscatePhone(data[userType].phone);
    data[userType].email        = ToolsService.obfuscateContactDetails(data[userType].email);
    data[userType].lastname     = ToolsService.obfuscateString(lastName, 1);
    data[userType].mainLocation = ToolsService.obfuscateString(data[userType].mainLocation);
    data[userType].obfuscated   = true;
}
