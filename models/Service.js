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
  duration: {
    type: Number,
    default: 60
  },
  images: [String],
  isActive: {
    type: Boolean,
    default: true
  },
  tags: [String],
  isTopBooked: {
    type: Boolean,
    default: false
  },
  section: {
    type: String,
    enum: ['general', 'car_on_wheels', 'decor'],
    default: 'general'
  }
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