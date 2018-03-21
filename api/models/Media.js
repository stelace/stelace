/* global Media */

/**
* Media.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        id: {
            type: 'number',
            columnType: 'int',
            autoIncrement: true,
        },
        createdDate: {
            type: 'string',
            columnType: 'varchar(255)',
            maxLength: 255,
        },
        updatedDate: {
            type: 'string',
            columnType: 'varchar(255)',
            maxLength: 255,
        },
        name: {
            type: 'string',
            columnType: 'varchar(255) CHARACTER SET utf8mb4',
            required: true,
            maxLength: 255,
        },
        extension: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        uuid: {
            type: 'string',
            columnType: 'varchar(255)',
            required: true,
            maxLength: 255,
        },
        type: { // extensions type (img, ...)
            type: 'string',
            columnType: 'varchar(255)',
            required: true,
            maxLength: 255,
        },
        userId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
            // index: true,
        },
        field: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        targetId: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        url: { // can be longer than 255 characters
            type: 'string',
            columnType: 'longtext CHARACTER SET utf8mb4',
            allowNull: true,
        },
        width: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        height: {
            type: 'number',
            columnType: 'int',
            allowNull: true,
        },
        color: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        placeholder: { // image placeholder (gif 3x3)
            type: 'string',
            columnType: 'longtext',
            allowNull: true,
        },
        alt: {
            type: 'string',
            columnType: 'varchar(255)',
            allowNull: true,
            maxLength: 255,
        },
        data: {
            type: 'json',
            columnType: 'json',
            defaultsTo: {},
        },
    },

    getAccessFields,
    exposeTransform,
    get,

    getName,
    getExtension,
    getStorageFilename,

    getServeFilename,
    getAllowedImageSize,
    getThresholdData,
    getSmartDisplayType,
    getGeometry,
    getLogoNewSize,

    getTypeFromExtension,
    convertContentTypeToExtension,

    deleteCustomSizeFiles,
    destroyMedia,

    getUrl,
    getDefaultListingImageUrl,

};

const fs       = require('fs');
const path     = require('path');
const del      = require('del');
const _ = require('lodash');
const Promise = require('bluebird');
const createError = require('http-errors');

Promise.promisifyAll(fs);

const params = {
    fields: ["user", "listing", "content"],
    types: ["img", "pdf", "link"],
    displayTypes: ["smart", "cover", "contain", "containOriginal"],
    maxNb: {
        user: 1,
        listing: 10,
        listingInstructions: 10,
        assessment: 10
    },
    imgSizes: [
        {
            label: "75x50",
            width: 75,
            height: 50
        },
        {
            label: "128x128",
            width: 128,
            height: 128
        },
        {
            label: "300x100",
            width: 300,
            height: 100
        },
        {
            label: "300x300",
            width: 300,
            height: 300
        },
        {
            label: "400x300",
            width: 400,
            height: 300
        },
        {
            label: "450x300",
            width: 450,
            height: 300
        },
        {
            label: "800x600",
            width: 800,
            height: 600
        },
        {
            label: "1200x1200",
            width: 1200,
            height: 1200
        },
        {
            label: "1600x1200",
            width: 1600,
            height: 1200
        }
    ],
    serveImageWithLogo: true,
    mediaMinSizeForLogo: { width: 600, height: 240 },
    logoMargin: { bottom: 10, right: 20 },
};

const extensions = {
    img: ["jpg", "jpeg", "png", "gif"],
    pdf: ["pdf"]
};

function getAccessFields(access) {
    const accessFields = {
        api: [
            "id",
            "name",
            "extension",
            "uuid",
            "type",
            "url",
            "width",
            "height",
            "color",
            "placeholder",
            "alt",
            "mediaUrl",
        ],
        self: [
            "id",
            "name",
            "extension",
            "uuid",
            "type",
            "url",
            "width",
            "height",
            "color",
            "placeholder",
            "alt",
        ],
        others: [
            "id",
            "name",
            "extension",
            "uuid",
            "type",
            "url",
            "width",
            "height",
            "color",
            "placeholder",
            "alt",
        ]
    };

    return accessFields[access];
}

function exposeTransform(element, field) {
    switch (field) {
        case 'mediaUrl':
            if (element.type !== 'link') {
                element.mediaUrl = getUrl(element);
            }
            break;
    }
}

function get(prop) {
    if (prop) {
        return params[prop];
    } else {
        return params;
    }
}

/**
 * Get the real filename from the storage location
 * @param  {object}  media
 * @param  {string}  [size]
 * @param  {string}  [displayType]
 * @param  {boolean} [withLogo = false]
 * @return {string}
 */
function getStorageFilename(media, { size, displayType, withLogo = false } = {}) {
    if (media.type === "link") {
        return "";
    }

    var filename       = media.id + "-" + media.uuid;
    var extension      = (media.extension ? "." + media.extension : "");
    var sizeStr        = (size ? "_" + size : "");
    var displayTypeStr = (displayType ? "_" + displayType : "");
    var withLogoStr    = (withLogo ? "_logo" : "");

    return filename + withLogoStr + sizeStr + displayTypeStr + extension;
}

