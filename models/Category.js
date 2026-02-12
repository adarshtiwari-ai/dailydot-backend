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
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  tags: [String]
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