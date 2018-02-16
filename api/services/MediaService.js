/* global ImageService, Listing, Media, MicroService */

module.exports = {

    updateMedia,
    uploadMedia,
    getFileToServe,
    getServeFileHeaders,
    uploadFile,
    downloadFile,
    createMediaFromFile,
    setImagePlaceholders,
    downloadFromUrl,

};

const fs      = require('fs');
const path    = require('path');
const Uuid    = require('uuid');
const request = require('request');
const _ = require('lodash');
const Promise = require('bluebird');
const createError = require('http-errors');

Promise.promisifyAll(fs);
Promise.promisifyAll(request, { multiArgs: true });

const maxSizeUploadInBytes = 50000000; // 50MB

/**
 * @param {Number} mediaId
 * @param {Object} attrs
 * @param {String} attrs.name
 * @param {Object} options
 * @param {Number} options.userId - if specified, check if the listing owner id matches the provided userId
 * @result {Object} updated media
 */
async function updateMedia(mediaId, { name }, { userId }) {
    const media = await Media.findOne({ id: mediaId });
    if (!media) {
        throw createError(404);
    }
    if (userId && media.userId !== userId) {
        throw createError(403);
    }

    const updatedMedia = await Media.updateOne(media.id, { name });
    return updatedMedia;
}

/**
 * Upload media (static file or link)
 * @param {Object} attrs
 * @param {String} [attrs.field]
 * @param {Number} [attrs.targetId]
 * @param {String} [attrs.name]
 * @param {String} [attrs.url] - url or req.file must be defined
 * @param {Object} options
 * @param {Object} [options.req]
 * @param {Object} [options.res] - required if uploading a file (req.file defined)
 * @param {Number} options.userId
 * @result {Object} uploaded media
 */
async function uploadMedia(attrs, { req, res, userId } = {}) {
    const {
        field,
        targetId,
        name,
        url,
    } = attrs;

    if (field) {
        _checkField({ field, targetId });
    }
    if (field && targetId) {
        await _checkTarget({ field, targetId, userId });
    }

    let media;

    if (url) {
        media = await Media.create({
            name: name || url,
            uuid: Uuid.v4(),
            type: 'link',
            userId,
            field,
            targetId,
            url,
        });
    } else {
        media = await uploadFile({
            req,
            res,
            field,
            targetId,
            logger: req.logger,
            name,
            userId,
        });
    }

    return media;
}

function _checkField({ field, targetId }) {
    if (!_.includes(Media.get('fields'), field)) {
        throw createError(400);
    }
    if (field !== 'content' && !targetId) {
        throw createError(400);
    }
}

async function _checkTarget({ field, targetId, userId }) {
    if (field === 'user') {
        if (userId !== targetId) {
            throw createError(403);
        }
    } else if (field === 'listing') {
        const listing = await Listing.findOne({ id: targetId });
        if (!listing) {
            throw createError(404, 'Listing not found', { listingId: targetId });
        }
        if (listing.ownerId !== userId) {
            throw createError(403);
        }
    }
}

/**
 * Get the file path for the asset media (to serve static image or pdf)
 * @param {Object} attrs
 * @param {Number} attrs.id
 * @param {String} [attrs.uuid] - if specified, check if the media has the provided uuid (prevent media brute-force crawl)
 * @param {String} [attrs.size] - allowed sizes are displayed in Media.js model (e.g. format 75x50)
 * @param {String} [attrs.displayType = 'cover']
 * @param {String} attrs.threshold - e.g. format 10t50
 * @result {Object} res
 * @result {String} res.filepath - path of the physical file
 * @result {String} res.filename - displayed name by the browser
 * @result {Boolean} res.indexable - true if indexable by bots
 * @result {Boolean} res.cache - true to have a cache duration
 */
async function getFileToServe(attrs) {
    const {
        mediaId,
        uuid,
        size,
        displayType = 'cover',
        threshold,
    } = attrs;

    const media = await Media.findOne({ id: mediaId });
    if (!media || uuid && media.uuid !== uuid) {
        throw createError(404);
    }

    const filename = Media.getServeFilename(media);

    // no specific processing if the media isn't an image
    if (media.type !== 'img') {
        return {
            filepath: path.join(sails.config.uploadDir, Media.getStorageFilename(media)),
            filename,
            indexable: media.type !== 'pdf',
            cache: false,
        };
    }

    const filepath = await _getServedImageFilepath({ media, size, displayType, threshold });

    return {
        filepath,
        filename,
        indexable: true,
        cache: true,
    };
}

