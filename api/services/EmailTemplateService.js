/*
    global AppUrlService, ContentEntriesService, CurrencyService, EmailService, EmailHelperService,
    Listing, MicroService, PricingService, StelaceConfigService, TimeService
*/

module.exports = {

    sendGeneralNotificationEmail,
    sendEmailTemplate,

    getListTemplates,
    getTemplateResult,
    getTemplateWorkflow,

    getParametersMetadata,
    getExampleData,

};

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const formatMessage = require('format-message');
const Handlebars = require('handlebars');
const cheerio = require('cheerio');
const moment = require('moment');
const querystring = require('querystring');

Promise.promisifyAll(fs);

const general = {
    filteredFields: [
        "mainTitle",
        "trailingContact",
        "previewContent",
        "leadingContent",
        "notificationImageAlt",
        "notificationImageUrl",
        "notificationImageHref",
        "notificationImageWidth",
        "notificationImageMaxWidth",
        "notificationImageCustomStyles",
        "content",
        "ctaButtonText",
        "ctaUrl",
        "trailingContent",
        "featured",
        "featuredImageUrl",
        "featuredImageAlt",
        "featuredImageHref",
        "featuredTitle",
        "featuredContent",
        "postFeaturedContent",
        "customGoodbye",
        "noSocialBlock",
        "footerContent"
    ],
    userFields: [
        "id",
        "firstname",
        "email"
    ],
    notificationFields: [
        "notificationImageAlt",
        "notificationImageUrl",
        "notificationImageHref",
        "notificationImageWidth",
        "notificationImageMaxWidth",
        "notificationImageCustomStyles"
    ],
    featuredFields: [
        "featured",
        "featuredImageUrl",
        "featuredImageAlt",
        "featuredImageHref",
        "featuredTitle",
        "featuredContent"
    ]
};

let emailTemplate;
let emailCompiledTemplate;

/**
 * send general notification email
 * @param {object}   args
 * @param {object}   args.user                          user or email must be required
 * @param {string}   args.email                         user or email must be required
 * @param {string[]} args.templateTags                  email tagging
 * @param {string}   [args.mainTitle]                   can be HTML
 * @param {string}   [args.specificTemplateName]        useful to differentiate from other general template use
 * @param {string}   [args.replyTo]                     Reply-To email header
 * @param {string}   args.subject                       email subject
 * @param {string}   [args.previewContent]              preview for mobile email client
 * @param {string}   [args.leadingContent]              can be HTML
 * @param {string}   [args.notificationImageUrl]        image source
 * @param {string}   [args.notificationImageAlt]        image alt
 * @param {string}   [args.notificationImageHref]       image link
 * @param {string}   [args.notificationImageWidth]      image width (required if notificationImageUrl is defined)
 * @param {string}   [args.notificationImageMaxWidth]   image max width (required if notificationImageUrl is defined)
 * @param {string}   [args.content]                     can be HTML
 * @param {string}   [args.ctaButtonText]               button call to action
 * @param {string}   [args.ctaUrl]                      button link (required if ctaButtonText is defined)
 * @param {string}   [args.trailingContent]             can be HTML
 * @param {boolean}  [args.featured = false]            enable feature section
 * @param {string}   [args.featuredImageUrl]            feature image source
 * @param {string}   [args.featuredImageAlt]            feature image alt
 * @param {string}   [args.featuredImageHref]           feature image link
 * @param {string}   [args.featuredTitle]               feature title
 * @param {string}   [args.featuredContent]             can be HTML
 * @param {string}   [args.customGoodBye]               can be HTML
 * @param {boolean}  [args.noSocialBlock = false]       display social icons
 * @param {string}   [args.footerContent]               can be HTML
 * @param {boolean}  [args.noCopyEmail]                 force no copy of this email
 * @param {boolean}  [args.transactional]               is transaction email (false for newsletter)
 */
function sendGeneralNotificationEmail(args) {
    args = args || {};
    const templateTags  = args.templateTags || [];
    const user          = args.user;
    const email         = args.email;
    const replyTo       = args.replyTo;
    const noCopyEmail   = args.noCopyEmail;
    const transactional = args.transactional;
    let subject         = args.subject;

    let data = _.pick(args, general.filteredFields);
    data = omitUnusedFields(data);

    data = _.reduce(data, (memo, value, key) => {
        memo[key] = EmailHelperService.minifyHtml(value);
        return memo;
    }, {});

    subject = EmailHelperService.minifyHtml(subject);

    return EmailService
        .sendEmail({
            templateName: "general-notification-template",
            specificTemplateName: args.specificTemplateName || "general-notification-template",
            toUser: _.pick(user, general.userFields),
            toEmail: email,
            replyTo: replyTo,
            subject: subject,
            data: data,
            tags: templateTags,
            noCopyEmail: noCopyEmail,
            transactional: transactional,
        });
}

