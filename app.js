(function() {
    const app = {
        currentUser: null,
        currentView: 'login',
        products: [],
        societies: [
            { id: 1, name: "Elite High Ticket", contribution: 0, members: 0, volume: "0", verified: true },
            { id: 2, name: "Drop de Ouro", contribution: 0, members: 0, volume: "0", verified: true },
            { id: 3, name: "Copy Lab Pro", contribution: 0, members: 0, volume: "0", verified: false }
        ],
        rankings: [
            { pos: 1, name: "Aguardando...", sales: 0.00, avatar: "" },
            { pos: 2, name: "Aguardando...", sales: 0.00, avatar: "" },
            { pos: 3, name: "Aguardando...", sales: 0.00, avatar: "" },
            { pos: 4, name: "Aguardando...", sales: 0.00, avatar: "" },
            { pos: 5, name: "Aguardando...", sales: 0.00, avatar: "" },
            { pos: 6, name: "Aguardando...", sales: 0.00, avatar: "" },
            { pos: 7, name: "Aguardando...", sales: 0.00, avatar: "" },
            { pos: 8, name: "Aguardando...", sales: 0.00, avatar: "" },
            { pos: 9, name: "Aguardando...", sales: 0.00, avatar: "" },
            { pos: 10, name: "Aguardando...", sales: 0.00, avatar: "" }
        ],

        showBalance: true,

        init() {
            this.render('login');
            lucide.createIcons();
        },

        login() {
            this.currentUser = { name: 'Benedito' };
            this.navigate('dashboard');
        },

        logout() {
            this.currentUser = null;
            this.navigate('login');
        },

        navigate(view) {
            this.currentView = view;
            this.render(view);
            
            // Gerenciamento da Nav Global
            const nav = document.getElementById('global-nav');
            if (nav) {
                if (view === 'login') {
                    nav.style.display = 'none';
                } else {
                    nav.style.display = 'flex';
                    // Marcar item ativo
                    nav.querySelectorAll('.nav-item').forEach(item => {
                        if (item.getAttribute('data-view') === view) {
                            item.style.color = '#000';
                        } else {
                            item.style.color = '#ccc';
                        }
                    });
                }
            }

            if (view === 'dashboard') {
                this.renderProducts();
                this.updateBalanceUI();
            }
            if (view === 'mercado' || view === 'store') {
                this.renderStore();
            }
            if (view === 'sociedade') {
                this.renderSociedade();
            }
            if (view === 'hall') {
                this.renderHall();
            }
            if (view === 'criar-produto') {
                this.initCreateProduct();
            }
            lucide.createIcons();
        },

        toggleBalance() {
            this.showBalance = !this.showBalance;
            this.updateBalanceUI();
        },

        updateBalanceUI() {
            const el = document.getElementById('balance-value');
            const icon = document.getElementById('toggle-balance');
            if (el) {
                el.innerText = this.showBalance ? 'R$ 0,00' : '••••••••';
            }
            if (icon) {
                icon.setAttribute('data-lucide', this.showBalance ? 'eye' : 'eye-off');
                lucide.createIcons();
            }
        },

        render(view) {
            const container = document.getElementById('app');
            const template = document.getElementById(`template-${view}`);
            if (template) {
                container.innerHTML = template.innerHTML;
                container.className = 'app-container view-container';
                // Reiniciar animação removendo e recolocando a classe
                container.style.animation = 'none';
                container.offsetHeight; /* trigger reflow */
                container.style.animation = null;
            }
        },

        renderProducts() {
            // Lógica para o dashboard
        },

        renderSociedade() {
            const list = document.getElementById('society-list');
            if (list) {
                list.innerHTML = this.societies.map(s => `
                    <div class="clickable" style="background: #fff; border: 2px solid #f5f5f5; border-radius: 30px; padding: 24px; display: flex; flex-direction: column; gap: 24px; position: relative;">
                        <!-- Top Section -->
                        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 44px; height: 44px; background: #f5f5f5; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                                    <i data-lucide="users" style="width: 22px;"></i>
                                </div>
                                <h4 style="font-weight: 900; font-size: 16px;">${s.name} ${s.verified ? '✔️' : ''}</h4>
                            </div>
                            <div style="text-align: right;">
                                <p style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #ccc; margin-bottom: 2px;">Membros</p>
                                <p style="font-size: 14px; font-weight: 900; color: #000;">${s.members}</p>
                            </div>
                        </div>

                        <!-- Bottom Section -->
                        <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                            <div>
                                <p style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #ccc; margin-bottom: 2px;">Contribuição</p>
                                <p style="font-size: 14px; font-weight: 900;">R$ ${s.contribution}</p>
                            </div>
                            <button class="btn btn-primary clickable" style="height: 42px; width: auto; padding: 0 20px; border-radius: 14px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px;">Solicitar</button>
                        </div>
                    </div>
                `).join('');
                if (window.lucide) {
                    lucide.createIcons();
                }
            }
        },

        renderHall() {
            const first = this.rankings[0];
            const avatarEl = document.getElementById('hall-1st-avatar');
            const nameEl = document.getElementById('hall-1st-name');
            const salesEl = document.getElementById('hall-1st-sales');
            
            if (avatarEl) {
                avatarEl.innerHTML = first.avatar ? `<img src="${first.avatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` : '<div style="width: 100%; height: 100%; background: #f0f0f0; border-radius: 50%;"></div>';
                avatarEl.style.fontSize = '0';
            }
            if (nameEl) nameEl.innerText = first.name;
            if (salesEl) salesEl.innerText = `R$ ${first.sales.toLocaleString('pt-BR')}`;

            const othersSide = document.getElementById('hall-top-others');
            if (othersSide) {
                othersSide.innerHTML = this.rankings.slice(1, 10).map(u => `
                    <div class="clickable" style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #fcfcfc;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 10px; font-weight: 900; color: #ccc; italic; width: 22px;">${u.pos}º</span>
                            <div style="width: 28px; height: 28px; border-radius: 50%; background: #f0f0f0; border: 2px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.05); overflow: hidden;">
                                ${u.avatar ? `<img src="${u.avatar}" style="width: 100%; height: 100%; object-fit: cover;">` : ''}
                            </div>
                            <span style="font-size: 11px; font-weight: 800; color: #000;">${u.name.split(' ')[0]}</span>
                        </div>
                        <span style="font-size: 10px; font-weight: 900; color: #ccc;">${(u.sales/1000).toFixed(0)}k</span>
                    </div>
                `).join('');
            }
            if (window.lucide) lucide.createIcons();
        },

        renderStore() {
            const list = document.getElementById('store-list');
            if (list) {
                list.innerHTML = this.products.map(p => `
                    <div style="background: #fafafa; border-radius: 20px; padding: 20px; border: 1px solid #eee;">
                        <h4 style="font-weight: 800; margin-bottom: 4px;">${p.name}</h4>
                        <p style="font-size: 18px; font-weight: 900;">R$ ${p.price.toFixed(2)}</p>
                        <button class="btn btn-primary" style="height: 48px; width: 100%; border-radius: 12px; margin-top: 12px; font-size: 14px;">Comprar</button>
                    </div>
                `).join('');
            }
        },

        togglePassword() {
            const input = document.getElementById('password');
            if (input) {
                input.type = input.type === 'password' ? 'text' : 'password';
            }
        },

        showModal(id) {
            const container = document.getElementById('modal-container');
            const body = document.getElementById('modal-body');
            const template = document.getElementById(id);
            if (template) {
                body.innerHTML = template.innerHTML;
                container.classList.add('active');
                lucide.createIcons();
            }
        },

        closeModal(e) {
            const container = document.getElementById('modal-container');
            container.classList.remove('active');
        },

        // Lógica de Criação de Produto
        productToCreate: { type: null, name: '', description: '', price: 0, date: '' },

        initCreateProduct() {
            this.productToCreate = { type: null, name: '', description: '', price: 0, date: '' };
        },

        selectProductType(type, btn) {
            this.productToCreate.type = type;
            
            // UI Feedback
            const container = document.getElementById('product-type-selection');
            container.querySelectorAll('button').forEach(b => {
                b.style.borderColor = 'transparent';
                b.style.background = '#f5f5f5';
                b.style.color = '#000';
                b.style.transform = 'scale(1)';
            });
            
            btn.style.borderColor = '#000';
            btn.style.background = '#000';
            btn.style.color = '#fff';
            btn.style.transform = 'scale(1.1)';
            
            // Show Form
            const form = document.getElementById('create-product-form');
            form.style.display = 'flex';
            form.scrollIntoView({ behavior: 'smooth' });
            
            // Conditional Fields
            const ebookUpload = document.getElementById('ebook-upload');
            const cursoUpload = document.getElementById('curso-upload');
            const mentoriaLink = document.getElementById('mentoria-link');
            const mentoriaFields = document.getElementById('mentoria-fields');

            ebookUpload.style.display = type === 'Ebook' ? 'block' : 'none';
            cursoUpload.style.display = type === 'Curso' ? 'block' : 'none';
            mentoriaLink.style.display = type === 'Mentoria' ? 'block' : 'none';
            mentoriaFields.style.display = type === 'Mentoria' ? 'block' : 'none';
            
            lucide.createIcons();
        },

        saveProduct() {
            const name = document.getElementById('prod-name').value;
            const desc = document.getElementById('prod-desc').value;
            const price = document.getElementById('prod-price').value;
            const date = document.getElementById('prod-date').value;

            if (!this.productToCreate.type || !name || !price) {
                alert('Por favor, preencha todos os campos obrigatórios.');
                return;
            }

            const newProduct = {
                id: Date.now(),
                name,
                price: parseFloat(price),
                category: this.productToCreate.type,
                description: desc,
                date: date,
                rating: 5
            };

            this.products.unshift(newProduct);
            alert(`Produto "${name}" criado com sucesso!`);
            this.closeModal();
            if (this.currentView === 'mercado' || this.currentView === 'store') {
                this.renderStore();
            }
        },

        // Busca com expansão para a ESQUERDA
        toggleSearch(active, e) {
            if (e) e.stopPropagation();
            const container = document.getElementById('search-container');
            const input = document.getElementById('search-input');
            const close = document.getElementById('search-close');
            const logo = document.getElementById('nav-logo');
            const createBtn = document.getElementById('nav-create-btn');
            const logout = document.getElementById('nav-logout');

            if (active) {
                // Expande para a esquerda usando flex-growth do container ou posicionamento
                container.style.flex = '1';
                container.style.width = '100%';
                container.style.padding = '0 16px';
                container.style.background = '#fff';
                container.style.border = '1px solid #eee';
                input.style.width = '100%';
                input.style.opacity = '1';
                close.style.display = 'block';
                
                // Esconde os outros para dar espaço
                logo.style.opacity = '0';
                createBtn.style.opacity = '0';
                logout.style.display = 'none';
                
                input.focus();
            } else {
                container.style.flex = 'none';
                container.style.width = '40px';
                container.style.padding = '0';
                container.style.background = '#f5f5f5';
                container.style.border = 'none';
                input.style.width = '0';
                input.style.opacity = '0';
                close.style.display = 'none';
                
                logo.style.opacity = '1';
                createBtn.style.opacity = '1';
                logout.style.display = 'flex';
                input.value = '';
            }
        }
    };

    window.app = app;
    app.init();
})();
