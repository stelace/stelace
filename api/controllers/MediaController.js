/* global Listing, Media, MediaService, User */

/**
 * MediaController
 *
 * @description :: Server-side logic for managing media
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

// https://github.com/sails101/file-uploads/blob/master/api/controllers/FileController.js#L15

module.exports = {

    find: find,
    findOne: findOne,
    create: create,
    update: update,
    destroy: destroy,

    my: my,
    get: get,
    getOld: getOld,
    download: download,
    upload: upload

};

var path = require('path');
var gm   = require('gm');
var fs   = require('fs');
var Uuid = require('uuid');
var Url  = require('url');

Promise.promisifyAll(fs);

var logoPaths = {
    small: path.join(__dirname, "../assets/img", "Sharinplace-logo-allwhite-small-shadow.png"),
    normal: path.join(__dirname, "../assets/img", "Sharinplace-logo-allwhite-shadow.png")
};
var logoSizes = {
    small: null,
    normal: null
};
var logoBreakpoints = {
    small: 2400,
    normal: null
};
var mediaMinSizeForLogo = { width: 600, height: 240 };
var logoMargin          = { bottom: 10, right: 20 };

function find(req, res) {
    return res.forbidden();
}

function findOne(req, res) {
    return res.forbidden();
}

function create(req, res) {
    return res.forbidden();
}

async function update(req, res) {
    var id = req.param("id");
    var name = req.param("name");

    var access = "self";

    if (! name) {
        return res.badRequest();
    }

    try {
        let media = await Media.findOne({ id });
        if (!media) {
            throw new NotFoundError();
        }
        if (media.userId !== req.user.id) {
            throw new ForbiddenError();
        }

        media = await Media.updateOne(media.id, { name });
        res.json(Media.expose(media, access));
    } catch (err) {
        res.sendError(err);
    }
}

function destroy(req, res) {
    return res.forbidden();
}

function get(req, res) {
    var id          = req.param("id");
    var uuid        = req.param("uuid");
    var size        = req.param("size");
    var displayType = req.param("displayType") || "cover";
    var threshold   = req.param("threshold");

    return Promise
        .resolve()
        .then(function () {
            return findMedia(id, uuid);
        })
        .then(function (media) {
            var filename = media.name + (media.extension ? "." + media.extension : "");

            if (media.type === "img") {
                return [
                    getServedImageFilepath(media),
                    filename,
                    false,
                    true
                ];
            } else {
                return [
                    path.join(sails.config.uploadDir, Media.getStorageFilename(media)),
                    filename,
                    (media.type === "pdf"),
                    false
                ];
            }
        })
        .spread(function (filepath, filename, noIndex, cache) {
            var escapedFilename = encodeURIComponent(filename);

            var headers = {
                "Content-Disposition": `inline; filename="${escapedFilename}"`,
                "Cache-Control": cache ? "public, max-age=31536000" : "no-cache"
            };

            if (noIndex) {
                headers["X-Robots-Tag"] = "noindex, nofollow";
            }

            res
                .set(headers)
                .sendfile(filepath);
        })
        .catch(res.sendError);



    function getMatchedSize(size) {
        return _.find(Media.get("imgSizes"), function (imgSize) {
            return imgSize.label === size;
        });
    }

    function findMedia(id, uuid) {
        return Media
            .findOne({ id: id })
            .then(function (media) {
                if (! media || media.uuid !== uuid) {
                    throw new NotFoundError();
                }

                return media;
            });
    }

    function getServedImageFilepath(media) {
        return Promise
            .resolve()
            .then(() => {
                var filepathOriginal = path.join(sails.config.uploadDir, Media.getStorageFilename(media));
                var matchedSize;

                if (size) {
                    matchedSize = getMatchedSize(size);

                    if (! matchedSize) {
                        throw new BadRequestError();
                    }
                }
                if (! _.contains(Media.get("displayTypes"), displayType)) {
                    throw new BadRequestError();
                }

                if (! size) {
                    return [
                        media,
                        filepathOriginal,
                        true,
                        µ.existsSync(filepathOriginal)
                    ];
                } else {
                    return getResizedImageFilepath(media, {
                        size: size,
                        displayType: displayType,
                        threshold: threshold,
                        matchedSize: matchedSize
                    });
                }
            })
            .spread((media, filepath, isOriginal, existingFile) => {
                if (isOriginal && ! existingFile) {
                    throw new NotFoundError();
                }

                return getImageWithLogo(media, filepath, isOriginal);
            });
    }

    function getResizedImageFilepath(media, args) {
        var size        = args.size;
        var displayType = args.displayType;
        var threshold   = args.threshold;
        var matchedSize = args.matchedSize;

        var filepathOriginal = path.join(sails.config.uploadDir, Media.getStorageFilename(media));
        var filepath;

        if (displayType === "smart") {
            displayType = getSmartDisplayType(threshold);
        }

        filepath = path.join(sails.config.uploadDir, Media.getStorageFilename(media, { size, displayType }));

        if (! µ.existsSync(filepath)) {
            var process = getImageProcessing(displayType);

            if (process) {
                return doImageProcessing(process, filepath)
                    .then(() => {
                        return [
                            media,
                            filepath,
                            false,
                            false
                        ];
                    })
                    .catch(err => {
                        var error = new Error("Image processing");
                        error.err      = err;
                        error.media    = media.id;
                        error.filepath = filepath;
                        throw error;
                    });
            } else {
                return [
                    media,
                    filepathOriginal,
                    true,
                    µ.existsSync(filepathOriginal)
                ];
            }
        } else {
            return [
                media,
                filepath,
                false,
                true
            ];
        }



        function doImageProcessing(process, filepath) {
            return new Promise((resolve, reject) => {
                process.write(filepath, function (err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        }

        function getImageProcessing(type) {
            if (type === "cover") {
                return gm(filepathOriginal)
                        .resize(matchedSize.width, matchedSize.height, "^")
                        .gravity("Center")
                        .crop(matchedSize.width, matchedSize.height);
            } else if (type === "contain") {
                return getContainProcessing();
            } else if (type === "containOriginal") {
                // do not up-scale beyond original image size
                if (matchedSize.width < media.width || matchedSize.height < media.height) {
                    return getContainProcessing();
                } else {
                    return;
                }
            }



            function getContainProcessing() {
                return gm(filepathOriginal)
                    .resize(matchedSize.width, matchedSize.height);
            }
        }

        function getSmartDisplayType(threshold) {
            if (! threshold) {
                throw new BadRequestError();
            }

            var split = threshold.split("t");
            if (split.length !== 2) {
                throw new BadRequestError();
            }

            var w = parseInt(split[0], 10);
            var h = parseInt(split[1], 10);
            if (isNaN(w) || isNaN(h)) {
                throw new BadRequestError();
            }

            var ratio = w / h;
            var mediaRatio = media.width / media.height;

            return (mediaRatio < ratio ? "cover" : "contain");
        }
    }

    function getImageWithLogo(media, filepath, isOriginal) {
        var originalWithLogoPath = path.join(sails.config.uploadDir, Media.getStorageFilename(media, { withLogo: true }));

        return Promise
            .resolve()
            .then(() => {
                return Promise
                    .resolve()
                    .then(() => {
                        return [
                            ! logoSizes.small ? getSize(logoPaths.small) : null,
                            ! logoSizes.normal ? getSize(logoPaths.normal) : null
                        ];
                    })
                    .spread((smallSize, size) => {
                        if (smallSize) {
                            logoSizes.small = smallSize;
                        }
                        if (size) {
                            logoSizes.normal = size;
                        }
                    });
            })
            .then(() => {
                if (media.field !== "listing") {
                    return filepath;
                }
                if (isOriginal && µ.existsSync(originalWithLogoPath)) {
                    return originalWithLogoPath;
                }

                // do not add logo if the image is too small
                return getSize(filepath)
                    .then(size => {
                        if (size.width < mediaMinSizeForLogo.width
                         || size.height < mediaMinSizeForLogo.height
                        ) {
                            return filepath;
                        }

                        return createNewImageWithLogo(size);
                    })
                    .catch(() => {
                        return filepath;
                    });
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

        function resize(filepath, destPath, width, height) {
            return new Promise((resolve, reject) => {
                gm(filepath)
                    .resize(width, height)
                    .write(destPath, function (err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
            });
        }

        function composite(addedFilepath, filepath, destPath, geometry) {
            geometry = geometry || "+0+0";

            return new Promise((resolve, reject) => {
                gm()
                    .command("composite")
                    .in("-geometry", geometry)
                    .in(addedFilepath)
                    .in(filepath)
                    .write(destPath, function (err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
            });
        }

        function createNewImageWithLogo(imgSize) {
            var destPath        = isOriginal ? originalWithLogoPath : filepath + "-logoTmp";
            var logoMatchedSize = getLogoSize(imgSize);
            var logoPath        = logoPaths[logoMatchedSize];
            var logoSize        = logoSizes[logoMatchedSize];
            var tmpLogoPath;

            return Promise
                .resolve()
                .then(() => {
                    var newLogoWidth = getLogoNewWidth(imgSize, logoSize);

                    if (newLogoWidth === logoSize.width) {
                        return [
                            logoPath,
                            getGeometry(imgSize, logoSize, logoMargin)
                        ];
                    } else {
                        tmpLogoPath = path.join(sails.config.tmpDir, "logo-" + Math.round(new Date().getTime()) + ".png");

                        return resize(logoPath, tmpLogoPath, newLogoWidth)
                            .then(() => {
                                return getSize(tmpLogoPath);
                            })
                            .then(tmpLogoSize => {
                                return [
                                    tmpLogoPath,
                                    getGeometry(imgSize, tmpLogoSize, logoMargin)
                                ];
                            })
                            .catch(err => {
                                fs.unlinkAsync(tmpLogoPath).catch(() => { return; });
                                throw err;
                            });
                    }
                })
                .spread((logoPath, geometry) => {
                    return composite(logoPath, filepath, destPath, geometry)
                        .finally(() => {
                            if (tmpLogoPath) {
                                fs.unlinkAsync(tmpLogoPath).catch(() => { return; });
                            }
                        });
                })
                .then(() => {
                    if (isOriginal) {
                        return originalWithLogoPath;
                    }

                    return fs
                        .renameAsync(destPath, filepath)
                        .catch(() => {
                            return fs.unlinkAsync(destPath);
                        })
                        .then(() => filepath)
                        .catch(() => filepath);
                })
                .catch(() => filepath);
        }

        function getLogoSize(imgSize) {
            var sizeName;

            _.forEach(logoBreakpoints, (breakpoint, name) => {
                if (sizeName) {
                    return;
                }

                if (breakpoint && imgSize.width <= breakpoint) {
                    sizeName = name;
                }
            });

            if (! sizeName) {
                sizeName = _.last(_.keys(logoBreakpoints));
            }

            return sizeName;
        }

        function getGeometry(imgSize, logoSize, logoMargin) {
            var translation = {
                x: imgSize.width - logoSize.width - logoMargin.right,
                y: imgSize.height - logoSize.height - logoMargin.bottom
            };

            var geometry = "";
            if (translation.x > 0) {
                geometry += "+";
            }
            geometry += translation.x;
            if (translation.y > 0) {
                geometry += "+";
            }
            geometry += translation.y;

            return geometry;
        }

        function getLogoNewWidth(imgSize, logoSize) {
            var widthScale = 1;

            if (600 <= imgSize.width && imgSize.width < 1200) {
                widthScale = 0.2;
            } else if (1200 <=  imgSize) {
                widthScale = 0.1;
            }

            var newWidth = Math.round(imgSize.width * widthScale);

            if (widthScale === 1 || logoSize.width < newWidth) {
                return logoSize.width;
            } else {
                return newWidth;
            }
        }
    }
}

async function getOld(req, res) {
    const {
        id,
        uuid,
    } = req.allParams();

    try {
        const media = await Media.findOne({ id, uuid });
        if (!media) {
            throw new NotFoundError();
        }

        const parsedUrl = Url.parse(req.url);

        // add the media extension and redirect
        const redirectedUrl = `${req.path}.${media.extension}${parsedUrl.search || ""}`;
        res.redirect(redirectedUrl);
    } catch (err) {
        res.sendError(err);
    }
}

async function my(req, res) {
    var access = "self";

    try {
        const hashMedias = await User.getMedia([req.user]);
        res.json(Media.expose(hashMedias[req.user.id], access));
    } catch (err) {
        res.sendError(err);
    }
}

async function download(req, res) {
    const id = req.param("id");
    const uuid = req.param("uuid");

    await Media.downloadFile({
        id,
        uuid,
        res,
        userId: req.user.id,
    });
}

async function upload(req, res) {
    const field    = req.param("field");
    const targetId = parseInt(req.param("targetId"), 10);
    const name     = req.param("name");
    const url      = req.param("url");
    const access = "self";

    if (!field ||! _.includes(Media.get("fields"), field)
     || !targetId|| isNaN(targetId)
    ) {
        return res.badRequest();
    }

    try {
        if (field === 'user') {
            if (req.user.id !== targetId) {
                throw new ForbiddenError();
            }
        } else if (field === 'listing') {
            const listing = await Listing.findOne({ id: targetId });
            if (!listing) {
                const error = new NotFoundError('Listing not found');
                error.listingId = targetId;
                throw error;
            }
            if (listing.ownerId !== req.user.id) {
                throw new ForbiddenError();
            }
        }

        let media;

        if (url) {
            media = await Media.create({
                name: name || url,
                uuid: Uuid.v4(),
                type: 'link',
                userId: req.user.id,
                field,
                targetId,
                url,
            });
        } else {
            media = await MediaService.uploadFile({
                req,
                res,
                field,
                targetId,
                logger: req.logger,
                name,
            });
        }

        res.json(Media.expose(media, access));
    } catch (err) {
        res.sendError(err);
    }
}
