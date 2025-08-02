import {Router} from 'express';
import CryptoJS from 'crypto-js';
import User from '../models/User.js';
import verifyjwtandauthorize from './verifyJWT.js';
import {verifyjwtandadmin} from './verifyJWT.js'; 

const router = Router();

router.put('/:id',verifyjwtandauthorize,async (req,res)=>{
    if(req.body.password){
        req.body.password=CryptoJS.AES.encrypt(req.body.password,process.env.PASS_SEC).toString();
    }
    try{
        const updatedUser=await User.findByIdAndUpdate(req.params.id,{$set:req.body},{new:true});
        res.status(200).json(updatedUser);
    }catch(err){
        res.status(500).json(err);
    }
})

router.delete('/:id',verifyjwtandauthorize,async (req,res)=>{
    try{
        await User.findByIdAndDelete(req.params.id);
        res.status(200).json("User has been deleted...");
    }catch(err){
        res.status(500).json(err);
    }
}
)

router.get('/find/:id',verifyjwtandadmin,async (req,res)=>{
    try{
        const user=await User.findById(req.params.id);
        const {password,...others}=user._doc;
        res.status(200).json(others);
    }catch(err){
        res.status(500).json(err);
    }
}
)

router.get('/findbyemail/:email',verifyjwtandadmin,async (req,res)=>{
    try{
        const user = await User.findOne({ email: { $regex: req.params.email, $options: 'i' } });
        if(!user){
            return res.status(404).json("User not found");
        }
        const {password,...others}=user._doc;
        res.status(200).json(others);
    }catch(err){
        res.status(500).json(err);
    }
})

router.get('/', verifyjwtandadmin, async (req, res) => {
    const query = req.query.new;
    const page = parseInt(req.query.page) || 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    
    const skip = limit ? (page - 1) * limit : 0;

    try {
        let users;
        if (query) {
            users = await User.find().sort({ _id: -1 }).limit(5);
        } else if (limit) {
            users = await User.find().skip(skip).limit(limit);
        } else {
            users = await User.find();
        }
        res.status(200).json(users);
    } catch (err) {
        res.status(500).json(err);
    }
});

router.get('/stats',verifyjwtandadmin,async (req,res)=>{
    const date=new Date();
    const lastYear=date.setFullYear(date.setFullYear()-1);
    try{
        const data=await User.aggregate([
            {$match:{createdAt:{$gte:lastYear}}},
            {
                $project:{
                    month:{$month:"$createdAt"},
                },
            },
            {
                $group:{
                    _id:"$month",
                    total:{$sum:1},
                },
            },
        ]);
        res.status(200).json(data);
    }catch(err){
        res.status(500).json(err);
    }
}
)

export default router;