module.exports = async function (req, res, next) {

    const key = req.headers['x-provider-api-key'];
    const providerKey = sails.config.providerApiKey;

    if (!key
     || !providerKey
     || key !== providerKey
    ) {
        return res.status(401).send();
    }

    next();

};
