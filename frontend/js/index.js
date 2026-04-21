// Fetch and display popular products from backend API
// This script loads popular products and replaces the static product cards in the Popular Products section

// Wait for DOM and API client to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for API client to initialize
  setTimeout(() => {
    loadPopularProducts();
    loadNewProducts();
    loadGalleryFeatures();
    initBrandsCarousel();
  }, 500);
});

/**
 * Fetches popular products from backend API and displays them
 */
async function loadPopularProducts() {
  try {
    if (!window.apiClient) {
      console.error('API client is not available');
      return;
    }

    // Fetch popular products from backend API
    const response = await window.apiClient.getPopularProducts(4);
    const products = response.products || [];

    if (products.length === 0) {
      console.log('No popular products found');
      return;
    }

    // Get the products row container
    const productsRow = document.querySelector('#products .products-row');
    
    if (!productsRow) {
      console.error('Products row container not found');
      return;
    }

    // Clear existing product cards
    productsRow.innerHTML = '';

    // Create product cards for each product
    products.forEach((product) => {
      const productCard = createProductCard(product);
      productsRow.appendChild(productCard);
    });

    console.log('Popular products loaded successfully');
  } catch (error) {
    console.error('Error loading popular products:', error);
  }
}

/**
 * Creates a product card HTML element
 * @param {Object} product - Product data from Firestore
 * @returns {HTMLElement} Product card element
 */
