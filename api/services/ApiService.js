/* global AclService, MicroService */

module.exports = {

    parseFields,
    parsePagination,
    parseSorting,
    parseSearchQuery,
    parseEntityIds,
    getPaginationMeta,

    isAllowed,

};

const _ = require('lodash');
const createError = require('http-errors');

function parseFields(attrs) {
    if (!attrs.fields) return [];

    return attrs.fields.split(',');
}

function parsePagination(attrs) {
    const pagination = {
        page: 1,
        limit: 10,
    };

    if (attrs.allResults === '1') {
        return;
    }

    if (attrs.page) {
        const page = parseInt(attrs.page, 10);

        if (page < 1) {
            throw createError(400);
        }

        pagination.page = page;
    }

    if (attrs.limit) {
        const limit = parseInt(attrs.limit, 10);

        if (limit < 1 || limit > 100) {
            throw createError(400);
        }

        pagination.limit = limit;
    }

    return pagination;
}

function parseSorting(attrs, sortFields) {
    if (!attrs.sortField
     || (sortFields && !_.includes(sortFields, attrs.sortField))
    ) {
        return;
    }

    let sortDirection;
    if (!_.includes(['asc', 'desc'], attrs.sortDirection)) {
        sortDirection = 'asc';
    } else {
        sortDirection = attrs.sortDirection;
    }

    return attrs.sortField + ' ' + sortDirection.toUpperCase();
}

function parseSearchQuery(attrs, searchFields) {
    if (!attrs.q || !searchFields) {
        return {};
    }

    const or = _.reduce(searchFields, (memo, field) => {
        if (field === 'id') {
            const parsedNb = parseInt(attrs.q, 10);
            if (!isNaN(parsedNb)) {
                memo.push({ [field]: parsedNb });
            }
        } else {
            memo.push({ [field]: { contains: attrs.q } });
        }
        return memo;
    }, []);

    if (or.length) {
        return { or };
    } else {
        return {};
    }
}

function parseEntityIds(attrs) {
    if (!attrs.ids
     || !MicroService.checkArray(attrs.ids, 'id')
    ) {
        return;
    }

    return attrs.ids.map(id => parseInt(id, 10));
}

function getPaginationMeta({ totalResults, limit, allResults = false }) {
    if (allResults) {
        return {
            totalResults,
            totalPages: 1,
        };
    }

    let totalPages = Math.floor(totalResults / limit);
    if (totalResults % limit !== 0) {
        totalPages += 1;
    }

    return {
        totalResults,
        totalPages,
    };
}

async function isAllowed(req, resource, action) {
    if (req.user) {
        const allowed = await AclService.isAllowed(req.user.roles, resource, action);
        return allowed;
    } else if (req.apiKey) {
        return true;
    } else {
        return false;
    }
}
