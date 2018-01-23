/* global Assessment, Booking, Location, MathService, ModelSnapshot, PhantomService, TimeService, Transaction, User */

module.exports = {

    getReportData: getReportData,
    getReportName: getReportName,
    getReportFilepath: getReportFilepath

};

var fs         = require('fs');
var Handlebars = require('handlebars');
var path       = require('path');
var moment     = require('moment');
var uuid       = require('uuid');
const _ = require('lodash');
const Promise = require('bluebird');

Promise.promisifyAll(fs);

/**
 * get report data
 * @param  {object} user
 * @param  {number} [year]
 * @return {object} - if year provided, get the report data for this year (result of YearIncomeReport.generateReport())
 *                    otherwise, get hash of reports data indexed by year
 */
function getReportData(user, year) {
    return Promise.coroutine(function* () {
        var now            = moment().toISOString();
        var lastReportYear = getLastReportYear(now);
        var userYear       = moment(user.createdDate).year();
        var reportYear;

        var reportData = {};

        // if the specified year is beyond the last report year
        // or the user is created after the last report year
        if ((year && lastReportYear < year)
         || lastReportYear < userYear
        ) {
            return reportData;
        }

        if (year) {
            reportYear = year;
            reportData[year] = new YearIncomeReport(year);
        } else {
            reportYear = lastReportYear;

            var beginReportYear = 2016;
            var startYear       = Math.max(beginReportYear, userYear);

            _.forEach(_.range(startYear, lastReportYear + 1), year => {
                reportData[year] = new YearIncomeReport(year);
            });
        }

        var bookings = yield Booking.find({
            ownerId: user.id,
            cancellationId: null,
            paidDate: { '!': null },
            acceptedDate: { '!': null }
        });

        // if there is no bookings for this user, stop the fetching process
        if (! bookings.length) {
            return reportData;
        }

        var bookingsIds = _.pluck(bookings, "id");

        // get all dates before the end of the last report year
        var firstDateSuffix = "-01-01T00:00:00.000Z";
        var minDate = `${reportYear}${firstDateSuffix}`;
        var maxDate = `${reportYear + 1}${firstDateSuffix}`;

        var period = {
            '<': maxDate
        };
        if (year) {
            period[">="] = minDate;
        }

        var results = yield Promise.props({
            transactions: Transaction.find({
                bookingId: bookingsIds,
                action: "payout",
                label: "payment",
                executionDate: period
            }),
            assessments: Assessment.find({
                startBookingId: bookingsIds,
                signedDate: period,
                cancellationId: null
            })
        });

        var transactions = results.transactions;
        var assessments  = results.assessments;

        populateReport(reportData, bookings, transactions, assessments);

        return reportData;
    })()
    .then(reportData => {
        reportData = _.reduce(reportData, (memo, yearReport, year) => {
            memo[year] = yearReport.generateReport();
            return memo;
        }, {});

        return year ? reportData[year] : reportData;
    });
}

function populateReport(reportData, bookings, transactions, assessments) {
    var indexedTransactions = _.indexBy(transactions, "bookingId");
    var indexedAssessments  = _.indexBy(assessments, "startBookingId");

    _.forEach(bookings, booking => {
        var isFree = ! booking.takerPrice;
        var bookingYear;
        var bookingDate;
        var transaction;
        var assessment;

        if (isFree) {
            // if booking is free, the date is input assessment date
            assessment  = indexedAssessments[booking.id];
            bookingDate = assessment ? assessment.signedDate : null;
        } else {
            // otherwise the date is the payout execution date (when the owner receives money)
            // so do not include the booking if the payout isn't executed
            transaction = indexedTransactions[booking.id];
            bookingDate = transaction ? transaction.executionDate : null;
        }

        if (bookingDate) {
            bookingYear = moment(bookingDate).year();

            var amount = transaction ? transaction.payoutAmount : 0;
            var mode   = Booking.isNoTime(booking) ? "purchase" : "renting";

            if (reportData[bookingYear]) {
                reportData[bookingYear].addBooking(amount, mode, isFree);
            }
        }
    });
}

function getLastReportYear(now) {
    var lastYear   = moment(now).year() - 1;
    var editedDate = getReportDate(lastYear);

    if (editedDate <= now) {
        return lastYear;
    } else {
        return lastYear - 1;
    }
}

function getReportDate(year) {
    var month      = 1;  // January
    var weekDayNum = 5;  // Friday
    var weekDayNth = 3;  // 3th Friday
    var hour       = 14; // 2PM

    var dates = TimeService.getMonthWeekDays(weekDayNum, year + 1, month);
    return moment(dates[weekDayNth]).hour(hour).toISOString();
}

