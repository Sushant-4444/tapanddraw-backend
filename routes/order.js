import Order from '../models/Order.js';
import User from '../models/User.js';
import {Router} from 'express';
import verifyjwtandauthorize from './verifyJWT.js';
import {verifyjwtandadmin} from './verifyJWT.js';
import Product from '../models/Product.js'; // Import the Product model
import { sendEmail } from './email_service.js';


const router = Router();

// router.post('/:id', verifyjwtandauthorize, async (req, res) => {
//     try {
//         let totalAmount = 0;

//         for (const product of req.body.products) {
//             const productDetails = await Product.findById(product.productId);
//             if (!productDetails) {
//                 return res.status(404).json({ message: `Product with ID ${product.productId} not found` });
//             }

//             // Validate variantId
//             const variant = productDetails.variants.find(v => v.variantId === product.variantId);
//             if (!variant) {
//                 return res.status(404).json({ message: `Variant with ID ${product.variantId} not found for product ${product.productId}` });
//             }

//             // Check if the variant is in stock
//             if (!variant.inStock) {
//                 return res.status(400).json({ message: `Variant with ID ${product.variantId} is out of stock` });
//             }

//             // Calculate total price
//             totalAmount += variant.price * product.quantity;
//         }
//         // adrres should be an object with name, phone, fullAddress with pincode , state , buildingnumber,addressLine1 must and landmark address line2 optional
//         if (!req.body.address || !req.body.address.name || !req.body.address.phone || !req.body.address.fullAddress) {
//             return res.status(400).json({ message: "Address must include name, phone, and fullAddress" });
//         }
//         // full address be object with pincode, state, buildingnumber, addressLine1 must and landmark address line2 optional
//         if (!req.body.address.fullAddress.pincode || !req.body.address.fullAddress.state || !req.body.address.fullAddress.buildingNumber || !req.body.address.fullAddress.addressLine1) {
//             return res.status(400).json({ message: "Full address must include pincode, state, buildingnumber, and addressLine1" });
//         }

//         // Create a new order
//         const newOrder = new Order({
//             ...req.body,
//             userId: req.params.id,
//             amount: totalAmount,
//             isPaid: false, // Assuming the order is not paid at this point

//         });

//         const savedOrder = await newOrder.save();

//         try {
//             await sendEmail("arorasushant4444@gmail.com", "Order Confirmation", `an order with ID ${savedOrder._id} has been placed by ${savedOrder.address.name} successfully!`);
//         } catch (emailError) {
//             console.error("Failed to send order confirmation email");
//             // You might want to handle this error differently, e.g., log it or notify the user
//         }
//         res.status(201).json(savedOrder);
//     } catch (err) {
//         res.status(500).json(err);
//     }
// });

router.put('/:id',verifyjwtandadmin,async (req,res)=>{
    try {
        const updatedOrder = await Order.findByIdAndUpdate(
            req.params.id,
            { $set: { status: req.body.status } },
            { new: true }
        );
        const user=await User.findOne({_id:updatedOrder.userId});
        const userEmail = user.email;
        if(updatedOrder.status === "completed"){
            try {
                await sendEmail(userEmail, "Order Delivered", `Your order with ID ${updatedOrder._id} has been Delivered successfully!`);

        }catch (emailError) {
                console.error("Failed to send order completion email");
            }
        }
        else if(updatedOrder.status === "cancellation requested"){
            try {
                await sendEmail(userEmail, "Order Cancellation Request", `Your order with ID ${updatedOrder._id} has been requested for cancellation. We will update you shortly.`);
            }
            catch (emailError) {
                console.error("Failed to send order cancellation request email");
            }
        }
        else if(updatedOrder.status === "cancelled"){
            try {
                await sendEmail(userEmail, "Order Cancelled", `Your order with ID ${updatedOrder._id} has been cancelled. If you have any questions, please contact support.`);
            }
            catch (emailError) {
                console.error("Failed to send order cancellation email");
            }
        }
        else if(updatedOrder.status === "shipped"){
            try {
                await sendEmail(userEmail, "Order Shipped", `Your order with ID ${updatedOrder._id} has been shipped.`);
            }
            catch (emailError) {
                console.error("Failed to send order in progress email");
            }
        }
        res.status(200).json(updatedOrder);
    } catch (err) {
        res.status(500).json(err);
    }
}
)

