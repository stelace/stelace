/* global Media, MediaService */

module.exports = {
    update,
    get,
    getRedirect,
    download,
    upload,
};

const Url = require('url');
const createError = require('http-errors');

async function update(req, res) {
    const id = req.param('id');
    const name = req.param('name');

    const access = 'api';

    if (! name) {
        return res.badRequest();
    }

    const media = await MediaService.updateMedia(id, { name });
    res.json(Media.expose(media, access));
}

async function get(req, res) {
    const id = req.param('id');
    const uuid = req.param('uuid');
    const size = req.param('size');
    const displayType = req.param('displayType');
    const threshold = req.param('threshold');

    const serveResult = await MediaService.getFileToServe({
        mediaId: id,
        uuid,
        size,
        displayType,
        threshold,
    });

    const headers = MediaService.getServeFileHeaders(serveResult);

    res.set(headers).sendFile(serveResult.filepath);
}

async function getRedirect(req, res) {
    const {
        id,
        uuid,
    } = req.allParams();

    const media = await Media.findOne({ id, uuid });
    if (!media) {
        throw createError(404);
    }

    const parsedUrl = Url.parse(req.url);

    // add the media extension and redirect
    const redirectedUrl = `${req.path}.${media.extension}${parsedUrl.search || ""}`;
    res.redirect(redirectedUrl);
}

async function download(req, res) {
    const id = req.param('id');
    const uuid = req.param('uuid');

    await Media.downloadFile({
        id,
        uuid,
        res,
    });
}

async function upload(req, res) {
    const field    = req.param('field');
    let targetId   = req.param('targetId');
    const name     = req.param('name');
    const url      = req.param('url');
    let userId     = req.param('userId');
    const access = 'api';

    if (targetId) {
        targetId = parseInt(targetId, 10);
    }
    if (userId) {
        userId = parseInt(userId, 10);
    }

    const media = await MediaService.uploadMedia(
        { field, targetId, name, url },
        { req, res, userId },
    );

    res.json(Media.expose(media, access));
}
