// Collection Page - Load and display products
// Popular products appear first, then all other products sorted by most recent

// Wait for DOM and API client to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for API client to initialize
  setTimeout(() => {
    loadCollectionProducts();
  }, 500);
});

/**
 * Loads and displays all products in the collection
 * Popular products first, then all others sorted by most recent
 */
async function loadCollectionProducts() {
  try {
    if (!window.apiClient) {
      console.error('API client is not available');
      showError('API connection failed. Please refresh the page.');
      return;
    }

    // Show loading state
    showLoading(true);

    // Fetch ALL active products from backend API
    let allActiveProducts = [];
    try {
      const response = await window.apiClient.getProducts({ status: 'active' });
      allActiveProducts = response.products || [];
      
      // Sort by createdAt (most recent first) - backend should handle this, but sort here as fallback
      allActiveProducts.sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime; // Most recent first
      });
      
      console.log(`Fetched ${allActiveProducts.length} active products`);
    } catch (error) {
      console.error('Error fetching products:', error);
      showLoading(false);
      showError('Failed to load products. Please try again later.');
      return;
    }

    // Separate products into popular and non-popular
    const popularProducts = [];
    const regularProducts = [];

    allActiveProducts.forEach((product) => {
      // Check if product is popular (handle both boolean true and string "true")
      if (product.popular === true || product.popular === 'true') {
        popularProducts.push(product);
      } else {
        regularProducts.push(product);
      }
    });

    console.log(`Found ${popularProducts.length} popular products and ${regularProducts.length} regular products`);

    // Hide loading state
    showLoading(false);

    // Display popular products if we have any
    if (popularProducts.length > 0) {
      displayProducts('popularProductsGrid', popularProducts, true);
      document.getElementById('popularProductsSection').style.display = 'block';
    } else {
      document.getElementById('popularProductsSection').style.display = 'none';
    }

    // Display all other products
    if (regularProducts.length > 0) {
      displayProducts('allProductsGrid', regularProducts, false);
      document.getElementById('allProductsSection').style.display = 'block';
    } else {
      document.getElementById('allProductsSection').style.display = 'none';
    }

    // Show empty state if no products
    if (popularProducts.length === 0 && regularProducts.length === 0) {
      document.getElementById('collectionEmpty').style.display = 'block';
    } else {
      document.getElementById('collectionEmpty').style.display = 'none';
    }

    console.log('Collection products loaded successfully');
    console.log(`Total products displayed: ${popularProducts.length + regularProducts.length}`);
  } catch (error) {
    console.error('Error loading collection products:', error);
    showLoading(false);
    showError('Failed to load products. Please try again later.');
  }
}

/**
 * Displays products in a grid
 * @param {string} containerId - ID of the container element
 * @param {Array} products - Array of product objects
 * @param {boolean} isPopular - Whether these are popular products
 */
