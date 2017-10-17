// https://gist.github.com/justmoon/15511f92e5216fa2624b
function BadRequestError(message) {
    if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
    }
    this.name = this.constructor.name;
    this.message = message;
}

require('util').inherits(BadRequestError, Error);

module.exports = BadRequestError;
