![](http://i.imgur.com/M6O2YgB.png)

[![Build Status](https://travis-ci.org/gamechanger/lox.svg?branch=master)](https://travis-ci.org/gamechanger/lox)

## Lox: A simple distributed lock manager

### Installation

Lox is a Node.js service. After cloning the repository, you can run it with:

```
npm install
node lox.js
```

If Docker is more your style, a public image is provided at `thieman/lox`. Versions are tagged to correspond with the tags in this repository. You can also build your own image with the `Dockerfile` in this repository.

```
docker pull thieman/lox:latest
docker run -p 80:80 thieman/lox:latest
```

### Getting Started

Lox relies on an underlying [Redis](http://redis.io/) instance. Once you have one of those set up, you can start a Lox service. Lox knows about the following configuration variables (defaults in parentheses):

```
port: port on which to run the Lox HTTP API (80)
redis_host: host of the underlying Redis instance (localhost)
redis_port: port of the underlying Redis instance (6379)
log_requests: if TRUE, logs info on each HTTP request to stdout (false)
debug: if TRUE, enables additional debug information in logs (false)
```

These can all be provided at runtime either through command line args or as `LOX_` prefixed environment variables.

```
node lox.js --redis_host redis.gamechanger.io
LOX_REDIS_HOST=redis.gamechanger.io node lox.js
```

### HTTP API

The HTTP API has a whopping two endpoints and is [documented here](http://gamechanger.github.io/lox/docs/api.html).
