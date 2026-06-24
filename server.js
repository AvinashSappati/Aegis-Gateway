import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import dotenv from 'dotenv';
import './redisClient.js';
import { gatewayConfig } from './gatewayConfig.js';
import TokenBucket from './algorithms/TokenBucket.js';
import FixedWindow from './algorithms/FixedWindow.js';
import SlidingWindow from './algorithms/SlidingWindow.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const TARGET_BACKEND = process.env.TARGET_BACKEND || 'http://localhost:5000';

const activeAlgorithms = {};

// Policy Initialization (Strategy Pattern)
for (const [route, config] of Object.entries(gatewayConfig)) {
    if (config.algorithm === "TokenBucket") {
        activeAlgorithms[route] = new TokenBucket(config.capacity, config.refillAmount, config.refillTime);
    } else if (config.algorithm === "FixedWindow") {
        activeAlgorithms[route] = new FixedWindow(config.limit, config.windowTime);
    } else if (config.algorithm === "SlidingWindow") {
        activeAlgorithms[route] = new SlidingWindow(config.limit, config.windowTime);
    }
}

// The Core Shield Middleware
const aegisShield = async (req, res, next) => {
    try {
        const userIP = req.ip;
        const requestPath = req.path;
        
        const policyKey = gatewayConfig[requestPath] ? requestPath : "DEFAULT";
        const limiter = activeAlgorithms[policyKey];
        const trackingKey = `${policyKey}:${userIP}`;

        const isAllowed = await limiter.handleRequest(trackingKey);

        if (!isAllowed) {
            return res.status(429).json({
                error: "Too Many Requests",
                message: `Aegis Shield active: Rate limit exceeded for ${requestPath}`
            });
        }

        next();
    } catch (error) {
        console.error("Aegis Error:", error);
        return res.status(500).json({ error: "Internal Gateway Error" });
    }
};

app.use(aegisShield);

// Proxy Routing
app.use('/', createProxyMiddleware({
    target: TARGET_BACKEND,
    changeOrigin: true,
}));

app.listen(PORT, () => {
    console.log(`Aegis Edge Gateway running on port ${PORT}`);
    console.log(`Proxying traffic to: ${TARGET_BACKEND}`);
});