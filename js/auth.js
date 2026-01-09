/**
 * SabziXpress - Authentication & Role Management
 * Handles Login, Register, Logout, and Page Guards
 */

document.addEventListener('DOMContentLoaded', () => {
    initAuthListeners();
});

const initAuthListeners = () => {
    // 1. Listen for Auth State Changes
    auth.onAuthStateChanged(user => {
        const path = window.location.pathname;
        const page = path.split("/").pop(); // index.html, admin.html, delivery.html

        if (user) {
            console.log("User logged in:", user.uid);
            checkUserRole(user.uid, page);
            
            // Start Notification Service if supported
            if(typeof notifications !== 'undefined') {
                notifications.requestPermission();
            }

        } else {
            console.log("No user logged in");
            handleNoUser(page);
        }
    });

    // 2. Setup Login/Register Form Submit Handlers
    setupForms();
};

// --- Role Management ---

const checkUserRole = (uid, page) => {
    db.ref('users/' + uid).once('value').then(snapshot => {
        const userData = snapshot.val();
        
        if (!userData) {
            // New user (partially registered via Auth but not in DB yet)
            // If on index.html, allow them to stay (registration flow handles DB creation)
            if (page === 'index.html' || page === '') return;
            auth.signOut();
            return;
        }

        const role = userData.role || 'CUSTOMER'; // Default to Customer
        console.log("User Role:", role);

        // Redirect Logic
        if (role === 'ADMIN' && !page.includes('admin.html')) {
            window.location.href = 'admin.html';
        } else if (role === 'DELIVERY' && !page.includes('delivery.html')) {
            window.location.href = 'delivery.html';
        } else if (role === 'CUSTOMER' && (page.includes('admin.html') || page.includes('delivery.html'))) {
            // Customer trying to access Admin/Delivery
            alert("Unauthorized Access");
            window.location.href = 'index.html';
        }

        // Initialize Page Specific Logic if on correct page
        if (page.includes('admin.html') && role === 'ADMIN') {
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('admin-dashboard').classList.remove('hidden');
            if(window.admin) window.admin.init(); // Start Admin Logic
        } 
        else if (page.includes('delivery.html') && role === 'DELIVERY') {
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('delivery-dashboard').classList.remove('hidden');
            if(window.delivery) window.delivery.init(uid); // Start Delivery Logic
        }
        else if ((page.includes('index.html') || page === '') && role === 'CUSTOMER') {
            document.getElementById('loading-screen').classList.add('hidden');
            
            // Check Pincode
            if(localStorage.getItem('userPincode')) {
                document.getElementById('app-container').classList.remove('hidden');
                document.getElementById('user-pincode-display').innerText = localStorage.getItem('userPincode');
                if(window.inventory) window.inventory.init();
            } else {
                document.getElementById('pincode-screen').classList.remove('hidden');
            }
            
            // Fill Profile
            if(document.getElementById('profile-name')) {
                document.getElementById('profile-name').innerText = userData.name;
                document.getElementById('profile-mobile').innerText = userData.mobile;
            }
        }
    });
};

const handleNoUser = (page) => {
    // Show Login Screens based on page
    if (page.includes('admin.html')) {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('admin-dashboard').classList.add('hidden');
    } else if (page.includes('delivery.html')) {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('delivery-dashboard').classList.add('hidden');
    } else {
        // Customer Page
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }
};

// --- Form Handlers ---

const setupForms = () => {
    
    // CUSTOMER LOGIN
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            
            auth.signInWithEmailAndPassword(email, pass)
                .catch(err => alert(err.message));
        });
    }

    // CUSTOMER REGISTER
    const regForm = document.getElementById('register-form');
    if (regForm) {
        regForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value;
            const mobile = document.getElementById('reg-mobile').value;
            const email = document.getElementById('reg-email').value;
            const pass = document.getElementById('reg-password').value;

            auth.createUserWithEmailAndPassword(email, pass)
                .then((cred) => {
                    // Create User Profile in DB
                    return db.ref('users/' + cred.user.uid).set({
                        name: name,
                        mobile: mobile,
                        email: email,
                        role: 'CUSTOMER',
                        createdAt: firebase.database.ServerValue.TIMESTAMP
                    });
                })
                .then(() => {
                    // Success, auto logged in
                })
                .catch(err => alert(err.message));
        });
    }

    // ADMIN LOGIN
    const adminForm = document.getElementById('admin-login-form');
    if (adminForm) {
        adminForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('admin-email').value;
            const pass = document.getElementById('admin-password').value;
            auth.signInWithEmailAndPassword(email, pass).catch(err => alert(err.message));
        });
    }

    // DELIVERY LOGIN
    const delForm = document.getElementById('delivery-login-form');
    if (delForm) {
        delForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('del-email').value;
            const pass = document.getElementById('del-password').value;
            auth.signInWithEmailAndPassword(email, pass).catch(err => alert(err.message));
        });
    }
    
    // Pincode Check (Customer)
    const pinBtn = document.getElementById('btn-check-pincode');
    if(pinBtn) {
        pinBtn.addEventListener('click', () => {
            const pin = document.getElementById('check-pincode').value;
            if(pin.length !== 6) {
                document.getElementById('pincode-error').innerText = "Invalid Pincode";
                document.getElementById('pincode-error').classList.remove('hidden');
                return;
            }
            
            // Check against config in DB
            db.ref('config/pincodes').once('value').then(snapshot => {
                const supported = snapshot.val() || [];
                // Simple array check or object key check
                const isSupported = Object.values(supported).includes(pin) || Object.keys(supported).includes(pin);
                
                if(isSupported) {
                    localStorage.setItem('userPincode', pin);
                    document.getElementById('pincode-screen').classList.add('hidden');
                    document.getElementById('app-container').classList.remove('hidden');
                    document.getElementById('user-pincode-display').innerText = pin;
                    if(window.inventory) window.inventory.init();
                } else {
                    document.getElementById('pincode-error').innerText = "Not available in your area yet.";
                    document.getElementById('pincode-error').classList.remove('hidden');
                }
            });
        });
    }
};

// Logout Function
auth.logout = () => {
    auth.signOut().then(() => {
        window.location.reload();
    });
};