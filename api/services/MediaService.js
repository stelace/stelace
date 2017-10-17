/* global ImageService, Media */

module.exports = {

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

Promise.promisifyAll(fs);
Promise.promisifyAll(request, { multiArgs: true });

const tmpDir = sails.config.tmpDir;
const uploadDir = sails.config.uploadDir;
const maxSizeUploadInBytes = 50000000; // 50MB

/**
 * Upload file
 * @param  {object} req
 * @param  {object} res
 * @param  {string} [field]
 * @param  {number} [targetId]
 * @param  {string} [name]
 * @param  {object} [logger]
 * @param  {string[]} authorizedTypes
 * @param  {string} inputFileName
 * @param  {number} maxSize - in bytes
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
}) {
    const uploadedFile = await uploadFromInputFile({
        req,
        res,
        inputFileName,
        uploadDest: tmpDir,
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
        userId: req.user.id,
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
        size = await µ.getSize(filepath);
    }
    if (!µ.existsSync(filepath)) {
        throw new NotFoundError('File not found');
    }

    if (!extension) {
        throw new BadRequestError('Missing extension');
    }

    const type = Media.getTypeFromExtension(extension);
    if (!type) {
        throw new BadRequestError('Bad media type');
    }

    if (authorizedTypes && !_.includes(authorizedTypes, type)) {
        const error = new BadRequestError('Non authorized extension');
        error.expose = true;
        throw error;
    }
    if (maxSize && maxSize < size) {
        const error = new BadRequestError("Max size file exceeded");
        error.size = size;
        error.maxSize = maxSize;
        error.expose = true;
        throw error;
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
        const finalDestPath = path.join(uploadDir, Media.getStorageFilename(media));
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
    const filepath = path.join(uploadDir, Media.getStorageFilename(media));
    const tmpFilepath = path.join(tmpDir, Media.getStorageFilename(media));

    try {
        await ImageService.compress(filepath, tmpDir);
    } catch (err) {
        logger.warn({
            err: err,
            mediaId: media.id,
        }, 'Image compression fail');
        return;
    }

    try {
        await fs.renameAsync(tmpFilepath, filepath);
    } catch (err) {
        logger.error({
            err: err,
            mediaId: media.id,
            filepath: tmpFilepath
        }, 'Rename file after upload failed');

        fs.unlinkAsync(tmpFilepath).catch(() => null);
        return;
    }

    setImagePlaceholders(media).catch(() => null); // not blocking
}

async function setImagePlaceholders(media) {
    const filepath = path.join(uploadDir, Media.getStorageFilename(media));

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
 * @param  {number} userId
 * @param  {number} id              - (id, uuid) or media must be defined
 * @param  {string} uuid
 * @param  {object} media
 * @param  {string} [exposeFilename]  - name of the file that is displayed when downloading the file
 */
async function downloadFile({
    res,
    userId,
    id,
    uuid,
    media,
    exposeFilename,
}) {
    try {
        if (((!id || !uuid) && !media)
         || !userId
         || !res
        ) {
            return res.badRequest();
        }

        if (!media) {
            media = await Media.findOne({ id, uuid });
            if (!media) {
                throw new NotFoundError();
            }
        }

        if (userId !== media.userId) {
            throw new ForbiddenError();
        }

        var filePath = path.join(uploadDir, Media.getStorageFilename(media));

        if (!µ.existsSync(filePath)) {
            const error = new NotFoundError("Media file not found");
            error.mediaId = media.id;
            error.filePath = filePath;
            throw error;
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
