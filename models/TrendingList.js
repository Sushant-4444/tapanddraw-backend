import mongoose from "mongoose";

const trendingListSchema = new mongoose.Schema({
    productId: {
        type: String,
        required: true
    }
    }, {
    timestamps: true
    });

const TrendingList = mongoose.model("TrendingList", trendingListSchema);
export default TrendingList;