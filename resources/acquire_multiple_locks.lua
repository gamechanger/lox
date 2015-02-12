local lockIdsPipeDelimited = ARGV[1]
local maximumLocks = tonumber(ARGV[2])
local ttlSeconds = tonumber(ARGV[3])

local lockIds = {}
for match in string.gmatch(lockIdsPipeDelimited, "[^|]+") do
   table.insert(lockIds, match)
end

local heldLocks
for index, lockKey in pairs(KEYS) do
   heldLocks = redis.call('scard', lockKey)
   if heldLocks >= maximumLocks then
      return false
   end
end

local lockId
for index, lockKey in ipairs(KEYS) do
   lockId = lockIds[index]
   redis.call('sadd', lockKey, lockId)
   redis.call('setex', lockId, ttlSeconds, lockKey)
end

return true