function displayProducts(containerId, products, isPopular) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container ${containerId} not found`);
    return;
  }

  // Clear existing content
  container.innerHTML = '';

  // Create product cards
  products.forEach((product) => {
    const productCard = createCollectionProductCard(product, isPopular);
    container.appendChild(productCard);
  });
}

/**
 * Creates a product card element for the collection page
 * @param {Object} product - Product data from Firestore
 * @param {boolean} isPopular - Whether this is a popular product
 * @returns {HTMLElement} Product card element
 */
function createCollectionProductCard(product, isPopular) {
  const productName = product.title || product.name || 'Untitled Product';
  
  // Create product card container
  const productCard = document.createElement('div');
  productCard.className = 'product-card';
  productCard.setAttribute('data-product-id', product.id);

  // Create product image container
  const productImageContainer = document.createElement('div');
  productImageContainer.className = 'product-image-container';

  // Add popular badge if applicable
  if (isPopular) {
    const badge = document.createElement('div');
    badge.className = 'product-badge-popular';
    badge.textContent = 'Popular';
    productImageContainer.appendChild(badge);
  }

  // Create product image
  const productImage = document.createElement('img');
  productImage.src = product.imageUrl || 'https://via.placeholder.com/400?text=No+Image';
  productImage.alt = productName;
  productImage.onerror = function() {
    this.src = 'https://via.placeholder.com/400?text=Image+Not+Found';
  };

  // Add wishlist heart button
  const wishlistBtn = document.createElement('button');
  wishlistBtn.className = 'wishlist-btn';
  wishlistBtn.setAttribute('data-product-id', product.id);
  wishlistBtn.setAttribute('aria-label', `Add ${productName} to wishlist`);
  wishlistBtn.innerHTML = '<i class="far fa-heart"></i>';
  
  // Check if product is in wishlist
  checkCollectionWishlistStatus(wishlistBtn, product.id);
  
  // Add click event for wishlist toggle
  wishlistBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCollectionWishlist(wishlistBtn, product);
  });

  productImageContainer.appendChild(wishlistBtn);
  productImageContainer.appendChild(productImage);

  // Create product info container
  const productInfo = document.createElement('div');
  productInfo.className = 'product-info';

  // Create product title
  const productTitle = document.createElement('div');
  productTitle.className = 'product-title';
  productTitle.textContent = productName;

  // Create product description
  const productDescription = document.createElement('div');
  productDescription.className = 'product-description';
  const description = product.description || product.desc || '';
  productDescription.textContent = description;

  // Create product bottom container
  const productBottom = document.createElement('div');
  productBottom.className = 'product-bottom';

  // Create product price
  const productPrice = document.createElement('span');
  productPrice.className = 'product-price';
  productPrice.textContent = `₦${product.price || '0.00'}`;

  // Create add to cart button
  const addCartButton = document.createElement('button');
  addCartButton.className = 'add-cart';
  addCartButton.innerHTML = '<i class="fas fa-shopping-cart"></i>';
  addCartButton.setAttribute('data-product-id', product.id);
  addCartButton.setAttribute('aria-label', `Add ${productName} to cart`);
  
  // Add click event listener for add to cart
  addCartButton.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent card click
    // Use global cart function from cart.js
    if (window.addToCart) {
      window.addToCart(product);
    } else {
      console.error('Cart system not loaded');
    }
  });

  // Add click event to card (for future product detail page)
  productCard.addEventListener('click', () => {
    // Navigate to product detail page
    // window.location.href = `./product-detail.html?id=${product.id}`;
    console.log('Product clicked:', product.id);
  });

  // Assemble the product card
  productBottom.appendChild(productPrice);
  productBottom.appendChild(addCartButton);
  productInfo.appendChild(productTitle);
  if (description) {
    productInfo.appendChild(productDescription);
  }
  productInfo.appendChild(productBottom);
  productCard.appendChild(productImageContainer);
  productCard.appendChild(productInfo);

  return productCard;
}

// ============================================
// WISHLIST FUNCTIONS
// ============================================

/**
 * Check wishlist status and update icon
 */
async function checkCollectionWishlistStatus(btn, productId) {
  if (!window.apiClient || !window.apiClient.isAuthenticated()) return;
  
  try {
    const response = await window.apiClient.isInWishlist(productId);
    if (response.inWishlist) {
      btn.innerHTML = '<i class="fas fa-heart"></i>';
      btn.classList.add('active');
    }
  } catch (error) {
    // Silently fail
  }
}

/**
 * Toggle wishlist for product
 */
async function toggleCollectionWishlist(btn, product) {
  if (!window.apiClient || !window.apiClient.isAuthenticated()) {
    if (window.showCartNotification) {
      window.showCartNotification('Please log in to use wishlist', 'error');
    }
    return;
  }
  
  const isActive = btn.classList.contains('active');
  const productName = product.title || product.name || 'Product';
  
  try {
    if (isActive) {
      await window.apiClient.removeFromWishlist(product.id);
      btn.innerHTML = '<i class="far fa-heart"></i>';
      btn.classList.remove('active');
      if (window.showCartNotification) {
        window.showCartNotification(`${productName} removed from wishlist`, 'info');
      }
    } else {
      await window.apiClient.addToWishlist(product.id);
      btn.innerHTML = '<i class="fas fa-heart"></i>';
      btn.classList.add('active');
      if (window.showCartNotification) {
        window.showCartNotification(`${productName} added to wishlist`, 'success');
      }
    }
  } catch (error) {
    console.error('Error toggling wishlist:', error);
    if (window.showCartNotification) {
      window.showCartNotification('Failed to update wishlist', 'error');
    }
  }
}

// Note: addToCart function is provided by cart.js via window.addToCart
// No local wrapper needed to avoid recursion issues

/**
 * Shows or hides the loading state
 * @param {boolean} show - Whether to show loading
 */
function showLoading(show) {
  const loadingElement = document.getElementById('collectionLoading');
  if (loadingElement) {
    loadingElement.style.display = show ? 'block' : 'none';
  }
}

/**
 * Shows an error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  const emptyElement = document.getElementById('collectionEmpty');
  if (emptyElement) {
    emptyElement.innerHTML = '';
    const icon = document.createElement('i');
    icon.className = 'fas fa-exclamation-triangle';
    const h3 = document.createElement('h3');
    h3.textContent = 'Error';
    const p = document.createElement('p');
    p.textContent = String(message || 'Failed to load products');
    emptyElement.appendChild(icon);
    emptyElement.appendChild(h3);
    emptyElement.appendChild(p);
    emptyElement.style.display = 'block';
  }
}

