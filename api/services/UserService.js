/* global AuthService, GeneratorService, StelaceEventService, User */

module.exports = {

    findUser,
    createUser,
    updateUser,
    destroyUser,

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

/**
 * @param {Object} attrs
 * @param {String} attrs.email
 * @param {String} [attrs.username]
 * @param {String} [attrs.firstname]
 * @param {String} [attrs.lastname]
 * @param {String} [attrs.phone]
 * @param {String} [attrs.description]
 * @param {String} [attrs.role = 'user']
 * @param {Boolean} [attrs.newsletter = true]
 * @param {String} [attrs.password]
 * @param {Object} [options]
 * @param {Boolean} [options.passwordRequired = false]
 * @param {Object} [options.req] - req and res are useful for stelace event
 * @param {Object} [options.res]
 */
async function createUser(attrs, options = {}) {
    const {
        email,
        username,
        firstname,
        lastname,
        phone,
        description,
        role = 'user',
        newsletter = true,
        password,
    } = attrs;
    const {
        passwordRequired = false,
        req,
        res,
    } = options;

    if (!email) {
        throw new BadRequestError('Email is required');
    }
    if (!µ.isEmail(email)) {
        const error = new BadRequestError("Invalid email");
        error.expose = true;
        throw error;
    }
    if (passwordRequired && !password) {
        throw new BadRequestError("Missing password");
    }

    let emailUsername;
    if (!username) {
        emailUsername = email.split('@')[0];
    }

    const emailToken = await GeneratorService.getRandomString(30);

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        const error = new BadRequestError("email exists");
        error.expose = true;
        throw error;
    }

    let user;
    try {
        user = await User.create({
            email,
            emailToken,
            username: username || emailUsername,
            firstname,
            lastname,
            phone,
            description,
            role,
            newsletter,
        });
    } catch (err) {
        if (err.code === "E_VALIDATION") {
            if (err.invalidAttributes.email) {
                const error = new BadRequestError("email exists");
                error.expose = true;
                throw error;
            } else {
                throw new Error("user exists");
            }
        }
    }

    try {
        if (password) {
            await AuthService.addPasswordAuth({ userId: user.id, password }, { checkExistingAuth: false });
        }
    } catch (err) {
        if (err.code === "E_VALIDATION") {
            throw new Error("passport invalid");
        }

        await User.destroy({ id: user.id }).catch(destroyErr => {
            throw destroyErr;
        });

        throw err;
    }

    await StelaceEventService.createEvent({
        req,
        res,
        label: 'user.created',
        type: 'core',
        targetUserId: user.id,
    });

    return user;
}

/**
 * @param {Number} userId
 * @param {Object} attrs
 * @param {String} [attrs.email]
 * @param {String} [attrs.username]
 * @param {String} [attrs.firstname]
 * @param {String} [attrs.lastname]
 * @param {String} [attrs.phone]
 * @param {String} [attrs.description]
 * @param {String} [attrs.role]
 * @param {Boolean} [attrs.newsletter]
 */
async function updateUser(userId, attrs = {}) {
    const {
        email,
        username,
        firstname,
        lastname,
        phone,
        description,
        role,
        newsletter,
    } = attrs;

    if (typeof email !== 'undefined' && !µ.isEmail(email)) {
        const error = new BadRequestError("Invalid email");
        error.expose = true;
        throw error;
    }

    const foundUser = await User.findOne({ id: userId });
    if (!foundUser) {
        throw new NotFoundError();
    }

    const updateAttrs = {
        email,
        username,
        firstname,
        lastname,
        phone,
        description,
        role,
        newsletter,
    };

    if (typeof email !== 'undefined') {
        updateAttrs.emailCheck = false;
    }
    if (typeof phone !== 'undefined') {
        updateAttrs.phoneCheck = false;
    }

    const user = await User.updateOne({ id: userId }, updateAttrs);
    return user;
}

/**
 * @param {Number} listingId
 * @param {Object} params
 * @param {String} params.trigger
 * @param {Boolean} params.keepCommittedBookings
 * @param {Object} [options]
 * @param {Object} [options.req]
 * @param {Object} [options.res]
 * @param {Number} [options.userId] - if specified, check if the listing owner id matches the provided userId
 */
async function destroyUser(userId, { trigger, keepCommittedBookings } = {}, { req, res }) {
    const user = await User.findOne({ id: userId });
    if (!user) {
        throw new NotFoundError();
    }
    if (typeof keepCommittedBookings === 'undefined') {
        throw new BadRequestError('Missing committed booking params');
    }

    const { allDestroyable } = await User.canBeDestroyed([user], { keepCommittedBookings });
    if (!allDestroyable) {
        const error = new BadRequestError('user cannot be destroyed');
        error.userId = userId;
        error.notDestroyable = true;
        error.expose = true;
        throw error;
    }

    await User.destroyUser(user, { trigger }, { req, res });
}
