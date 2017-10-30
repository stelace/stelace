/* global ApiService, Media, User, UserService */

module.exports = {

    find,
    findOne,

};

async function find(req, res) {
    const attrs = req.allParams();

    const access = 'self';

    try {
        const fields = ApiService.parseFields(attrs);
        const pagination = ApiService.parsePagination(attrs);
        const populateMedia = _.includes(fields, 'media');

        const findAttrs = { destroyed: false };

        let [
            users,
            countUsers,
        ] = await Promise.all([
            User.find(findAttrs).paginate(pagination),
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
            limit: pagination.limit,
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

    const access = 'self';

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
