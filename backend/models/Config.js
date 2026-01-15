const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
    quizTime: {
        type: Number,
        default: 30,
        min: 1,
        max: 180
    },
    passingPercentage: {
        type: Number,
        default: 40,
        min: 0,
        max: 100
    },
    totalQuestions: {
        type: Number,
        default: 100,
        min: 1
    },
    categoryStatus: {
        mern: { type: Boolean, default: false },
        react: { type: Boolean, default: false },
        node: { type: Boolean, default: false },
        mongodb: { type: Boolean, default: false },
        express: { type: Boolean, default: false }
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Config', configSchema);