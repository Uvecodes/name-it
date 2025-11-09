// Payment Page Functionality
// Handles payment form, order summary, and checkout process

// Initialize payment page when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializePaymentPage();
  setupPaymentForm();
});

/**
 * Initializes the payment page
 */
function initializePaymentPage() {
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
  const shipping = subtotal > 50 ? 0 : 10; // Free shipping over $50
  const tax = subtotal * 0.1; // 10% tax
  const total = subtotal + shipping + tax;

  // Update summary values
  if (subtotalElement) subtotalElement.textContent = `$${subtotal.toFixed(2)}`;
  if (shippingElement) shippingElement.textContent = shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`;
  if (taxElement) taxElement.textContent = `$${tax.toFixed(2)}`;
  if (totalElement) totalElement.textContent = `$${total.toFixed(2)}`;
}

/**
 * Creates an order item element for the summary
 * @param {Object} item - Cart item object
 * @returns {HTMLElement} Order item element
 */
function createOrderItemElement(item) {
  const itemDiv = document.createElement('div');
  itemDiv.className = 'payment-order-item';

  itemDiv.innerHTML = `
    <div class="payment-order-item-image">
      <img src="${item.imageUrl}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/60?text=No+Image'">
    </div>
    <div class="payment-order-item-info">
      <div class="payment-order-item-name">${item.name}</div>
      <div class="payment-order-item-details">Quantity: ${item.quantity} × $${item.price.toFixed(2)}</div>
    </div>
    <div class="payment-order-item-price">
      $${(item.price * item.quantity).toFixed(2)}
    </div>
  `;

  return itemDiv;
}

/**
 * Sets up the payment form with validation and handlers
 */
function setupPaymentForm() {
  const paymentForm = document.getElementById('paymentForm');
  const sameAsBillingCheckbox = document.getElementById('sameAsBilling');
  const shippingSection = document.getElementById('shippingAddressSection');
  const cardNumberInput = document.getElementById('cardNumber');
  const expiryInput = document.getElementById('expiryDate');
  const cvvInput = document.getElementById('cvv');

  // Toggle shipping address section
  if (sameAsBillingCheckbox && shippingSection) {
    sameAsBillingCheckbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        shippingSection.style.display = 'none';
        // Clear shipping fields
        const shippingInputs = shippingSection.querySelectorAll('input');
        shippingInputs.forEach(input => input.value = '');
      } else {
        shippingSection.style.display = 'block';
      }
    });
  }

  // Format card number input (add spaces)
  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\s/g, '');
      let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
      if (formattedValue.length <= 19) {
        e.target.value = formattedValue;
      } else {
        e.target.value = formattedValue.substring(0, 19);
      }
    });
  }

  // Format expiry date input (MM/YY)
  if (expiryInput) {
    expiryInput.addEventListener('input', (e) => {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length >= 2) {
        value = value.substring(0, 2) + '/' + value.substring(2, 4);
      }
      e.target.value = value;
    });
  }

  // Format CVV input (numbers only)
  if (cvvInput) {
    cvvInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '');
    });
  }

  // Handle form submission
  if (paymentForm) {
    paymentForm.addEventListener('submit', handlePaymentSubmission);
  }
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
    alert('Your cart is empty. Please add items before checkout.');
    return;
  }

  // Disable submit button
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  }

  // Get form data
  const formData = {
    cardNumber: document.getElementById('cardNumber').value.replace(/\s/g, ''),
    cardholderName: document.getElementById('cardholderName').value,
    expiryDate: document.getElementById('expiryDate').value,
    cvv: document.getElementById('cvv').value,
    billingAddress: document.getElementById('billingAddress').value,
    billingCity: document.getElementById('billingCity').value,
    billingState: document.getElementById('billingState').value,
    billingZip: document.getElementById('billingZip').value,
    billingCountry: document.getElementById('billingCountry').value,
    sameAsBilling: document.getElementById('sameAsBilling').checked,
    shippingAddress: document.getElementById('shippingAddress').value,
    shippingCity: document.getElementById('shippingCity').value,
    shippingState: document.getElementById('shippingState').value,
    shippingZip: document.getElementById('shippingZip').value,
    shippingCountry: document.getElementById('shippingCountry').value,
    cart: cart,
    total: calculateTotal()
  };

  // Validate form
  if (!validatePaymentForm(formData)) {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-lock"></i> Complete Payment';
    }
    return;
  }

  // Simulate payment processing (replace with actual payment gateway integration)
  try {
    // Here you would integrate with your payment gateway (Stripe, PayPal, etc.)
    await processPayment(formData);
    
    // Show success message
    if (window.showCartNotification) {
      window.showCartNotification('Payment successful! Order confirmed.', 'success');
    }
    
    // Clear cart after successful payment
    if (window.clearCart) {
      window.clearCart();
    }
    
    // Redirect to success page or order confirmation
    setTimeout(() => {
      window.location.href = './index.html'; // Change to order confirmation page
    }, 2000);
    
  } catch (error) {
    console.error('Payment error:', error);
    alert('Payment failed. Please try again.');
    
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-lock"></i> Complete Payment';
    }
  }
}

/**
 * Validates the payment form
 * @param {Object} formData - Form data object
 * @returns {boolean} True if valid, false otherwise
 */
function validatePaymentForm(formData) {
  // Validate card number (Luhn algorithm would be better, but simple check for now)
  if (formData.cardNumber.length < 13 || formData.cardNumber.length > 19) {
    alert('Please enter a valid card number');
    return false;
  }

  // Validate expiry date
  if (!/^\d{2}\/\d{2}$/.test(formData.expiryDate)) {
    alert('Please enter a valid expiry date (MM/YY)');
    return false;
  }

  // Validate CVV
  if (formData.cvv.length < 3 || formData.cvv.length > 4) {
    alert('Please enter a valid CVV');
    return false;
  }

  // Validate required fields
  const requiredFields = [
    'cardholderName', 'billingAddress', 'billingCity', 
    'billingState', 'billingZip', 'billingCountry'
  ];

  for (const field of requiredFields) {
    if (!formData[field] || formData[field].trim() === '') {
      alert(`Please fill in all required fields`);
      return false;
    }
  }

  // Validate shipping address if different from billing
  if (!formData.sameAsBilling) {
    const shippingFields = [
      'shippingAddress', 'shippingCity', 
      'shippingState', 'shippingZip', 'shippingCountry'
    ];
    
    for (const field of shippingFields) {
      if (!formData[field] || formData[field].trim() === '') {
        alert('Please fill in all shipping address fields');
        return false;
      }
    }
  }

  return true;
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

/**
 * Processes the payment (simulated - replace with actual payment gateway)
 * @param {Object} formData - Payment form data
 * @returns {Promise} Payment processing promise
 */
function processPayment(formData) {
  return new Promise((resolve, reject) => {
    // Simulate API call delay
    setTimeout(() => {
      // In a real application, you would:
      // 1. Send payment data to your backend
      // 2. Backend processes payment through payment gateway (Stripe, PayPal, etc.)
      // 3. Return success/failure response
      
      // For now, simulate success
      console.log('Processing payment:', {
        amount: formData.total,
        cardLast4: formData.cardNumber.slice(-4),
        // Never log full card details in production!
      });
      
      // Simulate 90% success rate
      if (Math.random() > 0.1) {
        resolve({ success: true, transactionId: 'TXN' + Date.now() });
      } else {
        reject(new Error('Payment processing failed'));
      }
    }, 2000);
  });
}

