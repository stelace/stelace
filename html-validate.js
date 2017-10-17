var htmlValidate = require('html-angular-validate');
var fs           = require('fs');

var outputFilename = "html-validate-result.json";

var source = [
    // "views/**/*"
    "assets/app/**/*.html"
];

var options = {
    angular: true,
    customtags: [
        "data-*",
        "sip-*",
        "uib-*",
        "zf-*",
    ],
    customattrs: [
        "sip-*",
        "uib-*",
        "zf-*",
    ],
    relaxerror: [
        "Element “link” is missing required attribute “property”",
        "Bad character “%” after “<”",
        "Start tag seen without seeing a doctype first",
        "Element “head” is missing a required instance of child element “title”",
        "The document is not mappable to XML 1.0 due to two consecutive hyphens in a comment",
        "Consecutive hyphens did not terminate a comment",
        "for attribute “href” on element “a”: Illegal character in path segment: “{” is not allowed",
        "}}” for attribute",
        "This document appears to be written in",
        "Consider adding a “lang” attribute to the “html” start tag"
    ],
    reportpath: null,
    reportCheckstylePath: null
};

htmlValidate
    .validate(source, options)
    .then(result => {
        fs
            .writeFile(outputFilename, JSON.stringify(result, null, 2), err => {
                if (err) {
                    console.log(err);
                } else {
                    console.log("Html validation done");
                }
            });
    })
    .catch(err => {
        console.log(err);
    });
