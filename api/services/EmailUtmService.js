module.exports = {

    getUtmTags: getUtmTags

};

// <utmTags>: ["utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm"]
//
// utmSource defaults to "template-name-email"
//
// var utmConfig = {
//     general: {
//         allFields: {
//             <utmTags>
//         },
//         fields: {
//             <fieldName1>: {
//                 <utmTags>
//             },
//             ...
//         }
//     },
//     templatesGroups: {
//         <template-group-name-1>: {
//             templates: [
//                 "<template-name-1>",
//                 "<template-name-2>",
//                 ...
//             ],
//             allFields: {
//                 <utmTags>
//             },
//             fields: {
//                 <fieldName1>: {
//                     <utmTags>
//                 },
//                 ...
//             }
//         },
//         ...
//     },
//     templates: {
//         <template-name-1>: {
//             allFields: {
//                 <utmTags>
//             },
//             fields: {
//                 <fieldName1>: {
//                     <utmTags>
//                 },
//                 ...
//             }
//         }
//     }
// }

var utmConfig = {
    general: {
        allFields: {
            utmMedium: "email"
        },
        fields: {
            "notificationImageHref": {
                utmContent: "picture"
            },
            "featuredImageHref": {
                utmContent: "picture"
            },
            "ctaUrl": {
                utmContent: "cta-button"
            }
        }
    },
    templatesGroups: {
        welcome: {
            templates: [
                "app-subscription-confirmed",
                "app-subscription-to-confirm"
            ],
            allFields: {
                utmCampaign: "welcome-emails"
            }
        },
        account: {
            templates: [
                "email-check",
                "reset-password",
                // reminder folder, but campaign is specific
                "reminder-owner-without-bankaccount"
            ],
            allFields: {
                utmCampaign: "account-emails"
            }
        },
        booking: {
            templates: [
                "booking-checkout-owner",
                "booking-checkout-taker",
                "booking-confirmed-owner",
                "booking-confirmed-taker",
                "booking-pending-owner",
                "booking-pending-taker",
                "item-return-owner",
                "item-return-taker",
                "prebooking-confirmed-owner",
                "prebooking-pending-taker",

                // purchase
                "purchase-booking-checkout-owner",
                "purchase-booking-checkout-taker",
                "purchase-booking-confirmed-owner",
                "purchase-booking-confirmed-taker",
                "purchase-booking-pending-owner",
                "purchase-booking-pending-taker",
                "purchase-prebooking-confirmed-owner",
                "purchase-prebooking-pending-taker"
            ],
            allFields: {
                utmCampaign: "booking-emails"
            }
        },
        conversation: {
            templates: [
                "new-message"
            ],
            allFields: {
                utmCampaign: "conversation-emails"
            }
        },
        gamification: {
            templates: [
                "gamification-level-up",
                "gamification-reward"
            ],
            allFields: {
                utmCampaign: "gamification-emails"
            }
        },
        reminder: { // reminder emails related to bookings
            templates: [
                "reminder-bookings-to-accept",
                "reminder-late-unsigned-assessments",
                "reminder-no-ratings",
                "reminder-upcoming-assessments-giver",
                "reminder-upcoming-assessments-taker"
            ],
            allFields: {
                utmCampaign: "booking-reminder-emails"
            }
        },
        referral: {
            templates: [
                "invite"
            ],
            allFields: {
                utmCampaign: "referral-emails"
            }
        }
    },
    templates: {
    }
};

var reverseIndexedTemplates = getReverseIndexedTemplates();



function getReverseIndexedTemplates() {
    return _.reduce(utmConfig.templatesGroups || {}, (memo, config, groupName) => {
        if (config.templates && config.templates.length) {
            _.forEach(config.templates, templateName => {
                memo[templateName] = memo[templateName] || {};
                memo[templateName][groupName] = true;
            });
        }
        return memo;
    }, {});
}

function isTemplateInGroup(templateName, templateGroupName) {
    return reverseIndexedTemplates[templateName]
        && reverseIndexedTemplates[templateName][templateGroupName];
}

function getUtmTags(templateName, field) {
    var steps = [
        {
            layer: { type: "general" },
            field: { type: "allFields" }
        },
        {
            layer: { type: "general" },
            field: { type: "fields", value: field }
        }
    ];

    _.forEach(getTemplatesGroupsName(), templateGroupName => {
        steps = steps.concat([
            {
                layer: { type: "templatesGroups", value: templateGroupName },
                field: { type: "allFields" }
            },
            {
                layer: { type: "templatesGroups", value: templateGroupName },
                field: { type: "fields", value: field }
            }
        ]);
    });

    steps = steps.concat([
        {
            layer: { type: "templates" },
            field: { type: "allFields" }
        },
        {
            layer:{ type: "templates" },
            field: { type: "fields", value: field }
        }
    ]);

    var params = _.map(steps, step => {
        return getUtmTagsByLayer(templateName, step.layer, step.field);
    });

    return _.assign.apply(null, [{}].concat(params));
}

/**
 * get utm tags by layer
 * @param  {string} templateName
 * @param  {object} field
 * @param  {string} field.type          ["allFields" || "fields"]
 * @param  {string} [field.value]       not required if type is "allFields"
 * @param  {object} layer
 * @param  {string} layer.type          ["general" || "templatesGroups" || "templates"]
 * @param  {string} [layer.value]       not required if type is "general" or "templates"
 * @return {object}
 */
function getUtmTagsByLayer(templateName, layer, field) {
    var arrayFields;

    if (layer.type === "general") {
        if (field.type === "allFields") {
            arrayFields = ["general", "allFields"];
        } else if (field.type === "fields") {
            arrayFields = ["general", "fields", field.value];
        }
    } else if (layer.type === "templatesGroups") {
        if (isTemplateInGroup(templateName, layer.value)) {
            if (field.type === "allFields") {
                arrayFields = ["templatesGroups", layer.value, "allFields"];
            } else if (field.type === "fields") {
                arrayFields = ["templatesGroups", layer.value, "fields", field.value];
            }
        }
    } else if (layer.type === "templates") {
        if (field.type === "allFields") {
            arrayFields = ["templates", templateName, "allFields"];
        } else if (field.type === "fields") {
            arrayFields = ["templates", templateName, "fields", field.value];
        }
    }

    var utmTags = _.cloneDeep(_.get(utmConfig, arrayFields || [], {}));

    // if (! _.isEmpty(utmTags)) {
    //     console.log("Tagging: ", templateName, "layer:", layer, "field:", field, "utm:", utmTags)
    // }

    // utmSource defaults to "template-name-email"
   if (layer.type === "general" && field.type === "allFields" && ! utmTags.utmSource) {
       utmTags.utmSource = templateName + "-email";
   }

    return utmTags;
}

function getTemplatesGroupsName() {
    return _.keys(utmConfig.templatesGroups || {});
}