router.delete('/:id',verifyjwtandadmin,async (req,res)=>{
    try{
        await Order.findByIdAndDelete(req.params.id);
        res.status(200).json("Order has been deleted...");
    }catch(err){
        res.status(500).json(err);
    }
}
)

router.get('/find/:id',verifyjwtandauthorize,async (req,res)=>{
    try{
        const orders=await Order.find({userId:req.params.id}).sort({createdAt:-1});
        res.status(200).json(orders);
    }catch(err){
        res.status(500).json(err);
    }
}
)

router.get('/findbyorderid/:id',verifyjwtandadmin,async (req,res)=>{
    try{
        const order=await Order.findById({_id:req.params.id});
        res.status(200).json(order);
    }
    catch(err){
        res.status(500).json(err);
    }
})

router.get('/status/:status',verifyjwtandadmin,async (req,res)=>{
    try{
        const orders=await Order.find({status:req.params.status});
        res.status(200).json(orders);
    }catch(err){
        res.status(500).json(err);
    }
})

// endpoint to cancel an order only when the status is pending
router.put('/cancel/:id',verifyjwtandauthorize,async (req,res)=>{
    try {
        const order = await Order.findById(req.params.id);
        if (order.status === "pending") {
            const updatedOrder = await Order.findByIdAndUpdate(
                req.params.id,
                { $set: { status: "cancellation requested" } },
                { new: true }
            );
        // sendEmail("arorasushant4444@gmail.com", "Order Cancellation Request", `Order with ID ${req.params.id} has been requested for cancellation.`);
            res.status(200).json(updatedOrder);
        } else {
            res.status(400).json({ message: "Order cannot be cancelled" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
})

router.get("/product-sales/:productId", async (req, res) => {
    try {
        const { productId } = req.params;

        const result = await Order.aggregate([
            { $unwind: "$products" }, // Unwind products array
            { $match: { "products.productId": productId } }, // Match the product ID
            {
                $group: {
                    _id: "$products.variantId", // Group by variant ID
                    totalQuantitySold: { $sum: "$products.quantity" }, // Sum of quantity sold
                },
            },
        ]);

        if (result.length === 0) {
            return res.status(404).json({ message: "Product not found or no sales yet." });
        }

        res.json(result); // Return the sales data grouped by variant
    } catch (error) {
   
        res.status(500).json({ error: "Internal Server Error" });
    }
});


router.get('/', verifyjwtandadmin, async (req, res) => {
    const { userId, orderId, status, startDate, endDate, new: isNew, reverse, page = 1, limit = 10 } = req.query;

    let filter = {};
    
    if (userId) {
        filter.userId = userId;
    }
    if (orderId) {
        filter._id = orderId;
    }
    if (status) {
        filter.status = status;
    }
    if (startDate || endDate) {
        filter.createdAt = {};
        const IST_OFFSET = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
        if (startDate) {
            filter.createdAt.$gte = new Date(new Date(startDate).getTime() - IST_OFFSET);
        }
        if (endDate) {
            filter.createdAt.$lte = new Date(new Date(endDate).getTime() - IST_OFFSET);
        }
    }
 

    const skip = (page - 1) * limit; // Calculate the number of documents to skip

    try {
        let orders;
        const sortOrder = reverse === "true" ? 1 : -1; // Determine sort order based on reverse query param
        if (isNew === "true") {
            orders = await Order.find(filter).sort({ createdAt: sortOrder }).limit(parseInt(limit)); // Fetch last `limit` orders
        } else {
            orders = await Order.find(filter).sort({ createdAt: sortOrder }).skip(skip).limit(parseInt(limit)); // Apply pagination
        }
        res.status(200).json(orders);
    } catch (err) {
        res.status(500).json(err);
    }
});

router.get('/income',verifyjwtandadmin,async (req,res)=>{
    const date=new Date();
    const lastMonth=new Date(date.setMonth(date.getMonth()-1));
    const previousMonth=new Date(new Date().setMonth(lastMonth.getMonth()-1));
    try{
        const income=await Order.aggregate([
            {$match:{createdAt:{$gte:previousMonth}}},
            {
                $project:{
                    month:{$month:"$createdAt"},
                    sales:"$amount"
                }
            },
            {
                $group:{
                    _id:"$month",
                    total:{$sum:"$sales"}
                }
            }
        ])
        res.status(200).json(income);
    }catch(err){
        res.status(500).json(err);
    }
}
)

export default router;