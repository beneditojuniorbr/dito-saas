(function() {
    const app = {
        currentUser: null,
        currentView: 'login',
        products: [
            { id: 1, name: "Ebook: O Futuro da Inteligência Artificial", price: 47.90, category: "Ebook", rating: 5 },
            { id: 2, name: "Mentoria Elite SaaS", price: 997.00, category: "Mentoria", rating: 5 },
            { id: 3, name: "Dito CRM", price: 29.90, category: "SaaS", rating: 4 }
        ],
        societies: [
            { id: 1, name: "Elite High Ticket", contribution: 450, members: 12, volume: "850k", verified: true },
            { id: 2, name: "Drop de Ouro", contribution: 150, members: 45, volume: "1.2M", verified: true },
            { id: 3, name: "Copy Lab Pro", contribution: 300, members: 5, volume: "320k", verified: false }
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
            if (view === 'dashboard') {
                this.renderProducts();
                this.updateBalanceUI(); // Garante que o estado do olho seja aplicado ao voltar
            }
            if (view === 'mercado' || view === 'store') {
                this.renderStore();
            }
            if (view === 'sociedade') {
                this.renderSociedade();
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
                el.innerText = this.showBalance ? 'R$ 12.450,00' : '••••••••';
            }
            if (icon) {
                icon.setAttribute('data-lucide', this.showBalance ? 'eye' : 'eye-off');
                lucide.createIcons();
            }
        },

        render(templateId) {
            const container = document.getElementById('app');
            const template = document.getElementById(`template-${templateId}`);
            if (template) {
                container.innerHTML = template.innerHTML;
            }
        },

        renderProducts() {
            // Lógica para o dashboard
        },

        renderSociedade() {
            const list = document.getElementById('society-list');
            if (list) {
                list.innerHTML = this.societies.map(s => `
                    <div style="background: #fff; border: 2px solid #f5f5f5; border-radius: 30px; padding: 24px; transition: 0.3s;" onmouseover="this.style.borderColor='#000'" onmouseout="this.style.borderColor='#f5f5f5'">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                            <div style="display: flex; gap: 16px; align-items: center;">
                                <div style="width: 50px; height: 50px; background: #f5f5f5; border-radius: 15px; display: flex; align-items: center; justify-content: center;">
                                    <i data-lucide="users" style="width: 24px;"></i>
                                </div>
                                <div>
                                    <h4 style="font-weight: 900; font-size: 16px;">${s.name} ${s.verified ? '✔️' : ''}</h4>
                                    <p style="font-size: 11px; color: #999; font-weight: 700;">${s.members} membros ativos</p>
                                </div>
                            </div>
                            <div style="background: #000; color: #fff; padding: 6px 12px; border-radius: 10px; font-size: 10px; font-weight: 900;">
                                VOL: ${s.volume}
                            </div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 1px solid #f5f5f5;">
                            <div style="font-size: 12px; font-weight: 800; color: #999;">
                                Contribuição: <span style="color: #000;">R$ ${s.contribution}</span>
                            </div>
                            <button class="btn btn-primary" style="height: 40px; padding: 0 15px; font-size: 11px; border-radius: 10px;">Solicitar</button>
                        </div>
                    </div>
                `).join('');
            }
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
