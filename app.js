const app = {
    user: null,
    products: [
        { id: 1, name: 'Ebook: O Futuro da IA', type: 'Ebook', price: 47.90 },
        { id: 2, name: 'Mentoria Elite SaaS', type: 'Mentoria', price: 997.00 },
        { id: 3, name: 'Dito CRM - Starter', type: 'Micro SaaS', price: 29.90 }
    ],
    ranking: [
        { name: 'Benedito S.', sales: 1240, revenue: 'R$ 54.200', medal: '🥇', level: 'Diamond' },
        { name: 'Maria Joana', sales: 980, revenue: 'R$ 32.100', medal: '🥈', level: 'Platinum' },
        { name: 'Carlos Lima', sales: 850, revenue: 'R$ 28.400', medal: '🥉', level: 'Gold' },
        { name: 'Ana Souza', sales: 720, revenue: 'R$ 21.150', level: 'Silver' },
        { name: 'Lucas Neto', sales: 640, revenue: 'R$ 18.900', level: 'Silver' }
    ],

    init() {
        this.render('login');
        lucide.createIcons();
    },

    login() {
        this.user = { name: 'Benedito' };
        this.render('dashboard');
        this.renderProducts();
    },

    render(view) {
        const container = document.getElementById('app');
        const template = document.getElementById(`template-${view}`);
        container.innerHTML = '';
        container.appendChild(template.content.cloneNode(true));
        lucide.createIcons();
    },

    renderProducts() {
        const list = document.getElementById('dashboard-products');
        if (!list) return;

        list.innerHTML = this.products.map(p => `
            <div class="product-item animate-slide">
                <div class="product-icon">
                    <i data-lucide="${this.getIconForType(p.type)}"></i>
                </div>
                <div class="product-info">
                    <div class="product-name">${p.name}</div>
                    <div class="product-type">${p.type}</div>
                </div>
                <div class="product-price">R$ ${p.price.toFixed(2)}</div>
            </div>
        `).join('');
        lucide.createIcons();
    },

    getIconForType(type) {
        switch(type) {
            case 'Ebook': return 'book-open';
            case 'Mentoria': return 'users';
            case 'Micro SaaS': return 'cpu';
            case 'Curso': return 'play-circle';
            default: return 'package';
        }
    },

    showModal(type) {
        const modal = document.getElementById('modal-container');
        const body = document.getElementById('modal-body');
        modal.classList.add('active');

        if (type === 'create-product') {
            body.innerHTML = `
                <div class="modal-header">
                    <h3>Novo Produto</h3>
                    <i data-lucide="x" onclick="app.closeModal()" style="cursor:pointer"></i>
                </div>
                <div class="select-type">
                    <div class="type-option selected" onclick="app.selectType(this, 'Ebook')">
                        <i data-lucide="book-open"></i><span>Ebook</span>
                    </div>
                    <div class="type-option" onclick="app.selectType(this, 'Curso')">
                        <i data-lucide="play-circle"></i><span>Curso</span>
                    </div>
                    <div class="type-option" onclick="app.selectType(this, 'Mentoria')">
                        <i data-lucide="users"></i><span>Mentoria</span>
                    </div>
                    <div class="type-option" onclick="app.selectType(this, 'Micro SaaS')">
                        <i data-lucide="cpu"></i><span>Micro SaaS</span>
                    </div>
                </div>
                <div class="form-group">
                    <label>Nome do Produto</label>
                    <input type="text" id="p-name" placeholder="Ex: Masterclass de Design">
                </div>
                <div class="form-group">
                    <label>Preço (R$)</label>
                    <input type="number" id="p-price" placeholder="0,00">
                </div>
                <button class="btn btn-primary" onclick="app.saveProduct()">Criar Produto</button>
            `;
        } else if (type === 'hall-of-fame') {
            body.innerHTML = `
                <div class="modal-header">
                    <h3>🏆 Hall da Fama</h3>
                    <i data-lucide="x" onclick="app.closeModal()" style="cursor:pointer"></i>
                </div>
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    ${this.ranking.map((user, index) => `
                        <div style="display: flex; align-items: center; gap: 16px; padding: 12px; background: var(--surface); border-radius: 12px;">
                            <span style="font-size: 24px;">${user.medal || (index + 1)}</span>
                            <div style="flex: 1;">
                                <div style="font-weight: 600;">${user.name}</div>
                                <div style="font-size: 11px; color: var(--accent); font-weight: 600;">Nível ${user.level || 'Expert'}</div>
                                <div style="font-size: 11px; color: var(--text-secondary);">${user.sales} vendas</div>
                            </div>
                            <div style="font-weight: 700; color: var(--accent);">${user.revenue}</div>
                        </div>
                    `).join('')}
                </div>
                <p style="text-align: center; margin-top: 24px; font-size: 12px; color: var(--text-secondary);">Atualizado em tempo real</p>
            `;
        } else if (type === 'profile-modal') {
             body.innerHTML = `
                <div class="modal-header">
                    <h3>Seu Perfil</h3>
                    <i data-lucide="x" onclick="app.closeModal()" style="cursor:pointer"></i>
                </div>
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="width: 80px; height: 80px; background: var(--surface); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                        <i data-lucide="user" size="40"></i>
                    </div>
                    <h4>Benedito 👋</h4>
                    <p style="color: var(--text-secondary);">Membro desde Abril 2026</p>
                </div>
                <button class="btn btn-secondary" onclick="app.logout()">Sair da Conta</button>
            `;
        }
        lucide.createIcons();
    },

    selectType(el, type) {
        document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'));
        el.classList.add('selected');
        this.selectedType = type;
    },

    saveProduct() {
        const name = document.getElementById('p-name').value;
        const price = parseFloat(document.getElementById('p-price').value);
        const type = this.selectedType || 'Ebook';

        if (name && price) {
            this.products.unshift({ id: Date.now(), name, type, price });
            this.closeModal();
            this.renderProducts();
            
            // Notification toast
            alert(`Produto "${name}" criado com sucesso!`);
        }
    },

    closeModal(e) {
        document.getElementById('modal-container').classList.remove('active');
    },

    logout() {
        this.user = null;
        this.closeModal();
        this.init();
    }
};

window.onload = () => app.init();
