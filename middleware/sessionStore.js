/**
 * Mongoose-backed store for Telegraf v4 session middleware.
 * Implements the {get, set, delete} interface.
 */
const Session = require('../model/SessionModel');

module.exports = {
    async get(key) {
        const doc = await Session.findOne({ key }).lean();
        return doc ? doc.data : undefined;
    },
    async set(key, data) {
        await Session.updateOne(
            { key },
            { $set: { data, updatedAt: new Date() } },
            { upsert: true }
        );
    },
    async delete(key) {
        await Session.deleteOne({ key });
    }
};
