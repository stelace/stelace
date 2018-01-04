/* global ApiService, Media, User, UserService */

module.exports = {

    find,
    findOne,
    create,
    update,
    destroy,

};

async function find(req, res) {
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

    try {
        const fields = ApiService.parseFields(attrs);
        const pagination = ApiService.parsePagination(attrs);
        const populateMedia = _.includes(fields, 'media');

        let findAttrs = { destroyed: false };
        const sorting = ApiService.parseSorting(attrs, sortFields);
        const searchAttrs = ApiService.parseSearchQuery(attrs, searchFields);

        findAttrs = Object.assign({}, findAttrs, searchAttrs);

        const fetchUsers = () => {
            if (pagination) {
                return User.find(findAttrs).sort(sorting).paginate(pagination);
            } else {
                return User.find(findAttrs).sort(sorting);
            }
        };

        let [
            users,
            countUsers,
        ] = await Promise.all([
            fetchUsers(),
            User.count(findAttrs),
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
    } catch (err) {
        res.sendError(err);
    }
}

async function findOne(req, res) {
    const id = req.param('id');
    const attrs = req.allParams();

    const access = 'api';

    try {
        const fields = ApiService.parseFields(attrs);
        const populateMedia = _.includes(fields, 'media');

        let { user, media } = await UserService.findUser(id, { populateMedia });

        user = User.expose(user, access);
        if (populateMedia) {
            user.media = Media.expose(media, access);
        }

        res.json(user);
    } catch (err) {
        res.sendError(err);
    }
}

async function create(req, res) {
    const attrs = req.allParams();
    const access = 'api';

    try {
        const user = await UserService.createUser(attrs);
        res.json(User.expose(user, access));
    } catch (err) {
        res.sendError(err);
    }
}

async function update(req, res) {
    const id = req.param('id');
    const attrs = req.allParams();

    const access = 'api';

    try {
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
    } catch (err) {
        res.sendError(err);
    }
}

async function destroy(req, res) {
    const id = req.param('id');

    try {
        await UserService.destroyUser(id, {
            keepCommittedBookings: false,
            trigger: 'admin',
        }, { req, res });

        res.json({ id });
    } catch (err) {
        res.sendError(err);
    }
}
