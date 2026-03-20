const express = require("express");
const { body, validationResult } = require("express-validator");
const Category = require("../models/Category");
const { auth, adminAuth } = require("../middleware/auth");
const upload = require("../middleware/upload");
const cloudinary = require("../config/cloudinary");
const fs = require("fs");

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
      count: (categories || []).length,
      categories: categories ?? [],
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

      const { name, slug, description, sortOrder, isActive, showOnHome } = req.body;

      // Check if category exists
      let category = await Category.findOne({ slug });
      if (category) {
        return res.status(400).json({
          success: false,
          message: "Category already exists",
        });
      }

      // Handle Image Upload
      let imageUrl = req.body.image || "";
      if (req.files && req.files.image && req.files.image[0]) {
        try {
          const result = await cloudinary.uploader.upload(req.files.image[0].path, {
            folder: "categories",
          });
          imageUrl = result.secure_url;
          // Delete local file after upload
          fs.unlinkSync(req.files.image[0].path);
        } catch (uploadError) {
          console.error("Cloudinary upload error (image):", uploadError);
          // Fallback to local path if Cloudinary fails, or handle error
        }
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
        tags = await Promise.all(tags.map(async (tag) => {
          if (tag.icon && tag.icon.startsWith("TAG_FILE_INDEX_")) {
            const indexIndex = parseInt(tag.icon.replace("TAG_FILE_INDEX_", ""), 10);
            if (!isNaN(indexIndex) && tagIcons[indexIndex]) {
              try {
                const result = await cloudinary.uploader.upload(tagIcons[indexIndex].path, {
                  folder: "category_tags",
                });
                // Delete local file
                fs.unlinkSync(tagIcons[indexIndex].path);
                return { ...tag, icon: result.secure_url };
              } catch (tagIconError) {
                console.error("Cloudinary upload error (tagIcon):", tagIconError);
              }
            }
          }
          return tag;
        }));
      }

      category = await Category.create({
        name,
        slug,
        description,
        image: imageUrl,
        imageUrl: imageUrl, // Ensure both are set
        isActive: isActive === "true" || isActive === true,
        showOnHome: showOnHome === "false" ? false : true,
        tags: tags,
      });

      res.status(201).json({
        success: true,
        message: "Category created successfully",
        category,
      });
    } catch (error) {
      console.error("Create category error:", error);
      
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        return res.status(400).json({
          success: false,
          message: `A category with this ${field} already exists. Please choose a different name.`
        });
      }

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

      // Cast boolean strings from FormData
      if (fieldsToUpdate.isActive !== undefined) {
        fieldsToUpdate.isActive = fieldsToUpdate.isActive === "true" || fieldsToUpdate.isActive === true;
      }
      if (fieldsToUpdate.showOnHome !== undefined) {
        fieldsToUpdate.showOnHome = fieldsToUpdate.showOnHome === "true" || fieldsToUpdate.showOnHome === true;
      }

      // Handle Image Upload
      if (req.files && req.files.image && req.files.image[0]) {
        try {
          const result = await cloudinary.uploader.upload(req.files.image[0].path, {
            folder: "categories",
          });
          fieldsToUpdate.image = result.secure_url;
          fieldsToUpdate.imageUrl = result.secure_url; // Ensure both are updated
          // Delete local file
          fs.unlinkSync(req.files.image[0].path);
        } catch (uploadError) {
          console.error("Cloudinary upload error (update image):", uploadError);
        }
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
        fieldsToUpdate.tags = await Promise.all(fieldsToUpdate.tags.map(async (tag) => {
          if (tag.icon && tag.icon.startsWith("TAG_FILE_INDEX_")) {
            const indexIndex = parseInt(tag.icon.replace("TAG_FILE_INDEX_", ""), 10);
            if (!isNaN(indexIndex) && tagIcons[indexIndex]) {
              try {
                const result = await cloudinary.uploader.upload(tagIcons[indexIndex].path, {
                  folder: "category_tags",
                });
                // Delete local file
                fs.unlinkSync(tagIcons[indexIndex].path);
                return { ...tag, icon: result.secure_url };
              } catch (tagIconError) {
                console.error("Cloudinary upload error (update tagIcon):", tagIconError);
              }
            }
          }
          return tag;
        }));
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

      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        return res.status(400).json({
          success: false,
          message: `A category with this ${field} already exists. Please choose a different name.`
        });
      }

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
