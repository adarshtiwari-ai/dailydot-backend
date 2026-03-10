const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  description: String,
  icon: String,
  image: String,
  imageUrl: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  tags: [{
    name: { type: String, required: true },
    icon: { type: String, required: true } // Ionicon name
  }]
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      if (ret.image && !ret.image.startsWith('http')) {
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        ret.image = `${baseUrl}${ret.image}`;
      }
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Cascade delete services when a category is deleted
categorySchema.pre('findOneAndDelete', async function (next) {
  try {
    const category = await this.model.findOne(this.getQuery());
    if (category) {
      const Service = mongoose.model('Service');
      await Service.deleteMany({ category: category._id });
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Category', categorySchema);