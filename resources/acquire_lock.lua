local lockKey = KEYS[1]
local lockId = ARGV[1]
local maximumLocks = tonumber(ARGV[2])
local ttlSeconds = tonumber(ARGV[3])

local heldLocks = redis.call('scard', lockKey)
if heldLocks >= maximumLocks then
   return false
else
   redis.call('sadd', lockKey, lockId)
   redis.call('setex', lockId, ttlSeconds, lockKey)
   return true
end
