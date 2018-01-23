/* global Media, MediaService, User */

/**
 * MediaController
 *
 * @description :: Server-side logic for managing media
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

// https://github.com/sails101/file-uploads/blob/master/api/controllers/FileController.js#L15

module.exports = {

    find,
    findOne,
    create,
    update,
    destroy,

    my,
    get,
    getRedirect,
    download,
    upload,

};

const Url = require('url');
const createError = require('http-errors');

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
    var id = req.param('id');
    var name = req.param('name');

    var access = 'self';

    if (! name) {
        return res.badRequest();
    }

    try {
        const media = await MediaService.updateMedia(id, { name }, { userId: req.user.id });
        res.json(Media.expose(media, access));
    } catch (err) {
        res.sendError(err);
    }
}

function destroy(req, res) {
    return res.forbidden();
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

        res.set(headers).sendFile(serveResult.filepath);
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
            throw createError(404);
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
    const id = req.param('id');
    const uuid = req.param('uuid');

    await Media.downloadFile({
        id,
        uuid,
        res,
        userId: req.user.id,
    });
}

async function upload(req, res) {
    const field    = req.param('field');
    const targetId = parseInt(req.param('targetId'), 10);
    const name     = req.param('name');
    const url      = req.param('url');
    const access = 'self';

    try {
        const media = await MediaService.uploadMedia(
            { field, targetId, name, url },
            { req, res, userId: req.user.id },
        );

        res.json(Media.expose(media, access));
    } catch (err) {
        res.sendError(err);
    }
}
