/**
 * Created by umang on 26/05/17.
 */
var assert = require('assert');
var Aerospike = require('aerospike');
var log4js = require('log4js');
var logger = log4js.getLogger('Rate limiter');

const DEFAULT_PREFIX = "RATE_LIMIT";
const SEPARATOR = "#";

/**
 * Constructor
 * @param client  Aerospike client
 * @param namespace Aerospike namespace
 * @param set      Aerospike set
 * @param options  {duration: rate-limit duration, limit: hits allowed in duration, prefix: key prefix (optional) }
 * @constructor
 */
var RateLimiter = function (client, namespace, set, options) {
    this.options = verifyAndCreateOptions(options);
    this.namespace = namespace;
    this.set = set;
    this.client = client;

    this.client.connect(function (error) {
        if (error)
            throw error;
    });
};

/**
 * Increment hits count if hits not breached
 * else create record in aerospike
 * @param key
 * @param callback (error, isRateLimited)
 */
RateLimiter.prototype.increment = function (key, callback) {
    var aerospikeKey = this.buildAerospikeKey(key);
    var self = this;

    this.client.get(aerospikeKey, function (error, record) {
        if (error) {
            switch (error.code) {
                case Aerospike.status.AEROSPIKE_ERR_RECORD_NOT_FOUND:
                    return self.createRecord(aerospikeKey, callback);
                    break;
                default:
                    logger.error("Error while GET record from aerospike", error);
                    return callback(error);
            }
        }

        if (record.hits < self.options.limit) {
            return self.updateRecord(aerospikeKey, record, callback);
        }

        logger.info("Key rate limited: " + key + ", retry after seconds: " + self.getRemainingTime(record));
        return callback(null, true);
    });
};

/**
 * Remove key from aerospike
 * @param key
 * @param callback
 */
RateLimiter.prototype.reset = function (key, callback) {
    var aerospikeKey = this.buildAerospikeKey(key);

    this.client.remove(aerospikeKey, function (error) {
        if (error) {
            logger.error("Error while reset:", error);
            return callback(error);
        }

        return callback(null);
    })
};

/**
 * Create aerospike key = "PREFIX:KEY"
 * @param key
 * @returns {*}
 */
RateLimiter.prototype.buildAerospikeKey = function (key) {
    var k = this.options.prefix + SEPARATOR + key;
    return new Aerospike.Key(this.namespace, this.set, k);
};

/**
 * Increment hits count and re-calculate the ttl
 * @param aerospikeKey
 * @param record
 * @param callback
 */
RateLimiter.prototype.updateRecord = function (aerospikeKey, record, callback) {
    record.hits = record.hits + 1;
    var ttl = this.getRemainingTime(record);
    logger.info("TTL:", ttl);

    //ignore update if ttl is less than or equal to 0
    if (ttl <= 0)
        return callback(null);

    var metadata = {ttl: ttl};

    this.client.put(aerospikeKey, record, metadata, function (error, record) {
        if (error) {
            logger.error("Error while updating record in aerospike", error);
            return callback(error);
        }

        return callback(null);
    })
};

/**
 * Record format : {createdAt: time, hits: integer}
 * @param aerospikeKey
 * @param callback
 */
RateLimiter.prototype.createRecord = function (aerospikeKey, callback) {
    var record = {
        createdAt: Math.round(Date.now() / 1000),
        hits: 1
    };

    var metadata = {ttl: this.options.duration};

    this.client.put(aerospikeKey, record, metadata, function (error, record) {
        if (error) {
            logger.error("Error while putting record in aerospike", error);
            return callback(error);
        }

        return callback(null);
    })
};

var verifyAndCreateOptions = function (options) {
    assert(options.limit, "Limit missing in rate limit options");
    assert(options.duration, "Duration missing in rate limit options");

    if (!('prefix' in options)) options.prefix = DEFAULT_PREFIX;

    return options;
};

RateLimiter.prototype.getRemainingTime = function (record) {
    return this.options.duration - (Math.round(Date.now() / 1000) - record.createdAt);
};

module.exports = RateLimiter;