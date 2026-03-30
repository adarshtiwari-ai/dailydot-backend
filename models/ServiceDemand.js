const mongoose = require('mongoose');

const serviceDemandSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  serviceName: {
    type: String,
    required: true,
    trim: true
  },
  categoryName: {
    type: String,
    required: true,
    trim: true
  },
  location: {
    type: String,
    default: 'Mandla'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ServiceDemand', serviceDemandSchema);