function omitUnusedFields(data) {
    let omitFields = [];

    if (! data.notificationImageUrl) {
        omitFields = omitFields.concat(general.notificationFields);
    }
    if (! data.featured) {
        omitFields = omitFields.concat(general.featuredFields);
    }

    if (! omitFields.length) {
        return data;
    } else {
        return _.omit(data, omitFields);
    }
}

/**
 * Send email with the general template as layout
 * @param {String} templateName
 * @param {Object} params
 * @param {Object} params.user      // user or email must be defined
 * @param {String} params.email
 * @param {String} [params.replyTo]
 * @param {String} [params.lang]
 * @param {String} [params.tags]
 * @param {Object} [params.data]
 * @param {Object} [params.noCopyEmail]
 * @param {Object} [params.transactional]
 */
async function sendEmailTemplate(templateName, {
    user,
    email,
    replyTo,
    lang,
    tags,
    data,
    noCopyEmail,
    transactional,
} = {}) {
    const config = await StelaceConfigService.getConfig();

    if (!lang) {
        lang = config.lang;
    }

    if (!replyTo && config.service_email && MicroService.isEmail(config.service_email)) {
        replyTo = config.service_email;
    }

    const {
        isCompleteEmail,
        html,
        subject,
    } = await getTemplateResult(templateName, {
        lang,
        user,
        isEditMode: false,
        data,
        displayDefault: false,
    });

    if (!isCompleteEmail) {
        return;
    }

    if (!tags) {
        tags = getTemplateTags(templateName);
    }

    await EmailService.sendEmail({
        templateName: 'general',
        specificTemplateName: templateName,
        fromName: config.SERVICE_NAME || 'Stelace',
        toUser: user,
        toEmail: email,
        subject,
        html,
        replyTo,
        tags,
        noCopyEmail,
        transactional,
    });
}

async function getTemplateResult(templateName, { lang, user, isEditMode, data = {}, displayDefault = false }) {
    const config = await StelaceConfigService.getConfig();

    const emailTemplate = await fetchEmailTemplate();
    const rawContent = await getTemplateContent(templateName, lang, { displayDefault });
    const workflow = getTemplateWorkflow(templateName);

    // transform input data into ICU placeholders
    let parameters = {};
    parameters = await prepareDataForICUMessageFormat(parameters, { config, data, user, lang });
    if (typeof workflow.transformData === 'function') {
        const templateParameters = await workflow.transformData(parameters, { config, data, user, lang });
        if (templateParameters) {
            parameters = templateParameters;
        }
    }

    // compile user content using ICU placeholders into HBS variables
    let compiledContent = compileICUContent(rawContent, parameters, { lang, currency: config.currency });

    // add HBS variables that are not editable by user
    compiledContent = beforeCompileNonEditableContent(compiledContent, { config, data, user, lang, parameters });
    if (typeof workflow.compileNonEditableContent === 'function') {
        const templateCompiledContent = workflow.compileNonEditableContent(compiledContent, { config, data, user, lang, parameters });
        if (templateCompiledContent) {
            compiledContent = templateCompiledContent;
        }
    }

    // get allowed blocks
    let emailTemplateBlocks = getEmailBlocks();
    if (typeof workflow.getEmailBlocks === 'function') {
        emailTemplateBlocks = Object.assign({}, emailTemplateBlocks, workflow.getEmailBlocks() || {});
    }

    // enable or disable email blocks based on preview
    compiledContent = computeContentBlock(compiledContent, { emailTemplateBlocks, isEditMode });

    let html = getHtml(emailTemplate, compiledContent);

    const $ = cheerio.load(html);
    if (isEditMode) {
        $('[data-translate]').each((i, el) => {
            const $el = $(el);
            const translationKey = $el.attr('data-translate');
            if (translationKey.startsWith('_template')) {
                const newTranslationKey = translationKey.replace('_template', `template.${templateName}`);
                $el.attr('data-translate', newTranslationKey);
            }
        });
        html = $.html();
    } else {
        $('[data-translate]').each((i, el) => {
            const $el = $(el);
            $el.removeAttr('data-translate');
        });
        html = $.html();
    }

    const isCompleteEmail = rawContent && rawContent.header_title;

    return {
        html,
        subject: compiledContent.subject,
        parameters,
        isCompleteEmail,
    };
}

async function fetchEmailTemplate() {
    if (emailTemplate && sails.config.environment !== 'development') {
        return emailTemplate;
    }

    const emailFilepath = path.join(__dirname, '../assets/emailsTemplates/general.html');
    emailTemplate = await fs.readFileAsync(emailFilepath, 'utf8');

    return emailTemplate;
}

