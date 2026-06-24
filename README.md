# Aegis: Distributed API Gateway & Policy Engine

A high-performance, Low-Level Design (LLD) focused API Gateway built with Node.js and Redis. Aegis acts as a reverse proxy shield, protecting the core **KGPTransit** microservices from traffic surges, brute-force attacks, and DDoS attempts using dynamic, route-based rate limiting.

---

## Core Architecture & System Design

Aegis shifts the computational burden of traffic management away from the primary business database (MongoDB) and onto an in-memory, distributed state store (Redis). 

* **O(1) Route Resolution:** Utilizes a configuration Hash Map to dynamically assign routing policies based on URL prefixes in `O(1)` time complexity.
* **Strategy Pattern Implementation:** Object-Oriented algorithm design allows hot-swapping between `TokenBucket`, `FixedWindow`, and `SlidingWindow` limiters without modifying the core proxy engine.
* **Lazy Evaluation Math:** Optimizes CPU usage by abandoning traditional `setInterval` cron jobs. Token replenishment is calculated mathematically on the fly only when a request arrives, keeping time complexity strictly at `O(1)` per active user.
* **Distributed State:** Backed by Redis, allowing multiple Gateway instances to run concurrently across different cloud regions while sharing the exact same rate-limiting state.

---

## Project Structure (Separation of Concerns)

```text
aegis-gateway/
│
├── algorithms/                 # OOP Strategy Pattern Classes
│   ├── TokenBucket.js          # Fluid traffic control (Lazy Refill)
│   ├── FixedWindow.js          # Strict cutoff logic
│   └── SlidingWindow.js        # High-accuracy timestamp logging
│
├── .env                        # Secret variables (Git Ignored)
├── docker-compose.yml          # Container orchestration map
├── gatewayConfig.js            # O(1) Policy Routing Hash Map
├── redisClient.js              # Database connection singleton
└── server.js                   # The Core Async Gateway Engine
```

---

## How to Use & Configure

### 1. Environment Setup (`.env`)
Aegis operates as a completely decoupled microservice. Create a `.env` file in the root directory to securely link to your target backend and Redis instance:

```env
PORT=8000
# Target your local backend or a live cloud URL
TARGET_BACKEND=[https://kgp-pooling.onrender.com](https://kgp-pooling.onrender.com) 

# Use a local Docker Redis or a Serverless Upstash instance
REDIS_URL=rediss://default:password@your-endpoint.upstash.io:6379 
```

### 2. The Policy Engine (`gatewayConfig.js`)
To protect a new microservice, developers do not need to write rate-limiting code. Simply define the rule in the Hash Map. Aegis dynamically loads the correct algorithm instance.

```javascript
export const gatewayConfig = {
    // Strict cutoff for high-risk auth routes (IP-Based)
    "/api/login": { 
        algorithm: "FixedWindow", 
        limit: 5, 
        windowTime: 60 
    },
    // Fluid traffic control for heavy DB-query routes
    "/api/book-cab": { 
        algorithm: "SlidingWindow", 
        limit: 10, 
        windowTime: 30 
    },
    // Fail-Safe: Protects unlisted microservices
    "DEFAULT": { 
        algorithm: "TokenBucket", 
        capacity: 50, 
        refillAmount: 1, 
        refillTime: 1 
    }
};
```

---

## Deployment Guide (Serverless Cloud)

Aegis is designed to run completely isolated from the core backend.

1. **Database:** Provision a free Serverless Redis database via **Upstash**.
2. **Platform:** Connect this GitHub repository to **Render** as a Node Web Service.
3. **Runtime Environment:** Select `Node`.
4. **Commands:** * Build: `npm install`
   * Start: `node server.js`
5. **DNS Switch:** Update the client-side frontend to send all API requests to the new Aegis Render URL. Aegis will process the velocity check and securely proxy safe traffic to the isolated KGPTransit backend.

*(Note: For local testing, a complete `docker-compose.yml` is included to spin up Aegis and Redis in an isolated Docker Bridge Network).*

---

## Technical Q&A & Architectural Trade-offs

### Q: Why use Redis strictly for Rate Limiting and not Data Caching?
**A:** Separation of Concerns and Security. If the Gateway caches application domain data (like user profiles or ride history), we introduce a severe risk of **Cross-User Data Leakage**, especially on authenticated routes. Aegis is strictly a network velocity tracker. Data caching is handled downstream at the application layer where session logic lives.

### Q: How does the Gateway handle the "Campus NAT Problem"?
**A:** In a university environment, hundreds of students share a single public IP address through the hall routers. Strict IP-based rate limiting would cause a massive false-positive block (Denial of Service) for legitimate students trying to coordinate cabs simultaneously. 
**Solution:** Aegis is designed with a Two-Tier strategy. For unauthenticated routes (`/login`), it uses high-capacity IP limits. For core app features, Aegis decodes the incoming JWT at the edge layer and uses the unique `User ID` as the Redis Key, ensuring fair application usage regardless of network topology.

### Q: Why build a custom Gateway instead of using libraries like `express-rate-limit`?
**A:** Most basic NPM libraries store state in local memory. If the platform scales horizontally to three Gateway containers, a user could bypass limits by hitting different containers. By writing the core OOP algorithms from scratch and wiring them directly to a distributed Redis client, Aegis guarantees strict, centralized enforcement across the entire cluster.
