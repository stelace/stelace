(function () {

    angular
        .module("app.data")
        .factory("ListingCategoryService", ListingCategoryService);

    function ListingCategoryService(CleanService, ListingCategory, Restangular, tools) {
        var listingCategories = {};

        var service = Restangular.all("listingCategory");

        service.findListingCategory = findListingCategory;
        service.notCategoryTags     = notCategoryTags;
        service.getCategoriesString = getCategoriesString;

        CleanService.clean(service);

        Restangular.extendModel("listingCategory", function (obj) {
            return ListingCategory.mixInto(obj);
        });

        return service;



        function findListingCategory(item, categories) {
            listingCategories   = (categories && _.indexBy(categories, "id")) || listingCategories;
            var listingCategory = _findListingCategoryById(item.listingCategoryId);
            var listingParentCategoryName;

            if (listingCategory && listingCategory.parentId) {
                listingParentCategoryName = _findListingCategoryById(listingCategory.parentId).name;
            } else if (! listingCategory) {
                return "";
            }

            return listingParentCategoryName || listingCategory.name;
        }

        function notCategoryTags(populatedTags, categoryName) {
            if (_.isEmpty(populatedTags) || ! categoryName) {
                return [];
            }
            var categoryNameSafe = tools.getURLStringSafe(categoryName);

            return _.reject(populatedTags, function (value) {
                return value && value.nameURLSafe.toLowerCase() === categoryNameSafe.toLowerCase();
            });
        }

        function getCategoriesString(categoryName, notCategoryTag) {
            return (categoryName || "") + (notCategoryTag ? " > " + notCategoryTag.name : "");
        }

        function _findListingCategoryById(id) {
            // returns undefined when listingCategories have not been populated yet
            return _.find(listingCategories, function (listingCategory) {
                return listingCategory.id === id;
            });
        }
    }

})();
