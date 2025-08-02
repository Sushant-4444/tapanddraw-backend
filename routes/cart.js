import Cart from '../models/Cart.js';
import {Router} from 'express';
import Product from '../models/Product.js'; // Adjust path/model as neede
import verifyjwtandauthorize from './verifyJWT.js';
import {verifyjwtandadmin} from './verifyJWT.js';


const router = Router();

router.post('/:id', verifyjwtandauthorize, async (req, res) => {
    try {
        // Assuming req.body.products is an array of {productId ,variantId, quantity }
        const products = req.body.products || [];

        // Check stock for each variant
        for (const item of products) {
            const product= await Product.findById(item.productId);
            if (!product) {
                return res.status(404).json({ error: `Product not found: ${item.productId}` });
            }

            const variant = product.variants.find(variant => variant.variantId === item.variantId);

            if (!variant) {
                return res.status(404).json({ error: `Variant not found: ${item.variantId}` });
            }
            if (variant.inStock === false) {
                return res.status(400).json({ error: `Variant ${item.variantId} is out of stock` });
            }
        }

        const newCart = new Cart(req.body);
        const savedCart = await newCart.save();
        res.status(201).json(savedCart);
    } catch (err) {
        res.status(500).json(err);
    }
});

router.put('/:id', verifyjwtandauthorize, async (req, res) => {
    try {
     

        // Check stock for each variant (like in POST)
        const products = req.body.products || [];
        for (const item of products) {
            const product = await Product.findOne({ _id: item.productId });
           
            if (!product) {
                return res.status(404).json({ error: `Product not found: ${item.productId}` });
            }
           
            const variant = product.variants.find(variant => variant.variantId === item.variantId);

            if (!variant) {
                return res.status(404).json({ error: `Variant not found: ${item.variantId}` });
            }
            if (variant.inStock === false) {

                return res.status(400).json({ error: `Variant ${item.variantId} is out of stock` });
            }
        }

        const existingCart = await Cart.findOne({ userId: req.body.userId });
        if (!existingCart) {
            return res.status(404).json({ message: "Cart not found" });
        }
        existingCart.products = req?.body?.products; // Update the products in the existing cart
        const updatedCart = await existingCart.save(); // Save the updated cart
        res.status(200).json(updatedCart);

    } catch (err) {

        res.status(500).json(err);
    }
});

router.delete('/:id',verifyjwtandauthorize,async (req,res)=>{
    try{
        await Cart.findByIdAndDelete(req.params.id);
        res.status(200).json("Cart has been deleted...");
    }catch(err){
        res.status(500).json(err);
    }
}
)

router.get('/find/:id',verifyjwtandauthorize,async (req,res)=>{
    try{
        const cart=await Cart.findOne({userId:req.params.id});
        if (!cart) {

            return res.status(404).json({ message: "Cart not found" });
        }
        // if some products are out of stock or varient is out of stock, store in a object and return the cart along woth that object woth different status code 
        // Check for out-of-stock items asynchronously
        const outOfStockItems = [];
        for (const item of cart.products) {
            const product = await Product.findById(item.productId);
            if (!product) {
            return res.status(404).json({ message: `Product not found for ID: ${item.productId}` });
            }
            const variant = product.variants.find(variant => variant.variantId === item.variantId);
            if (!variant) {
     
            return res.status(404).json({ message: `Variant not found for ID: ${item.variantId} in product ${item.productId}` });
            }
            if (variant.inStock === false) {
        
            outOfStockItems.push(item);
            }
        }

        if (outOfStockItems.length > 0) {
            console.warn("Some items are out of stock"); // Log the
            return res.status(206).json({
                message: "Some items are out of stock",
                outOfStockItems,
                cart
            });
        }
    
         // Ensure the cart is returned correctly
        res.status(200).json(cart);
    }catch(err){
        res.status(500).json(err);
    }
}
)

router.get('/',verifyjwtandadmin,async (req,res)=>{
    try{
        const carts=await Cart.find();
        res.status(200).json(carts);
    }catch(err){
        res.status(500).json(err);
    }
}
)

export default router;