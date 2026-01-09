/**
 * SabziXpress - Customer Order & Cart Management
 */

const orders = {
    cart: {}, // { productId: qty }
    config: { deliveryCharge: 0, surge: 0 },
    
    init: () => {
        // Load config for delivery charges
        db.ref('config').once('value').then(snap => {
            const conf = snap.val();
            if(conf) {
                orders.config.deliveryCharge = conf.deliveryCharge || 0;
                orders.config.surge = conf.surge || 0;
            }
        });
        
        // Restore cart from localStorage if exists
        const saved = localStorage.getItem('sabzi_cart');
        if(saved) orders.cart = JSON.parse(saved);
        orders.updateFloatingCart();
    },

    // --- Cart Actions ---
    
    addToCart: (prodId) => {
        if(!orders.cart[prodId]) orders.cart[prodId] = 0;
        orders.cart[prodId]++;
        orders.saveCart();
    },

    removeFromCart: (prodId) => {
        if(orders.cart[prodId] && orders.cart[prodId] > 0) {
            orders.cart[prodId]--;
            if(orders.cart[prodId] === 0) delete orders.cart[prodId];
            orders.saveCart();
        }
    },

    getQty: (prodId) => {
        return orders.cart[prodId] || 0;
    },

    saveCart: () => {
        localStorage.setItem('sabzi_cart', JSON.stringify(orders.cart));
        orders.updateFloatingCart();
        // Refresh UI buttons if they exist
        if(window.inventory) window.inventory.renderProducts(window.inventory.currentCategory);
        if(!document.getElementById('cart-modal').classList.contains('hidden')) {
            orders.renderCart();
        }
    },

    updateFloatingCart: () => {
        const floatCart = document.getElementById('floating-cart');
        const keys = Object.keys(orders.cart);
        
        if (keys.length === 0) {
            floatCart.classList.add('hidden');
            return;
        }

        let count = 0;
        let total = 0;
        
        keys.forEach(id => {
            const p = window.inventory.products[id];
            if(p) {
                count += orders.cart[id];
                total += (p.price * orders.cart[id]);
            }
        });

        document.getElementById('cart-count').innerText = `${count} ITEM${count > 1 ? 'S' : ''}`;
        document.getElementById('cart-total').innerText = `₹${total}`;
        floatCart.classList.remove('hidden');
    },

    // --- Render Cart Modal ---
    
    renderCart: () => {
        const container = document.getElementById('cart-items-container');
        container.innerHTML = '';
        
        const keys = Object.keys(orders.cart);
        if (keys.length === 0) {
            container.innerHTML = '<div class="text-center" style="padding:20px;">Cart is empty</div>';
            document.getElementById('bill-section').classList.add('hidden');
            document.getElementById('address-section').classList.add('hidden');
            document.getElementById('btn-place-order').classList.add('hidden');
            return;
        }

        let itemTotal = 0;

        keys.forEach(id => {
            const p = window.inventory.products[id];
            if (!p) return;
            
            const qty = orders.cart[id];
            const lineTotal = p.price * qty;
            itemTotal += lineTotal;

            const div = document.createElement('div');
            div.className = 'cart-item-row';
            div.innerHTML = `
                <div class="cart-item-info">
                    <h4>${p.name}</h4>
                    <small>${p.unitLabel || 'per unit'} x ${qty}</small>
                    <div style="font-weight:bold; margin-top:4px;">₹${lineTotal}</div>
                </div>
                <div class="qty-control">
                    <button class="qty-btn" onclick="orders.removeFromCart('${id}')">-</button>
                    <span class="qty-val">${qty}</span>
                    <button class="qty-btn" onclick="orders.addToCart('${id}')">+</button>
                </div>
            `;
            container.appendChild(div);
        });

        // Bill
        const delCharge = parseInt(orders.config.deliveryCharge);
        const surge = parseInt(orders.config.surge);
        const grandTotal = itemTotal + delCharge + surge;

        document.getElementById('bill-item-total').innerText = `₹${itemTotal}`;
        document.getElementById('bill-delivery').innerText = `₹${delCharge + surge}`;
        document.getElementById('bill-grand-total').innerText = `₹${grandTotal}`;

        document.getElementById('bill-section').classList.remove('hidden');
        document.getElementById('address-section').classList.remove('hidden');
        document.getElementById('btn-place-order').classList.remove('hidden');
        document.getElementById('btn-place-order').innerText = `Pay ₹${grandTotal}`;
    },

    // --- Place Order ---
    
    placeOrder: () => {
        const user = auth.currentUser;
        if(!user) return;

        const address = document.getElementById('delivery-address').value;
        if(!address || address.length < 5) {
            alert("Please enter a valid full address");
            return;
        }

        const payMode = document.querySelector('input[name="pay-mode"]:checked').value; // cod or upi
        
        // Calculate Finals
        let itemTotal = 0;
        const items = [];
        Object.keys(orders.cart).forEach(id => {
            const p = window.inventory.products[id];
            if(p) {
                itemTotal += (p.price * orders.cart[id]);
                items.push({
                    productId: id,
                    name: p.name,
                    price: p.price,
                    qty: orders.cart[id],
                    unit: p.unitLabel
                });
            }
        });

        const delCharge = parseInt(orders.config.deliveryCharge) + parseInt(orders.config.surge);
        const grandTotal = itemTotal + delCharge;

        // Create Order Object
        const orderData = {
            userId: user.uid,
            customerName: document.getElementById('profile-name').innerText || "Customer", // Fallback
            customerMobile: document.getElementById('profile-mobile').innerText || "",
            address: address,
            pincode: localStorage.getItem('userPincode'),
            items: items,
            amount: {
                itemTotal: itemTotal,
                delivery: delCharge,
                grandTotal: grandTotal
            },
            paymentMethod: payMode, // 'cod' or 'upi'
            status: "PLACED",
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        // Push to Firebase
        const newOrderRef = db.ref('orders').push();
        newOrderRef.set(orderData).then(() => {
            // Success
            orders.cart = {};
            orders.saveCart();
            app.closeCart();
            app.toast("Order Placed Successfully!");
            app.navigateTo('orders');
            
            // Trigger Notification to Admin (Client-side trigger)
            if(window.notifications) {
                // Topic 'admin_orders'
                window.notifications.sendToTopic('admin_orders', "New Order!", `₹${grandTotal} from ${orderData.customerName}`);
            }

        }).catch(err => {
            alert("Order Failed: " + err.message);
        });
    },

    // --- User Orders List ---

    loadUserOrders: () => {
        const user = auth.currentUser;
        if(!user) return;

        const listContainer = document.getElementById('orders-list');
        listContainer.innerHTML = '<div class="text-center" style="margin-top:20px;">Loading...</div>';

        db.ref('orders').orderByChild('userId').equalTo(user.uid).on('value', snapshot => {
            const data = snapshot.val();
            listContainer.innerHTML = '';

            if(!data) {
                listContainer.innerHTML = '<div class="text-center" style="margin-top:20px;">No orders yet.</div>';
                return;
            }

            // Convert to array and sort desc
            const orderArr = Object.keys(data).map(k => ({ id: k, ...data[k] })).reverse();

            orderArr.forEach(o => {
                const date = new Date(o.createdAt).toLocaleString();
                const itemSummary = o.items.map(i => `${i.qty} x ${i.name}`).join(', ');

                const div = document.createElement('div');
                div.className = 'order-list-card';
                div.innerHTML = `
                    <div class="order-header">
                        <span class="bold">Order #${o.id.slice(-4)}</span>
                        <span class="order-status">${o.status}</span>
                    </div>
                    <div class="order-items">${itemSummary}</div>
                    <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#777;">
                        <span>${date}</span>
                        <span class="bold" style="color:#000;">₹${o.amount.grandTotal}</span>
                    </div>
                `;
                listContainer.appendChild(div);
            });
        });
    }
};