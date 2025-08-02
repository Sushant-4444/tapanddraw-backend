import {Router} from "express";
import CryptoJS from "crypto-js";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import redis from "redis";
import { promisify } from "util";
import { sendEmail } from "./email_service.js"; // Import the sendEmail function
import {verifyJWT} from "./verifyJWT.js"; // Import your JWT verification middleware
import { send } from "process";

const router = Router();
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
});


redisClient.on("error", (err) => {
    console.error("Redis Client Error");
});

redisClient.connect().catch((err) => {
    console.error("Error connecting to Redis");
});
router.post('/register', async (req, res) => {
    try {
        // Check if the user already exists
        const existingUser = await User.findOne({ email: req.body.email });
        if (existingUser) {
            return res.status(400).json({ message: "User already registered. Please log in." });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        const tempUserData = {
            username: req.body.username,
            email: req.body.email,
            phone: req.body.phone,
            password: CryptoJS.AES.encrypt(req.body.password, process.env.PASS_SEC).toString(),
            gender: req.body.gender
        };
        const tempUserKey = `tempUser:${req.body.email}`;

        // Store temporary user data in Redis with a 10-minute expiration
        redisClient.setEx(tempUserKey, 600, JSON.stringify(tempUserData), (err) => {
            if (err) {
                return res.status(500).json({ message: "Error storing temporary user data." });
            }
        });

        // Store OTP in Redis with a 5-minute expiration
        redisClient.setEx(`otp:${req.body.email}`, 300, otp, (err) => {
            if (err) {
                return res.status(500).json({ message: "Error storing OTP." });
            }
        });

        // Simulate sending OTP (e.g., via email or SMS)
 
        try {
            await sendEmail(req.body.email, "Your OTP Code", `Your OTP code is ${otp}`);
        } catch (error) {
     
            return res.status(500).json({ message: "Error sending OTP email." });
        }

        res.status(201).json({ message: "OTP sent. Verify OTP to complete registration." });
    } catch (err) {
     
        res.status(500).json({ message: "Internal server error." });
    }
});

router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    try {
        // Retrieve OTP from Redis
        const storedOtp = await redisClient.get(`otp:${email}`);
        if (!storedOtp) {
            return res.status(400).json({ message: "OTP expired or invalid." });
        }

        if (storedOtp !== otp) {
            return res.status(400).json({ message: "Invalid OTP." });
        }

        // Retrieve temporary user data from Redis
        const tempUserKey = `tempUser:${email}`;
        const tempUserData = await redisClient.get(tempUserKey);
        if (!tempUserData) {
            return res.status(400).json({ message: "User data expired. Please register again." });
        }

        const userData = JSON.parse(tempUserData);

        // Check if the user already exists in the database
        const existingUser = await User.findOne({ email: userData.email });
        if (existingUser) {
            return res.status(400).json({ message: "User already registered. Please log in." });
        }

        // Save user to the database
        const newUser = new User(userData);
        const savedUser = await newUser.save();

        // Delete OTP and temporary user data from Redis
        await redisClient.del(`otp:${email}`);
        await redisClient.del(tempUserKey);

        res.status(200).json({ message: "Account verified and registered successfully.", user: savedUser });
    } catch (err) {
      
        res.status(500).json({ message: "Internal server error." });
    }
});

router.post('/resend-otp', async (req, res) => {
    const { email } = req.body;

    try {
        // Check if the temporary user data exists in Redis
        const tempUserKey = `tempUser:${email}`;
        const tempUserData = await redisClient.get(tempUserKey);
        if (!tempUserData) {
            return res.status(400).json({ message: "No temporary user data found. Please register again." });
        }

        // Generate a new OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Store the new OTP in Redis with a 5-minute expiration
        redisClient.setEx(`otp:${email}`, 300, otp, (err) => {
            if (err) {
                return res.status(500).json({ message: "Error storing new OTP." });
            }
        });

        // Simulate sending the new OTP (e.g., via email or SMS)
      
        try {
            await sendEmail(email, "Your New OTP Code", `Your new OTP code is ${otp}`);
        } catch (error) {
      
            return res.status(500).json({ message: "Error sending new OTP email." });
        }

        res.status(200).json({ message: "New OTP sent. Please check your email." });
    } catch (err) {
   
        res.status(500).json({ message: "Internal server error." });
    }
}
);

router.get("/me", verifyJWT, async (req, res) => {
  try {
    // req.user should be set by your JWT middleware
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// Route to request password reset
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        // Check if the user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User with this email does not exist." });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Store OTP in Redis with a 5-minute expiration
        redisClient.setEx(`resetOtp:${email}`, 300, otp, (err) => {
            if (err) {
                return res.status(500).json({ message: "Error storing OTP." });
            }
        });

        // Simulate sending OTP (e.g., via email or SMS)
       
        try {
            await sendEmail(email, "Password Reset OTP", `Your OTP for password reset is ${otp}`);
        } catch (error) {
           
            return res.status(500).json({ message: "Error sending OTP email." });
        }

        res.status(200).json({ message: "OTP sent. Please check your email to reset your password." });
    } catch (err) {
     
        res.status(500).json({ message: "Internal server error." });
    }
});

// Route to verify OTP and reset password
router.post('/reset-password', async (req, res) => {
    const { email, otp, newPassword } = req.body;

    try {
        // Retrieve OTP from Redis
        const storedOtp = await redisClient.get(`resetOtp:${email}`);
        if (!storedOtp) {
            return res.status(400).json({ message: "OTP expired or invalid." });
        }

        if (storedOtp !== otp) {
            return res.status(400).json({ message: "Invalid OTP." });
        }

        // Encrypt the new password
        const encryptedPassword = CryptoJS.AES.encrypt(newPassword, process.env.PASS_SEC).toString();

        // Update the user's password in the database
        await User.findOneAndUpdate({ email }, { password: encryptedPassword });

        // Delete the OTP from Redis
        await redisClient.del(`resetOtp:${email}`);

        res.status(200).json({ message: "Password reset successfully. You can now log in with your new password." });
    } catch (err) {
     
        res.status(500).json({ message: "Internal server error." });
    }
});

router.post('/login', async (req, res) => {
    try{
        const user=await User.findOne({email:req.body.email});
        if(!user){
            return res.status(401).json("Wrong credentials");
        }
        const hashedPassword=CryptoJS.AES.decrypt(user.password, process.env.PASS_SEC);
        const OriginalPassword=hashedPassword.toString(CryptoJS.enc.Utf8);
        if(OriginalPassword!==req.body.password){
            return res.status(401).json("Wrong credentials");
        }
        else{
            const accessToken=jwt.sign({
                id:user._id,
                isAdmin:user.isAdmin
            },process.env.JWT_SEC,{expiresIn:"3d"});
            
            const {password,...others}=user._doc;
            res.status(200).json({...others,accessToken});
        }

    }
    catch(err){
        res.status(500).json(err);
    }
})


router.post('/logout', verifyJWT, async (req, res) => {
    try {
        res.status(200).json({ message: "Logged out successfully" });
    } catch (err) {
      
        res.status(500).json({ message: "Internal server error." });
    }
});

export default router;