async function _getServedImageFilepath({ media, size, displayType, threshold }) {
    if (!_.includes(Media.get('displayTypes'), displayType)) {
        throw createError(400);
    }

    const originalFilepath = path.join(sails.config.uploadDir, Media.getStorageFilename(media));
    let resizedObj;
    let filepath;

    if (!size) {
        filepath = originalFilepath;
    } else {
        let imageSize = Media.getAllowedImageSize(size);
        if (!imageSize) {
            throw createError(400);
        }

        resizedObj = await _getResizedImageFilepath({
            media,
            size,
            width: imageSize.width,
            height: imageSize.height,
            displayType,
            threshold,
        });
        filepath = resizedObj.filepath;
    }

    if (!MicroService.existsSync(filepath)) {
        throw createError(404);
    }

    // check if there is a logo image processing
    if (!Media.get('serveImageWithLogo')) {
        return filepath;
    }

    try {
        const fileWithLogo = await _getImageWithLogo({
            media,
            filepath,
            size: resizedObj.size,
            displayType: resizedObj.displayType,
        });
        return fileWithLogo;
    } catch (err) {
        // an error when generating logo isn't important
        return filepath;
    }
}

/**
 * @param {Object} media
 * @param {String} size
 * @param {Number} width
 * @param {Number} height
 * @param {String} displayType
 * @param {String} threshold
 * @result {Object} res
 * @result {String} res.filepath
 * @result {String} res.size - can be different from input one
 * @result {String} res.displayType - can be different from input one
 */
async function _getResizedImageFilepath({
    media,
    size,
    width,
    height,
    displayType,
    threshold,
}) {
    const originalFilepath = path.join(sails.config.uploadDir, Media.getStorageFilename(media));

    let realDisplayType = displayType;
    if (displayType === 'smart') {
        if (!threshold) {
            throw createError(400, 'Threshold missing');
        }

        realDisplayType = Media.getSmartDisplayType(media, threshold);
    }

    const filepath = path.join(sails.config.uploadDir, Media.getStorageFilename(media, { size, displayType: realDisplayType }));

    // if the file exists, stop the process
    if (MicroService.existsSync(filepath)) {
        return {
            filepath,
            size,
            displayType: realDisplayType,
        };
    }

    try {
        if (realDisplayType === 'cover') {
            await ImageService.resizeCover(originalFilepath, filepath, { width, height });
        } else if (realDisplayType === 'contain') {
            await ImageService.resize(originalFilepath, filepath, { width, height });
        } else if (realDisplayType === 'containOriginal') {
            // do not up-scale beyond original image size
            if (media.width <= width && media.height <= height) {
                return {
                    filepath: originalFilepath,
                    size: null,
                    displayType: null,
                };
            }

            await ImageService.resize(originalFilepath, filepath, { width, height });
        }
    } catch (err) {
        const error = new Error('Image processing');
        error.err      = err;
        error.media    = media.id;
        error.filepath = filepath;
        throw error;
    }

    return {
        filepath,
        size,
        displayType: realDisplayType,
    };
}

/**
 * @param {Object} media
 * @param {String} filepath
 * @param {String} size
 * @param {String} displayType
 * @result {String} image with logo filepath
 */
async function _getImageWithLogo({ media, filepath, size, displayType }) {
    // only put logo on listing images
    if (media.field !== 'listing') {
        return filepath;
    }

    const imageWithLogoFilepath = path.join(sails.config.uploadDir, Media.getStorageFilename(media, { size, displayType, withLogo: true }));

    if (MicroService.existsSync(imageWithLogoFilepath)) {
        return imageWithLogoFilepath;
    }

    const imgSize = await ImageService.getSize(filepath);
    const mediaMinSizeForLogo = Media.get('mediaMinSizeForLogo');

    // check if the media have the minimum size for logo
    if (mediaMinSizeForLogo
     && (imgSize.width < mediaMinSizeForLogo.width || imgSize.height < mediaMinSizeForLogo.height)
    ) {
        return filepath;
    }

    const logoSizeName = Media.getLogoSizeName(imgSize.width);
    const logoPath = Media.get('logoPaths')[logoSizeName];
    if (!logoPath) {
        throw new Error('Logo path not found');
    }

    const logoSize = await ImageService.getSize(logoPath);

    const newLogoSize = Media.getLogoNewSize(imgSize, logoSize);
    const geometry = Media.getGeometry(imgSize, newLogoSize, Media.get('logoMargin'));

    // if no logo resize
    if (newLogoSize.width === logoSize.width) {
        await ImageService.composite(logoPath, filepath, imageWithLogoFilepath, geometry);
    } else {
        const tmpLogoPath = path.join(sails.config.tmpDir, Uuid.v4());
        await ImageService.resize(logoPath, tmpLogoPath, newLogoSize);
        await ImageService.composite(tmpLogoPath, filepath, imageWithLogoFilepath, geometry)
            .catch(err => {
                fs.unlinkAsync(tmpLogoPath).catch(() => { return; });
                throw err;
            });

        fs.unlinkAsync(tmpLogoPath).catch(() => { return; });
    }

    return imageWithLogoFilepath;
}

