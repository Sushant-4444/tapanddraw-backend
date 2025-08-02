import Product from '../models/Product.js';
import Review from '../models/Review.js';
import {Router} from 'express';
import verifyjwtandauthorize from './verifyJWT.js';
import {verifyjwtandadmin} from './verifyJWT.js';

const router = Router();

router.post('/', verifyjwtandadmin, async (req, res) => {
    const { title, description, images, category, variants, defaultVariant } = req.body;

    // Check if variants are provided and valid
    if (!Array.isArray(variants) || variants.length === 0) {
        return res.status(400).json({ error: "At least one product variant is required." });
    }

    // Check if defaultVariant exists in the variants
    const isValidDefault = variants.some(v => v.variantId === defaultVariant);
    if (!isValidDefault) {
        return res.status(400).json({ error: "Default variant must match one of the variant IDs." });
    }

    const newProduct = new Product({
        title,
        description,
        images,
        category,
        variants,
        defaultVariant,
        inStock: variants.some(v => v.inStock), // Product is in stock if any variant is
    });

    try {
        const savedProduct = await newProduct.save();
        res.status(201).json(savedProduct);
    } catch (err) {
        res.status(500).json({ error: "Error creating product", details: err });
    }
});


router.put('/:id', verifyjwtandadmin, async (req, res) => {
    const { title, description, images, category, variants, defaultVariant } = req.body;

    try {
        // Check if variants are provided and valid (optional but safe)
        if (variants && (!Array.isArray(variants) || variants.length === 0)) {
            return res.status(400).json({ error: "Variants must be a non-empty array." });
        }

        // Validate defaultVariant if provided
        if (defaultVariant && variants) {
            const isValidDefault = variants.some(v => v.variantId === defaultVariant);
            if (!isValidDefault) {
                return res.status(400).json({ error: "Default variant must match one of the variant IDs." });
            }
        }

        // Calculate inStock based on variant availability
        let inStock;
        if (variants) {
            inStock = variants.some(v => v.inStock);
        }

        const updatedData = {
            ...(title && { title }),
            ...(description && { description }),
            ...(images && { images }),
            ...(category && { category }),
            ...(variants && { variants }),
            ...(typeof inStock === 'boolean' && { inStock }),
            ...(defaultVariant && { defaultVariant }),
        };

        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            { $set: updatedData },
            { new: true }
        );

        res.status(200).json(updatedProduct);
    } catch (err) {
        res.status(500).json({ error: "Failed to update product", details: err });
    }
});


router.delete('/:id',verifyjwtandadmin,async (req,res)=>{
    try{
        await Product.findByIdAndDelete(req.params.id);
        res.status(200).json("Product has been deleted...");
    }catch(err){
        res.status(500).json(err);
    }
}
)
// GET /products/:id?size=M&color=Red
router.get('/find/:id', async (req, res) => {
    try {
        const { size, color } = req.query;
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // If no query params, return the whole product
        if (!size && !color) {
            return res.status(200).json(product);
        }

        // Filter variant based on query
        const variant = product.variants.find(v =>
            (!size || v.size === size) &&
            (!color || v.color === color)
        );

        if (!variant) {
            return res.status(404).json({ message: 'No matching variant found' });
        }

        // Return the variant with product metadata
        return res.status(200).json({
            productId: product._id,
            title: product.title,
            description: product.description,
            images: product.images,
            category: product.category,
            variant
        });

    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});


router.get('/', async (req, res) => {
    const {
      category,
      size,
      color,
      new: isNew,
      limit,
      page,
      sort,
      minPrice,
      maxPrice,
      search,
      q
    } = req.query;
  
    let query = {};
  
    if (category) {
      query.category = { $in: [category] };
    }
  
    if (size || color || minPrice || maxPrice) {
      query.variants = { $elemMatch: {} };
  
      if (size) query.variants.$elemMatch.size = size;
      if (color) query.variants.$elemMatch.color = color;
      if (minPrice) query.variants.$elemMatch.price = { ...query.variants.$elemMatch.price, $gte: parseFloat(minPrice) };
      if (maxPrice) query.variants.$elemMatch.price = { ...query.variants.$elemMatch.price, $lte: parseFloat(maxPrice) };
    }
  
    if (search) {
      query.title = { $regex: search, $options: 'i' }; // Case-insensitive search
    }

    if (q) {
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { category: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }
  
    let sortOption = {};
    if (sort === 'asc') sortOption.createdAt = 1;
    else if (sort === 'desc') sortOption.createdAt = -1;
    else if (sort === 'priceasc') sortOption['variants[0].price'] = 1;
    else if (sort === 'pricedesc') sortOption['variants[0].price'] = -1;
    
  
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = pageNum && limitNum ? (pageNum - 1) * limitNum : 0;
  
    try {
      let queryChain = Product.find(query);
  
      // Apply sorting
      if (sortOption && Object.keys(sortOption).length > 0) {
        queryChain = queryChain.sort(sortOption);
      }
  
      // Apply pagination if both page and limit are given
      if (pageNum && limitNum) {
        queryChain = queryChain.skip(skip).limit(limitNum);
      }
  
      const products = await queryChain.lean();
  
      // Filter variants manually to return only matched ones if needed
      const filteredProducts = products.map((product) => {
        if (size || color) {
          const filteredVariants = product.variants.filter((variant) => {
            return (
              (!size || variant.size === size) &&
              (!color || variant.color === color)
            );
          });
          return { ...product, variants: filteredVariants };
        }
        return product;
      });
  
      res.status(200).json(filteredProducts);
    } catch (err) {
      res.status(500).json(err);
    }
  });

router.get('/stats',verifyjwtandadmin,async (req,res)=>{
    const date=new Date();
    const lastYear=date.setFullYear(date.setFullYear()-1);
    try{
        const data=await Product.aggregate([
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
});


router.get('/productreviews/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        const reviews = Review.find({ productId: req.params.id });
        if (!reviews) {
            return res.status(404).json({ message: 'No reviews found for this product' });
        }
        res.status(200).json((await reviews).map(review => ({
            _id: review._id,
            userId: review.userId,
            userName: review.userName,
            productId: review.productId,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt,
            updatedAt: review.updatedAt
        })));
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});


export default router;