function createProductCard(product) {
  // Get product name (check both 'title' and 'name' fields - some databases use 'name')
  const productName = product.title || product.name || 'Untitled Product';
  
  // Create product card container
  const productCard = document.createElement('div');
  productCard.className = 'product-card';

  // Create product image container
  const productImageContainer = document.createElement('div');
  productImageContainer.className = 'product-image-container';

  // Create product image
  const productImage = document.createElement('img');
  productImage.src = product.imageUrl || 'https://via.placeholder.com/400?text=No+Image';
  productImage.alt = productName;
  productImage.onerror = function() {
    // Fallback image if the URL fails to load
    this.src = 'https://via.placeholder.com/400?text=Image+Not+Found';
  };

  // Add wishlist heart button
  const wishlistBtn = document.createElement('button');
  wishlistBtn.className = 'wishlist-btn';
  wishlistBtn.setAttribute('data-product-id', product.id);
  wishlistBtn.setAttribute('aria-label', `Add ${productName} to wishlist`);
  wishlistBtn.innerHTML = '<i class="far fa-heart"></i>';
  
  // Check if product is in wishlist
  checkWishlistStatus(wishlistBtn, product.id);
  
  // Add click event for wishlist toggle
  wishlistBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleProductWishlist(wishlistBtn, product);
  });

  productImageContainer.appendChild(wishlistBtn);
  productImageContainer.appendChild(productImage);

  // Create product info container
  const productInfo = document.createElement('div');
  productInfo.className = 'product-info';

  // Create product title/name
  const productTitle = document.createElement('div');
  productTitle.className = 'product-title';
  productTitle.textContent = productName;

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
  addCartButton.addEventListener('click', () => {
    // Use global cart function from cart.js
    if (window.addToCart) {
      window.addToCart(product);
    } else {
      console.error('Cart system not loaded');
    }
  });

  // Assemble the product card
  productBottom.appendChild(productPrice);
  productBottom.appendChild(addCartButton);
  productInfo.appendChild(productTitle);
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
async function checkWishlistStatus(btn, productId) {
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
async function toggleProductWishlist(btn, product) {
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
 * Fetches and displays new products (3 most recent perfume + 3 most recent clothes)
 * with carousel functionality showing 4 at a time
 */
async function loadNewProducts() {
  try {
    if (!window.apiClient) {
      console.error('API client is not available');
      return;
    }

    // Fetch 3 most recent perfume products from backend API
    let perfumeProducts = [];
    try {
      const perfumeResponse = await window.apiClient.getProductsByCategory('perfume', 3);
      perfumeProducts = perfumeResponse.products || [];
    } catch (error) {
      console.error('Error fetching perfume products:', error);
    }

    // Fetch 3 most recent clothes products from backend API
    let clothesProducts = [];
    try {
      const clothesResponse = await window.apiClient.getProductsByCategory('clothes', 3);
      clothesProducts = clothesResponse.products || [];
    } catch (error) {
      console.error('Error fetching clothes products:', error);
    }

    // Combine products (perfume first, then clothes)
    const allNewProducts = [...perfumeProducts, ...clothesProducts];

    if (allNewProducts.length === 0) {
      console.log('No new products found');
      return;
    }

    // Get the carousel container
    const carouselWrapper = document.getElementById('newProductsCarousel');
    
    if (!carouselWrapper) {
      console.error('New products carousel container not found');
      return;
    }

    // Clear existing product cards
    carouselWrapper.innerHTML = '';

    // For continuous carousel, duplicate products at the beginning and end
    // This allows seamless looping
    const duplicatedProducts = [...allNewProducts, ...allNewProducts, ...allNewProducts];

    // Create product cards for each product
    duplicatedProducts.forEach((product, index) => {
      const productCard = createProductCard(product);
      productCard.setAttribute('data-carousel-index', index);
      carouselWrapper.appendChild(productCard);
    });

    // Initialize carousel with total products count
    initNewProductsCarousel(allNewProducts.length, duplicatedProducts.length);

    console.log('New products loaded successfully');
  } catch (error) {
    console.error('Error loading new products:', error);
  }
}

/**
 * Initializes the carousel for new products with continuous looping
 * @param {number} uniqueProducts - Number of unique products (for indicators)
 * @param {number} totalProducts - Total number of products (including duplicates)
 */
function initNewProductsCarousel(uniqueProducts, totalProducts) {
  const carouselWrapper = document.getElementById('newProductsCarousel');
  const prevBtn = document.getElementById('newProductsPrev');
  const nextBtn = document.getElementById('newProductsNext');
  const indicators = document.getElementById('newProductsIndicators');

  if (!carouselWrapper || !prevBtn || !nextBtn) {
    return;
  }

  const productsPerView = 4;
  const totalSlides = Math.ceil(uniqueProducts / productsPerView);
  
  // Start at the middle set of products (the first duplicate set)
  // This allows seamless scrolling in both directions
  let currentSlide = totalSlides; // Start at the middle set

  // Create indicators (only for unique products, not duplicates)
  if (indicators && totalSlides > 1) {
    indicators.innerHTML = '';
    for (let i = 0; i < totalSlides; i++) {
      const indicator = document.createElement('button');
      indicator.className = 'carousel-indicator';
      if (i === 0) indicator.classList.add('active');
      indicator.setAttribute('aria-label', `Go to slide ${i + 1}`);
      indicator.addEventListener('click', () => goToSlide(i + totalSlides)); // Add offset to account for duplicates
      indicators.appendChild(indicator);
    }
  }

  // Function to update carousel position
  function updateCarousel(resetPosition = false) {
    // Calculate slide width: container width divided by products per view
    // With flexbox gap, we need to account for the gap between cards
    const container = carouselWrapper.parentElement;
    const containerWidth = container.offsetWidth;
    const gap = 32; // Gap between cards (matches CSS)
    // Calculate: (container width + total gaps) / productsPerView * productsPerView
    // Simplified: container width + gaps for the visible products
    const cardWidth = (containerWidth - (gap * (productsPerView - 1))) / productsPerView;
    const slideWidth = cardWidth * productsPerView + (gap * (productsPerView - 1));
    
    if (resetPosition) {
      // Reset position without animation for seamless loop
      carouselWrapper.style.transition = 'none';
      const translateX = -(currentSlide * slideWidth);
      carouselWrapper.style.transform = `translateX(${translateX}px)`;
      // Re-enable transition after reset
      setTimeout(() => {
        carouselWrapper.style.transition = 'transform 0.5s ease-in-out';
      }, 50);
    } else {
      const translateX = -(currentSlide * slideWidth);
      carouselWrapper.style.transform = `translateX(${translateX}px)`;
    }
    
    // Update indicators (map current slide to unique product range)
    if (indicators) {
      const indicatorButtons = indicators.querySelectorAll('.carousel-indicator');
      // Calculate which unique slide we're on (modulo operation)
      const uniqueSlideIndex = currentSlide % totalSlides;
      indicatorButtons.forEach((btn, index) => {
        btn.classList.toggle('active', index === uniqueSlideIndex);
      });
    }

    // Buttons are never disabled in continuous carousel
    prevBtn.disabled = false;
    nextBtn.disabled = false;
  }

  // Function to go to specific slide
  function goToSlide(slideIndex) {
    currentSlide = slideIndex;
    updateCarousel();
  }

  // Previous button handler - continuous loop
  prevBtn.addEventListener('click', () => {
    currentSlide--;
    
    // If we've gone before the middle set, jump to the end of the second set
    if (currentSlide < totalSlides) {
      currentSlide = totalSlides * 2 - 1;
      updateCarousel(true); // Reset position without animation
    } else {
      updateCarousel();
    }
  });

  // Next button handler - continuous loop
  nextBtn.addEventListener('click', () => {
    currentSlide++;
    
    // If we've gone past the second set, jump back to the start of the middle set
    if (currentSlide >= totalSlides * 2) {
      currentSlide = totalSlides;
      updateCarousel(true); // Reset position without animation
    } else {
      updateCarousel();
    }
  });

  // Auto-rotate carousel - continuous loop with pause on hover
  let autoRotateInterval;
  let isPaused = false;
  
  function startAutoRotate() {
    // Clear any existing interval
    if (autoRotateInterval) {
      clearInterval(autoRotateInterval);
    }
    
    autoRotateInterval = setInterval(() => {
      if (!isPaused) {
        // Move to next slide
        currentSlide++;
        
        // If we've gone past the second set, jump back to the start of the middle set
        if (currentSlide >= totalSlides * 2) {
          currentSlide = totalSlides;
          updateCarousel(true); // Reset position without animation
        } else {
          updateCarousel();
        }
      }
    }, 6500); // Change slide every 6.5 seconds
  }
  
  function stopAutoRotate() {
    if (autoRotateInterval) {
      clearInterval(autoRotateInterval);
      autoRotateInterval = null;
    }
  }
  
  function pauseAutoRotate() {
    isPaused = true;
  }
  
  function resumeAutoRotate() {
    isPaused = false;
  }
  
  // Hide control arrows
  prevBtn.style.display = 'none';
  nextBtn.style.display = 'none';
  
  // Start auto-rotation
  startAutoRotate();
  
  // Pause on hover - attach to carousel wrapper and container
  const carouselContainer = carouselWrapper.closest('.carousel-container');
  
  // Pause when mouse enters carousel area
  function handleMouseEnter() {
    pauseAutoRotate();
  }
  
  // Resume when mouse leaves carousel area
  function handleMouseLeave() {
    resumeAutoRotate();
  }
  
  if (carouselContainer) {
    carouselContainer.addEventListener('mouseenter', handleMouseEnter);
    carouselContainer.addEventListener('mouseleave', handleMouseLeave);
  }
  
  // Also attach to carousel wrapper itself
  carouselWrapper.addEventListener('mouseenter', handleMouseEnter);
  carouselWrapper.addEventListener('mouseleave', handleMouseLeave);
  
  // Pause when hovering over indicators
  if (indicators) {
    indicators.addEventListener('mouseenter', handleMouseEnter);
    indicators.addEventListener('mouseleave', handleMouseLeave);
  }

  // Initialize carousel at the middle set
  updateCarousel();
  
  // Handle window resize to recalculate positions
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      updateCarousel(true);
    }, 250);
  });
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    stopAutoRotate();
  });
}

