/* global document */

var webpage = require('webpage');
var system  = require('system');

var url = system.args[1] || "";

if (url.length > 0) {
    var page = webpage.create();

    page.open(url, function (status) {
        if (status === "success") {
            var html = page.evaluate(function () {
                return document.getElementsByTagName('html')[0].outerHTML;
            });

            console.log(html);
            phantom.exit();
        } else {
            console.log("page error opening");
            phantom.exit();
        }
    });
} else {
    console.log("no url provided");
    phantom.exit();
}
