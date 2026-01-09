/**
 * SabziXpress - Inventory Management (Customer View)
 * Fetches Categories & Products, Renders Home Grid
 */

const inventory = {
    categories: {},
    products: {},
    currentCategory: 'ALL',

    init: () => {
        inventory.loadCategories();
        inventory.loadProducts();
    },

    loadCategories: () => {
        const catContainer = document.getElementById('categories-grid');
        
        db.ref('categories').orderByChild('status').equalTo('ACTIVE').on('value', snapshot => {
            const data = snapshot.val();
            if(!data) return;

            inventory.categories = data;
            catContainer.innerHTML = '';

            // Add "All" option manually or just list categories
            // Let's just list categories to filter
            
            Object.keys(data).forEach(key => {
                const cat = data[key];
                const div = document.createElement('div');
                div.className = 'category-item';
                div.onclick = () => inventory.filterByCategory(key, div);
                div.innerHTML = `
                    <img src="${cat.imageUrl}" class="category-img" alt="${cat.name}">
                    <div class="category-name">${cat.name}</div>
                `;
                catContainer.appendChild(div);
            });
        });
    },

    loadProducts: () => {
        const prodContainer = document.getElementById('products-grid');
        
        db.ref('inventory').on('value', snapshot => {
            const data = snapshot.val();
            if(!data) {
                prodContainer.innerHTML = '<p>No products available.</p>';
                return;
            }

            inventory.products = data;
            
            // Initial Render
            inventory.renderProducts(inventory.currentCategory);
        });
    },

    filterByCategory: (catId, domElement) => {
        // Toggle UI selection
        document.querySelectorAll('.category-item').forEach(el => el.classList.remove('selected'));
        if(domElement) domElement.classList.add('selected');

        inventory.currentCategory = catId;
        inventory.renderProducts(catId);
    },

    renderProducts: (catId) => {
        const prodContainer = document.getElementById('products-grid');
        prodContainer.innerHTML = '';
        
        let keys = Object.keys(inventory.products);
        
        // Filter by Category
        if(catId !== 'ALL') {
            keys = keys.filter(k => inventory.products[k].categoryId === catId);
        }

        // Search Filter (if active)
        const searchVal = document.getElementById('product-search').value.toLowerCase();
        if(searchVal) {
            keys = keys.filter(k => inventory.products[k].name.toLowerCase().includes(searchVal));
        }

        if(keys.length === 0) {
            prodContainer.innerHTML = '<p style="grid-column: 1 / -1; text-align:center;">No items found.</p>';
            return;
        }

        keys.forEach(id => {
            const p = inventory.products[id];
            // Skip if hidden/deleted logic needed, but for now show all in DB
            
            const qtyInCart = orders.getQty(id);
            const isOutOfStock = p.availableQty <= 0;

            const div = document.createElement('div');
            div.className = 'product-card';
            div.innerHTML = `
                ${isOutOfStock ? '<div class="out-of-stock-overlay">OUT OF STOCK</div>' : ''}
                <img src="${p.imageUrl}" class="product-img" loading="lazy">
                <div class="product-info">
                    <h3>${p.name}</h3>
                    <div class="product-unit">${p.unitLabel}</div>
                </div>
                <div class="product-footer">
                    <span class="product-price">₹${p.price}</span>
                    ${ 
                       qtyInCart === 0 
                       ? `<button class="btn-add" onclick="orders.addToCart('${id}')" ${isOutOfStock?'disabled':''}>ADD</button>` 
                       : `<div class="qty-control">
                            <button class="qty-btn" onclick="orders.removeFromCart('${id}')">-</button>
                            <span class="qty-val">${qtyInCart}</span>
                            <button class="qty-btn" onclick="orders.addToCart('${id}')">+</button>
                          </div>`
                    }
                </div>
            `;
            prodContainer.appendChild(div);
        });
    }
};

// Bind Search Input
document.getElementById('product-search').addEventListener('input', () => {
    inventory.renderProducts(inventory.currentCategory);
});