/**
 * Get the file's name without the extension
 * @param  {string} filepath
 * @return {string} name
 */
function getName(filepath) {
    return path.parse(filepath).name;
}

function getExtension(filepath) {
    let extension = path.parse(filepath).ext;
    if (!extension) {
        return null;
    }

    return extension.slice(1).toLowerCase();
}

function getTypeFromExtension(extension) {
    let found = false;
    let fileType;

    _.forEach(extensions, (exts, type) => {
        if (found) return;

        if (_.includes(exts, extension)) {
            fileType = type;
            found = true;
        }
    });

    return fileType;
}

function getServeFilename(media) {
    return media.name + (media.extension ? '.' + media.extension : '');
}

/**
 * Image media can only have predefined sizes
 * @param {String} size - e.g. format 400x300
 * @result {Object} res
 * @result {String} res.label - the format
 * @result {String} res.width
 * @result {String} res.height
 */
function getAllowedImageSize(size) {
    return _.find(Media.get("imgSizes"), imgSize => {
        return imgSize.label === size;
    });
}

/**
 * @param {String} threshold - e.g. format 10t5
 * @result {Object} res
 * @result {Number} res.width
 * @result {Number} res.height
 */
function getThresholdData(threshold) {
    if (typeof threshold !== 'string') {
        throw new Error('Treshhold must be a string');
    }

    const split = threshold.split('t');
    if (split.length !== 2) {
        throw new Error('Threshold must have two parts');
    }

    const width = parseInt(split[0], 10);
    const height = parseInt(split[1], 10);

    if (isNaN(width) || isNaN(height)) {
        throw new Error('Width and height must be numbers');
    }

    return { width, height };
}

function getSmartDisplayType(media, threshold) {
    const { width, height } = getThresholdData(threshold);

    const thresholdRatio = width / height;
    const mediaRatio = media.width / media.height;

    return (mediaRatio < thresholdRatio ? 'cover' : 'contain');
}

/**
 * Get the Graphics Magick geometry to put the logo at the bottom right of the image
 * @param {Object} imgSize
 * @param {Number} imgSize.width
 * @param {Number} imgSize.height
 * @param {Object} logoSize
 * @param {Number} logoSize.width
 * @param {Number} logoSize.height
 * @param {Object} logoMargin
 * @param {Number} logoMargin.width
 * @param {Number} logoMargin.height
 * @result {String} geometry
 */
function getGeometry(imgSize, logoSize, logoMargin) {
    const translation = {
        x: imgSize.width - logoSize.width - logoMargin.right,
        y: imgSize.height - logoSize.height - logoMargin.bottom
    };

    let geometry = "";
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

/**
 * Adapt the logo size based on the image size
 * @param {Object} imgSize
 * @param {Number} imgSize.width
 * @param {Number} imgSize.height
 * @param {Object} logoSize
 * @param {Number} logoSize.width
 * @param {Number} logoSize.height
 * @result {Object} newLogoSize
 * @result {Number} newLogoSize.width
 * @result {Number} newLogoSize.height
 */
function getLogoNewSize(imgSize, logoSize) {
    const newLogoSize = {
        width: logoSize.width,
        height: logoSize.height,
    };

    let scale = 0.1;

    if (600 <= imgSize.width && imgSize.width < 1200) {
        scale = 0.2;
    } else if (1200 <= imgSize) {
        scale = 0.1;
    }

    if (scale === 1) {
        return logoSize;
    }

    newLogoSize.width = Math.round(imgSize.width * scale);
    newLogoSize.height = Math.round(newLogoSize.width * logoSize.height / logoSize.width);

    if (logoSize.width < newLogoSize.width) {
        return logoSize;
    } else {
        return newLogoSize;
    }
}

function convertContentTypeToExtension(contentType) {
    switch (contentType) {
        case "image/gif":
            return "gif";

        case "image/jpeg":
        case "image/pjpeg":
            return "jpeg";

        case "image/png":
        case "image/x-png":
            return "png";

        case "application/pdf":
            return "pdf";
    }

    return;
}

async function deleteCustomSizeFiles(mediaId) {
    var globPattern = path.join(sails.config.uploadDir, mediaId + "-*_*");
    await del([globPattern], { force: true });
}

async function destroyMedia(mediaId) {
    const media = await Media.findOne({ id: mediaId })
    if (!media) {
        throw createError(404);
    }

    const globPattern = path.join(sails.config.uploadDir, media.id + "-*");
    await del([globPattern], { force: true });

    await Media.destroy({ id: mediaId });
}

function getUrl(media, { size, oldVersion = false } = {}) {
    if (media.type === "link") {
        return media.url;
    } else {
        const apiPrefix = sails.config.blueprints.prefix;

        let str = `${apiPrefix}/media/get/${media.id}/${media.uuid}`;

        if (media.extension && !oldVersion) {
            str += `.${media.extension}`;
        }
        if (size) {
            str += `?size=${size}`;
        }

        return str;
    }
}

function getDefaultListingImageUrl() {
    return "/assets/img/app/default/default-item.png";
}
