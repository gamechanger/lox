## Lox: A simple distributed lock manager

[![Build Status](https://travis-ci.org/gamechanger/lox.svg?branch=master)](https://travis-ci.org/gamechanger/lox)

### Installation

Lox is a Node.js service. After cloning the repository, you can run it with:

```
npm install
node lox.js
```

If Docker is more your style, a public image is provided at `gamechanger/lox`. Versions are tagged to correspond with the tags in this repository. You can also build your own image with the `Dockerfile` in this repository.

```
docker pull gamechanger/lox:latest
docker run -p 80:80 gamechanger/lox:latest
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

The HTTP API has a whopping three endpoints and is [documented here](http://gamechanger.github.io/lox/docs/api.html).

### Example Usage

At [GameChanger](http://gc.com), we use Lox to manage our deploy process. We can have multiple clusters of varying sizes all deploying at various rates that they self-determine. Lox's lock expiration also prevents us from running into deadlocks.

Let's say we have two nodes, Node A and Node B. They both try to deploy at the same time, but they know they are the only two nodes of their kind so they only want to deploy one at a time so their service remains available. They each make a request to Lox that looks like this:

```
POST /lock
{
  key: "shared-deploy-key",
  maximumLocks: 1,
  ttlSeconds: 60
}
```

Each node wants a piece of the same shared lock, `shared-deploy-key`. By passing `maximumLocks` of `1`, they let Lox know that they are only willing to accept a lock if they would be the only client holding a lock on `shared-deploy-key`. Finally, they let Lox know they only want the lock for 60 seconds through `ttlSeconds`.

Assuming these requests go out simultaneously, one node will get a lock and see this response:

```
201 CREATED
{
  lockId: "some-automatically-generated-uuid"
}
```

And the other will see this, indicating it was not granted a lock:

```
204 NO CONTENT
```

That's all there is to it! If the node that got the lock finishes and wants to release the lock, it takes the `lockId` it got from its request and calls:

```
DELETE /lock/:lockId
```

It then receives:

```
204 NO CONTENT
```

### Contributing

To run tests locally, make sure you've pointed Lox to a Redis that isn't part of your production stack, then run `npm test`. If you want to run a local Redis for testing, [Docker](http://docker.io) is great for that.

Issues and pull requests are warmly received in the spirit of friendship.