function YearIncomeReport(year) {
    this.editedDate      = getReportDate(year);
    this.nbTotalBookings = 0;
    this.totalAmount     = 0;
    this.details = {
        renting: {
            nbBookings: 0,
            nbFreeBookings: 0,
            amount: 0
        },
        purchase: {
            nbBookings: 0,
            nbFreeBookings: 0,
            amount: 0
        }
    };
}

YearIncomeReport.prototype.addBooking = function (amount, mode, isFree) {
    this.nbTotalBookings          += 1;
    this.totalAmount              = MathService.roundDecimal(this.totalAmount + amount, 2);
    this.details[mode].nbBookings += 1;
    this.details[mode].amount     = MathService.roundDecimal(this.details[mode].amount + amount, 2);
    if (isFree) {
        this.details[mode].nbFreeBookings += 1;
    }
};

YearIncomeReport.prototype.generateReport = function () {
    return {
        editedDate: this.editedDate,
        nbTotalBookings: this.nbTotalBookings,
        totalAmount: this.totalAmount,
        details: this.details
    };
};

function getReportName(year) {
    return `Récapitulatif des revenus ${year}`;
}

function getReportPath() {
    return path.join(__dirname, "../assets/templates/incomeReports/income_report_2017-02-14_V1.html");
}

function getReportFilepath(user, year) {
    return Promise.coroutine(function* () {
        var data = yield getData(user, year);

        var rawHtml  = yield fs.readFileAsync(getReportPath(), "utf8");
        var template = Handlebars.compile(rawHtml);
        var content  = template(data);

        var htmlFilepath = path.join(sails.config.tmpDir, uuid.v4() + ".html");

        yield fs.writeFileAsync(htmlFilepath, content);

        var pdfFilepath = path.join(sails.config.tmpDir, uuid.v4() + ".pdf");

        try {
            yield PhantomService.exportToPdf({
                urlOrFilepath: htmlFilepath,
                destPath: pdfFilepath,
                options: {
                    header: {
                        height: "2cm",
                        text: getReportHeader()
                    },
                    footer: {
                        height: "2.2cm",
                        text: getReportFooter()
                    }
                }
            });
        } catch (e) {
            throw e;
        } finally {
            fs
                .unlinkAsync(htmlFilepath)
                .catch(() => { return; });
        }

        return pdfFilepath;
    })();



    function getData(user, year) {
        return Promise.coroutine(function* () {
            var editedDate = getReportDate(year);

            var incomeReport = yield getReportData(user, year);

            if (! incomeReport) {
                throw new Error(`No income report available for the year ${year}`);
            }

            var data = incomeReport;

            data.editedDate = moment(editedDate).format("LL");
            data.year       = year;

            var mainLocation = yield Location.findOne({
                userId: user.id,
                main: true
            });

            var results = yield Promise.props({
                ownerSnapshot: getSnapshot("user", user, editedDate),
                mainLocationSnapshot: mainLocation ? getSnapshot("location", mainLocation, editedDate) : null
            });

            var ownerSnapshot        = results.ownerSnapshot;
            var mainLocationSnapshot = results.mainLocationSnapshot;

            if (! ownerSnapshot || ! mainLocationSnapshot) {
                throw new NotFoundError("Missing snapshots");
            }

            data.user = {
                name: User.getName(ownerSnapshot),
                email: ownerSnapshot.email
            };
            data.mainLocation = mainLocationSnapshot ? Location.getAddress(mainLocationSnapshot, true) : "";
            data.logoUrl      = getCompanyLogoUrl();

            // TODO: fill in
            data.company = {
                name: "",
                address: "",
                phone: ""
            };

            return data;
        })();
    }

    // create a snapshot if there is no snapshot after the edited date
    function getSnapshot(targetType, model, editedDate) {
        return Promise.coroutine(function* () {
            var [snapshot] = yield ModelSnapshot
                .find({
                    targetId: model.id,
                    targetType: targetType,
                    createdDate: { '>=': editedDate }
                })
                .limit(1);

            if (! snapshot) {
                snapshot = yield ModelSnapshot.getSnapshot(targetType, model, true);
            } else {
                snapshot = ModelSnapshot.exposeSnapshot(snapshot);
            }

            return snapshot;
        })();
    }
}

function getCompanyLogoUrl() {
    return "";
}

function getReportHeader() {
    var url = getCompanyLogoUrl();

    return `
        <div style="padding-top: 20px;">
            <img src="${url}" alt="Logo" width="144" height="36">
        </div>
    `.split("\n").join(""); // to remove carriage char
}

function getReportFooter() {
    // TODO: fill in
    return `
        <div style="text-align: center; font-size: 12px; line-height: 12px;">
            __ <br>
            Numéro de TVA&nbsp;: __ | Adresse&nbsp;: __<br>
            Courriel&nbsp;: __ |<br>
            Site Web&nbsp;: __ | Téléphone&nbsp;: __
        </div>
    `.split("\n").join(""); // to remove carriage char
}
