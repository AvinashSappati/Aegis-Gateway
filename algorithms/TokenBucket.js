import redisClient from '../redisClient.js';

export default class TokenBucket {
    constructor(capacity, refillAmount, refillTime) {
        this.capacity = capacity;
        this.refillAmount = refillAmount;
        this.refillTime = refillTime;
    }

    async handleRequest(key) {
        const currentTime = Date.now();
        const rawData = await redisClient.get(key);
        let bucket = rawData ? JSON.parse(rawData) : { tokens: this.capacity, ts: currentTime };

        const elapsedTime = Math.floor((currentTime - bucket.ts) / 1000);

        if (elapsedTime >= this.refillTime) {
            const refillMultiplier = Math.floor(elapsedTime / this.refillTime);
            const newTokens = refillMultiplier * this.refillAmount;
            bucket.tokens = Math.min(this.capacity, bucket.tokens + newTokens);
            bucket.ts = currentTime;
        } 
        
        if (bucket.tokens <= 0) {
            console.log(`[BLOCKED] TokenBucket: ${key} (0 tokens left)`);
            await redisClient.set(key, JSON.stringify(bucket)); 
            return false;
        }

        bucket.tokens -= 1;
        await redisClient.set(key, JSON.stringify(bucket));
        console.log(`[ALLOWED] TokenBucket: ${key} (${bucket.tokens} tokens left)`);
        
        return true;
    }
}