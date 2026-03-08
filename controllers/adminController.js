const Booking = require('../models/Booking');

exports.updateBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ success: false, message: 'Status is required in request body' });
        }

        const validStatuses = ["Pending", "Confirmed", "Completed", "Cancelled", "pending", "confirmed", "assigned", "on_the_way", "in_progress", "completed", "cancelled"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        const booking = await Booking.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // TODO: This endpoint should eventually trigger a push notification back to the user's phone saying "Your booking is confirmed!"

        res.json({ success: true, message: `Booking status updated to ${status}`, booking });
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({ success: false, message: 'Server error while updating status' });
    }
};

exports.addBookingMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, cost } = req.body;

        if (!name || cost === undefined) {
            return res.status(400).json({ success: false, message: 'Material name and cost are required' });
        }

        const booking = await Booking.findById(id);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // Initialize baseCost if it doesn't exist
        if (booking.baseCost === undefined) {
            booking.baseCost = booking.totalAmount;
        }

        // Push new material
        booking.materials.push({ name, cost: Number(cost) });

        // Recalculate finalTotal
        const materialsTotal = booking.materials.reduce((sum, item) => sum + item.cost, 0);
        booking.finalTotal = booking.baseCost + materialsTotal;

        await booking.save();

        res.json({ success: true, message: 'Material added successfully', booking });
    } catch (error) {
        console.error('Error adding booking material:', error);
        res.status(500).json({ success: false, message: 'Server error while adding material' });
    }
};
