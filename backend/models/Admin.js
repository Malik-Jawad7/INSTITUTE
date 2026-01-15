const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        default: 'admin'
    },
    password: {
        type: String,
        required: true,
        default: 'admin123'
    },
    email: {
        type: String,
        default: 'admin@shamsi.edu.pk'
    },
    role: {
        type: String,
        enum: ['admin', 'super-admin'],
        default: 'admin'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    }
});

// Add index for faster queries
adminSchema.index({ username: 1 });

module.exports = mongoose.model('Admin', adminSchema);