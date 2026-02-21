var axios = require("axios");

async function verify() {
    const BASE_URL = "http://localhost:3000/api/v1";
    let token = "";

    try {
        // 1. Login
        console.log("Logging in...");
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            email: "admin@dailydot.com",
            password: "Admin123"
        });
        token = loginRes.data.token;
        console.log("Login successful.");

        // 2. Create Category with Tags
        console.log("Creating Category...");
        const categoryData = new FormData();
        categoryData.append("name", "Test Tag Category " + Date.now());
        categoryData.append("description", "Test Description");
        categoryData.append("status", "Active");
        const tags = [{ name: "Tag1", icon: "hammer" }, { name: "Tag2", icon: "build" }];
        // Simulate what frontend sends (stringified JSON)
        // Actually backend expects `tags` field to be stringified JSON or handled by multer if sent as fields?
        // In my code: if (req.body.tags && typeof req.body.tags === 'string') ...
        // If I use axios with JSON body (not multer), req.body.tags will be an array/object directly if I send it as such.
        // The route `router.post("/", [auth, adminAuth, upload.single("image")], ...)` uses multer.
        // So request MUST be multipart/form-data.

        // Check if I can use 'form-data' package or just use axios with simple JSON if I don't send image?
        // Middleware `upload.single("image")` might process multipart. If I send JSON, it might skip multer processing for body?
        // Creating a FormData in Node requires 'form-data' package.
        // Let's check if 'form-data' is in package.json. If not, I'll allow JSON request if the backend supports it.
        // Backend: `app.use(express.json()); app.use(express.urlencoded({ extended: true }));`
        // Route: `upload.single("image")`
        // If I send JSON, `req.body` is populated. `req.file` is undefined.
        // My code: 
        // `if (req.body.tags && typeof req.body.tags === 'string') { req.body.tags = JSON.parse(req.body.tags); }`
        // If I send JSON `{ tags: [...] }`, `req.body.tags` is ALREADY an array (express.json() parses it).
        // So the code `typeof req.body.tags === 'string'` will be false, and it will use `req.body.tags` as is.
        // THIS IS GOOD. It handles both.

        const createCatRes = await axios.post(`${BASE_URL}/categories`, {
            name: "Test Tag Category " + Date.now(),
            slug: "test-tag-category-" + Date.now(),
            description: "Test Desc",
            status: "Active",
            tags: tags // Send as array directly
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const category = createCatRes.data.category;
        console.log("Category Created:", category._id);
        console.log("Tags:", category.tags);

        if (!category.tags || category.tags.length === 0) {
            throw new Error("Tags not saved!");
        }

        const tagId = category.tags[0]._id;

        // 3. Create Service with Tag
        console.log("Creating Service...");
        const createServiceRes = await axios.post(`${BASE_URL}/services`, {
            name: "Test Tag Service",
            category: category._id,
            description: "Test Service Desc",
            price: 100,
            duration: 60,
            isActive: true,
            tagId: tagId
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const service = createServiceRes.data.service;
        console.log("Service Created:", service._id);
        console.log("Service TagId:", service.tagId);

        // 4. Verify Grouping (Original)
        console.log("Verifying Grouping (Service Details)...");
        const getDetailsRes = await axios.get(`${BASE_URL}/services/${service._id}`);
        const groupedServices = getDetailsRes.data.groupedServices;
        console.log("Grouped Services Keys:", Object.keys(groupedServices));

        if (groupedServices[tagId]) {
            console.log("SUCCESS: Tag group found!");
            console.log("Services in group:", groupedServices[tagId].services.length);
            if (groupedServices[tagId].services.length > 0) {
                console.log("VERIFICATION PASSED");
            } else {
                console.error("VERIFICATION FAILED: Service not found in tag group.");
            }
        } else {
            console.error("VERIFICATION FAILED: Tag group not found in response.");
        }

        // 5. Verify Grouping (New Param)
        console.log("Verifying Grouping (Category List Query)...");
        const getGroupedListRes = await axios.get(`${BASE_URL}/services`, {
            params: { category: category._id, groupBy: 'tags' }
        });

        // Log structure
        if (getGroupedListRes.data.isGrouped) {
            console.log("SUCCESS: Response is grouped.");
            const servicesList = getGroupedListRes.data.services;
            console.log("Grouped List Length:", servicesList.length);
            if (servicesList.length > 0 && servicesList[0].data) {
                console.log("Group Title:", servicesList[0].title);
                console.log("Group ID:", servicesList[0].id);
                console.log("Group Data Count:", servicesList[0].data.length);
                if (servicesList[0].id) {
                    console.log("VERIFICATION PASSED");
                } else {
                    console.error("VERIFICATION FAILED: Group ID missing.");
                }
            } else {
                console.error("VERIFICATION FAILED: Invalid grouped structure.");
            }
        } else {
            console.error("VERIFICATION FAILED: isGrouped flag missing.");
        }

    } catch (error) {
        console.error("Verification Failed:", error.response ? error.response.data : error.message);
    }
}

verify();
