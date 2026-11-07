const PORT = process.env.PORT || 3000;

module.exports = {
  openapi: "3.0.0",
  info: {
    title: "Mini Ecommerce Admin API",
    version: "1.0.0",
    description: "API documentation for testing the admin service",
  },
  servers: [
    { url: "/", description: "Current Server (Auto)" },
    { url: `http://localhost:${PORT}`, description: "Localhost" },
  ],
  paths: {
    "/testing": {
      get: {
        tags: ["Health"],
        summary: "Test that the server is running",
        responses: {
          200: { description: "Server is running" },
        },
      },
    },
    // ================= CATEGORY =================
    "/category": {
      get: {
        tags: ["Category"],
        summary: "List categories (public)",
        responses: {
          200: {
            description: "List of categories",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Get categories successfully" },
                    data: { type: "array", items: { $ref: "#/components/schemas/Category" } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Category"],
        summary: "Create category (admin token required)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CategoryInput" } } },
        },
        responses: {
          201: { description: "Category created" },
          400: { description: "name and slug are required" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          409: { description: "Slug already used" },
        },
      },
    },
    "/category/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
      get: {
        tags: ["Category"],
        summary: "Get one category with its products (public)",
        responses: {
          200: {
            description: "Category",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Get category successfully" },
                    data: { $ref: "#/components/schemas/CategoryDetail" },
                  },
                },
              },
            },
          },
          404: { description: "Category not found" },
        },
      },
      put: {
        tags: ["Category"],
        summary: "Update category (admin token required, send only fields to change)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CategoryInput" } } },
        },
        responses: {
          200: { description: "Category updated" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          404: { description: "Category not found" },
          409: { description: "Slug already used" },
        },
      },
      delete: {
        tags: ["Category"],
        summary: "Delete category (admin token required; its products become uncategorized)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Category deleted" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          404: { description: "Category not found" },
        },
      },
    },

    // ================= PRODUCT =================
    "/product": {
      get: {
        tags: ["Product"],
        summary: "List products with their category (public)",
        parameters: [
          { name: "categoryId", in: "query", required: false, schema: { type: "integer" }, description: "Filter by category" },
          { name: "q", in: "query", required: false, schema: { type: "string" }, description: "Search by product name" },
          { $ref: "#/components/parameters/Page" },
          { $ref: "#/components/parameters/Limit" },
        ],
        responses: {
          200: {
            description: "List of products",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Get products successfully" },
                    data: { type: "array", items: { $ref: "#/components/schemas/Product" } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Product"],
        summary: "Create product (admin token required)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ProductInput" } } },
        },
        responses: {
          201: { description: "Product created" },
          400: { description: "name and slug are required / invalid base_price / Category not found" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          409: { description: "Slug already used" },
        },
      },
    },
    "/product/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
      get: {
        tags: ["Product"],
        summary: "Get one product with its category (public)",
        responses: {
          200: {
            description: "Product",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Get product successfully" },
                    data: { $ref: "#/components/schemas/Product" },
                  },
                },
              },
            },
          },
          404: { description: "Product not found" },
        },
      },
      put: {
        tags: ["Product"],
        summary: "Update product (admin token required, send only fields to change)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ProductInput" } } },
        },
        responses: {
          200: { description: "Product updated" },
          400: { description: "Invalid base_price / Category not found" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          404: { description: "Product not found" },
          409: { description: "Slug already used" },
        },
      },
      delete: {
        tags: ["Product"],
        summary: "Delete product (admin token required)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Product deleted" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          404: { description: "Product not found" },
        },
      },
    },
    // ================= PRODUCT IMAGE =================
    "/product/{productId}/images": {
      parameters: [{ name: "productId", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
      get: {
        tags: ["Product Image"],
        summary: "List images of a product (public)",
        responses: {
          200: {
            description: "Product with its images",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Product images" },
                    data: { $ref: "#/components/schemas/ProductWithImages" },
                  },
                },
              },
            },
          },
          404: { description: "Product not found" },
        },
      },
      post: {
        tags: ["Product Image"],
        summary: "Add image to product (admin token required; first image becomes primary)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "multipart/form-data": { schema: { $ref: "#/components/schemas/ProductImageUpload" } } },
        },
        responses: {
          201: { description: "Image created" },
          400: { description: "image file is required / not an image / larger than 5MB" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          404: { description: "Product not found" },
        },
      },
    },
    "/product/{productId}/images/{id}": {
      parameters: [
        { name: "productId", in: "path", required: true, schema: { type: "integer" }, example: 1 },
        { name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 },
      ],
      get: {
        tags: ["Product Image"],
        summary: "Get one image with its product (public)",
        responses: {
          200: {
            description: "Product image",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Product image" },
                    data: { $ref: "#/components/schemas/ProductImageDetail" },
                  },
                },
              },
            },
          },
          404: { description: "Image not found" },
        },
      },
      put: {
        tags: ["Product Image"],
        summary: "Update image or reassign productId (admin token required; is_primary=true unsets others)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: false,
          content: { "multipart/form-data": { schema: { $ref: "#/components/schemas/ProductImageUploadOptional" } } },
        },
        responses: {
          200: { description: "Image updated (old file removed if replaced)" },
          400: { description: "not an image / larger than 5MB" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          404: { description: "Image not found" },
        },
      },
      delete: {
        tags: ["Product Image"],
        summary: "Delete image (admin token required; next image promoted if primary removed)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Image deleted" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          404: { description: "Image not found" },
        },
      },
    },
    // ================= PRODUCT VARIANT =================
    "/product/{productId}/variants": {
      parameters: [{ name: "productId", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
      get: {
        tags: ["Product Variant"],
        summary: "List variants of a product (public)",
        responses: {
          200: {
            description: "Product with its variants",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Product variants" },
                    data: { $ref: "#/components/schemas/ProductWithVariants" },
                  },
                },
              },
            },
          },
          404: { description: "Product not found" },
        },
      },
      post: {
        tags: ["Product Variant"],
        summary: "Create variant (admin token required)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ProductVariantInput" } } },
        },
        responses: {
          201: { description: "Variant created" },
          400: { description: "sku is required / invalid price / invalid stock_qty" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          404: { description: "Product not found" },
          409: { description: "SKU already used, or same color + size already exists" },
        },
      },
    },
    "/product/{productId}/variants/{id}": {
      parameters: [
        { name: "productId", in: "path", required: true, schema: { type: "integer" }, example: 1 },
        { name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 },
      ],
      get: {
        tags: ["Product Variant"],
        summary: "Get one variant with its product (public)",
        responses: {
          200: {
            description: "Product variant",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Product variant" },
                    data: { $ref: "#/components/schemas/ProductVariantDetail" },
                  },
                },
              },
            },
          },
          404: { description: "Variant not found" },
        },
      },
      put: {
        tags: ["Product Variant"],
        summary: "Update variant (admin token required, send only fields to change)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ProductVariantInput" },
              example: { stock_qty: 25, price: 1049.99 },
            },
          },
        },
        responses: {
          200: { description: "Variant updated" },
          400: { description: "Invalid price / stock_qty / is_active" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          404: { description: "Variant not found" },
          409: { description: "SKU already used, or same color + size already exists" },
        },
      },
      delete: {
        tags: ["Product Variant"],
        summary: "Delete variant (admin token required)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Variant deleted" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          404: { description: "Variant not found" },
        },
      },
    },
    // ================= CART =================
    "/cart": {
      get: {
        tags: ["Cart"],
        summary: "Get my cart (any logged-in token; cart auto-created)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { $ref: "#/components/responses/CartResponse" },
          401: { description: "Missing or invalid token" },
        },
      },
      delete: {
        tags: ["Cart"],
        summary: "Clear my cart (removes all items)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { $ref: "#/components/responses/CartResponse" },
          401: { description: "Missing or invalid token" },
        },
      },
    },
    "/cart/items": {
      post: {
        tags: ["Cart"],
        summary: "Add variant to my cart (quantity is added if already in cart)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CartItemInput" } } },
        },
        responses: {
          201: { $ref: "#/components/responses/CartResponse" },
          400: { description: "variantId is required / invalid quantity / Only N left in stock" },
          401: { description: "Missing or invalid token" },
          404: { description: "Variant not found (or inactive)" },
        },
      },
    },
    "/cart/items/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1, description: "CartItem id (not variant id)" }],
      put: {
        tags: ["Cart"],
        summary: "Set quantity of a cart item",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CartItemQuantityInput" } } },
        },
        responses: {
          200: { $ref: "#/components/responses/CartResponse" },
          400: { description: "invalid quantity / Only N left in stock" },
          401: { description: "Missing or invalid token" },
          404: { description: "Cart item not found / Variant not found" },
        },
      },
      delete: {
        tags: ["Cart"],
        summary: "Remove an item from my cart",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { $ref: "#/components/responses/CartResponse" },
          401: { description: "Missing or invalid token" },
          404: { description: "Cart item not found" },
        },
      },
    },
    // ================= REVIEW =================
    "/product/{productId}/reviews": {
      parameters: [{ name: "productId", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
      get: {
        tags: ["Review"],
        summary: "List reviews of a product with average rating (public)",
        responses: {
          200: {
            description: "Reviews + summary",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Product reviews" },
                    data: { $ref: "#/components/schemas/ProductReviews" },
                  },
                },
              },
            },
          },
          404: { description: "Product not found" },
        },
      },
      post: {
        tags: ["Review"],
        summary: "Write a review (any logged-in token; one per user per product)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ReviewInput" } } },
        },
        responses: {
          201: { description: "Review created" },
          400: { description: "rating must be an integer from 1 to 5 / invalid comment" },
          401: { description: "Missing or invalid token" },
          404: { description: "Product not found" },
          409: { description: "You already reviewed this product, use PUT to update" },
        },
      },
    },
    "/product/{productId}/reviews/{id}": {
      parameters: [
        { name: "productId", in: "path", required: true, schema: { type: "integer" }, example: 1 },
        { name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 },
      ],
      get: {
        tags: ["Review"],
        summary: "Get one review (public)",
        responses: {
          200: {
            description: "Review",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Review" },
                    data: { $ref: "#/components/schemas/Review" },
                  },
                },
              },
            },
          },
          404: { description: "Review not found" },
        },
      },
      put: {
        tags: ["Review"],
        summary: "Update my review (owner only, send only fields to change)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ReviewInput" },
              example: { rating: 4 },
            },
          },
        },
        responses: {
          200: { description: "Review updated" },
          400: { description: "Invalid rating / comment" },
          401: { description: "Missing or invalid token" },
          403: { description: "You can only edit your own review" },
          404: { description: "Review not found" },
        },
      },
      delete: {
        tags: ["Review"],
        summary: "Delete review (owner or admin)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Review deleted" },
          401: { description: "Missing or invalid token" },
          403: { description: "You can only delete your own review" },
          404: { description: "Review not found" },
        },
      },
    },
    // ================= ADDRESS =================
    "/address": {
      get: {
        tags: ["Address"],
        summary: "List my addresses (default first)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "My addresses",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Addresses" },
                    data: { type: "array", items: { $ref: "#/components/schemas/Address" } },
                  },
                },
              },
            },
          },
          401: { description: "Missing or invalid token" },
        },
      },
      post: {
        tags: ["Address"],
        summary: "Create address (first address becomes default automatically)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AddressInput" } } },
        },
        responses: {
          201: { description: "Address created" },
          400: { description: "Missing field / invalid phone / invalid status" },
          401: { description: "Missing or invalid token" },
        },
      },
    },
    "/address/default": {
      get: {
        tags: ["Address"],
        summary: "Get my default address",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Default address" },
          401: { description: "Missing or invalid token" },
          404: { description: "No default address" },
        },
      },
    },
    "/address/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
      get: {
        tags: ["Address"],
        summary: "Get one of my addresses",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Address" },
          401: { description: "Missing or invalid token" },
          404: { description: "Address not found" },
        },
      },
      put: {
        tags: ["Address"],
        summary: "Update my address (send only fields to change; status=true makes it default)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AddressInput" },
              example: { street: "Street 271, Sangkat Toul Tompoung" },
            },
          },
        },
        responses: {
          200: { description: "Address updated" },
          400: { description: "Empty field / invalid phone / invalid status" },
          401: { description: "Missing or invalid token" },
          404: { description: "Address not found" },
        },
      },
      delete: {
        tags: ["Address"],
        summary: "Delete my address (if default, newest remaining becomes default)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Address deleted" },
          401: { description: "Missing or invalid token" },
          404: { description: "Address not found" },
        },
      },
    },
    "/address/{id}/default": {
      patch: {
        tags: ["Address"],
        summary: "Set this address as my default",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
        responses: {
          200: { description: "Default address set" },
          401: { description: "Missing or invalid token" },
          404: { description: "Address not found" },
        },
      },
    },
    // ================= ORDER =================
    "/order": {
      post: {
        tags: ["Order"],
        summary: "Create order / Checkout: uses CartItems if present, or direct items / sub_total when cart is empty",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: false,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CheckoutInput" } } },
        },
        responses: {
          201: { $ref: "#/components/responses/OrderResponse" },
          400: { description: "Cart is empty / No default address / Address not found / out of stock / variant unavailable" },
          401: { description: "Missing or invalid token" },
        },
      },
      get: {
        tags: ["Order"],
        summary: "List my orders (newest first)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { $ref: "#/components/responses/OrderListResponse" },
          401: { description: "Missing or invalid token" },
        },
      },
    },
    "/order/{id}": {
      get: {
        tags: ["Order"],
        summary: "Get one of my orders",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
        responses: {
          200: { $ref: "#/components/responses/OrderResponse" },
          401: { description: "Missing or invalid token" },
          404: { description: "Order not found" },
        },
      },
    },
    "/order/{id}/cancel": {
      patch: {
        tags: ["Order"],
        summary: "Cancel my order (only while pending; stock is restored)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
        responses: {
          200: { $ref: "#/components/responses/OrderResponse" },
          400: { description: "Cannot cancel an order that is paid/shipped/..." },
          401: { description: "Missing or invalid token" },
          404: { description: "Order not found" },
        },
      },
    },
    "/order/admin": {
      get: {
        tags: ["Order (Admin)"],
        summary: "List all orders (admin token required)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "status", in: "query", required: false, schema: { type: "string", enum: ["pending", "paid", "shipped", "delivered", "cancelled"] } },
          { name: "q", in: "query", required: false, schema: { type: "string" }, description: "Search by order_number" },
          { name: "userId", in: "query", required: false, schema: { type: "integer" } },
          { name: "from", in: "query", required: false, schema: { type: "string", format: "date" } },
          { name: "to", in: "query", required: false, schema: { type: "string", format: "date" } },
          { name: "page", in: "query", required: false, schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", required: false, schema: { type: "integer", default: 10 } },
        ],
        responses: {
          200: { $ref: "#/components/responses/OrderListResponse" },
          400: { description: "Invalid status or date filter" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
        },
      },
      post: {
        tags: ["Order (Admin)"],
        summary: "Create a new order record directly with discount and shipping fee (admin)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AdminOrderCreateInput" } } },
        },
        responses: {
          201: { $ref: "#/components/responses/OrderResponse" },
          400: { description: "Invalid discount / shipping_fee / sub_total" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
        },
      },
    },
    "/order/admin/{id}": {
      get: {
        tags: ["Order (Admin)"],
        summary: "Get any order (admin token required)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
        responses: {
          200: { $ref: "#/components/responses/OrderResponse" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          404: { description: "Order not found" },
        },
      },
      put: {
        tags: ["Order (Admin)"],
        summary: "Update an order (discount, shipping_fee, sub_total, status, shipping info) and auto-recalculate total (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AdminOrderUpdateInput" } } },
        },
        responses: {
          200: { $ref: "#/components/responses/OrderResponse" },
          400: { description: "Invalid input" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          404: { description: "Order not found" },
        },
      },
      patch: {
        tags: ["Order (Admin)"],
        summary: "Partially update order discount, shipping_fee, or status (auto-recalculates total)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AdminOrderUpdateInput" } } },
        },
        responses: {
          200: { $ref: "#/components/responses/OrderResponse" },
          400: { description: "Invalid input" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          404: { description: "Order not found" },
        },
      },
      delete: {
        tags: ["Order (Admin)"],
        summary: "Delete an order and restore stock if not already cancelled (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
        responses: {
          200: { description: "Order deleted" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          404: { description: "Order not found" },
        },
      },
    },
    "/order/admin/{id}/pricing": {
      patch: {
        tags: ["Order (Admin)"],
        summary: "Update discount and shipping_fee on an order and auto-recalculate total (admin)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/OrderPricingInput" } } },
        },
        responses: {
          200: { $ref: "#/components/responses/OrderResponse" },
          400: { description: "discount / shipping_fee must be non-negative numbers" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          404: { description: "Order not found" },
        },
      },
    },
    "/order/admin/{id}/status": {
      patch: {
        tags: ["Order (Admin)"],
        summary: "Change order status (admin): pending→paid|cancelled, paid→shipped|cancelled, shipped→delivered",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/OrderStatusInput" } } },
        },
        responses: {
          200: { $ref: "#/components/responses/OrderResponse" },
          400: { description: "Invalid status / Cannot change status from X to Y" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          404: { description: "Order not found" },
        },
      },
    },
    "/order/{id}/invoice": {
      get: {
        tags: ["Order"],
        summary: "Download invoice as .docx (owner or admin; not for cancelled orders)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" }, example: 1 }],
        responses: {
          200: {
            description: "Invoice file",
            content: {
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          400: { description: "Cancelled orders have no invoice" },
          401: { description: "Missing or invalid token" },
          404: { description: "Order not found" },
          500: { description: "Invoice template not found / template error" },
        },
      },
    },
    "/order/admin/report": {
      get: {
        tags: ["Order (Admin)"],
        summary: "Order report for a date range (admin). Default: last 30 days",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "from", in: "query", required: false, schema: { type: "string", format: "date" }, example: "2026-10-01" },
          { name: "to", in: "query", required: false, schema: { type: "string", format: "date" }, example: "2026-10-31" },
        ],
        responses: {
          200: {
            description: "Report",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Order report" },
                    data: { $ref: "#/components/schemas/OrderReport" },
                  },
                },
              },
            },
          },
          400: { description: "Invalid from/to" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
        },
      },
    },
    "/order/admin/report/export": {
      get: {
        tags: ["Order (Admin)"],
        summary: "Download order report as .xlsx (Summary, Orders, Top products, Daily sheets)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "from", in: "query", required: false, schema: { type: "string", format: "date" }, example: "2026-10-01" },
          { name: "to", in: "query", required: false, schema: { type: "string", format: "date" }, example: "2026-10-31" },
        ],
        responses: {
          200: {
            description: "Excel file",
            content: {
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
                schema: { type: "string", format: "binary" },
              },
            },
          },
          400: { description: "Invalid from/to" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
        },
      },
    },
    // ================= PAYMENT =================
    "/payment/checkout": {
      post: {
        tags: ["Payment"],
        summary: "Start ABA PayWay payment for my pending order (returns form fields to POST to PayWay)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentCheckoutInput" } } },
        },
        responses: {
          201: {
            description: "Payment created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Payment created, submit fields to action_url" },
                    data: { $ref: "#/components/schemas/PaymentCheckout" },
                  },
                },
              },
            },
          },
          400: { description: "orderId is required / invalid payment_option / Order is not pending" },
          401: { description: "Missing or invalid token" },
          404: { description: "Order not found" },
          500: { description: "PayWay is not configured" },
        },
      },
    },
    "/payment/callback": {
      post: {
        tags: ["Payment"],
        summary: "PayWay pushback (public, called by PayWay server). Status is re-checked with PayWay before trusting it",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  tran_id: { type: "string", example: "12-mgq3k2x1" },
                  apv: { type: "string", example: "123456" },
                  status: { type: "string", example: "0" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "OK" },
          400: { description: "tran_id is required" },
          404: { description: "Payment not found" },
        },
      },
    },
    "/payment/verify/{tranId}": {
      get: {
        tags: ["Payment"],
        summary: "Check my payment status with PayWay and update order (use after paying)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "tranId", in: "path", required: true, schema: { type: "string" }, example: "12-mgq3k2x1" }],
        responses: {
          200: { description: "Payment status" },
          401: { description: "Missing or invalid token" },
          404: { description: "Payment not found" },
        },
      },
    },
    "/payment": {
      get: {
        tags: ["Payment"],
        summary: "List my payments",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "My payments" },
          401: { description: "Missing or invalid token" },
        },
      },
    },
    "/payment/admin": {
      get: {
        tags: ["Payment"],
        summary: "List all payments (admin token required)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "status", in: "query", required: false, schema: { type: "string", enum: ["pending", "success", "failed"] } },
        ],
        responses: {
          200: { description: "All payments" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
        },
      },
    },
    // ================= USER =================
    "/auth/user/register": {
      post: {
        tags: ["User"],
        summary: "Register a normal user (role: user)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterInput" } } },
        },
        responses: {
          201: { description: "User registered" },
          400: { description: "Email and password are required" },
          409: { description: "Email already registered" },
        },
      },
    },
    "/auth/user/login": {
      post: {
        tags: ["User"],
        summary: "User login: returns token",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/LoginInput" } } },
        },
        responses: {
          200: { $ref: "#/components/responses/LoginSuccess" },
          401: { description: "Invalid password" },
          404: { description: "Email user not found" },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["User"],
        summary: "My profile (any logged-in token: user or admin)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Decoded token payload" },
          401: { description: "Missing or invalid token" },
        },
      },
    },

    // ================= PROFILE =================
    "/auth/profile": {
      get: {
        tags: ["Profile"],
        summary: "Get my account + profile (any logged-in token)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "User with profile (profile is null if not created yet)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string", example: "Profile" },
                    data: { $ref: "#/components/schemas/UserWithProfile" },
                  },
                },
              },
            },
          },
          401: { description: "Missing or invalid token" },
          404: { description: "User not found" },
        },
      },
      post: {
        tags: ["Profile"],
        summary: "Create my profile (only once; all fields optional)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ProfileInput" } } },
        },
        responses: {
          201: { description: "Profile created" },
          400: { description: "Invalid phone or date_of_birth" },
          401: { description: "Missing or invalid token" },
          409: { description: "Profile already exists, use PUT to update" },
        },
      },
      put: {
        tags: ["Profile"],
        summary: "Update my existing profile (send only fields to change)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/ProfileInput" } } },
        },
        responses: {
          200: { description: "Profile updated" },
          400: { description: "Invalid phone or date_of_birth" },
          401: { description: "Missing or invalid token" },
          404: { description: "Profile not found, use POST to create" },
        },
      },
    },
    "/auth/profile/{userId}": {
      get: {
        tags: ["Profile"],
        summary: "Get any user's profile (admin token required)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "userId", in: "path", required: true, schema: { type: "integer" }, example: 5 },
        ],
        responses: {
          200: { description: "User with profile" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          404: { description: "User not found" },
        },
      },
    },

    // ================= ADMIN =================
    "/auth/admin/login": {
      post: {
        tags: ["Admin"],
        summary: "Admin login: only accounts with role admin",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginInput" },
              example: { email: "admin@gmail.com", password: "admin123" },
            },
          },
        },
        responses: {
          200: { $ref: "#/components/responses/LoginSuccess" },
          401: { description: "Invalid password" },
          403: { description: "This account is not admin" },
          404: { description: "Email user not found" },
        },
      },
    },
    "/auth/admin/register": {
      post: {
        tags: ["Admin"],
        summary: "Create a new admin (SUPERADMIN token required)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AdminRegisterInput" } } },
        },
        responses: {
          201: { description: "Admin registered (roles from body, default: admin, user)" },
          400: { description: "Invalid role(s) or missing email/password" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
          409: { description: "Email already registered" },
        },
      },
    },
    "/auth/getData": {
      get: {
        tags: ["Admin"],
        summary: "List all users with roles (admin token required)",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "List of users" },
          401: { description: "Missing or invalid token" },
          403: { description: "Forbidden: insufficient role" },
        },
      },
    },
  },
  components: {
    responses: {
      LoginSuccess: {
        description: "Login successful",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                message: { type: "string", example: "Login successful" },
                token: { type: "string", example: "eyJhbGciOiJIUzI1NiIs..." },
                roles: { type: "array", items: { type: "string" }, example: ["user"] },
              },
            },
          },
        },
      },
      OrderResponse: {
        description: "Order with its items",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                message: { type: "string", example: "Order" },
                data: { $ref: "#/components/schemas/Order" },
              },
            },
          },
        },
      },
      OrderListResponse: {
        description: "List of orders",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                message: { type: "string", example: "My orders" },
                data: { type: "array", items: { $ref: "#/components/schemas/Order" } },
              },
            },
          },
        },
      },
      CartResponse: {
        description: "Full cart after the operation",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                message: { type: "string", example: "Cart" },
                data: { $ref: "#/components/schemas/Cart" },
              },
            },
          },
        },
      },
    },
    parameters: {
      Page: { name: "page", in: "query", required: false, schema: { type: "integer", minimum: 1, default: 1 }, description: "Page number (starts at 1)" },
      Limit: { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 10 }, description: "Items per page (max 100)" },
    },
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      ProfileInput: {
        type: "object",
        properties: {
          firstName: { type: "string", example: "Sala" },
          lastName: { type: "string", example: "User" },
          avatar: { type: "string", example: "https://example.com/avatar.png" },
          bio: { type: "string", example: "I love shopping" },
          phone: { type: "string", example: "012345678", description: "6-15 digits, optional leading +" },
          date_of_birth: { type: "string", format: "date", example: "2000-01-31" },
        },
      },
      UserProfile: {
        type: "object",
        nullable: true,
        properties: {
          id: { type: "integer", example: 1 },
          avatar: { type: "string", example: "https://example.com/avatar.png" },
          bio: { type: "string", example: "I love shopping" },
          phone: { type: "string", example: "012345678" },
          date_of_birth: { type: "string", format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      UserWithProfile: {
        type: "object",
        properties: {
          id: { type: "integer", example: 5 },
          firstName: { type: "string", example: "admin2" },
          lastName: { type: "string", example: "admin2" },
          email: { type: "string", example: "admin2@gmail.com" },
          status: { type: "boolean", example: true },
          profile: { $ref: "#/components/schemas/UserProfile" },
          Roles: {
            type: "array",
            items: {
              type: "object",
              properties: { code: { type: "string", example: "admin" }, name: { type: "string", example: "Admin" } },
            },
          },
        },
      },
      RegisterInput: {
        type: "object",
        required: ["email", "password"],
        properties: {
          firstName: { type: "string", example: "Sala" },
          lastName: { type: "string", example: "User" },
          email: { type: "string", example: "user@gmail.com" },
          password: { type: "string", example: "123456" },
          status: { type: "boolean", example: true },
        },
      },
      AdminRegisterInput: {
        type: "object",
        required: ["email", "password"],
        properties: {
          firstName: { type: "string", example: "admin2" },
          lastName: { type: "string", example: "admin2" },
          email: { type: "string", example: "admin2@gmail.com" },
          password: { type: "string", example: "123456789" },
          status: { type: "boolean", example: true },
          roles: {
            type: "array",
            items: { type: "string" },
            description: "Role codes to assign (optional, default: admin, user)",
            example: ["admin", "user"],
          },
        },
      },
      LoginInput: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", example: "admin@gmail.com" },
          password: { type: "string", example: "123456" },
        },
      },
      CategoryInput: {
        type: "object",
        required: ["name", "slug"],
        properties: {
          name: { type: "string", example: "Phones" },
          slug: { type: "string", example: "phones", description: "Unique, used in URLs" },
          is_active: { type: "boolean", example: true },
        },
      },
      CategorySummary: {
        type: "object",
        nullable: true,
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Phones" },
          slug: { type: "string", example: "phones" },
        },
      },
      Category: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Electronics" },
          slug: { type: "string", example: "electronics" },
          is_active: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CategoryDetail: {
        allOf: [
          { $ref: "#/components/schemas/Category" },
          {
            type: "object",
            properties: {
              products: { type: "array", items: { $ref: "#/components/schemas/Product" } },
            },
          },
        ],
      },
      ProductInput: {
        type: "object",
        required: ["name", "slug"],
        properties: {
          categoryId: { type: "integer", nullable: true, example: 1 },
          name: { type: "string", example: "iPhone 15" },
          slug: { type: "string", example: "iphone-15", description: "Unique, used in URLs" },
          description: { type: "string", example: "Apple smartphone 128GB" },
          base_price: { type: "number", format: "decimal", example: 999.99 },
          is_active: { type: "boolean", example: true },
        },
      },
      Product: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          categoryId: { type: "integer", nullable: true, example: 1 },
          name: { type: "string", example: "iPhone 15" },
          slug: { type: "string", example: "iphone-15" },
          description: { type: "string", example: "Apple smartphone 128GB" },
          base_price: { type: "string", example: "999.99", description: "Postgres DECIMAL is returned as a string" },
          is_active: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          category: { $ref: "#/components/schemas/CategorySummary" },
        },
      },
      ProductImageUpload: {
        type: "object",
        required: ["image"],
        properties: {
          image: { type: "string", format: "binary", description: "jpeg/png/webp/gif, max 5MB" },
          is_primary: { type: "boolean", example: false },
        },
      },
      ProductImageUploadOptional: {
        type: "object",
        properties: {
          productId: { type: "integer", example: 2, description: "Optional target product ID to move this image to another product" },
          image: { type: "string", format: "binary", description: "Optional new file, replaces the old one" },
          url: { type: "string", example: "/uploads/products/product-1760514000000-123456789.png", description: "Optional direct image URL when not uploading a new file" },
          is_primary: { type: "boolean", example: false },
        },
      },
      ProductImage: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          productId: { type: "integer", example: 1 },
          url: { type: "string", example: "/uploads/products/product-1760514000000-123456789.png", description: "Open at http://localhost:3000 + url" },
          is_primary: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ProductSummary: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "iPhone 15" },
          slug: { type: "string", example: "iphone-15" },
        },
      },
      ProductWithImages: {
        allOf: [
          { $ref: "#/components/schemas/ProductSummary" },
          {
            type: "object",
            properties: {
              images: { type: "array", items: { $ref: "#/components/schemas/ProductImage" } },
            },
          },
        ],
      },
      ProductImageDetail: {
        allOf: [
          { $ref: "#/components/schemas/ProductImage" },
          { type: "object", properties: { product: { $ref: "#/components/schemas/ProductSummary" } } },
        ],
      },
      ProductVariantInput: {
        type: "object",
        required: ["sku"],
        properties: {
          sku: { type: "string", example: "IP15-BLK-128", description: "Unique across all variants" },
          color: { type: "string", example: "Black" },
          size: { type: "string", example: "128GB" },
          price: { type: "number", nullable: true, example: 999.99, description: "null = use product base_price" },
          stock_qty: { type: "integer", example: 10, description: "default 0" },
          is_active: { type: "boolean", example: true },
        },
      },
      ProductVariant: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          sku: { type: "string", example: "IP15-BLK-128" },
          color: { type: "string", nullable: true, example: "Black" },
          size: { type: "string", nullable: true, example: "128GB" },
          price: { type: "string", nullable: true, example: "999.99" },
          final_price: { type: "string", example: "999.99", description: "price, or product base_price when price is null" },
          stock_qty: { type: "integer", example: 10 },
          is_active: { type: "boolean", example: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ProductWithVariants: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "iPhone 15" },
          slug: { type: "string", example: "iphone-15" },
          base_price: { type: "string", example: "999.99" },
          variants: { type: "array", items: { $ref: "#/components/schemas/ProductVariant" } },
        },
      },
      ProductVariantDetail: {
        allOf: [
          { $ref: "#/components/schemas/ProductVariant" },
          { type: "object", properties: { product: { $ref: "#/components/schemas/ProductSummary" } } },
        ],
      },
      CartItemInput: {
        type: "object",
        required: ["variantId"],
        properties: {
          variantId: { type: "integer", example: 1 },
          quantity: { type: "integer", example: 2, description: "default 1, must be >= 1" },
        },
      },
      CartItemQuantityInput: {
        type: "object",
        required: ["quantity"],
        properties: {
          quantity: { type: "integer", example: 3, description: "must be >= 1 and <= stock_qty" },
        },
      },
      CartItem: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          cartId: { type: "integer", example: 1 },
          variantId: { type: "integer", example: 1 },
          quantity: { type: "integer", example: 2 },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          variant: {
            type: "object",
            properties: {
              id: { type: "integer", example: 1 },
              sku: { type: "string", example: "IP15-BLK-128" },
              color: { type: "string", nullable: true, example: "Black" },
              size: { type: "string", nullable: true, example: "128GB" },
              price: { type: "string", nullable: true, example: "999.99" },
              stock_qty: { type: "integer", example: 10 },
              is_active: { type: "boolean", example: true },
              product: {
                type: "object",
                properties: {
                  id: { type: "integer", example: 1 },
                  name: { type: "string", example: "iPhone 15" },
                  slug: { type: "string", example: "iphone-15" },
                  base_price: { type: "string", example: "999.99" },
                },
              },
            },
          },
          unit_price: { type: "number", example: 999.99, description: "variant price, or product base_price when null" },
          line_total: { type: "number", example: 1999.98 },
        },
      },
      Cart: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          userId: { type: "integer", example: 5 },
          items: { type: "array", items: { $ref: "#/components/schemas/CartItem" } },
          total_qty: { type: "integer", example: 2 },
          total_price: { type: "number", example: 1999.98 },
        },
      },
      ReviewInput: {
        type: "object",
        required: ["rating"],
        properties: {
          rating: { type: "integer", minimum: 1, maximum: 5, example: 5 },
          comment: { type: "string", nullable: true, example: "Great phone, fast delivery!", description: "max 2000 characters" },
        },
      },
      Review: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          userId: { type: "integer", example: 5 },
          productId: { type: "integer", example: 1 },
          rating: { type: "integer", example: 5 },
          comment: { type: "string", nullable: true, example: "Great phone, fast delivery!" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          user: {
            type: "object",
            properties: {
              id: { type: "integer", example: 5 },
              firstName: { type: "string", example: "Sala" },
              lastName: { type: "string", example: "User" },
            },
          },
        },
      },
      ProductReviews: {
        type: "object",
        properties: {
          product: { $ref: "#/components/schemas/ProductSummary" },
          average_rating: { type: "number", example: 4.5 },
          total_reviews: { type: "integer", example: 2 },
          breakdown: {
            type: "object",
            description: "Number of reviews per star",
            example: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
          },
          reviews: { type: "array", items: { $ref: "#/components/schemas/Review" } },
        },
      },
      AddressInput: {
        type: "object",
        required: ["receiver_name", "phone", "street", "city"],
        properties: {
          receiver_name: { type: "string", example: "Sala User" },
          phone: { type: "string", example: "012345678", description: "6-15 digits, optional leading +" },
          street: { type: "string", example: "#12, Street 310, Sangkat BKK1" },
          city: { type: "string", example: "Phnom Penh" },
          status: { type: "boolean", example: false, description: "true = make this the default address" },
        },
      },
      Address: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          userId: { type: "integer", example: 5 },
          receiver_name: { type: "string", example: "Sala User" },
          phone: { type: "string", example: "012345678" },
          street: { type: "string", example: "#12, Street 310, Sangkat BKK1" },
          city: { type: "string", example: "Phnom Penh" },
          status: { type: "boolean", example: true, description: "true = default address" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      CheckoutInput: {
        type: "object",
        properties: {
          addressId: { type: "integer", example: 7, description: "Optional. Defaults to user's default address" },
          sub_total: { type: "number", example: 120.0, description: "Optional direct subtotal when cart is empty (ignored if cart or items has products)" },
          discount: { type: "number", example: 10.0, description: "Optional discount amount" },
          shipping_fee: { type: "number", example: 8.0, description: "Optional shipping fee (alias: shipping). Defaults to SHIPPING_FEE" },
          items: {
            type: "array",
            example: [],
            description: "Optional items [{ variantId, quantity }] when cart is empty",
            items: {
              type: "object",
              properties: {
                variantId: { type: "integer", example: 5 },
                quantity: { type: "integer", example: 1 },
              },
            },
          },
        },
      },
      AdminOrderCreateInput: {
        type: "object",
        properties: {
          userId: { type: "integer", example: 1 },
          addressId: { type: "integer", example: 1 },
          order_number: { type: "string", example: "ORD-20261023-A1B2C3" },
          shipping_receiver_name: { type: "string", example: "Amelia Stone" },
          shipping_phone: { type: "string", example: "012345678" },
          shipping_street: { type: "string", example: "#12, Street 310" },
          shipping_city: { type: "string", example: "Phnom Penh" },
          sub_total: { type: "number", example: 140.0 },
          discount: { type: "number", example: 20.0 },
          shipping_fee: { type: "number", example: 8.0, description: "Shipping fee (alias: shipping)" },
          total: { type: "number", example: 128.0, description: "Optional; auto-calculated as sub_total - discount + shipping_fee" },
          status: { type: "string", enum: ["pending", "paid", "shipped", "delivered", "cancelled"], example: "pending" },
        },
      },
      AdminOrderUpdateInput: {
        type: "object",
        properties: {
          sub_total: { type: "number", example: 140.0 },
          discount: { type: "number", example: 20.0 },
          shipping_fee: { type: "number", example: 8.0, description: "Shipping fee (alias: shipping)" },
          status: { type: "string", enum: ["pending", "paid", "shipped", "delivered", "cancelled"], example: "paid" },
          addressId: { type: "integer", nullable: true, example: 1 },
          shipping_receiver_name: { type: "string", example: "Amelia Stone" },
          shipping_phone: { type: "string", example: "012345678" },
          shipping_street: { type: "string", example: "#12, Street 310" },
          shipping_city: { type: "string", example: "Phnom Penh" },
        },
      },
      OrderPricingInput: {
        type: "object",
        properties: {
          sub_total: { type: "number", example: 140.0 },
          discount: { type: "number", example: 20.0 },
          shipping_fee: { type: "number", example: 8.0, description: "Shipping fee (alias: shipping)" },
        },
      },
      OrderStatusInput: {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["pending", "paid", "shipped", "delivered", "cancelled"], example: "paid" },
          discount: { type: "number", example: 0 },
          shipping_fee: { type: "number", example: 0 },
        },
      },
      OrderItem: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          orderId: { type: "integer", example: 1 },
          variantId: { type: "integer", nullable: true, example: 1 },
          product_name: { type: "string", example: "iPhone 15" },
          sku: { type: "string", example: "IP15-BLK-128" },
          color: { type: "string", nullable: true, example: "Black" },
          size: { type: "string", nullable: true, example: "128GB" },
          unit_price: { type: "string", example: "999.99" },
          quantity: { type: "integer", example: 2 },
          amount: { type: "string", example: "1999.98", description: "unit_price × quantity" },
        },
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          userId: { type: "integer", example: 5 },
          addressId: { type: "integer", nullable: true, example: 1 },
          order_number: { type: "string", example: "ORD-20261016-4F7K2Q" },
          shipping_receiver_name: { type: "string", example: "Sala User" },
          shipping_phone: { type: "string", example: "012345678" },
          shipping_street: { type: "string", example: "#12, Street 310, Sangkat BKK1" },
          shipping_city: { type: "string", example: "Phnom Penh" },
          sub_total: { type: "string", example: "1999.98" },
          discount: { type: "string", example: "0.00" },
          shipping_fee: { type: "string", example: "0.00" },
          total: { type: "string", example: "1999.98" },
          status: { type: "string", enum: ["pending", "paid", "shipped", "delivered", "cancelled"], example: "pending" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          items: { type: "array", items: { $ref: "#/components/schemas/OrderItem" } },
        },
      },
      PaymentCheckoutInput: {
        type: "object",
        required: ["orderId"],
        properties: {
          orderId: { type: "integer", example: 1 },
          payment_option: {
            type: "string",
            enum: ["abapay_khqr", "abapay_khqr_deeplink", "cards", "alipay", "wechat"],
            example: "abapay_khqr",
            description: "default abapay_khqr",
          },
        },
      },
      OrderReport: {
        type: "object",
        properties: {
          from: { type: "string", example: "2026-10-01" },
          to: { type: "string", example: "2026-10-31" },
          total_orders: { type: "integer", example: 12 },
          paid_orders: { type: "integer", example: 9, description: "paid + shipped + delivered" },
          sub_total: { type: "number", example: 2520.5 },
          total_discount: { type: "number", example: 120.0 },
          total_shipping: { type: "number", example: 50.0 },
          revenue: { type: "number", example: 2450.5 },
          average_order_value: { type: "number", example: 272.28 },
          by_status: {
            type: "object",
            example: { pending: 2, paid: 3, shipped: 2, delivered: 4, cancelled: 1 },
          },
          top_products: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_name: { type: "string", example: "iPhone 15" },
                quantity: { type: "integer", example: 7 },
                revenue: { type: "number", example: 6999.93 },
              },
            },
          },
          daily: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string", example: "2026-10-16" },
                orders: { type: "integer", example: 3 },
                revenue: { type: "number", example: 594.95 },
              },
            },
          },
        },
      },
      Payment: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          userId: { type: "integer", example: 5 },
          orderId: { type: "integer", example: 1 },
          paywayTranId: { type: "string", example: "12-mgq3k2x1" },
          method: { type: "string", example: "abapay_khqr" },
          amount: { type: "string", example: "1999.98" },
          status: { type: "string", enum: ["pending", "success", "failed"], example: "pending" },
          paidAt: { type: "string", format: "date-time", nullable: true },
          remark: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      PaymentCheckout: {
        type: "object",
        properties: {
          payment: { $ref: "#/components/schemas/Payment" },
          action_url: { type: "string", example: "https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/purchase" },
          method: { type: "string", example: "POST" },
          fields: {
            type: "object",
            description: "Submit these as a form (multipart/form-data) to action_url",
            additionalProperties: { type: "string" },
          },
        },
      },
    },
  },
};
