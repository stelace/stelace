/* global odoo, OdooApiService, User */

module.exports = {

    getPartnerId: getPartnerId,
    createPartner: createPartner,
    updatePartner: updatePartner,
    getInvoiceData: getInvoiceData,
    createInvoice: createInvoice,
    openInvoice: openInvoice,
    createPayment: createPayment,
    createInternalPayment: createInternalPayment,
    postPayment: postPayment,
    getOutstandingCredits: getOutstandingCredits,
    assignOutstandingCredit: assignOutstandingCredit,

    searchModels: searchModels,
    getModels: getModels,
    updateModel: updateModel

};

const _ = require('lodash');

var odooConfig = sails.config.odoo;

function getPartnerId(userId) {
    if (! userId) {
        return Promise.reject(new BadRequestError("missing params"));
    }

    if (! OdooApiService.isEnabled()) {
        return Promise.resolve();
    }

    var params = {
        domain: [
            ["ref", "=", User.getPartnerRef(userId)]
        ]
    };

    return odoo
        .search("res.partner", params)
        .then(res => res[0]);
}

/**
 * create partner
 * @param  {object}  args
 * @param  {string}  args.name
 * @param  {number}  args.userId
 * @param  {string}  [args.city]
 * @param  {number}  [args.companyId]
 * @param  {string}  [args.companyType]
 * @param  {number}  [args.countryId]
 * @param  {string}  [args.email]
 * @param  {boolean} [args.isCompany]
 * @param  {boolean} [args.isCustomer]
 * @param  {string}  [args.lang]
 * @param  {string}  [args.phone]
 * @param  {string}  [args.postalCode]
 * @param  {number}  [args.propertyAccountPayableId]
 * @param  {number}  [args.propertyAccountReceivableId]
 * @param  {number}  [args.propertyPaymentTermId]
 * @param  {string}  [args.street]
 * @param  {string}  [args.type]
 * @return {Promise<number>} partner id
 */
function createPartner(args) {
    if (! args.name
     || ! args.userId
    ) {
        return Promise.reject(new BadRequestError("missing params"));
    }

    if (! OdooApiService.isEnabled()) {
        return Promise.resolve();
    }

    var params = {
        name: args.name,
        street: args.street,
        zip: args.postalCode,
        city: args.city,
        company_id: args.companyId || odooConfig.ids.companies.stelace,
        company_type: args.companyType || "person",
        country_id: args.countryId || odooConfig.ids.countries.fr,
        customer: args.isCustomer || true,
        email: args.email,
        is_company: args.isCompany || false,
        lang: args.lang || "fr_FR",
        mobile: args.phone,
        notify_email: "none",
        opt_out: false,
        property_account_payable_id: args.propertyAccountPayableId || odooConfig.ids.accounts.supplier_goodsPurchaseAndServiceProvision,
        property_account_receivable_id: args.propertyAccountReceivableId || odooConfig.ids.accounts.customer_goodsSalesAndServiceProvision,
        property_payment_term_id: args.propertyPaymentTermId || odooConfig.ids.accountPaymentTerms.immediate,
        ref: User.getPartnerRef(args.userId),
        type: args.type || "contact"
    };

    return odoo.create("res.partner", params);
}

/**
 * update partner
 * @param  {object} args
 * @param  {string} [args.city]
 * @param  {number} [args.companyId]
 * @param  {number} [args.countryId]
 * @param  {string} [args.email]
 * @param  {string} [args.name]
 * @param  {string} [args.phone]
 * @param  {string} [args.postalCode]
 * @param  {number} [args.propertyAccountPayableId]
 * @param  {number} [args.propertyAccountReceivableId]
 * @param  {number} [args.propertyPaymentTermId]
 * @param  {string} [args.street]
 * @return {Promise<boolean>}
 */
function updatePartner(partnerId, args) {
    if (! OdooApiService.isEnabled()) {
        return Promise.resolve();
    }

    var connectionFields = {
        city: "city",
        companyId: "company_id",
        countryId: "country_id",
        email: "email",
        name: "name",
        phone: "mobile",
        postalCode: "zip",
        propertyAccountPayableId: "property_account_payable_id",
        propertyAccountReceivableId: "property_account_receivable_id",
        propertyPaymentTermId: "property_payment_term_id",
        street: "street"
    };

    var params = _.reduce(args, (memo, value, key) => {
        memo[connectionFields[key]] = value;
        return memo;
    }, {});

    return odoo.update("res.partner", partnerId, params);
}

function getInvoiceData(invoiceId) {
    if (! OdooApiService.isEnabled()) {
        return Promise.resolve();
    }

    var params = {
        ids: [invoiceId],
        fields: [
            "number"
        ]
    };

    return odoo
        .get("account.invoice", params)
        .then(res => res[0]);
}

