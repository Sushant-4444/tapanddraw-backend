import { Router } from "express";
import Order from "../models/Order.js";
import User from "../models/User.js"; // Import the User model
import crypto from "crypto";
import axios from "axios";
import Product from "../models/Product.js"; // Import the Product model
import Coupon from "../models/Coupon.js"; // Import the Coupon model
import { sendEmail } from "./email_service.js"; // Import the email service if needed
import dotenv from "dotenv";
import verifyjwtandauthorize from "./verifyJWT.js";
const router = Router();

router.post("/initiate/:id",verifyjwtandauthorize, async (req, res) => {
  const { userId, cartItems, amount, address,couponCode } = req.body;

  if (!userId || !cartItems || !amount || !address) {
    return res.status(400).json({ message: "Missing required fields" });
  }
    // Function to calculate total amount from cart items
    const calculateTotalFromDB = async (items) => {
        let total = 0;
        for (const item of items) {
            // Assuming item has productId and quantity
            const product = await Product.findById(item.productId);
            if (!product) {
                throw new Error(`Product with ID ${item.productId} not found`);
            }
            // If the product has variants, find the variant price
            const variant = product.variants.find(v => v.variantId === item.variantId);
            if (!variant) {
                throw new Error(`Variant with ID ${item.variantId} not found for product ${item.productId}`);
            }
            if (!variant.inStock) {
                throw new Error(`Variant with ID ${item.variantId} is out of stock`);
            }
            total += variant.price * item.quantity;
        }
        return total;
    };
  const totalAmount = await calculateTotalFromDB(cartItems);
  const validateCoupon = async (code,userId,totalAmount) => {
      if (!code || !userId || totalAmount === undefined) {
          return 0;
      }
  
    try {
      const coupon = await Coupon.findOne({"code": code});
  
      if (!coupon) {
        return 0;
      }
  
      if (!coupon.isActive) {
        return 0;
      }
  
      if (coupon.expiryDate < new Date()) {
        return 0;
      }
  
      if (coupon.usedCount >= coupon.maxUsage) {
        return 0;
      }
  
      if (coupon.isOneTimeUse && coupon.users.includes(userId)) {
        return 0;
      }
  
      if (totalAmount < coupon.minimumOrderAmount) {
        return 0;
      }
  
      let discount = 0;
      if (coupon.isPercentage) {
        discount = (totalAmount * coupon.discountPercentage) / 100;
      } else {
        discount = coupon.discountAmount;
      }
  
      return discount;
  
    } catch (err) {
      res.status(500).json({ message: "Server error validating coupon" });
    }
  };
  const discount = await validateCoupon(couponCode, userId, totalAmount);
    if ((totalAmount-discount) !== amount) {
        return res.status(400).json({ message: "Amount does not match cart total" });
    }
  // Save order with status = pending
  const transactionId = `TXN_${Date.now()}`;
  const order = await Order.create({
    userId:req.params.id,
    products: cartItems,
    amount,
    address,
    status: "Pending",
    isPaid: false,
    merchantTransactionId: transactionId,
    couponCode: couponCode || "", // Store the applied coupon code
    discount: discount, // Initialize discount to 0, can be updated later if needed
  });
//   try{
//     sendEmail("arorasushant4444@gmail.com", "New Order Placed", `Dear Admin , An order with ID ${order._id} has been placed by ${order.address.name} successfully! payment yet to be verified`);
//   }
//   catch (emailError) {
//     console.error("Failed to send order confirmation email");
//   }
const payload = {
    merchantId: process.env.PHONEPE_MERCHANT_ID,
    merchantTransactionId: transactionId,
    merchantUserId: userId,
    amount: Math.round(amount * 100),
    redirectUrl: `https://qxg9q00v-5000.inc1.devtunnels.ms/payment_status/${order._id}`,
    callbackUrl: `https://qxg9q00v-5000.inc1.devtunnels.ms/payment/verify/${order._id}`,
    redirectMode: "REDIRECT",
    paymentInstrument: {
        type: "PAY_PAGE"
    }
};

  const data = Buffer.from(JSON.stringify(payload)).toString("base64");
  // const raw = data + "/pg/v1/pay" + process.env.PHONEPE_SALT_KEY;
  const raw = data + "/pg/v1/pay" + process.env.PHONEPE_SALT_KEY;
  const xVerify = crypto.createHash("sha256").update(raw).digest("hex") + "###1";
  const response = await axios.post(
    "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay",
    { request: data },
    {
      headers: {
        "Content-Type": "application/json",
        "X-VERIFY": xVerify,
        "accept": "application/json",
      },
    }
  );

  const redirectUrl = response.data?.data?.instrumentResponse?.redirectInfo?.url;
  res.status(200).json({ redirectUrl });
});

