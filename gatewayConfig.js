export const gatewayConfig = {
    "/api/login": { 
        algorithm: "FixedWindow", 
        limit: 5, 
        windowTime: 60 // 5 req / min
    },
    "/api/book-cab": { 
        algorithm: "SlidingWindow", 
        limit: 10, 
        windowTime: 30 // 10 requests per 30sec
    },
    "DEFAULT": { 
        algorithm: "TokenBucket", 
        capacity: 50, 
        refillAmount: 1, 
        refillTime: 1 
    }
};