/**
 * create invoice
 * @param  {object}   args
 * @param  {string}   args.dueDate
 * @param  {string}   args.invoiceDate
 * @param  {number}   [args.accountId]
 * @param  {number}   [args.comment]
 * @param  {number}   [args.companyId]
 * @param  {number}   [args.currencyId]
 * @param  {number}   [args.journalId]
 * @param  {string}   [args.name]
 * @param  {number}   [args.userId]
 *
 * @param  {object[]} [args.invoiceLines]
 * @param  {number}   args.invoiceLines.accountId
 * @param  {string}   args.invoiceLines.name
 * @param  {string}   args.invoiceLines.customDescription
 * @param  {number}   args.invoiceLines.productId
 * @param  {number}   args.invoiceLines.productPrice
 * @param  {number[]} args.invoiceLines.taxIds
 * @param  {number}   [args.invoiceLines.discount]
 * @param  {number}   [args.invoiceLines.quantity]
 * @param  {number}   [args.invoiceLines.sequence]
 *
 * @param  {number}   [args.paymentTermId]
 *
 * @param  {object[]} [args.taxLines]
 * @param  {number}   args.taxLines.amount
 * @param  {number}   args.taxLines.name
 * @param  {number}   args.taxLines.taxId
 * @param  {number}   [args.taxLines.accountId]
 * @param  {number}   [args.taxLines.currencyId]
 * @param  {number}   [args.taxLines.sequence]
 *
 * @return {Promise<number>} invoice id
 */
function createInvoice(args) {
    if (! args.dueDate
     || ! args.invoiceDate
    ) {
        return Promise.reject(new BadRequestError("missing params"));
    }

    if (! OdooApiService.isEnabled()) {
        return Promise.resolve();
    }

    var params = {
        account_id: args.accountId || odooConfig.ids.accounts.customer_goodsSalesAndServiceProvision,
        comment: args.comment,
        company_id: args.companyId || odooConfig.ids.companies.stelace,
        currency_id: args.currencyId || odooConfig.ids.currencies.EUR,
        date_due: args.dueDate,
        date_invoice: args.invoiceDate,
        invoice_line_ids: _.map(args.invoiceLines || [], getInvoiceLines),
        journal_id: args.journalId || odooConfig.ids.journals.customerInvoices,
        name: args.name,
        partner_id: args.partnerId,
        payment_term_id: args.paymentTermId || odooConfig.ids.accountPaymentTerms.immediate,
        tax_line_ids: _.map(args.taxLines, getTaxLines),
        user_id: args.userId || odooConfig.ids.users.stelaceBot
    };

    return odoo.create("account.invoice", params);



    function getInvoiceLines(invoiceLine, index) {
        return [
            0,
            false,
            {
                account_analytic_id: false,
                account_id: invoiceLine.accountId,
                discount: typeof invoiceLine.discount !== "undefined" ? invoiceLine.discount : 0,
                invoice_line_tax_ids: [[6, false, invoiceLine.taxIds]],
                name: invoiceLine.name,
                x_description: invoiceLine.customDescription,
                price_unit: invoiceLine.productPrice,
                product_id: invoiceLine.productId,
                quantity: invoiceLine.quantity || 1,
                sequence: invoiceLine.sequence || (10 + index),
                uom_id: 1
            }
        ];
    }

    function getTaxLines(taxLine) {
        return [
            0,
            false,
            {
                account_analytic_id: false,
                account_id: taxLine.accountId,
                amount: taxLine.amount,
                currency_id: taxLine.currencyId || odooConfig.ids.currencies.EUR,
                manual: false,
                name: taxLine.name,
                sequence: taxLine.sequence || 10,
                tax_id: taxLine.taxId
            }
        ];
    }
}

function openInvoice(invoiceId) {
    if (! OdooApiService.isEnabled()) {
        return Promise.resolve();
    }

    var params = {
        method: "action_invoice_open",
        model: "account.invoice",
        domain_id: null,
        context_id: 1,
        args: [[invoiceId]]
    };

    return odoo.rpcCall("/web/dataset/call_button", params);
}

/**
 * init payment
 * @param  {object} args
 * @param  {number} args.amount
 * @param  {number} args.partnerId
 * @param  {string} args.paymentDate
 * @param  {string} [args.communication]
 * @param  {number} [args.currencyId]
 * @param  {number} [args.invoiceId] - if provided, associate the payment with the invoice
 * @param  {number} [args.journalId]
 * @param  {number} [args.paymentMethodId]
 * @param  {string} [args.paymentType]
 * @return {Promise<number>} payment id
 */