async function getTemplateContent(templateName, lang, { displayDefault = false } = {}) {
    let rawContent;

    if (displayDefault) {
        rawContent = await ContentEntriesService.fetchDefaultTranslations(lang, { namespace: 'email' });
    } else {
        rawContent = await ContentEntriesService.getTranslations({ lang, namespace: 'email' });
    }

    return Object.assign({}, rawContent.labels, rawContent.general, rawContent.template[templateName]);
}

function configureFormatMessage(formatMessage, { lang, currency = 'EUR' }) {
    let customFormats = {};

    if (currency) {
        const currencyDecimal = CurrencyService.getCurrencyDecimal(currency);

        customFormats.number = {
            currency: {
                style: 'currency',
                currency,
                minimumFractionDigits: 0,
                maximumFractionDigits: currencyDecimal,
            },
        };
    }

    customFormats.date = {
        fullmonth: {
            month: 'long',
            year: 'numeric',
        },
    };

    formatMessage.setup({
        locale: lang,
        formats: Object.keys(customFormats).length ? customFormats : undefined,
    });
}

function compileICUContent(rawContent, parameters, { lang, currency }) {
    const compiledContent = {};

    configureFormatMessage(formatMessage, { lang, currency });

    const tmpParameters = {};

    Object.keys(parameters).forEach(key => {
        const value = parameters[key];
        if (typeof value === 'string' && TimeService.isDateString(value)) {
            tmpParameters[key] = new Date(value);
        } else {
            tmpParameters[key] = value;
        }
    });

    Object.keys(rawContent).forEach(key => {
        const value = rawContent[key];

        compiledContent[key] = formatMessage(value, tmpParameters);
    });

    return compiledContent;
}

function beforeCompileNonEditableContent(content, { config, /*data, user, lang*/ }) {
    const newContent = {};
    const configStyles = Object.assign({ styles: {}, defaultStyles: {}},
        _.pick(config, ['styles', 'defaultStyles'])
    );

    newContent.stelace_website__img_url = getStelaceFooterUrl({ content: 'footer-logo' });
    newContent.stelace_logo__url = sails.config.stelace.url + '/assets/img/logo/stelace-logo.png';

    if (config.logo__url) {
        newContent.service_logo__url = sails.config.stelace.url + config.logo__url;
    } else {
        newContent.service_logo__url = newContent.stelace_logo__url;
    }

    newContent.style__color_brand = configStyles.styles['--stl-color-primary']
        || configStyles.defaultStyles['--stl-color-primary'];

    newContent.style__color_calltoaction = configStyles.styles['--stl-color-calltoaction']
        || configStyles.defaultStyles['--stl-color-calltoaction'];

    return Object.assign({}, content, newContent);
}

function computeContentBlock(content, { emailTemplateBlocks, isEditMode }) {
    const newContent = {};

    const blockNames = [
        'preheader_content__block',
        'service_logo__block',
        'header_title__block',
        'leading_content__block',
        'notification_image__block',
        'cta_button__block',
        'trailing_content__block',
        'featured__block',
        'end_content__block',
        'footer_content__block',
        'branding__block',
    ];

    // use email blocks
    blockNames.forEach(name => {
        newContent[name] = !!emailTemplateBlocks[name];
    });

    if (!newContent['notification_image__block']) {
        newContent['leading_content__block'] = false;
    }
    if (!newContent['cta_button__block'] || !newContent['featured__block']) {
        newContent['trailing_content__block'] = false;
    }
    if (!newContent['cta_button__block'] && !newContent['trailing_content__block']) {
        newContent['end_content__block'] = false;
    }

    // if not preview, hide blocks that have no value
    if (!isEditMode) {
        let computedBlock = {};

        computedBlock.preheader_content__block = !!content.preheader_content;
        computedBlock.service_logo__block = !!content.service_logo__url;
        computedBlock.header_title__block = !!content.header_title;
        computedBlock.leading_content__block = !!content.leading_content;
        computedBlock.notification_image__block = !!content.notification_image__href;
        computedBlock.cta_button__block = !!content.cta_button__text;
        computedBlock.trailing_content__block = !!content.trailing_content;
        computedBlock.featured__block = !!content.featured__content;
        computedBlock.end_content__block = !!content.end_content;
        computedBlock.footer_content__block = !!content.footer_content;
        computedBlock.branding__block = true;

        blockNames.forEach(name => {
            if (!newContent[name]) return;
            newContent[name] = computedBlock[name];
        });

        if (!newContent['cta_button_block']) {
            newContent['trailing_content__block'] = false;
        }
    }

    return Object.assign({}, content, newContent);
}

