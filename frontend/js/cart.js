// Cart Management System
// Handles adding products to cart, managing quantities, and displaying cart dropdown

// Cart storage key for localStorage
const CART_STORAGE_KEY = 'nameit_cart';

// Initialize cart on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeCart();
  updateCartIcon();
  setupCartIconClick();
});

/**
 * Initializes the cart system
 */
function initializeCart() {
  // Ensure cart exists in localStorage
  if (!localStorage.getItem(CART_STORAGE_KEY)) {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([]));
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Gets the current cart from localStorage
 * @returns {Array} Array of cart items
 */
function getCart() {
  try {
    const cart = localStorage.getItem(CART_STORAGE_KEY);
    return cart ? JSON.parse(cart) : [];
  } catch (error) {
    console.error('Error reading cart from localStorage:', error);
    return [];
  }
}

/**
 * Saves the cart to localStorage
 * @param {Array} cart - Array of cart items
 */
function saveCart(cart) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (error) {
    console.error('Error saving cart to localStorage:', error);
  }
}

/**
 * Adds a product to the cart or increases its quantity if already in cart
 * @param {Object} product - Product object with id, title/name, price, imageUrl
 * @returns {boolean} True if product was added, false otherwise
 */
function addToCart(product) {
  if (!product || !product.id) {
    console.error('Invalid product:', product);
    return false;
  }

  const cart = getCart();
  const productId = product.id;
  const productName = product.title || product.name || 'Product';
  const productPrice = parseFloat(product.price) || 0;
  const productImage = product.imageUrl || 'https://via.placeholder.com/400?text=No+Image';

  // Check if product already exists in cart
  const existingItemIndex = cart.findIndex(item => item.id === productId);

  if (existingItemIndex !== -1) {
    // Product already in cart, increase quantity
    cart[existingItemIndex].quantity += 1;
  } else {
    // New product, add to cart
    cart.push({
      id: productId,
      name: productName,
      price: productPrice,
      imageUrl: productImage,
      quantity: 1
    });
  }

  saveCart(cart);
  updateCartIcon();
  
  // Show toast notification instead of alert
  const isNewItem = existingItemIndex === -1;
  const message = isNewItem 
    ? `${productName} added to cart!` 
    : `${productName} quantity updated!`;
  showCartNotification(message, 'success');
  
  // Update dropdown if it's open
  const dropdown = document.getElementById('cart-dropdown');
  if (dropdown) {
    renderCartDropdown();
  }
  
  return true;
}

/**
 * Removes a product from the cart
 * @param {string} productId - Product ID to remove
 */
function removeFromCart(productId) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  const filteredCart = cart.filter(item => item.id !== productId);
  saveCart(filteredCart);
  updateCartIcon();
  renderCartDropdown();
  
  if (item) {
    showCartNotification(`${item.name} removed from cart`, 'info');
  }
}

/**
 * Updates the quantity of a product in the cart
 * @param {string} productId - Product ID
 * @param {number} quantity - New quantity (must be > 0)
 */
function updateCartQuantity(productId, quantity) {
  if (quantity <= 0) {
    const cart = getCart();
    const item = cart.find(i => i.id === productId);
    if (item) {
      showCartNotification(`${item.name} removed from cart`, 'info');
    }
    removeFromCart(productId);
    return;
  }

  const cart = getCart();
  const itemIndex = cart.findIndex(item => item.id === productId);
  
  if (itemIndex !== -1) {
    cart[itemIndex].quantity = quantity;
    saveCart(cart);
    updateCartIcon();
    renderCartDropdown();
  }
}

/**
 * Gets the total number of items in the cart
 * @returns {number} Total quantity of all items
 */
function getCartItemCount() {
  const cart = getCart();
  return cart.reduce((total, item) => total + item.quantity, 0);
}

/**
 * Gets the total price of all items in the cart
 * @returns {number} Total price
 */
