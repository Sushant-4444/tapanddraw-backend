// models/Review.js
import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  productId: { type:String, required: true },
  userId: { type:String, required: true },
  userName: { type: String, required: true }, // Added username field
  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Review', reviewSchema);
