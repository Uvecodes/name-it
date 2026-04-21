// Payment Page Functionality
// Handles payment form, order summary, and checkout process

// Configuration - Update this with your admin's WhatsApp number
const ADMIN_WHATSAPP_NUMBER = '+18629559339'; // Format: country code + number (e.g., '1234567890' for US)

// Global state for rewards
let userRewardsBalance = 0;
let pointsToRedeem = 0;

// Initialize payment page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializePaymentPage();
  setupPaymentForm();
  setupRewardsHandlers();
});

/**
 * Initializes the payment page
 */
async function initializePaymentPage() {
  // Check if cart has items
  const cart = window.getCart ? window.getCart() : [];
  
  const emptyCartDiv = document.getElementById('payment-empty-cart');
  const paymentContent = document.getElementById('payment-content');

  if (cart.length === 0) {
    // Show empty cart message
    if (emptyCartDiv) emptyCartDiv.style.display = 'block';
    if (paymentContent) paymentContent.style.display = 'none';
    return;
  }

  // Show payment content
  if (emptyCartDiv) emptyCartDiv.style.display = 'none';
  if (paymentContent) paymentContent.style.display = 'block';

  // Render order summary
  renderOrderSummary();
  
  // Update cart icon
  if (window.updateCartIcon) {
    window.updateCartIcon();
  }

  // Pre-fill form with user profile data and load rewards
  await prefillUserData();
  await loadUserRewards();
}

/**
 * Pre-fills the payment form with user profile data
 */
async function prefillUserData() {
  try {
    // Check if API client is available
    if (!window.apiClient) {
      console.warn('API client not available for prefill');
      return;
    }

    // Get current user data
    const response = await window.apiClient.getCurrentUser();
    if (!response || !response.user) {
      console.log('No user data available for prefill');
      return;
    }

    const user = response.user;

    // Pre-fill customer information
    const customerName = document.getElementById('customerName');
    const customerPhone = document.getElementById('customerPhone');
    const customerEmail = document.getElementById('customerEmail');

    if (customerName && user.name) {
      customerName.value = user.name;
    }
    if (customerPhone && user.phoneNumber) {
      customerPhone.value = user.phoneNumber;
    }
    if (customerEmail && user.email) {
      customerEmail.value = user.email;
    }

    // Pre-fill shipping address
    const shippingAddress = document.getElementById('shippingAddress');
    const shippingCity = document.getElementById('shippingCity');
    const shippingState = document.getElementById('shippingState');
    const shippingZip = document.getElementById('shippingZip');
    const shippingCountry = document.getElementById('shippingCountry');

    if (shippingAddress && user.address) {
      shippingAddress.value = user.address;
    }
    if (shippingCity && user.city) {
      shippingCity.value = user.city;
    }
    if (shippingState && user.state) {
      shippingState.value = user.state;
    }
    if (shippingZip && (user.zipCode || user.zip)) {
      shippingZip.value = user.zipCode || user.zip;
    }
    if (shippingCountry && user.country) {
      shippingCountry.value = user.country;
    }

    console.log('Form pre-filled successfully');
  } catch (error) {
    console.error('Error pre-filling user data:', error);
    // Don't show error to user - just continue without prefill
  }
}

/**
 * Loads user's reward points and displays the rewards section
 */
async function loadUserRewards() {
  try {
    if (!window.apiClient) {
      console.warn('API client not available for rewards');
      return;
    }

    const rewards = await window.apiClient.getRewards();
    if (!rewards) {
      console.log('No rewards data available');
      return;
    }

    userRewardsBalance = rewards.balance || 0;

    // Only show rewards section if user has points
    if (userRewardsBalance > 0) {
      const rewardsSection = document.getElementById('rewards-section');
      const balanceEl = document.getElementById('rewards-balance');
      const valueEl = document.getElementById('rewards-value');
      const pointsInput = document.getElementById('points-to-redeem');

      if (rewardsSection) rewardsSection.style.display = 'block';
      if (balanceEl) balanceEl.textContent = userRewardsBalance;
      if (valueEl) valueEl.textContent = userRewardsBalance; // 1 point = ₦1
      if (pointsInput) pointsInput.max = userRewardsBalance;
    }
  } catch (error) {
    console.error('Error loading user rewards:', error);
  }
}

