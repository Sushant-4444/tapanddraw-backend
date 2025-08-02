import { Router } from "express";
// import TrendingList from "../models/TrendingList";
import { verifyjwtandadmin } from "./verifyJWT.js";
import TrendingList from "../models/TrendingList.js";

const router = Router();

router.get("/trendinglist", (req, res) => {
    // Simulated trending product IDs
    const trendingProductIds = [
        "67f81c3e359583ddfe34a264",
        "67f81ca6359583ddfe34a265",
        "67f81ce0359583ddfe34a266",
        "67f81d67359583ddfe34a26b",
    ];
    
    res.status(200).json(trendingProductIds);
});

router.put("/trendinglist", verifyjwtandadmin, async (req, res) => {
    try {
        const TrendingList = TrendingList.find();
        if (TrendingList) {
            TrendingList.products = req.body.products; // Update the products in the existing trending list
            const updatedTrendingList = await TrendingList.save(); // Save the updated trending list

        }
        
        // const savedTrendingList = await newTrendingList.save();
        res.status(201).json(TrendingList);
    } catch (err) {
        console.error("Error saving trending list");
        res.status(500).json(err);
    }
});

export default router;