/**
 * Loads gallery feature section with popular products carousel, last perfume, and last clothing products
 */
async function loadGalleryFeatures() {
  try {
    if (!window.apiClient) {
      console.error('API client is not available');
      return;
    }

    // Fetch popular products for carousel (get multiple, not just one)
    let popularProducts = [];
    try {
      const popularResponse = await window.apiClient.getPopularProducts(10);
      popularProducts = popularResponse.products || [];
    } catch (error) {
      console.error('Error fetching popular products:', error);
    }

    // Initialize popular products carousel if we have products
    if (popularProducts.length > 0) {
      initGalleryPopularCarousel(popularProducts);
    }

    // Fetch last perfume product
    let lastPerfumeProduct = null;
    try {
      const perfumeResponse = await window.apiClient.getProductsByCategory('perfume', 1);
      if (perfumeResponse.products && perfumeResponse.products.length > 0) {
        lastPerfumeProduct = perfumeResponse.products[0];
      }
    } catch (error) {
      console.error('Error fetching last perfume product:', error);
    }

    // Fetch last clothing product
    let lastClothingProduct = null;
    try {
      const clothingResponse = await window.apiClient.getProductsByCategory('clothes', 1);
      if (clothingResponse.products && clothingResponse.products.length > 0) {
        lastClothingProduct = clothingResponse.products[0];
      }
    } catch (error) {
      console.error('Error fetching last clothing product:', error);
    }

    // Update gallery feature small (last perfume product)
    if (lastPerfumeProduct) {
      updateGalleryFeature('galleryPerfume', lastPerfumeProduct);
    }

    // Update gallery feature small (last clothing product)
    if (lastClothingProduct) {
      updateGalleryFeature('galleryClothing', lastClothingProduct);
    }

    console.log('Gallery features loaded successfully');
  } catch (error) {
    console.error('Error loading gallery features:', error);
  }
}