router.post("/verify/:id", async (req, res) => {
    const orderid= req.params.id;
    try {
        const order = await
        Order.findById(orderid);
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        const raw = `/pg/v1/status/${process.env.PHONEPE_MERCHANT_ID}/${order.merchantTransactionId}` + process.env.PHONEPE_SALT_KEY;
        const xVerify = crypto.createHash("sha256").update(raw).digest("hex") + "###1";
        const response = await axios.get(
            `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/${process.env.PHONEPE_MERCHANT_ID}/${order.merchantTransactionId}`,
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-VERIFY": xVerify,
                    "accept": "application/json",
                    "X-MERCHANT-ID": process.env.PHONEPE_MERCHANT_ID,
                },
            }
        );
        const paymentStatus = response.data?.data?.state; // In v1, the status field is 'status'
        if (paymentStatus === "COMPLETED") { // Use "COMPLETED" for success in v1
            order.isPaid = true;
            order.status = "In Progress";
            await order.save();
            // Optionally send an email notification
            const user = await User.findOne({ _id: order.userId })
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
            const userEmail = user.email;
            

            try{
            sendEmail(userEmail, "Order Confirmation", `Your order with ID ${orderid} has been successfully placed.`);
            sendEmail(process.env.ADMIN_EMAIL, "Order Confirmation", `An order with ID ${orderid} has been placed by ${order.address.name} successfully! payment verified`);
            }
            catch (emailError) {
                console.error("Failed to send order confirmation email");
            }
            
            res.status(200).json({ message: "Payment successful", order });
        } else {
            await Order.deleteOne({ _id: orderid });
            res.status(400).json({ message: "Payment failed", status: paymentStatus });
        }
    } catch (error) {
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
}
);

export default router;



// import { Router } from "express";
// import Order from "../models/Order.js";
// import crypto from "crypto";
// import axios from "axios";
// import Product from "../models/Product.js"; // Import the Product model
// import Coupon from "../models/Coupon.js"; // Import the Coupon model
// import { sendEmail } from "./email_service.js"; // Import the email service if needed
// import dotenv from "dotenv";
// import verifyjwtandauthorize from "./verifyJWT.js";

// // Load environment variables from .env file
// dotenv.config();

// const router = Router();

// // PhonePe API Configuration (based on environment)
// const PHONEPE_CONFIG = {
//     UAT: {
//         AUTH_URL: "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token",
//         PAY_URL: "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay",
//         STATUS_URL: "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order" // Base URL, will append merchantOrderId/status
//     },
//     PRODUCTION: {
//         AUTH_URL: "https://api.phonepe.com/apis/identity-manager/v1/oauth/token",
//         PAY_URL: "https://api.phonepe.com/apis/pg/checkout/v2/pay",
//         STATUS_URL: "https://api.phonepe.com/apis/pg/checkout/v2/order" // Base URL, will append merchantOrderId/status
//     }
// };

// let cachedAuthToken = null;
// let tokenExpiryTime = 0; // Timestamp in milliseconds

// /**
//  * @desc Fetches or refreshes the PhonePe Authorization Token.
//  * @returns {Promise<string>} The PhonePe authorization token.
//  * @throws {Error} If token generation fails.
//  */
// const getPhonePeAuthToken = async () => {
//     // Check if cached token exists and is still valid
//     if (cachedAuthToken && Date.now() < tokenExpiryTime) {
//         console.log("Using cached PhonePe Auth Token.");
//         return cachedAuthToken;
//     }

//     console.log("Generating new PhonePe Auth Token...");

