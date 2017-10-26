/* global Media, User, UserService */

module.exports = {

    find,
    findOne,

};

async function find(req, res) {
    const fields = req.param('fields');

    const parsedFields = fields ? fields.split(',') : [];
    const populateMedia = _.includes(parsedFields, 'media');

    const access = 'self';

    try {
        let users = await User.find({ destroyed: false });
        const hashMedias = await User.getMedia(users);

        users = _.map(users, user => {
            const exposedUser = User.expose(user, access);
            if (populateMedia) {
                exposedUser.media = Media.expose(hashMedias[user.id], access);
            }
            return exposedUser;
        });

        res.json(users);
    } catch (err) {
        res.sendError(err);
    }
}

async function findOne(req, res) {
    const id = req.param('id');
    const fields = req.param('fields');

    const parsedFields = fields ? fields.split(',') : [];
    const populateMedia = _.includes(parsedFields, 'media');

    const access = 'self';

    try {
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
