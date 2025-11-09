# NAME IT SCENTS - Backend Authentication System

This backend handles Firebase authentication and role-based access control for both admin and user interfaces.

## 🏗️ Architecture

```
backend/
├── firebase-config.js    # Firebase initialization and configuration
├── auth-service.js       # Core authentication service with role verification
├── signup-service.js     # Public user signup service
├── admin-signup-service.js # Admin signup service
├── product-service.js    # Product management service (add products)
├── product-search-service.js # Product search service
├── order-search-service.js # Order search service
├── order-dashboard-service.js # Order dashboard metrics service
├── admin-login.js        # Admin-specific login handler
├── admin-signup.js       # Admin signup form handler
├── admin-product-form.js # Admin product form handler
├── admin-product-search.js # Admin product search handler
├── admin-order-search.js # Admin order search handler
├── admin-order-dashboard.js # Admin order dashboard handler
├── user-login.js         # User-specific login handler
├── user-signup.js        # User signup form handler
├── package.json          # Dependencies and project configuration
└── README.md            # This file
```

## 🔐 Authentication Flow

### 1. User Registration (Firebase Auth)
- Users sign up using Firebase Auth
- User info is saved in Firestore with role field: "user" or "admin"

### 2. Login Process
1. **Authenticate** user using `signInWithEmailAndPassword(email, password)`
2. **Check Firestore** for user document in correct collection:
   - Admin interface: `admins/{uid}`
   - User interface: `users/{uid}`
3. **Verify role** matches the interface type
4. **Allow/Deny** access based on verification

### 3. Security Features
- ✅ **Role-based access control**
- ✅ **Interface separation** (admin vs user)
- ✅ **Automatic sign-out** for invalid access attempts
- ✅ **Comprehensive error handling**
- ✅ **Input validation**

## 🚀 Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Firebase
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password)
3. Enable Firestore Database
4. Update `firebase-config.js` with your project credentials:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};
```

### 3. Set Up Firestore Collections

#### Admins Collection
```
Collection: admins
Document ID: {uid} (Firebase Auth UID)
Fields:
- email: string
- role: "admin"
- name: string
- createdAt: timestamp
```

#### Users Collection
```
Collection: users
Document ID: {uid} (Firebase Auth UID)
Fields:
- email: string
- role: "user"
- name: string
- phone: string (optional)
- address: object (optional)
- createdAt: timestamp
```

#### Products Collection
```
Collection: products
Document ID: auto-generated
Fields:
- title: string
- price: number
- description: string
- category: string
- imageUrl: string (Firebase Storage URL)
- status: string ("active" | "inactive")
- createdAt: timestamp
- updatedAt: timestamp
```

#### Orders Collection
```
Collection: orders
Document ID: auto-generated
Fields:
- userId: string (Firebase Auth UID)
- items: array (product items in order)
- totalAmount: number
- status: string ("pending" | "processing" | "shipped" | "delivered" | "cancelled")
- shippingAddress: object
- paymentMethod: string
- createdAt: timestamp
- updatedAt: timestamp
```

### 4. Firebase Storage Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Product images - admin upload, public read
    match /product-images/{imageId} {
      allow read: if true;
      allow write: if request.auth != null && 
        request.auth.token.role == 'admin';
    }
  }
}
```

### 5. Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Admin collection - only admins can read/write
    match /admins/{userId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == userId;
    }
    
    // Users collection - users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == userId;
    }
    
    // Products collection - public read, admin write
    match /products/{productId} {
      allow read: if true;
      allow write: if request.auth != null && 
        exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
  }
}
```

## 📱 Usage

### Admin Login
```javascript
import adminLoginHandler from './backend/admin-login.js';

// Initialize admin login
adminLoginHandler.init(
  'adminLoginForm',    // Form element ID
  'adminError',        // Error message element ID
  'adminSuccess',      // Success message element ID
  'adminLoading'       // Loading indicator element ID
);
```

### Admin Signup
```javascript
import adminSignupHandler from './backend/admin-signup.js';

