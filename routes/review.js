import {Router} from 'express';
import Review from '../models/Review.js';
import User from '../models/User.js';
import verifyjwtandauthorize from './verifyJWT.js';
import { verifyjwtandadmin } from './verifyJWT.js';

const router = Router();

router.post('/:id', verifyjwtandauthorize, async (req, res) => {
    const { rating, comment, productId } = req.body;
    const user = await User.findById(req.params.id) // Fetch the username from the User model
    const username = user ? user.username : "Anonymous"; // Default to "Anonymous" if user not found

    // Validate the request body
    if (!rating || !productId) {
        return res.status(400).json({ message: "Rating and productId are required" });
    }
    // Create a new review instance
    const newReview = new Review({
        userId: req.params.id, // Use the user ID from the request parameters
        userName: username, // Use the fetched username
        productId: productId, // Use the product ID from the request body
        rating: rating, // Use the rating from the request body
        comment: comment, // Use the comment from the request body
    });
    try {
        const existingReview = await Review.findOne({
            userId: req.param.id,
            productId: req.body.productId
        });
        if (existingReview) {
            return res.status(400).json({ message: "Review already exists for this product" });
        }
        const savedReview = await newReview.save();
        res.status(201).json(savedReview);
    } catch (err) {
     
        res.status(500).json(err);
    }
}
);

router.put('/:id', verifyjwtandauthorize, async (req, res) => {
    try {
        const existingReview = await Review.findById(req.params.id);
        if (!existingReview) {
            return res.status(404).json({ message: "Review not found" });
        }
        existingReview.rating = req.body.rating;
        existingReview.comment = req.body.comment;
        const updatedReview = await existingReview.save();
        res.status(200).json(updatedReview);
    } catch (err) {
     
        res.status(500).json(err);
    }
}
);

router.delete('/:id', verifyjwtandauthorize, async (req, res) => {
    try {
        const review = await Review.findById(req.body.reviewId);
        if (!review) {
            return res.status(404).json({ message: "Review not found" });
        }
        if( review.userId.toString() !== req.params.id) {
            return res.status(403).json({ message: "You can only delete your own reviews" });
        }
        await review.deleteOne();
        res.status(200).json("Review has been deleted...");
    } catch (err) {
     
        res.status(500).json(err);
    }
}
);

router.delete('/admin/:id', verifyjwtandadmin, async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) {
            return res.status(404).json({ message: "Review not found" });
        }
        await review.remove();
        res.status(200).json("Review has been deleted by admin...");
    } catch (err) {
    
        res.status(500).json(err);
    }
});

export default router;