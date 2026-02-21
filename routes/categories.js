const express = require("express");
const { body, validationResult } = require("express-validator");
const Category = require("../models/Category");
const { auth, adminAuth } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

/**
 * @swagger
 * /api/v1/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: List of all active categories
 *       500:
 *         description: Server error
 */
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({
      sortOrder: 1,
      name: 1,
    });

    res.json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
    });
  }
});

/**
 * @swagger
 * /api/v1/categories/{id}:
 *   get:
 *     summary: Get single category by ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category details
 *       404:
 *         description: Category not found
 */
router.get("/:id", async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch category",
    });
  }
});

/**
 * @swagger
 * /api/v1/categories:
 *   post:
 *     summary: Create a new category (Admin only)
 *     tags: [Categories]
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
 *               - slug
 *             properties:
 *               name:
 *                 type: string
 *                 example: Cleaning
 *               slug:
 *                 type: string
 *                 example: cleaning
 *               description:
 *                 type: string
 *                 example: Professional cleaning services
 *     responses:
 *       201:
 *         description: Category created successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin access required
 */
router.post(
  "/",
  [
    auth,
    adminAuth,
    upload.fields([
      { name: "image", maxCount: 1 },
      { name: "tagIcons", maxCount: 10 },
    ]),
  ],
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("slug").notEmpty().withMessage("Slug is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      console.log("Create Category Request Body:", req.body);
      if (req.files) {
        console.log("Files received:", Object.keys(req.files));
      }

      const { name, slug, description, sortOrder, isActive } = req.body;

      // Check if category exists
      let category = await Category.findOne({ slug });
      if (category) {
        return res.status(400).json({
          success: false,
          message: "Category already exists",
        });
      }

      // Handle Image Upload
      let imageUrl = "";
      if (req.files && req.files.image && req.files.image[0]) {
        // Replace backslashes with forward slashes for URL compatibility
        imageUrl = `/uploads/${req.files.image[0].filename.replace(/\\/g, "/")}`;
      }

      // Handle tags (if sent as stringified JSON from FormData)
      let tags = [];
      if (req.body.tags) {
        if (typeof req.body.tags === 'string') {
          try {
            tags = JSON.parse(req.body.tags);
          } catch (e) {
            console.error("Error parsing tags:", e);
          }
        } else if (Array.isArray(req.body.tags)) {
          tags = req.body.tags;
        }
      }

      // Process Tag Icons
      if (req.files && req.files.tagIcons) {
        const tagIcons = req.files.tagIcons;

        // Map uploaded files to tags
        tags = tags.map(tag => {
          if (tag.icon && tag.icon.startsWith("TAG_FILE_INDEX_")) {
            const indexIndex = parseInt(tag.icon.replace("TAG_FILE_INDEX_", ""), 10);
            if (!isNaN(indexIndex) && tagIcons[indexIndex]) {
              // Replace backslashes with forward slashes for URL compatibility
              return { ...tag, icon: `/uploads/${tagIcons[indexIndex].filename.replace(/\\/g, "/")}` };
            }
          }
          return tag;
        });
      }

      category = await Category.create({
        name,
        slug,
        description,
        image: imageUrl,
        sortOrder: sortOrder || 0,
        isActive: isActive === "true" || isActive === true,
        tags: tags,
      });

      res.status(201).json({
        success: true,
        message: "Category created successfully",
        category,
      });
    } catch (error) {
      console.error("Create category error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create category",
      });
    }
  }
);

/**
 * @swagger
 * /api/v1/categories/{id}:
 *   put:
 *     summary: Update category (Admin only)
 *     tags: [Categories]
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
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       404:
 *         description: Category not found
 */
router.put("/:id",
  [
    auth,
    adminAuth,
    upload.fields([
      { name: "image", maxCount: 1 },
      { name: "tagIcons", maxCount: 10 },
    ])
  ],
  async (req, res) => {
    try {
      let category = await Category.findById(req.params.id);

      if (!category) {
        return res.status(404).json({
          success: false,
          message: "Category not found",
        });
      }

      console.log("Update Category Request Body:", req.body);

      const fieldsToUpdate = { ...req.body };

      // Handle Image Upload
      if (req.files && req.files.image && req.files.image[0]) {
        fieldsToUpdate.image = `/uploads/${req.files.image[0].filename.replace(/\\/g, "/")}`;
      }

      // Handle tags parsing
      if (fieldsToUpdate.tags) {
        if (typeof fieldsToUpdate.tags === 'string') {
          try {
            fieldsToUpdate.tags = JSON.parse(fieldsToUpdate.tags);
          } catch (e) {
            console.error("Error parsing tags:", e);
          }
        }
      }

      // Process Tag Icons
      if (req.files && req.files.tagIcons && Array.isArray(fieldsToUpdate.tags)) {
        const tagIcons = req.files.tagIcons;

        // Map uploaded files to tags
        fieldsToUpdate.tags = fieldsToUpdate.tags.map(tag => {
          if (tag.icon && tag.icon.startsWith("TAG_FILE_INDEX_")) {
            const indexIndex = parseInt(tag.icon.replace("TAG_FILE_INDEX_", ""), 10);
            if (!isNaN(indexIndex) && tagIcons[indexIndex]) {
              return { ...tag, icon: `/uploads/${tagIcons[indexIndex].filename.replace(/\\/g, "/")}` };
            }
          }
          return tag;
        });
      }

      category = await Category.findByIdAndUpdate(req.params.id, fieldsToUpdate, {
        new: true,
        runValidators: true,
      });

      res.json({
        success: true,
        message: "Category updated successfully",
        category,
      });
    } catch (error) {
      console.error("Update category error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update category",
      });
    }
  });

/**
 * @swagger
 * /api/v1/categories/{id}:
 *   delete:
 *     summary: Delete category (Admin only)
 *     tags: [Categories]
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
 *         description: Category deleted successfully
 *       404:
 *         description: Category not found
 */
router.delete("/:id", [auth, adminAuth], async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete category",
      error: error.message
    });
  }
});

module.exports = router;