// Initialize admin signup
adminSignupHandler.init(
  'adminSignupForm',   // Form element ID
  'adminSignupError',  // Error message element ID
  'adminSignupSuccess', // Success message element ID
  'adminSignupLoading' // Loading indicator element ID
);
```

### User Login
```javascript
import userLoginHandler from './backend/user-login.js';

// Initialize user login
userLoginHandler.init(
  'userLoginForm',     // Form element ID
  'userError',         // Error message element ID
  'userSuccess',       // Success message element ID
  'userLoading'        // Loading indicator element ID
);
```

### User Signup
```javascript
import userSignupHandler from './backend/user-signup.js';

// Initialize user signup
userSignupHandler.init(
  'userSignupForm',    // Form element ID
  'signupError',       // Error message element ID
  'signupSuccess',     // Success message element ID
  'signupLoading'      // Loading indicator element ID
);
```

### Admin Product Addition
```javascript
import adminProductFormHandler from './backend/admin-product-form.js';

// Initialize admin product form
adminProductFormHandler.init(
  'productForm',       // Form element ID
  'productError',      // Error message element ID
  'productSuccess',    // Success message element ID
  'productLoading',    // Loading indicator element ID
  'imagePreview'       // Image preview element ID
);
```

### Admin Product Search
```javascript
import adminProductSearchHandler from './backend/admin-product-search.js';

// Initialize admin product search
adminProductSearchHandler.init(
  'searchInput',       // Search input element ID
  'searchResults',     // Results container element ID
  'searchLoading',     // Loading indicator element ID
  'noResults',         // No results message element ID
  'title'              // Search type: 'title' or 'category'
);
```

### Admin Order Search
```javascript
import adminOrderSearchHandler from './backend/admin-order-search.js';

// Initialize admin order search
adminOrderSearchHandler.init(
  'orderSearchInput',  // Search input element ID
  'orderSearchForm',   // Search form element ID (optional)
  'orderSearchResults', // Results container element ID
  'orderSearchLoading', // Loading indicator element ID
  'orderNoResults'     // No results message element ID
);
```

### Admin Order Dashboard
```javascript
import adminOrderDashboardHandler from './backend/admin-order-dashboard.js';

// Initialize admin order dashboard
adminOrderDashboardHandler.init(
  'orderDashboard',    // Dashboard container element ID
  'dashboardLoading',  // Loading indicator element ID
  'dashboardError',    // Error message element ID
  'refreshButton',     // Refresh button element ID
  'lastUpdated',       // Last updated timestamp element ID
  true                 // Enable auto-refresh (default: true)
);
```

## 🔒 Security Features

### Role Verification
- **Admin Interface**: Only users with `role: "admin"` in `admins/{uid}` can access
- **User Interface**: Only users with `role: "user"` in `users/{uid}` can access
- **Automatic Sign-out**: Invalid access attempts automatically sign out the user

### Error Handling
- **Invalid credentials**: Clear error messages for wrong email/password
- **Wrong portal**: "Invalid login source. Please use the correct portal."
- **Network errors**: Graceful handling of connection issues
- **Rate limiting**: Firebase handles too many failed attempts

### Input Validation
- **Email format**: Validates email structure
- **Required fields**: Ensures all fields are provided
- **Sanitization**: Prevents XSS and injection attacks

## 🚨 Important Notes

⚠️ **Do not mix logic** between admin and user flows
⚠️ **Only handle login + source verification** - signup logic is separate
⚠️ **Signup is for public users only** - no admin signup through this flow
⚠️ **Admin signup is separate** - only for creating admin accounts from admin interface
⚠️ **Update Firebase config** with your actual project credentials
⚠️ **Set up Firestore security rules** before deployment
⚠️ **Test both interfaces** to ensure proper access control

## 🔧 Troubleshooting

### Common Issues
1. **"Invalid login source"**: User trying to access wrong interface
2. **"User not found"**: User doesn't exist in Firebase Auth
3. **"Document doesn't exist"**: User exists in Auth but not in Firestore
4. **"Role mismatch"**: User has wrong role for the interface

### Debug Steps
1. Check Firebase configuration
2. Verify Firestore collections exist
3. Confirm user documents have correct role field
4. Check browser console for errors
5. Verify security rules are properly set

## 📞 Support

For issues or questions, check the Firebase documentation or contact the development team. 