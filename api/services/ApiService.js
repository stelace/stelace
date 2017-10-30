module.exports = {

    parseFields,
    parsePagination,
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
