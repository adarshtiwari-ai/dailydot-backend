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
