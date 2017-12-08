/* global Media, MediaService */

module.exports = {
    update,
    get,
    getRedirect,
    download,
    upload,
};

const Url = require('url');

async function update(req, res) {
    const id = req.param('id');
    const name = req.param('name');

    const access = 'api';

    if (! name) {
        return res.badRequest();
    }

    try {
        const media = await MediaService.updateMedia(id, { name });
        res.json(Media.expose(media, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function get(req, res) {
    const id = req.param('id');
    const uuid = req.param('uuid');
    const size = req.param('size');
    const displayType = req.param('displayType');
    const threshold = req.param('threshold');

    try {
        const serveResult = await MediaService.getFileToServe({
            mediaId: id,
            uuid,
            size,
            displayType,
            threshold,
        });

        const headers = MediaService.getServeFileHeaders(serveResult);

        res.set(headers).sendfile(serveResult.filepath);
    } catch (err) {
        res.sendError(err);
    }
}

async function getRedirect(req, res) {
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
    const targetId = parseInt(req.param('targetId'), 10);
    const name     = req.param('name');
    const url      = req.param('url');
    const userId   = req.param('userId');
    const access = 'api';

    try {
        const media = await MediaService.uploadMedia(
            { field, targetId, name, url },
            { req, res, userId },
        );

        res.json(Media.expose(media, access));
    } catch (err) {
        res.sendError(err);
    }
}