//     const env = process.env.PHONEPE_ENV === "PRODUCTION" ? "PRODUCTION" : "UAT";
//     const config = PHONEPE_CONFIG[env];

//     const payload = new URLSearchParams();
//     payload.append('client_id', process.env.PHONEPE_CLIENT_ID);
//     payload.append('client_version', process.env.PHONEPE_CLIENT_VERSION || '1'); // Default to '1' for safety
//     payload.append('client_secret', process.env.PHONEPE_CLIENT_SECRET);
//     payload.append('grant_type', 'client_credentials');

//     // Added logging for the payload being sent to the auth endpoint
//     console.log("Auth Token Request Payload:", payload.toString());

//     try {
//         const response = await axios.post(
//             config.AUTH_URL,
//             payload.toString(), // Send as x-www-form-urlencoded
//             {
//                 headers: {
//                     "Content-Type": "application/x-www-form-urlencoded",
//                     "Accept": "application/json"
//                 },
//             }
//         );

//         const { access_token, expires_at } = response.data;
//         if (access_token && expires_at) {
//             cachedAuthToken = access_token;
//             // Set expiry time slightly before actual expiry for proactive refresh
//             // expires_at is in epoch seconds or milliseconds based on docs. Let's assume milliseconds for safety.
//             // If it's seconds, multiply by 1000.
//             tokenExpiryTime = expires_at - (60 * 1000); // Refresh 1 minute before actual expiry

//             console.log("PhonePe Auth Token generated successfully.");
//             console.log(cachedAuthToken)
//             return cachedAuthToken;
//         } else {
//             // More specific error if token or expiry is missing from response
//             throw new Error(`Failed to get access_token or expires_at from PhonePe auth response. Response data: ${JSON.stringify(response.data)}`);
//         }
//     } catch (error) {
//         console.error("Error generating PhonePe Auth Token:", error.message);
//         if (error.response) {
//             console.error("PhonePe Auth Token API Error Response Status:", error.response.status);
//             console.error("PhonePe Auth Token API Error Response Data:", error.response.data); // Log the actual error response from PhonePe
//         }
//         throw new Error("Failed to generate PhonePe Authorization Token. Please check your client_id and client_secret.");
//     }
// };


// // Route to initiate a PhonePe payment
// router.post("/initiate/:id", verifyjwtandauthorize, async (req, res) => {
//     const { userId, cartItems, amount, address, couponCode } = req.body;

//     // Validate required fields
//     if (!userId || !cartItems || !amount || !address) {
//         return res.status(400).json({ message: "Missing required fields" });
//     }

//     /**
//      * @desc Calculates the total amount of cart items from the database.
//      * @param {Array} items - Array of cart items (each with productId, quantity, variantId).
//      * @returns {Promise<number>} The calculated total amount.
//      * @throws {Error} If product or variant not found, or variant is out of stock.
//      */
//     const calculateTotalFromDB = async (items) => {
//         let total = 0;
//         for (const item of items) {
//             const product = await Product.findById(item.productId);
//             if (!product) {
//                 throw new Error(`Product with ID ${item.productId} not found`);
//             }
//             const variant = product.variants.find(v => v.variantId === item.variantId);
//             if (!variant) {
//                 throw new Error(`Variant with ID ${item.variantId} not found for product ${item.productId}`);
//             }
//             if (!variant.inStock) {
//                 throw new Error(`Variant with ID ${item.variantId} is out of stock`);
//             }
//             total += variant.price * item.quantity;
//         }
//         return total;
//     };

//     /**
//      * @desc Validates a coupon code and calculates the discount.
//      * @param {string} code - The coupon code to validate.
//      * @param {string} userId - The ID of the user.
//      * @param {number} totalAmount - The total amount before discount.
//      * @returns {Promise<number>} The calculated discount amount, or 0 if invalid.
//      */
//     const validateCoupon = async (code, userId, totalAmount) => {
//         if (!code || !userId || totalAmount === undefined) {
//             return 0;
//         }

//         try {
//             const coupon = await Coupon.findOne({ "code": code });

