/* global document */

var webpage = require('webpage');
var system  = require('system');

var url = system.args[1] || "";

var maxSnapshotDuration = 10000; // 10 seconds

// http://stackoverflow.com/questions/5653207/remove-html-comments-with-regex-in-javascript
var removeComment = function (html) {
    var regex = /<!--[\s\S]*?-->/g;

    return html.replace(regex, "");
};

var fixSvgNamespace = function (html) {
    var regex = /<svg([^>]*)>([^>]*)<use([^>]*)>([^>]*)<\/use>([^>]*)<\/svg>/gi;

    return html.replace(regex, function (match, svgAttrs, space1, useAttrs, space2, space3) {
        var fixedUseAttrs = useAttrs;

        var hasXlink = fixedUseAttrs.indexOf("xlink=");
        if (hasXlink) {
            fixedUseAttrs = fixedUseAttrs.replace(/xlink=/, "xmlns:xlink=");
        } else {
            fixedUseAttrs = 'xlink="http://www.w3.org/1999/xlink" ' + fixedUseAttrs;
        }

        fixedUseAttrs = fixedUseAttrs.replace(/href=/, "xlink:href=");

        return "<svg" + svgAttrs + ">"
                + space1
                + "<use" + fixedUseAttrs + ">" + space2 + "</use>"
                + space3
                + "</svg>";
    });
};

if (url.length > 0) {
    var page = webpage.create();

    page.open(url, function (status) {
        if (status === "success") {
            var startDate = new Date();
            var delay;
            var checker = function () {
                var html;

                // periodically check if snapshot is done
                if (new Date() - startDate < maxSnapshotDuration) {
                    html = page.evaluate(function () {
                        var body = document.getElementsByTagName('body')[0];
                        if (body.getAttribute('data-status') === 'ready') {
                            return document.getElementsByTagName('html')[0].outerHTML;
                        }
                    });
                // max duration reached, take a snapshot even it's not ready
                } else {
                    html = page.evaluate(function () {
                        return document.getElementsByTagName('html')[0].outerHTML;
                    });
                }

                if (html) {
                    html = removeComment(html);

                    // remove all script tags, otherwise they will be interpreted again
                    html = html.replace(/<script.*>.*<\/script>/gi, "");

                    html = fixSvgNamespace(html);

                    clearTimeout(delay);
                    console.log(html);
                    phantom.exit();
                }
            };

            delay = setInterval(checker, 100);
        } else {
            console.log("page error opening");
            phantom.exit();
        }
    });
} else {
    console.log("no url provided");
    phantom.exit();
}
