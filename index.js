import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
dotenv.config('./.env');

import userRoutes from './routes/user.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/product.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/order.js';
import payment_route from './routes/payment_route.js';
import cmsRoutes from './routes/cms.js';
import reviewRoutes from './routes/review.js';
import couponRoutes from './routes/coupons.js';
import adminroutes from './routes/admin.js';
mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log("Connected to MongoDB");
}
).catch((err) => {
    console.error("Error connecting to MongoDB");
});
const app = express();
app.use(cors({
    origin: '*'
}));
app.use(express.static("public"));
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/carts', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', payment_route);
app.use('/api/cms', cmsRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/coupon', couponRoutes);
app.use('/api/admin', adminroutes)
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.get("/payment_status/:orderid", (req, res) => {
  res.sendFile(path.join(__dirname, "public/Payment_Status.html"));
});

// Start the server
app.listen(process.env.PORT,() => {
    console.log(`Server is running on http://localhost:${process.env.PORT}`);
});


// To ensure Express listens on all network interfaces (LAN), set the host to '0.0.0.0':
// Change your app.listen line to:
// app.listen(process.env.PORT, '0.0.0.0', () => {

// });