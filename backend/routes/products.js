/**
 * Products Routes
 * Handles product-related API endpoints
 */

const express = require('express');
const router = express.Router();
const productsService = require('../services/productsService');
const { safeErrorLog } = require('../middleware/security');

/**
 * GET /api/products
 * Get products with optional filters
 * Query params: popular, status, category, limit, offset
 */
router.get('/', async (req, res) => {
  try {
    const { popular, status, category, limit, offset } = req.query;

    const filters = {};
    if (popular !== undefined) {
      filters.popular = popular === 'true';
    }
    if (status) {
      filters.status = status;
    }
    if (category) {
      filters.category = category;
    }

    const limitNum = limit ? parseInt(limit, 10) : null;
    const offsetNum = offset ? parseInt(offset, 10) : 0;

    const products = await productsService.getProducts(filters, limitNum, offsetNum);

    res.json({
      products,
      count: products.length,
    });
  } catch (error) {
    safeErrorLog('products.list', req, error);
    res.status(500).json({
      error: 'Failed to fetch products',
      message: 'Unable to fetch products at the moment.',
    });
  }
});

/**
 * GET /api/products/popular
 * Get popular products
 */
router.get('/popular', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    const products = await productsService.getPopularProducts(limit);

    res.json({
      products,
      count: products.length,
    });
  } catch (error) {
    safeErrorLog('products.popular', req, error);
    res.status(500).json({
      error: 'Failed to fetch popular products',
      message: 'Unable to fetch popular products at the moment.',
    });
  }
});

/**
 * GET /api/products/category/:category
 * Get products by category
 */
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;

    const products = await productsService.getProductsByCategory(category, limit);

    res.json({
      products,
      count: products.length,
      category,
    });
  } catch (error) {
    safeErrorLog('products.category', req, error);
    res.status(500).json({
      error: 'Failed to fetch products',
      message: 'Unable to fetch products at the moment.',
    });
  }
});

/**
 * GET /api/products/:id
 * Get single product by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await productsService.getProductById(id);

    res.json({ product });
  } catch (error) {
    if (error.message === 'Product not found') {
      return res.status(404).json({
        error: 'Product not found',
        message: 'Product not found',
      });
    }

    safeErrorLog('products.get', req, error);
    res.status(500).json({
      error: 'Failed to fetch product',
      message: 'Unable to fetch product at the moment.',
    });
  }
});

module.exports = router;