function getHtml(emailTemplate, content) {
    if (!emailCompiledTemplate || sails.config.environment === 'development') {
        emailCompiledTemplate = Handlebars.compile(emailTemplate);
    }

    const fields = [
        'subject',
        'preview_content',
        'preheader_content__block',
        'preheader_content',
        'service_logo__block',
        'service_logo__url',
        'header_title__block',
        'header_title',
        'leading_content__block',
        'leading_content',
        'notification_image__block',
        'notification_image__href',
        'notification_image__alt',
        'notification_image__width',
        'notification_image__max_width',
        'notification_image__custom_styles',
        'content',
        'cta_button__block',
        'cta__button_url',
        'cta_button__text',
        'trailing_content__block',
        'trailing_content',
        'featured__block',
        'featured__image__href',
        'featured__image__alt',
        'featured__image__url',
        'featured__title',
        'featured__content',
        'end_content__block',
        'end_content',
        'footer_content__block',
        'footer_content',
        'legal_notice',
        'style__color_brand',
        'style__color_calltoaction',
        'branding__block',
        'branding',
        'stelace_logo__url',
        'stelace_website__img_url',
    ];

    return emailCompiledTemplate(_.pick(content, fields));
}

function getEmailBlocks() {
    const commonBlocks = {
        preheader_content__block: true,
        service_logo__block: true,
        header_title__block: true,
        leading_content__block: true,
        notification_image__block: false,
        cta_button__block: true,
        trailing_content__block: true,
        featured__block: false,
        end_content__block: true,
        footer_content__block: true,
        branding__block: true,
    };

    return Object.assign({}, commonBlocks);
}

async function prepareDataForICUMessageFormat(parameters, { config, user, data, lang }) {
    const newParams = {};

    newParams.SERVICE_NAME = config.SERVICE_NAME;
    newParams.service_email = config.service_email; // TODO: create variable in config
    newParams.service_billing_address = config.service_billing_address; // TODO: create variable in config
    newParams.has_contact_address = !!(newParams.service_email || newParams.service_billing_address);
    newParams.stelace_website__text_url = getStelaceFooterUrl();

    if (typeof user === 'object') {
        newParams.user__firstname = user.firstname || undefined;
        newParams.user__lastname = user.lastname || undefined;
    }
    newParams.current_year = '' + new Date().getFullYear();

    const {
        listing,
        booking,
        listingMedias,
        owner,
        taker,
        interlocutor,
        conversation,
    } = data;

    if (listing) {
        const listingI18n = Listing.getI18nModel(listing, { locale: lang, fallbackLocale: config.lang });

        newParams.listing__name = listingI18n.name;
        newParams.listing__name_short = EmailHelperService.shrinkString(newParams.listing__name, 70);
        newParams.listing__description = listingI18n.description;
        newParams.listing__description_short = newParams.listing__description
            ? EmailHelperService.shrinkString(newParams.listing__description, 200)
            : null;
    }
    if (booking) {
        const priceResult = PricingService.getPriceAfterRebateAndFees({ booking });

        newParams.booking__start_date = booking.startDate;
        newParams.booking__end_date = booking.endDate || undefined;
        newParams.booking__owner_price = booking.ownerPrice || 0;
        newParams.booking__owner_net_income = priceResult.ownerNetIncome || 0;
        newParams.booking__owner_fees = booking.ownerFees || 0;
        newParams.booking__taker_price = booking.takerPrice || 0;
        newParams.booking__taker_fees = booking.takerFees || 0;
        newParams.booking__deposit = booking.deposit || 0;
    }
    if (listingMedias) {
        newParams.listing__media_url = EmailHelperService.getListingMediaUrl(listingMedias);
    }
    if (owner) {
        newParams.owner__name = EmailHelperService.getUserName(owner, 'notFull');
    }
    if (taker) {
        newParams.taker__name = EmailHelperService.getUserName(taker, 'notFull');
    }
    if (interlocutor) {
        newParams.interlocutor__name = EmailHelperService.getUserName(interlocutor, 'notFull');
    }
    if (conversation) {
        newParams.conversation__url = EmailHelperService.getUrl('conversation', conversation);
    }

    return Object.assign({}, parameters, newParams);
}

