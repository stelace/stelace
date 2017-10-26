/* global Media */

/**
* Media.js
*
* @description :: TODO: You might write a short summary of how this model works and what it represents here.
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

    attributes: {
        name: {
            type: "string",
            maxLength: 255,
            required: true
        },
        extension: "string",
        uuid: {
            type: "string",
            required: true
        },
        type: "string", // extensions type (img, ...)
        userId: {
            type: "integer",
            index: true
        },
        field: "string",
        targetId: "integer",
        url: "text", // can be longer than 255 characters
        width: "integer",
        height: "integer",
        color: "string",
        placeholder: "text", // image placeholder (gif 3x3)
        alt: "string",
    },

    getAccessFields: getAccessFields,
    get: get,
    getName: getName,
    getExtension: getExtension,
    getStorageFilename: getStorageFilename,
    getTypeFromExtension: getTypeFromExtension,
    convertContentTypeToExtension: convertContentTypeToExtension,
    deleteCustomSizeFiles: deleteCustomSizeFiles,
    destroyMedia: destroyMedia,
    getUrl: getUrl,
    getDefaultListingImageUrl: getDefaultListingImageUrl

};

const params = {
    fields: ["user", "listing"],
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
    ]
};

const extensions = {
    img: ["jpg", "jpeg", "png", "gif"],
    pdf: ["pdf"]
};

const fs       = require('fs');
const path     = require('path');
const del      = require('del');

Promise.promisifyAll(fs);

function getAccessFields(access) {
    const accessFields = {
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
        throw new NotFoundError();
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
