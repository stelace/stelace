/* global FileCachingService */

const path = require('path');

module.exports = {

    findEditable,
    // find,
    // findOne,

};

async function findEditable(req, res) {
    const attrs = req.allParams();
    // TODO: expose languages supported in config
    const locale = ["fr", "en"].includes(attrs.locale) ? attrs.locale : "en";

    try {
        const translationsCache = FileCachingService.getCache({
            filepath: path.join(__dirname, `../../../translations/${locale}.json`),
        });

        translationsCache.free();

        const translations = await translationsCache.loadFromFile();
        const editableInfo = getEditableEntries(translations);

        res.json(editableInfo);
    } catch (err) {
        res.sendError(err);
    }
}

function getEditableEntries(translationsFile) {
    const editableKeySuffixRegex = /__EDITOR_LABEL$/;
    const editableKeyHelperSuffix = "__EDITOR_HELPER";
    let editableKeys = [];
    let editable = {};

    findEditableKeys({ translations: translationsFile });

    function findEditableKeys({ currentPath = "", translations }) {
        for(const key in translations) {
            if(editableKeySuffixRegex.test(key)) {
                pushKey(currentPath, key);
            }

            if (translations[key] instanceof Object) {
                findEditableKeys({
                    currentPath: getKeyPath(currentPath, key),
                    translations: translations[key],
                });
            }
        }

        function pushKey (currentPath, labelKey) {
            const contentKey = labelKey.replace(editableKeySuffixRegex, "");
            const helperKey = labelKey.replace(editableKeySuffixRegex, editableKeyHelperSuffix);

            editableKeys.push(getKeyPath(currentPath, contentKey));

            _.set(editable, getKeyPath(currentPath, contentKey), translations[contentKey]);
            _.set(editable, getKeyPath(currentPath, labelKey), translations[labelKey]);

            if (translations[helperKey]) {
                _.set(editable, getKeyPath(currentPath, helperKey), translations[helperKey]);
            }

            // console.log(currentPath, _.get(editable, currentPath))
        }

        function getKeyPath(path, key) {
            return `${ path ? path + "." : "" }${key}`;
        }
    }

    return {
        editableKeys,
        editable,
    };
}
