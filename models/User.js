const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    unique: true,
    sparse: true
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  appleId: {
    type: String,
    unique: true,
    sparse: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true, // Allows multiple null/undefined values
    lowercase: true
  },
  password: {
    type: String,
    select: false
  },
  phone: {
    type: String,
    unique: true,
    sparse: true,
  },
  fcmToken: {
    type: String,
    default: ''
  },
  pushToken: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['user', 'provider', 'admin'],
    default: 'user'
  },
  addresses: [{
    type: {
      type: String,
      enum: ['home', 'work', 'other'],
      default: 'home'
    },
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    pincode: String,
    receiverName: String,
    receiverPhone: String,
    isDefault: Boolean,
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);