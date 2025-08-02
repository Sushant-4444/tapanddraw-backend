import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true,
        },
        products: [
            {
                productId: {
                    type: String,
                    required: true, // Ensure productId is required
                },
                variantId: {
                    type: String,
                    required: true, // Add variantId to track the specific variant
                },
                quantity: {
                    type: Number,
                    default: 1,
                },
            },
        ],
        amount: { type: Number, required: true },
        address: { type: Object, required: true },
        status: { type: String, default: "pending" }, // e.g., pending, shipped, delivered
        isPaid: { type: Boolean, default: false }, // Track if the order is paid
        merchantTransactionId: { type: String, default:"not paid"}, // Unique transaction ID for the payment gateway
        couponCode: { type: String, default: "" }, // Store the applied coupon code
        discount: { type: Number, default: 0 }, // Store the discount amount applied
    },
    { timestamps: true }
);

const Order = mongoose.model("Order", orderSchema);
export default Order;