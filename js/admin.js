/**
 * SabziXpress - Admin Controller (Full Logic)
 * Ensures robust reading of Order Data, Inventory, and Settings.
 */

const admin = {
    ordersData: {},
    categoriesData: {},
    productsData: {},
    configData: {},

    init: () => {
        console.log("Admin Loaded... syncing data.");
        // Initialize listeners
        admin.listenOrders();
        admin.listenInventory();
        admin.listenConfig();
    },

    // ============================================
    //  ORDERS & STATS
    // ============================================

    listenOrders: () => {
        db.ref('orders').orderByChild('createdAt').limitToLast(100).on('value', snap => {
            admin.ordersData = snap.val() || {};
            admin.renderOrders();
            admin.calcStats();
        });
    },

    calcStats: () => {
        const todayStr = new Date().toDateString();
        let total = 0;
        let count = 0;

        Object.values(admin.ordersData).forEach(o => {
            if(!o.createdAt) return;
            const d = new Date(o.createdAt).toDateString();
            if(d === todayStr && o.status !== 'CANCELLED') {
                total += (o.amount.grandTotal || 0);
                count++;
            }
        });
        
        // Update DOM safely
        if(document.getElementById('stat-sales')) document.getElementById('stat-sales').innerText = `₹${total}`;
        if(document.getElementById('stat-count')) document.getElementById('stat-count').innerText = count;
    },

    renderOrders: () => {
        const list = document.getElementById('orders-list');
        const filter = document.getElementById('order-filter').value;
        list.innerHTML = '';

        const arr = Object.entries(admin.ordersData).sort((a,b) => b[1].createdAt - a[1].createdAt);

        if(arr.length === 0) {
            list.innerHTML = `<div class="text-center" style="padding:40px; color:#888;">No Active Orders</div>`;
            return;
        }

        arr.forEach(([key, order]) => {
            if(filter !== 'ALL' && order.status !== filter) return;
            // Also hide closed if ALL
            if(filter === 'ALL' && order.status === 'CLOSED') return;

            let btnAction = '';
            
            // State Machine for Buttons
            if(order.status === 'PLACED') {
                btnAction = `<button class="btn-primary" onclick="admin.setStatus('${key}','PACKING')">ACCEPT & PACK</button>`;
            } else if (order.status === 'PACKING') {
                btnAction = `<button class="btn-primary" style="background:#2980b9" onclick="admin.setStatus('${key}','PACKED')">MARK PACKED</button>`;
            } else if (order.status === 'PACKED') {
                btnAction = `<button class="btn-primary" style="background:#f39c12; color:#000" onclick="admin.openRiderModal('${key}')">ASSIGN RIDER</button>`;
            } else {
                btnAction = `<span style="font-weight:bold; color:green">${order.status}</span>`;
            }

            // Items List
            let itemStr = '';
            if(order.items) order.items.forEach(i => itemStr += `${i.qty} x ${i.name} `);

            const card = document.createElement('div');
            card.className = `order-card ${order.status}`; // Uses style.css color codes
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <span class="bold">#${key.slice(-4)} ${order.customerName}</span>
                    <span class="bold">₹${order.amount.grandTotal}</span>
                </div>
                <div style="font-size:0.9rem; margin-bottom:10px;">
                    ${order.address}<br>
                    <b>${order.pincode}</b> | Ph: <a href="tel:${order.customerMobile}">${order.customerMobile}</a>
                </div>
                <div style="background:#f9f9f9; padding:5px; font-size:0.85rem; border-radius:4px; margin-bottom:10px; color:#555;">
                    ${itemStr}
                </div>
                <div class="action-row">${btnAction}</div>
            `;
            list.appendChild(card);
        });
    },

    setStatus: (oid, st) => {
        db.ref(`orders/${oid}`).update({ status: st });
        adminUI.toast("Order updated: " + st);
    },

    openRiderModal: (oid) => {
        document.getElementById('modal-assign').classList.remove('hidden');
        // Load Riders
        const cont = document.getElementById('rider-list');
        cont.innerHTML = 'Loading riders...';
        
        db.ref('users').orderByChild('role').equalTo('DELIVERY').once('value').then(snap => {
            const riders = snap.val() || {};
            cont.innerHTML = '';
            
            if(Object.keys(riders).length === 0) {
                cont.innerHTML = "No Delivery Partners registered.";
                return;
            }

            Object.keys(riders).forEach(uid => {
                const r = riders[uid];
                const div = document.createElement('div');
                div.className = 'admin-table-row';
                div.innerHTML = `
                    <div style="font-weight:bold;">${r.name}</div>
                    <button class="btn-primary" style="font-size:0.8rem" onclick="admin.assign('${oid}', '${uid}', '${r.name}')">Assign</button>
                `;
                cont.appendChild(div);
            });
        });
    },

    assign: (oid, uid, name) => {
        db.ref(`orders/${oid}`).update({ status: 'OUT_FOR_DELIVERY', deliveryPartnerId: uid, deliveryPartnerName: name });
        adminUI.closeAll();
        adminUI.toast(`Assigned to ${name}`);
    },

    // ============================================
    //  INVENTORY MANAGEMENT (Tables & CRUD)
    // ============================================

    listenInventory: () => {
        // Fetch Categories
        db.ref('categories').on('value', snap => {
            admin.categoriesData = snap.val() || {};
            admin.renderCategoryList();
        });

        // Fetch Products
        db.ref('inventory').on('value', snap => {
            admin.productsData = snap.val() || {};
            admin.renderInventory();
        });
    },

    renderCategoryList: () => {
        const vis = document.getElementById('category-list-visual');
        const select = document.getElementById('inv-cat-filter');
        
        vis.innerHTML = '';
        // Clear Select except All
        while(select.options.length > 1) select.remove(1);

        Object.entries(admin.categoriesData).forEach(([key, cat]) => {
            // Chip UI
            const chip = document.createElement('div');
            chip.style = "min-width:100px; padding:10px; background:white; border-radius:8px; border:1px solid #ccc; text-align:center;";
            chip.innerHTML = `
                <img src="${cat.imageUrl}" style="width:30px; height:30px;"><br>
                <b>${cat.name}</b><br>
                <button onclick="admin.delCategory('${key}')" style="color:red; background:none; border:none; margin-top:5px; cursor:pointer; font-size:0.8rem;">Delete</button>
            `;
            vis.appendChild(chip);

            // Filter Dropdown
            const opt = document.createElement('option');
            opt.value = key;
            opt.innerText = cat.name;
            select.appendChild(opt);
        });
    },

    // Populate Category Select inside Add/Edit Modal dynamically
    populateCategorySelect: () => {
        const pCat = document.getElementById('p-cat');
        pCat.innerHTML = '';
        Object.entries(admin.categoriesData).forEach(([key, cat]) => {
            const op = document.createElement('option');
            op.value = key; op.innerText = cat.name;
            pCat.appendChild(op);
        });
    },

    renderInventory: () => {
        const container = document.getElementById('product-list-container');
        const filter = document.getElementById('inv-cat-filter').value;
        container.innerHTML = '';

        Object.entries(admin.productsData).forEach(([key, p]) => {
            if(filter !== 'all' && p.categoryId !== filter) return;

            const div = document.createElement('div');
            div.className = 'admin-table-row';
            div.innerHTML = `
                <div style="display:flex; align-items:center;">
                    <img src="${p.imageUrl}">
                    <div>
                        <div class="bold">${p.name}</div>
                        <div style="font-size:0.85rem; color:#666;">₹${p.price} / ${p.unitLabel}</div>
                        ${p.availableQty <= 0 ? '<span style="color:red; font-size:0.8rem; font-weight:bold;">OUT OF STOCK</span>' : ''}
                    </div>
                </div>
                <div class="row-actions">
                    <i class="material-icons-round" style="color:blue" onclick='admin.editProduct(${JSON.stringify({...p, id:key})})'>edit</i>
                    <i class="material-icons-round" style="color:red" onclick="admin.delProduct('${key}')">delete</i>
                </div>
            `;
            container.appendChild(div);
        });
    },

    editProduct: (obj) => {
        adminUI.modal('modal-product');
        // Fill form
        document.getElementById('p-id').value = obj.id;
        document.getElementById('p-name').value = obj.name;
        document.getElementById('p-price').value = obj.price;
        document.getElementById('p-unit').value = obj.unitLabel;
        document.getElementById('p-img').value = obj.imageUrl;
        document.getElementById('p-cat').value = obj.categoryId;
        document.getElementById('p-stock').value = obj.availableQty > 0 ? "true" : "false";
    },

    saveProduct: () => {
        const id = document.getElementById('p-id').value;
        const payload = {
            name: document.getElementById('p-name').value,
            price: parseFloat(document.getElementById('p-price').value),
            unitLabel: document.getElementById('p-unit').value,
            imageUrl: document.getElementById('p-img').value,
            categoryId: document.getElementById('p-cat').value,
            availableQty: document.getElementById('p-stock').value === "true" ? 100 : 0
        };

        if(id) db.ref(`inventory/${id}`).update(payload);
        else db.ref('inventory').push(payload);
        
        adminUI.closeAll();
        adminUI.toast("Item Saved Successfully");
    },

    saveCategory: () => {
        const name = document.getElementById('c-name').value;
        if(!name) return;
        const img = document.getElementById('c-img').value || 'https://via.placeholder.com/50';
        
        db.ref('categories').push({ name, imageUrl: img, status:'ACTIVE' });
        adminUI.closeAll();
        adminUI.toast("Category Created");
    },

    delProduct: (k) => { if(confirm("Remove item?")) db.ref(`inventory/${k}`).remove(); },
    delCategory: (k) => { if(confirm("Remove Category? Items linked to this might break!")) db.ref(`categories/${k}`).remove(); },

    // ============================================
    //  SETTINGS (CONFIG & PINCODES)
    // ============================================

    listenConfig: () => {
        db.ref('config').on('value', snap => {
            const conf = snap.val() || {};
            // Charges
            if(document.activeElement.id !== 'conf-charge') document.getElementById('conf-charge').value = conf.deliveryCharge || 0;
            if(document.activeElement.id !== 'conf-surge') document.getElementById('conf-surge').value = conf.surge || 0;

            // Pincodes
            const pinDiv = document.getElementById('pincode-list-visual');
            pinDiv.innerHTML = '';
            if(conf.pincodes) {
                Object.entries(conf.pincodes).forEach(([key, val]) => {
                    const ch = document.createElement('div');
                    ch.className = 'chip';
                    ch.innerHTML = `${val} <i class="material-icons-round" onclick="admin.delPin('${key}')">cancel</i>`;
                    pinDiv.appendChild(ch);
                });
            }
        });
    },

    saveSettings: () => {
        const c = parseInt(document.getElementById('conf-charge').value);
        const s = parseInt(document.getElementById('conf-surge').value);
        db.ref('config').update({ deliveryCharge: c, surge: s });
        adminUI.toast("Pricing Updated");
    },

    addPincode: () => {
        const p = document.getElementById('new-pincode').value;
        if(p.length === 6) db.ref('config/pincodes').push(p);
        else alert("6 Digit Required");
        document.getElementById('new-pincode').value = '';
    },

    delPin: (k) => db.ref(`config/pincodes/${k}`).remove()
};