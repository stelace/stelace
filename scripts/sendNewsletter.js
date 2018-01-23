/* global BootstrapService, EmailService, User */

const Sails      = require('sails');
const path       = require('path');
const fs         = require('fs');
const Handlebars = require('handlebars');

const Promise = require('bluebird');

Sails.load({
    models: {
        migrate: "safe"
    },
    hooks: {
        grunt: false,
        sockets: false,
        pubsub: false
    }
}, async function (err, sails) {
    if (err) {
        console.log("\n!!! Fail cron task: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    let nbNewslettersTotal = 0;
    let nbNewslettersSent  = 0;

    try {
        const users = await User.find({
            emailCheck: true,
            newsletter: true,
            email: { '!=': null },
        });

        nbNewslettersTotal = users.length;

        const newsletterTemplateName = '';
        const template = getTemplate(newsletterTemplateName);

        await Promise.map(users, user => {
            return sendNewsletter(user, template)
                .then(() => ++nbNewslettersSent)
                .catch(() => null);
        });

        console.log(`Newsletter sent: ${nbNewslettersSent} / ${nbNewslettersTotal}`);
    } catch (err) {
        console.log(err);

        if (err.stack) {
            console.log(err.stack);
        }
    } finally {
        sails.lowerSafe();
    }

    function getTemplateContent(templateName) {
        const newsletterFolderPath = '';
        const filepath = path.join(__dirname, newsletterFolderPath, `${templateName}.html`);
        return fs.readFileSync(filepath, 'utf8');
    }

    function getTemplate(templateName) {
        const templateContent = getTemplateContent(templateName);
        return Handlebars.compile(templateContent);
    }

    function generateHtml(template, data) {
        return template(data);
    }

    async function sendNewsletter(user, template) {
        const html = generateHtml(template, {
            email: user.email,
            firstname: user.firstname,
        });

        await EmailService.sendHtmlEmail({
            html,
            userId: user.id,
            fromEmail: '',
            fromName: '',
            toEmail: user.email,
            toName: User.getName(user),
            subject: '',
            replyTo: '',
            tags: ['Newsletter'],
            transactional: false,
        });
    }

});