function getCartTotal() {
  const cart = getCart();
  return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

/**
 * Updates the cart icon badge with item count
 */
function updateCartIcon() {
  const cartCount = getCartItemCount();
  
  // Find all cart icons/links on the page
  const cartIcons = document.querySelectorAll('.cart-link, .header-link[href*="cart"], [data-cart-icon]');
  
  cartIcons.forEach(cartIcon => {
    // Remove existing badge
    const existingBadge = cartIcon.querySelector('.cart-badge');
    if (existingBadge) {
      existingBadge.remove();
    }

    // Add badge if there are items in cart
    if (cartCount > 0) {
      const badge = document.createElement('span');
      badge.className = 'cart-badge';
      badge.textContent = cartCount > 99 ? '99+' : cartCount;
      cartIcon.appendChild(badge);
    }
  });
}

/**
 * Sets up click handler for cart icon to show dropdown
 */
function setupCartIconClick() {
  const cartIcons = document.querySelectorAll('.cart-link, .header-link[href*="cart"], [data-cart-icon]');
  
  cartIcons.forEach(cartIcon => {
    // Prevent default navigation
    cartIcon.addEventListener('click', (e) => {
      e.preventDefault();
      toggleCartDropdown(cartIcon);
    });
  });
}

/**
 * Toggles the cart dropdown visibility
 * @param {HTMLElement} cartIcon - The cart icon element that was clicked
 */
function toggleCartDropdown(cartIcon) {
  // Remove existing dropdown if any
  const existingDropdown = document.getElementById('cart-dropdown');
  if (existingDropdown) {
    existingDropdown.remove();
    return;
  }

  // Create and show dropdown
  const dropdown = createCartDropdown(cartIcon);
  document.body.appendChild(dropdown);
  renderCartDropdown();

  // Close dropdown when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closeDropdown(e) {
      if (!dropdown.contains(e.target) && !cartIcon.contains(e.target)) {
        dropdown.remove();
        document.removeEventListener('click', closeDropdown);
      }
    });
  }, 100);
}

/**
 * Creates the cart dropdown element
 * @param {HTMLElement} cartIcon - The cart icon element
 * @returns {HTMLElement} Dropdown element
 */
function createCartDropdown(cartIcon) {
  const dropdown = document.createElement('div');
  dropdown.id = 'cart-dropdown';
  dropdown.className = 'cart-dropdown';
  
  // Position dropdown relative to cart icon (Uber Eats style - top right)
  const rect = cartIcon.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.top = `${rect.bottom + 10}px`;
  
  // Position on the right side of the screen, aligned with cart icon
  const rightPosition = window.innerWidth - rect.right;
  dropdown.style.right = `${Math.max(20, rightPosition)}px`;
  dropdown.style.zIndex = '10000';

  dropdown.innerHTML = `
    <div class="cart-dropdown-header">
      <h3>Shopping Cart</h3>
      <button class="cart-dropdown-close" id="cartDropdownClose">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="cart-dropdown-items" id="cartDropdownItems">
      <!-- Cart items will be rendered here -->
    </div>
    <div class="cart-dropdown-footer">
      <div class="cart-dropdown-total">
        <strong>Total: ₦<span id="cartDropdownTotal">0.00</span></strong>
      </div>
      <button class="cart-dropdown-checkout" id="cartDropdownCheckout" disabled>
        Checkout
      </button>
    </div>
  `;

  // Close button handler
  const closeBtn = dropdown.querySelector('#cartDropdownClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      dropdown.remove();
    });
  }

  // Checkout button handler
  const checkoutBtn = dropdown.querySelector('#cartDropdownCheckout');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      // Check which page we're on
      const currentPath = window.location.pathname;
      const currentPage = currentPath.split('/').pop() || 'index.html';
      
      // Check if we're on index.html, collection.html, or root page
      const isIndexPage = currentPage === 'index.html' || currentPage === '' || currentPath.endsWith('/');
      const isCollectionPage = currentPage === 'collection.html';
      const isUserDashboard = currentPath.includes('user-dashboard.html');
      
      // Close dropdown before redirecting
      dropdown.remove();
      
      // Redirect based on page
      if (isIndexPage || isCollectionPage) {
        // Redirect to login page for index.html and collection.html
        window.location.href = './login.html';
      } else if (isUserDashboard) {
        // Redirect to cart page for user-dashboard.html
        window.location.href = '../cart.html';
      } else {
        // Default fallback - redirect to cart page
        window.location.href = './cart.html';
      }
    });
  }

  return dropdown;
}

/**
 * Renders cart items in the dropdown
 */
