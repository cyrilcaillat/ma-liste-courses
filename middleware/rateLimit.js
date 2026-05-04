/**
 * Simple in-memory per-user rate limiter for Telegraf v4.
 * Default: 5 updates per 3 seconds. Excess updates are silently dropped.
 */
module.exports = function rateLimit({ window = 3000, max = 5 } = {}) {
    const buckets = new Map();
    // Periodic cleanup to prevent unbounded growth
    setInterval(() => {
        const now = Date.now();
        for (const [k, v] of buckets) {
            if (now - v.start > window * 10) buckets.delete(k);
        }
    }, window * 10).unref();

    return (ctx, next) => {
        const id = ctx.from && ctx.from.id;
        if (!id) return next();
        const now = Date.now();
        let b = buckets.get(id);
        if (!b || now - b.start > window) {
            b = { start: now, count: 0 };
            buckets.set(id, b);
        }
        b.count++;
        if (b.count > max) {
            console.log('rate-limit drop', id, b.count);
            return; // drop silently
        }
        return next();
    };
};