/**
 * Sets up event handlers for rewards redemption
 */
function setupRewardsHandlers() {
  const pointsInput = document.getElementById('points-to-redeem');
  const useAllBtn = document.getElementById('use-all-points');
  const discountEl = document.getElementById('points-discount');

  if (pointsInput) {
    pointsInput.addEventListener('input', () => {
      let value = parseInt(pointsInput.value) || 0;
      
      // Clamp value to valid range
      if (value < 0) value = 0;
      if (value > userRewardsBalance) value = userRewardsBalance;
      
      // Don't allow discount greater than subtotal
      const subtotal = window.getCartTotal ? window.getCartTotal() : 0;
      if (value > subtotal) value = Math.floor(subtotal);
      
      pointsInput.value = value;
      pointsToRedeem = value;
      
      // Update discount display
      if (discountEl) discountEl.textContent = value;
      
      // Update order total
      updateOrderTotal();
    });
  }

  if (useAllBtn) {
    useAllBtn.addEventListener('click', () => {
      const subtotal = window.getCartTotal ? window.getCartTotal() : 0;
      // Use all points, but don't exceed subtotal
      const maxUsable = Math.min(userRewardsBalance, Math.floor(subtotal));
      
      if (pointsInput) {
        pointsInput.value = maxUsable;
        pointsToRedeem = maxUsable;
      }
      if (discountEl) discountEl.textContent = maxUsable;
      
      updateOrderTotal();
    });
  }
}

/**
 * Updates the order total with points discount
 */
function updateOrderTotal() {
  const subtotal = window.getCartTotal ? window.getCartTotal() : 0;
  const shipping = subtotal > 50 ? 0 : 10;
  const tax = subtotal * 0.1;
  const discount = pointsToRedeem; // 1 point = ₦1
  const total = Math.max(0, subtotal + shipping + tax - discount);

  const totalElement = document.getElementById('payment-total');
  const discountRow = document.getElementById('rewards-discount-row');
  const discountValueEl = document.getElementById('payment-points-discount');

  if (totalElement) totalElement.textContent = `₦${total.toFixed(2)}`;
  
  if (discountRow && discountValueEl) {
    if (discount > 0) {
      discountRow.style.display = 'flex';
      discountValueEl.textContent = `-₦${discount.toFixed(2)}`;
    } else {
      discountRow.style.display = 'none';
    }
  }
}

/**
 * Renders the order summary with cart items
 */
function renderOrderSummary() {
  const orderItemsContainer = document.getElementById('payment-order-items');
  const subtotalElement = document.getElementById('payment-subtotal');
  const shippingElement = document.getElementById('payment-shipping');
  const taxElement = document.getElementById('payment-tax');
  const totalElement = document.getElementById('payment-total');

  if (!orderItemsContainer) return;

  const cart = window.getCart ? window.getCart() : [];
  
  if (cart.length === 0) {
    orderItemsContainer.innerHTML = '<p>No items in cart</p>';
    return;
  }

  // Clear existing items
  orderItemsContainer.innerHTML = '';

  // Render each cart item
  cart.forEach(item => {
    const itemElement = createOrderItemElement(item);
    orderItemsContainer.appendChild(itemElement);
  });

  // Calculate totals
  const subtotal = window.getCartTotal ? window.getCartTotal() : 0;
  const shipping = subtotal > 50 ? 0 : 10; // Free shipping over ₦50
  const tax = subtotal * 0.1; // 10% tax
  const total = subtotal + shipping + tax;

  // Update summary values
  if (subtotalElement) subtotalElement.textContent = `₦${subtotal.toFixed(2)}`;
  if (shippingElement) shippingElement.textContent = shipping === 0 ? 'FREE' : `₦${shipping.toFixed(2)}`;
  if (taxElement) taxElement.textContent = `₦${tax.toFixed(2)}`;
  if (totalElement) totalElement.textContent = `₦${total.toFixed(2)}`;
}

