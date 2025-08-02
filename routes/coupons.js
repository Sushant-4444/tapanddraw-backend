import {Router} from 'express';
import Coupon from '../models/Coupon.js';
import verifyjwtandauthorize, { verifyJWT, verifyjwtandadmin } from './verifyJWT.js';

const router = Router();



const validateCoupon = async (req, res) => {
  const { code, userId, cartTotal } = req.body;
    if (!code || !userId || cartTotal === undefined) {
        return res.status(400).json({ message: "Missing required fields" });
    }

  try {
    const coupon = await Coupon.findOne({"code": code});

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    if (!coupon.isActive) {
      return res.status(400).json({ message: "Coupon is not active" });
    }

    if (coupon.expiryDate < new Date()) {
      return res.status(400).json({ message: "Coupon has expired" });
    }

    if (coupon.usedCount >= coupon.maxUsage) {
      return res.status(400).json({ message: "Coupon usage limit reached" });
    }

    if (coupon.isOneTimeUse && coupon.users.includes(userId)) {
      return res.status(400).json({ message: "You’ve already used this coupon" });
    }

    if (cartTotal < coupon.minimumOrderAmount) {
      return res.status(400).json({ message: `Minimum order should be ₹${coupon.minimumOrderAmount}` });
    }

    let discount = 0;
    if (coupon.isPercentage) {
      discount = (cartTotal * coupon.discountPercentage) / 100;
    } else {
      discount = coupon.discountAmount;
    }

    return res.status(200).json({
      valid: true,
      code: coupon.code,
      discount,
      message: "Coupon applied successfully",
    });

  } catch (err) {

    res.status(500).json({ message: "Server error validating coupon" });
  }
};

const markCouponUsed = async (req, res) => {
  const { code, userId } = req.body;

  try {
    const coupon = await Coupon.findOne({"code": code});

    if (!coupon) return res.status(404).json({ message: "Coupon not found" });

    coupon.usedCount += 1;
    if (coupon.isOneTimeUse) {
      coupon.users.push(userId);
    }

    await coupon.save();
    res.status(200).json({ message: "Coupon usage recorded" });

  } catch (err) {

    res.status(500).json({ message: "Server error marking coupon used" });
  }
};

router.post('/validate', verifyJWT, validateCoupon);
router.post('/create', verifyjwtandadmin, async (req, res) => {
  const { code, isOneTimeUse, isPercentage, discountAmount, discountPercentage, expiryDate, isActive, minimumOrderAmount, maxUsage } = req.body;
    try {
        const newCoupon = new Coupon({
        code,
        isOneTimeUse,
        isPercentage,
        discountAmount,
        discountPercentage,
        expiryDate: new Date(expiryDate),
        isActive,
        minimumOrderAmount,
        maxUsage
        });
    
        await newCoupon.save();
        res.status(201).json(newCoupon);
    } catch (err) {

        res.status(500).json({ message: "Server error creating coupon" });
    }
});
router.post('/use', verifyJWT, markCouponUsed);
router.get('/:code', verifyJWT, async (req, res) => {
  const { code } = req.params;
    try {
        const coupon = await Coupon
.findOne({ code });
        if (!coupon) {
            return res.status(404).json({ message: "Coupon not found" });
        }   
        res.status(200).json(coupon);
    } catch (err) {

        res.status(500).json({ message: "Server error fetching coupon" });
    }
});

export default router;

