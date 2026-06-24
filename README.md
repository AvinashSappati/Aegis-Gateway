# Aegis: Distributed API Gateway & Policy Engine

A high-performance, Low-Level Design (LLD) focused API Gateway built with Node.js and Redis. Aegis acts as a reverse proxy shield, protecting the core **Backend** microservices from traffic surges, brute-force attacks, and DDoS attempts using dynamic, route-based rate limiting.

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

### Network Flow Topology

```mermaid
sequenceDiagram
    participant Client as Student Device
    participant Aegis as Aegis Gateway (Render)
    participant Redis as Upstash Redis (Serverless)
    participant Core as Backend

    Client->>Aegis: HTTP POST /api/book-cab
    Note over Aegis: O(1) Hash Map Lookup:<br/>Assigns SlidingWindow
    Aegis->>Redis: GET aegis:/api/book-cab:[User_ID]
    Redis-->>Aegis: Returns Timestamp Array
    Note over Aegis: Algorithm evaluates velocity.<br/>If limit exceeded -> Drop.
    Aegis->>Redis: SET Updated Timestamps
    Aegis->>Core: Proxies Safe Traffic
    Core-->>Client: 200 OK 
```

---

## Traffic Capacity & System Limits

Aegis is designed to scale horizontally, but the current MVP operates on Serverless Free Tiers to maintain a zero-cost infrastructure footprint. 

| Infrastructure Component | Current Tier Limit | Gateway Capacity |
| :--- | :--- | :--- |
| **Upstash Redis** | 10,000 Commands / Day | **5,000 HTTP Requests / Day** (Each Aegis check requires 1 GET and 1 SET operation). |
| **Render Web Service** | 512 MB RAM / 0.1 CPU | **~500 Concurrent Connections** (Node.js async non-blocking I/O). |
| **Latency Target** | < 5ms to Redis | **Near-Zero Proxy Overhead** due to geographically close Serverless DB instances. |

*Note: For enterprise scale, swapping the Upstash Free Tier for a dedicated Redis Cluster allows Aegis to comfortably process 100,000+ Requests Per Minute (RPM).*

---

## Active Rate-Limiting Policies

To protect a new microservice, developers simply define the rule in the Hash Map. Aegis dynamically loads the correct OOP algorithm instance.

| Target Route | Algorithm | Limit | Refill / Window | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `/api/login` | **Fixed Window** | 5 Requests | 60 Seconds | Strict cutoff to prevent brute-force password attacks. |
| `/api/book-cab` | **Sliding Window** | 10 Requests | 30 Seconds | High-accuracy logging for heavy DB-query routes. |
| `DEFAULT` | **Token Bucket** | 50 Requests | 1 Token / Sec | Fail-safe fluid traffic control for all unlisted microservices. |

---


---

## How to Use & Configure

### 1. Environment Setup (`.env`)
Aegis operates as a completely decoupled microservice. Create a `.env` file in the root directory to securely link to your target backend and Redis instance:

```env
PORT=8000
TARGET_BACKEND=BACKEND_URL
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