function renderCartDropdown() {
  const itemsContainer = document.getElementById('cartDropdownItems');
  const totalElement = document.getElementById('cartDropdownTotal');
  const checkoutBtn = document.getElementById('cartDropdownCheckout');

  if (!itemsContainer) return;

  const cart = getCart();
  itemsContainer.innerHTML = '';

  if (cart.length === 0) {
    itemsContainer.innerHTML = `
      <div class="cart-dropdown-empty">
        <i class="fas fa-shopping-cart"></i>
        <p>Your cart is empty</p>
      </div>
    `;
    if (totalElement) totalElement.textContent = '0.00';
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  // Render each cart item
  cart.forEach(item => {
    const itemElement = createCartDropdownItem(item);
    itemsContainer.appendChild(itemElement);
  });

  // Update total
  const total = getCartTotal();
  if (totalElement) totalElement.textContent = total.toFixed(2);
  if (checkoutBtn) checkoutBtn.disabled = false;
}

/**
 * Creates a cart item element for the dropdown
 * @param {Object} item - Cart item object
 * @returns {HTMLElement} Cart item element
 */
function createCartDropdownItem(item) {
  const itemDiv = document.createElement('div');
  itemDiv.className = 'cart-dropdown-item';
  itemDiv.setAttribute('data-product-id', item.id);

  const safeName = escapeHtml(item.name);
  const safeImage = escapeHtml(item.imageUrl);
  itemDiv.innerHTML = `
    <img src="${safeImage}" alt="${safeName}" class="cart-dropdown-item-image" onerror="this.src='https://via.placeholder.com/60?text=No+Image'">
    <div class="cart-dropdown-item-info">
      <h4 class="cart-dropdown-item-name">${safeName}</h4>
      <p class="cart-dropdown-item-price">₦${item.price.toFixed(2)}</p>
      <p class="cart-dropdown-item-subtotal">Subtotal: ₦${(item.price * item.quantity).toFixed(2)}</p>
    </div>
    <div class="cart-dropdown-item-controls">
      <button class="cart-quantity-btn cart-quantity-decrease" data-product-id="${item.id}" aria-label="Decrease quantity">
        <i class="fas fa-minus"></i>
      </button>
      <span class="cart-quantity-display">${item.quantity}</span>
      <button class="cart-quantity-btn cart-quantity-increase" data-product-id="${item.id}" aria-label="Increase quantity">
        <i class="fas fa-plus"></i>
      </button>
    </div>
  `;

  // Add event listeners for quantity controls
  const decreaseBtn = itemDiv.querySelector('.cart-quantity-decrease');
  const increaseBtn = itemDiv.querySelector('.cart-quantity-increase');

  decreaseBtn.addEventListener('click', () => {
    const cart = getCart();
    const cartItem = cart.find(i => i.id === item.id);
    if (cartItem) {
      updateCartQuantity(item.id, cartItem.quantity - 1);
    }
  });

  increaseBtn.addEventListener('click', () => {
    const cart = getCart();
    const cartItem = cart.find(i => i.id === item.id);
    if (cartItem) {
      updateCartQuantity(item.id, cartItem.quantity + 1);
    }
  });

  return itemDiv;
}

/**
 * Shows a toast notification (replaces alert boxes)
 * @param {string} message - Notification message
 * @param {string} type - Notification type: 'success', 'error', 'info'
 */
function showCartNotification(message, type = 'success') {
  // Remove existing notification if any
  const existingNotification = document.getElementById('cart-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  const notification = document.createElement('div');
  notification.id = 'cart-notification';
  notification.className = `cart-notification cart-notification-${type}`;
  
  // Add icon based on type
  const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
  notification.innerHTML = `
    <i class="fas ${icon}"></i>
    <span>${escapeHtml(message)}</span>
  `;
  
  document.body.appendChild(notification);

  // Show notification with animation
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  // Hide notification after 3 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, 3000);
}

/**
 * Clears the entire cart
 */
function clearCart() {
  saveCart([]);
  updateCartIcon();
  const dropdown = document.getElementById('cart-dropdown');
  if (dropdown) {
    renderCartDropdown();
  }
}

/**
 * Renders the cart page (cart.html)
 */
function renderCartPage() {
  const emptyMessage = document.getElementById('empty-cart-message');
  const itemsList = document.getElementById('cart-items-list');
  const cartSummary = document.getElementById('cart-summary');

  if (!emptyMessage || !itemsList || !cartSummary) {
    return; // Not on cart page
  }

  const cart = getCart();

  if (cart.length === 0) {
    // Show empty cart message
    emptyMessage.style.display = 'block';
    itemsList.style.display = 'none';
    cartSummary.style.display = 'none';
    return;
  }

  // Hide empty message, show items and summary
  emptyMessage.style.display = 'none';
  itemsList.style.display = 'block';
  cartSummary.style.display = 'block';

  // Clear existing items
  itemsList.innerHTML = '';

  // Render each cart item
  cart.forEach(item => {
    const itemElement = createCartPageItem(item);
    itemsList.appendChild(itemElement);
  });

  // Render cart summary
  renderCartSummary(cart);
}

/**
 * Creates a cart item element for the cart page
 * @param {Object} item - Cart item object
 * @returns {HTMLElement} Cart item element
 */
function createCartPageItem(item) {
  const itemDiv = document.createElement('div');
  itemDiv.className = 'cart-page-item';
  itemDiv.setAttribute('data-product-id', item.id);

  const safeName = escapeHtml(item.name);
  const safeImage = escapeHtml(item.imageUrl);
  itemDiv.innerHTML = `
    <div class="cart-page-item-image">
      <img src="${safeImage}" alt="${safeName}" onerror="this.src='https://via.placeholder.com/120?text=No+Image'">
    </div>
    <div class="cart-page-item-info">
      <h3 class="cart-page-item-name">${safeName}</h3>
      <p class="cart-page-item-price">₦${item.price.toFixed(2)} each</p>
    </div>
    <div class="cart-page-item-controls">
      <button class="cart-quantity-btn cart-quantity-decrease" data-product-id="${item.id}" aria-label="Decrease quantity">
        <i class="fas fa-minus"></i>
      </button>
      <span class="cart-quantity-display">${item.quantity}</span>
      <button class="cart-quantity-btn cart-quantity-increase" data-product-id="${item.id}" aria-label="Increase quantity">
        <i class="fas fa-plus"></i>
      </button>
    </div>
    <div class="cart-page-item-subtotal">
      <strong>₦${(item.price * item.quantity).toFixed(2)}</strong>
    </div>
    <button class="cart-page-item-remove" data-product-id="${item.id}" aria-label="Remove item">
      <i class="fas fa-trash"></i>
    </button>
  `;

  // Add event listeners
  const decreaseBtn = itemDiv.querySelector('.cart-quantity-decrease');
  const increaseBtn = itemDiv.querySelector('.cart-quantity-increase');
  const removeBtn = itemDiv.querySelector('.cart-page-item-remove');

  decreaseBtn.addEventListener('click', () => {
    const cart = getCart();
    const cartItem = cart.find(i => i.id === item.id);
    if (cartItem) {
      updateCartQuantity(item.id, cartItem.quantity - 1);
      renderCartPage(); // Re-render the page
    }
  });

  increaseBtn.addEventListener('click', () => {
    const cart = getCart();
    const cartItem = cart.find(i => i.id === item.id);
    if (cartItem) {
      updateCartQuantity(item.id, cartItem.quantity + 1);
      renderCartPage(); // Re-render the page
    }
  });

  removeBtn.addEventListener('click', () => {
    removeFromCart(item.id);
    renderCartPage(); // Re-render the page
  });

  return itemDiv;
}

/**
 * Renders the cart summary with total and checkout button
 * @param {Array} cart - Cart items array
 */
function renderCartSummary(cart) {
  const cartSummary = document.getElementById('cart-summary');
  if (!cartSummary) return;

  const subtotal = getCartTotal();
  const tax = subtotal * 0.1; // 10% tax (adjust as needed)
  const total = subtotal + tax;

  cartSummary.innerHTML = `
    <div class="cart-summary-content">
      <div class="cart-summary-row">
        <span>Subtotal</span>
        <span>₦${subtotal.toFixed(2)}</span>
      </div>
      <div class="cart-summary-row">
        <span>Tax</span>
        <span>₦${tax.toFixed(2)}</span>
      </div>
      <div class="cart-summary-row cart-summary-total">
        <span>Total</span>
        <span>₦${total.toFixed(2)}</span>
      </div>
      <button class="cart-checkout-btn" id="cartPageCheckout">
        CHECKOUT
      </button>
    </div>
  `;

  // Add checkout button handler
  const checkoutBtn = document.getElementById('cartPageCheckout');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      // Redirect to payment/checkout page
      window.location.href = './dashboard-files/payment.html';
    });
  }
}

// Export functions to global scope for use in other scripts
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateCartQuantity = updateCartQuantity;
window.getCart = getCart;
window.getCartItemCount = getCartItemCount;
window.getCartTotal = getCartTotal;
window.clearCart = clearCart;
window.showCartNotification = showCartNotification;
window.renderCartPage = renderCartPage;