/**
 * @param {String} filepath
 * @param {String} filename
 * @param {Boolean} cache
 * @param {Boolean} indexable
 * @result {Object} response headers to send
 */
function getServeFileHeaders({ filename, indexable, cache }) {
    const escapedFilename = encodeURIComponent(filename);

    const headers = {
        'Content-Disposition': `inline; filename="${escapedFilename}"`,
        'Cache-Control': cache ? 'public, max-age=31536000' : 'no-cache',
    };

    if (!indexable) {
        headers['X-Robots-Tag'] = 'noindex, nofollow';
    }

    return headers;
}

/**
 * Upload file
 * @param  {object} req
 * @param  {object} res
 * @param  {string} [field]
 * @param  {number} [targetId]
 * @param  {string} [name]
 * @param  {object} [logger]
 * @param  {string[]} [authorizedTypes]
 * @param  {string} [inputFileName]
 * @param  {number} [maxSize] - in bytes
 * @param  {number} userId
 * @return {object} created media
 */
async function uploadFile({
    req,
    res,
    field,
    targetId,
    name,
    logger,
    authorizedTypes,
    inputFileName = 'media',
    maxSize = maxSizeUploadInBytes,
    userId,
}) {
    const uploadedFile = await uploadFromInputFile({
        req,
        res,
        inputFileName,
        uploadDest: sails.config.tmpDir,
        maxSizeInBytes: maxSize,
    });

    const {
        fd: filepath,
        filename, // original filename
        size,
    } = uploadedFile;

    const media = await createMediaFromFile({
        filepath,
        size,
        name: name || Media.getName(filename),
        extension: Media.getExtension(filename),
        uuid: Media.getName(filepath),
        authorizedTypes,
        maxSize,
        field,
        targetId,
        userId,
        logger,
    });

    return media;
}

async function uploadFromInputFile({
    req,
    res,
    inputFileName,
    uploadDest,
    maxSizeInBytes,
}) {
    res.setTimeout(0);

    return await new Promise((resolve, reject) => {
        req
            .file(inputFileName)
            .upload({
                dirname: uploadDest,
                maxBytes: maxSizeInBytes,
            }, (err, uploadedFiles) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(uploadedFiles[0]);
                }
            });
    });
}

/**
 * From a file, create the media and perform some custom operations (image compression...)
 * @param  {string} filepath
 * @param  {number} [size] - in bytes
 * @param  {string} [filename] - original file name
 * @param  {string} [extension]
 * @param  {string} [uuid]
 * @param  {string} [authorizedTypes]
 * @param  {number} [maxSize] - in bytes
 * @param  {string} [field]
 * @param  {number} [targetId]
 * @param  {number} userId
 * @param  {object} [logger]
 * @return {object} created media
 */
async function createMediaFromFile({
    filepath,
    size,
    name,
    extension,
    uuid = Uuid.v4(),
    authorizedTypes,
    maxSize,
    field,
    targetId,
    userId,
    logger,
}) {
    if (!size) {
        size = await MicroService.getSize(filepath);
    }
    if (!MicroService.existsSync(filepath)) {
        throw createError('File not found');
    }

    if (!extension) {
        throw createError('Missing extension');
    }

    const type = Media.getTypeFromExtension(extension);
    if (!type) {
        throw createError('Bad media type');
    }

    if (authorizedTypes && !_.includes(authorizedTypes, type)) {
        throw createError(400, 'Non authorized extension');
    }
    if (maxSize && maxSize < size) {
        throw createError(400, 'Max size file exceeded', {
            size,
            maxSize,
        });
    }

    let dimensions = {};
    if (type === 'img') {
        dimensions = await ImageService.getSize(filepath);
    }

    const createAttrs = {
        field,
        targetId,
        userId,
        name,
        extension,
        uuid,
        type,
        width: dimensions.width,
        height: dimensions.height,
    };

    const media = await Media.create(createAttrs);

    try {
        const finalDestPath = path.join(sails.config.uploadDir, Media.getStorageFilename(media));
        await fs.renameAsync(filepath, finalDestPath);
    } catch (err) {
        // destroy the file and the media if failed
        await fs.unlinkAsync(filepath).catch(() => null);
        await Media.destroy({ id: media.id }).catch(() => null);
        throw err;
    }

    if (type === 'img') {
        await runImageOperations(media, { logger }).catch(() => null);
    }

    return media;
}

