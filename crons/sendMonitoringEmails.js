/* global Assessment, Booking, BootstrapService, EmailTemplateService, Listing, Location, LoggerService, MonitoringService */

var Sails  = require('sails');
var moment = require('moment');

var cronTaskName = "sendMonitoringEmails";

global._       = require('lodash');
global.Promise = require('bluebird');

Sails.load({
    models: {
        migrate: "safe"
    },
    hooks: {
        grunt: false,
        sockets: false,
        pubsub: false
    }
}, function (err, sails) {
    if (err) {
        console.log("\n!!! Fail cron task: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    var logger = LoggerService.getLogger("cron");
    logger = logger.child({ cronTaskName: cronTaskName });

    logger.info("Start cron");

    var now = moment().toISOString();

    var notifyEmails = [];

    return Promise
        .resolve()
        .then(() => {
            var periodType = "day";
            var period = getPeriodDates(now, periodType);

            return getData(period.fromDate, period.toDate, periodType, logger)
                .then(data => sendEmails(data, periodType, notifyEmails, logger))
                .catch(err => {
                    logger.error({ err: err }, "Fail sending daily email");
                });
        })
        .then(() => {
            if (! isStartWeek(now)) {
                return;
            }

            var periodType = "week";
            var period = getPeriodDates(now, periodType);

            return getData(period.fromDate, period.toDate, periodType, logger)
                .then(data => sendEmails(data, periodType, notifyEmails, logger))
                .catch(err => {
                    logger.error({ err: err }, "Fail sending weekly email");
                });
        })
        .then(() => {
            if (! isStartMonth(now)) {
                return;
            }

            var periodType = "month";
            var period = getPeriodDates(now, periodType);

            return getData(period.fromDate, period.toDate, periodType, logger)
                .then(data => sendEmails(data, periodType, notifyEmails, logger))
                .catch(err => {
                    logger.error({ err: err }, "Fail sending monthly email");
                });
        })
        .catch(err => {
            logger.error({ err: err });
        })
        .finally(() => {
            logger.info("End cron");
            sails.lowerSafe();
        });



    function isStartWeek(date) {
        return moment(date).day() === 1;
    }

    function isStartMonth(date) {
        return moment(date).date() === 1;
    }

    function getPeriodDates(date, periodType) {
        var m          = moment(date);
        var formatDate = "YYYY-MM-DD";

        var toDate = m.format(formatDate);
        var fromDate;

        if (periodType === "month") {
            fromDate = m.month(m.month() - 1).format(formatDate);
        } else if (periodType === "week") {
            fromDate = m.subtract(7, "d").format(formatDate);
        } else { // periodType === "day"
            fromDate = m.subtract(1, "d").format(formatDate);
        }

        return {
            fromDate: fromDate,
            toDate: toDate
        };
    }

    function getData(fromDate, toDate, periodType, logger) {
        return Promise
            .resolve()
            .then(() => {
                return Promise.props({
                    fromDate: fromDate,
                    toDate: toDate,
                    newUsers: getNewUsers(fromDate, toDate),
                    newLinks: getNewLinks(fromDate, toDate),
                    newListings: getNewListings(fromDate, toDate),
                    listingsToValidate: getListingsToValidate(fromDate, toDate),
                    acceptedBookings: getAcceptedBookings(fromDate, toDate),
                    bookingsToAccept: getBookingsToAccept(fromDate, toDate),
                    oldBookingsToAccept: getOldBookingsToAccept(fromDate, toDate),
                    preBookingsToAccept: getPreBookingsToAccept(fromDate, toDate),
                    unsignedAssessments: getUnsignedAssessments(fromDate, toDate, logger),
                    revenue: getRevenue(fromDate, toDate)
                });
            });



        function getNewUsers(fromDate, toDate) {
            return MonitoringService
                .getUsers({
                    fromDate: fromDate,
                    toDate: toDate
                })
                .catch(err => {
                    logger.error({ err: err }, "Fail getting new users");
                    return null;
                });
        }

        function getNewLinks(fromDate, toDate) {
            return MonitoringService
                .getLinks({
                    fromDate: fromDate,
                    toDate: toDate
                })
                .catch(err => {
                    logger.error({ err: err }, "Fail getting new links");
                    return null;
                });
        }

        function getNewListings(fromDate, toDate) {
            return MonitoringService
                .getListings({
                    fromDate: fromDate,
                    toDate: toDate
                })
                .catch(err => {
                    logger.error({ err: err }, "Fail getting new listings");
                    return null;
                });
        }

        function getListingsToValidate(fromDate, toDate) {
            return MonitoringService
                .getListings({
                    fromDate: fromDate,
                    toDate: toDate,
                    validated: false
                })
                .then(listings => _populateListings(listings))
                .catch(err => {
                    logger.error({ err: err }, "Fail getting listings to validate");
                    return null;
                });
        }

        function getAcceptedBookings(fromDate, toDate) {
            return MonitoringService
                .getPaidBookings({
                    fromDate: fromDate,
                    toDate: toDate,
                    accepted: true,
                })
                .catch(err => {
                    logger.error({ err: err }, "Fail getting accepted bookings");
                    return null;
                });
        }

        function getBookingsToAccept(fromDate, toDate) {
            var formatDate = "YYYY-MM-DD";

            return MonitoringService
                .getPaidBookings({
                    fromDate: moment(toDate).subtract(2, "d").format(formatDate),
                    toDate: moment(toDate).subtract(1, "d").format(formatDate),
                    accepted: false,
                })
                .then(bookings => _populateBookings(bookings))
                .catch(err => {
                    logger.error({ err: err }, "Fail getting bookings to accept");
                    return null;
                });
        }

        function getOldBookingsToAccept(fromDate, toDate) {
            var formatDate = "YYYY-MM-DD";

            return MonitoringService
                .getPaidBookings({
                    toDate: moment(toDate).subtract(2, "d").format(formatDate),
                    accepted: false,
                })
                .then(bookings => _populateBookings(bookings))
                .catch(err => {
                    logger.error({ err: err }, "Fail getting old bookings to accept");
                    return null;
                });
        }

        function getRevenue(fromDate, toDate) {
            return MonitoringService
                .getRevenue({
                    fromDate: fromDate,
                    toDate: toDate
                })
                .catch(err => {
                    logger.error({ err: err }, "Fail getting revenue");
                    return null;
                });
        }

        function getPreBookingsToAccept(fromDate, toDate) {
            var formatDate = "YYYY-MM-DD";

            return MonitoringService
                .getPreBookingsToAccept({
                    fromDate: moment(toDate).subtract(2, "d").format(formatDate),
                    toDate: moment(toDate).subtract(1, "d").format(formatDate)
                })
                .then(bookings => _populateBookings(bookings))
                .catch(err => {
                    logger.error({ err: err }, "Fail getting pre-bookings to accept");
                    return null;
                });
        }

        function getUnsignedAssessments(fromDate, toDate, logger) {
            var formatDate = "YYYY-MM-DD";

            return MonitoringService
                .getUnsignedAssessments()
                .then(resultAssessments => {
                    var assessments = resultAssessments.assessments;

                    return [
                        assessments,
                        MonitoringService.getAssessmentsDueDates(assessments, logger)
                    ];
                })
                .spread((assessments, hashAssessments) => {
                    var limitDate = moment(toDate).subtract(2, "d").format(formatDate);

                    assessments = _.reduce(assessments, (memo, assessment) => {
                        var obj = hashAssessments[assessment.id];

                        if (obj && obj.dueDate === limitDate) {
                            assessment.booking = obj.booking;
                            assessment.dueDate = obj.dueDate;
                            memo.push(assessment);
                        }

                        return memo;
                    }, []);

                    return [
                        assessments,
                        Listing.find({ id: _.pluck(assessments, "listingId") })
                    ];
                })
                .spread((assessments, listings) => {
                    var indexedListings = _.indexBy(listings, "id");

                    _.forEach(assessments, assessment => {
                        var listing = indexedListings[assessment.listingId];
                        if (listing) {
                            assessment.listing = listing;
                        }
                    });

                    return assessments;
                })
                .catch(err => {
                    logger.error({ err: err }, "Fail getting unsigned assessments");
                    return null;
                });
        }

        function _populateListings(listings) {
            var locationsIds = _.reduce(listings, (memo, listing) => {
                if (listing.locations && listing.locations.length) {
                    memo.push(listing.locations[0]);
                }
                return memo;
            }, []);

            return Location
                .find({ id: locationsIds })
                .then(locations => {
                    var indexedLocations = _.indexBy(locations, "id");

                    return _.reduce(listings, (memo, listing) => {
                        if (listing.locations && listing.locations.length) {
                            var location = indexedLocations[listing.locations[0]];
                            listing.location = location;
                        }
                        memo.push(listing);
                        return memo;
                    }, []);
                });
        }

        function _populateBookings(bookings) {
            return Listing
                .find({ id: _.pluck(bookings, "listingId") })
                .then(listings => {
                    var indexedListings = _.indexBy(listings, "id");

                    return _.reduce(bookings, (memo, booking) => {
                        var listing = indexedListings[booking.listingId];
                        if (listing) {
                            booking.listing = listing;
                            memo.push(booking);
                        }
                        return memo;
                    }, []);
                });
        }
    }

    function sendEmails(data, periodType, notifyEmails, logger) {
        var errorMsg          = "Erreur";
        var previewContent    = "";
        var leadingContent    = "";
        var content           = "";
        var formatDateDisplay = "DD/MM/YYYY";
        var subject;
        var periodLabel;
        var reportSuffix;

        if (periodType === "month") {
            periodLabel = moment(data.fromDate).format("MMMM YYYY");
            reportSuffix = `mensuel ${periodLabel}`;
        } else if (periodType === "week") {
            periodLabel = moment(data.fromDate).format(formatDateDisplay)
                + " - " + moment(data.toDate).subtract(1, "d").format(formatDateDisplay);
            reportSuffix = `hebdo. ${periodLabel}`;
        } else { // periodType === "day"
            periodLabel = moment(data.fromDate).format(formatDateDisplay);
            reportSuffix = `du ${periodLabel}`;
        }

        subject = `Rapport ${reportSuffix}`;

        var nbNewUsers    = data.newUsers ? data.newUsers.length : null;
        var nbNewListings = data.newListings ? data.newListings.length : null;
        var nbNewBookings = data.acceptedBookings
            ? data.acceptedBookings.length
            : null;

        previewContent += `${nbNewUsers !== null ? nbNewUsers : errorMsg} ${pluralize(nbNewUsers, "inscrit")}`;
        previewContent += ` - ${nbNewListings !== null ? nbNewListings : errorMsg} ${pluralize(nbNewListings, "objet")}`;
        previewContent += ` - ${nbNewBookings !== null ? nbNewBookings : errorMsg} ${pluralize(nbNewBookings, "réservation")}`;

        leadingContent += `Voici le rapport d'activité ${reportSuffix}&nbsp;:<br>`;
        leadingContent += previewContent;
        leadingContent += `&nbsp;;), bonne lecture !`;

        content += `<h3>Membres</h3>`;

        ///////////////
        // NEW USERS //
        ///////////////
        content += `Nouveaux inscrits&nbsp;: `;
        if (data.newUsers) {
            content += data.newUsers.length;
        } else {
            content += errorMsg;
        }
        content += `<br>`;

        ///////////////
        // NEW LINKS //
        ///////////////
        content += `Nouveaux inscrits dont parrainés&nbsp;: `;
        if (data.newLinks) {
            var validatedLinks = _.filter(data.newLinks, link => link.validated);
            var emailLinks     = _.filter(data.newLinks, link => link.source === "email");
            content += `${validatedLinks.length} (${emailLinks.length} ${pluralize(emailLinks.length, "email")})`;
        } else {
            content += errorMsg;
        }
        content += `<br>`;

        content += `<br><h3>Objets</h3>`;

        //////////////////
        // NEW LISTINGS //
        //////////////////
        content += `Objets ajoutés&nbsp;: `;
        if (data.newListings) {
            content += data.newListings.length;
        } else {
            content += errorMsg;
        }
        content += `<br>`;

        //////////////////////////
        // LISTINGS TO VALIDATE //
        //////////////////////////
        if (periodType === "day") {
            content += `Objets à valider&nbsp;: `;
            if (data.listingsToValidate) {
                content += data.listingsToValidate.length;

                if (data.listingsToValidate.length) {
                    content += `<ul style="margin: 0;">`;
                    _.forEach(data.listingsToValidate, listing => {
                        content += `<li>`;
                        content += `User n°${listing.ownerId} - ${listing.name} [${listing.id}] - `;

                        if (listing.location) {
                            content += displayLocation(listing.location);
                        } else {
                            content += `Pas de lieu favori trouvé`;
                        }
                        content += `</li>`;
                    });
                    content += `</ul>`;
                }
            } else {
                content += errorMsg;
            }
            content += `<br>`;
        }

        content += `<br><h3>Réservations</h3>`;


        ///////////////////////
        // ACCEPTED BOOKINGS //
        ///////////////////////
        content += `Réservations&nbsp;: `;
        if (data.acceptedBookings) {
            content += data.acceptedBookings.length;
        } else {
            content += errorMsg;
        }
        content += `<br>`;

        ////////////////////////
        // BOOKINGS TO ACCEPT //
        ////////////////////////
        if (periodType === "day") {
            content += `Réservations non acceptées&nbsp;: `;
            if (data.bookingsToAccept) {
                content += data.bookingsToAccept.length;

                if (data.bookingsToAccept.length) {
                    content += `<ul style="margin: 0;">`;
                    _.forEach(data.bookingsToAccept, booking => {
                        var startDate;
                        var endDate;

                        if (! Booking.isNoTime(booking)) {
                            startDate = moment(booking.startDate).format(formatDateDisplay);
                            endDate   = moment(booking.endDate).format(formatDateDisplay);
                        }

                        content += `<li>`;
                        content += `
                            Booking n°${booking.id}
                            - User n°${booking.ownerId} -
                        `;

                        if (booking.listing) {
                            content += `${booking.listing.name} [${booking.listingId}]`;
                        } else {
                            content += `Objet introuvable [${booking.listingId}]`;
                        }

                        content += ` - ${booking.takerPrice}€`;
                        if (Booking.isNoTime(booking)) {
                            content += ` - Vente`;
                        } else {
                            content += ` - du ${startDate} au ${endDate}`;
                        }
                        content += `</li>`;
                    });
                    content += `</ul>`;
                }
            } else {
                content += errorMsg;
            }
            content += `<br>`;
        }

        ////////////////////////////
        // OLD BOOKINGS TO ACCEPT //
        ////////////////////////////
        if (periodType === "day") {
            if (data.oldBookingsToAccept
             && data.oldBookingsToAccept.length
            ) {
                content += `Anciennes réservations non acceptées&nbsp;: `;
                content += `<strong>${data.oldBookingsToAccept.length}</strong>`;

                content += `<ul style="margin: 0;">`;
                _.forEach(data.oldBookingsToAccept, booking => {
                    var startDate;
                    var endDate;

                    if (! Booking.isNoTime(booking)) {
                        startDate = moment(booking.startDate).format(formatDateDisplay);
                        endDate   = moment(booking.endDate).format(formatDateDisplay);
                    }

                    var paidDate = moment(booking.paidDate).format(formatDateDisplay);

                    content += `<li>`;
                    content += `
                        Booking n°${booking.id} payé le ${paidDate}
                        - User n°${booking.ownerId} -
                    `;

                    if (booking.listing) {
                        content += `${booking.listing.name} [${booking.listingId}]`;
                    } else {
                        content += `Objet introuvable [${booking.listingId}]`;
                    }

                    content += ` - ${booking.takerPrice}€`;
                    if (Booking.isNoTime(booking)) {
                        content += ` - Vente`;
                    } else {
                        content += ` - du ${startDate} au ${endDate}`;
                    }
                    content += `</li>`;
                });
                content += `</ul><br>`;
            }
        }

        var prebookingsToAccept = data.preBookingsToAccept;

        if (periodType === "day") {
            content += `<br><h3>Pré-réservations</h3>`;
        }

        ////////////////////////////
        // PRE-BOOKINGS TO ACCEPT //
        ////////////////////////////
        if (periodType === "day") {
            content += `Pré-réservations en attente d'acceptation&nbsp;: `;

            if (prebookingsToAccept) {
                content += prebookingsToAccept.length;

                if (prebookingsToAccept.length) {
                    content += `<ul style="margin: 0;">`;
                    _.forEach(prebookingsToAccept, booking => {
                        var startDate;
                        var endDate;

                        if (! Booking.isNoTime(booking)) {
                            startDate = moment(booking.startDate).format(formatDateDisplay);
                            endDate   = moment(booking.endDate).format(formatDateDisplay);
                        }

                        content += `<li>`;
                        content += `
                            User n°${booking.ownerId}
                            - Taker n°${booking.takerId} -
                        `;

                        if (booking.listing) {
                            content += `${booking.listing.name} [${booking.listingId}]`;
                        } else {
                            content += `Objet introuvable [${booking.listingId}]`;
                        }

                        content += `
                            - Booking n°${booking.id}
                            - ${booking.takerPrice}€
                        `;

                        if (Booking.isNoTime(booking)) {
                            content += ` - Vente`;
                        } else {
                            content += ` - du ${startDate} au ${endDate}`;
                        }
                        content += `</li>`;
                    });
                    content += `</ul>`;
                }
            } else {
                content += errorMsg;
            }
            content += `<br>`;
        }

        var unsignedAssessments = data.unsignedAssessments;

        if (periodType === "day") {
            content += `<br><h3>États des lieux et commentaires</h3>`;
        }

        //////////////////////////
        // UNSIGNED ASSESSMENTS //
        //////////////////////////
        if (periodType === "day") {
            content += `État des lieux en Classique en attente de signature&nbsp;: `;
            if (unsignedAssessments) {
                content += unsignedAssessments.length;

                if (unsignedAssessments.length) {
                    content += `<ul style="margin: 0;">`;
                    _.forEach(unsignedAssessments, assessment => {
                        var assessmentState = (assessment.startBookingId ? "initial" : "final");

                        content += `<li>`;
                        content += `Assessment n°${assessment.id} ${assessmentState} - `;

                        if (assessment.booking) {
                            content += `Booking n°${assessment.booking.id}`;
                        } else {
                            content += `Booking introuvable`;
                        }

                        content += ` - User n°${Assessment.getRealGiverId(assessment)} - `;

                        if (assessment.listing) {
                            content += `${assessment.listing.name} [${assessment.listingId}]`;
                        } else {
                            content += `Objet introuvable [${assessment.listingId}]`;
                        }
                        content += `</li>`;
                    });
                    content += `</ul>`;
                }
            } else {
                content += errorMsg;
            }
            content += `<br>`;
        }

        content += `<br><h3>Transactions</h3>`;

        /////////////
        // REVENUE //
        /////////////
        var revenueLabels = {};
        if (data.revenue) {
            revenueLabels.booking   = data.revenue.booking;
            revenueLabels.peer2peer = data.revenue.peer2peer;
            revenueLabels.fees      = data.revenue.fees;
        } else {
            revenueLabels.booking   = errorMsg;
            revenueLabels.peer2peer = errorMsg;
            revenueLabels.fees      = errorMsg;
        }
        content += `
            Revenus&nbsp;: ${revenueLabels.booking}€<br>
            Particuliers&nbsp;: ${revenueLabels.peer2peer}€<br>
            Commissions&nbsp;: ${revenueLabels.fees}€
        `;

        var params = {
            specificTemplateName: "monitoring-global-stats",
            templateTags: ["monitoring", "global-stats"],
            subject: subject,
            previewContent: previewContent,
            leadingContent: leadingContent,
            content: content,
            customGoodBye: " ", // not a empty string for test condition
            noSocialBlock: true,
            noCopyEmail: true,
        };

        return Promise
            .resolve(notifyEmails)
            .map(email => {
                var newParams = _.clone(params);
                newParams.email = email;

                return EmailTemplateService
                    .sendGeneralNotificationEmail(newParams)
                    .catch(err => {
                        logger.error({
                            err: err,
                            email: email
                        }, "Fail sending email");
                    });
            });



        function pluralize(nb, str) {
            if (isNaN(nb)) {
                return str;
            }

            return str + (nb > 1 ? "s" : "");
        }

        function displayLocation(location) {
            var result = "";

            if (location.establishment
             || ! location.city
            ) {
                result += location.name;
            } else {
                result += location.city;
            }

            if (location.postalCode) {
                result += ` (${location.postalCode})`;
            } else if (location.department
             && result !== location.department // for ex. Paris
            ) {
                result += ` (${location.department})`;
            }

            return result;
        }
    }

});
