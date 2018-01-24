/* global BootstrapService, EmailService, EmailHelperService, TokenService, Transaction, User */

const Sails = require('sails');
const { getConfig } = require('../sailsrc');

const _ = require('lodash');
const Promise = require('bluebird');

Sails.load(getConfig(), async function (err, sails) {
    if (err) {
        console.log("\n!!! Fail script launch: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    var reportYear = 2016;

    return Promise.coroutine(function* () {
        var ownersIds = yield getOwnersIds(reportYear);
        var owners    = yield User.find({
            id: ownersIds,
            email: { '!=': null }
        });

        yield Promise.each(owners, owner => {
            return Promise.coroutine(function* () {
                var token = yield TokenService.getIncomeReportToken(owner.id, reportYear, { y: 1 });

                yield sendEmail(owner, reportYear, token);
            })()
            .catch(err => {
                console.log("Error: ", owner.id);
                console.log(err);

                if (err.stack) {
                    console.log(err.stack);
                }
            });
        });
    })()
    .catch(err => {
        console.log(err);

        if (err.stack) {
            console.log(err.stack);
        }
    })
    .finally(() => {
        sails.lowerSafe();
    });



    function getOwnersIds(reportYear) {
        return Promise.coroutine(function* () {
            var firstDateSuffix = "-01-01T00:00:00.000Z";
            var minDate = `${reportYear}${firstDateSuffix}`;
            var maxDate = `${reportYear + 1}${firstDateSuffix}`;

            var period = {
                '<': maxDate,
                '>=': minDate
            };

            var transactions = yield Transaction.find({
                action: "payout",
                label: "payment",
                executionDate: period
            });

            return _.uniq(_.pluck(transactions, "toUserId"));
        })();
    }

    function sendEmail(owner, reportYear, token) {
        var reportUrl = `${sails.config.stelace.url}/api/user/${owner.id}/income-report/${reportYear}?t=${token.value}`;
        var emailAddress = ""; // Company address
        var siteName = "notre site"; // Use your name

        var preview = `
            Récapitulatif pour déclarer vos revenus perçus sur l'année 2016&nbsp;!
        `;

        var content = `
            <div>
                <p>
                    Bonjour${owner.firstname ? " " + owner.firstname : ""},
                </p>

                <p>
                    Vous avez choisi ${siteName} pour louer et vendre vos objets à d'autres particuliers en toute sécurité et toute
                    l'équipe vous en remercie chaleureusement&nbsp;!
                </p>

                <p>
                    Vous le savez probablement&nbsp;: de même que pour vos autres sources de revenus, il vous revient de déclarer
                    annuellement les revenus générés sur ${siteName}.
                </p>

                <p>
                    <strong>Pour vous y aider, nous avons mis à votre disposition un document récapitulatif des revenus que
                    vous avez perçus sur ${siteName} en 2016. Il est accessible depuis votre compte dans votre tableau de bord
                    et <a href="${reportUrl}">téléchargeable directement depuis cet e-mail</a>.</strong>
                </p>

                <p>
                    N'hésitez pas à vous référer aux sites des administrations concernées pour en savoir plus sur vos revenus à déclarer&nbsp;:<br>
                    - <a href="https://www.impots.gouv.fr/portail/node/10841">https://www.impots.gouv.fr/portail/node/10841</a> met
                    à votre disposition des fiches pratiques pour vous aider à savoir quels revenus déclarer&nbsp;;<br>
                    - <a href="http://www.securite-sociale.fr/Vos-droits-et-demarches-dans-le-cadre-des-activites-economiques-entre-particuliers-Article-87">
                        http://www.securite-sociale.fr/Vos-droits-et-demarches-dans-le-cadre-des-activites-economiques-entre-particuliers-Article-87
                    </a> vous informe sur vos droits et démarches dans le cadre des activités économiques entre particuliers.
                </p>

                <p>
                    A bientôt pour de nouvelles aventures de partage,
                </p>
            </div>
        `;

        var signature = `
            <div>
                <b>L’équipe ${siteName}</b><br>
                N’hésitez pas à nous contacter à l’adresse&nbsp;: ${emailAddress}<br>
            </div>
        `;

        var html = `
            <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
            <html xmlns="http://www.w3.org/1999/xhtml">
                <head>
                    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">

                    <style>
                        body {
                            font-family: Helvetica, Arial, sans-serif;
                        }

                        p {
                            margin-bottom: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div style="display:none; display:none!important; mso-hide:all;">
                        ${preview}
                    </div>

                    ${content}
                    <br>

                    --
                    ${signature}
                </body>
            </html>
        `;

        html = EmailHelperService.minifyHtml(html);

        return EmailService.sendHtmlEmail({
            userId: owner.id,
            fromEmail: "",
            fromName: "",
            toEmail: owner.email,
            toName: User.getName(owner),
            subject: "Récapitulatif de vos revenus perçus en 2016",
            html: html,
            replyTo: "",
            tags: ["income-report"]
        });
    }

});
