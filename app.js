(function() {
    const app = {
        currentUser: null,
        currentView: 'dashboard',
        products: [],
        balance: 12450.00,
        showBalance: true,

        init() {
            try {
                console.log("Iniciando Dito App...");
                
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

                // Força exibição do dashboard
                this.navigate('dashboard');
                
                // Ativa ícones
                if (window.lucide) lucide.createIcons();
                
                console.log("App carregado com sucesso!");
            } catch (err) {
                console.error("Erro no INIT:", err);
                document.getElementById('app').innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">Erro ao iniciar: ${err.message}</div>`;
            }
        },

        navigate(view) {
            try {
                this.currentView = view;
                this.render(view);
                
                const nav = document.getElementById('global-nav');
                if (nav) {
                    nav.style.display = (view === 'login' || view === 'cadastro') ? 'none' : 'flex';
                    nav.querySelectorAll('.nav-item').forEach(item => {
                        item.style.color = (item.getAttribute('data-view') === view) ? '#000' : '#ccc';
                    });
                }

                // Chamadas específicas de tela
                if (view === 'perfil') this.renderProfile();
                if (view === 'dashboard') this.updateBalanceUI();
                if (view === 'mercado') this.renderStore();
                if (view === 'produtos') this.renderMyProducts();
                if (view === 'sacar') this.updateWithdrawUI();
                if (view === 'admin-contas') this.renderAdminUsers();
                if (view === 'editar-perfil') this.initEditProfile();
                
                if (window.lucide) lucide.createIcons();
            } catch (err) {
                console.error("Erro ao navegar:", err);
            }
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
        },

        toggleBalance() {
            this.showBalance = !this.showBalance;
            this.updateBalanceUI();
        },

        renderStore() {
            // Em desenvolvimento
        },

        renderMyProducts() {
            // Em desenvolvimento
        },

        updateWithdrawUI() {
            // Em desenvolvimento
        },

        login() { this.navigate('dashboard'); },
        logout() { this.navigate('login'); }
    };

    window.app = app;
    // Inicia o app imediatamente
    app.init();
})();
