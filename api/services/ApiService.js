module.exports = {

    parseFields,
    parsePagination,
    parseSorting,
    parseSearchQuery,
    getPaginationMeta,

};

function parseFields(attrs) {
    if (!attrs.fields) return [];

    return attrs.fields.split(',');
}

function parsePagination(attrs) {
    const pagination = {
        page: 1,
        limit: 10,
    };

    if (attrs.page) {
        const page = parseInt(attrs.page, 10);

        if (page < 1) {
            throw new BadRequestError();
        }

        pagination.page = page;
    }

    if (attrs.limit) {
        const limit = parseInt(attrs.limit, 10);

        if (limit < 1 || limit > 100) {
            throw new BadRequestError();
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

    const sorting = {};
    sorting[attrs.sortField] = sortDirection === 'asc' ? 1 : -1;

    return sorting;
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

function getPaginationMeta({ totalResults, limit }) {
    let totalPages = Math.floor(totalResults / limit);
    if (totalResults % limit !== 0) {
        totalPages += 1;
    }

    return {
        totalResults,
        totalPages,
    };
}
