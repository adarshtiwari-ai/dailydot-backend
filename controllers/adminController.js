const Booking = require('../models/Booking');
const User = require('../models/User');
const { sendPushNotification } = require('../utils/pushService');
const { calculateBillDetails } = require('../services/billingService');
const walletService = require('../services/walletService');
const ProviderWallet = require('../models/ProviderWallet');

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

        if (booking.userId) {
            let pushTitle = '';
            let pushBody = '';

            if (status.toLowerCase() === 'confirmed') {
                pushTitle = 'Booking Confirmed! ✅';
                pushBody = 'A professional has been assigned to your job.';
            } else if (status.toLowerCase() === 'completed') {
                pushTitle = 'Job Completed! 🎉';
                pushBody = 'Your service is finished. Tap to view the final receipt.';
            }

            if (pushTitle && pushBody) {
                await sendPushNotification(
                    booking.userId,
                    pushTitle,
                    pushBody,
                    { bookingId: booking._id.toString(), type: "status_update" }
                );
            }
        }

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

        // Recalculate true Grand Total using dynamic billing engine
        const adjustments = booking.adjustments || [];
        const result = await calculateBillDetails(booking.baseCost, adjustments, [], booking.materials);
        
        // Sync dynamic fields
        booking.appliedFees = result.appliedFees;
        booking.appliedDiscounts = result.appliedDiscounts;
        booking.taxAmount = result.taxAmount;
        booking.serviceFee = result.serviceFee;
        booking.convenienceFee = result.convenienceFee;
        booking.finalTotal = result.finalTotal;

        await booking.save();

        if (booking.userId) {
            await sendPushNotification(
                booking.userId,
                'Bill Updated 🧾',
                'New materials were added to your booking. Tap to view the updated total.',
                { bookingId: booking._id.toString(), type: "material_added" }
            );
        }

        res.json({ success: true, message: 'Material added successfully', booking });
    } catch (error) {
        console.error('Error adding booking material:', error);
        res.status(500).json({ success: false, message: 'Server error while adding material' });
    }
};

exports.adjustBookingPrice = async (req, res) => {
    try {
        const { id } = req.params;
        const { additionalItems } = req.body; // Array of { reason: string, amount: number }

        if (!Array.isArray(additionalItems) || additionalItems.length === 0) {
            return res.status(400).json({ success: false, message: 'additionalItems must be a non-empty array' });
        }

        const booking = await Booking.findById(id);
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // Prepare combined adjustments
        const currentAdjustments = booking.adjustments || [];
        const combinedAdjustments = [...currentAdjustments, ...additionalItems];

        // Use billingService to recalulate
        const result = await calculateBillDetails(booking.baseCost, combinedAdjustments, [], booking.materials);

        // Update the Booking document
        booking.adjustments = combinedAdjustments;
        booking.appliedFees = result.appliedFees;
        booking.appliedDiscounts = result.appliedDiscounts;
        
        // Fees and Taxes
        booking.taxAmount = result.taxAmount;
        booking.serviceFee = result.serviceFee;
        booking.convenienceFee = result.convenienceFee;
        
        booking.taxDetails = {
            cgst: result.cgst,
            sgst: result.sgst,
            platformFee: result.platformFee
        };

        // Final Total from dynamic engine
        booking.finalTotal = result.finalTotal;
        
        booking.billingStatus = 'finalized';

        await booking.save();

        // Real-time Sync via Socket.io to the customer (userId)
        try {
            const { getIo } = require("../services/socket.service");
            getIo().to(booking.userId.toString()).emit("bill_updated", {
                bookingId: booking._id.toString(),
                newTotal: result.finalTotal,
                billingStatus: booking.billingStatus,
                message: "Your bill has been updated with new adjustments."
            });
        } catch (err) {
            console.error("Socket emit failed for bill_updated:", err.message);
        }

        res.json({ success: true, message: 'Booking price adjusted successfully', booking });
    } catch (error) {
        console.error('Error adjusting booking price:', error);
        res.status(500).json({ success: false, message: error.message || 'Server error while adjusting price' });
    }
};

exports.settleProviderDues = async (req, res) => {
    try {
        const { id } = req.params; // providerId
        const { amount } = req.body; // expected in paise

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Valid positive amount in paise is required' });
        }

        const wallet = await walletService.settleDues(id, amount);

        res.json({ success: true, message: 'Provider dues settled successfully', wallet });
    } catch (error) {
        console.error('Error settling provider dues:', error);
        res.status(500).json({ success: false, message: 'Server error while settling dues' });
    }
};

exports.getProviderWallets = async (req, res) => {
    try {
        const wallets = await ProviderWallet.find()
            .populate('providerId', 'name phone email')
            .sort({ balance: 1 }); // those with negative balance (debt) at the top

        res.json({ success: true, count: wallets.length, wallets });
    } catch (error) {
        console.error('Error fetching provider wallets:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching wallets' });
    }
};

exports.broadcastNotification = async (req, res) => {
    try {
        const { title, message } = req.body;

        if (!title || !message) {
            return res.status(400).json({ success: false, message: 'Title and message are required' });
        }

        // Fetch all users who have a valid push token
        const users = await User.find({ pushToken: { $exists: true, $ne: '' } }).select('_id');
        const userIds = users.map(user => user._id);

        if (userIds.length === 0) {
            return res.status(404).json({ success: false, message: 'No users found with valid push tokens' });
        }

        // Using the existing sendPushNotification utility
        const result = await sendPushNotification(userIds, title, message, { type: 'marketing_broadcast' });

        res.json({
            success: true,
            count: userIds.length,
            message: `Broadcasting to ${userIds.length} users...`,
            details: result
        });
    } catch (error) {
        console.error('Error in broadcastNotification:', error);
        res.status(500).json({ success: false, message: 'Server error while sending broadcast' });
    }
};
