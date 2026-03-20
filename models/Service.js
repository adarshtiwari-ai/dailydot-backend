const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  mrp: {
    type: Number
  },
  isStartingPrice: {
    type: Boolean,
    default: false
  },
  inclusions: [{
    type: String
  }],
  exclusions: [{
    type: String
  }],
  duration: {
    type: Number,
    default: 60
  },
  images: [String],
  imageUrl: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  tagId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false // Not all services might have a tag initially
  },
  isTopBooked: {
    type: Boolean,
    default: false
  },
  isTrending: {
    type: Boolean,
    default: false
  },
  section: {
    type: String,
    enum: ['general', 'car_on_wheels', 'decor'],
    default: 'general'
  },
  pricingUnit: {
    type: String,
    enum: ['fixed', 'hourly', 'sq_ft'],
    default: 'fixed'
  },
  averageRating: {
    type: Number,
    default: 0
  },
  totalRatings: {
    type: Number,
    default: 0
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

      // Transform images array
      if (ret.images && Array.isArray(ret.images)) {
        ret.images = ret.images.map(img => {
          if (img && !img.startsWith('http')) {
            return `${baseUrl}${img}`;
          }
          return img;
        });
      }

      // Transform virtual image field
      if (ret.image && !ret.image.startsWith('http')) {
        ret.image = `${baseUrl}${ret.image}`;
      }

      return ret;
    }
  }
});

// Virtual for single image (frontend compatibility)
serviceSchema.virtual('image').get(function () {
  return (this.images && this.images.length > 0) ? this.images[0] : '';
});

module.exports = mongoose.model('Service', serviceSchema);