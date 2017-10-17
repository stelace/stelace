(function () {

    angular
        .module("app.data")
        .factory("TagService", TagService);

    function TagService(diacritics, CleanService, Restangular, Tag) {
        var service = Restangular.all("tag");

        service.populateTags                     = populateTags;
        service.minimumTagsQueryLength           = minimumTagsQueryLength;
        service.deduplicateTagsByInsensitiveName = deduplicateTagsByInsensitiveName;
        service.sortTags                         = sortTags;

        CleanService.clean(service);

        Restangular.extendModel("tag", function (obj) {
            return Tag.mixInto(obj);
        });

        return service;


        function populateTags(tagsIds, tagsList) {
            var hashTags = _.indexBy(tagsList, "id");

            var populatedTags = _.reduce(tagsIds, function (memo, tagId) {
                var tag = hashTags[tagId];
                if (tag) {
                    memo.push(tag);
                }
                return memo;
            }, []);

            return populatedTags;
        }

        function minimumTagsQueryLength(query, minLength, tagsList) {
            var tags = [];
            if (query && query.length >= minLength) {
                tags = tagsList;
            }

            return tags;
        }

        /**
         * To ensure no duplicate tag is created (e.g. VIdèoprojecteur)
         * @param  {object[]} newTags - New tags to deduplicate against tagsList. MODIFIED by function
         * @param  {object[]} tagsList - Existing tags
         */
        function deduplicateTagsByInsensitiveName(newTags, tagsList) {
            _computeInsensitiveTagName(newTags);
            _computeInsensitiveTagName(tagsList);

            var insensitiveTags = _.groupBy(tagsList, "insensitiveName");

            _.forEach(newTags, function (tag) {
                var matchedTag = insensitiveTags[tag.insensitiveName] ? insensitiveTags[tag.insensitiveName][0] : null;

                if (matchedTag) {
                    delete tag.isNew;
                    _.assign(tag, matchedTag);
                }
            });
        }

        function _computeInsensitiveTagName(tags) {
            _.forEach(tags, function (tag) {
                tag.insensitiveName = diacritics.remove(tag.name).toLowerCase();
            });
        }

        function sortTags(tags, params) {
            var score;
            params = params || {};

            return _.sortBy(tags, function (tag) {
                score = 0;
                score -= tag.timesSearched;
                score -= params.timesAdded ? tag.timesAdded : 0;
                return score;
            });
        }
    }

})();
