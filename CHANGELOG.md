### 0.0.3 (February 12, 2015)

  * Added endpoint `POST /locks` which allows for all-or-nothing acquisition of multiple locks subject to the same `maximumLocks` and `ttlSeconds` constraints. See the API documentation for full details.
  * Lox now attempts to cache its Lua scripts inside of Redis. This eliminates the need to send the entire script to Redis for each evaluation; now Lox need only send the SHA hash of the script each time.

### 0.0.2 (February 11, 2015)

  * Replaced Redis transactions (WATCH/MULTI/EXEC) with a Lua script for lock acquisition. This fixed a bug where transaction behavior could become undefined since we were using a single Redis connection across multiple transactions.

### 0.0.1

  * Initial Release
