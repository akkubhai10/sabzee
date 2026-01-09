/**
 * SabziXpress - Admin Debugged Logic
 * Handling Rendering & Error Reporting accurately
 */

const admin = {
    ordersData: {},
    categoriesData: {},
    productsData: {},
    configData: {},

    init: () => {
        console.log("Admin Dashboard Logic Started...");
        admin.checkPermissions(); // Check notifications
        admin.loadAllData();
    },

    checkPermissions: () => {
        const el = document.getElementById('fcm-status');
        if(el) {
            el.innerText = Notification.permission === 'granted' ? '🔔 Alerts ON' : '🔕 Alerts OFF';
        }
    },

    loadAllData: () => {
        // 1. ORDERS
        db.ref('orders').limitToLast(100).on('value', snap => {
            admin.ordersData = snap.val() || {};
            admin.renderOrders();
            admin.calcStats();
        }, error => alert("Error loading Orders: " + error.message));

        // 2. CATEGORIES
        db.ref('categories').on('value', snap => {
            admin.categoriesData = snap.val() || {};
            admin.renderCategories();
        });

        // 3. INVENTORY (Items)
        db.ref('inventory').on('value', snap => {
            admin.productsData = snap.val() || {};
            admin.renderInventory(); // This handles rendering
        });

        // 4. CONFIG (Pincodes)
        db.ref('config').on('value', snap => {
            admin.configData = snap.val() || {};
            admin.renderConfig();
        });
    },

    // ================== RENDER LOGIC ==================

    calcStats: () => {
        const todayStr = new Date().toDateString();
        let sales = 0;
        let count = 0;
        Object.values(admin.ordersData).forEach(o => {
            if(new Date(o.createdAt).toDateString() === todayStr && o.status !== 'CANCELLED') {
                sales += (o.amount.grandTotal || 0);
                count++;
            }
        });
        if(document.getElementById('stat-sales')) document.getElementById('stat-sales').innerText = `₹${sales}`;
        if(document.getElementById('stat-count')) document.getElementById('stat-count').innerText = count;
    },

    renderOrders: () => {
        const list = document.getElementById('orders-list');
        const filter = document.getElementById('order-filter') ? document.getElementById('order-filter').value : 'ALL';
        list.innerHTML = '';

        const arr = Object.entries(admin.ordersData).sort((a,b) => b[1].createdAt - a[1].createdAt);
        
        if(arr.length === 0) list.innerHTML = '<p style="text-align:center; padding:20px; color:#999;">No Active Orders.</p>';

        arr.forEach(([key, o]) => {
            if(filter !== 'ALL' && o.status !== filter) return;
            // Also skip Closed if looking at ALL
            if(filter === 'ALL' && o.status === 'CLOSED') return;

            // Generate Button HTML
            let actionBtn = `<strong style="color:gray">${o.status}</strong>`;
            if(o.status === 'PLACED') actionBtn = `<button class="btn-primary" onclick="admin.setOrder('${key}', 'PACKING')">Accept Order</button>`;
            else if(o.status === 'PACKING') actionBtn = `<button class="btn-primary" style="background:#2980b9" onclick="admin.setOrder('${key}', 'PACKED')">Mark Packed</button>`;
            else if(o.status === 'PACKED') actionBtn = `<button class="btn-primary" style="background:#f1c40f; color:#000" onclick="adminUI.modal('modal-assign', '${key}')">Assign Rider</button>`;
            else if(o.status === 'OUT_FOR_DELIVERY') actionBtn = `<small>Assigned: ${o.deliveryPartnerName}</small>`;

            let itemsTxt = o.items ? o.items.map(i => `${i.qty} x ${i.name}`).join(', ') : 'No items info';

            const card = document.createElement('div');
            card.className = `order-card ${o.status}`;
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong>#${key.slice(-4)} (${o.customerName})</strong>
                    <strong>₹${o.amount.grandTotal}</strong>
                </div>
                <div style="font-size:0.9rem; color:#555; margin-bottom:8px;">
                    ${o.address} (${o.pincode})
                </div>
                <div style="background:#eee; padding:5px; font-size:0.85rem; margin-bottom:10px;">
                    ${itemsTxt}
                </div>
                <div style="text-align:right;">${actionBtn}</div>
            `;
            list.appendChild(card);
        });
    },

    renderCategories: () => {
        const visual = document.getElementById('category-list-visual');
        const filterSel = document.getElementById('inv-cat-filter');
        
        if(visual) visual.innerHTML = '';
        if(filterSel) {
            // keep 'Show All' option
            while(filterSel.options.length > 1) filterSel.remove(1);
        }

        Object.entries(admin.categoriesData).forEach(([k, c]) => {
            // Update Chip List
            if(visual) {
                visual.innerHTML += `
                    <div style="min-width:120px; text-align:center; padding:10px; border:1px solid #ddd; border-radius:10px; background:white;">
                        <img src="${c.imageUrl}" style="width:40px; height:40px;"><br>
                        <strong>${c.name}</strong><br>
                        <small onclick="admin.delCat('${k}')" style="color:red; cursor:pointer;">Delete</small>
                    </div>
                `;
            }
            // Update Dropdown Filter
            if(filterSel) {
                const o = document.createElement('option');
                o.value = k; o.innerText = c.name;
                filterSel.appendChild(o);
            }
        });
    },

    renderInventory: () => {
        const container = document.getElementById('product-list-container');
        if(!container) return; // Guard

        const catFilter = document.getElementById('inv-cat-filter').value;
        container.innerHTML = '';

        const arr = Object.entries(admin.productsData);
        
        if(arr.length === 0) {
            container.innerHTML = "<p>No Products in Inventory. Add some.</p>";
            return;
        }

        arr.forEach(([key, p]) => {
            // If filtering and no match, skip
            if(catFilter !== 'all' && p.categoryId !== catFilter) return;

            const row = document.createElement('div');
            row.className = 'admin-table-row';
            row.innerHTML = `
                <div style="display:flex; align-items:center;">
                    <img src="${p.imageUrl}" alt="item">
                    <div style="margin-left:10px;">
                        <div class="bold">${p.name}</div>
                        <div style="font-size:0.85rem">₹${p.price} / ${p.unitLabel}</div>
                        ${p.availableQty > 0 ? '<small style="color:green">In Stock</small>' : '<small style="color:red">Out of Stock</small>'}
                    </div>
                </div>
                <div>
                    <button style="border:none; background:none; cursor:pointer;" onclick='adminUI.modal("modal-product", ${JSON.stringify({...p, id:key})})'>✏️</button>
                    <button style="border:none; background:none; cursor:pointer;" onclick="admin.delProduct('${key}')">🗑️</button>
                </div>
            `;
            container.appendChild(row);
        });
    },

    renderConfig: () => {
        // Pincodes
        const list = document.getElementById('pincode-list-visual');
        if(list && admin.configData.pincodes) {
            list.innerHTML = '';
            Object.entries(admin.configData.pincodes).forEach(([k, v]) => {
                list.innerHTML += `<div class="chip">${v} <i class="material-icons-round" onclick="admin.delPin('${k}')">close</i></div>`;
            });
        }
        // Inputs
        if(document.getElementById('conf-charge')) document.getElementById('conf-charge').value = admin.configData.deliveryCharge || 0;
        if(document.getElementById('conf-surge')) document.getElementById('conf-surge').value = admin.configData.surge || 0;
    },

    // ================== ACTIONS ==================

    setOrder: (k, s) => db.ref(`orders/${k}`).update({status: s}),
    
    saveCategory: () => {
        const name = document.getElementById('c-name').value;
        const img = document.getElementById('c-img').value;
        if(!name) return alert("Category Name Required");
        
        db.ref('categories').push({ name, imageUrl: img || '', status: 'ACTIVE' })
        .then(() => { adminUI.closeAll(); adminUI.toast("Category Added!"); })
        .catch(err => alert("Error: " + err.message));
    },

    saveProduct: () => {
        const id = document.getElementById('p-id').value;
        const payload = {
            name: document.getElementById('p-name').value,
            categoryId: document.getElementById('p-cat').value,
            price: Number(document.getElementById('p-price').value),
            unitLabel: document.getElementById('p-unit').value,
            imageUrl: document.getElementById('p-img').value,
            availableQty: document.getElementById('p-stock').value === 'true' ? 100 : 0
        };

        if(!payload.categoryId) return alert("Select a Category First!");
        if(!payload.name) return alert("Enter Product Name");

        const ref = id ? db.ref(`inventory/${id}`) : db.ref('inventory').push();
        
        (id ? ref.update(payload) : ref.set(payload))
        .then(() => { adminUI.closeAll(); adminUI.toast("Product Saved!"); })
        .catch(err => alert("Write Error: " + err.message));
    },

    delCat: (k) => confirm("Delete Category?") ? db.ref(`categories/${k}`).remove() : null,
    delProduct: (k) => confirm("Delete Product?") ? db.ref(`inventory/${k}`).remove() : null,
    delPin: (k) => db.ref(`config/pincodes/${k}`).remove(),

    addPincode: () => {
        const p = document.getElementById('new-pincode').value;
        if(p.length===6) db.ref('config/pincodes').push(p);
        document.getElementById('new-pincode').value = '';
    },
    
    saveSettings: () => {
        db.ref('config').update({
            deliveryCharge: Number(document.getElementById('conf-charge').value),
            surge: Number(document.getElementById('conf-surge').value)
        }).then(() => adminUI.toast("Settings Saved"));
    }
};

// HELPER TO POPULATE SELECT
adminUI.modal = (id, dataOrId = null) => {
    // Hide all
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    
    // Fill category Select for product modal
    if(id === 'modal-product') {
        const sel = document.getElementById('p-cat');
        sel.innerHTML = '';
        if(Object.keys(admin.categoriesData).length === 0) {
            alert("No Categories found! Create a Category first.");
            return;
        }
        Object.entries(admin.categoriesData).forEach(([k, c]) => {
            const op = document.createElement('option');
            op.value = k; op.innerText = c.name;
            sel.appendChild(op);
        });
    }

    // Logic for specific modals
    if(id === 'modal-product') {
        if(dataOrId && typeof dataOrId === 'object') {
            // EDIT MODE
            const d = dataOrId;
            document.getElementById('p-id').value = d.id;
            document.getElementById('p-name').value = d.name;
            document.getElementById('p-price').value = d.price;
            document.getElementById('p-unit').value = d.unitLabel;
            document.getElementById('p-img').value = d.imageUrl;
            document.getElementById('p-cat').value = d.categoryId;
            document.getElementById('p-stock').value = d.availableQty > 0 ? "true" : "false";
        } else {
            // NEW MODE
            document.getElementById('p-id').value = "";
            document.getElementById('p-name').value = "";
            document.getElementById('p-price').value = "";
        }
    }
    
    if(id === 'modal-assign') {
        admin.openRiderModal(dataOrId); // here dataOrId is order ID
        return; // admin.openRiderModal handles visibility
    }

    document.getElementById(id).classList.remove('hidden');
};