function getCommonParametersMetadata({ filter = [], omit = [] } = {}) {
    const commonParametersMetadata = [
        { label: 'SERVICE_NAME', type: 'string' },
        { label: 'current_year', type: 'string' },
        { label: 'service_email', type: 'string' },
        { label: 'service_billing_address', type: 'string' },

        { label: 'user__firstname', type: 'string' },
        { label: 'user__lastname', type: 'string' },

        { label: 'listing__name', type: 'string' },
        { label: 'listing__name_short', type: 'string' },
        { label: 'listing__description', type: 'string' },
        { label: 'listing__description_short', type: 'string' },

        { label: 'booking__start_date', type: 'date' },
        { label: 'booking__end_date', type: 'date' },
        { label: 'booking__owner_price', type: 'number' },
        { label: 'booking__owner_net_income', type: 'number' },
        { label: 'booking__owner_fees', type: 'number' },
        { label: 'booking__taker_price', type: 'number' },
        { label: 'booking__taker_fees', type: 'number' },
        { label: 'booking__deposit', type: 'number' },

        { label: 'owner__name', type: 'string' },
        { label: 'taker__name', type: 'string' },
        { label: 'interlocutor__name', type: 'string' },
    ];

    let parametersMetadata = commonParametersMetadata.slice(0);

    if (filter.length) {
        const indexedFilter = _.indexBy(filter);

        parametersMetadata = parametersMetadata.filter(param => {
            return indexedFilter[param.label];
        });
    }
    if (omit.length) {
        const indexedOmit = _.indexBy(omit);

        parametersMetadata = parametersMetadata.filter(param => {
            return !indexedOmit[param.label];
        });
    }

    return parametersMetadata;
}

function getListTemplates() {
    return [
        'email_confirmation',
        'subscription',
        'password_recovery',
        'new_message',

        'prebooking_confirmed_owner',
        'prebooking_pending_taker',
        'booking_pending_owner',
        'booking_pending_taker',
        'booking_confirmed_owner',
        'booking_confirmed_taker',
        'booking_checkout_owner',
        'booking_checkout_taker',
        'listing_return_owner',
        'listing_return_taker',

        // reminders
        'booking_to_accept_owner',
        'missing_bank_account_owner',
        'upcoming_transaction_owner',
        'upcoming_transaction_taker',
        'missing_rating',
    ];
}

function getTemplateWorkflow(templateName) {
    let transformData;
    let getEmailBlocks;
    let compileNonEditableContent;

    switch (templateName) {
        case 'email_confirmation':
            compileNonEditableContent = function (content, { data }) {
                const newContent = {};

                const { token } = data;

                newContent.cta__button_url = AppUrlService.getUrl('emailCheck', [token, true]);

                return Object.assign({}, content, newContent);
            };
            break;

        case 'subscription':
            compileNonEditableContent = function (content) {
                const newContent = {};

                newContent.cta__button_url = AppUrlService.getAppUrl();

                return Object.assign({}, content, newContent);
            };
            break;

        case 'password_recovery':
            compileNonEditableContent = function (content, { data }) {
                const newContent = {};

                const { token } = data;

                newContent.cta__button_url = AppUrlService.getUrl('recoveryPassword', [token]);

                return Object.assign({}, content, newContent);
            };
            break;

        case 'new_message':
            compileNonEditableContent = function (content, { parameters }) {
                const newContent = {};

                const { conversation__url } = parameters;

                newContent.cta__button_url = conversation__url;

                return Object.assign({}, content, newContent);
            };
            break;

        case 'prebooking_confirmed_owner':
            getEmailBlocks = () => {
                return {
                    cta_button__block: false,
                };
            };
            break;

        case 'prebooking_pending_taker':
            compileNonEditableContent = function (content, { parameters }) {
                const newContent = {};

                const { conversation__url } = parameters;

                newContent.cta__button_url = conversation__url;

                return Object.assign({}, content, newContent);
            };
            break;

        case 'booking_pending_owner':
            compileNonEditableContent = function (content, { parameters }) {
                const newContent = {};

                const { conversation__url } = parameters;

                newContent.cta__button_url = conversation__url;

                return Object.assign({}, content, newContent);
            };
            break;

        case 'booking_pending_taker':
            getEmailBlocks = () => {
                return {
                    cta_button__block: false,
                };
            };
            break;

        case 'booking_confirmed_owner':
            getEmailBlocks = () => {
                return {
                    cta_button__block: false,
                };
            };
            break;

        case 'booking_confirmed_taker':
            getEmailBlocks = () => {
                return {
                    cta_button__block: false,
                };
            };
            break;

        case 'booking_checkout_owner':
            compileNonEditableContent = function (content, { parameters }) {
                const newContent = {};

                const { conversation__url } = parameters;

                newContent.cta__button_url = conversation__url;

                return Object.assign({}, content, newContent);
            };
            break;

        case 'booking_checkout_taker':
            compileNonEditableContent = function (content, { parameters }) {
                const newContent = {};

                const { conversation__url } = parameters;

                newContent.cta__button_url = conversation__url;

                return Object.assign({}, content, newContent);
            };
            break;

        case 'listing_return_owner':
            compileNonEditableContent = function (content, { parameters }) {
                const newContent = {};

                const { conversation__url } = parameters;

                newContent.cta__button_url = conversation__url;

                return Object.assign({}, content, newContent);
            };
            break;

        case 'listing_return_taker':
            compileNonEditableContent = function (content, { parameters }) {
                const newContent = {};

                const { conversation__url } = parameters;

                newContent.cta__button_url = conversation__url;

                return Object.assign({}, content, newContent);
            };
            break;

        case 'booking_to_accept_owner':
            break;

        case 'missing_bank_account_owner':
            break;

        case 'upcoming_transaction_owner':
            break;

        case 'upcoming_transaction_taker':
            break;

        case 'missing_rating':
            compileNonEditableContent = function (content, { parameters }) {
                const newContent = {};

                const { conversation__url } = parameters;

                newContent.cta__button_url = conversation__url;

                return Object.assign({}, content, newContent);
            };
            break;

        default:
            break;
    }

    return {
        transformData,
        getEmailBlocks,
        compileNonEditableContent,
    };
}