/**
 * Creates an order item element for the summary
 * @param {Object} item - Cart item object
 * @returns {HTMLElement} Order item element
 */
function createOrderItemElement(item) {
  const itemDiv = document.createElement('div');
  itemDiv.className = 'payment-order-item';
  const imgWrap = document.createElement('div');
  imgWrap.className = 'payment-order-item-image';
  const img = document.createElement('img');
  img.src = item.imageUrl || 'https://via.placeholder.com/60?text=No+Image';
  img.alt = String(item.name || 'Item');
  img.onerror = () => {
    img.src = 'https://via.placeholder.com/60?text=No+Image';
  };
  imgWrap.appendChild(img);

  const info = document.createElement('div');
  info.className = 'payment-order-item-info';
  const nameEl = document.createElement('div');
  nameEl.className = 'payment-order-item-name';
  nameEl.textContent = String(item.name || 'Unknown item');
  const detailsEl = document.createElement('div');
  detailsEl.className = 'payment-order-item-details';
  detailsEl.textContent = `Quantity: ${Number(item.quantity || 0)} × ₦${Number(item.price || 0).toFixed(2)}`;
  info.appendChild(nameEl);
  info.appendChild(detailsEl);

  const priceEl = document.createElement('div');
  priceEl.className = 'payment-order-item-price';
  priceEl.textContent = `₦${(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}`;

  itemDiv.appendChild(imgWrap);
  itemDiv.appendChild(info);
  itemDiv.appendChild(priceEl);

  return itemDiv;
}

/**
 * Sets up the payment form with validation and handlers
 */
function setupPaymentForm() {
  const paymentForm = document.getElementById('paymentForm');

  // Handle form submission
  if (paymentForm) {
    paymentForm.addEventListener('submit', handlePaymentSubmission);
  }
}

/**
 * Gets the current authenticated user
 * @returns {Promise<Object|null>} User object or null
 */
