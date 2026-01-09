/**
 * SabziXpress - Final Admin Logic (Fixes for Stats, Inventory & Config)
 */

const admin = {
    ordersData: {},
    inventoryData: {},
    categories: {},
    configData: {},

    init: () => {
        console.log("Admin Dashboard Loaded...");
        admin.checkNotifications();
        admin.listenOrders();
        admin.listenInventory(); // Fetches Products & Categories
        admin.listenSettings();  // Fetches Pincodes & Prices
    },

    checkNotifications: () => {
        const el = document.getElementById('fcm-status');
        if(Notification.permission === 'granted') el.innerHTML = "🟢 Alerts Active";
        else el.innerHTML = `<span onclick="notifications.requestPermission()" style="cursor:pointer; color:#f1c40f">⚪ Tap to Enable Alerts</span>`;
    },

    // ================= ORDERS & STATS =================

    listenOrders: () => {
        db.ref('orders').limitToLast(100).on('value', snap => {
            admin.ordersData = snap.val() || {};
            admin.renderOrders();
            admin.calculateDailyStats();
        });
    },

    calculateDailyStats: () => {
        const todayStr = new Date().toDateString();
        let totalSales = 0;
        let todayOrders = 0;

        Object.values(admin.ordersData).forEach(order => {
            const orderDate = new Date(order.createdAt).toDateString();
            if(orderDate === todayStr && order.status !== 'CANCELLED') {
                totalSales += (order.amount.grandTotal || 0);
                todayOrders++;
            }
        });

        document.getElementById('stat-count').innerText = todayOrders;
        document.getElementById('stat-sales').innerText = `₹${totalSales}`;
    },

    renderOrders: () => {
        const filter = document.getElementById('order-filter').value;
        const div = document.getElementById('orders-container');
        div.innerHTML = '';
        
        const orders = Object.entries(admin.ordersData)
            .sort((a,b) => b[1].createdAt - a[1].createdAt); // Newest First

        if(orders.length === 0) div.innerHTML = '<p class="text-center" style="padding:20px;">No Orders Found</p>';

        orders.forEach(([key, o]) => {
            if(filter !== 'ALL' && o.status !== filter) return;

            // Simple HTML construction
            const date = new Date(o.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            let btn = '';
            
            if(o.status === 'PLACED') btn = `<button class="btn-primary" onclick="admin.updateOrder('${key}','PACKING')">Confirm Order</button>`;
            else if(o.status === 'PACKING') btn = `<button class="btn-primary" style="background:#2980b9" onclick="admin.updateOrder('${key}','PACKED')">Mark Packed</button>`;
            else if(o.status === 'PACKED') btn = `<button class="btn-primary" style="background:#f39c12; color:black" onclick="adminUI.openAssignModal('${key}')">Assign Rider</button>`;
            
            div.innerHTML += `
                <div class="order-card ${o.status}">
                    <div style="display:flex; justify-content:space-between; font-weight:bold; margin-bottom:5px;">
                        <span>#${key.slice(-4)} (${o.customerName})</span>
                        <span>₹${o.amount.grandTotal}</span>
                    </div>
                    <div style="font-size:0.9rem; margin-bottom:10px;">
                        ${o.address}, <b>${o.pincode}</b> <br>
                        <span style="color:#777">${date} • ${o.paymentMethod.toUpperCase()}</span>
                    </div>
                    <div class="action-row">${btn}</div>
                </div>
            `;
        });
    },

    updateOrder: (id, status) => {
        db.ref(`orders/${id}`).update({status});
        adminUI.toast(`Status updated to ${status}`);
    },

    loadRidersForModal: (orderId) => {
        db.ref('users').orderByChild('role').equalTo('DELIVERY').once('value').then(snap => {
            const list = document.getElementById('assign-list-container');
            list.innerHTML = '';
            const riders = snap.val() || {};
            
            if(Object.keys(riders).length === 0) list.innerHTML = '<p>No Riders Found.</p>';

            Object.keys(riders).forEach(uid => {
                const r = riders[uid];
                const d = document.createElement('div');
                d.innerHTML = `<div style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                                <span>${r.name}</span>
                                <button class="btn-secondary" onclick="admin.assignOrder('${orderId}','${uid}','${r.name}')">Assign</button>
                               </div>`;
                list.appendChild(d);
            });
        });
    },

    assignOrder: (oid, uid, name) => {
        db.ref(`orders/${oid}`).update({ status: 'OUT_FOR_DELIVERY', deliveryPartnerId: uid, deliveryPartnerName: name });
        document.getElementById('modal-assign-delivery').classList.add('hidden');
        adminUI.toast(`Order assigned to ${name}`);
        // Send Notification
        db.ref(`fcmTokens/${uid}`).once('value').then(snap => {
           if(snap.val() && window.notifications) window.notifications.sendToToken(snap.val(), "New Delivery", "New order assigned to you.");
        });
    },

    // ================= INVENTORY =================

    listenInventory: () => {
        db.ref('categories').on('value', snap => {
            admin.categories = snap.val() || {};
            admin.renderCategories();
        });

        db.ref('inventory').on('value', snap => {
            admin.inventoryData = snap.val() || {};
            admin.renderInventory();
        });
    },

    renderCategories: () => {
        const list = document.getElementById('admin-categories-list');
        list.innerHTML = '';
        Object.keys(admin.categories).forEach(k => {
            const c = admin.categories[k];
            const div = document.createElement('div');
            div.style = "background:white; border:1px solid #ccc; padding:5px 10px; border-radius:15px; display:inline-flex; align-items:center; min-width:max-content;";
            div.innerHTML = `${c.name} <span class="material-icons-round" style="font-size:16px; margin-left:5px; color:red; cursor:pointer;" onclick="admin.deleteCategory('${k}')">close</span>`;
            list.appendChild(div);
            // also update modal selector logic is handled in UI open
        });
        
        // Populate filter
        const f = document.getElementById('inv-cat-filter');
        // keep 'all'
        while(f.options.length > 1) f.remove(1);
        Object.keys(admin.categories).forEach(k => {
             const o = document.createElement('option');
             o.value = k; o.innerText = admin.categories[k].name;
             f.appendChild(o);
        });
    },

    saveCategory: () => {
        const id = document.getElementById('cat-id').value;
        const name = document.getElementById('cat-name').value;
        const img = document.getElementById('cat-img').value;
        const payload = { name, imageUrl: img || 'https://via.placeholder.com/50', status: 'ACTIVE' };
        
        if(id) db.ref(`categories/${id}`).update(payload);
        else db.ref('categories').push(payload);
        
        document.getElementById('modal-category').classList.add('hidden');
        adminUI.toast('Category Saved');
    },

    deleteCategory: (k) => {
        if(confirm("Delete category?")) db.ref(`categories/${k}`).remove();
    },

    renderInventory: () => {
        const list = document.getElementById('admin-products-list');
        list.innerHTML = '';
        const catFilter = document.getElementById('inv-cat-filter').value;
        
        const products = Object.entries(admin.inventoryData);
        if(products.length === 0) list.innerHTML = "<p>No Products Added.</p>";

        products.forEach(([key, p]) => {
            if(catFilter !== 'all' && p.categoryId !== catFilter) return;

            const div = document.createElement('div');
            div.className = 'inv-row';
            div.innerHTML = `
                <div class="inv-details">
                    <img src="${p.imageUrl}">
                    <div>
                        <div style="font-weight:bold">${p.name}</div>
                        <small>₹${p.price} / ${p.unitLabel}</small><br>
                        <small style="color:${p.availableQty > 0 ? 'green':'red'}">${p.availableQty > 0 ? 'In Stock':'Out Stock'}</small>
                    </div>
                </div>
                <div style="display:flex; gap:10px;">
                    <i class="material-icons-round" style="color:#7f8c8d; cursor:pointer;" onclick='adminUI.openProductModal(${JSON.stringify({...p, id:key})})'>edit</i>
                    <i class="material-icons-round" style="color:#e74c3c; cursor:pointer;" onclick="admin.deleteProduct('${key}')">delete</i>
                </div>
            `;
            list.appendChild(div);
        });
    },

    saveProduct: () => {
        const id = document.getElementById('prod-id').value;
        const payload = {
            name: document.getElementById('prod-name').value,
            categoryId: document.getElementById('prod-category').value,
            price: parseFloat(document.getElementById('prod-price').value),
            unitLabel: document.getElementById('prod-unit').value,
            imageUrl: document.getElementById('prod-img').value,
            availableQty: document.getElementById('prod-stock').value === 'true' ? 100 : 0
        };

        if(id) db.ref(`inventory/${id}`).update(payload);
        else db.ref('inventory').push(payload);
        
        document.getElementById('modal-product').classList.add('hidden');
        adminUI.toast('Product Saved');
    },

    deleteProduct: (key) => {
        if(confirm("Delete product?")) db.ref(`inventory/${key}`).remove();
    },

    // ================= SETTINGS =================

    listenSettings: () => {
        db.ref('config').on('value', snap => {
            const data = snap.val() || {};
            // Inputs
            if(document.activeElement !== document.getElementById('conf-del-charge')) 
                document.getElementById('conf-del-charge').value = data.deliveryCharge || 0;
            
            if(document.activeElement !== document.getElementById('conf-surge')) 
                document.getElementById('conf-surge').value = data.surge || 0;

            // Pincodes
            const pinDiv = document.getElementById('pincode-list');
            pinDiv.innerHTML = '';
            if(data.pincodes) {
                Object.keys(data.pincodes).forEach(k => {
                    const pin = data.pincodes[k];
                    const span = document.createElement('span');
                    span.className = 'pin-chip';
                    span.innerHTML = `${pin} <i class="material-icons-round" onclick="admin.deletePincode('${k}')">close</i>`;
                    pinDiv.appendChild(span);
                });
            }
        });
    },

    saveConfig: () => {
        db.ref('config').update({
            deliveryCharge: parseInt(document.getElementById('conf-del-charge').value),
            surge: parseInt(document.getElementById('conf-surge').value)
        });
        adminUI.toast("Settings Saved");
    },

    addPincode: () => {
        const p = document.getElementById('new-pincode').value;
        if(p.length === 6) db.ref('config/pincodes').push(p);
        else alert("Need 6 Digits");
        document.getElementById('new-pincode').value = '';
    },

    deletePincode: (k) => {
        db.ref(`config/pincodes/${k}`).remove();
    }
};