function getTemplateTags(templateName) {
    const templateTags = {
        email_confirmation: ['email-confirmation'],
        subscription: ['subscription'],
        password_recovery: ['password-recovery'],
        new_message: ['conversation'],

        prebooking_confirmed_owner: ['booking-process'],
        prebooking_pending_taker: ['booking-process'],
        booking_pending_owner: ['booking-process'],
        booking_pending_taker: ['booking-process'],
        booking_confirmed_owner: ['booking-process'],
        booking_confirmed_taker: ['booking-process'],
        booking_checkout_owner: ['booking-process'],
        booking_checkout_taker: ['booking-process'],
        listing_return_owner: ['booking-process'],
        listing_return_taker: ['booking-process'],

        booking_to_accept_owner: ['reminder'],
        missing_bank_account_owner: ['reminder'],
        upcoming_transaction_owner: ['reminder'],
        upcoming_transaction_taker: ['reminder'],
        missing_rating: ['reminder'],
    };

    return templateTags[templateName];
}

function getParametersMetadata(templateName) {
    const parametersMetadata = {
        email_confirmation: getCommonParametersMetadata({
            filter: [
                'SERVICE_NAME',
                'current_year',
                'service_email',
                'service_billing_address',
            ],
        }),
        subscription: getCommonParametersMetadata({
            filter: [
                'SERVICE_NAME',
                'current_year',
                'service_email',
                'service_billing_address',
                'user__firstname',
                'user__lastname',
            ],
        }),
        password_recovery: getCommonParametersMetadata({
            filter: [
                'SERVICE_NAME',
                'current_year',
                'service_email',
                'service_billing_address',
                'user__firstname',
                'user__lastname',
            ],
        }),
        new_message: getCommonParametersMetadata({
            filter: [
                'SERVICE_NAME',
                'current_year',
                'service_email',
                'service_billing_address',
                'user__firstname',
                'user__lastname',
                'listing__name',
                'listing__name_short',
                'listing__description',
                'listing__description__short',
                'booking__start_date',
                'booking__end_date',
                'booking__owner_price',
                'booking__owner_net_income',
                'booking__owner_fees',
                'booking__taker_price',
                'booking__taker_fees',
                'booking__deposit',
                'owner__name',
                'taker__name',
            ],
        }),

        prebooking_confirmed_owner: getCommonParametersMetadata({
            filter: [
                'SERVICE_NAME',
                'current_year',
                'service_email',
                'service_billing_address',
                'user__firstname',
                'user__lastname',
                'listing__name',
                'listing__name_short',
                'listing__description',
                'listing__description__short',
                'booking__start_date',
                'booking__end_date',
                'booking__owner_price',
                'booking__owner_net_income',
                'booking__owner_fees',
                'booking__taker_price',
                'booking__taker_fees',
                'booking__deposit',
                'owner__name',
                'taker__name',
            ],
        }),
        prebooking_pending_taker: getCommonParametersMetadata({
            filter: [
                'SERVICE_NAME',
                'current_year',
                'service_email',
                'service_billing_address',
                'user__firstname',
                'user__lastname',
                'listing__name',
                'listing__name_short',
                'listing__description',
                'listing__description__short',
                'booking__start_date',
                'booking__end_date',
                'booking__owner_price',
                'booking__owner_net_income',
                'booking__owner_fees',
                'booking__taker_price',
                'booking__taker_fees',
                'booking__deposit',
                'owner__name',
                'taker__name',
            ],
        }),
        booking_pending_owner: getCommonParametersMetadata({
            filter: [
                'SERVICE_NAME',
                'current_year',
                'service_email',
                'service_billing_address',
                'user__firstname',
                'user__lastname',
                'listing__name',
                'listing__name_short',
                'listing__description',
                'listing__description__short',
                'booking__start_date',
                'booking__end_date',
                'booking__owner_price',
                'booking__owner_net_income',
                'booking__owner_fees',
                'booking__taker_price',
                'booking__taker_fees',
                'booking__deposit',
                'owner__name',
                'taker__name',
            ],
        }),
        booking_pending_taker: getCommonParametersMetadata({
            filter: [
                'SERVICE_NAME',
                'current_year',
                'service_email',
                'service_billing_address',
                'user__firstname',
                'user__lastname',
                'listing__name',
                'listing__name_short',
                'listing__description',
                'listing__description__short',
                'booking__start_date',
                'booking__end_date',
                'booking__owner_price',
                'booking__owner_net_income',
                'booking__owner_fees',
                'booking__taker_price',
                'booking__taker_fees',
                'booking__deposit',
                'owner__name',
                'taker__name',
            ],
        }),
        booking_confirmed_owner: getCommonParametersMetadata({
            filter: [
                'SERVICE_NAME',
                'current_year',
                'service_email',
                'service_billing_address',
                'user__firstname',
                'user__lastname',
                'listing__name',
                'listing__name_short',
                'listing__description',
                'listing__description__short',
                'booking__start_date',
                'booking__end_date',
                'booking__owner_price',
                'booking__owner_net_income',
                'booking__owner_fees',
                'booking__taker_price',
                'booking__taker_fees',
                'booking__deposit',
                'owner__name',
                'taker__name',
            ],
        }),
        booking_confirmed_taker: getCommonParametersMetadata({
            filter: [
                'SERVICE_NAME',
                'current_year',
                'service_email',
                'service_billing_address',
                'user__firstname',
                'user__lastname',
                'listing__name',
                'listing__name_short',
                'listing__description',
                'listing__description__short',
                'booking__start_date',
                'booking__end_date',
                'booking__owner_price',
                'booking__owner_net_income',
                'booking__owner_fees',
                'booking__taker_price',
                'booking__taker_fees',
                'booking__deposit',
                'owner__name',
                'taker__name',
            ],
        }),
        booking_checkout_owner: getCommonParametersMetadata({
            filter: [
                'SERVICE_NAME',
                'current_year',
                'service_email',
                'service_billing_address',
                'user__firstname',
                'user__lastname',
                'listing__name',
                'listing__name_short',
                'listing__description',
                'listing__description__short',
                'booking__start_date',
                'booking__end_date',
                'booking__owner_price',
                'booking__owner_net_income',
                'booking__owner_fees',
                'booking__taker_price',
                'booking__taker_fees',
                'booking__deposit',
                'owner__name',
                'taker__name',
            ],
        }),
        booking_checkout_taker: getCommonParametersMetadata({
            filter: [
                'SERVICE_NAME',
                'current_year',
                'service_email',
                'service_billing_address',
                'user__firstname',
                'user__lastname',
                'listing__name',
                'listing__name_short',
                'listing__description',
                'listing__description__short',
                'booking__start_date',
                'booking__end_date',
                'booking__owner_price',
                'booking__owner_net_income',
                'booking__owner_fees',
                'booking__taker_price',
                'booking__taker_fees',
                'booking__deposit',
                'owner__name',
                'taker__name',
            ],
        }),
        listing_return_owner: getCommonParametersMetadata({
            filter: [
                'SERVICE_NAME',
                'current_year',
                'service_email',
                'service_billing_address',
                'user__firstname',
                'user__lastname',
                'listing__name',
                'listing__name_short',
                'listing__description',
                'listing__description__short',
                'booking__start_date',
                'booking__end_date',
                'booking__owner_price',
                'booking__owner_net_income',
                'booking__owner_fees',
                'booking__taker_price',
                'booking__taker_fees',
                'booking__deposit',
                'owner__name',
                'taker__name',
            ],
        }),
        listing_return_taker: getCommonParametersMetadata({
            filter: [
                'SERVICE_NAME',
                'current_year',
                'service_email',
                'service_billing_address',
                'user__firstname',
                'user__lastname',
                'listing__name',
                'listing__name_short',
                'listing__description',
                'listing__description__short',
                'booking__start_date',
                'booking__end_date',
                'booking__owner_price',
                'booking__owner_net_income',
                'booking__owner_fees',
                'booking__taker_price',
                'booking__taker_fees',
                'booking__deposit',
                'owner__name',
                'taker__name',
            ],
        }),

        booking_to_accept_owner: getCommonParametersMetadata({
            filter: [
                'SERVICE_NAME',
                'current_year',
                'service_email',
                'service_billing_address',
                'user__firstname',
                'user__lastname',
                'listing__name',
                'listing__name_short',
                'listing__description',
                'listing__description__short',
                'booking__start_date',
                'booking__end_date',
                'booking__owner_price',
                'booking__owner_net_income',
                'booking__owner_fees',
                'booking__taker_price',
                'booking__taker_fees',
                'booking__deposit',
                'owner__name',
                'taker__name',
            ],
        }),
        missing_bank_account_owner: getCommonParametersMetadata({
            filter: [
                'SERVICE_NAME',
                'current_year',
                'service_email',
                'service_billing_address',
                'user__firstname',
                'user__lastname',
                'listing__name',
                'listing__name_short',
                'listing__description',
                'listing__description__short',
                'booking__start_date',
                'booking__end_date',
                'booking__owner_price',
                'booking__owner_net_income',
                'booking__owner_fees',
                'booking__taker_price',
                'booking__taker_fees',
                'booking__deposit',
                'owner__name',
                'taker__name',
            ],
        }),
        upcoming_transaction_owner: getCommonParametersMetadata({
            filter: [
                'SERVICE_NAME',
                'current_year',
                'service_email',
                'service_billing_address',
                'user__firstname',
                'user__lastname',
                'listing__name',
                'listing__name_short',
                'listing__description',
                'listing__description__short',
                'owner__name',
                'taker__name',
            ],
        }),
        upcoming_transaction_taker: getCommonParametersMetadata({
            filter: [
                'SERVICE_NAME',
                'current_year',
                'service_email',
                'service_billing_address',
                'user__firstname',
                'user__lastname',
                'listing__name',
                'listing__name_short',
                'listing__description',
                'listing__description__short',
                'owner__name',
                'taker__name',
            ],
        }),
        missing_rating: getCommonParametersMetadata({
            filter: [
                'SERVICE_NAME',
                'current_year',
                'service_email',
                'service_billing_address',
                'user__firstname',
                'user__lastname',
                'listing__name',
                'listing__name_short',
                'listing__description',
                'listing__description__short',
                'owner__name',
                'taker__name',
                'interlocutor__name',
            ],
        }),
    };

    return parametersMetadata[templateName];
}

