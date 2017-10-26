/* global User */

module.exports = {

    findUser,

};

/**
 * @param {Number} userId
 * @param {Boolean} [populateMedia = false]
 * @result {Object} res
 * @result {Object} res.user
 * @result {Object} res.media
 */
async function findUser(userId, { populateMedia = false } = {}) {
    const user = await User.findOne({
        id: userId,
        destroyed: false,
    });
    if (!user) {
        throw new NotFoundError();
    }

    const result = {
        user,
        media: null,
    };

    if (populateMedia) {
        const hashMedias = await User.getMedia([user]);
        result.media = hashMedias[user.id] || null;
    }

    return result;
}
