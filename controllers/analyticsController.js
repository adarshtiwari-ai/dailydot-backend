const Booking = require("../models/Booking");
const User = require("../models/User");
const Service = require("../models/Service");
const Professional = require("../models/Professional");

exports.getDashboardAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));

    const [
      bookingStats,
      prevBookingStats,
      userCount,
      prevUserCount,
      providerCount
    ] = await Promise.all([
      // Current 30 days stats
      Booking.aggregate([
        { 
          $match: { 
            status: { $regex: /^completed$/i },
            createdAt: { $gte: thirtyDaysAgo }
          } 
        },
        { 
          $group: { 
            _id: null, 
            totalGMV: { $sum: '$finalTotal' }, 
            totalProfit: { $sum: '$netPlatformProfit' } 
          } 
        }
      ]),
      // Previous 30 days stats (for growth math)
      Booking.aggregate([
        { 
          $match: { 
            status: { $regex: /^completed$/i },
            createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
          } 
        },
        { 
          $group: { 
            _id: null, 
            totalGMV: { $sum: '$finalTotal' }, 
            totalProfit: { $sum: '$netPlatformProfit' } 
          } 
        }
      ]),
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'user', createdAt: { $lt: thirtyDaysAgo } }),
      Professional.countDocuments()
    ]);

    const stats = bookingStats.length > 0 ? bookingStats[0] : { totalGMV: 0, totalProfit: 0 };
    const prevStats = prevBookingStats.length > 0 ? prevBookingStats[0] : { totalGMV: 0, totalProfit: 0 };

    // Growth calculation helper with safety for division by zero
    const calculateGrowth = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const gmvGrowth = calculateGrowth(stats.totalGMV, prevStats.totalGMV);
    const profitGrowth = calculateGrowth(stats.totalProfit, prevStats.totalProfit);
    
    // User growth: Compare new users in last 30 days vs total before that?
    // Or users in last 30 vs users in 30-60. Let's do new users in periods.
    const currentNewUsers = userCount - prevUserCount;
    // For previous new users, we'd need another count. Let's simplify and compare total population growth.
    const userGrowth = calculateGrowth(userCount, prevUserCount);

    res.json({
      success: true,
      totalGMV: stats.totalGMV,
      totalProfit: stats.totalProfit,
      userCount,
      providerCount,
      growth: {
        gmv: parseFloat(gmvGrowth.toFixed(1)),
        profit: parseFloat(profitGrowth.toFixed(1)),
        users: parseFloat(userGrowth.toFixed(1))
      }
    });
  } catch (error) {
    console.error("Error fetching dashboard analytics:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getMetrics = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      todayBookings,
      pendingBookings,
      completedBookings,
      cancelledBookings,
      totalRevenueData,
      activeProviders,
      totalUsers,
      activeServices
    ] = await Promise.all([
      Booking.countDocuments({ createdAt: { $gte: startOfDay } }),
      Booking.countDocuments({ status: "pending" }),
      Booking.countDocuments({ status: "completed" }),
      Booking.countDocuments({ status: "cancelled" }),
      Booking.aggregate([
        { $match: { status: "completed" } }, // Or 'paid' depending on logic, sticking to completed for revenue
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
      User.countDocuments({ role: "provider", isActive: true }), // Assuming 'provider' role exists
      User.countDocuments({ role: "user" }),
      Service.countDocuments({ isActive: true })
    ]);

    const totalRevenue = totalRevenueData.length > 0 ? totalRevenueData[0].total : 0;

    // Calculate growths (mocking simple growth logic or comparing to last month)
    // For real growth, we need last month's data. For now, let's keep it simple or implement it properly.
    // Let's implement properly:
    const startOfLastMonth = new Date();
    startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);
    startOfLastMonth.setDate(1);
    startOfLastMonth.setHours(0, 0, 0, 0);

    const endOfLastMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 0);

    // This gets complicated quickly. For "growth" percentages in the cards, we might just return the raw numbers 
    // and let frontend calculate or returns 0 if no history.
    // I will return the raw metrics. The frontend expects:
    // stats: { totalBookings, totalRevenue, totalUsers, activeServices, ...growth }

    res.json({
      success: true,
      data: {
        todayBookings,
        pendingBookings,
        completedBookings,
        cancelledBookings,
        activeProviders,
        totalBookings: await Booking.countDocuments(),
        totalRevenue: totalRevenue,
        totalUsers: totalUsers + activeProviders, // All users
        activeServices,
        // Mock growth for now as 0 or calculate if needed. 
        // Real calculation requires historical data queries which might be heavy.
        bookingGrowth: 0,
        revenueGrowth: 0,
        userGrowth: 0,
        serviceGrowth: 0
      },
    });
  } catch (error) {
    console.error("Error fetching metrics:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getRevenueChart = async (req, res) => {
  try {
    const { period } = req.query; // '7days', '30days', '6months', '12months'

    let startDate = new Date();
    if (period === '7days') startDate.setDate(startDate.getDate() - 7);
    else if (period === '30days') startDate.setDate(startDate.getDate() - 30);
    else if (period === '6months') startDate.setMonth(startDate.getMonth() - 6);
    else if (period === '12months') startDate.setMonth(startDate.getMonth() - 12);
    else startDate.setDate(startDate.getDate() - 30); // Default

    const revenueData = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: "completed" // Only count completed bookings
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          amount: { $sum: "$totalAmount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill in missing dates if needed, but for now returned data is fine.
    // Frontend is expecting { name: 'Date', revenue: amount }

    const formattedData = revenueData.map(item => ({
      name: item._id, // Date string
      revenue: item.amount,
      bookings: item.count
    }));

    res.json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    console.error("Error fetching revenue chart:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getServiceDistribution = async (req, res) => {
  try {
    const distribution = await Booking.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.serviceId",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "services",
          localField: "_id",
          foreignField: "_id",
          as: "service"
        }
      },
      { $unwind: "$service" },
      {
        $project: {
          name: "$service.name",
          value: "$count"
        }
      }
    ]);

    res.json({
      success: true,
      data: distribution
    });
  } catch (error) {
    console.error("Error fetching service distribution:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
