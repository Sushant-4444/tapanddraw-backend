import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
  variantId: { type: String, required: true },
  size: { type: String, required: true },
  color: { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number, required: true, default: function() { return this.price; } },
  inStock: { type: Boolean, default: true },
});

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    required: true,
  },
  images: {
    type: [String], // Array of image URLs
    required: true,
  },
  category: {
    type: [String],
    required: true,
  },
  variants: {
    type: [variantSchema],
    required: true,
  },
  defaultVariant: {
    type: String, // Stores the `variantId` of the default option
    required: true,
  },
  inStock: {
    type: Boolean,
    default: true,
  },
  sale: {
    type: {
      isOnSale: { type: Boolean },
      discountType: { type: String, enum: ['PERCENT', 'FLAT'] },
      value: { type: Number },
      saleStart: { type: Date },
      saleEnd: { type: Date },
      saleLimit: { type: Number, default: 0 }, // 0 means no limit
    },
    default: undefined
  }
}, {
  timestamps: true
});

const Product = mongoose.model("Product", productSchema);
export default Product;
