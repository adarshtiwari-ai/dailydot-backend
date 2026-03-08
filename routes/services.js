const express = require("express");
const { body, validationResult } = require("express-validator");
const Service = require("../models/Service");
const { auth, adminAuth } = require("../middleware/auth");
const upload = require("../middleware/upload");
const cloudinary = require("../config/cloudinary");
const fs = require("fs");

const router = express.Router();

/**
 * @swagger
 * /api/v1/services:
 *   get:
 *     summary: Get all services
 *     tags: [Services]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in name and description
 *     responses:
 *       200:
 *         description: List of services
 *       500:
 *         description: Server error
 */
router.get("/", async (req, res) => {
  try {
    const { category, minPrice, maxPrice, search, isTopBooked, section, groupBy } = req.query;

    let query = { isActive: true };

    if (category) query.category = category;
    if (minPrice) query.price = { ...query.price, $gte: Number(minPrice) };
    if (maxPrice) query.price = { ...query.price, $lte: Number(maxPrice) };
    if (isTopBooked === 'true') {
      query.isTopBooked = true;
    }
    if (req.query.isTrending === 'true') {
      query.isTrending = true;
    }
    if (section) {
      query.section = section;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const services = await Service.find(query)
      .populate("category", "name slug tags") // Ensure tags are populated for grouping logic if needed
      .sort({ createdAt: -1 });

    // Handle Grouping
    if (groupBy === 'tags' && category) {
      // Fetch the category to get the canonical tag list
      const Category = require("../models/Category");
      const categoryDoc = await Category.findById(category);

      if (!categoryDoc) {
        return res.json({ success: true, count: 0, services: [] });
      }

      const grouped = {};
      // Initialize groups based on category tags
      if (categoryDoc.tags && categoryDoc.tags.length > 0) {
        categoryDoc.tags.forEach(tag => {
          grouped[tag._id.toString()] = {
            id: tag._id,
            title: tag.name,
            icon: tag.icon,
            data: []
          };
        });
      }
      // Add 'Other' group
      grouped['other'] = { id: 'other', title: "Other Services", icon: "grid-outline", data: [] };

      services.forEach(service => {
        const tagId = service.tagId ? service.tagId.toString() : 'other';
        if (grouped[tagId]) {
          grouped[tagId].data.push(service);
        } else {
          grouped['other'].data.push(service);
        }
      });

      // Convert to array
      const result = [];
      if (categoryDoc.tags) {
        categoryDoc.tags.forEach(tag => {
          if (grouped[tag._id.toString()].data.length > 0) {
            result.push(grouped[tag._id.toString()]);
          }
        });
      }
      if (grouped['other'].data.length > 0) {
        result.push(grouped['other']);
      }

      return res.json({
        success: true,
        count: services.length,
        services: result, // Return formatted structure
        isGrouped: true
      });
    }

    console.log("📡 ADMIN FETCH SENDING", (services || []).length, "ITEMS.");
    res.json({
      success: true,
      count: (services || []).length,
      services: services ?? [],
    });
  } catch (error) {
    console.error("Get services error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch services",
    });
  }
});

/**
 * @swagger
 * /api/v1/services/{id}:
 *   get:
 *     summary: Get single service
 *     tags: [Services]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Service ID
 *     responses:
 *       200:
 *         description: Service details
 *       404:
 *         description: Service not found
 */
