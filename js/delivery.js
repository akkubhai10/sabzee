/**
 * SabziXpress - Delivery Partner Logic
 * Handles Task Assignment, Status Updates, Payment Collection
 */

const delivery = {
    currentUserId: null,
    activeOrder: null, // { id, data }

    init: (uid) => {
        delivery.currentUserId = uid;
        
        // Init Notification Permission for Delivery Boy
        if(window.notifications) window.notifications.requestPermission();
        
        // Listen for assignments
        delivery.listenForTasks();
    },

    listenForTasks: () => {
        // Query orders assigned to this user that are NOT closed
        // Since Firebase simple query limitations, we'll listen to all active orders for this user
        
        db.ref('orders').orderByChild('deliveryPartnerId').equalTo(delivery.currentUserId).on('value', snapshot => {
            const data = snapshot.val();
            
            // Find one active order
            let found = null;
            if(data) {
                Object.keys(data).forEach(key => {
                    const o = data[key];
                    if (o.status !== 'CLOSED' && o.status !== 'DELIVERED') {
                        found = { id: key, ...o };
                    }
                });
            }

            if(found) {
                delivery.activeOrder = found;
                delivery.renderTask(found);
            } else {
                delivery.activeOrder = null;
                delivery.showEmptyState();
            }
        });
    },

    showEmptyState: () => {
        document.getElementById('empty-tasks').classList.remove('hidden');
        document.getElementById('active-task-card').classList.add('hidden');
    },

    renderTask: (order) => {
        document.getElementById('empty-tasks').classList.add('hidden');
        const card = document.getElementById('active-task-card');
        card.classList.remove('hidden');

        // Populate Info
        document.getElementById('task-status').innerText = order.status;
        document.getElementById('task-amt').innerText = `₹${order.amount.grandTotal}`;
        document.getElementById('cust-name').innerText = order.customerName;
        document.getElementById('cust-mobile').innerText = order.customerMobile;
        document.getElementById('btn-call-cust').href = `tel:${order.customerMobile}`;
        document.getElementById('cust-address').innerText = `${order.address} (${order.pincode})`;

        // Items
        const list = document.getElementById('task-items-list');
        list.innerHTML = '';
        order.items.forEach(i => {
            const li = document.createElement('li');
            li.innerText = `${i.qty} x ${i.name} (${i.unit})`;
            list.appendChild(li);
        });

        // Main Action Button Logic
        const btn = document.getElementById('btn-main-action');
        const paySec = document.getElementById('payment-section');
        
        // Reset classes
        btn.className = 'action-big-btn';
        paySec.classList.add('hidden');

        if(order.status === 'OUT_FOR_DELIVERY') {
            // Logic: It was assigned, now they pick it up or straight to delivery?
            // "Confirm / Start Picking -> Pack -> Assign" happened.
            // So status is OUT_FOR_DELIVERY.
            // Button should be "ARRIVED / DELIVER" ?
            // Let's assume they just have to mark Delivered.
            
            btn.innerText = "MARK DELIVERED";
            btn.classList.add('btn-deliver');
            btn.onclick = () => {
                // Show Payment Options first
                btn.classList.add('hidden');
                paySec.classList.remove('hidden');
            };
        } 
        // Note: Additional states could be added (Arrived), but keeping simple per prompt.
    },

    markPaid: (mode) => {
        if(!delivery.activeOrder) return;

        const confirmText = `Confirm payment via ${mode} and close order?`;
        // Standard confirm allowed, or use custom UI. Using simple confirm for speed as allowed by "web features".
        if(confirm(confirmText)) {
            
            const updates = {
                status: 'DELIVERED', // Then triggers 'CLOSED' logically or manually
                paymentStatus: 'PAID',
                paymentMethodCollected: mode,
                deliveredAt: firebase.database.ServerValue.TIMESTAMP
            };

            // Update DB
            db.ref(`orders/${delivery.activeOrder.id}`).update(updates).then(() => {
                
                // Then immediately CLOSE it to clear the screen
                setTimeout(() => {
                    db.ref(`orders/${delivery.activeOrder.id}`).update({ status: 'CLOSED' });
                }, 2000);

                ui.toast("Order Delivered & Closed!");
                
                // Notify Customer
                // In real app, cloud function does this. Here, trigger client side
                // We don't have cust token easily here unless stored in order.
                // Assuming admin sees it via list listener.
            });
        }
    },

    advanceOrder: () => {
        // Fallback for button click
    }
};