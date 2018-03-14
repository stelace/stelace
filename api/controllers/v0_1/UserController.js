/* global ApiService, Media, User, UserService */

module.exports = {

    find,
    findOne,
    create,
    update,
    destroy,

};

const _ = require('lodash');
const createError = require('http-errors');

async function find(req, res) {
    const allowed = await ApiService.isAllowed(req, 'userList', 'view');
    if (!allowed) {
        throw createError(403);
    }

    const attrs = req.allParams();
    const sortFields = [
        'id',
        'firstname',
        'lastname',
        'description',
        'email',
        'emailCheck',
        'phone',
        'phoneCheck',
        'createdDate',
        'lastConnectionDate',
        'newsletter',
    ];
    const searchFields = [
        'id',
        'firstname',
        'lastname',
        'email',
        'phone',
    ];

    const access = 'api';

    const fields = ApiService.parseFields(attrs);
    const pagination = ApiService.parsePagination(attrs);
    const populateMedia = _.includes(fields, 'media');

    let findAttrs = { destroyed: false };
    const sorting = ApiService.parseSorting(attrs, sortFields);
    const searchAttrs = ApiService.parseSearchQuery(attrs, searchFields);
    const ids = ApiService.parseEntityIds(attrs);

    findAttrs = Object.assign({}, findAttrs, searchAttrs);
    if (ids) {
        findAttrs = Object.assign({}, findAttrs, { id: ids });
    }

    const fetchUsers = () => {
        if (pagination) {
            return User
                .find(Object.assign({}, findAttrs))
                .sort(sorting)
                .skip((pagination.page - 1) * pagination.limit)
                .limit(pagination.limit);
        } else {
            return User.find(Object.assign({}, findAttrs)).sort(sorting);
        }
    };

    let [
        users,
        countUsers,
    ] = await Promise.all([
        fetchUsers(),
        User.count(Object.assign({}, findAttrs)),
    ]);

    const hashMedias = populateMedia ? await User.getMedia(users) : {};

    users = _.map(users, user => {
        const exposedUser = User.expose(user, access);
        if (populateMedia) {
            exposedUser.media = Media.expose(hashMedias[user.id], access);
        }
        return exposedUser;
    });

    const returnedObj = ApiService.getPaginationMeta({
        totalResults: countUsers,
        limit: pagination && pagination.limit,
        allResults: !pagination,
    });
    returnedObj.results = users;

    res.json(returnedObj);
}

async function findOne(req, res) {
    const allowed = await ApiService.isAllowed(req, 'userList', 'view');
    if (!allowed) {
        throw createError(403);
    }

    const id = req.param('id');
    const attrs = req.allParams();

    const access = 'api';

    const fields = ApiService.parseFields(attrs);
    const populateMedia = _.includes(fields, 'media');

    let { user, media } = await UserService.findUser(id, { populateMedia });

    user = User.expose(user, access);
    if (populateMedia) {
        user.media = Media.expose(media, access);
    }

    res.json(user);
}

async function create(req, res) {
    const allowed = await ApiService.isAllowed(req, 'userList', 'create');
    if (!allowed) {
        throw createError(403);
    }

    const attrs = req.allParams();
    const access = 'api';

    const user = await UserService.createUser(attrs);
    res.json(User.expose(user, access));
}

async function update(req, res) {
    const allowed = await ApiService.isAllowed(req, 'userList', 'edit');
    if (!allowed) {
        throw createError(403);
    }

    const id = req.param('id');
    const attrs = req.allParams();

    const access = 'api';

    const user = await UserService.updateUser(id, attrs);

    User
        .syncOdooUser(user, {
            updateLocation: false,
            doNotCreateIfNone: true
        })
        .catch(err => {
            req.logger.warn({ err: err }, "Odoo sync user fail");
        });

    res.json(User.expose(user, access));
}

async function destroy(req, res) {
    const allowed = await ApiService.isAllowed(req, 'userList', 'remove');
    if (!allowed) {
        throw createError(403);
    }

    const id = req.param('id');

    await UserService.destroyUser(id, {
        keepCommittedBookings: false,
        trigger: 'admin',
    }, { req, res });

    res.json({ id });
}