//             if (!coupon || !coupon.isActive || coupon.expiryDate < new Date() || coupon.usedCount >= coupon.maxUsage) {
//                 return 0;
//             }

//             if (coupon.isOneTimeUse && coupon.users.includes(userId)) {
//                 return 0;
//             }

//             if (totalAmount < coupon.minimumOrderAmount) {
//                 return 0;
//             }

//             let discount = 0;
//             if (coupon.isPercentage) {
//                 discount = (totalAmount * coupon.discountPercentage) / 100;
//             } else {
//                 discount = coupon.discountAmount;
//             }

//             return discount;

//         } catch (err) {
//             console.error("Error validating coupon:", err.message);
//             // Don't throw a server error here, just return 0 discount
//             return 0;
//         }
//     };

//     let totalAmountFromDB;
//     try {
//         totalAmountFromDB = await calculateTotalFromDB(cartItems);
//     } catch (error) {
//         return res.status(400).json({ message: error.message });
//     }

//     const discount = await validateCoupon(couponCode, userId, totalAmountFromDB);

//     // Verify if the amount received from frontend matches the calculated amount after discount
//     if ((totalAmountFromDB - discount) !== amount) {
//         return res.status(400).json({ message: "Amount does not match cart total after discount" });
//     }

//     // Save order with status = pending
//     const transactionId = `TXN_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`; // More unique
//     const order = await Order.create({
//         userId: req.params.id,
//         products: cartItems,
//         amount,
//         address,
//         status: "Pending",
//         isPaid: false,
//         merchantTransactionId: transactionId,
//         couponCode: couponCode || "",
//         discount: discount,
//     });

//     try {
//         // Example email sending, ensure 'arorasushant4444@gmail.com' is a valid recipient in your setup
//         sendEmail("arorasushant4444@gmail.com", "New Order Placed", `Dear Admin, An order with ID ${order._id} has been placed by ${order.address.name}. Payment yet to be verified.`);
//     } catch (emailError) {
//         console.error("Failed to send order confirmation email to admin:", emailError);
//     }

//     try {
//         const authToken = await getPhonePeAuthToken(); // Get the authorization token

//         const env = process.env.PHONEPE_ENV === "PRODUCTION" ? "PRODUCTION" : "UAT";
//         const payUrl = PHONEPE_CONFIG[env].PAY_URL;

//         const payload = {
//             merchantOrderId: transactionId,
//             amount: amount * 100, // Amount in paisa
//             expireAfter: 1200, // Added expireAfter as per sample (in seconds)
//             metaInfo: { // Added metaInfo as per sample
//                 udf1: "additional-information-1",
//                 udf2: "additional-information-2",
//                 udf3: "additional-information-3",
//                 udf4: "additional-information-4",
//                 udf5: "additional-information-5"
//             },
//             paymentFlow: { // Updated to use paymentFlow structure as per sample
//                 type: "PG_CHECKOUT",
//                 message: "Payment message used for collect requests", // Added message
//                 merchantUrls: {
//                     redirectUrl: `https://qxg9q00v-5000.inc1.devtunnels.ms/payment_status/${order._id}`, // Redirect URL
//                     callbackUrl: `localhost:5000/payment/verify/${order._id}` // Callback URL
//                 }
//             }
//         };

//         const data = Buffer.from(JSON.stringify(payload)).toString("base64");

//         const response = await axios.post(
//             payUrl,
//             { request: data },
//             {
//                 headers: {
//                     "Content-Type": "application/json",
//                     // The X-VERIFY header checksum calculation path needs to be correct for PG/V2
//                     "X-VERIFY": crypto.createHash("sha256").update(data + "/pg/v2/pay" + process.env.PHONEPE_SALT_KEY).digest("hex") + "###1",
//                     "Authorization": `O-Bearer ${authToken}`, // Auth Token for PG/V2
//                     "Accept": "application/json",
//                 },
//             }
//         );

//         const redirectUrl = response.data?.redirectUrl;

//         if (redirectUrl) {
//             res.status(200).json({ redirectUrl });
//         } else {
//             console.error("PhonePe initiate payment response missing redirectUrl:", response.data);
//             res.status(500).json({ message: "Failed to get redirect URL from PhonePe. Please try again." });
//         }