async function getCurrentUser() {
  try {
    // Use API client to get current user
    if (!window.authAPI) {
      console.warn('API client not available');
      return null;
    }

    const response = await window.authAPI.getCurrentUser();
    if (response && response.user) {
      return response.user;
    }
    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Creates an order via backend API and returns the order ID
 * @param {Object} orderData - Order data to save
 * @returns {Promise<string>} Order ID
 */
async function createOrderInFirestore(orderData) {
  try {
    if (!window.apiClient) {
      throw new Error('API client not available');
    }

    // Create order via backend API
    const response = await window.apiClient.createOrder(orderData);
    
    return response.orderId;
  } catch (error) {
    console.error('Error creating order:', error);
    throw error;
  }
}

/**
 * Formats order details for WhatsApp message
 * @param {Object} orderData - Order data
 * @param {string} orderId - Order ID
 * @returns {string} Formatted WhatsApp message
 */
function formatOrderForWhatsApp(orderData, orderId) {
  const { customerInfo, shippingAddress, cart, totals, orderNotes } = orderData;
  
  let message = `🛍️ *NEW ORDER - NAME IT SCENTS*\n\n`;
  message += `*Order ID:* ${orderId}\n`;
  message += `*Date:* ${new Date().toLocaleString()}\n\n`;
  
  message += `*Customer Information:*\n`;
  message += `👤 Name: ${customerInfo.name}\n`;
  message += `📞 Phone: ${customerInfo.phone}\n`;
  if (customerInfo.email) {
    message += `📧 Email: ${customerInfo.email}\n`;
  }
  message += `\n`;
  
  message += `*Shipping Address:*\n`;
  message += `${shippingAddress.address}\n`;
  message += `${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zip}\n`;
  message += `${shippingAddress.country}\n\n`;
  
  message += `*Order Items:*\n`;
  cart.forEach((item, index) => {
    message += `${index + 1}. ${item.name}\n`;
    message += `   Quantity: ${item.quantity}\n`;
    message += `   Price: ₦${item.price.toFixed(2)} each\n`;
    message += `   Subtotal: ₦${(item.price * item.quantity).toFixed(2)}\n\n`;
  });
  
  message += `*Order Summary:*\n`;
  message += `Subtotal: ₦${totals.subtotal.toFixed(2)}\n`;
  message += `Shipping: ${totals.shipping === 0 ? 'FREE' : '₦' + totals.shipping.toFixed(2)}\n`;
  message += `Tax: ₦${totals.tax.toFixed(2)}\n`;
  if (totals.pointsDiscount && totals.pointsDiscount > 0) {
    message += `Points Discount: -₦${totals.pointsDiscount.toFixed(2)} (${totals.pointsRedeemed} points)\n`;
  }
  message += `*Total: ₦${totals.total.toFixed(2)}*\n\n`;
  
  if (orderNotes && orderNotes.trim()) {
    message += `*Additional Notes:*\n${orderNotes}\n\n`;
  }
  
  message += `---\n`;
  message += `Please process this order. Order ID: ${orderId}`;
  
  return message;
}

/**
 * Opens WhatsApp with formatted order message
 * @param {string} message - Formatted message
 */
function sendOrderToWhatsApp(message) {
  // Encode message for URL
  const encodedMessage = encodeURIComponent(message);
  
  // Format WhatsApp number (remove any non-numeric characters except +)
  let whatsappNumber = ADMIN_WHATSAPP_NUMBER.replace(/[^\d+]/g, '');
  
  // Ensure it starts with country code (add + if not present and number doesn't start with +)
  if (!whatsappNumber.startsWith('+')) {
    // If first digit is 0, remove it (might be a local format)
    if (whatsappNumber.startsWith('0')) {
      whatsappNumber = whatsappNumber.substring(1);
    }
    // Add + prefix
    whatsappNumber = '+' + whatsappNumber;
  }
  
  // Create WhatsApp URL
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
  
  // Open in new window
  window.open(whatsappUrl, '_blank');
}

/**
 * Handles payment form submission
 * @param {Event} e - Form submit event
 */
async function handlePaymentSubmission(e) {
  e.preventDefault();

  const submitBtn = document.getElementById('submitPayment');
  const cart = window.getCart ? window.getCart() : [];

  if (cart.length === 0) {
    showNotification('Your cart is empty. Please add items before checkout.', 'error');
    return;
  }

  // Disable submit button
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  }

  try {
    // Get form data (matching actual form fields)
    const customerName = document.getElementById('customerName').value.trim();
    const customerPhone = document.getElementById('customerPhone').value.trim();
    const customerEmail = document.getElementById('customerEmail').value.trim();
    const shippingAddress = document.getElementById('shippingAddress').value.trim();
    const shippingCity = document.getElementById('shippingCity').value.trim();
    const shippingState = document.getElementById('shippingState').value.trim();
    const shippingZip = document.getElementById('shippingZip').value.trim();
    const shippingCountry = document.getElementById('shippingCountry').value.trim();
    const orderNotes = document.getElementById('orderNotes').value.trim();

    // Validate required fields
    if (!customerName || !customerPhone || !shippingAddress || !shippingCity || 
        !shippingState || !shippingZip || !shippingCountry) {
      showNotification('Please fill in all required fields.', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Complete Order via WhatsApp';
      }
      return;
    }

    // Get current user (must be authenticated)
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      showNotification('You must be logged in to place an order. Redirecting to login...', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Complete Order via WhatsApp';
      }
      setTimeout(() => {
        window.location.href = '../login.html';
      }, 2000);
      return;
    }

    const userId = currentUser.uid;

    // Calculate totals
    const subtotal = window.getCartTotal ? window.getCartTotal() : 0;
    const shipping = subtotal > 50 ? 0 : 10;
    const tax = subtotal * 0.1;
    const pointsDiscount = pointsToRedeem; // 1 point = ₦1
    const total = Math.max(0, subtotal + shipping + tax - pointsDiscount);

    // Prepare order data
    const orderData = {
      userId: userId,
      customerInfo: {
        name: customerName,
        phone: customerPhone,
        email: customerEmail || null
      },
      shippingAddress: {
        address: shippingAddress,
        city: shippingCity,
        state: shippingState,
        zip: shippingZip,
        country: shippingCountry
      },
      items: cart.map(item => ({
        productId: item.id || item.productId || null,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        imageUrl: item.imageUrl || null
      })),
      totalAmount: total,
      subtotal: subtotal,
      shipping: shipping,
      tax: tax,
      pointsToRedeem: pointsToRedeem,
      pointsDiscount: pointsDiscount,
      status: 'pending',
      paymentMethod: 'whatsapp',
      orderNotes: orderNotes || null
    };

    // STEP 1: Create order in Firestore FIRST (this generates the order ID)
    let orderId;
    try {
      orderId = await createOrderInFirestore(orderData);
    } catch (error) {
      console.error('Failed to create order in Firestore:', error);
      showNotification('Failed to create order. Please try again.', 'error');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Complete Order via WhatsApp';
      }
      return;
    }

    // STEP 2: Format order for WhatsApp (include order ID)
    const totals = {
      subtotal: subtotal,
      shipping: shipping,
      tax: tax,
      pointsDiscount: pointsDiscount,
      pointsRedeemed: pointsToRedeem,
      total: total
    };
    
    const whatsappOrderData = {
      customerInfo: orderData.customerInfo,
      shippingAddress: orderData.shippingAddress,
      cart: cart,
      totals: totals,
      orderNotes: orderNotes
    };
    
    const whatsappMessage = formatOrderForWhatsApp(whatsappOrderData, orderId);

    // STEP 3: Send to WhatsApp (opens WhatsApp with pre-filled message)
    sendOrderToWhatsApp(whatsappMessage);

    // Show success message
    showNotification(`Order #${orderId} created successfully! Opening WhatsApp...`, 'success');

    // Clear cart after successful order creation
    if (window.clearCart) {
      window.clearCart();
    }

    // Redirect to dashboard after a short delay (user is still authenticated)
    setTimeout(() => {
      window.location.href = './user-dashboard.html';
    }, 3000);

  } catch (error) {
    console.error('Order submission error:', error);
    showNotification('An error occurred while processing your order. Please try again.', 'error');
    
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fab fa-whatsapp"></i> Complete Order via WhatsApp';
    }
  }
}

