var webpage = require('webpage');
var system  = require('system');

var urlOrFilepath = system.args[1] || "";
var destPath      = system.args[2] || "";
var options       = system.args[3] || "{}";

try {
    options = JSON.parse(options);
} catch (e) {
    options = {};
}

if (urlOrFilepath.length > 0 || destPath) {
    var page = webpage.create();

    var paperSize = {
        format: "A4",
        orientation: "portrait",
        margin: {
            top: "2cm",
            left: "2cm",
            right: "2cm",
            bottom: "2cm"
        }
    };

    if (options.header) {
        paperSize.margin.top = "0cm";
        paperSize.header = {
            height: options.header.height || "2cm",
            contents: phantom.callback(function (/* pageNum, numPages */) {
                return options.header.text;
            })
        };
    }

    if (options.footer) {
        paperSize.margin.bottom = "0cm";
        paperSize.footer = {
            height: options.footer.height || "2cm",
            contents: phantom.callback(function (/* pageNum, numPages */) {
                return options.footer.text;
            })
        };
    }

    page.paperSize = paperSize;

    page.open(urlOrFilepath, function (status) {
        if (status === "success") {
            page.render(destPath);
            phantom.exit();
        } else {
            console.log("ERROR_PAGE_OPENING");
            phantom.exit();
        }
    });
} else {
    console.log("MISSING_PARAMS");
    phantom.exit();
}
