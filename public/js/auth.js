// Overall Architecture:
// This file creates a complete authentication system that:
// Works on both signup and login pages using the same code
// Provides user feedback through toast notifications
// Handles all authentication scenarios (signup, login, logout, password reset)
// Protects routes by monitoring authentication state
// Uses Firebase v8 for compatibility and simplicity
// Follows best practices for error handling and user experience
// The file is designed to be smart - it automatically detects which page it's on and sets up the appropriate functionality without conflicts.




// Global Toast Notification System
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  // Clear any existing timeout
  if (toast.timeoutId) {
    clearTimeout(toast.timeoutId);
  }

  // Set message and type
  toast.textContent = message;
  toast.className = `toast show ${type}`;

  // Hide toast after 3 seconds
  toast.timeoutId = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 300);
  }, 3000);
}
// comment: This function can be called from anywhere in your app to show a toast notification
// Purpose: Creates user-friendly popup messages
// Logic:
// Finds the toast element in the HTML
// Clears any existing toast to prevent overlapping
// Sets the message text and styling (success/error/info/warning)
// Shows the toast for 3 seconds, then hides it with a smooth animation
// Uses CSS classes to control visibility and styling

// Firebase Configuration
// NOTE: The canonical `firebaseConfig` and app initialization live in `firebase-config.js`.
// This file will use the already-initialized services if available. Fallbacks use the
// global `firebase` object if present.
const auth = (typeof window !== 'undefined' && window.auth) ? window.auth : (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null);
const db = (typeof window !== 'undefined' && window.db) ? window.db : (typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null);

// comment for the above code
// Purpose: Sets up Firebase connection and services
// Logic:
// Contains your Firebase project credentials
// Checks if Firebase is already initialized (prevents duplicate initialization errors)
// Creates auth object for user authentication (login, signup, logout)
// Creates db object for Firestore database operations

//below are the functions for authentication
// Import offline detection (you'll need to add this)
// For now, we'll add the offline check directly in the functions

