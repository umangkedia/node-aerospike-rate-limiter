/**
 * Created by umang on 29/05/17.
 */

var RateLimiterMiddleWare = function (RateLimiter) {
    this.RateLimiter = RateLimiter;
};

RateLimiterMiddleWare.prototype.limit = function (options, callback) {
    if (!callback) {
        callback = options;
        options = {};
    }

    if (!('keyExtractor' in options)) {
        options.keyExtractor = extractIp;
    }
    else if (typeof(options.keyExtractor) !== 'function') {
        throw new Error("KeyExtractor should be a function");
    }

    options.ignoreRateLimiting = options.ignoreRateLimiting || false;

    var self = this;

    return function (req, res, next) {
        var key = options.keyExtractor(req);
        self.RateLimiter.increment(key, function (error, isRateLimited) {
            if (error) {
                return next(error);
            }

            if (isRateLimited && !options.ignoreRateLimiting) {
                return callback(req, res);
            }

            return next();
        })
    }
};

var extractIp = function (req) {
    return req.headers['x-forwarded-for'] || req.connection.remoteAddress;
};

module.exports = RateLimiterMiddleWare;