/**
 * Shows a toast notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type: 'success', 'error', 'info'
 */
function showNotification(message, type = 'success') {
  // Use cart notification if available
  if (window.showCartNotification) {
    window.showCartNotification(message, type);
    return;
  }

  // Fallback: create our own toast
  const existingToast = document.getElementById('payment-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.id = 'payment-toast';
  toast.className = `payment-toast payment-toast-${type}`;
  
  const icon = type === 'success' ? 'fa-check-circle' : 
               type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
  
  const iconEl = document.createElement('i');
  iconEl.className = `fas ${icon}`;
  const spanEl = document.createElement('span');
  spanEl.textContent = String(message || '');
  toast.appendChild(iconEl);
  toast.appendChild(spanEl);

  // Add styles if not already present
  if (!document.getElementById('payment-toast-styles')) {
    const styles = document.createElement('style');
    styles.id = 'payment-toast-styles';
    styles.textContent = `
      .payment-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 0.95rem;
        font-weight: 500;
        z-index: 10000;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
      .payment-toast.show {
        opacity: 1;
        transform: translateX(0);
      }
      .payment-toast-success {
        background: #10b981;
        color: white;
      }
      .payment-toast-error {
        background: #ef4444;
        color: white;
      }
      .payment-toast-info {
        background: #3b82f6;
        color: white;
      }
      .payment-toast i {
        font-size: 1.2rem;
      }
    `;
    document.head.appendChild(styles);
  }

  document.body.appendChild(toast);

  // Show with animation
  setTimeout(() => toast.classList.add('show'), 10);

  // Auto-hide after 4 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Calculates the total amount including tax and shipping
 * @returns {number} Total amount
 */
function calculateTotal() {
  const cart = window.getCart ? window.getCart() : [];
  const subtotal = window.getCartTotal ? window.getCartTotal() : 0;
  const shipping = subtotal > 50 ? 0 : 10;
  const tax = subtotal * 0.1;
  return subtotal + shipping + tax;
}
