import User from "../models/User.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { Router } from "express";
import { verifyjwtandadmin } from "./verifyJWT.js";

const router = Router();

// Get admin statistics
router.get("/stats", verifyjwtandadmin, async (req, res) => {
  try {
    const usersCount = await User.countDocuments();
    const ordersCount = await Order.countDocuments();
    const productsCount = await Product.countDocuments();
    
    const totalRevenue = await Order.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    
    res.status(200).json({
      users: usersCount,
      orders: ordersCount,
      products: productsCount,
      revenue: totalRevenue[0] ? totalRevenue[0].total : 0
    });
  } catch (error) {
    console.error("Error fetching admin stats");
    res.status(500).json({ message: "Internal server error" });
  }
});


// apply sale to particular category
router.post("/apply-sale", verifyjwtandadmin, async (req, res) => {
    const { category, discountPercent,saleEnd } = req.body;
    if (!category || typeof discountPercent !== "number") {
        return res.status(400).json({ message: "Category and discountPercent are required." });
    }

    try {
        const now = new Date();

        const products = await Product.find({ categories: { $in: [category] } });

        for (const product of products) {
            product.variants = product.variants.map(variant => {
                const discountedPrice = Number(
                    (variant.originalPrice * (1 - discountPercent / 100)).toFixed(2)
                );
                return {
                    ...variant.toObject(),
                    price: discountedPrice
                };
            });

            product.sale = {
                isOnSale: discountPercent > 0 ? true : false,
                discountType: 'PERCENT',
                value: discountPercent,
                saleStart: now,
                saleEnd: saleEnd,
                saleLimit: 0
            };

            await product.save();
        }

        res.status(200).json({ message: `Applied ${discountPercent}% sale to all products in category '${category}'.` });
    } catch (error) {
        console.error("Error applying sale:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// appy sale to all products
router.post("/apply-global-sale", verifyjwtandadmin, async (req, res) =>
{
    const { discountPercent, saleEnd } = req.body;
    if (typeof discountPercent !== "number") {
        return res.status(400).json({ message: "discountPercent is required." });
    }

    try {
        const now = new Date();

        const products = await Product.find({});

        for (const product of products) {
            product.variants = product.variants.map(variant => {
                const discountedPrice = Number(
                    (variant.originalPrice * (1 - discountPercent / 100)).toFixed(2)
                );
                return {
                    ...variant.toObject(),
                    price: discountedPrice
                };
            });

            product.sale = {
                isOnSale: discountPercent > 0 ? true : false,
                discountType: 'PERCENT',
                value: discountPercent,
                saleStart: now,
                saleEnd: saleEnd,
                saleLimit: 0
            };

            await product.save();
        }

        res.status(200).json({ message: `Applied ${discountPercent}% sale to all products.` });
    } catch (error) {
        console.error("Error applying global sale:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default router;