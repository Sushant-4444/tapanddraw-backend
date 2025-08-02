import mongoose from "mongoose";

const cartSchema = new mongoose.Schema(
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
    },
    { timestamps: true }
    );

const Cart = mongoose.model("Cart", cartSchema);
export default Cart;