/**
 * Initializes the popular products carousel in the gallery feature large section
 * @param {Array} products - Array of popular products
 */
function initGalleryPopularCarousel(products) {
  const carouselWrapper = document.getElementById('galleryPopularCarousel');
  if (!carouselWrapper) {
    console.error('Gallery popular carousel wrapper not found');
    return;
  }

  // Clear existing content
  carouselWrapper.innerHTML = '';

  // If no products, return
  if (products.length === 0) {
    return;
  }

  // For continuous carousel, duplicate products
  const duplicatedProducts = [...products, ...products, ...products];

  // Create image elements for each product
  duplicatedProducts.forEach((product) => {
    const productName = product.title || product.name || 'Product';
    const img = document.createElement('img');
    img.src = product.imageUrl || 'https://via.placeholder.com/600?text=No+Image';
    img.alt = productName;
    img.setAttribute('data-product-id', product.id);
    img.onerror = function() {
      this.src = 'https://via.placeholder.com/600?text=Image+Not+Found';
    };
    carouselWrapper.appendChild(img);
  });

  // Initialize carousel animation
  let currentIndex = products.length; // Start at middle set
  const totalProducts = duplicatedProducts.length;
  let isPaused = false;
  let carouselInterval;

  function updateCarousel(resetPosition = false) {
    const container = carouselWrapper.parentElement;
    const containerWidth = container.offsetWidth;
    const translateX = -(currentIndex * containerWidth);

    if (resetPosition) {
      carouselWrapper.style.transition = 'none';
      carouselWrapper.style.transform = `translateX(${translateX}px)`;
      setTimeout(() => {
        carouselWrapper.style.transition = 'transform 0.8s ease-in-out';
      }, 50);
    } else {
      carouselWrapper.style.transform = `translateX(${translateX}px)`;
    }
  }
  
  // Handle window resize to recalculate image widths
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const container = carouselWrapper.parentElement;
      const containerWidth = container.offsetWidth;
      const images = carouselWrapper.querySelectorAll('img');
      images.forEach(img => {
        img.style.width = `${containerWidth}px`;
      });
      carouselWrapper.style.width = `${containerWidth * totalProducts}px`;
      updateCarousel(true);
    }, 250);
  });

  function startCarousel() {
    if (carouselInterval) {
      clearInterval(carouselInterval);
    }

    carouselInterval = setInterval(() => {
      if (!isPaused) {
        currentIndex++;
        
        // If we've gone past the second set, jump back to start of middle set
        if (currentIndex >= products.length * 2) {
          currentIndex = products.length;
          updateCarousel(true);
        } else {
          updateCarousel();
        }
      }
    }, 4000); // Change image every 4 seconds
  }

  function pauseCarousel() {
    isPaused = true;
  }

  function resumeCarousel() {
    isPaused = false;
  }

  // Set initial styles
  carouselWrapper.style.display = 'flex';
  carouselWrapper.style.transition = 'transform 0.8s ease-in-out';
  
  // Set each image to take full container width
  const images = carouselWrapper.querySelectorAll('img');
  const container = carouselWrapper.parentElement;
  const containerWidth = container.offsetWidth;
  
  images.forEach(img => {
    img.style.width = `${containerWidth}px`;
    img.style.flexShrink = '0';
    img.style.objectFit = 'cover';
    img.style.height = '100%';
  });
  
  // Set wrapper width to accommodate all images
  carouselWrapper.style.width = `${containerWidth * totalProducts}px`;

  // Start carousel
  startCarousel();
  updateCarousel();

  // Pause on hover
  const galleryContainer = document.getElementById('galleryPopular');
  if (galleryContainer) {
    galleryContainer.addEventListener('mouseenter', pauseCarousel);
    galleryContainer.addEventListener('mouseleave', resumeCarousel);
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (carouselInterval) {
      clearInterval(carouselInterval);
    }
  });
}

