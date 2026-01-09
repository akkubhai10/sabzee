/**
 * SabziXpress - Admin Logic (Fixed & Updated)
 * Includes Category CRUD, Pincode Deletion, and FCM Status Check
 */

const admin = {
    ordersData: {},
    inventoryData: {},
    categories: {},
    deliveryPartners: {},
    configData: {},

    init: () => {
        console.log("Admin Dashboard Initialized");

        // 1. Check Notification Permission Visual
        if(Notification.permission === 'granted') {
            document.getElementById('fcm-status-indicator').innerHTML = '<span style="color:#2ecc71">● Active</span>';
        } else if (Notification.permission === 'denied') {
            document.getElementById('fcm-status-indicator').innerHTML = '<span style="color:#e74c3c">● Blocked</span>';
        } else {
            document.getElementById('fcm-status-indicator').innerText = "⚪ Enable Click Here";
            document.getElementById('fcm-status-indicator').style.cursor = "pointer";
            document.getElementById('fcm-status-indicator').onclick = () => {
                window.notifications.requestPermission();
                setTimeout(() => window.location.reload(), 2000); // Reload to reflect status
            };
        }

        // 2. Load Data Listeners
        admin.listenOrders();
        admin.listenInventory();
        admin.listenSettings(); 
    },

    // --- ORDERS SECTION ---
    
    listenOrders: () => {
        const container = document.getElementById('orders-container');
        db.ref('orders').limitToLast(50).on('value', snapshot => {
            const data = snapshot.val();
            if(!data) {
                container.innerHTML = '<p class="text-center" style="margin-top:20px; color:#999;">No Active Orders.</p>';
                admin.ordersData = {};
                return;
            }
            admin.ordersData = data;
            admin.renderOrders();
        });
    },

    renderOrders: () => {
        const filter = document.getElementById('order-filter').value;
        const container = document.getElementById('orders-container');
        container.innerHTML = '';

        const keys = Object.keys(admin.ordersData).sort((a,b) => admin.ordersData[b].createdAt - admin.ordersData[a].createdAt);
        let found = false;

        keys.forEach(key => {
            const o = admin.ordersData[key];
            if(filter !== 'ALL' && o.status !== filter) return;
            if(filter === 'ALL' && o.status === 'CLOSED') return;
            found = true;

            let itemsHtml = '<ul style="font-size:0.9rem; margin:10px 0; padding-left:20px; color:#555;">';
            if(o.items) {
                o.items.forEach(i => { itemsHtml += `<li>${i.qty} x ${i.name} (${i.unit})</li>`; });
            }
            itemsHtml += '</ul>';

            let btnHtml = '';
            if(o.status === 'PLACED') {
                btnHtml = `<button class="btn-primary" onclick="admin.updateOrderStatus('${key}', 'PACKING')">Accept & Pack</button>`;
            } else if (o.status === 'PACKING') {
                btnHtml = `<button class="btn-primary" style="background:#3498db" onclick="admin.updateOrderStatus('${key}', 'PACKED')">Mark Packed</button>`;
            } else if (o.status === 'PACKED') {
                btnHtml = `<button class="btn-primary" style="background:#f1c40f; color:black;" onclick="adminUI.openAssignModal('${key}')">Assign Rider</button>`;
            } else {
                btnHtml = `<small style="color:green;">${o.status}</small>`;
            }

            const div = document.createElement('div');
            div.className = `order-card ${o.status}`;
            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <span class="status-badge bg-${o.status}">${o.status}</span><br>
                        <small>#${key.slice(-4)}</small>
                    </div>
                    <div style="text-align:right;">
                        <span class="bold">₹${o.amount.grandTotal}</span><br>
                        <small>${new Date(o.createdAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small>
                    </div>
                </div>
                <div style="margin-top:5px; border-top:1px dashed #ddd; padding-top:5px;">
                    <strong>${o.customerName}</strong> (<a href="tel:${o.customerMobile}">${o.customerMobile}</a>)<br>
                    <small>${o.address} - <b>${o.pincode}</b></small>
                </div>
                ${itemsHtml}
                <div class="action-row">${btnHtml}</div>
            `;
            container.appendChild(div);
        });
        
        if(!found) container.innerHTML = '<p class="text-center" style="margin-top:20px;">No orders match this filter.</p>';
    },

    updateOrderStatus: (id, status) => {
        db.ref(`orders/${id}`).update({ status: status });
        adminUI.toast(`Order updated to ${status}`);
    },

    openAssignModal: (orderId) => {
        document.getElementById('modal-assign-delivery').classList.remove('hidden');
        // Fetch riders freshly
        db.ref('users').orderByChild('role').equalTo('DELIVERY').once('value').then(snap => {
            const list = document.getElementById('assign-list-container');
            list.innerHTML = '';
            const riders = snap.val();
            if(!riders) {
                list.innerHTML = "No Delivery Partners found."; 
                return;
            }
            Object.keys(riders).forEach(rid => {
                const r = riders[rid];
                const btn = document.createElement('div');
                btn.innerHTML = `
                    <div style="padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                        <span>${r.name}<br><small>${r.mobile}</small></span>
                        <button class="btn-primary" style="font-size:0.8rem" onclick="admin.assignOrder('${orderId}', '${rid}', '${r.name}')">Assign</button>
                    </div>
                `;
                list.appendChild(btn);
            });
        });
    },

    assignOrder: (orderId, dpId, dpName) => {
        db.ref(`orders/${orderId}`).update({
            status: 'OUT_FOR_DELIVERY',
            deliveryPartnerId: dpId,
            deliveryPartnerName: dpName
        });
        document.getElementById('modal-assign-delivery').classList.add('hidden');
        adminUI.toast("Assigned to " + dpName);
        
        // Push Notification logic
        db.ref(`fcmTokens/${dpId}`).once('value').then(s => {
            if(s.val() && window.notifications) window.notifications.sendToToken(s.val(), "New Order", "Pack Order Assigned to you!");
        });
    },

    // --- INVENTORY (Updated with Categories) ---
    
    listenInventory: () => {
        // 1. Categories
        db.ref('categories').on('value', snap => {
            admin.categories = snap.val() || {};
            admin.renderCategories();
        });
        // 2. Products
        db.ref('inventory').on('value', snap => {
            admin.inventoryData = snap.val() || {};
            admin.renderInventory();
        });
    },

    // CATEGORY CRUD
    renderCategories: () => {
        const div = document.getElementById('admin-categories-list');
        div.innerHTML = '';
        const keys = Object.keys(admin.categories);
        
        if(keys.length === 0) div.innerHTML = "<small>No Categories yet. Add one.</small>";

        // Update Filters in Inventory View
        const filterSelect = document.getElementById('inv-cat-filter');
        // keep first option "All"
        while(filterSelect.options.length > 1) { filterSelect.remove(1); }

        keys.forEach(k => {
            const c = admin.categories[k];
            
            // Add to UI List
            const row = document.createElement('div');
            row.className = 'cat-row';
            row.innerHTML = `
                <div style="display:flex; align-items:center;">
                    <img src="${c.imageUrl}" style="width:30px; height:30px; border-radius:4px; margin-right:10px; object-fit:cover;">
                    <span style="${c.status==='DISABLED'?'text-decoration:line-through; color:red':''}">${c.name}</span>
                </div>
                <div>
                    <button class="btn-icon" onclick='adminUI.openCategoryModal(${JSON.stringify({...c, id:k})})'><span class="material-icons-round">edit</span></button>
                    <button class="btn-icon" onclick="admin.deleteCategory('${k}')"><span class="material-icons-round" style="color:red">delete</span></button>
                </div>
            `;
            div.appendChild(row);

            // Add to Filter
            const opt = document.createElement('option');
            opt.value = k;
            opt.innerText = c.name;
            filterSelect.appendChild(opt);
        });
    },

    saveCategory: () => {
        const id = document.getElementById('cat-id').value;
        const name = document.getElementById('cat-name').value;
        const img = document.getElementById('cat-img').value;
        const status = document.getElementById('cat-status').value;
        
        if(!name) return alert("Name is required");

        const data = { name, imageUrl: img || 'https://via.placeholder.com/50', status };
        
        if(id) {
            db.ref(`categories/${id}`).update(data);
        } else {
            db.ref('categories').push(data);
        }
        document.getElementById('modal-category').classList.add('hidden');
        adminUI.toast("Category Saved");
    },

    deleteCategory: (id) => {
        if(confirm("Delete this category? Products inside might look broken.")) {
            db.ref(`categories/${id}`).remove();
        }
    },

    // PRODUCT RENDER
    renderInventory: () => {
        const container = document.getElementById('admin-products-list');
        const filter = document.getElementById('inv-cat-filter').value;
        
        container.innerHTML = '';
        const keys = Object.keys(admin.inventoryData);

        if(keys.length === 0) {
            container.innerHTML = "<p>No products yet.</p>";
            return;
        }

        keys.forEach(k => {
            const p = admin.inventoryData[k];
            // Filter
            if(filter !== 'all' && p.categoryId !== filter) return;

            const div = document.createElement('div');
            div.className = 'inventory-item';
            div.innerHTML = `
                <div style="display:flex;">
                    <img src="${p.imageUrl}">
                    <div>
                        <strong>${p.name}</strong> (${p.unitLabel})<br>
                        Price: ₹${p.price} <br>
                        Stock: ${p.availableQty > 0 ? '<span style="color:green">YES</span>' : '<span style="color:red">NO</span>'}
                    </div>
                </div>
                <button class="btn-secondary" onclick='adminUI.openProductModal(${JSON.stringify({...p, id:k})})'>Edit</button>
            `;
            container.appendChild(div);
        });
    },
    
    // Simplifies filter logic
    filterInventory: () => admin.renderInventory(),

    saveProduct: () => {
        const id = document.getElementById('prod-id').value;
        const name = document.getElementById('prod-name').value;
        const cat = document.getElementById('prod-category').value;
        
        if(!cat || cat.includes("Please Create")) return alert("Please create a category first.");

        const data = {
            name: name,
            categoryId: cat,
            price: parseFloat(document.getElementById('prod-price').value),
            unitLabel: document.getElementById('prod-unit').value,
            imageUrl: document.getElementById('prod-img').value,
            availableQty: document.getElementById('prod-stock').value === 'true' ? 100 : 0
        };

        if(id) db.ref(`inventory/${id}`).update(data);
        else db.ref('inventory').push(data);

        document.getElementById('modal-product').classList.add('hidden');
        adminUI.toast("Product Saved");
    },


    // --- SETTINGS SECTION ---
    
    listenSettings: () => {
        db.ref('config').on('value', snap => {
            admin.configData = snap.val() || {};
            // 1. Config inputs
            document.getElementById('conf-del-charge').value = admin.configData.deliveryCharge || 0;
            document.getElementById('conf-surge').value = admin.configData.surge || 0;
            
            // 2. Pincodes render
            const pinContainer = document.getElementById('pincode-list');
            pinContainer.innerHTML = '';
            
            const pins = admin.configData.pincodes || {};
            // Check if pins is object or array. Usually firebase push makes it object with random keys.
            Object.keys(pins).forEach(key => {
                const val = pins[key];
                const span = document.createElement('span');
                span.className = 'pin-chip';
                span.innerHTML = `${val} <i class="material-icons-round" onclick="admin.deletePincode('${key}')">close</i>`;
                pinContainer.appendChild(span);
            });
        });
        
        // Partners List logic remains same
    },

    saveConfig: () => {
        const updates = {
            deliveryCharge: parseInt(document.getElementById('conf-del-charge').value),
            surge: parseInt(document.getElementById('conf-surge').value)
        };
        db.ref('config').update(updates);
        adminUI.toast("Configuration updated!");
    },

    addPincode: () => {
        const p = document.getElementById('new-pincode').value;
        if(p.length === 6) {
            db.ref('config/pincodes').push(p);
            document.getElementById('new-pincode').value = '';
            adminUI.toast("Pincode Added");
        } else {
            alert("Enter 6 digit pincode");
        }
    },

    deletePincode: (key) => {
        if(confirm("Remove this pincode?")) {
            db.ref(`config/pincodes/${key}`).remove();
        }
    },
    
    addPartner: () => {
        alert("Instruction:\nTo Add a Delivery Partner:\n1. User should register on the App normally.\n2. You (Admin) go to Firebase Console > Database > users > [UserID] -> change 'role' to 'DELIVERY'.\n\nThis app does not have Cloud Functions to create accounts programmatically.");
    }
};