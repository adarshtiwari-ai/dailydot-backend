const ServiceDemand = require('../models/ServiceDemand');

exports.joinWaitlist = async (req, res) => {
  try {
    const { name, phone, serviceName, categoryName } = req.body;

    if (!name || !phone || !serviceName || !categoryName) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const demand = new ServiceDemand({
      userId: req.user ? req.user.id : null,
      name,
      phone,
      serviceName,
      categoryName,
      location: 'Mandla' // Localized for user request
    });

    await demand.save();

    res.status(201).json({ 
      success: true, 
      message: 'Successfully joined the waitlist!' 
    });
  } catch (error) {
    console.error('Waitlist Join Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getAllDemands = async (req, res) => {
  try {
    const demands = await ServiceDemand.find()
      .populate('userId', 'name phone')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: demands });
  } catch (error) {
    console.error('Fetch Demands Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
