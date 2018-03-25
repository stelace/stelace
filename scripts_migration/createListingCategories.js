/* global BootstrapService, ListingCategory */

const Sails = require('sails');
const { getConfig } = require('../sailsrc');

const Promise = require('bluebird');
const _ = require('lodash');

Sails.load(getConfig(), async function (err, sails) {
    if (err) {
        console.log("\n!!! Fail script launch: can't load sails");
        return;
    }

    BootstrapService.init(null, { sails: sails });

    try {
        // customize your listing categories (only 2 levels of hierarchy are currently supported)
        const jsonListingCategories = [
            {
                id: 1,
                name: 'High-tech',
                parentId: null,
            },
            {
                id: 2,
                name: 'Books',
                parentId: null,
            },
            {
                id: 3,
                name: 'Music',
                parentId: null,
            },
            {
                id: 4,
                name: 'Clothing',
                parentId: null,
            },
            {
                id: 5,
                name: 'Men',
                parentId: 4,
            },
            {
                id: 6,
                name: 'Women',
                parentId: 4,
            },
        ];

        await Promise.each(jsonListingCategories, async (cat) => {
            const listingCategory = await ListingCategory.findOne({ id: cat.id });

            if (listingCategory) {
                await ListingCategory.updateOne(listingCategory.id, _.omit(cat, 'id'));
            } else {
                await ListingCategory.create(cat);
            }
        });
    } catch (err) {
        console.log(err);

        if (err.stack) {
            console.log(err.stack);
        }
    } finally {
        sails.lowerSafe();
    }

});