function createPayment(args) {
    if (! args.amount
     || ! args.partnerId
     || ! args.paymentDate
    ) {
        return Promise.reject(new BadRequestError("missing params"));
    }

    if (! OdooApiService.isEnabled()) {
        return Promise.resolve();
    }

    var params = {
        amount: args.amount,
        communication: args.communication,
        currency_id: args.currencyId || odooConfig.ids.currencies.EUR,
        journal_id: args.journalId || odooConfig.ids.journals.mangopayBank,
        partner_id: args.partnerId,
        partner_type: args.partnerType || "customer",
        payment_date: args.paymentDate,
        payment_difference_handling: "open",
        payment_method_id: args.paymentMethodId || odooConfig.ids.accountPaymentMethods.inbound,
        payment_type: args.paymentType || "inbound",
        writeoff_account_id: false
    };
    var context;

    if (args.invoiceId) {
        context = {
            default_invoice_ids: [[4, args.invoiceId, null]]
        };
    }

    return odoo.create("account.payment", params, context);
}

/**
 * init internal payment
 * @param  {object} args
 * @param  {number} args.amount
 * @param  {string} args.paymentDate
 * @param  {number} [args.communication]
 * @param  {number} [args.currencyId]
 * @param  {number} [args.destinationJournalId]
 * @param  {number} [args.journalId]
 * @param  {number} [args.partnerId]
 * @param  {string} [args.partnerType]
 * @param  {number} [args.paymentMethodId]
 * @param  {string} [args.paymentType]
 * @return {Promise<number>} payment id
 */
function createInternalPayment(args) {
    if (! args.amount
     || ! args.paymentDate
    ) {
        return Promise.reject(new BadRequestError("missing params"));
    }

    if (! OdooApiService.isEnabled()) {
        return Promise.resolve();
    }

    var params = {
        amount: args.amount,
        communication: args.communication,
        currency_id: args.currencyId || odooConfig.ids.currencies.EUR,
        destination_journal_id: args.destinationJournalId || odooConfig.ids.journals.bank1,
        journal_id: args.journalId || odooConfig.ids.journals.mangopayBank,
        partner_id: args.partnerId,
        partner_type: args.partnerType || "customer",
        payment_date: args.paymentDate,
        payment_method_id: args.paymentMethodId || odooConfig.ids.accountPaymentMethods.outbound,
        payment_type: args.paymentType || "transfer"
    };

    return odoo.create("account.payment", params);
}

function postPayment(paymentId) {
    if (! OdooApiService.isEnabled()) {
        return Promise.resolve();
    }

    var params = {
        method: "post",
        model: "account.payment",
        domain_id: null,
        context_id: 1,
        args: [[paymentId]]
    };

    return odoo.rpcCall("/web/dataset/call_button", params);
}

function getOutstandingCredits(invoiceId) {
    if (! OdooApiService.isEnabled()) {
        return Promise.resolve();
    }

    var params = {
        ids: invoiceId,
        fields: [
        "id",
            "outstanding_credits_debits_widget"
        ]
    };

    return odoo.get("account.invoice", params)
        .then(invoice => {
            if (! invoice) {
                throw new Error("Invoice not found");
            }

            if (invoice.outstanding_credits_debits_widget === "false") {
                return [];
            }

            try {
                var result = JSON.parse(invoice.outstanding_credits_debits_widget);

                if (! result.outstanding) {
                    return [];
                } else {
                    return result.content;
                }
            } catch (e) {
                throw e;
            }
        });
}

function assignOutstandingCredit(invoiceId, moveLineId) {
    if (! OdooApiService.isEnabled()) {
        return Promise.resolve();
    }

    var params = {
        model: "account.invoice",
        method: "assign_outstanding_credit",
        kwargs: {},
        args: [
            invoiceId,
            moveLineId
        ]
    };

    return odoo.rpcCall("/web/dataset/call_kw/account.invoice/assign_outstanding_credit", params);
}

function searchModels(model, domain) {
    if (! OdooApiService.isEnabled()) {
        return Promise.resolve();
    }

    var params = {
        domain: domain
    };

    return odoo.search(model, params);
}

function getModels(model, ids, fields) {
    if (! OdooApiService.isEnabled()) {
        return Promise.resolve();
    }

    var params = {
        ids: ids,
        fields: fields
    };

    return odoo.get(model, params);
}

function updateModel(model, id, params) {
    if (! OdooApiService.isEnabled()) {
        return Promise.resolve();
    }

    return odoo
        .update(model, id, params)
        .then(res => res[0]);
}
