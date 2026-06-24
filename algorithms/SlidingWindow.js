import redisClient from '../redisClient.js';

export default class SlidingWindow {
    constructor(limit, windowTime) {
        this.limit = limit;
        this.windowTime = windowTime;
    }

    async handleRequest(key) {
        const currentTime = Date.now();
        const windowStart = currentTime - (this.windowTime * 1000); 
        
        const rawData = await redisClient.get(key);
        let timestamps = rawData ? JSON.parse(rawData) : [];

        // O(N) Cleanup of expired timestamps
        timestamps = timestamps.filter(ts => ts > windowStart);

        if (timestamps.length < this.limit) {
            timestamps.push(currentTime);
            await redisClient.set(key, JSON.stringify(timestamps));
            console.log(`[ALLOWED] SlidingWindow: ${key} (${timestamps.length}/${this.limit})`);
            return true;
        }

        await redisClient.set(key, JSON.stringify(timestamps));
        console.log(`[BLOCKED] SlidingWindow: ${key} (Limit reached)`);
        return false;
    }
}