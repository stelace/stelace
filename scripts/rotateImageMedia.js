/* global BootstrapService, Media */

var Sails = require('sails');
var fs    = require('fs');
var path  = require('path');
var yargs = require('yargs');
var gm    = require('gm');

global._       = require('lodash');
global.Promise = require('bluebird');

var argv = yargs
            .usage("Usage: $0 --mediaId [num] (--cw [num] | --ccw [num])")
            .demand("mediaId")
            .choices("cw", [1, 2, 3])
            .choices("ccw", [1, 2, 3])
            .argv;

if (argv.mediaId !== parseInt(argv.mediaId, 10)) {
    console.log("mediaId argument must be a number");
    process.exit();
}
if (! argv.cw && ! argv.ccw) {
    console.log("Missing clockwise or counter clockwise");
    process.exit();
}

Sails.load({
    models: {
        migrate: "safe"
    },
    hooks: {
        grunt: false,
        sockets: false,
        pubsub: false
    }
}, function (err, sails) {
    if (err) {
        console.log("\n!!! Fail script launch: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    var mediaId = argv.mediaId;
    var cw      = argv.cw || 0;
    var ccw     = argv.ccw || 0;

    var degrees = cw * 90 - ccw * 90;

    Promise
        .resolve()
        .then(() => {
            return Media.findOne({ id: mediaId });
        })
        .then(media => {
            if (! media) {
                throw new NotFoundError();
            }
            if (media.type !== "img") {
                throw new BadRequestError("media not an image");
            }

            var filepath    = path.join(sails.config.uploadDir, Media.getStorageFilename(media));
            var tmpFilepath = filepath + "-tmp";

            return [
                media,
                filepath,
                tmpFilepath,
                getSize(filepath),
                rotateImage(filepath, tmpFilepath, degrees)
                    .catch(err => {
                        var error = new Error("Rotation process failed");
                        error.err = err;
                        throw error;
                    })
            ];
        })
        .spread((media, filepath, tmpFilepath, size) => {
            var newDimensions;

            if (degrees % 180 === 0) {
                newDimensions = {
                    width: size.width,
                    height: size.height
                };
            } else {
                newDimensions = {
                    width: size.height,
                    height: size.width
                };
            }

            return [
                media,
                fs.renameAsync(tmpFilepath, filepath),
                Media.updateOne(media.id, newDimensions)
            ];
        })
        .spread(media => {
            return Media.deleteCustomSizeFiles(media.id);
        })
        .then(() => {
            console.log("Success");
        })
        .catch(err => {
            console.log("Error: " + err);
        })
        .finally(() => {
            sails.lowerSafe();
        });



    function getSize(filepath) {
        return new Promise((resolve, reject) => {
                gm(filepath).size((err, size) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(size);
                    }
                });
            });
    }

    function rotateImage(filepath, newFilepath, degrees) {
        return new Promise((resolve, reject) => {
            gm(filepath)
                .rotate("#000", degrees)
                .write(newFilepath, function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
        });
    }
});