// Register Function
async function register(event) {
  // Check if user is offline
  event.preventDefault(); // Prevent form submission from refreshing the page
if (!navigator.onLine) {
  showToast("Sorry, you are currently offline", "error");
  return;
}
  

  const firstNameInput = document.getElementById("firstname");
  const lastNameInput = document.getElementById("lastname");
  const nameInput = document.getElementById("name");
  
  const emailInput = document.getElementById("email");
  const phoneNumberInput = document.getElementById("signupPhone");
  const passwordInput = document.getElementById("signup-password");
  const confirmInput = document.getElementById("signup-confirm-password");

  // Defensive checks: ensure required form fields exist before reading values
  // Check that at least one name field exists (firstName+lastName OR name OR just firstName)
  const hasNameField = (firstNameInput && lastNameInput) || nameInput || firstNameInput;
  if (!hasNameField || !emailInput || !phoneNumberInput || !passwordInput || !confirmInput) {
    console.error('Register: form inputs missing', { firstNameInput, lastNameInput, nameInput, emailInput, phoneNumberInput, passwordInput, confirmInput });
    showToast('Form is incomplete or missing required fields.', 'error');
    return;
  }

  // Get name value - prioritize firstName/lastName if both exist, otherwise use single name field
  let name = '';
  if (firstNameInput && lastNameInput) {
    name = `${firstNameInput.value.trim()} ${lastNameInput.value.trim()}`.trim();
  } else if (nameInput) {
    name = nameInput.value.trim();
  } else if (firstNameInput) {
    name = firstNameInput.value.trim();
  }
  const email = emailInput.value.trim();
  const phoneNumber = phoneNumberInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmInput.value;

  // Validation
  if (!name || !email || !phoneNumber|| !password || !confirmPassword) {
    showToast("Please fill all fields.", "error");
    return;
  }

  if (password !== confirmPassword) {
    showToast("Passwords do not match.", "error");
    return;
  }

  

  try {
    if (!auth || !db) {
      console.error('Firebase services not available', { auth, db });
      showToast('Firebase is not initialized. Please refresh the page.', 'error');
      return;
    }
    // Set persistence to SESSION (default) or LOCAL based on your needs
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Wait for the auth token to be available before writing to Firestore
    const idToken = await user.getIdToken();
    if (!idToken) {
      throw new Error('Authentication token not available. Please try again.');
    }

    // Save extra data to Firestore
    await db
      .collection("users")
      .doc(user.uid)
      .set({
        name,
        email,
        phoneNumber,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

    // Clear any navigation flags on successful registration
    sessionStorage.removeItem('navigatedAway');
    sessionStorage.removeItem('navigatedAwayFromAuth');
    sessionStorage.removeItem('previousPage');
    navigationTrackingInitialized = false; // Reset so tracking can be re-initialized
    
    showToast("Registered and logged in!", "success");
    window.location.href = "./dashboard-files/user-dashboard.html";
  } catch (error) {
    console.error("Signup error:", error);
    // Provide more specific error messages
    let errorMessage = error.message;
    if (error.code === 'permission-denied') {
      errorMessage = 'Permission denied. Please check Firestore security rules.';
    } else if (error.code === 'unavailable') {
      errorMessage = 'Firestore is unavailable. Please check your internet connection.';
    } else if (error.code === 'invalid-argument') {
      errorMessage = 'Invalid data format. Please try again.';
    }
    showToast(errorMessage, "error");
  }
}
// comment: This function handles user registration

// Purpose: Handles new user account creation
// Logic:
// Prevents default form behavior (page refresh)
// Gets form values: name, age, email, password, confirm password
// Validates input: checks all fields are filled, passwords match, age is valid (4-17)
// Creates Firebase user account with email/password
// Sets session persistence (user stays logged in during browser session)
// Saves additional user data to Firestore database (name, age, creation time)
// Shows success message and redirects to dashboard
// Error handling shows user-friendly error messages


// Forgot Password Function
async function forgotPassword() {
  const email = prompt("Please enter your email address to reset your password:");

  if (!email) {
    showToast("Email is required", "error");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast("Please enter a valid email address", "error");
    return;
  }

  try {
    await auth.sendPasswordResetEmail(email);
    showToast("Password reset email sent!", "success");
  } catch (error) {
    console.error("Password reset error:", error);
    showToast(error.message, "error");
  }
}

// comment: This function handles password reset requests
// Purpose: Allows users to reset forgotten passwords
// Logic:
// Prompts user for email address
// Validates email is not empty
// Checks email format using regex pattern
// Sends password reset email via Firebase
// Shows success/error messages to user

// Login Function (if needed elsewhere)
async function login(event) {
    event.preventDefault(); // Prevent form submission
  // Check if user is offline
if (!navigator.onLine) {
  showToast("Sorry, you are currently offline", "error");
  return;
}

  // Validate form fields exist
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  
  if (!emailInput || !passwordInput) {
    showToast('Form is incomplete or missing required fields.', 'error');
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  // Validate fields are not empty
  if (!email || !password) {
    showToast("Please fill in both email and password.", "error");
    return;
  }

  try {
    if (!auth) {
      console.error('Firebase auth not available', { auth });
      showToast('Firebase is not initialized. Please refresh the page.', 'error');
      return;
    }
    
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    await auth.signInWithEmailAndPassword(email, password);
    
    // Clear any navigation flags on successful login
    sessionStorage.removeItem('navigatedAway');
    sessionStorage.removeItem('navigatedAwayFromAuth');
    sessionStorage.removeItem('previousPage');
    navigationTrackingInitialized = false; // Reset so tracking can be re-initialized
    
    showToast("Logged in!", "success");
    window.location.href = "./dashboard-files/user-dashboard.html";
  } catch (error) {
    console.error("Login error:", error);
    
    // Parse Firebase auth errors and provide user-friendly messages
    let errorMessage = error.message;
    
    // Try to extract nested error information if present
    if (error.message && error.message.includes('{')) {
      try {
        const jsonMatch = error.message.match(/\{.*\}/);
        if (jsonMatch) {
          const errorData = JSON.parse(jsonMatch[0]);
          if (errorData.error && errorData.error.message) {
            errorMessage = errorData.error.message;
          }
        }
      } catch (e) {
        // If parsing fails, use the original message
      }
    }
    
    // Map Firebase error codes to user-friendly messages
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'No account found with this email address.';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'Incorrect password. Please try again.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid email address format.';
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = 'This account has been disabled.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Too many failed login attempts. Please try again later.';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'Network error. Please check your internet connection.';
    } else if (error.code === 'auth/internal-error') {
      // Check if it's actually an invalid credentials error
      if (errorMessage.toLowerCase().includes('invalid') || errorMessage.toLowerCase().includes('credential')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else {
        errorMessage = 'An internal error occurred. Please try again later.';
      }
    } else if (error.code === 'auth/invalid-credential') {
      errorMessage = 'Invalid email or password. Please check your credentials and try again.';
    }
    
    showToast(errorMessage, "error");
  }
}

// comment: This function handles user login


// Purpose: Authenticates existing users
// Logic:
// Prevents form refresh on submission
// Gets email and password from form
// Sets session persistence (user stays logged in)
// Attempts to sign in with Firebase credentials
// Shows success message and redirects to dashboard
// Error handling shows login errors (wrong password, user not found, etc.)



// Logout Function
async function logout() {
  try {
    // Clear navigation tracking flags
    sessionStorage.removeItem('authPageVisited');
    sessionStorage.removeItem('navigatedAway');
    sessionStorage.removeItem('navigatedAwayFromAuth');
    sessionStorage.removeItem('previousPage');
    navigationTrackingInitialized = false; // Reset tracking flag
    
    await auth.signOut();
    showToast("Logged out!", "success");
    window.location.href = "../index.html";
  } catch (error) {
    console.error("Logout error:", error);
    showToast(error.message, "error");
  }
}
// comment: This function handles user logout
// Purpose: Signs out the current user
// Logic:
// Calls Firebase signOut() to end user session
// Shows success message
// Redirects to home page (index.html)
// Error handling for logout failures




// Navigation Detection for Authenticated Pages
// Purpose: Logs users out if they navigate away from authenticated pages using browser back/forward
// Logic:
// 1. Detects if current page is an authenticated page
// 2. Tracks previous page URL and navigation state
// 3. Detects when user navigates away from authenticated page to public page
// 4. Detects when user returns via back/forward navigation
// 5. Logs out user if they navigated away and returned via browser navigation

function isAuthenticatedPage() {
  const path = window.location.pathname;
  // List of authenticated page patterns
  return path.includes("dashboard") || 
         path.includes("user-profile") || 
         path.includes("user") ||
         path.includes("cart") ||
         path.includes("payment") ||
         path.includes("admin");
}

// Track if navigation tracking is initialized (prevent duplicate listeners)
let navigationTrackingInitialized = false;

// Initialize navigation tracking for authenticated pages
function initNavigationTracking() {
  // Prevent duplicate event listeners
  if (navigationTrackingInitialized) {
    // Still check on each call in case user navigated
    checkNavigationState();
    return;
  }
  
  // Initial check
  checkNavigationState();
  
  // Listen for browser back/forward navigation
  window.addEventListener('popstate', () => {
    // User used back/forward button
    setTimeout(() => {
      checkNavigationState();
    }, 50); // Small delay to ensure pathname is updated
  });
  
  // Track when user navigates away from page
  window.addEventListener('beforeunload', () => {
    const currentIsAuthPage = isAuthenticatedPage();
    if (currentIsAuthPage) {
      // User is leaving authenticated page - store current path
      sessionStorage.setItem('previousPage', window.location.pathname);
    }
  });
  
  navigationTrackingInitialized = true;
}

// Check navigation state and log out if needed
function checkNavigationState() {
  const currentPath = window.location.pathname;
  const isAuthPage = isAuthenticatedPage();
  const previousPage = sessionStorage.getItem('previousPage');
  const navigatedAwayFromAuth = sessionStorage.getItem('navigatedAwayFromAuth') === 'true';
  
  // If user is on authenticated page
  if (isAuthPage) {
    // Check if user is returning to auth page after navigating away
    if (navigatedAwayFromAuth) {
      // Check if previous page was a public page (not authenticated)
      if (!previousPage || (!previousPage.includes('dashboard') && !previousPage.includes('user') && !previousPage.includes('admin'))) {
        // User navigated away from auth page to public page and is returning via back button
        console.log('User returned to authenticated page after navigating away - logging out');
        sessionStorage.removeItem('navigatedAwayFromAuth');
        sessionStorage.removeItem('previousPage');
        logout();
        return;
      }
    }
    
    // Clear the flag since user is legitimately on auth page
    sessionStorage.removeItem('navigatedAwayFromAuth');
    
    // Store current page as previous for next navigation
    sessionStorage.setItem('previousPage', currentPath);
  } else {
    // User is on public page - check if they came from authenticated page
    if (previousPage && (previousPage.includes('dashboard') || previousPage.includes('user') || previousPage.includes('admin'))) {
      // User navigated away from authenticated page to public page
      sessionStorage.setItem('navigatedAwayFromAuth', 'true');
    }
    // Update previous page
    sessionStorage.setItem('previousPage', currentPath);
  }
}

// Auth State Monitor
firebase.auth().onAuthStateChanged((user) => {
  const status = document.getElementById("userInfo");
  if (user) {
    if (status) status.innerText = `Logged in as: ${user.email}`;
    // Initialize navigation tracking when user is authenticated
    initNavigationTracking();
  } else {
    // Clear navigation flags when logged out
    sessionStorage.removeItem('authPageVisited');
    sessionStorage.removeItem('navigatedAway');
    sessionStorage.removeItem('navigatedAwayFromAuth');
    sessionStorage.removeItem('previousPage');
    navigationTrackingInitialized = false; // Reset so tracking can be re-initialized on next login
    
    if (window.location.pathname.includes("user") || window.location.pathname.includes("dashboard")) {
      window.location.href = "../index.html";
    }
  }
});

// comment: This function monitors user authentication state
// Purpose: Monitors user login status across the app
// Logic:
// Listens for auth state changes (login/logout)
// If user is logged in: updates status display (if element exists)
// If user is logged out: redirects from dashboard to home page
// Protects dashboard from unauthorized access



// Add Event Listener for Form Submission
document.addEventListener("DOMContentLoaded", () => {
  // Signup form event listener
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", register);
    console.log("Signup form event listener attached successfully");
  } else {
    console.log("Signup form not found (this is normal on login page)");
  }

  // Login form event listener
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", login);
    console.log("Login form event listener attached successfully");
  } else {
    console.log("Login form not found (this is normal on signup page)");
  }

  const forgotPasswordLink = document.getElementById("forgotPassword");
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", (e) => {
      e.preventDefault();
      forgotPassword();
    });
  }
});
// comment: This code sets up event listeners for form submissions
// Purpose: Connects HTML forms to JavaScript functions
// Logic:
// Waits for page to fully load (DOMContentLoaded)
// Finds signup form and attaches submit event to register() function
// Finds login form and attaches submit event to login() function
// Finds forgot password link and attaches click event to forgotPassword() function
// Handles both pages gracefully (signup page won't have login form, vice versa)
// Prevents default link behavior for forgot password