//     } catch (error) {
//         console.error("Error initiating PhonePe payment:", error.message);
//         if (error.response) {
//             console.error("PhonePe Initiate API Error Response Status:", error.response.status);
//             console.error("PhonePe Initiate API Error Response Data:", error.response.data);
//         }
//         res.status(500).json({ message: "Internal server error during payment initiation. Please check logs.", error: error.message });
//     }
// });


// // Route to verify PhonePe payment status (callback endpoint)
// router.post("/verify/:id", async (req, res) => {
//     // const { merchantTransactionId } = req.body;
//     const orderId = req.params.id; // Renamed from orderid to orderId for clarity

//     // if (!merchantTransactionId) {
//     //     return res.status(400).json({ message: "Missing transaction ID" });
//     // }

//     try {
//         const order = await Order.findById(orderId);
//         if (!order) {
//             return res.status(404).json({ message: "Order not found" });
//         }

//         console.log("Verifying payment for order:", order);

//         // It's crucial to verify the incoming X-VERIFY header from PhonePe's callback
//         // This is a simplified check. A full implementation would verify the header sent by PhonePe.
//         // For actual callback verification, PhonePe sends an X-VERIFY header.
//         // You would typically re-calculate the checksum based on the callback payload and compare it.
//         // As per PhonePe docs, the callback will contain an X-VERIFY header which the merchant should verify.
//         // For the sake of this update, we are focusing on the outgoing API calls,
//         // but ensure your callback verification logic is robust for production.

//         // if (order.merchantTransactionId !== merchantTransactionId) {
//         //     return res.status(400).json({ message: "Transaction ID does not match order" });
//         // }// Use the order's transaction ID for verification
//         const authToken = await getPhonePeAuthToken(); // Get the authorization token
//         const env = process.env.PHONEPE_ENV === "PRODUCTION" ? "PRODUCTION" : "UAT";
//         const statusUrl = `${PHONEPE_CONFIG[env].STATUS_URL}/${order.merchantTransactionId}/status`; // Construct full URL for status check
//         console.log("Status URL:", statusUrl);

//         // Note: For status check, the payload is typically empty or not required when path parameters are used.
//         // The X-VERIFY for status check is also removed in v2 when using Auth Token.
//         const response = await axios.get(
//             statusUrl,
//             {
//                 headers: {
//                     "Content-Type": "application/json",
//                     "Authorization": `O-Bearer ${authToken}`, // Auth Token for PG/V2 status check
//                     "Accept": "application/json",
//                 },
//             }
//         );

//         const paymentStatus = response.data?.state; // In v2, the status field is 'state'
//         // const phonepeTransactionId = response.data?.data?.transactionId; // Get PhonePe's internal transaction ID

//         if (paymentStatus === "COMPLETED") { // Use "COMPLETED" for success in v2
//             order.isPaid = true;
//             order.status = "Completed";
//             // order.phonepeTransactionId = phonepeTransactionId; // Store PhonePe's transaction ID
//             await order.save();

//             try {
//                 // sendEmail(, "Order Confirmation", `Your order with ID ${orderId} has been successfully placed.`);
//                 sendEmail("arorasushant4444@gmail.com", "Order Confirmation", `An order with ID ${orderId} has been placed by ${order.address.name} successfully! Payment verified.`);
//             } catch (emailError) {
//                 console.error("Failed to send order confirmation email:", emailError);
//             }

//             res.status(200).json({ message: "Payment successful", order });
//         } else {
//             // Handle other statuses like PENDING, FAILED
//             order.status = paymentStatus; // Update order status to PhonePe's status
//             await order.save();
//             res.status(400).json({ message: "Payment status: " + paymentStatus, status: paymentStatus });
//         }
//     } catch (error) {
//         console.error("Error verifying PhonePe payment:", error.message);
//         if (error.response) {
//             console.error("PhonePe Verify API Error Response Status:", error.response.status);
//             console.error("PhonePe Verify API Error Response Data:", error.response.data);
//         }
//         res.status(500).json({ message: "Internal server error during payment verification", error: error.message });
//     }
// });

// export default router;