async function runImageOperations(media, { logger }) {
    const filepath = path.join(sails.config.uploadDir, Media.getStorageFilename(media));
    const tmpFilepath = path.join(sails.config.tmpDir, Media.getStorageFilename(media));

    try {
        await ImageService.autoOrient(filepath, tmpFilepath);
        await fs.renameAsync(tmpFilepath, filepath);
    } catch (err) {
        logger.error({
            err,
            mediaId: media.id,
            filepath: tmpFilepath,
        }, 'Auto-orient file after upload failed');
        await fs.unlinkAsync(tmpFilepath).catch(() => null);
    }

    try {
        await ImageService.compress(filepath, sails.config.tmpDir);
        await fs.renameAsync(tmpFilepath, filepath);
    } catch (err) {
        logger.error({
            err,
            mediaId: media.id,
            filepath: tmpFilepath,
        }, 'Rename file after upload failed');
        await fs.unlinkAsync(tmpFilepath).catch(() => null);
    }

    setImagePlaceholders(media).catch(() => null); // not blocking
}

async function setImagePlaceholders(media) {
    const filepath = path.join(sails.config.uploadDir, Media.getStorageFilename(media));

    const [
        color,
        placeholder,
    ] = await Promise.all([
        ImageService.getColor(filepath),
        ImageService.getPlaceholder(filepath),
    ]);

    const placeholderTooLarge = !!(placeholder && placeholder.length > 300);
    return await Media.updateOne({ id: media.id }, {
        color,
        placeholder: placeholderTooLarge ? null : placeholder,
    });
}


/**
 * Download file
 * @param  {object} res
 * @param  {number} id              - (id, uuid) or media must be defined
 * @param  {string} uuid
 * @param  {object} media
 * @param  {number} [userId]          - if specified, only allow download if userId matches with the media userId
 * @param  {string} [exposeFilename]  - name of the file that is displayed when downloading the file
 */
async function downloadFile({
    res,
    id,
    uuid,
    media,
    userId,
    exposeFilename,
}) {
    try {
        if (((!id || !uuid) && !media)
         || !res
        ) {
            return res.badRequest();
        }

        if (!media) {
            media = await Media.findOne({ id, uuid });
            if (!media) {
                throw createError(404);
            }
        }

        if (userId && userId !== media.userId) {
            throw createError(403);
        }

        var filePath = path.join(sails.config.uploadDir, Media.getStorageFilename(media));

        if (!MicroService.existsSync(filePath)) {
            throw createError('Media file not found', {
                mediaId: media.id,
                filePath,
            });
        }

        if (exposeFilename) {
            res.download(filePath, exposeFilename + (media.extension ? '.' + media.extension : ''));
        } else {
            res.download(filePath, Media.getStorageFilename(media));
        }
    } catch (err) {
        res.sendError(err);
    }
}

/**
 * Download the content from the remote url
 * @param  {string} url
 * @param  {string} destPath
 * @return {object} res
 * @return {object} res.destFilename
 * @return {object} [res.size] - in bytes
 * @return {object} [res.contentType]
 * @return {object} [res.filename] - if provided from the header "Content-Disposition"
 */
function downloadFromUrl(url, destPath) {
    const uuid = Uuid.v4();
    const destFilename = path.join(destPath, uuid);

    return new Promise((resolve, reject) => {
        request
            .get(url)
            .on('error', err => {
                reject(err);
            })
            .on('response', response => {
                if (response.statusCode < 200 || 300 <= response.statusCode) {
                    const error = new Error('Not found assets');
                    fs
                        .unlinkAsync(destFilename)
                        .catch(() => null)
                        .finally(() => {
                            reject(error);
                        });
                    return;
                }

                // https://stackoverflow.com/questions/23054475/javascript-regex-for-extracting-filename-from-content-disposition-header/23054920
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;

                let filename;
                if (response.headers['content-disposition']
                 && filenameRegex.test(response.headers['content-disposition'])
                ) {
                    filename = filenameRegex.exec(response.headers['content-disposition'])[1];
                    filename = filename.replace(/["']/g, ''); // remove the quotes
                }

                const res = {
                    destFilename,
                    filename,
                    size: response.headers['content-length'],
                    contentType: response.headers['content-type'],
                }
                resolve(res);
            })
            .pipe(fs.createWriteStream(destFilename));
    });
}
