import mongoose from "mongoose";


const CouponSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true, // Ensure coupon codes are unique
        },
        isOneTimeUse: {
            type: Boolean,
            default: false, // Default to false, meaning it can be used multiple times
        },
        isPercentage: {
            type: Boolean,
            default: true, // Default to percentage discount
        },
        discountAmount: {
            type: Number,
            required: function() { return !this.isPercentage; }, // Required only if not percentage
            min: 0, // Ensure discount amount is non-negative
        },
        discountPercentage: {
            type: Number,
            required: function() { return this.isPercentage; }, // Required only if percentage
            min: 0, // Ensure discount percentage is non-negative
        },
        expiryDate: {
            type: Date,
            required: true, // Ensure expiry date is provided
        },
        isActive: {
            type: Boolean,
            default: true, // Coupons can be deactivated
        },
        minimumOrderAmount: {
            type: Number,
            default: 0, // Minimum order amount to apply the coupon
        },
        maxUsage: {
            type: Number,
            default: 10, // Maximum times the coupon can be used
        },
        usedCount: {
            type: Number,
            default: 0, // Count of how many times the coupon has been used
        },
        users: {
            type: [String], // Array of user IDs who have used the coupon
            default: [], // Default to no users
        }
    },
    { timestamps: true }
);
    

const Coupon = mongoose.model("Coupon", CouponSchema);
export default Coupon;