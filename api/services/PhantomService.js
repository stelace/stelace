module.exports = {

    launchScript: launchScript,
    snapshotHtml: snapshotHtml,
    exportToPdf: exportToPdf

};

var fs           = require('fs');
var path         = require('path');
var childProcess = require('child_process');
var phantomjs    = require('phantomjs');
var binPath      = phantomjs.path;

Promise.promisifyAll(fs);

function getChildArgs(args) {
    var error;

    return Promise
        .resolve()
        .then(function () {
            if (! args.scriptName) {
                error = new Error("scriptName missing");
                throw error;
            }
            if (typeof args.scriptName !== "string") {
                error = new Error("incorrect scriptName");
                throw error;
            }

            var childArgs = args.childArgs || [];
            var isValidChildArgs = _.reduce(childArgs, function (memo, arg) {
                if (typeof arg !== "string") {
                    memo = memo && false;
                }
                return memo;
            }, true);
            if (! isValidChildArgs) {
                error = new Error("bad format parameters");
                throw error;
            }

            var filePath = path.join(__dirname, "../../scripts_phantom", args.scriptName);
            var childArgsTmp = _.clone(childArgs);
            childArgsTmp.unshift(filePath);

            return childArgsTmp;
        });
}

function launchScript(args) {
    return Promise
        .resolve()
        .then(function () {
            return getChildArgs(args);
        })
        .then(function (childArgs) {
            if (args.stream) {
                var spawn = childProcess.spawn;
                var task = spawn(binPath, childArgs);

                return new Promise(function (resolve, reject) {
                    task.on("error", function (err) {
                        reject(err);
                    });
                    task.on("close", function () {
                        resolve();
                    });
                    task.stdout.pipe(args.stream);
                });
            } else {
                return new Promise(function (resolve, reject) {
                    childProcess.execFile(binPath, childArgs, function (err, stdout /*, stderr */) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(stdout);
                        }
                    });
                });
            }
        });
}

function snapshotHtml(args) {
    var error;

    return Promise
        .resolve()
        .then(function () {
            if (! args.url) {
                error = new Error("url missing");
                throw error;
            }
            if (! args.filePath) {
                error = new Error("filePath missing");
                throw error;
            }

            var scriptName = (args.spa ? "snapshot-html-spa.js" : "snapshot-html.js");
            var destPath = path.join(sails.config.snapshotsDir, args.filePath);
            var wstream = fs.createWriteStream(destPath);

            return launchScript({
                scriptName: scriptName,
                childArgs: [args.url],
                stream: wstream
            });
        });
}

function exportToPdf(args) {
    var error;

    return Promise
        .resolve()
        .then(function () {
            if (! args.urlOrFilepath) {
                error = new Error("missing url or filepath");
                throw error;
            }
            if (! args.destPath) {
                error = new Error("missing destination path");
                throw error;
            }

            var scriptName = "exportToPdf.js";

            var childArgs = [
                args.urlOrFilepath,
                args.destPath
            ];

            if (args.options) {
                childArgs.push(JSON.stringify(args.options));
            }

            return launchScript({
                scriptName: scriptName,
                childArgs: childArgs
            });
        });
}