function getExampleData(templateName) {
    const commonExampleData = {
        listing: {
            name: 'Car',
            namesI18n: {
                en: 'Car',
                fr: 'Voiture',
            },
            description: 'It is a beautiful car',
            descriptionsI18n: {
                en: 'It is a beautiful car',
                fr: 'C’est une belle voiture',
            },
        },
        booking: {
            startDate: moment().add({ d: 5 }).format('YYYY-MM-DD') + 'T00:00:00.000Z',
            endDate: moment().add({ d: 10 }).format('YYYY-MM-DD') + 'T00:00:00.000Z',
            ownerPrice: 40,
            ownerFees: 2,
            takerPrice: 48,
            takerFees: 8,
            deposit: 20,
            priceData: {
                freeValue: 0,
                discountValue: 0,
            },
            listingType: {
                config: {
                    pricing: {
                        maxDiscountPercent: 0,
                    },
                },
            },
        },
        listingMedias: [],
        owner: {
            firstname: 'Tom',
            lastname: 'Davis',
            email: 'tom.davis@email.com',
        },
        taker: {
            firstname: 'Max',
            lastname: 'Cooper',
            email: 'max.cooper@email.com',
        },
        conversation: {
            id: 456,
        },
        interlocutor: {
            firstname: 'John',
            lastname: 'Scott',
            email: 'john.scott@email.com',
        },
    };

    let exampleData = commonExampleData;

    switch (templateName) {
        case 'email_confirmation':
            exampleData = Object.assign({}, commonExampleData, {
                token: {
                    id: 12,
                    value: 'sdf4ze89f23',
                },
            });
            break;

        case 'password_recovery':
            exampleData = Object.assign({}, commonExampleData, {
                token: {
                    id: 12,
                    value: 'sdf4ze89f23',
                },
            });
            break;

        default:
            break;
    }

    return exampleData;
}

function getStelaceFooterUrl({ content } = {}) {
    const sourceSite = sails.config.stelace.url && sails.config.stelace.url.replace(/https?:\/\//, '');

    const utmString = querystring.stringify({
        utm_medium: 'email',
        utm_campaign: 'powered-by',
        utm_content: content || 'footer',
        utm_source: sourceSite || '',
    });

    return `https://stelace.com/?${utmString}`;
}