router.get("/:id", async (req, res) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate("category", "name slug tags");

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    // Fetch all active services in the same category
    const relatedServices = await Service.find({
      category: service.category._id,
      isActive: true
    }).select('name price duration description images isTopBooked tagId');

    // Group services by tag
    // Structure: { [tagId]: { tagName, services: [] }, "uncategorized": [...] }
    const groupedServices = {
      uncategorized: []
    };

    // Initialize groups from category tags
    if (service.category.tags && service.category.tags.length > 0) {
      service.category.tags.forEach(tag => {
        groupedServices[tag._id] = {
          tagId: tag._id,
          tagName: tag.name,
          tagIcon: tag.icon,
          services: []
        };
      });
    }

    relatedServices.forEach(s => {
      // Don't include the current service in the list if you strictly want "other" services, 
      // but usually for a "Service Details" screen that allows switching, you might want all.
      // The user requirement implies "returns all services from the same category".

      if (s.tagId && groupedServices[s.tagId]) {
        groupedServices[s.tagId].services.push(s);
      } else {
        groupedServices.uncategorized.push(s);
      }
    });

    res.json({
      success: true,
      service,
      groupedServices
    });
  } catch (error) {
    console.error("Get service details error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch service",
    });
  }
});

/**
 * @swagger
 * /api/v1/services:
 *   post:
 *     summary: Create service (Admin only)
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category
 *               - description
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *                 example: Deep Cleaning
 *               category:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *               description:
 *                 type: string
 *                 example: Complete deep cleaning service
 *               price:
 *                 type: number
 *                 example: 2999
 *               duration:
 *                 type: number
 *                 example: 180
 *               isTopBooked:
 *                 type: boolean
 *                 example: false
 *               section:
 *                 type: string
 *                 enum: [general, car_on_wheels]
 *                 default: general
 *     responses:
 *       201:
 *         description: Service created successfully
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  [auth, adminAuth, upload.array("images", 5)],
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("category").notEmpty().withMessage("Category is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("price").isNumeric().withMessage("Valid price is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      // Handle image upload
      if (req.files && req.files.length > 0) {
        try {
          const uploadedUrls = await Promise.all(
            req.files.map(async (file) => {
              const result = await cloudinary.uploader.upload(file.path, {
                folder: "services",
              });
              fs.unlinkSync(file.path);
              return result.secure_url;
            })
          );
          req.body.images = uploadedUrls;
          if (uploadedUrls.length > 0) {
            req.body.imageUrl = uploadedUrls[0]; // Set first image as primary imageUrl
          }
        } catch (uploadError) {
          console.error("Cloudinary upload error (services):", uploadError);
        }
      }

      const service = await Service.create(req.body);
      console.log("💾 DB SAVE SUCCESS:", JSON.stringify(service, null, 2));

      res.status(201).json({
        success: true,
        message: "Service created successfully",
        service,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to create service",
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/services/{id}:
 *   put:
 *     summary: Update service (Admin only)
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Service updated successfully
 *       404:
 *         description: Service not found
 */
router.put("/:id", [auth, adminAuth, upload.array("images", 5)], async (req, res) => {
  try {
    // Handle image upload
    if (req.files && req.files.length > 0) {
      try {
        const uploadedUrls = await Promise.all(
          req.files.map(async (file) => {
            const result = await cloudinary.uploader.upload(file.path, {
              folder: "services",
            });
            fs.unlinkSync(file.path);
            return result.secure_url;
          })
        );
        req.body.images = uploadedUrls;
        if (uploadedUrls.length > 0) {
          req.body.imageUrl = uploadedUrls[0];
        }
      } catch (uploadError) {
        console.error("Cloudinary upload error (update services):", uploadError);
      }
    }

    const service = await Service.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    res.json({
      success: true,
      message: "Service updated successfully",
      service,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update service",
    });
  }
});

/**
 * @swagger
 * /api/v1/services/{id}:
 *   delete:
 *     summary: Delete service (Admin only)
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service deleted successfully
 *       404:
 *         description: Service not found
 */
router.delete("/:id", [auth, adminAuth], async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    res.json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete service",
    });
  }
});

/**
 * @swagger
 * /api/v1/services/{id}:
 *   patch:
 *     summary: Partially update service (Admin only)
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Service updated successfully
 */
router.patch("/:id", [auth, adminAuth], async (req, res) => {
  try {
    const service = await Service.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    res.json({
      success: true,
      message: "Service updated successfully",
      service,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update service",
    });
  }
});

module.exports = router;
