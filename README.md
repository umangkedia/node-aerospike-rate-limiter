Node Aerospike Rate Limiter
============

NodeJS library for fixed window rate limiting using Aerospike as data store.

Features
----------
* Uses Fixed window for rate limiting
* Multiple rules per RateLimiter instance
* Ability to create multiple RateLimiter instance
* Can be used through middleware as well
* Ability to pass custom methods for rate limiting - Defaults to IP based rate limiting

Install
-------
```
npm install node-aerospike-rate-limiter --save
```

Examples
--------

**Basic Usage**

```javascript
var RateLimiter = require("node-aerospike-rate-limiter").RateLimiter;
var Aerospike   = require('aerospike');
const client = Aerospike.client(); //create aerospike client

/* Create an instance of RateLimiter, create multiple instance if required */
var options = {duration: 15, limit: 5, prefix: "SOME_KEY_PREFIX"}; //duration in seconds, prefix is optional Eg: 5 requests in 15 seconds
var rateLimiter = new RateLimiter(client, 
        namespace, //aerospike namespace
        rateLimitSet, //aerospike set
        options);

/* rate limit on any key. like email, ip etc */
rateLimiter.increment("key", function (error, isRateLimited) {
    if (error) //handle error
        
    if (isRateLimited) {
        return res.status(429).json({message: 'Rate limit exceeded'});
    }
    
    //else continue with normal flow
})

/* reset rate limit for the key 
Eg: if you are rate limiting on Login and want to reset after a successful login */

rateLimiter.reset("key", function (error) {
    //handle error or continue with normal flow
})
```

**Usage as Middleware**

Rate Limit all the endpoints:

```javascript
var RateLimiter = require("node-aerospike-rate-limiter").RateLimiter;
var RateLimiterMiddleware = require("node-aerospike-rate-limiter").RateLimitMiddleware;
var Aerospike   = require('aerospike');
const client = Aerospike.client(); //create aerospike client

/* Create an instance of RateLimiter */
var options = {duration: 15, limit: 5, prefix: "SOME_KEY_PREFIX"}; //duration in seconds, prefix is optional
var rateLimiter = new RateLimiter(client, 
        namespace, //aerospike namespace
        rateLimitSet, //aerospike set
        options);

var rateLimitMiddleware = new RateLimiterMiddleware(rateLimiter);

app.use(rateLimitMiddleware.limit(function (req, res) {
    res.status(429).json({message: 'Rate limit exceeded'});
}));
```

Rate Limit specific endpoints:

```javascript
var rateLimitMiddleware = new RateLimiterMiddleware(rateLimiter);

var limit = rateLimitMiddleware.limit(function (req, res) {
    res.status(429).json({message: 'Rate limit exceeded'});
});

app.post("/api", limit, function(req, res, next) {
  
});
```

**Rate Limiting on custom field**

If you want to rate limit on custom fields, you need to pass it in options to the middleware. By default, it rate limits on user's IP

```javascript
//Create a custom method, req should be passed to the method
var keyExtractor = function (req) {
    return req.headers['x-app-id']; //return any custom string, will be used as key
};

var limit = rateLimitMiddleware.limit({keyExtractor: keyExtractor}, function (req, res) {
    res.status(429).json({message: 'Rate limit exceeded'});
});

app.post("/api", limit, function(req, res, next) {
  
});
```

If you want to disable rate limiting for staging environment:

```javascript
var options = {keyExtractor: keyExtractor, ignoreRateLimiting: true}; //defaults to false

var limit = rateLimitMiddleware.limit(options, function (req, res) {
    res.status(429).json({message: 'Rate limit exceeded'});
});
```