/**
 * Updates a gallery feature element with product data
 * @param {string} elementId - ID of the gallery feature element
 * @param {Object} product - Product data from Firestore
 */
function updateGalleryFeature(elementId, product) {
  const galleryElement = document.getElementById(elementId);
  if (!galleryElement) {
    console.error(`Gallery element ${elementId} not found`);
    return;
  }

  const productName = product.title || product.name || 'Product';
  const productImage = galleryElement.querySelector('img');
  const shopButton = galleryElement.querySelector('.gallery-btn');

  // Update image
  if (productImage) {
    productImage.src = product.imageUrl || 'https://via.placeholder.com/600?text=No+Image';
    productImage.alt = productName;
    productImage.onerror = function() {
      // Fallback image if the URL fails to load
      this.src = 'https://via.placeholder.com/600?text=Image+Not+Found';
    };
  }

  // Update shop button link (you can customize this to link to product page)
  if (shopButton) {
    // Link to product detail page or collection page
    // Example: shopButton.href = `./product.html?id=${product.id}`;
    // For now, link to collection page
    shopButton.href = './collection.html';
    shopButton.setAttribute('data-product-id', product.id);
  }
}

/**
 * Initializes the brands carousel with continuous slow scrolling
 */
function initBrandsCarousel() {
  const brandsTrack = document.getElementById('brandsCarouselTrack');
  if (!brandsTrack) {
    console.error('Brands carousel track not found');
    return;
  }

  // Brand names to display
  const brands = [
    { name: 'Dior', isBold: false },
    { name: 'TOM FORD', isBold: true },
    { name: 'CHANEL', isBold: false, icon: 'fab fa-cc-visa' },
    { name: 'Calvin Klein', isBold: false },
    { name: 'CLINIQUE', isBold: false },
    { name: 'D&G', isBold: false }
  ];

  // Clear existing content
  brandsTrack.innerHTML = '';

  // Duplicate brands multiple times for seamless continuous scrolling
  const duplicatedBrands = [...brands, ...brands, ...brands, ...brands];

  // Create brand elements
  duplicatedBrands.forEach((brand) => {
    const brandSpan = document.createElement('span');
    if (brand.isBold) {
      brandSpan.className = 'brand-bold';
    }
    
    if (brand.icon) {
      const icon = document.createElement('i');
      icon.className = brand.icon;
      brandSpan.appendChild(icon);
      brandSpan.appendChild(document.createTextNode(' ' + brand.name));
    } else {
      brandSpan.textContent = brand.name;
    }
    
    brandsTrack.appendChild(brandSpan);
  });

  // Initialize continuous scrolling animation
  let scrollPosition = 0;
  let animationId;
  const scrollSpeed = 0.3; // Slower speed (pixels per frame) - slower than other carousels
  let isPaused = false;
  let singleSetWidth = 0;

  // Calculate the width of one complete set of brands
  function calculateSetWidth() {
    const brandSpans = brandsTrack.querySelectorAll('span');
    if (brandSpans.length >= brands.length) {
      // Calculate width of first set (first 6 brands)
      let width = 0;
      for (let i = 0; i < brands.length; i++) {
        if (brandSpans[i]) {
          width += brandSpans[i].offsetWidth;
          if (i < brands.length - 1) {
            width += 32; // Add gap
          }
        }
      }
      singleSetWidth = width;
    }
  }

  function animate() {
    if (!isPaused) {
      scrollPosition += scrollSpeed;
      
      // Reset position when we've scrolled one full set
      if (singleSetWidth > 0 && scrollPosition >= singleSetWidth) {
        scrollPosition = 0;
      }
      
      brandsTrack.style.transform = `translateX(-${scrollPosition}px)`;
    }
    
    animationId = requestAnimationFrame(animate);
  }

  // Calculate set width after brands are rendered
  setTimeout(() => {
    calculateSetWidth();
  }, 100);

  // Pause on hover
  const brandsRow = document.querySelector('.brands-row');
  if (brandsRow) {
    brandsRow.addEventListener('mouseenter', () => {
      isPaused = true;
    });
    
    brandsRow.addEventListener('mouseleave', () => {
      isPaused = false;
    });
  }

  // Start animation
  animate();

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  });
}

