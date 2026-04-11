(function() {
    const app = {
        currentUser: null,
        currentView: 'dashboard',
        marketView: 'home',
        selectedProduct: null,
        cart: JSON.parse(localStorage.getItem('dito_cart') || '[]'),
        products: [],
        balance: 0.00,
        showBalance: true,

        init() {
            // Splash Screen Logic
            setTimeout(() => {
                const splash = document.getElementById('splash-screen');
                if (splash) {
                    splash.style.opacity = '0';
                    splash.style.pointerEvents = 'none';
                    setTimeout(() => splash.remove(), 800);
                }
            }, 1500);

            try {
                console.log("Iniciando o Dito app...");
                
                // Força o reinício dos posts para zerar conforme solicitado
                localStorage.removeItem('dito_profile_posts');
                
                // Carrega dados
                this.products = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
                const savedUser = localStorage.getItem('current_user_vanilla');
                
                if (savedUser) {
                    this.currentUser = JSON.parse(savedUser);
                } else {
                    this.currentUser = {
                        username: "benedito_pro",
                        name: "Benedito Santos",
                        bio: "Infoprodutor de Elite | Especialista em SaaS 🚀",
                        avatar: ""
                    };
                }

                // Inicia sempre na tela de login conforme solicitado
                this.checkNotifications();
                this.navigate('login');
                
                // Ativa ícones
                if (window.lucide) lucide.createIcons();
                
                console.log("App carregado com sucesso!");
            } catch (err) {
                console.error("Erro no INIT:", err);
                document.getElementById('app').innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">Erro ao iniciar: ${err.message}</div>`;
            }
        },

        setMarketView(view) {
            this.marketView = view;
            this.renderStore();
        },

        renderStore() {
            const container = document.getElementById('market-view-container');
            if (!container) {
                // Se o container ainda não apareceu, tenta de novo em 50ms
                setTimeout(() => this.renderStore(), 50);
                return;
            }

            if (this.marketView === 'home') this.renderMarketHome(container);
            if (this.marketView === 'product') this.renderMarketProduct(container);
            if (this.marketView === 'cart') this.renderMarketCart(container);
            
            if (window.lucide) lucide.createIcons();
        },

        renderMarketHome(container) {
            const temp = document.getElementById('template-mercado-home');
            container.innerHTML = temp.innerHTML;
            
            // Mock de produtos se não houver no local
            const saved = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
            const marketProducts = saved.length > 0 ? saved : [
                { id: 'm1', name: "Método Escala Rápida", price: 97.00, oldPrice: 197.00, rating: 4.8, sales: 1240, seller: "Benedito" },
                { id: 'm2', name: "Template Notion PRO", price: 47.00, oldPrice: 87.00, rating: 4.9, sales: 850, seller: "Ana" }
            ];

            // Render Flash Deals
            const flashList = document.getElementById('flash-deals-list');
            flashList.innerHTML = marketProducts.map(p => `
                <div onclick="app.viewProduct('${p.id}')" style="width: 140px; shrink-0; cursor: pointer;">
                    <div style="width: 140px; height: 140px; background: #f5f5f5; border-radius: 20px; margin-bottom: 8px; position: relative; display: flex; align-items: center; justify-content: center;">
                        <i data-lucide="shopping-bag" style="color: #ddd;"></i>
                         ${p.oldPrice ? `<span style="position: absolute; top: 10px; right: 10px; background: #ee4d2d; color: #fff; font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 10px;">-${Math.round((p.oldPrice-p.price)/p.oldPrice*100)}%</span>` : ''}
                    </div>
                    <p style="font-size: 11px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name}</p>
                    <div style="display: flex; align-items: baseline; gap: 5px;">
                        <span style="font-size: 13px; font-weight: 900; color: #ee4d2d;">R$ ${p.price.toFixed(2)}</span>
                    </div>
                </div>
            `).join('');

            // Render Main Feed
            const feed = document.getElementById('main-market-feed');
            feed.innerHTML = marketProducts.map(p => `
                <div onclick="app.viewProduct('${p.id}')" style="cursor: pointer;">
                    <div style="aspect-ratio: 1; background: #f8f8f8; border-radius: 20px; margin-bottom: 12px; display: flex; align-items: center; justify-content: center;">
                        <i data-lucide="shopping-bag" style="color: #eee; width: 40px;"></i>
                    </div>
                    <h4 style="font-size: 12px; font-weight: 900; margin-bottom: 4px;">${p.name.toLowerCase()}</h4>
                    <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 8px;">
                        <i data-lucide="star" style="width: 10px; color: #facc15; fill: #facc15;"></i>
                        <span style="font-size: 10px; font-weight: 700; color: #ccc;">${p.rating} | ${p.sales} vendidos</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 15px; font-weight: 900;">R$ ${p.price.toFixed(2)}</span>
                        <div style="width: 32px; height: 32px; background: #000; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff;">
                             <i data-lucide="plus" style="width: 16px;"></i>
                        </div>
                    </div>
                </div>
            `).join('');

            // Contador do carrinho
            document.getElementById('market-cart-count').innerText = this.cart.length;
        },

        viewProduct(id) {
            const saved = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
            const mocks = [{ id: 'm1', name: "Método Escala Rápida", price: 97.00, oldPrice: 197.00, rating: 4.8, sales: 1240, seller: "Benedito", description: "O guia definitivo para escalar seus anúncios de forma profissional." }, { id: 'm2', name: "Template Notion PRO", price: 47.00, oldPrice: 87.00, rating: 4.9, sales: 850, seller: "Ana", description: "Organize seus projetos e lucro com este dashboard completo." }];
            this.selectedProduct = [...saved, ...mocks].find(p => p.id === id);
            this.setMarketView('product');
        },

        renderMarketProduct(container) {
            const temp = document.getElementById('template-mercado-produto');
            container.innerHTML = temp.innerHTML;
            const p = this.selectedProduct;
            if (!p) return;

            document.getElementById('product-detail-content').innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                    <h1 style="font-size: 28px; font-weight: 900; letter-spacing: -1px; width: 70%;">${p.name.toLowerCase()}</h1>
                    <div style="text-align: right;">
                        <span style="display: block; font-size: 22px; font-weight: 900; color: #ee4d2d;">R$ ${p.price.toFixed(2)}</span>
                        ${p.oldPrice ? `<span style="font-size: 12px; font-weight: 700; color: #ccc; text-decoration: line-through;">R$ ${p.oldPrice.toFixed(2)}</span>` : ''}
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 24px;">
                     <i data-lucide="star" style="width: 14px; color: #facc15; fill: #facc15;"></i>
                     <span style="font-size: 12px; font-weight: 800; color: #bbb;">${p.rating} (${p.sales} avaliações)</span>
                </div>
                <p style="font-size: 14px; color: #666; font-weight: 500; line-height: 1.6; margin-bottom: 32px;">${p.description || 'Sem descrição detalhada disponível para este produto no momento.'}</p>
                
                <div style="background: #fdfdfd; padding: 20px; border-radius: 20px; border: 1px solid #f5f5f5; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 44px; height: 44px; background: #000; color: #fff; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 900;">${p.seller[0]}</div>
                        <div>
                            <p style="font-size: 12px; font-weight: 900;">${p.seller}</p>
                            <p style="font-size: 10px; color: #ccc; font-weight: 700;">Loja Oficial</p>
                        </div>
                    </div>
                    <button style="font-size: 10px; font-weight: 900; text-transform: uppercase; background: transparent; border: 1px solid #ddd; padding: 8px 12px; border-radius: 10px;">Ver Loja</button>
                </div>
            `;
        },

        addToCartFromDetail() {
            if (this.selectedProduct) {
                this.cart.push(this.selectedProduct);
                localStorage.setItem('dito_cart', JSON.stringify(this.cart));
                this.showNotification("Adicionado ao carrinho!", "success");
                this.setMarketView('home');
            }
        },

        renderMarketCart(container) {
            const temp = document.getElementById('template-mercado-carrinho');
            container.innerHTML = temp.innerHTML;
            
            const list = document.getElementById('cart-items-list');
            if (this.cart.length === 0) {
                list.innerHTML = `<div style="text-align: center; padding: 60px 0; color: #ccc;">Sua sacola está vazia.</div>`;
                document.getElementById('cart-footer').style.display = 'none';
            } else {
                list.innerHTML = this.cart.map((item, index) => `
                    <div style="display: flex; gap: 16px; align-items: center; padding: 16px; border: 1px solid #f5f5f5; border-radius: 20px;">
                        <div style="width: 60px; height: 60px; background: #f8f8f8; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                            <i data-lucide="shopping-bag" style="width: 24px; color: #eee;"></i>
                        </div>
                        <div style="flex: 1;">
                            <h4 style="font-size: 13px; font-weight: 900;">${item.name.toLowerCase()}</h4>
                            <span style="font-size: 14px; font-weight: 900; color: #ee4d2d;">R$ ${item.price.toFixed(2)}</span>
                        </div>
                        <button onclick="app.removeFromCart(${index})" style="background: transparent; border: none; color: #ddd; cursor: pointer;">
                            <i data-lucide="x" style="width: 18px;"></i>
                        </button>
                    </div>
                `).join('');
                
                const total = this.cart.reduce((acc, i) => acc + i.price, 0);
                document.getElementById('cart-total-label').innerText = 'R$ ' + total.toFixed(2);
                document.getElementById('cart-footer').style.display = 'block';
            }
        },

        renderSales() {
            const list = document.getElementById('sales-list');
            if (!list) return;
            const sales = JSON.parse(localStorage.getItem('dito_sales_vanilla') || '[]');
            if (sales.length === 0) {
                list.innerHTML = `<p style="text-align: center; color: #ccc; padding: 40px;">Nenhuma venda realizada ainda.</p>`;
                return;
            }
            list.innerHTML = sales.map(s => `
                <div style="background: var(--surface); padding: 16px; border-radius: 20px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h4 style="font-weight: 900; font-size: 13px;">${s.productName}</h4>
                        <p style="font-size: 10px; color: #ccc;">${s.date}</p>
                    </div>
                    <span style="font-weight: 900; color: #16a34a;">+ R$ ${s.amount.toFixed(2)}</span>
                </div>
            `).join('');
        },

        renderHallOfFame() {
            const list = document.getElementById('hall-list');
            if (!list) return;
            // Mock de usuários para o Hall se estiver vazio
            const users = [
                { name: "Benedito Santos", sales: 15400, rank: 1 },
                { name: "Ana Silva", sales: 12800, rank: 2 },
                { name: "Carlos Dev", sales: 9500, rank: 3 }
            ];
            list.innerHTML = users.map(u => `
                <div style="background: var(--surface); padding: 20px; border-radius: 24px; border: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <span style="font-weight: 900; color: #ccc; font-size: 18px;">#${u.rank}</span>
                        <h4 style="font-weight: 900; font-size: 14px;">${u.name}</h4>
                    </div>
                    <span style="font-weight: 900;">R$ ${u.sales.toLocaleString()}</span>
                </div>
            `).join('');
        },

        updateBalanceUI() {
            const label = document.getElementById('label-balance');
            if (label) {
                const balance = parseFloat(localStorage.getItem('user_balance_vanilla') || '0');
                label.innerText = 'R$ ' + balance.toFixed(2);
            }
        },

        updateWithdrawUI() {
            const label = document.getElementById('label-balance-withdraw');
            if (label) {
                const balance = parseFloat(localStorage.getItem('user_balance_vanilla') || '0');
                label.innerText = 'R$ ' + balance.toFixed(2);
            }
        },

        showNotification(message, type = 'success') {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = message;
            document.body.appendChild(notification);
            setTimeout(() => notification.classList.add('show'), 100);
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        },

        removeFromCart(index) {
            this.cart.splice(index, 1);
            localStorage.setItem('dito_cart', JSON.stringify(this.cart));
            this.renderMarketCart(document.getElementById('market-view-container'));
        },

        checkNotifications() {
            // Sociedade
            const currentSoc = JSON.parse(localStorage.getItem('dito_societies') || '[]').length;
            const lastSoc = parseInt(localStorage.getItem('last_seen_soc_vanilla') || '0');
            this.showSocDot = currentSoc > lastSoc;

            // Hall da Fama (Membros)
            const currentMembers = JSON.parse(localStorage.getItem('dito_users_db') || '[]').length;
            const lastMembers = parseInt(localStorage.getItem('last_seen_hall_vanilla') || '0');
            this.showHallDot = currentMembers > lastMembers;
        },

        navigate(view) { 
            try {
                console.log("Navegando para:", view);
                this.currentView = view;

                // Proteção de rota
                const isLoggedIn = localStorage.getItem('is_logged_in_vanilla') === 'true';
                if (!isLoggedIn && view !== 'login' && view !== 'cadastro') {
                    view = 'login';
                    this.currentView = 'login';
                }

                // Renderiza o template básico
                const container = document.getElementById('app');
                const template = document.getElementById(`template-${view}`);
                if (template) {
                    container.innerHTML = template.innerHTML;
                } else {
                    console.error("Template não encontrado:", view);
                    return;
                }

                // Chamadas lógicas específicas de cada tela
                switch(view) {
                    case 'dashboard': this.updateBalanceUI(); break;
                    case 'mercado': setTimeout(() => this.renderStore(), 10); break;
                    case 'sociedade': this.renderSocieties(); break;
                    case 'hall': this.renderHallOfFame(); break;
                    case 'perfil': this.renderProfile(); break;
                    case 'vendas': this.renderSales(); break;
                    case 'sacar': this.updateWithdrawUI(); break;
                    case 'admin-contas': this.renderAdminUsers(); break;
                }
                
                // Atualiza Barra de Navegação Global
                const nav = document.getElementById('global-nav');
                if (nav) {
                    nav.style.display = (view === 'login' || view === 'cadastro') ? 'none' : 'flex';
                    nav.querySelectorAll('.nav-item').forEach(item => {
                        const targetView = item.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
                        if (targetView === view) {
                            item.classList.add('active-nav');
                        } else {
                            item.classList.remove('active-nav');
                        }
                    });
                }

                if (window.lucide) lucide.createIcons();
            } catch (err) {
                console.error("Erro Crítico na Navegação:", err);
            }
        },

        renderSocieties() {
            const list = document.getElementById('societies-list');
            if (!list) return;

            const saved = JSON.parse(localStorage.getItem('dito_societies') || '[]');
            
            if (saved.length === 0) {
                const initial = [
                    { id: '1', name: "Elite Digital", description: "O maior ecossistema de produtores.", admin: "Benedito", entryFee: 0, membersCount: 154 },
                    { id: '2', name: "Clube dos 6 Dígitos", description: "Focado em escala de anúncios.", admin: "Ana Silva", entryFee: 49.90, membersCount: 42 }
                ];
                localStorage.setItem('dito_societies', JSON.stringify(initial));
                this.renderSocieties();
                return;
            }

            list.innerHTML = saved.map(s => `
                <div class="society-card">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                        <div>
                            <h3 style="font-size: 19px; font-weight: 900; letter-spacing: -0.5px; display: flex; align-items: center; gap: 8px;">
                                ${s.name.toLowerCase()} <i data-lucide="shield-check" style="width: 17px; color: #3b82f6;"></i>
                            </h3>
                            <p style="font-size: 10px; font-weight: 900; color: #ccc; text-transform: uppercase;">ADM: ${s.admin}</p>
                        </div>
                        <div style="padding: 6px 14px; border-radius: 20px; font-size: 10px; font-weight: 900; text-transform: uppercase; background: ${s.entryFee === 0 ? '#f0fdf4' : '#f9f9f9'}; color: ${s.entryFee === 0 ? '#16a34a' : '#666'};">
                            ${s.entryFee === 0 ? 'Gratuita' : 'R$ ' + s.entryFee.toFixed(2)}
                        </div>
                    </div>
                    
                    <p style="font-size: 13px; font-weight: 500; color: #777; line-height: 1.5; margin-bottom: 24px;">${s.description}</p>
                    
                    <div style="padding-top: 20px; border-top: 1px solid #f9f9f9; display: flex; justify-content: space-between; align-items: flex-end;">
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <div>
                                <span style="font-size: 10px; font-weight: 900; color: #ccc; text-transform: uppercase; display: block; margin-bottom: 2px;">Membros</span>
                                <span style="font-size: 14px; font-weight: 900; color: #333;">${s.membersCount}</span>
                            </div>
                        </div>

                        <button onclick="app.requestEntry('${s.name}')" style="height: 48px; padding: 0 20px; background: var(--surface); border: none; border-radius: 16px; font-size: 11px; font-weight: 900; text-transform: uppercase; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: 0.3s;" onmouseover="this.style.background='#000'; this.style.color='#fff';" onmouseout="this.style.background='var(--surface)'; this.style.color='#000';">
                            Solicitar <i data-lucide="arrow-right" style="width: 14px;"></i>
                        </button>
                    </div>
                </div>
            `).join('');

            if (window.lucide) lucide.createIcons();
        },

        toggleCreateSocietyModal(show) {
            const modal = document.getElementById('create-society-modal');
            if (modal) {
                modal.style.display = show ? 'flex' : 'none';
            }
        },

        createSociety() {
            const nameEl = document.getElementById('new-soc-name');
            const feeEl = document.getElementById('new-soc-fee');
            
            const name = nameEl.value.trim();
            const fee = parseFloat(feeEl.value) || 0;
            const cost = 15.00;

            if (!name) {
                this.showNotification("Dê um nome para sua sociedade.", "error");
                return;
            }

            if (this.balance < cost) {
                this.showNotification("Saldo insuficiente para pagar a taxa de R$ 15,00.", "error");
                return;
            }

            if (confirm(`Deseja criar a sociedade "${name}"? Uma taxa de R$ 15,00 será descontada do seu saldo.`)) {
                // Descontar do saldo
                this.balance -= cost;
                this.totalVendas -= cost; // Mantendo sincronizado se necessário
                localStorage.setItem('dito_balance', this.balance);
                
                // Criar nova sociedade
                const saved = JSON.parse(localStorage.getItem('dito_societies') || '[]');
                const newSociety = {
                    id: Date.now().toString(),
                    name: name,
                    description: "Nova sociedade criada pelo usuário.",
                    admin: this.currentUser?.username || "Você",
                    entryFee: fee,
                    membersCount: 1
                };
                
                saved.push(newSociety);
                localStorage.setItem('dito_societies', JSON.stringify(saved));
                
                this.showNotification("Sociedade criada com sucesso!", "success");
                
                // Limpar e fechar
                nameEl.value = '';
                feeEl.value = '';
                this.toggleCreateSocietyModal(false);
                this.renderSocieties();
                this.updateBalanceUI();
            }
        },

        requestEntry(name) {
            this.showNotification(`Solicitação enviada para o ADM de ${name}.`, "default");
        },

        initEditProfile() {
            if (!this.currentUser) return;
            const userInp = document.getElementById('edit-username');
            const bioInp = document.getElementById('edit-bio');
            const linkInp = document.getElementById('edit-link');
            const counter = document.getElementById('bio-counter');

            if (userInp) userInp.value = this.currentUser.username;
            if (bioInp) {
                bioInp.value = this.currentUser.bio || '';
                if (counter) counter.innerText = `${bioInp.value.length} / 300`;
                bioInp.oninput = () => {
                    if (counter) counter.innerText = `${bioInp.value.length} / 300`;
                };
            }
            if (linkInp) linkInp.value = this.currentUser.link || '';
        },

        saveProfile() {
            const newUsername = document.getElementById('edit-username').value.trim();
            const newBio = document.getElementById('edit-bio').value.trim();
            const newLink = document.getElementById('edit-link').value.trim();

            if (!newUsername) {
                this.showNotification('O nome de usuário não pode ficar vazio.', 'error');
                return;
            }

            if (this.currentUser) {
                this.currentUser.username = newUsername;
                this.currentUser.name = newUsername; // Mantendo o nome sincronizado para simplicidade
                this.currentUser.bio = newBio;
                this.currentUser.link = newLink;

                // Salva no localStorage principal de usuários
                const usuarios = JSON.parse(localStorage.getItem('dito_usuarios_vanilla') || '[]');
                const idx = usuarios.findIndex(u => u.id === this.currentUser.id);
                if (idx !== -1) {
                    usuarios[idx] = this.currentUser;
                    localStorage.setItem('dito_usuarios_vanilla', JSON.stringify(usuarios));
                }
                
                // Salva na sessão atual
                localStorage.setItem('current_user_vanilla', JSON.stringify(this.currentUser));
                
                this.showNotification('Perfil atualizado com sucesso!');
                this.navigate('perfil');
            }
        },

        render(view) {
            const container = document.getElementById('app');
            const template = document.getElementById(`template-${view}`);
            if (template) {
                container.innerHTML = template.innerHTML;
            } else {
                container.innerHTML = `<div style="padding: 20px; color: #999;">Caminho não encontrado: template-${view}</div>`;
            }
        },

        renderAdminUsers() {
            const list = document.getElementById('admin-users-list');
            if (!list) return;

            const usuarios = JSON.parse(localStorage.getItem('dito_usuarios_vanilla') || '[]');
            
            if (usuarios.length === 0) {
                list.innerHTML = `<p style="text-align: center; color: #999; font-weight: 800; padding: 40px;">Nenhum usuário cadastrado além de você.</p>`;
                return;
            }

            list.innerHTML = usuarios.map(user => `
                <div style="background: #fafafa; border: 1px solid #eee; border-radius: 20px; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 900;">${user.username[0].toUpperCase()}</div>
                        <div>
                            <h4 style="font-weight: 900; font-size: 14px; lowercase">${user.username}</h4>
                            <p style="font-size: 10px; font-weight: 700; color: #ccc;">ID: ${user.id}</p>
                        </div>
                    </div>
                    <button onclick="app.deleteUser(${user.id})" style="width: 32px; height: 32px; background: #fee2e2; color: #ef4444; border: none; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                        <i data-lucide="trash-2" style="width: 16px;"></i>
                    </button>
                </div>
            `).join('');
            if (window.lucide) lucide.createIcons();
        },

        deleteUser(id) {
            if (confirm('Tem certeza que deseja EXCLUIR este usuário?')) {
                let usuarios = JSON.parse(localStorage.getItem('dito_usuarios_vanilla') || '[]');
                usuarios = usuarios.filter(u => u.id !== id);
                localStorage.setItem('dito_usuarios_vanilla', JSON.stringify(usuarios));
                this.renderAdminUsers();
                this.showNotification('Usuário removido da elite.');
            }
        },

        renderProfile() {
            try {
                const usernameEl = document.getElementById('profile-username-header');
                const nameEl = document.getElementById('profile-name');
                const bioEl = document.getElementById('profile-bio');
                const adminSection = document.getElementById('admin-only-section');
                
                if (usernameEl && this.currentUser) usernameEl.innerText = this.currentUser.username;
                if (nameEl && this.currentUser) nameEl.innerText = this.currentUser.name;
                if (bioEl && this.currentUser) bioEl.innerText = this.currentUser.bio;
                
                // Só mostra o botão de gerenciar se for o Benedito
                if (adminSection && this.currentUser && (this.currentUser.username === 'benedito_pro' || this.currentUser.username === 'admin')) {
                    adminSection.style.display = 'block';
                } else if (adminSection) {
                    adminSection.style.display = 'none';
                }

                this.renderProfileFeed();
            } catch (e) { console.warn(e); }
        },

        renderProfileFeed() {
            try {
                const grid = document.getElementById('profile-posts-grid');
                if (!grid) return;
                
                const posts = JSON.parse(localStorage.getItem('dito_profile_posts') || '[]');
                const postCountEl = document.getElementById('count-posts');
                if (postCountEl) postCountEl.innerText = posts.length;

                if (posts.length === 0) {
                    grid.innerHTML = `<div style="grid-column: span 3; padding: 60px 0; text-align: center; color: #ccc;">
                        <i data-lucide="camera" style="width: 48px; margin-bottom: 16px;"></i>
                        <p style="font-weight: 800; font-size: 12px;">Ainda não há fotos.</p>
                    </div>`;
                } else {
                    grid.innerHTML = posts.map(p => `
                        <div style="aspect-ratio: 1; background: #eee; overflow: hidden; position: relative;">
                            <img src="${p.url}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                    `).join('');
                }
            } catch (e) { console.warn(e); }
        },

        handleNewPost(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const posts = JSON.parse(localStorage.getItem('dito_profile_posts') || '[]');
                    posts.unshift({ id: Date.now(), url: event.target.result });
                    localStorage.setItem('dito_profile_posts', JSON.stringify(posts));
                    this.renderProfileFeed();
                    if (window.lucide) lucide.createIcons();
                };
                reader.readAsDataURL(file);
            }
        },

        handleAvatarUpload(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const cont = document.getElementById('profile-avatar-container');
                    if (cont) cont.innerHTML = `<img src="${event.target.result}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    if (this.currentUser) {
                        this.currentUser.avatar = event.target.result;
                        localStorage.setItem('current_user_vanilla', JSON.stringify(this.currentUser));
                    }
                };
                reader.readAsDataURL(file);
            }
        },

        updateBalanceUI() {
            const el = document.getElementById('balance-value');
            if (el) el.innerText = this.showBalance ? `R$ ${this.balance.toFixed(2)}` : '••••••••';
            
            // Atualiza o nome da saudação
            const nameEl = document.getElementById('user-greeting-name');
            if (nameEl && this.currentUser) {
                nameEl.innerText = this.currentUser.name || this.currentUser.username;
            }
        },

        toggleBalance() {
            this.showBalance = !this.showBalance;
            this.updateBalanceUI();
        },

        initCreateProduct() {
            this.selectedProductType = null;
            const form = document.getElementById('create-product-form');
            if (form) form.style.display = 'none';
            const selection = document.getElementById('product-type-selection');
            if (selection) selection.style.display = 'flex';
            
            // Reset fields
            document.querySelectorAll('#product-type-selection button').forEach(btn => {
                btn.style.borderColor = 'transparent';
                btn.style.background = '#f5f5f5';
            });
        },

        selectProductType(type, btn) {
            this.selectedProductType = type;
            
            // Visual logic for selection - Red highlight
            document.querySelectorAll('.product-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Show form and conditional fields
            const form = document.getElementById('create-product-form');
            if (form) form.style.display = 'flex';

            document.getElementById('ebook-upload').style.display = (type === 'Ebook') ? 'block' : 'none';
            document.getElementById('curso-upload').style.display = (type === 'Curso') ? 'block' : 'none';
            document.getElementById('mentoria-link').style.display = (type === 'Mentoria') ? 'block' : 'none';
            document.getElementById('mentoria-fields').style.display = (type === 'Mentoria') ? 'block' : 'none';
            
            // Reset filenames
            document.querySelectorAll('.file-name-display').forEach(el => el.innerText = '');
        },

        handleFileUpload(input, targetId) {
            const file = input.files[0];
            const display = document.getElementById(targetId);
            if (file && display) {
                display.innerText = `Arquivo realizado upload : ${file.name}`;
            }
        },

        saveProduct() {
            const name = document.getElementById('prod-name').value.trim();
            const price = parseFloat(document.getElementById('prod-price').value) || 0;
            const visible = document.getElementById('prod-visible').checked;

            if (!this.selectedProductType) {
                this.showNotification("Selecione um tipo de produto.", "error");
                return;
            }

            if (!name || price <= 0) {
                this.showNotification("Preencha o nome e o preço corretamente.", "error");
                return;
            }

            const newProd = {
                id: Date.now(),
                name: name,
                price: price,
                type: this.selectedProductType,
                visible: visible,
                author: this.currentUser?.username || "Você"
            };

            const products = JSON.parse(localStorage.getItem('dito_my_products') || '[]');
            products.unshift(newProd);
            localStorage.setItem('dito_my_products', JSON.stringify(products));

            this.showNotification(`Produto "${name}" (${this.selectedProductType}) criado com sucesso!`, "success");
            this.navigate('dashboard');
        },

        updateWithdrawUI() {
            // Em desenvolvimento
        },

        registerUser() {
            const username = document.getElementById('reg-username').value.trim();
            const password = document.getElementById('reg-password').value.trim();

            if (!username || !password) {
                this.showNotification('Preencha todos os campos.', 'error');
                return;
            }

            let users = JSON.parse(localStorage.getItem('dito_users_db') || '[]');
            if (users.find(u => u.username === username)) {
                this.showNotification('Este usuário já existe.', 'error');
                return;
            }

            const newUser = {
                id: Date.now(),
                username: username,
                password: password,
                name: username,
                bio: "Novo Infoprodutor Dito 🚀",
                avatar: ""
            };

            users.push(newUser);
            localStorage.setItem('dito_users_db', JSON.stringify(users));
            this.showNotification('Cadastro realizado com sucesso! Agora você já pode fazer login.');
            this.navigate('login');
        },

        login(isGuest = false) { 
            this.showNotification(isGuest ? 'Entrando como convidado...' : 'Entrando...', 'centered');
            
            setTimeout(() => {
                if (isGuest) {
                    localStorage.setItem('is_logged_in_vanilla', 'true');
                    localStorage.setItem('is_guest_vanilla', 'true');
                    this.currentUser = { username: "Convidado", name: "Visitante", bio: "Explorando o Dito", isGuest: true };
                    this.navigate('dashboard');
                    this.showNotification('Bem-vindo! Crie uma conta para realizar vendas e saques.');
                    return;
                }

                const userInp = document.getElementById('username').value.trim();
                const passInp = document.getElementById('password').value.trim();

                let users = JSON.parse(localStorage.getItem('dito_users_db') || '[]');
                const user = users.find(u => u.username === userInp && u.password === passInp);

                // Permitir o usuário 'admin' padrão para testes se o banco estiver vazio
                if (user || (userInp === 'admin' && passInp === 'admin')) {
                    const loggedUser = user || { id: 1, username: 'admin', name: 'Admin', bio: 'Administrador' };
                    localStorage.setItem('is_logged_in_vanilla', 'true');
                    localStorage.setItem('is_guest_vanilla', 'false');
                    localStorage.setItem('current_user_vanilla', JSON.stringify(loggedUser));
                    this.currentUser = loggedUser;
                    this.navigate('dashboard');
                    this.showNotification(`Bem-vindo, ${this.currentUser.username}!`);
                } else {
                    this.showNotification('Usuário ou senha incorretos.', 'error');
                }
            }, 2400);
        },

        logout() { 
            localStorage.removeItem('is_logged_in_vanilla');
            localStorage.removeItem('is_guest_vanilla');
            this.navigate('login'); 
        },

        showNotification(msg, type = 'success') {
            const container = document.getElementById('notification-container');
            if (!container) return;
            
            // Limpa qualquer notificação anterior para elas se sobreporem no mesmo lugar
            container.innerHTML = '';
            
            const notification = document.createElement('div');
            notification.className = `notification ${type} animate-fade`;
            
            // Cores baseadas no tipo
            let bg = '#fff';
            let color = '#000';
            
            if (type === 'success') {
                bg = '#22c55e'; // Verde
                color = '#fff';
            } else if (type === 'error') {
                bg = '#ef4444'; // Vermelho
                color = '#fff';
            }

            notification.style.cssText = `
                background: ${bg};
                color: ${color};
                padding: 16px 32px;
                border-radius: 50px;
                margin-bottom: 12px;
                font-weight: 800;
                font-size: 13px;
                box-shadow: 0 15px 35px rgba(0,0,0,0.1);
                border: 1px solid rgba(0,0,0,0.05);
                display: flex;
                align-items: center;
                gap: 10px;
                white-space: nowrap;
            `;
            notification.innerHTML = msg;
            container.appendChild(notification);
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateY(-20px)';
                setTimeout(() => notification.remove(), 500);
            }, 3000);
        },

        removeFromCart(index) {
            this.cart.splice(index, 1);
            localStorage.setItem('dito_cart', JSON.stringify(this.cart));
            this.renderMarketCart(document.getElementById('market-view-container'));
        },

        checkAccess(view) {
            const isGuest = localStorage.getItem('is_guest_vanilla') === 'true';
            const restrictedViews = ['sacar', 'criar-produto', 'sociedade', 'editar-perfil'];
            
            if (isGuest && restrictedViews.includes(view)) {
                this.showNotification('Crie uma conta para acessar esta função!', 'error');
                return false;
            }
            return true;
        }
    };

    // Sobrescreve navigate para incluir cheque de acesso do convidado
    const originalNavigate = app.navigate;
    app.navigate = function(view) {
        if (!this.checkAccess(view)) return;
        originalNavigate.call(this, view);
    };

    window.app = app;
    app.init();
})();
