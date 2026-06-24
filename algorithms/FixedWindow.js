import redisClient from '../redisClient.js';

export default class FixedWindow {
    constructor(limit, windowTime) {
        this.limit = limit;
        this.windowTime = windowTime;
    }

    async handleRequest(key) {
        const currentTime = Date.now();
        const rawData = await redisClient.get(key);
        
        if (!rawData) {
            const bucket = { count: 1, windowStart: currentTime };
            await redisClient.set(key, JSON.stringify(bucket));
            console.log(`[ALLOWED] FixedWindow: ${key} (1/${this.limit})`);
            return true;
        }

        const bucket = JSON.parse(rawData);

        if ((currentTime - bucket.windowStart) > (this.windowTime * 1000)) {
            const newBucket = { count: 1, windowStart: currentTime };
            await redisClient.set(key, JSON.stringify(newBucket));
            console.log(`[ALLOWED] FixedWindow: ${key} (Window reset, 1/${this.limit})`);
            return true;
        }

        if (bucket.count < this.limit) {
            bucket.count += 1;
            await redisClient.set(key, JSON.stringify(bucket));
            console.log(`[ALLOWED] FixedWindow: ${key} (${bucket.count}/${this.limit})`);
            return true;
        }

        console.log(`[BLOCKED] FixedWindow: ${key} (Limit reached)`);
        return false;
    }
}