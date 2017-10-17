(function () {

    angular
        .module("app.data")
        .factory("ItemCategoryService", ItemCategoryService);

    function ItemCategoryService(CleanService, ItemCategory, Restangular, tools) {
        var itemCategories = {};

        var service = Restangular.all("itemCategory");

        service.findItemCategory    = findItemCategory;
        service.notCategoryTags     = notCategoryTags;
        service.getCategoriesString = getCategoriesString;

        CleanService.clean(service);

        Restangular.extendModel("itemCategory", function (obj) {
            return ItemCategory.mixInto(obj);
        });

        return service;



        function findItemCategory(item, categories) {
            itemCategories   = (categories && _.indexBy(categories, "id")) || itemCategories;
            var itemCategory = _findItemCategoryById(item.itemCategoryId);
            var itemParentCategoryName;

            if (itemCategory && itemCategory.parentId) {
                itemParentCategoryName = _findItemCategoryById(itemCategory.parentId).name;
            } else if (! itemCategory) {
                return "";
            }

            return itemParentCategoryName || itemCategory.name;
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

        function _findItemCategoryById(id) {
            // returns undefined when itemCategories have not been populated yet
            return _.find(itemCategories, function (itemCategory) {
                return itemCategory.id === id;
            });
        }
    }

})();
