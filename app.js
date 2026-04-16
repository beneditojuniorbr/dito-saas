(function() {
    // ==========================================
    // 🌐 DITO NETWORK (SUPABASE)
    // ==========================================
    // 🚨 ATENÇÃO: A CHAVE ABAIXO ESTAVA INCORRETA (Era uma chave do Stripe).
    // Substitua pela chave 'anon/public' do seu projeto Supabase (começa com eyJ...).
    const SUPABASE_URL = 'https://heofezexvhgyaejltcvc.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhlb2ZlemV4dmhneWFlamx0Y3ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5OTU0NjMsImV4cCI6MjA5MTU3MTQ2M30.v4G47ddzSdpTEWeozaQXWczNFy-ueUCwRbwMfp8SEUI';
    
    // MERCADO PAGO CONFIG
    const MP_PUBLIC_KEY = 'APP_USR-8ce69cfb-2613-4a57-944d-2521c8f523f0'; // Chave Pública Real
    
    let supabase = null;
    
    async function initSupabase() {
        if (!window.supabase) {
            console.warn("⚠️ [Supabase] Biblioteca não encontrada. Tentando carregar...");
            return;
        }
        try {
            if (SUPABASE_URL.startsWith('http')) {
                supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log("✅ [Supabase] Conectado a:", SUPABASE_URL);
                return true;
            }
        } catch (e) {
            console.error("❌ [Supabase] Erro de config:", e);
        }
        return false;
    }

    const app = {
        currentUser: null,
        currentView: 'dashboard',
        marketView: 'home',
        selectedProduct: null,
        cart: [],
        products: [],
        balance: 0.00,
        showBalance: true,
        purchasedProducts: [],
        
        // Helper para individualizar o armazenamento
        getUserKey() {
            if (!this.currentUser) return 'guest';
            return this.currentUser.username || 'guest';
        },

        currentLessonId: 1, 
        courseComments: JSON.parse(localStorage.getItem('dito_course_comments') || '{}'),
        courseRatings: JSON.parse(localStorage.getItem('dito_course_ratings') || '{}'),
        globalRatings: JSON.parse(localStorage.getItem('dito_global_ratings') || '{}'),
        hasSeenCreateProd: false,
        adminNetworkInfoVisible: false,
        courseStructure: [], 
        openModules: {}, 
        activePlayerTab: 'aulas',
        paypalLink: 'https://www.paypal.com/checkoutnow?token=LIVE', 
        paymentMethod: 'pix',
        
        toSentenceCase(str) {
            if (!str) return "";
            return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        },

        // Helper para salvar no localStorage com segurança (evita QuotaExceeded)
        safeLocalStorageSet(key, value) {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (e) {
                if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                    console.error("🚨 [Storage] Limite de espaço atingido! Limpando cache não essencial...");
                    // Limpa caches que podem ser reconstruídos
                    localStorage.removeItem('dito_network_users');
                    localStorage.removeItem('dito_usuarios');
                    localStorage.removeItem('dito_usuarios_vanilla');
                    
                    try {
                        localStorage.setItem(key, value);
                        return true;
                    } catch (retryErr) {
                        console.error("🚨 [Storage] Falha crítica: Nem mesmo limpando o cache foi possível salvar.", retryErr);
                        return false;
                    }
                }
                return false;
            }
        },

        // Salva a sessão do usuário de forma enxuta
        saveSession(user) {
            if (!user) return;
            const cleanUser = { ...user };
            delete cleanUser.posts;
            delete cleanUser.purchases;
            delete cleanUser.password;
            
            this.safeLocalStorageSet('current_user_vanilla', JSON.stringify(cleanUser));
        },

        loadUserScopedData() {
            const key = this.getUserKey();
            this.cart = JSON.parse(localStorage.getItem(`dito_cart_${key}`) || '[]');
            this.purchasedProducts = JSON.parse(localStorage.getItem(`dito_purchased_products_${key}`) || '[]');
            this.updateCartBadge();
        },

        // Limpa um perfil para armazenamento em listas (remove apenas dados pesados)
        cleanProfile(user) {
            if (!user) return null;
            const clean = { ...user };
            delete clean.posts;
            delete clean.purchases;
            // senha mantida para permitir login offline no cache local
            return clean;
        },

        cleanPublicProfile(user) {
            const clean = this.cleanProfile(user);
            if (clean) {
                delete clean.password;
                delete clean.withdrawPixKey;
                delete clean.withdrawCardNumber;
                delete clean.withdrawCardName;
            }
            return clean;
        },

        async init() {
            await initSupabase(); 

            // Reduz tempo de splash para feedback imediato
            setTimeout(() => {
                const splash = document.getElementById('splash-screen');
                if (splash) {
                    splash.style.opacity = '0';
                    splash.style.pointerEvents = 'none';
                    setTimeout(() => splash.remove(), 400);
                }
            }, 300);

            try {
                // Carrega dados locais
                this.products = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
                const savedUser = localStorage.getItem('current_user_vanilla');
                if (savedUser) {
                    this.currentUser = JSON.parse(savedUser);
                    this.loadUserScopedData(); // Carrega sacola e compras do usuário
                }
                
                // Conexão Única Inicial
                await Promise.all([
                    this.fetchNetworkUsers(),
                    this.fetchNetworkProducts()
                ]);
                
                // Polling otimizado (10s em vez de 5s para economizar bateria/processamento)
                setInterval(() => {
                    this.fetchNetworkUsers();
                    this.fetchNetworkProducts();
                }, 10000);

                // Inicia Notificações Realtime
                this.initRealtimeNotifications();
                this.fetchNotifications();

                this.navigate('login');
                if (window.lucide) lucide.createIcons();
                
                // 🧹 RESET PARA O USUÁRIO (Executa uma vez para limpar os testes anteriores)
                if (!localStorage.getItem('dito_factory_reset_done')) {
                    localStorage.removeItem('dito_real_sales_history');
                    localStorage.removeItem('dito_test_sale_done');
                    localStorage.setItem('dito_factory_reset_done', 'true');
                    console.log("🧹 [System] Sistema zerado para novo ciclo!");
                }
            } catch (err) {
                console.error("Erro no INIT:", err);
            }
        },

        // ==========================================
        // 💰 MERCADO PAGO REAL PAYMENTS
        // ==========================================

        async processPaymentMP(method = 'pix') {
            console.log("🚀 [Debug] Iniciando processPaymentMP...");
            
            if (!this.currentUser || this.currentUser.isGuest) {
                this.showNotification('Você precisa estar LOGADO para gerar um Pix real.', 'error');
                return;
            }

            const total = this.recalculateCheckoutTotal();
            console.log("💰 [Debug] Valor total calculado:", total);

            if (total <= 0) {
                this.showNotification('Carrinho vazio ou valor zerado.', 'error');
                return;
            }

            if (!this.currentUser.email) {
                this.showNotification('Cadastre seu e-mail no perfil antes de comprar!', 'error');
                this.navigate('perfil');
                return;
            }

            this.showLoading(true, 'Gerando seu código Pix real...');

            try {
                const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/mercado-pago-bridge`;
                
                // Sanitiza o email (Mercado Pago exige um email válido e sem espaços)
                let email = this.currentUser.email;
                if (!email || !email.includes('@')) {
                    const cleanUsername = (this.currentUser.username || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_');
                    email = `${cleanUsername}@dito.app`;
                }

                const resp = await fetch(FUNCTION_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    },
                    body: JSON.stringify({
                        action: 'create-pix',
                        amount: total,
                        description: `Compra no Dito Pro - ${this.cart.length} itens`,
                        email: email,
                        metadata: {
                            user_id: this.currentUser.id,
                            cart_items: this.cart.map(p => p.id)
                        }
                    })
                });

                if (!resp.ok) {
                    const errorText = await resp.text();
                    console.error("❌ [Pagamento] Erro na Resposta:", errorText);
                    throw new Error(`Servidor retornou erro ${resp.status}: ${errorText}`);
                }

                const data = await resp.json();
                console.log("✅ [Pagamento] Resposta recebida:", data);
                
                if (data.qr_code) {
                    this.showNotification('Pix recebido com sucesso!', 'success');
                    this.showLoading(false);
                    this.displayPixModal(data.qr_code, total);
                    this.showNotification('Pix gerado com sucesso! ✨', 'success');
                } else {
                    console.error("❌ [Pagamento] Falha: qr_code não encontrado no JSON", data);
                    throw new Error(data.error || data.message || 'O servidor de pagamento não retornou um código Pix válido.');
                }

            } catch (e) {
                console.error("🚨 [Pagamento] Erro Crítico:", e);
                this.showLoading(false);
                this.showNotification(`Erro ao gerar Pix: ${e.message}`, 'error');
            }
        },

        displayPixModal(qrCode, amount) {
            const modalBody = document.getElementById('modal-body');
            const modalContainer = document.getElementById('modal-container');
            
            if (!modalContainer || !modalBody) {
                this.showNotification('Erro na estrutura da janela. Atualize a página.', 'error');
                return;
            }

            modalBody.innerHTML = `
                <div style="text-align: center; padding: 20px; position: relative;" class="animate-fade">
                    <!-- Botão Voltar -->
                    <button onclick="app.closeModal(event)" style="position: absolute; top: 0; left: 0; width: 40px; height: 40px; border-radius: 50%; border: none; background: #f5f5f5; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#eee'" onmouseout="this.style.background='#f5f5f5'">
                        <i data-lucide="chevron-left" style="width: 20px; color: #000;"></i>
                    </button>

                    <div style="width: 70px; height: 70px; background: #f5f5f5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
                        <i data-lucide="qr-code" style="width: 34px; stroke: url(#dito-gradient);"></i>
                    </div>
                    <h3 style="font-weight: 950; font-size: 22px; margin-bottom: 8px; letter-spacing: -1px;">Pix Gerado!</h3>
                    <p style="font-size: 14px; font-weight: 800; color: #000; margin-bottom: 32px;">Total a pagar: <span style="font-weight: 900; color: #000;">R$ ${amount.toFixed(2)}</span></p>
                    
                    <div style="background: #f8f8f8; padding: 24px; border-radius: 24px; margin-bottom: 24px; border: 1px dashed #ddd;">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCode)}" style="width: 180px; height: 180px; margin-bottom: 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                        <input id="pix-copy-input" readonly value="${qrCode}" style="width: 100%; padding: 14px; border: 1px solid #eee; border-radius: 14px; font-family: monospace; font-size: 11px; color: #666; background: #fff; text-align: center; margin-bottom: 16px;">
                        <button onclick="app.copyPixCode()" style="width: 100%; height: 56px; background: #000; color: #fff; border: none; border-radius: 50px; font-size: 13px; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                            <i data-lucide="copy" style="width: 18px;"></i> COPIAR PIX
                        </button>
                    </div>

                    <p style="font-size: 11px; color: #999; font-weight: 700; line-height: 1.6;">O acesso aos seus produtos é liberado **automaticamente** após a confirmação do pagamento pelo Mercado Pago.</p>
                </div>
            `;
            
            // Força a exibição
            modalContainer.style.display = 'flex';
            modalContainer.style.opacity = '1';
            modalContainer.style.pointerEvents = 'auto';
            modalContainer.classList.add('active'); // CSS hook
            
            if (window.lucide) lucide.createIcons();
        },

        closeModal(e) {
            if (e) e.stopPropagation();
            const modal = document.getElementById('modal-container');
            if (modal) {
                modal.style.display = 'none';
                modal.classList.remove('active');
            }
        },

        copyPixCode() {
            const input = document.getElementById('pix-copy-input');
            input.select();
            document.execCommand('copy');
            this.showNotification('Copiado! Agora cole no seu App do Banco.', 'success');
        },

        async showOnlineFriends() {
            if (!supabase) return;
            
            document.getElementById('drawer-overlay').style.display = 'block';
            document.getElementById('friends-drawer').classList.add('active');
            const container = document.getElementById('friends-list-content');
            if (!container) return;
            
            container.innerHTML = '<div style="padding: 40px; text-align: center; font-weight: 900; color: #ccc;">Conectando...</div>';

            try {
                const { data: users, error } = await supabase.from('dito_users').select('*');
                if (users && !error) {
                    const now = new Date();
                    const sortedUsers = users.map(u => {
                        const lastSeen = new Date(u.last_seen || 0);
                        const diffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
                        return { ...u, isOnline: diffMinutes < 10 };
                    }).sort((a, b) => Number(b.isOnline) - Number(a.isOnline));

                    container.innerHTML = sortedUsers.map(u => {
                        const isOnline = u.isOnline;
                        const color = isOnline ? '#000' : '#ccc';
                        return `
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; background: #fff; border-radius: 100px; border: 1px solid #f0f0f0; margin-bottom: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                                <div style="display: flex; align-items: center; gap: 12px; flex: 1;" onclick="app.viewPublicProfile('${u.username}')">
                                    <div style="position: relative;">
                                        <div style="width: 44px; height: 44px; border-radius: 50%; background: #f5f5f5; overflow: hidden; border: 1px solid #eee;">
                                            ${u.avatar ? `<img src="${u.avatar}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="padding: 14px; color: #ccc;">👤</div>`}
                                        </div>
                                        ${isOnline ? `<div style="position: absolute; bottom: 0; right: 0; width: 12px; height: 12px; background: #22c55e; border-radius: 50%; border: 2px solid #fff;"></div>` : ''}
                                    </div>
                                    <div>
                                        <p style="font-weight: 900; font-size: 14px; color: ${color};">${u.name || u.username}</p>
                                        <p style="font-size: 8px; font-weight: 800; color: #bbb; text-transform: uppercase;">${isOnline ? 'Ativo na Pro' : 'Offline'}</p>
                                    </div>
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <button onclick="app.showNotification('Em breve: Chat com ${u.username}')" style="width: 36px; height: 36px; border-radius: 50%; border: none; background: #f8f8f8; color: #000; cursor: pointer; display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path></svg></button>
                                    <button onclick="app.showNotification('Redirecionando para envio de Moedas...')" style="width: 36px; height: 36px; border-radius: 50%; border: none; background: #ff005c; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg></button>
                                </div>
                            </div>
                        `;
                    }).join('');
                }
            } catch (e) {
                console.error(e);
            }
        },

        // ==========================================
        // 🌐 SISTEMA DE REDE MULTIPLAYER
        // ==========================================
        
        async fetchNetworkUsers() {
            if (!supabase) return;
            try {
                // 1. BUSCA O HALL DA FAMA (Top 20) + MEU PERFIL (Específico)
                // Isso reduz drasticamente o tráfego e o uso de memória
                const [hallRes, meRes] = await Promise.all([
                    supabase.from('dito_users').select('username, name, bio, fans, sales, avatar, last_seen').order('sales', { ascending: false }).limit(20),
                    this.currentUser ? supabase.from('dito_users').select('*').eq('username', this.currentUser.username).maybeSingle() : Promise.resolve({ data: null })
                ]);

                if (hallRes.data) {
                    // Consolida em um cache único e limpo
                    const topUsers = hallRes.data.map(u => this.cleanPublicProfile(u));
                    this.safeLocalStorageSet('dito_network_users', JSON.stringify(topUsers));
                    
                    // Atualiza Hall se visível
                    if (this.currentView === 'hall') this.renderHallOfFame();
                    console.log("✅ [Network] Hall da Fama sincronizado!");
                }

                if (meRes.data && this.currentUser) {
                    const netUser = meRes.data;
                    console.log("👤 [Network] Sincronizando meu perfil...");
                    
                    // Atualiza apenas dados que mudaram
                    this.currentUser.fans = parseInt(netUser.fans || 0);
                    this.currentUser.sales = parseFloat(netUser.sales || 0);

                    // Sincronização de Posts e Compras (Mantém o que for mais novo)
                    let netPosts = [];
                    let netPurchases = [];
                    try {
                        netPosts = netUser.posts ? (typeof netUser.posts === 'string' ? JSON.parse(netUser.posts) : netUser.posts) : [];
                        netPurchases = netUser.purchases ? (typeof netUser.purchases === 'string' ? JSON.parse(netUser.purchases) : netUser.purchases) : [];
                    } catch (e) { console.warn("Erro parse net data", e); }

                    const localPosts = JSON.parse(localStorage.getItem('dito_profile_posts') || '[]');
                    const localPurchases = JSON.parse(localStorage.getItem('dito_purchased_products') || '[]');

                    if (netPosts.length >= localPosts.length) {
                        localStorage.setItem('dito_profile_posts', JSON.stringify(netPosts));
                        this.currentUser.posts = netPosts;
                    }
                    if (netPurchases.length >= localPurchases.length) {
                        localStorage.setItem('dito_purchased_products', JSON.stringify(netPurchases));
                        this.purchasedProducts = netPurchases;
                    }

                    // Atualiza Saldo
                    localStorage.setItem('dito_balance', netUser.balance || '0');
                    localStorage.setItem(`user_balance_vanilla_${this.getUserKey()}`, netUser.balance || '0');
                    
                    // Salva sessão localmente
                    this.currentUser = { ...this.currentUser, ...netUser };
                    this.saveSession(this.currentUser);
                }
            } catch (e) {
                console.warn("⚠️ [Network] Erro na conexão segmentada:", e);
            }
        },

        safeLocalStorageSet(key, value) {
            try {
                localStorage.setItem(key, value);
            } catch (e) {
                if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                    console.warn("⚠️ [Storage] Memória cheia! Limpando cache de rede para liberar espaço...");
                    // Limpa dados pesados de cache para priorizar os novos
                    localStorage.removeItem('dito_network_users');
                    localStorage.removeItem('dito_usuarios');
                    try {
                        localStorage.setItem(key, value);
                    } catch (retryError) {
                        console.error("❌ [Storage] Falha crítica de memória:", retryError);
                    }
                }
            }
        },

        async syncUserToNetwork(user) {
            if (!supabase) return;
            try {
                const key = this.getUserKey();
                const payload = {
                    username: user.username,
                    password: user.password,
                    email: user.email || "",
                    name: user.name || user.username,
                    bio: user.bio || "Membro Dito Network",
                    sales: Number(user.sales || 0),
                    fans: Number(user.fans || 0),
                    balance: Number(localStorage.getItem(`user_balance_vanilla_${key}`) || user.balance || 0),
                    purchases: JSON.stringify(this.purchasedProducts),
                    link: user.link || "",
                    avatar: user.avatar || "",
                    posts: JSON.stringify(user.posts || []),
                    last_seen: new Date().toISOString(),
                    withdrawPixKey: user.withdrawPixKey || "",
                    withdrawCardNumber: user.withdrawCardNumber || "",
                    withdrawCardName: user.withdrawCardName || ""
                };
                
                const { error } = await supabase.from('dito_users').upsert([payload], { onConflict: 'username' });
                
                if (error) {
                    console.warn("⚠️ [Network] Erro Sync:", error.message);
                    if (error.message.includes('column "email" does not exist')) {
                        this.showNotification('Erro de Banco: E-mail não suportado no Supabase.', 'error');
                    }
                } else {
                    console.log("🚀 Sincronizado com sucesso!");
                    this.updateBalanceUI();
                }
            } catch (e) {
                console.warn("⚠️ [Network] Erro crítico sync:");
            }
        },

        async fetchNetworkProducts() {
            if (!supabase) return;
            try {
                // Busca apenas os produtos mais recentes do Mercado (Top 50)
                const { data, error } = await supabase.from('dito_market_products')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (data && !error) {
                    let local = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
                    data.forEach(net => {
                        const idx = local.findIndex(p => p.id === net.id);
                        const parsed = { ...net, price: Number(net.price), content: net.content ? JSON.parse(net.content) : null };
                        if (idx !== -1) local[idx] = parsed;
                        else local.push(parsed);
                    });
                    
                    // Mantém o cache local limpo (Mínimo de 100 itens no total para não travar)
                    if (local.length > 100) local = local.slice(0, 100);

                    this.safeLocalStorageSet('dito_products_vanilla', JSON.stringify(local));
                    this.products = local;
                    
                    if (this.currentView === 'mercado') this.renderMarketHome();
                }
            } catch (e) {
                console.warn("⚠️ [Network] Erro ao buscar produtos:", e);
            }
        },

        async syncProductToNetwork(product) {
            if (!supabase) return;
            try {
                const { error } = await supabase.from('dito_market_products').upsert({
                    id: product.id,
                    name: product.name,
                    description: product.description,
                    price: Number(product.price),
                    type: product.type,
                    image: product.image,
                    author: product.author,
                    seller: product.seller,
                    visible: product.visible,
                    sales_link: product.sales_link || "",
                    content: JSON.stringify(product.content || [])
                }, { onConflict: 'id' });
                if (error) console.error("❌ Erro Sync Produto:", error.message);
                else console.log("☁️ Produto compartilhado na rede!");
            } catch (e) {}
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
                    <button onclick="app.navigate('perfil')" style="font-size: 10px; font-weight: 900; text-transform: uppercase; background: transparent; border: 1px solid #ddd; padding: 10px 16px; border-radius: 30px; cursor: pointer;">Ver perfil</button>
                </div>
            `;
        },

        addToCartFromDetail() {
            if (this.selectedProduct) {
                this.cart.push(this.selectedProduct);
                localStorage.setItem(`dito_cart_${this.getUserKey()}`, JSON.stringify(this.cart));
                this.updateCartBadge();
                this.showNotification("Adicionado à sacola!", "success");
                this.setMarketView('home');
            }
        },


        renderMarketCheckout(container) {
            const template = document.getElementById('template-checkout'); 
            if (!template) return;
            container.innerHTML = template.innerHTML;
            
            const list = document.getElementById('checkout-items-list');
            if (!list) return;

            list.innerHTML = this.cart.map(item => `
                <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px;">
                    <span style="color: #666; font-weight: 500;">${item.name}</span>
                    <span style="font-weight: 800; color: #000;">R$ ${parseFloat(item.price || 0).toFixed(2)}</span>
                </div>
            `).join('');

            const hasPurchased = localStorage.getItem('dito_purchased_products');
            const isFirstPurchase = !(hasPurchased && JSON.parse(hasPurchased).length > 0);
            const userCoins = parseInt(localStorage.getItem('dito_coins') || '0');
            
            const rewardsSection = document.createElement('div');
            rewardsSection.style.borderTop = '1px solid #f0f0f0';
            rewardsSection.style.marginTop = '16px';
            rewardsSection.style.paddingTop = '16px';
            rewardsSection.innerHTML = `
                ${isFirstPurchase ? `
                <div style="background: rgba(34, 197, 94, 0.05); border: 1px dashed #22c55e; padding: 12px; border-radius: 12px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="zap" style="width: 16px; color: #22c55e;"></i>
                    <p style="font-size: 10px; font-weight: 900; color: #22c55e;">PRIMEIRA COMPRA: 75% OFF!</p>
                </div>
                ` : ''}

                <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 12px; font-weight: 900; color: #000;">Usar Moedas Dito:</span>
                    <span style="font-size: 11px; font-weight: 800; color: #999;"><span id="coins-to-use-label">0</span>% desconto</span>
                </div>
                <input type="range" class="coin-slider" id="coin-discount-slider" min="0" max="${Math.min(userCoins, 75)}" value="0" oninput="app.applyCoinDiscount(this.value)" style="width: 100%; margin-bottom: 8px;">
                <p style="font-size: 9px; color: #ccc; font-weight: 700;">Limite de desconto com moedas: 75%</p>
                
                <div id="pix-payment-actions">
                    <button onclick="app.processPaymentMP('pix')" style="width: 100%; height: 60px; background: #000; color: #fff; border: none; border-radius: 16px; font-weight: 900; font-size: 14px; margin-top: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                        <i data-lucide="diamond" style="width: 18px;"></i> GERAR PIX REAL
                    </button>
                </div>
            `;
            list.appendChild(rewardsSection);
            
            this.paymentMethod = 'pix'; // Reset para Pix
            this.recalculateCheckoutTotal();
            if (window.lucide) lucide.createIcons();
        },

        generateCheckoutQR() {
            const qrImg = document.getElementById('checkout-qr-code');
            const qrLoading = document.getElementById('qr-loading');
            const btnPayPal = document.getElementById('btn-paypal-direct');
            const paymentText = document.getElementById('payment-text');
            const copyText = document.getElementById('btn-copy-text');
            
            if (!qrImg) return;

            // Determina o link baseado no método
            let link = "";
            
            // Prioridade: Link do primeiro produto no carrinho -> Link Global -> Link Fake
            const productWithLink = this.cart.find(p => p.sales_link);
            const activePayPalLink = productWithLink ? productWithLink.sales_link : this.paypalLink;

            if (this.paymentMethod === 'pix') {
                link = "https://dito.app/pix-placeholder-" + Date.now();
                paymentText.innerText = "Escaneie o QR Code acima para pagar via Pix e receber seu acesso imediato.";
                copyText.innerText = "Copiar código Pix";
                
                // Botão de simulação APENAS para o Ditão (Admin)
                const ppContainer = document.getElementById('paypal-button-container');
                if (ppContainer) {
                    if (this.currentUser && (this.currentUser.username === 'Ditão' || this.currentUser.username === 'benedito_pro')) {
                        ppContainer.style.display = 'block';
                        ppContainer.innerHTML = `
                            <button onclick="app.processPayment()" style="width: 100%; height: 56px; background: #22c55e; color: #fff; border: none; border-radius: 16px; font-weight: 900; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 10px 20px rgba(34, 197, 94, 0.1);">
                                <i data-lucide="check-circle" style="width: 18px;"></i> Simular Pagamento Pix (ADM)
                            </button>
                        `;
                    } else {
                        ppContainer.style.display = 'none'; // Outros usuários não vêem botão de simulação
                    }
                    if (window.lucide) lucide.createIcons();
                }
            } else {
                // Se for PayPal (Cartão)
                link = activePayPalLink; 
                paymentText.innerText = "Use o botão do PayPal abaixo para pagar com cartão em até 12x.";
                copyText.innerText = "Copiar link de pagamento";
                
                const total = this.cart.reduce((sum, p) => sum + p.price, 0);
                const productId = productWithLink ? productWithLink.id : 'global';
                const ppContainer = document.getElementById('paypal-button-container');
                if (ppContainer) {
                    ppContainer.style.display = 'block';
                    ppContainer.innerHTML = ''; // Limpa botões anteriores
                    this.initPayPalOfficialButton(total.toFixed(2), productId);
                }
            }

            // Gera o QR Code usando API pública (QRServer)
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(link)}`;
            
            qrImg.src = qrUrl;
            qrImg.onload = () => {
                if (qrLoading) qrLoading.style.display = 'none';
                qrImg.style.display = 'block';
            };
        },
        initPayPalOfficialButton(amount, productId) {
            if (typeof paypal === 'undefined') {
                console.error("PayPal SDK not loaded");
                return;
            }
            paypal.Buttons({
                createOrder: (data, actions) => {
                    return actions.order.create({
                        purchase_units: [{
                            amount: { value: amount }
                        }]
                    });
                },
                onApprove: (data, actions) => {
                    return actions.order.capture().then(details => {
                        this.unlockPurchasedProducts(productId);
                    });
                }
            }).render('#paypal-button-container');
        },

        async unlockPurchasedProducts(productId) {
            this.showNotification("Compra confirmada!", "success");
            
            const productsToUnlock = productId ? [this.products.find(p => p.id === productId) || { name: 'Produto Dito', id: productId }] : this.cart;
            const buyerKey = this.getUserKey();

            for (let product of productsToUnlock) {
                // 1. REGISTRA PARA O COMPRADOR
                if (!this.purchasedProducts.find(p => p.id === product.id)) {
                    this.purchasedProducts.push(product);
                }

                // 2. CRÉDITO JUSTO PARA O VENDEDOR (REDE)
                const sellerName = product.author || product.seller;
                if (sellerName && sellerName !== 'Ditão' && sellerName !== 'Visitante') {
                    console.log(`💰 [Financeiro] Creditando R$ ${product.price} para o vendedor: ${sellerName}`);
                    await this.creditSeller(sellerName, product.price, product.name);
                }
            }

            this.safeLocalStorageSet(`dito_purchased_products_${buyerKey}`, JSON.stringify(this.purchasedProducts));
            
            // Limpa o carrinho
            this.cart = [];
            localStorage.setItem(`dito_cart_${buyerKey}`, '[]');
            this.updateCartBadge();
            
            setTimeout(() => {
                this.navigate('meus-cursos');
                this.showNotification("Obrigado pela compra! Acesso liberado.", "success");
            }, 1000);
        },

        async creditSeller(sellerUsername, amount, productName) {
            if (!supabase) return;
            try {
                // Busca o vendedor na rede
                const { data: sellerData, error } = await supabase
                    .from('dito_users')
                    .select('*')
                    .eq('username', sellerUsername)
                    .maybeSingle();

                if (sellerData && !error) {
                    const newBalance = (parseFloat(sellerData.balance || 0) + parseFloat(amount)).toFixed(2);
                    const newSalesTotal = (parseFloat(sellerData.sales || 0) + parseFloat(amount)).toFixed(2);
                    
                    // Adiciona ao histórico de vendas do vendedor (json column 'purchases' or similar)
                    let history = [];
                    try {
                        history = sellerData.purchases ? (typeof sellerData.purchases === 'string' ? JSON.parse(sellerData.purchases) : sellerData.purchases) : [];
                    } catch(e) {}
                    
                    history.push({
                        item: productName,
                        value: parseFloat(amount),
                        timestamp: new Date().toISOString(),
                        type: 'sale'
                    });

                    // Atualiza na Rede
                    await supabase.from('dito_users').update({
                        balance: newBalance,
                        sales: newSalesTotal,
                        purchases: JSON.stringify(history)
                    }).eq('username', sellerUsername);

                    console.log(`✅ [Financeiro] R$ ${amount} creditados com sucesso para ${sellerUsername}`);
                    
                    // ENVIA NOTIFICAÇÃO DE VENDA PARA O VENDEDOR
                    this.sendNetworkNotification(sellerUsername, 'sale', 'Venda Realizada! 💰', `Você vendeu "${productName}" por R$ ${amount}.`);
                }
            } catch (e) {
                console.error("❌ [Financeiro] Erro ao creditar vendedor:", e);
            }
        },

        copyPaymentCode() {
            const link = (this.paymentMethod === 'pix') ? "00020126360014BR.GOV.BCB.PIX0114+5511999999999..." : this.paypalLink;
            navigator.clipboard.writeText(link).then(() => {
                this.showNotification("Copiado com sucesso!", "success");
            });
        },

        selectPayment(method, btn) {
            this.paymentMethod = method;
            document.querySelectorAll('.payment-opt').forEach(opt => {
                opt.style.background = '#fff';
                opt.style.border = '2px solid #eee';
            });
            
            btn.style.background = 'linear-gradient(#fff, #fff) padding-box, linear-gradient(90deg, #ff005c 0%, #0487ff 100%) border-box';
            btn.style.border = '2px solid transparent';
            
            const pixActions = document.getElementById('pix-payment-actions');
            const ppContainer = document.getElementById('paypal-button-container');
            const statusMsg = document.getElementById('payment-status-message');

            if (method === 'pix') {
                if (pixActions) pixActions.style.display = 'block';
                if (ppContainer) ppContainer.style.display = 'none';
                if (statusMsg) statusMsg.innerHTML = `<i data-lucide="shield-check" style="width: 32px; color: #22c55e; margin-bottom: 12px;"></i><p style="font-size: 11px; font-weight: 800; color: #999; line-height: 1.4;">Clique no botão abaixo para gerar seu QR Code Pix real via Mercado Pago.</p>`;
            } else {
                if (pixActions) pixActions.style.display = 'none';
                if (ppContainer) {
                    ppContainer.style.display = 'block';
                    ppContainer.innerHTML = ''; // Limpa anterior
                    const total = this.recalculateCheckoutTotal();
                    this.initPayPalOfficialButton(total.toFixed(2), 'cart');
                }
                if (statusMsg) statusMsg.innerHTML = `<i data-lucide="credit-card" style="width: 32px; color: #0487ff; margin-bottom: 12px;"></i><p style="font-size: 11px; font-weight: 800; color: #999; line-height: 1.4;">Finalize seu pagamento com segurança usando seu cartão via PayPal.</p>`;
            }
            if (window.lucide) lucide.createIcons();
        },

        copyPix() {
            this.showNotification("Código Pix copiado!", "success");
        },

        processPayment() {
            // Segurança Extra: Apenas ADMs podem pular o pagamento real de Pix para testes
            if (!this.currentUser || (this.currentUser.username !== 'Ditão' && this.currentUser.username !== 'benedito_pro')) {
                this.showNotification("Aguardando confirmação real do Pix...", "error");
                return;
            }

            this.showLoading(true, "Verificando pagamento Pix (Modo ADM)...");
            setTimeout(() => {
                this.showLoading(false);
                this.unlockPurchasedProducts();
            }, 1500);
        },

        renderPurchasedProducts() {
            const list = document.getElementById('purchased-products-list');
            if (!list) return;

            if (this.purchasedProducts.length === 0) {
                list.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px; color: #ccc;">
                        <i data-lucide="shopping-bag" style="width: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
                        <p style="font-weight: 800; font-size: 14px;">Nenhuma compra realizada ainda.</p>
                        <button onclick="app.navigate('mercado')" style="margin-top: 20px; background: #000; color: #fff; border: none; padding: 14px 32px; border-radius: 40px; font-weight: 900; font-size: 11px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px;">Ir para o Mercado</button>
                    </div>
                `;
                if (window.lucide) lucide.createIcons();
                return;
            }

            list.innerHTML = this.purchasedProducts.map(p => `
                <div style="background: #fff; border-radius: 24px; border: 1px solid #eee; padding: 16px; display: flex; gap: 16px; align-items: center; box-shadow: 0 4px 20px rgba(0,0,0,0.02); position: relative;">
                    <div style="width: 70px; height: 70px; background: #f8f8f8; border-radius: 18px; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="play-circle" style="width: 28px; color: #ccc;"></i>`}
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <span style="font-size: 8px; font-weight: 900; background: #f5f5f5; padding: 4px 8px; border-radius: 6px; text-transform: uppercase; color: #999; margin-bottom: 4px; display: inline-block;">${p.type || 'Produto'}</span>
                        <h4 style="font-size: 14px; font-weight: 900; color: #000; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</h4>
                        <p style="font-size: 10px; color: #22c55e; font-weight: 900;">Acesso Vitalício</p>
                    </div>
                    <button onclick="app.openCourse('${p.id}')" style="width: 48px; height: 48px; background: #000; color: #fff; border: none; border-radius: 16px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.3s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        <i data-lucide="arrow-right" style="width: 20px;"></i>
                    </button>
                </div>
            `).join('');
            if (window.lucide) lucide.createIcons();
        },

        openCourse(id) {
            this.activeCourse = this.purchasedProducts.find(p => p.id === id);
            if (this.activeCourse) {
                this.activePlayerTab = 'aulas';
                this.openModules = {}; // Reseta acordeão
                
                // Seleciona a primeira aula por padrão se houver conteúdo real
                if (this.activeCourse.content && this.activeCourse.content.length > 0) {
                    const firstModule = this.activeCourse.content[0];
                    this.openModules[firstModule.id] = true; // Abre o primeiro módulo
                    if (firstModule.lessons && firstModule.lessons.length > 0) {
                        this.currentLessonId = firstModule.lessons[0].id;
                        this.currentLessonTitle = firstModule.lessons[0].title;
                    }
                }
                this.navigate('curso-player');
            }
        },

        renderCoursePlayer() {
            if (!this.activeCourse) return;
            const course = this.activeCourse;
            
            document.getElementById('player-course-name').innerText = course.name;
            const contentArea = document.getElementById('player-content');
            const controls = document.getElementById('video-controls');
            
            // Lógica baseada no Tipo
            if (course.type === 'Ebook') {
                contentArea.innerHTML = `<div style="text-align: center;"><i data-lucide="book-open" style="width: 60px; margin-bottom: 12px;"></i><p style="font-weight: 900; font-size: 14px;">LEITURA DISPONÍVEL</p><button style="margin-top: 16px; background: #fff; color: #000; border: none; padding: 12px 28px; border-radius: 30px; font-weight: 900; font-size: 12px; cursor: pointer; text-transform: uppercase;">Baixar PDF</button></div>`;
                controls.style.display = 'none';
            } else if (course.type === 'Mentoria') {
                contentArea.innerHTML = `<div style="text-align: center;"><i data-lucide="users" style="width: 60px; margin-bottom: 12px;"></i><p style="font-weight: 900; font-size: 14px;">MENTORIA AO VIVO</p><button style="margin-top: 16px; background: #ee4d2d; color: #fff; border: none; padding: 12px 28px; border-radius: 30px; font-weight: 900; font-size: 12px; cursor: pointer; text-transform: uppercase;">Entrar na Sala</button></div>`;
                controls.style.display = 'none';
            } else {
                // Course (Video)
                contentArea.innerHTML = `<div style="position: relative; width: 100%; height: 100%; background: #000; display: flex; align-items: center; justify-content: center;"><i data-lucide="play" style="width: 40px; color: #fff; opacity: 0.3;"></i></div>`;
                controls.style.display = 'flex';
                this.setupVideoControls();
            }

            // Renderização da Grade Curricular (Aulas Reais vs Fake)
            const lessonsList = document.getElementById('lessons-list');
            if (!lessonsList) return;

            const structure = course.content; // Array de Módulos

            if (structure && structure.length > 0) {
                // RENDERIZAÇÃO REAL POR MÓDULOS (ACORDEÃO)
                lessonsList.innerHTML = structure.map(m => {
                    const isOpen = this.openModules[m.id];
                    return `
                        <div style="margin-bottom: 12px; border-radius: 50px; border: 1px solid #f5f5f5; overflow: hidden;">
                            <div onclick="app.toggleModuleAccordion('${m.id}')" style="display: flex; justify-content: space-between; align-items: center; padding: 18px 24px; background: ${isOpen ? '#fdfdfd' : '#fff'}; cursor: pointer;">
                                <h5 style="font-size: 13px; font-weight: 900; color: #000; letter-spacing: -0.2px;">${m.title}</h5>
                                <i data-lucide="chevron-${isOpen ? 'up' : 'down'}" style="width: 18px; color: #ccc;"></i>
                            </div>
                            <div id="module-content-${m.id}" style="display: ${isOpen ? 'flex' : 'none'}; flex-direction: column; gap: 6px; padding: 0 10px 16px;">
                                ${m.lessons.map((l, idx) => `
                                    <div style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: ${this.currentLessonId === l.id ? '#000' : 'transparent'}; border-radius: 50px; cursor: pointer; transition: 0.3s;" onclick="app.switchLesson('${l.id}', '${l.title}', '${m.id}')">
                                        <div style="width: 24px; height: 24px; background: ${this.currentLessonId === l.id ? '#fff' : '#f5f5f5'}; color: ${this.currentLessonId === l.id ? '#000' : '#666'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 900;">${idx + 1}</div>
                                        <div style="flex: 1;">
                                            <p style="font-size: 12px; font-weight: 900; color: ${this.currentLessonId === l.id ? '#fff' : '#000'};">${l.title}</p>
                                        </div>
                                        ${this.currentLessonId === l.id ? '<i data-lucide="play" style="width: 14px; color: #fff; fill: #fff;"></i>' : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }).join('');
                
                const currentTitleDisplay = document.getElementById('player-lesson-name');
                if (currentTitleDisplay) currentTitleDisplay.innerText = this.currentLessonTitle || "Selecione uma aula";

            } else {
                // FALLBACK: Aulas Fake (para produtos antigos sem estrutura)
                const fakeLessons = [
                    { id: 1, title: 'Introdução e Boas Vindas', duration: '05:20' },
                    { id: 2, title: 'Mentalidade de Sucesso', duration: '12:45' }
                ];
                lessonsList.innerHTML = `
                    <h5 style="font-size: 11px; font-weight: 900; color: #999; text-transform: uppercase; margin-bottom: 12px; padding-left: 8px;">Módulo Único</h5>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${fakeLessons.map(l => `
                            <div style="display: flex; align-items: center; gap: 12px; padding: 16px; background: ${this.currentLessonId === l.id ? '#000' : '#fff'}; border: 1px solid #eee; border-radius: 16px; cursor: pointer;" onclick="app.switchLesson(${l.id}, '${l.title}')">
                                <div style="width: 32px; height: 32px; background: ${this.currentLessonId === l.id ? '#fff' : '#eee'}; color: #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900;">${l.id}</div>
                                <div style="flex: 1;"><p style="font-size: 12px; font-weight: 900; color: ${this.currentLessonId === l.id ? '#fff' : '#000'};">${l.title}</p></div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            this.renderLessonInteractive();
            if (window.lucide) lucide.createIcons();
        },

        switchLesson(id, title, moduleId) {
            this.currentLessonId = id;
            this.currentLessonTitle = title;
            if (moduleId) this.openModules[moduleId] = true; // Garante que o módulo atual fique aberto
            const titleDisplay = document.getElementById('player-lesson-name');
            if (titleDisplay) titleDisplay.innerText = title;
            this.renderCoursePlayer(); 
        },

        toggleModuleAccordion(moduleId) {
            this.openModules[moduleId] = !this.openModules[moduleId];
            this.renderCoursePlayer();
        },

        setPlayerTab(tab, element) {
            this.activePlayerTab = tab;
            
            // UI Update
            document.querySelectorAll('.player-tab').forEach(t => {
                t.style.color = '#ccc';
                t.style.borderBottom = '1px solid transparent';
            });
            element.style.color = '#000';
            element.style.borderBottom = '2px solid #000';

            // Visibility
            document.getElementById('tab-content-aulas').style.display = (tab === 'aulas' ? 'block' : 'none');
            document.getElementById('tab-content-comments').style.display = (tab === 'comments' ? 'block' : 'none');
            document.getElementById('tab-content-ratings').style.display = (tab === 'ratings' ? 'block' : 'none');

            this.renderLessonInteractive();
        },
        
        currentLessonTitle: '',

        renderLessonInteractive() {
            // Render Comments
            const commentsList = document.getElementById('comments-list');
            const lessonKey = `${this.activeCourse.id}_${this.currentLessonId}`;
            const comments = this.courseComments[lessonKey] || [];

            if (comments.length === 0) {
                commentsList.innerHTML = `<p style="text-align: center; color: #ccc; font-size: 12px; padding: 20px;">Nenhum comentário ainda. Seja o primeiro!</p>`;
            } else {
                commentsList.innerHTML = comments.map(c => `
                    <div style="display: flex; gap: 12px;">
                        <div style="width: 32px; height: 32px; background: #000; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 900;">${this.currentUser?.username[0].toUpperCase()}</div>
                        <div style="flex: 1; background: #f8f8f8; padding: 12px; border-radius: 0 16px 16px 16px;">
                            <p style="font-size: 10px; font-weight: 900; margin-bottom: 4px;">${this.currentUser?.username} <span style="font-weight: 400; color: #999; margin-left: 6px;">${c.date}</span></p>
                            <p style="font-size: 12px; color: #444; font-weight: 500;">${c.text}</p>
                        </div>
                    </div>
                `).join('');
            }

            // Render Stars (Individual)
            const rating = this.courseRatings[lessonKey] || 0;
            this.drawStars(rating);
            
            const status = document.getElementById('rating-status');
            const userRatingLabel = document.getElementById('user-last-rating');
            if (status) status.style.display = rating > 0 ? 'block' : 'none';
            if (userRatingLabel) userRatingLabel.innerText = rating;

            // Render Global Average
            const globalData = this.globalRatings[lessonKey] || { total: 0, sum: 0 };
            const avg = globalData.total > 0 ? (globalData.sum / globalData.total).toFixed(1) : "5.0";
            
            const avgLabel = document.getElementById('lesson-avg-score');
            const totalLabel = document.getElementById('lesson-total-ratings');
            if (avgLabel) avgLabel.innerText = avg;
            if (totalLabel) totalLabel.innerText = `${globalData.total} Avaliações`;
        },

        drawStars(count) {
            const stars = document.querySelectorAll('#lesson-stars i');
            stars.forEach((star, idx) => {
                if (idx < count) {
                    star.style.color = '#facc15';
                    star.style.fill = '#facc15';
                } else {
                    star.style.color = '#ddd';
                    star.style.fill = 'transparent';
                }
            });
        },

        hoverStars(count) {
            this.drawStars(count);
        },

        addComment() {
            const input = document.getElementById('comment-input');
            const text = input.value.trim();
            if (!text) return;

            const lessonKey = `${this.activeCourse.id}_${this.currentLessonId}`;
            if (!this.courseComments[lessonKey]) this.courseComments[lessonKey] = [];
            
            // Unshift para ficar no topo (mais recente)
            this.courseComments[lessonKey].unshift({
                text: text,
                date: 'Agora mesmo',
                user: this.currentUser?.username
            });

            localStorage.setItem('dito_course_comments', JSON.stringify(this.courseComments));
            input.value = '';
            this.renderLessonInteractive();
        },

        setLessonRating(rating) {
            const lessonKey = `${this.activeCourse.id}_${this.currentLessonId}`;
            
            // Verifica se o usuário já avaliou antes para não duplicar no global (ou atualiza)
            const oldRating = this.courseRatings[lessonKey] || 0;
            
            // Update individual
            this.courseRatings[lessonKey] = rating;
            localStorage.setItem('dito_course_ratings', JSON.stringify(this.courseRatings));

            // Update global pool (simulated)
            if (!this.globalRatings[lessonKey]) this.globalRatings[lessonKey] = { total: 0, sum: 0 };
            
            if (oldRating === 0) {
                this.globalRatings[lessonKey].total += 1;
                this.globalRatings[lessonKey].sum += rating;
            } else {
                this.globalRatings[lessonKey].sum = (this.globalRatings[lessonKey].sum - oldRating) + rating;
            }

            localStorage.setItem('dito_global_ratings', JSON.stringify(this.globalRatings));
            
            this.renderLessonInteractive();
            this.showNotification("Sua avaliação foi registrada!", "success");
        },

        setupVideoControls() {
            let isPlaying = false;
            let speed = 1.0;
            const btnPlay = document.getElementById('btn-play');
            const btnSpeed = document.getElementById('btn-speed');

            if (btnPlay) {
                btnPlay.onclick = () => {
                    isPlaying = !isPlaying;
                    btnPlay.setAttribute('data-lucide', isPlaying ? 'pause' : 'play');
                    if (window.lucide) lucide.createIcons();
                };
            }

            if (btnSpeed) {
                btnSpeed.onclick = () => {
                    speed = (speed === 2.0) ? 1.0 : speed + 0.5;
                    btnSpeed.innerText = speed.toFixed(1) + 'x';
                };
            }
        },

        setPlayerTab(tab, btn) {
            document.querySelectorAll('.player-tab').forEach(t => {
                t.style.color = '#ccc';
                t.style.borderBottom = 'none';
            });
            btn.style.color = '#000';
            btn.style.borderBottom = '2px solid #000';

            document.querySelectorAll('.player-tab-content').forEach(c => c.style.display = 'none');
            document.getElementById(`tab-content-${tab}`).style.display = 'block';
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
            const listTop = document.getElementById('hall-top-others');
            const pod1 = document.getElementById('hall-1st-podium'); // Preciso garantir que o container do 1º seja clicável
            const firstAvatar = document.getElementById('hall-1st-avatar');
            const firstName = document.getElementById('hall-1st-name');
            const firstSales = document.getElementById('hall-1st-sales');
            
            if (!listTop) return;

            // Carrega usuários reais da REDE (Sincronizados via Supabase)
            const users = JSON.parse(localStorage.getItem('dito_network_users') || localStorage.getItem('dito_usuarios') || '[]');
            
            if (users.length === 0) {
                if (firstName) firstName.innerText = "Conectando à rede...";
                listTop.innerHTML = `<div style="text-align: center; padding: 40px;"><div class="loading-spinner" style="margin: 0 auto 16px;"></div><p style="color: #ccc; font-weight: 800; font-size: 11px; text-transform: uppercase;">Buscando competidores reais...</p></div>`;
                // Tenta buscar agora se estiver vazio
                this.fetchNetworkUsers();
                return;
            }

            // Busca usuários e calcula vendas baseadas no CICLO 30 DIAS
            const sortedRank = users.map(u => {
                let salesHistory = [];
                try {
                    // Se for o usuário atual, usa o histórico local para garantir dados em tempo real
                    if (this.currentUser && u.username === this.currentUser.username) {
                        salesHistory = JSON.parse(localStorage.getItem('dito_real_sales_history') || '[]');
                    } else {
                        // Para outros, tenta pegar o que veio do banco (se disponível) ou simula
                        salesHistory = u.purchases ? (typeof u.purchases === 'string' ? JSON.parse(u.purchases) : u.purchases) : [];
                    }
                } catch(e) {}

                const cycleSum = Array.isArray(salesHistory) ? salesHistory.reduce((acc, s) => {
                    const d = new Date(s.timestamp || Date.now()).getDate();
                    if (d >= 1 && d <= 30) return acc + (Number(s.value) || 0);
                    return acc;
                }, 0) : Number(u.sales || 0);

                return {
                    ...u,
                    sales: cycleSum,
                    username: u.username || 'membro_pro',
                    avatar: u.avatar || ''
                };
            }).sort((a,b) => b.sales - a.sales);

            const winner = sortedRank[0];
            const others = sortedRank.slice(1, 6); // Pega do 2º ao 6º (5 itens)

            // Renderiza o 1º Lugar
            if (winner) {
                // Se o vencedor for o próprio usuário logado, garante que a imagem venha da memória atual se o banco estiver atrasado
                const avatarUrl = (this.currentUser && winner.username === this.currentUser.username) ? (this.currentUser.avatar || winner.avatar) : winner.avatar;
                
                if (firstAvatar) {
                    firstAvatar.innerHTML = avatarUrl ? `<img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="star" style="width: 60px; color: #eee;"></i>`;
                }
                if (firstName) firstName.innerText = winner.username;
                if (firstSales) firstSales.innerHTML = `<span style="font-size: 20px; opacity: 0.3;">R$</span> ${winner.sales.toLocaleString()}`;
                
                // Faz o pódio do 1º lugar ser clicável
                const pod = document.querySelector('.podium-1st');
                if (pod) {
                    pod.style.cursor = 'pointer';
                    pod.onclick = () => this.viewPublicProfile(winner.username);
                }
            }

            // Renderiza o Ranking (2º ao 6º)
            listTop.innerHTML = others.map((u, i) => {
                const pos = i + 2;
                const bg = '#fff';
                const border = '#f9f9f9';

                return `
                <div onclick="app.viewPublicProfile('${u.username}')" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: ${bg}; border-radius: 20px; border: 1px solid ${border}; cursor: pointer; transition: 0.3s;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-weight: 900; color: #000; font-size: 11px; width: 24px; text-align: center;">${pos}º</span>
                        <div style="width: 38px; height: 38px; border-radius: 50%; overflow: hidden; background: #f5f5f5; border: 1px solid #eee; display: flex; align-items: center; justify-content: center;">
                            ${u.avatar ? `<img src="${u.avatar}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="user" style="width: 14px; color: #ccc;"></i>`}
                        </div>
                        <div>
                            <p style="font-weight: 900; font-size: 11px; color: #000; margin-bottom: 0px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70px;">${u.username}</p>
                            <p style="font-size: 7px; font-weight: 800; color: #ccc; text-transform: uppercase;">Membro</p>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-weight: 900; font-size: 11px; color: #000;">R$ ${parseInt(u.sales || 0).toLocaleString()}</span>
                    </div>
                </div>
                `;
            }).join('');

            // Atualiza a posição do usuário logado de forma inteligente
            const currentUsername = this.currentUser?.username?.toLowerCase();
            const myRankPos = sortedRank.findIndex(u => u.username?.toLowerCase() === currentUsername) + 1;
            
            const rankLabel = document.getElementById('hall-user-rank-text');
            if (rankLabel) {
                if (myRankPos > 0) {
                    rankLabel.innerText = `Você é o ${myRankPos}º`;
                } else if (this.currentUser) {
                    // Se não estiver no Top 6, mas já tiver vendas, ou apenas for um novo membro
                    rankLabel.innerText = `Você é o ${sortedRank.length + 1}º (Novo Membro)`;
                } else {
                    rankLabel.innerText = 'Entre para entrar no ranking';
                }
            }

            if (window.lucide) lucide.createIcons();
        },




        showNotification(message, type = 'success') {
            let container = document.querySelector('.notification-container');
            if (!container) {
                container = document.createElement('div');
                container.className = 'notification-container';
                document.body.appendChild(container);
            }

            const pill = document.createElement('div');
            pill.className = `notif-pill ${type}`;
            
            let icon = 'check-circle';
            if (type === 'error') icon = 'alert-circle';
            if (type === 'info') icon = 'info';

            pill.innerHTML = `
                <i data-lucide="${icon}" style="width: 16px;"></i>
                <span>${message}</span>
            `;

            container.appendChild(pill);
            if (window.lucide) lucide.createIcons();

            setTimeout(() => pill.classList.add('show'), 10);
            
            setTimeout(() => {
                pill.classList.remove('show');
                setTimeout(() => pill.remove(), 500);
            }, 4000);
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

        navigate(view, direction = null) { 
            try {
                console.log("Navegando para:", view);
                this.currentView = view;

                const isLoggedIn = localStorage.getItem('is_logged_in_vanilla') === 'true';
                if (!isLoggedIn && view !== 'login' && view !== 'cadastro') {
                    view = 'login';
                    this.currentView = 'login';
                }

                // Efeito de Transição de Página (Arraste)
                const appContainer = document.getElementById('app');
                if (direction && appContainer) {
                    appContainer.classList.remove('view-sliding-right', 'view-sliding-left');
                    // Força reflow para reiniciar animação
                    void appContainer.offsetWidth; 
                    
                    if (direction === 'right') appContainer.classList.add('view-sliding-right');
                    else if (direction === 'left') appContainer.classList.add('view-sliding-left');
                }

                // Force background for Market
                const rootContainer = document.querySelector('.app-container');
                const searchToggle = document.getElementById('search-container');
                if (rootContainer) {
                    if (view === 'mercado') {
                        rootContainer.classList.add('bg-mercado-premium');
                        if (searchToggle) searchToggle.style.background = '#fff';
                    } else {
                        rootContainer.classList.remove('bg-mercado-premium');
                        if (searchToggle) searchToggle.style.background = 'rgba(0,0,0,0.05)';
                    }
                }

                // Renderiza o template básico
                const template = document.getElementById(`template-${view}`);
                if (template) {
                    appContainer.innerHTML = template.innerHTML;
                } else {
                    console.error("Template não encontrado:", view);
                    return;
                }

                // Chamadas lógicas específicas de cada tela
                switch(view) {
                    case 'dashboard': this.updateBalanceUI(); break;
                    case 'mercado': setTimeout(() => this.renderStore(), 10); break;
                    case 'sociedade': this.renderSocieties(); break;
                case 'sociedade-detalhe': this.renderSocietyDetail(); break;
                    case 'hall': this.renderHallOfFame(); break;
                    case 'perfil': this.renderProfile(); break;
                    case 'vendas': this.renderSales(); break;
                    case 'sacar': this.updateWithdrawUI(); break;
                    case 'admin-contas': this.renderAdminUsers(); break;
                    case 'produtos': this.renderMyProducts(); break;
                    case 'meus-cursos': this.renderPurchasedProducts(); break;
                    case 'curso-player': this.renderCoursePlayer(); break;
                }

                // Atualiza Barra de Navegação Global e Header
                const nav = document.getElementById('global-nav');
                const header = document.getElementById('global-header');
                const downloadLink = document.getElementById('download-app-link');
                const isAuthPage = view === 'login' || view === 'cadastro';
                
                if (nav) {
                    nav.style.display = isAuthPage ? 'none' : 'flex';
                    nav.querySelectorAll('.nav-item').forEach(item => {
                        const targetView = item.getAttribute('data-view');
                        const icon = item.querySelector('i');
                        if (targetView === view) {
                            item.classList.add('active-nav');
                            if (icon) icon.style.fill = '#000';
                        } else {
                            item.classList.remove('active-nav');
                            if (icon) icon.style.fill = 'transparent';
                        }
                    });
                }
                
                if (header) {
                    const isMercado = view === 'mercado';
                    header.style.display = isAuthPage ? 'none' : 'flex';
                    header.style.background = '#fff';
                    const logo = document.getElementById('header-logo');
                    const cartIcon = document.getElementById('cart-icon-header');
                    const searchIcon = document.getElementById('search-icon-header');
                    const logoutBtn = document.getElementById('header-logout-btn');
                    const logoutIcon = logoutBtn ? logoutBtn.querySelector('i') : null;
                    const cartBtn = document.getElementById('header-cart-btn');
                    const coinPod = document.getElementById('coin-pod');
                    const searchContainer = document.getElementById('search-container');
                    const createIcon = document.getElementById('header-create-btn') ? document.getElementById('header-create-btn').querySelector('i') : null;

                    if (logo) logo.style.color = isMercado ? '#000' : '#000';
                    if (cartIcon) cartIcon.style.color = isMercado ? '#000' : '#000';
                    if (searchIcon) searchIcon.style.color = isMercado ? '#000' : '#000';
                    if (createIcon) createIcon.style.color = isMercado ? '#000' : '#000';
                    
                    if (logoutBtn) {
                        logoutBtn.style.background = isMercado ? '#fff' : 'rgba(0,0,0,0.05)';
                        logoutBtn.style.border = 'none';
                        if (logoutIcon) logoutIcon.style.color = '#000';
                    }
                    
                    if (cartBtn) {
                        cartBtn.style.display = isMercado ? 'flex' : 'none';
                        cartBtn.style.background = isMercado ? '#fff' : 'rgba(0,0,0,0.05)';
                        cartBtn.style.border = 'none';
                    }
                    
                    if (coinPod) {
                        coinPod.style.display = isMercado ? 'flex' : 'none';
                        coinPod.style.background = isMercado ? '#fff' : 'rgba(255,214,0,0.1)';
                        coinPod.style.border = isMercado ? 'none' : '1px solid rgba(255, 214, 0, 0.2)';
                        coinPod.querySelectorAll('span').forEach(s => s.style.color = '#000');
                    }
                    
                    if (searchContainer) {
                        searchContainer.style.background = isMercado ? '#fff' : 'rgba(0,0,0,0.05)';
                        searchContainer.style.border = 'none';
                    }


                    // Fecha a busca se estiver aberta ao trocar de tela
                    this.toggleSocialSearch(false);
                    // Garante que o badge da sacola esteja atualizado
                    this.updateCartBadge();
                }

                if (downloadLink) {
                    downloadLink.style.display = isAuthPage ? 'none' : 'block';
                }


                if (window.lucide) lucide.createIcons();
            } catch (err) {
                console.error("Erro Crítico na Navegação:", err);
            }
        },

        setMarketView(view, direction) {
            if (direction) {
                const appContainer = document.getElementById('app');
                if (appContainer) {
                    appContainer.classList.remove('view-sliding-right', 'view-sliding-left');
                    void appContainer.offsetWidth;
                    if (direction === 'right') appContainer.classList.add('view-sliding-right');
                    else if (direction === 'left') appContainer.classList.add('view-sliding-left');
                }
            }
            this.marketView = view;
            this.renderStore();
        },

        renderSocieties() {
            const list = document.getElementById('societies-list');
            if (!list) return;

            const saved = JSON.parse(localStorage.getItem('dito_societies') || '[]');
            
            if (saved.length === 0) {
                const initial = [
                    { id: '1', name: "Pro Digital", description: "O maior ecossistema de produtores.", owner: "benedito_pro", entryFee: 0, membersCount: 154 },
                    { id: '2', name: "Clube dos 6 Dígitos", description: "Focado em escala de anúncios.", owner: "ana_scaling", entryFee: 49.90, membersCount: 42 }
                ];
                localStorage.setItem('dito_societies', JSON.stringify(initial));
                this.renderSocieties();
                return;
            }

            list.innerHTML = saved.map(s => {
                const isAdmin = this.currentUser && s.owner === this.currentUser.username;
                return `
                <div class="society-card">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                        <div>
                            <h3 style="font-size: 19px; font-weight: 950; letter-spacing: -1px; display: flex; align-items: center; gap: 8px;">
                                ${s.name} <i data-lucide="${isAdmin ? 'shield-check' : 'users'}" style="width: 17px; color: ${isAdmin ? '#ff005c' : '#000'};"></i>
                            </h3>
                            <p style="font-size: 10px; font-weight: 900; color: #ccc; text-transform: uppercase;">GESTOR: ${s.owner}</p>
                        </div>
                        <div style="padding: 6px 14px; border-radius: 20px; font-size: 10px; font-weight: 900; text-transform: uppercase; background: ${s.entryFee === 0 ? '#f0fdf4' : '#f9f9f9'}; color: ${s.entryFee === 0 ? '#16a34a' : '#666'};">
                            ${s.entryFee === 0 ? 'Gratuita' : 'R$ ' + s.entryFee.toFixed(2)}
                        </div>
                    </div>
                    
                    <p style="font-size: 13px; font-weight: 500; color: #777; line-height: 1.5; margin-bottom: 24px;">Comunidade exclusiva para membros do ${s.name}.</p>
                    
                    <div style="padding-top: 20px; border-top: 1px solid #f9f9f9; display: flex; justify-content: space-between; align-items: flex-end;">
                        <div>
                            <span style="font-size: 10px; font-weight: 900; color: #ccc; text-transform: uppercase; display: block; margin-bottom: 2px;">Membros</span>
                            <span style="font-size: 14px; font-weight: 900; color: #333;">${s.membersCount || 0}</span>
                        </div>
                        <button onclick="app.viewSociety('${s.id}')" style="height: 48px; border-radius: 16px; background: #000; color: #fff; padding: 0 24px; font-size: 11px; font-weight: 900; cursor: pointer; border: none; transition: 0.3s; box-shadow: 0 10px 20px rgba(0,0,0,0.05);">ENTRAR</button>
                    </div>
                </div>
            `}).join('');

            if (window.lucide) lucide.createIcons();
        },

        async viewSociety(id) {
            this.currentSocietyId = id;
            this.currentSocietyTab = 'mural';
            this.navigate('sociedade-detalhe');
        },

        async renderSocietyDetail() {
            if (!this.currentSocietyId) return;
            
            const societies = JSON.parse(localStorage.getItem('dito_societies') || '[]');
            const soc = societies.find(s => s.id === this.currentSocietyId);
            if (!soc) return;

            document.getElementById('soc-view-name').innerText = soc.name;
            document.getElementById('soc-view-desc').innerText = `Bem-vindo a ${soc.name}, um ecossistema projetado para o crescimento mútuo e compartilhamento de estratégias pro.`;
            
            const isAdmin = this.currentUser && soc.owner === this.currentUser.username;
            document.getElementById('soc-admin-badge').style.display = isAdmin ? 'block' : 'none';
            document.getElementById('soc-post-input-container').style.display = isAdmin ? 'block' : 'none';

            // Membership logic
            const myGroups = JSON.parse(localStorage.getItem('my_societies') || '[]');
            const isMember = myGroups.includes(this.currentSocietyId) || isAdmin;

            if (isMember) {
                document.getElementById('soc-content-mural').style.display = 'block';
                document.getElementById('soc-content-membros').style.display = 'none';
                document.getElementById('soc-join-section').style.display = 'none';
                this.fetchSocietyMural();
            } else {
                document.getElementById('soc-content-mural').style.display = 'none';
                document.getElementById('soc-content-membros').style.display = 'none';
                document.getElementById('soc-join-section').style.display = 'block';
            }
            if (window.lucide) lucide.createIcons();
        },

        setSocTab(tab) {
            this.currentSocietyTab = tab;
            const isMural = tab === 'mural';
            document.getElementById('soc-content-mural').style.display = isMural ? 'block' : 'none';
            document.getElementById('soc-content-membros').style.display = isMural ? 'none' : 'block';
            
            document.getElementById('tab-soc-mural').classList.toggle('active-tab', isMural);
            document.getElementById('tab-soc-membros').classList.toggle('active-tab', !isMural);
            
            if (tab === 'membros') this.fetchSocietyMembers();
        },

        async postToMural() {
            const input = document.getElementById('soc-mural-input');
            const content = input.value.trim();
            if (!content) return;

            const newPost = {
                id: Date.now(),
                society_id: this.currentSocietyId,
                author: this.currentUser.username,
                content: content,
                created_at: new Date().toISOString()
            };

            const posts = JSON.parse(localStorage.getItem('society_mural_posts') || '[]');
            posts.unshift(newPost);
            localStorage.setItem('society_mural_posts', JSON.stringify(posts));
            
            input.value = '';
            this.fetchSocietyMural();
            this.showNotification('Aviso publicado no mural!', 'success');
        },

        fetchSocietyMural() {
            const feed = document.getElementById('soc-mural-feed');
            if (!feed) return;

            const posts = JSON.parse(localStorage.getItem('society_mural_posts') || '[]')
                        .filter(p => p.society_id === this.currentSocietyId);

            if (posts.length > 0) {
                feed.innerHTML = posts.map(p => `
                    <div style="background: #fff; border: 1px solid #f0f0f0; border-radius: 20px; padding: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.01);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                            <div style="width: 32px; height: 32px; background: #000; color: #fff; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 10px;">${p.author[0].toUpperCase()}</div>
                            <div>
                                <h5 style="font-size: 13px; font-weight: 900; color: #000;">${p.author}</h5>
                                <p style="font-size: 9px; color: #bbb; font-weight: 800; text-transform: uppercase;">GESTOR • ${new Date(p.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <p style="font-size: 14px; font-weight: 500; color: #333; line-height: 1.5;">${p.content}</p>
                    </div>
                `).join('');
            } else {
                feed.innerHTML = `<div style="text-align: center; padding: 60px 20px; color: #ccc;">
                                    <i data-lucide="message-square" style="width: 40px; margin-bottom: 16px; opacity: 0.1;"></i>
                                    <p style="font-size: 12px; font-weight: 800;">O mural está vazio.</p>
                                  </div>`;
            }
            if (window.lucide) lucide.createIcons();
        },

        fetchSocietyMembers() {
            const list = document.getElementById('soc-members-list');
            if (!list) return;

            const societies = JSON.parse(localStorage.getItem('dito_societies') || '[]');
            const soc = societies.find(s => s.id === this.currentSocietyId);
            if (!soc) return;

            const members = [{ username: soc.owner, role: 'Gestor' }, { username: 'Membro Exemplo', role: 'Membro' }];
            const isAdmin = this.currentUser && soc.owner === this.currentUser.username;

            list.innerHTML = members.map(m => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: #fff; border: 1px solid #f5f5f5; border-radius: 20px;">
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <div style="width: 40px; height: 40px; background: #f9f9f9; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 900; color: #000;">${m.username[0].toUpperCase()}</div>
                        <div>
                            <p style="font-size: 13px; font-weight: 900; color: #000;">${m.username}</p>
                            <p style="font-size: 9px; color: ${m.role === 'Gestor' ? '#ff005c' : '#999'}; font-weight: 900; text-transform: uppercase;">${m.role}</p>
                        </div>
                    </div>
                    ${isAdmin && m.username !== this.currentUser.username ? `
                        <button onclick="app.kickMember('${m.username}')" style="width: 36px; height: 36px; background: #fff1f2; color: #e11d48; border: none; border-radius: 10px; cursor: pointer;">
                            <i data-lucide="user-minus" style="width: 16px;"></i>
                        </button>
                    ` : ''}
                </div>
            `).join('');
            if (window.lucide) lucide.createIcons();
        },

        handleJoinSociety() {
            const myGroups = JSON.parse(localStorage.getItem('my_societies') || '[]');
            if (!myGroups.includes(this.currentSocietyId)) {
                myGroups.push(this.currentSocietyId);
                localStorage.setItem('my_societies', JSON.stringify(myGroups));
            }
            this.showNotification('Entrada aprovada!', 'success');
            this.renderSocietyDetail();
        },

        handleLeaveSociety() {
            if (confirm('Sair desta sociedade?')) {
                const myGroups = JSON.parse(localStorage.getItem('my_societies') || '[]');
                const filtered = myGroups.filter(id => id !== this.currentSocietyId);
                localStorage.setItem('my_societies', JSON.stringify(filtered));
                this.navigate('sociedade');
                this.showNotification('Você saiu do grupo.');
            }
        },

        kickMember(name) {
            if (confirm(`Expulsar ${name}?`)) {
                this.showNotification(`${name} removido.`, 'info');
                this.fetchSocietyMembers();
            }
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

        renderSales(days = 30) {
            // Ativa o botão correto na UI (já renderizada pelo navigate)
            ['30','60','90'].forEach(d => {
                const btn = document.getElementById(`btn-sales-${d}`);
                if (btn) {
                    btn.style.background = (parseInt(d) === days) ? '#000' : 'transparent';
                    btn.style.color = (parseInt(d) === days) ? '#fff' : '#999';
                }
            });

            // Geração de dados (Apenas Real)
            const key = this.getUserKey();
            let realSales = JSON.parse(localStorage.getItem(`dito_real_sales_history_${key}`) || '[]');
            
            // Soma das vendas REAIS do ciclo (Dia 01 ao 30)
            const cycleTotal = realSales.reduce((acc, s) => {
                const d = new Date(s.timestamp || Date.now()).getDate();
                if (d >= 1 && d <= 30) return acc + (s.value || 0);
                return acc;
            }, 0);

            const totalLabel = document.getElementById('sales-chart-total');
            if (totalLabel) totalLabel.innerText = `R$ ${(cycleTotal).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

            // Passa array vazio para dummyData para não mostrar a linha de fundo
            this.drawSalesChart([], realSales);
            this.renderSalesHistory(realSales.filter(s => s.isSale).sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 15));

            if (window.lucide) lucide.createIcons();
        },

        simulateSale() {
            const amount = 97.00;
            const now = new Date();
            const newSale = {
                date: now.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'}),
                fullDate: now.toLocaleDateString('pt-BR'),
                timestamp: Date.now(),
                value: amount,
                isSale: true,
                productName: "Venda de Teste"
            };

            const key = this.getUserKey();
            const history = JSON.parse(localStorage.getItem(`dito_real_sales_history_${key}`) || '[]');
            history.unshift(newSale);
            localStorage.setItem(`dito_real_sales_history_${key}`, JSON.stringify(history));

            this.showNotification("Venda simulada com sucesso!", "success");
            this.renderSales(); // Atualiza a tela
        },

        generateDummySales(days) {
            // Retorna apenas zeros para um ambiente 100% real e limpo
            const data = [];
            const now = new Date();
            for (let i = days; i >= 0; i--) {
                const date = new Date();
                date.setDate(now.getDate() - i);
                data.push({
                    date: date.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'}),
                    value: 0,
                    isSale: false
                });
            }
            return data;
        },

        drawSalesChart(dummyData, realData = []) {
            const container = document.getElementById('sales-chart-container');
            if (!container) return;

            const width = container.clientWidth;
            const height = 200;
            const padding = 20;

            const maxValue = Math.max(...[...dummyData, ...realData].map(d => d.value), 200);
            
            let svg = `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="overflow: visible;">`;
            
            let points = "";
            let dots = "";

            // Renderiza Linha de Fundo (Praticamente Invisível/Naked)
            dummyData.forEach((d, i) => {
                const x = (i / (dummyData.length - 1)) * width;
                const y = height - ((d.value / maxValue) * (height - padding * 2) + padding);
                if (i === 0) points += `M ${x} ${y} `;
                else points += `L ${x} ${y} `;
            });

            svg += `<path d="${points}" fill="none" stroke="rgba(0,0,0,0.02)" stroke-width="1" />`;
            
            // Renderiza apenas os ÍCONES DE VENDAS (Os pontinhos amarelos)
            realData.forEach((s, i) => {
                const saleDate = new Date(s.timestamp || Date.now());
                const dayOfMonth = saleDate.getDate();
                
                // Se for dia 31, não renderizamos no gráfico de ciclo 30
                if (dayOfMonth > 30) return;

                // Mapeia o dia (1 a 30) para a largura (0 a width) com pequena margem
                const x = ((dayOfMonth - 1) / 29) * (width - 20) + 10; 
                const y = height - ((s.value / maxValue) * (height - padding * 2) + padding);
                
                svg += `<circle cx="${x}" cy="${y}" r="4.5" fill="#FFD600">
                            <title>R$ ${s.value.toFixed(2)} - Dia ${dayOfMonth}</title>
                         </circle>`;
            });

            svg += dots;
            svg += `</svg>`;

            container.innerHTML = svg;
        },

        renderSalesHistory(data) {
            const list = document.getElementById('sales-history-list');
            if (!list) return;

            const salesWithValues = data.filter(d => d.value > 0);

            if (salesWithValues.length === 0) {
                list.innerHTML = `<p style="text-align: center; color: #ccc; font-size: 12px; padding: 20px;">Nenhuma venda no período.</p>`;
                return;
            }

            list.innerHTML = salesWithValues.map(s => `
                <div style="background: #fff; padding: 16px; border-radius: 20px; border: 1px solid #f9f9f9; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 40px; height: 40px; background: #fffbeb; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fbbf24;">
                            <i data-lucide="trending-up" style="width: 20px;"></i>
                        </div>
                        <div>
                            <p style="font-weight: 900; font-size: 13px; color: #000;">Venda Realizada</p>
                            <p style="font-size: 10px; font-weight: 800; color: #ccc;">${s.date}</p>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <p style="font-weight: 900; font-size: 15px; color: #000;">+ R$ ${s.value.toFixed(2)}</p>
                        <p style="font-size: 8px; font-weight: 900; color: #22c55e; text-transform: uppercase;">Aprovado</p>
                    </div>
                </div>
            `).join('');
            if (window.lucide) lucide.createIcons();
        },

        initEditProfile() {
            if (!this.currentUser) return;
            const userInp = document.getElementById('edit-username');
            const bioInp = document.getElementById('edit-bio');
            const linkInp = document.getElementById('edit-link');
            const emailInp = document.getElementById('edit-email');
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
            if (emailInp) emailInp.value = this.currentUser.email || '';
        },

        saveProfile() {
            const newUsername = document.getElementById('edit-username').value.trim();
            const newBio = document.getElementById('edit-bio').value.trim();
            const newLink = document.getElementById('edit-link').value.trim();
            const newEmail = document.getElementById('edit-email') ? document.getElementById('edit-email').value.trim() : '';

            if (!newUsername) {
                this.showNotification('O nome de usuário não pode ficar vazio.', 'error');
                return;
            }

            if (this.currentUser) {
                this.currentUser.username = newUsername;
                this.currentUser.name = newUsername;
                this.currentUser.bio = newBio;
                this.currentUser.link = newLink;
                
                // Só atualiza o e-mail se o novo não for vazio, 
                // para nunca deletar o e-mail que já está no banco por engano.
                if (newEmail) {
                    this.currentUser.email = newEmail;
                }

                // Salva no localStorage principal de usuários
                const usuarios = JSON.parse(localStorage.getItem('dito_usuarios_vanilla') || '[]');
                const idx = usuarios.findIndex(u => u.id === this.currentUser.id);
                if (idx !== -1) {
                    usuarios[idx] = this.currentUser;
                    localStorage.setItem('dito_usuarios_vanilla', JSON.stringify(usuarios));
                }
                
                // Salva na sessão atual
                localStorage.setItem('current_user_vanilla', JSON.stringify(this.currentUser));
                
                this.syncUserToNetwork(this.currentUser); // Sincroniza com a rede ao salvar perfil!
                
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

            // Busca todos os usuários sincronizados da REDE
            const usuarios = JSON.parse(localStorage.getItem('dito_network_users') || localStorage.getItem('dito_usuarios') || '[]');
            
            if (usuarios.length === 0) {
                list.innerHTML = `<p style="text-align: center; color: #999; font-weight: 800; padding: 40px;">Buscando usuários na rede...</p>`;
                this.fetchNetworkUsers();
                return;
            }

            list.innerHTML = usuarios.map(user => `
                <div style="background: #fff; border: 1px solid #f2f2f2; border-radius: 24px; padding: 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                    <div style="display: flex; gap: 14px; align-items: center;">
                        <div style="width: 46px; height: 46px; border-radius: 50%; overflow: hidden; background: #f5f5f5; border: 1px solid #eee; display: flex; align-items: center; justify-content: center;">
                            ${user.avatar ? `<img src="${user.avatar}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="user" style="width: 18px; color: #ccc;"></i>`}
                        </div>
                        <div>
                            <h4 style="font-weight: 900; font-size: 14px; color: #000;">${user.username}</h4>
                            <p style="font-size: 10px; font-weight: 800; color: #ccc;">${(user.name || '').toLowerCase()} • R$ ${(parseFloat(user.sales || 0)).toFixed(2)}</p>
                        </div>
                    </div>
                    <button onclick="app.deleteUser('${user.username}', '${user.id}')" style="width: 40px; height: 40px; background: #fee2e2; color: #ef4444; border: none; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                        <i data-lucide="trash-2" style="width: 18px;"></i>
                    </button>
                </div>
            `).join('');
            if (window.lucide) lucide.createIcons();
        },

        async deleteUser(username, id) {
            if (username === 'Ditão' || username === 'benedito_pro') {
                this.showNotification('Você não pode excluir um administrador master.', 'error');
                return;
            }

            if (confirm(`Tem certeza que deseja EXCLUIR permanentemente a conta de "${username}"?`)) {
                this.showLoading(true, 'Excluindo conta da rede...');
                
                try {
                    // 1. Remove do Supabase
                    if (supabase) {
                        const { error } = await supabase
                            .from('dito_users')
                            .delete()
                            .eq('username', username);
                        
                        if (error) throw error;
                    }

                    // 2. Remove do localStorage local
                    let localUsers = JSON.parse(localStorage.getItem('dito_usuarios_vanilla') || '[]');
                    localUsers = localUsers.filter(u => u.username !== username);
                    localStorage.setItem('dito_usuarios_vanilla', JSON.stringify(localUsers));

                    this.showNotification(`Conta de ${username} excluída com sucesso.`);
                    await this.fetchNetworkUsers(); // Atualiza a lista da rede
                    this.renderAdminUsers(); // Redesenha o painel
                } catch (e) {
                    console.error("Erro ao deletar usuário:", e);
                    this.showNotification('Erro ao excluir conta da rede.', 'error');
                } finally {
                    this.showLoading(false);
                }
            }
        },

        toggleProfileEdit(isEditing) {
            const displayDiv = document.getElementById('profile-info-display');
            const editDiv = document.getElementById('profile-info-edit');
            const btnEdit = document.getElementById('btn-edit-toggle');
            const btnSave = document.getElementById('btn-save-inline');
            const btnCancel = document.getElementById('btn-cancel-inline');
            const avatarOverlay = document.getElementById('avatar-edit-overlay');

            if (isEditing) {
                displayDiv.style.display = 'none';
                editDiv.style.display = 'block';
                btnEdit.style.display = 'none';
                btnSave.style.display = 'block';
                btnCancel.style.display = 'block';
                if (avatarOverlay) avatarOverlay.style.display = 'flex';
                
                // Botão de Remover Foto: Deixa ele bem visível durante a edição se houver avatar
                const removeBtn = document.getElementById('remove-avatar-btn');
                if (removeBtn && this.currentUser && this.currentUser.avatar) {
                    removeBtn.style.display = 'flex';
                    removeBtn.style.transform = 'scale(1.2)'; // Fica maior na edição
                    removeBtn.style.background = '#000'; // Cor mais séria
                }

                // Preenche os campos com os valores atuais
                if (document.getElementById('edit-profile-name')) document.getElementById('edit-profile-name').value = this.currentUser.name || '';
                if (document.getElementById('edit-profile-bio')) document.getElementById('edit-profile-bio').value = this.currentUser.bio || '';
                if (document.getElementById('edit-profile-link')) document.getElementById('edit-profile-link').value = this.currentUser.link || '';
                if (document.getElementById('edit-profile-email')) document.getElementById('edit-profile-email').value = this.currentUser.email || '';
                
                const showRevInp = document.getElementById('edit-profile-show-revenue');
                if (showRevInp) {
                    showRevInp.checked = this.currentUser.showRevenue !== false; // Padrão true
                }
            } else {
                displayDiv.style.display = 'block';
                editDiv.style.display = 'none';
                btnEdit.style.display = 'block';
                btnSave.style.display = 'none';
                btnCancel.style.display = 'none';
                if (avatarOverlay) avatarOverlay.style.display = 'none';
                
                // Oculta o botão de remover fora da edição
                const removeBtn = document.getElementById('remove-avatar-btn');
                if (removeBtn) {
                    removeBtn.style.display = 'none';
                    removeBtn.style.transform = 'scale(1)';
                    removeBtn.style.background = '#ff005c';
                }
            }
            if (window.lucide) lucide.createIcons();
        },

        async saveProfileInline() {
            const newName = document.getElementById('edit-profile-name').value.trim();
            const newBio = document.getElementById('edit-profile-bio').value.trim();
            const newLink = document.getElementById('edit-profile-link').value.trim();
            const showRev = document.getElementById('edit-profile-show-revenue')?.checked ?? true;

            if (!newName) {
                this.showNotification('O nome não pode estar vazio.', 'error');
                return;
            }

            // Notificação de Salvando (1 segundo)
            const notif = document.createElement('div');
            notif.className = 'center-notification';
            notif.innerText = 'Salvando...';
            document.body.appendChild(notif);

            setTimeout(async () => {
                // Atualiza o objeto do usuário
                const newEmail = document.getElementById('edit-profile-email') ? document.getElementById('edit-profile-email').value.trim() : this.currentUser.email;
                this.currentUser.name = newName;
                this.currentUser.bio = newBio;
                this.currentUser.link = newLink;
                if (newEmail) {
                    this.currentUser.email = newEmail;
                }
                this.currentUser.showRevenue = showRev;

                // Salva Localmente
                localStorage.setItem('current_user_vanilla', JSON.stringify(this.currentUser));
                
                // Garante que o usuário global também tenha os dados atualizados
                const usuarios = JSON.parse(localStorage.getItem('dito_usuarios_vanilla') || '[]');
                const idx = usuarios.findIndex(u => u.username === this.currentUser.username);
                if (idx !== -1) {
                    usuarios[idx] = { ...usuarios[idx], ...this.currentUser };
                    this.safeLocalStorageSet('dito_usuarios_vanilla', JSON.stringify(usuarios));
                    this.safeLocalStorageSet('dito_usuarios', JSON.stringify(usuarios));
                    this.safeLocalStorageSet('dito_network_users', JSON.stringify(usuarios));
                }

                // Sincroniza com o Supabase
                await this.syncUserToNetwork(this.currentUser);

                // Remove notificação de salvando
                notif.remove();

                // Volta para o modo de exibição e atualiza a UI em todos os lugares
                this.toggleProfileEdit(false);
                this.renderProfile();
                this.updateBalanceUI(); // Atualiza Saudação no Dashboard
                
                // Se estiver no Hall da Fama ou Mercado, força re-renderização se necessário
                if (this.currentView === 'hall') this.renderHallOfFame();
                
                this.showNotification('Perfil atualizado em toda a rede!', 'success');
            }, 1000);
        },

        renderProfile() {
            try {
                const usernameEl = document.getElementById('profile-username-header');
                const nameEl = document.getElementById('profile-name');
                const bioEl = document.getElementById('profile-bio');
                const linkTextEl = document.getElementById('profile-link-text');
                const linkEl = document.getElementById('profile-link');
                const adminSection = document.getElementById('admin-only-section');
                
                // Exibe contadores Reais
                const revEl = document.getElementById('count-revenue');
                const fansEl = document.getElementById('count-fans');
                const friendsEl = document.getElementById('count-friends');
                
                const key = this.getUserKey();
                const balance = localStorage.getItem(`user_balance_vanilla_${key}`) || '0.00';
                if (revEl) {
                    if (this.currentUser && this.currentUser.showRevenue === false) {
                        revEl.innerText = "Privado";
                    } else {
                        revEl.innerText = `R$ ${parseFloat(balance).toFixed(2)}`;
                    }
                }
                if (fansEl) fansEl.innerText = this.currentUser?.fans || "0";
                if (friendsEl) friendsEl.innerText = this.currentUser?.friends || "0";

                if (this.currentUser) {
                    if (usernameEl) usernameEl.innerText = this.currentUser.username;
                    if (nameEl) nameEl.innerText = this.currentUser.name || this.currentUser.username;
                    if (bioEl) bioEl.innerText = this.currentUser.bio || "Bio vazia...";
                    if (linkTextEl) linkTextEl.innerText = this.currentUser.link || "dito.app/" + this.currentUser.username;
                    if (linkEl) linkEl.href = this.currentUser.link && this.currentUser.link.startsWith('http') ? this.currentUser.link : 'https://' + this.currentUser.link;
                    
                    // Atualiza o Avatar na UI
                    const avatarCont = document.getElementById('profile-avatar-container');
                    const removeBtn = document.getElementById('remove-avatar-btn');
                    if (avatarCont) {
                        if (this.currentUser.avatar) {
                            avatarCont.innerHTML = `<img src="${this.currentUser.avatar}" style="width: 100%; height: 100%; object-fit: cover;">`;
                            if (removeBtn) removeBtn.style.display = 'flex';
                        } else {
                            avatarCont.innerHTML = `<i data-lucide="user" style="color: #ccc; width: 40px;"></i>`;
                            if (removeBtn) removeBtn.style.display = 'none';
                            if (window.lucide) lucide.createIcons();
                        }
                    }
                }
                
                // Só mostra o botão de gerenciar se for o Benedito, Ditão ou Admin
                if (adminSection && this.currentUser && (this.currentUser.username === 'benedito_pro' || this.currentUser.username === 'Ditão' || this.currentUser.username === 'admin')) {
                    adminSection.style.display = 'block';
                } else if (adminSection) {
                    adminSection.style.display = 'none';
                }

                this.renderProfileFeed();
            } catch (e) { console.warn("Erro ao renderizar perfil:", e); }
        },

        renderProfileFeed() {
            try {
                const grid = document.getElementById('profile-posts-grid');
                if (!grid) return;
                
                let posts = [];
                try {
                    const raw = localStorage.getItem('dito_profile_posts') || '[]';
                    posts = JSON.parse(raw);
                    if (!Array.isArray(posts)) posts = [];
                } catch(e) {
                    posts = [];
                }

                if (posts.length === 0) {
                    grid.innerHTML = `<div style="grid-column: span 3; padding: 60px 0; text-align: center; color: #ccc;">
                        <i data-lucide="camera" style="width: 48px; margin-bottom: 12px; opacity: 0.3;"></i>
                        <p style="font-weight: 800; font-size: 13px;">Nenhum post ainda.</p>
                    </div>`;
                    if (window.lucide) lucide.createIcons();
                    return;
                } else {
                    grid.innerHTML = posts.map((p, index) => `
                        <div style="aspect-ratio: 1; background: #eee; overflow: hidden; position: relative; cursor: pointer;" onmouseover="this.querySelector('.post-overlay').style.opacity='1'" onmouseout="this.querySelector('.post-overlay').style.opacity='0'">
                            <img src="${p.url}" style="width: 100%; height: 100%; object-fit: cover;">
                            <!-- Overlay de Exclusão -->
                            <div class="post-overlay" onclick="app.deletePost(${index}, event)" style="position: absolute; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; opacity: 0; transition: 0.2s; z-index: 10;">
                                <div style="width: 32px; height: 32px; background: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #ff005c; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
                                    <i data-lucide="trash-2" style="width: 14px;"></i>
                                </div>
                            </div>
                        </div>
                    `).join('');
                }
                if (window.lucide) lucide.createIcons();
            } catch (e) { console.warn("Erro no feed:", e); }
        },

        async deletePost(index, event) {
            if (event) event.stopPropagation();
            if (confirm('Deseja excluir este post?')) {
                let posts = [];
                try {
                    const raw = localStorage.getItem('dito_profile_posts') || '[]';
                    posts = JSON.parse(raw);
                    if (!Array.isArray(posts)) posts = [];
                } catch(e) { posts = []; }

                if (posts[index]) {
                    posts.splice(index, 1);
                
                // Salva localmente
                localStorage.setItem('dito_profile_posts', JSON.stringify(posts));
                
                // Sincroniza com o objeto do usuário e nuvem
                if (this.currentUser) {
                    this.currentUser.posts = posts;
                    localStorage.setItem('current_user_vanilla', JSON.stringify(this.currentUser));
                    
                    // Atualiza a lista global de usuários localmente para visibilidade imediata
                    const allUsers = JSON.parse(localStorage.getItem('dito_usuarios_vanilla') || '[]');
                    const uIdx = allUsers.findIndex(u => u.username === this.currentUser.username);
                    if (uIdx !== -1) {
                        allUsers[uIdx] = this.currentUser;
                        localStorage.setItem('dito_usuarios_vanilla', JSON.stringify(allUsers));
                        localStorage.setItem('dito_usuarios', JSON.stringify(allUsers));
                    }

                    await this.syncUserToNetwork(this.currentUser);
                }

                    this.renderProfileFeed();
                    this.showNotification('Post removido!', 'success');
                }
            }
        },

        handleNewPost(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const posts = JSON.parse(localStorage.getItem('dito_profile_posts') || '[]');
                    const newPost = { id: Date.now(), url: event.target.result };
                    posts.unshift(newPost);
                    
                    // Salva localmente
                    localStorage.setItem('dito_profile_posts', JSON.stringify(posts));
                    
                    // Sincroniza com o objeto do usuário e nuvem
                    if (this.currentUser) {
                        this.currentUser.posts = posts;
                        localStorage.setItem('current_user_vanilla', JSON.stringify(this.currentUser));

                        // Atualiza a lista global de usuários localmente para visibilidade imediata
                        const allUsers = JSON.parse(localStorage.getItem('dito_usuarios_vanilla') || '[]');
                        const uIdx = allUsers.findIndex(u => u.username === this.currentUser.username);
                        if (uIdx !== -1) {
                            allUsers[uIdx] = this.currentUser;
                            localStorage.setItem('dito_usuarios_vanilla', JSON.stringify(allUsers));
                        }

                        // Sincronização Obrigatória com Banco de Dados
                        await this.syncUserToNetwork(this.currentUser);
                    }

                    this.renderProfileFeed();
                    if (window.lucide) lucide.createIcons();
                    this.showNotification('Foto publicada e salva na rede! ✨', 'success');
                };
                reader.readAsDataURL(file);
            }
        },

        handleAvatarUpload(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const avatarData = event.target.result;
                    const cont = document.getElementById('profile-avatar-container');
                    if (cont) cont.innerHTML = `<img src="${avatarData}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    
                    if (this.currentUser) {
                        this.currentUser.avatar = avatarData;
                        this.safeLocalStorageSet('current_user_vanilla', JSON.stringify(this.currentUser));
                        
                        // Atualiza no Banco de Dados Local (Persistência pós-logout)
                        let localDB = JSON.parse(localStorage.getItem('dito_users_db') || '[]');
                        let dbIdx = localDB.findIndex(u => u.username === this.currentUser.username);
                        if (dbIdx !== -1) {
                            localDB[dbIdx].avatar = avatarData;
                            this.safeLocalStorageSet('dito_users_db', JSON.stringify(localDB));
                        }

                        // Garante que o usuário global também tenha o avatar atualizado nas outras listas
                        const allLists = ['dito_usuarios_vanilla', 'dito_usuarios', 'dito_network_users'];
                        allLists.forEach(listKey => {
                            let list = JSON.parse(localStorage.getItem(listKey) || '[]');
                            let idx = list.findIndex(u => u.username === this.currentUser.username);
                            if (idx !== -1) {
                                list[idx].avatar = avatarData;
                                this.safeLocalStorageSet(listKey, JSON.stringify(list));
                            }
                        });

                        // Sincroniza com o Supabase (Nuvem)
                        await this.syncUserToNetwork(this.currentUser);
                        
                        // Atualiza UI Imediatamente
                        this.renderProfile();
                        this.updateBalanceUI();
                        if (this.currentView === 'hall') this.renderHallOfFame();
                        
                        this.showNotification('Sua foto foi salva permanentemente! ✨', 'success');
                    }
                };
                reader.readAsDataURL(file);
            }
        },
        
        async removeAvatar(event) {
            if (event) event.stopPropagation();
            if (confirm('Deseja realmente remover sua foto de perfil?')) {
                if (this.currentUser) {
                    this.currentUser.avatar = "";
                    localStorage.setItem('current_user_vanilla', JSON.stringify(this.currentUser));
                    
                    // Atualiza lista global local
                    const allUsers = JSON.parse(localStorage.getItem('dito_usuarios_vanilla') || '[]');
                    const uIdx = allUsers.findIndex(u => u.username === this.currentUser.username);
                    if (uIdx !== -1) {
                        allUsers[uIdx].avatar = "";
                        localStorage.setItem('dito_usuarios_vanilla', JSON.stringify(allUsers));
                        localStorage.setItem('dito_usuarios', JSON.stringify(allUsers));
                        localStorage.setItem('dito_network_users', JSON.stringify(allUsers));
                    }
                    
                    await this.syncUserToNetwork(this.currentUser);
                    this.renderProfile();
                    this.updateBalanceUI();
                    if (this.currentView === 'hall') this.renderHallOfFame();
                    
                    this.showNotification('Foto removida com sucesso!', 'success');
                }
            }
        },

        updateBalanceUI() {
            const el = document.getElementById('label-balance');
            if (el) {
                const key = this.getUserKey();
                const baseBalance = parseFloat(localStorage.getItem(`user_balance_vanilla_${key}`) || '0');
                const realSales = JSON.parse(localStorage.getItem(`dito_real_sales_history_${key}`) || '[]');
                const salesTotal = realSales.reduce((acc, s) => acc + (s.value || 0), 0);
                
                const total = baseBalance + salesTotal;
                el.innerText = this.showBalance ? `R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '••••••••';
            }
            
            // Atualiza o nome da saudação
            const nameEl = document.getElementById('user-greeting-name');
            if (nameEl && this.currentUser) {
                nameEl.innerText = this.currentUser.name || this.currentUser.username;
            }

            // Exibe as bolinhas de notificação se ainda não viu
            // Status de Conexão (Privado para o Ditão)
            const statusEl = document.getElementById('network-status-indicator');
            if (statusEl) {
                if (this.currentUser && this.currentUser.username === 'Ditão') {
                    const globalUsers = JSON.parse(localStorage.getItem('dito_network_users') || '[]');
                    const names = globalUsers.map(u => u.username).join(', ');
                    
                    if (this.adminNetworkInfoVisible) {
                        statusEl.innerHTML = `
                            <div style="text-align: right; background: rgba(0,0,0,0.03); padding: 10px; border-radius: 12px; border: 1px solid #eee;">
                                <span style="color: #22c55e; display: block; margin-bottom: 4px;">● Online (${globalUsers.length} pessoas)</span>
                                <div style="font-size: 7px; color: #ccc; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    Projeto: ${SUPABASE_URL.split('//')[1].split('.')[0]}
                                </div>
                                <div style="font-size: 7px; color: #999; margin-top: 2px;">
                                    [ ${names || 'carregando...'} ]
                                </div>
                                <div style="display: flex; gap: 4px; margin-top: 8px; justify-content: flex-end;">
                                    <button onclick="app.forceSyncAll()" style="font-size: 6px; background: #000; color: #fff; border: none; border-radius: 4px; padding: 4px 6px; cursor: pointer; font-weight: 900;">SINCRONIZAR</button>
                                    <button onclick="app.toggleNetworkStatus()" style="font-size: 6px; background: #eee; color: #000; border: none; border-radius: 4px; padding: 4px 6px; cursor: pointer; font-weight: 900;">OCULTAR</button>
                                </div>
                            </div>
                        `;
                    } else {
                        statusEl.innerHTML = `
                            <button onclick="app.toggleNetworkStatus()" style="background: #f5f5f5; border: 1px solid #eee; padding: 6px 12px; border-radius: 20px; font-size: 8px; font-weight: 900; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                                <span style="color: #22c55e;">●</span> REDE PRO
                            </button>
                        `;
                    }
                } else {
                    statusEl.innerHTML = ''; // Esconde para outros usuários
                }
            }
        },

        toggleNetworkStatus() {
            this.adminNetworkInfoVisible = !this.adminNetworkInfoVisible;
            this.updateBalanceUI();
        },

        async forceSyncAll() {
            this.showLoading(true, "Sincronizando rede...");
            const localUsers = JSON.parse(localStorage.getItem('dito_users_db') || '[]');
            for (let u of localUsers) {
                await this.syncUserToNetwork(u);
            }
            await this.fetchNetworkUsers();
            this.showLoading(false);
            alert("Sincronização finalizada! Verifique o contador.");
        },

        toggleBalance() {
            this.showBalance = !this.showBalance;
            const toggleIcon = document.getElementById('toggle-balance');
            if (toggleIcon) {
                toggleIcon.setAttribute('data-lucide', this.showBalance ? 'eye' : 'eye-off');
                toggleIcon.style.color = '#000';
                if (window.lucide) lucide.createIcons();
            }
            this.updateBalanceUI();
        },

        initCreateProduct() {
            this.hasSeenCreateProd = true;
            const dotDash = document.getElementById('create-product-dot');
            const dotHeader = document.getElementById('header-create-dot');
            if (dotDash) dotDash.style.display = 'none';
            if (dotHeader) dotHeader.style.display = 'none';

            this.selectedProductType = null;
            const form = document.getElementById('create-product-form');
            if (form) form.style.display = 'none';
            const selection = document.getElementById('product-type-selection');
            if (selection) selection.style.display = 'flex';
            
            this.courseStructure = [];
            
            // Reset fields
            const profitLabel = document.getElementById('profit-calc-label');
            if (profitLabel) profitLabel.innerText = "Você receberá: R$ 0,00";
            
            document.querySelectorAll('#product-type-selection button').forEach(btn => {
                btn.style.borderColor = 'transparent';
                btn.style.background = '#f5f5f5';
            });
        },

        selectProductType(type, btn) {
            this.selectedProductType = type;
            
            // Visual logic for selection - Gradient Border highlight
            document.querySelectorAll('.product-type-btn').forEach(b => {
                b.style.background = '#f5f5f5';
                b.style.border = '2px solid transparent';
            });
            
            // Apply Premium Gradient Border (No Shadow)
            btn.style.background = 'linear-gradient(#f5f5f5, #f5f5f5) padding-box, linear-gradient(90deg, #ff005c 0%, #0487ff 100%) border-box';
            btn.style.border = '2px solid transparent';

            // Show form and conditional fields
            const form = document.getElementById('create-product-form');
            if (form) form.style.display = 'flex';

            document.getElementById('ebook-upload').style.display = (type === 'Ebook') ? 'block' : 'none';
            document.getElementById('curso-upload').style.display = (type === 'Curso') ? 'block' : 'none';
            document.getElementById('mentoria-link').style.display = (type === 'Mentoria') ? 'block' : 'none';
            document.getElementById('mentoria-fields').style.display = (type === 'Mentoria') ? 'block' : 'none';
            
            const cursoStructure = document.getElementById('curso-upload');
            if (cursoStructure) {
                cursoStructure.style.display = (type === 'Curso') ? 'flex' : 'none';
                if (type === 'Curso') this.renderCourseStructure();
            }
            
            this.selectedProductType = type;
            this.courseStructure = []; 
            
            // Reset filenames
            document.querySelectorAll('.file-name-display').forEach(el => el.innerText = '');
            
            // Reset product image preview
            this.selectedProductImage = null;
            const preview = document.getElementById('prod-image-preview');
            if (preview) {
                preview.innerHTML = `<i data-lucide="image-plus" style="width: 32px; color: #ccc;"></i><span style="font-size: 9px; font-weight: 900; color: #999; margin-top: 8px;">Upload Imagem</span>`;
                if (window.lucide) lucide.createIcons();
            }
        },

        handleProductImage(input) {
            const file = input.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.selectedProductImage = e.target.result;
                    const preview = document.getElementById('prod-image-preview');
                    if (preview) {
                        preview.innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    }
                };
                reader.readAsDataURL(file);
            }
        },

        handleFileUpload(input, targetId) {
            const file = input.files[0];
            const display = document.getElementById(targetId);
            if (file && display) {
                display.innerText = `Arquivo realizado upload : ${file.name}`;
            }
        },

        calculateNetProfit(price) {
            const label = document.getElementById('profit-calc-label');
            const net = (parseFloat(price) * 0.97 || 0).toFixed(2);
            if (label) {
                label.innerText = `Receba até R$ ${parseFloat(net).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            }
        },

        saveProduct() {
            const name = document.getElementById('prod-name').value.trim();
            const desc = document.getElementById('prod-desc')?.value.trim() || "";
            const price = parseFloat(document.getElementById('prod-price').value) || 0;
            const visible = document.getElementById('prod-visible').checked;
            const salesLink = document.getElementById('prod-sales-link')?.value.trim() || "";

            if (!this.selectedProductType) {
                this.showNotification("Selecione um tipo de produto.", "error");
                return;
            }

            if (!name || price <= 0) {
                this.showNotification("Preencha o nome e o preço corretamente.", "error");
                return;
            }

            // Notificação Central de 3 segundos
            const notif = document.createElement('div');
            notif.className = 'center-notification';
            notif.innerText = 'Enviando...';
            document.body.appendChild(notif);

            setTimeout(() => {
                const newProd = {
                    id: 'p-' + Date.now(),
                    name: name,
                    description: desc,
                    price: price,
                    oldPrice: price * 1.4,
                    type: this.selectedProductType,
                    visible: visible,
                    rating: 5.0,
                    sales: 0,
                    image: this.selectedProductImage || null,
                    author: this.currentUser?.username || "Você",
                    seller: this.currentUser?.username || "Você",
                    sales_link: salesLink,
                    createdAt: Date.now(),
                    content: this.selectedProductType === 'Curso' ? this.courseStructure : null
                };

                // Salva na lista global local
                const marketProducts = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
                marketProducts.unshift(newProd);
                localStorage.setItem('dito_products_vanilla', JSON.stringify(marketProducts));
                localStorage.setItem('dito_products', JSON.stringify(marketProducts)); // Sincroniza variantes

                // Compartilha via Supabase
                this.syncProductToNetwork(newProd);

                notif.remove();
                this.showNotification(`Produto "${name}" criado com sucesso!`, "success");
                this.navigate('dashboard');
            }, 3000);
        },

        updateWithdrawUI() {
            if (!this.currentUser) return;
            const balanceEl = document.getElementById('withdraw-balance');
            const pixInp = document.getElementById('withdraw-pix-key');
            const cardNumInp = document.getElementById('withdraw-card-number');
            const cardNameInp = document.getElementById('withdraw-card-name');

            // Atualiza Saldo na Tela
            const key = this.getUserKey();
            const baseBalance = parseFloat(localStorage.getItem(`user_balance_vanilla_${key}`) || '0');
            const realSales = JSON.parse(localStorage.getItem(`dito_real_sales_history_${key}`) || '[]');
            const salesTotal = realSales.reduce((acc, s) => acc + (s.value || 0), 0);
            const total = baseBalance + salesTotal;

            if (balanceEl) balanceEl.innerText = `R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

            // Preenche dados salvos
            if (pixInp) pixInp.value = this.currentUser.withdrawPixKey || '';
            if (cardNumInp) cardNumInp.value = this.currentUser.withdrawCardNumber || '';
            if (cardNameInp) cardNameInp.value = this.currentUser.withdrawCardName || '';
        },

        async saveWithdrawInfo() {
            const btn = document.getElementById('btn-save-withdraw');
            const pix = document.getElementById('withdraw-pix-key').value.trim();
            const cardNum = document.getElementById('withdraw-card-number').value.trim();
            const cardName = document.getElementById('withdraw-card-name').value.trim();

            if (!pix && !cardNum) {
                this.showNotification('Preencha ao menos uma forma de recebimento.', 'error');
                return;
            }

            if (btn) {
                btn.innerText = 'CADASTRANDO...';
                btn.style.opacity = '0.7';
                btn.disabled = true;
            }

            // Simula um tempo de rede para o feedback visual
            await new Promise(resolve => setTimeout(resolve, 1200));

            this.currentUser.withdrawPixKey = pix;
            this.currentUser.withdrawCardNumber = cardNum;
            this.currentUser.withdrawCardName = cardName;

            this.saveSession(this.currentUser);
            await this.syncUserToNetwork(this.currentUser);
            
            if (btn) {
                btn.innerText = 'DADOS SALVOS';
                btn.style.background = '#22c55e';
                btn.style.opacity = '1';
                
                setTimeout(() => {
                    btn.innerText = 'SALVAR DADOS';
                    btn.style.background = '#000';
                    btn.disabled = false;
                }, 2000);
            }

            this.showNotification('Dados de recebimento salvos com sucesso!', 'success');
        },

        handleWithdraw() {
            const amountInp = document.getElementById('withdraw-amount');
            const amount = parseFloat(amountInp.value) || 0;

            const key = this.getUserKey();
            const currentBalance = parseFloat(localStorage.getItem(`user_balance_vanilla_${key}`) || '0');
            
            if (amount <= 0) {
                this.showNotification('Digite um valor válido para saque.', 'error');
                return;
            }

            if (amount > currentBalance) {
                this.showNotification('Saldo insuficiente.', 'error');
                return;
            }

            if (!this.currentUser.withdrawPixKey && !this.currentUser.withdrawCardNumber) {
                this.showNotification('Cadastre seus dados de recebimento antes de sacar.', 'error');
                return;
            }

            if (confirm(`Confirmar saque de R$ ${amount.toFixed(2)}?`)) {
                // Deduz do saldo
                const newBalance = currentBalance - amount;
                localStorage.setItem(`user_balance_vanilla_${key}`, newBalance.toFixed(2));
                
                // Atualiza na Rede
                this.currentUser.balance = newBalance;
                this.syncUserToNetwork(this.currentUser);

                this.showNotification('Solicitação de saque enviada! 🚀', 'success');
                amountInp.value = '';
                this.updateWithdrawUI();
                this.updateBalanceUI();
            }
        },

        registerUser() {
            const username = document.getElementById('reg-username').value.trim();
            const password = document.getElementById('reg-password').value.trim();
            const email = document.getElementById('reg-email').value.trim();

            if (!username || !password || !email) {
                this.showNotification('Preencha todos os campos, incluindo o e-mail.', 'error');
                return;
            }

            if (!email.includes('@')) {
                this.showNotification('Insira um e-mail válido.', 'error');
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
                email: email,
                name: username,
                bio: "Novo Infoprodutor Dito",
                avatar: "",
                sales: 0
            };

            users.push(newUser);
            localStorage.setItem('dito_users_db', JSON.stringify(users));
            
            // Adiciona na lista de perfis públicos globais
            let perfis = JSON.parse(localStorage.getItem('dito_usuarios_vanilla') || '[]');
            perfis.push(newUser);
            localStorage.setItem('dito_usuarios_vanilla', JSON.stringify(perfis));
            localStorage.setItem('dito_usuarios', JSON.stringify(perfis));

            this.syncUserToNetwork(newUser); // Joga pra rede!

            this.showNotification('Cadastro realizado com sucesso! Agora você já pode fazer login.');
            this.navigate('login');
        },

        // --- Gerenciamento de Estrutura de Curso ---
        addCourseModule() {
            const newModule = {
                id: 'm-' + Date.now(),
                title: 'Novo Módulo',
                lessons: []
            };
            this.courseStructure.push(newModule);
            this.renderCourseStructure();
        },

        removeCourseModule(moduleId) {
            this.courseStructure = this.courseStructure.filter(m => m.id !== moduleId);
            this.renderCourseStructure();
        },

        addCourseLesson(moduleId) {
            const module = this.courseStructure.find(m => m.id === moduleId);
            if (module) {
                module.lessons.push({
                    id: 'l-' + Date.now(),
                    title: 'Nova Aula',
                    fileName: ''
                });
                this.renderCourseStructure();
            }
        },

        removeCourseLesson(moduleId, lessonId) {
            const module = this.courseStructure.find(m => m.id === moduleId);
            if (module) {
                module.lessons = module.lessons.filter(l => l.id !== lessonId);
                this.renderCourseStructure();
            }
        },

        updateModuleTitle(moduleId, title) {
            const module = this.courseStructure.find(m => m.id === moduleId);
            if (module) module.title = title;
        },

        updateLessonTitle(moduleId, lessonId, title) {
            const module = this.courseStructure.find(m => m.id === moduleId);
            if (module) {
                const lesson = module.lessons.find(l => l.id === lessonId);
                if (lesson) lesson.title = title;
            }
        },

        handleLessonUpload(input, moduleId, lessonId) {
            const file = input.files[0];
            if (file) {
                const module = this.courseStructure.find(m => m.id === moduleId);
                if (module) {
                    const lesson = module.lessons.find(l => l.id === lessonId);
                    if (lesson) {
                        lesson.fileName = file.name;
                        this.renderCourseStructure();
                    }
                }
            }
        },

        renderCourseStructure() {
            const list = document.getElementById('course-modules-list');
            const noMsg = document.getElementById('no-modules-msg');
            if (!list) return;

            if (this.courseStructure.length === 0) {
                list.innerHTML = '';
                if (noMsg) noMsg.style.display = 'block';
                return;
            }

            if (noMsg) noMsg.style.display = 'none';

            list.innerHTML = this.courseStructure.map(m => `
                <div style="background: #fff; border: 1px solid #eee; border-radius: 40px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.02); margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding: 0 10px;">
                        <input type="text" value="${m.title}" oninput="app.updateModuleTitle('${m.id}', this.value)" style="border: none; background: transparent; font-weight: 900; font-size: 16px; color: #000; outline: none; width: 60%;">
                        <div style="display: flex; gap: 8px;">
                            <button onclick="app.addCourseLesson('${m.id}')" style="background: #f0fdf4; color: #16a34a; border: none; padding: 8px 16px; border-radius: 50px; font-size: 10px; font-weight: 900; cursor: pointer;">+ Aula</button>
                            <button onclick="app.removeCourseModule('${m.id}')" style="background: #fef2f2; color: #ef4444; border: none; padding: 8px 16px; border-radius: 50px; font-size: 10px; font-weight: 900; cursor: pointer;"><i data-lucide="trash-2" style="width: 14px;"></i></button>
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${m.lessons.map(l => `
                            <div style="background: #fafafa; border: 1px solid #f0f0f0; border-radius: 50px; padding: 10px 20px; display: flex; align-items: center; gap: 12px;">
                                <div style="flex: 1; display: flex; align-items: center; gap: 10px;">
                                    <input type="text" value="${l.title}" oninput="app.updateLessonTitle('${m.id}', '${l.id}', this.value)" style="border: none; background: transparent; font-weight: 800; font-size: 13px; color: #000; outline: none; flex: 1;">
                                    
                                    <div onclick="this.nextElementSibling.click()" style="width: 150px; height: 36px; background: #fff; border: 1px solid #eee; border-radius: 50px; display: flex; align-items: center; padding: 0 12px; cursor: pointer; gap: 8px;">
                                        <i data-lucide="video" style="width: 14px; color: #ccc;"></i>
                                        <span style="font-size: 9px; font-weight: 700; color: ${l.fileName ? '#22c55e' : '#999'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${l.fileName || 'Vídeo'}</span>
                                    </div>
                                    <input type="file" accept="video/*" onchange="app.handleLessonUpload(this, '${m.id}', '${l.id}')" style="display: none;">
                                </div>
                                <button onclick="app.removeCourseLesson('${m.id}', '${l.id}')" style="color: #ef4444; border: none; background: transparent; cursor: pointer; padding: 5px;"><i data-lucide="x" style="width: 16px;"></i></button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');

            if (window.lucide) lucide.createIcons();
        },

        async login(isGuest = false) { 
            this.showLoading(true, 'Autenticando...');
            
            if (isGuest) {
                localStorage.setItem('is_logged_in_vanilla', 'true');
                localStorage.setItem('is_guest_vanilla', 'true');
                this.currentUser = { username: "Convidado", name: "Visitante", bio: "Explorando o Dito", isGuest: true };
                this.navigate('dashboard');
                this.showLoading(false);
                return;
            }

            const userInp = document.getElementById('username').value.trim();
            const passInp = document.getElementById('password').value.trim();

            if (!userInp || !passInp) {
                this.showNotification('Preencha os campos de login.', 'error');
                this.showLoading(false);
                return;
            }

            // 1. Tenta Login Local (Cache)
            let users = JSON.parse(localStorage.getItem('dito_users_db') || '[]');
            let user = users.find(u => u.username === userInp && u.password === passInp);

            // 2. Se não achou local, TENTA LOGIN GLOBAL (Supabase)
            if (!user && supabase) {
                console.log("🔍 [Auth] Buscando usuário na nuvem...");
                try {
                    const { data, error } = await supabase
                        .from('dito_users')
                        .select('*')
                        .eq('username', userInp)
                        .eq('password', passInp)
                        .maybeSingle();
                    
                    if (data && !error) {
                        console.log("✅ [Auth] Usuário encontrado na rede!");
                        user = data;
                        users.push(data);
                        localStorage.setItem('dito_users_db', JSON.stringify(users));
                    }
                } catch (e) { 
                    console.warn("⚠️ [Auth] Falha na rede, prosseguindo com verificação local:", e); 
                    // Não dar alert aqui para não travar o fluxo se o usuário existir localmente
                }
            }

            // 3. Validação Final
            if (user || (userInp === 'admin' && passInp === 'admin')) {
                const loggedUser = user || { id: 1, username: 'admin', name: 'Admin', bio: 'Administrador', sales: 0 };
                localStorage.setItem('is_logged_in_vanilla', 'true');
                localStorage.setItem('is_guest_vanilla', 'false');
                this.saveSession(loggedUser);
                this.currentUser = loggedUser;
                this.loadUserScopedData(); // Carrega dados individuais (sacola/compras)
                
                // Salva ID no cache para manter compras
                localStorage.setItem('dito_user_id', loggedUser.id);
                
                // PRIMEIRO: Puxa os dados mais recentes da rede (Foto, Bio, etc)
                await this.fetchNetworkUsers(); 
                
                // SEGUNDO: Atualiza a sessão com o que veio da rede
                if (this.currentUser) {
                    this.saveSession(this.currentUser);
                }

                this.navigate('dashboard');
                console.log("🚀 Login realizado e dados sincronizados da nuvem!");
            } else {
                this.showNotification('Usuário ou senha incorretos.', 'error');
            }
            this.showLoading(false);
        },

        logout() { 
            this.showLoading(true, 'Saindo...');
            setTimeout(() => {
                localStorage.removeItem('is_logged_in_vanilla');
                localStorage.removeItem('is_guest_vanilla');
                this.navigate('login'); 
                this.showLoading(false);
            }, 1000);
        },

        showLoading(show, text = 'Carregando...') {
            const overlay = document.getElementById('loading-overlay');
            const textEl = document.getElementById('loading-text');
            if (textEl) textEl.innerText = text;
            if (overlay) overlay.style.display = show ? 'flex' : 'none';
        },

        removeFromCart(index) {
            this.cart.splice(index, 1);
            localStorage.setItem(`dito_cart_${this.getUserKey()}`, JSON.stringify(this.cart));
            this.updateCartBadge();
            const container = document.getElementById('market-actual-content') || document.getElementById('market-view-container');
            if (container) this.renderMarketCart(container);
        },

        renderMarketCart(container) {
            const temp = document.getElementById('template-mercado-carrinho');
            if (!temp) return;
            container.innerHTML = temp.innerHTML;

            const list = document.getElementById('cart-items-list');
            const totalLabel = document.getElementById('cart-total-label');
            if (!list) return;

            if (this.cart.length === 0) {
                list.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px; color: #ccc;">
                        <i data-lucide="shopping-bag" style="width: 48px; margin-bottom: 16px; opacity: 0.2;"></i>
                        <p style="font-weight: 800; font-size: 14px;">Sua sacola está vazia.</p>
                    </div>
                `;
            } else {
                list.innerHTML = this.cart.map((p, index) => {
                    const iconName = p.type === 'Ebook' ? 'book-open' : (p.type === 'Curso' ? 'play-circle' : 'package');
                    return `
                    <div style="background: #fff; padding: 16px; border-radius: 24px; border: 1px solid #f2f2f2; display: flex; align-items: center; gap: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                        <div style="width: 70px; height: 70px; background: #f9f9f9; border-radius: 16px; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; flex-shrink: 0;">
                            ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="${iconName}" stroke="url(#dito-gradient)" style="width: 24px;"></i>`}
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <h4 style="font-weight: 900; font-size: 11px; color: #000; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</h4>
                            <p style="font-size: 8px; font-weight: 800; color: #ccc; text-transform: uppercase;">${p.type || 'Dito'}</p>
                            <p style="font-weight: 900; font-size: 15px; color: #000; margin-top: 4px;">R$ ${parseFloat(p.price || 0).toFixed(2)}</p>
                        </div>
                        <button onclick="app.removeFromCart(${index})" style="width: 36px; height: 36px; background: #fff5f5; color: #ff4d4d; border: none; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                            <i data-lucide="trash-2" style="width: 16px;"></i>
                        </button>
                    </div>`;
                }).join('');
            }

            const total = this.cart.reduce((acc, p) => acc + parseFloat(p.price || 0), 0);
            if (totalLabel) totalLabel.innerText = `R$ ${total.toFixed(2)}`;

            if (window.lucide) lucide.createIcons();
        },

        checkAccess(view) {
            const isGuest = localStorage.getItem('is_guest_vanilla') === 'true';
            const restrictedViews = ['sacar', 'criar-produto', 'sociedade', 'editar-perfil'];
            
            if (isGuest && restrictedViews.includes(view)) {
                this.showNotification('Crie uma conta para acessar esta função!', 'error');
                return false;
            }
            return true;
        },

        togglePassword() {
            const passInput = document.getElementById('password');
            const toggleIcon = document.getElementById('toggle-password');
            if (passInput && toggleIcon) {
                if (passInput.type === 'password') {
                    passInput.type = 'text';
                    toggleIcon.setAttribute('data-lucide', 'eye');
                } else {
                    passInput.type = 'password';
                    toggleIcon.setAttribute('data-lucide', 'eye-off');
                }
                if (window.lucide) lucide.createIcons();
            }
        },

        checkNewProducts() {
            // Se for a primeira vez, simula que a última vista foi há 1 hora para mostrar novidades
            if (!localStorage.getItem('dito_market_last_seen')) {
                localStorage.setItem('dito_market_last_seen', (Date.now() - 3600000).toString());
            }

            const lastSeen = parseInt(localStorage.getItem('dito_market_last_seen') || '0');
            const p1 = JSON.parse(localStorage.getItem('dito_products') || '[]');
            const p2 = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
            const all = [...p1, ...p2];
            
            // Força um produto a ser novo para demonstração se não houver nenhum
            if (all.length > 0 && !all.some(p => (p.createdAt || 0) > lastSeen)) {
                all[0].createdAt = Date.now() + 5000;
            }

            const hasNew = all.some(p => (p.createdAt || 0) > lastSeen);
            const dot = document.getElementById('dot-mercado');
            if (dot) dot.style.display = hasNew ? 'block' : 'none';
        },

        renderStore() {
            const container = document.getElementById('market-actual-content');
            if (!container) {
                // Se o container ainda não apareceu, tenta de novo em 50ms
                setTimeout(() => this.renderStore(), 50);
                return;
            }

            if (this.marketView === 'home') this.renderMarketHome(container);
            if (this.marketView === 'product') this.renderMarketProduct(container);
            if (this.marketView === 'cart') this.renderMarketCart(container);
            if (this.marketView === 'checkout') this.renderMarketCheckout(container);
            
            this.updateCartBadge();
            if (window.lucide) lucide.createIcons();
        },

        // Placeholder removido para evitar sobreposição - funcionalidade real movida para renderMarketCheckout consolidado acima

        renderMarketHome(container) {
            const temp = document.getElementById('template-mercado-home');
            if (!temp) return;
            container.innerHTML = temp.innerHTML;
            
            const feed = document.getElementById('main-market-feed');
            const hContainer = document.getElementById('ebooks-horizontal-list');
            const hWrapper = document.getElementById('ebooks-carousel-container');
            if (!feed) return;

            // Marca que o usuário viu o mercado agora
            localStorage.setItem('dito_market_last_seen', Date.now().toString());

            const p1 = JSON.parse(localStorage.getItem('dito_products') || '[]');
            const p2 = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
            const p3 = JSON.parse(localStorage.getItem('dito_market_products') || '[]');
            let all = [...p1, ...p2, ...p3].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
            
            if (all.length === 0) {
                // Mercado começa vazio para os usuários cadastrarem seus produtos
                localStorage.setItem('dito_products', '[]');
            }

            // 1. DESTAQUES: Novos primeiro (Horizontal)
            const arrival = [...all].sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));

            if (hContainer && hWrapper) {
                hWrapper.style.display = arrival.length > 0 ? 'block' : 'none';
                hContainer.innerHTML = arrival.map(p => `
                    <div onclick="app.viewProduct('${p.id}')" style="width: 140px; min-width: 140px; height: 210px; flex-shrink: 0; background: #fff; padding: 10px; border-radius: 12px; border: 1px solid #eee; cursor: pointer; scroll-snap-align: start; display: flex; flex-direction: column;">
                        <div style="width: 100%; height: 120px; background: #f9f9f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; overflow: hidden; flex-shrink: 0;">
                            ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="package" stroke="url(#dito-gradient)" style="width: 24px;"></i>`}
                        </div>
                        <h4 style="font-weight: 900; font-size: 10px; color: #000; line-height: 1.2; height: 2.4em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-bottom: auto;">${p.name}</h4>
                        <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 900; font-size: 13px; color: #ff005c;">R$ ${parseFloat(p.price || 0).toFixed(2)}</span>
                        </div>
                    </div>
                `).join('');
            }

            // 2. TODOS (Grid Vertical com Gap Reduzido)
            feed.style.gap = '10px';
            feed.innerHTML = all.map(p => `
                <div onclick="app.viewProduct('${p.id}')" style="background: #fff; padding: 12px; border-radius: 12px; border: 1px solid #f0f0f0; cursor: pointer;">
                    <div style="aspect-ratio: 1; background: #f9f9f9; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; overflow: hidden;">
                        ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="layers" stroke="url(#dito-gradient)" style="width: 24px;"></i>`}
                    </div>
                    <h4 style="font-weight: 900; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</h4>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                        <span style="font-weight: 900; font-size: 14px;">R$ ${parseFloat(p.price || 0).toFixed(2)}</span>
                        <span style="font-size: 8px; font-weight: 800; color: #ccc;">${p.salesCount || 0} v.</span>
                    </div>
                </div>
            `).join('');

            if (window.lucide) lucide.createIcons();
        },

        addToCartDirectly(id, event) {
            if (event) event.stopPropagation();
            const p2 = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
            const product = p2.find(p => p.id === id);
            if (product) {
                this.cart.push(product);
                localStorage.setItem(`dito_cart_${this.getUserKey()}`, JSON.stringify(this.cart));
                this.updateCartBadge();
                this.showNotification(`"${product.name}" adicionado à sacola!`, "success");
            }
        }
    };

    // ==========================================
    // 🔍 SOCIAL & SEARCH METHODS (Consolidated)
    // ==========================================

    app.toggleSocialSearch = function(open, event) {
        if (event) event.stopPropagation();
        const container = document.getElementById('search-container');
        const input = document.getElementById('social-search-input');
        const close = document.getElementById('search-close');
        const results = document.getElementById('social-search-results');
        if (open) {
            this.fetchNetworkUsers();
            if (container) { container.style.width = '260px'; container.style.background = '#fff'; }
            if (input) { input.style.width = '180px'; input.style.opacity = '1'; input.focus(); }
            if (close) close.style.display = 'block';
        } else {
            const isMarket = this.currentView === 'mercado';
            if (container) { container.style.width = '40px'; container.style.background = isMarket ? '#fff' : 'rgba(0,0,0,0.05)'; }
            if (input) { input.style.width = '0'; input.style.opacity = '0'; input.value = ''; }
            if (close) close.style.display = 'none';
            if (results) results.style.display = 'none';
        }
    };

    app.searchUsers = function(query) {
        const resultsContainer = document.getElementById('social-search-results');
        if (!query || query.length < 2) { if (resultsContainer) resultsContainer.style.display = 'none'; return; }
        const realUsers = JSON.parse(localStorage.getItem('dito_usuarios') || '[]');
        const filtered = realUsers.filter(u => (u.username && u.username.toLowerCase().includes(query.toLowerCase())) || (u.name && u.name.toLowerCase().includes(query.toLowerCase())));
        if (filtered.length > 0) {
            resultsContainer.style.display = 'block';
            resultsContainer.innerHTML = filtered.map(u => `
                <div onclick="app.viewPublicProfile('${u.username}')" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f9f9f9; transition: 0.2s;" onmouseover="this.style.background='#f9f9f9'" onmouseout="this.style.background='white'">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #eee; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                        ${u.avatar ? `<img src="${u.avatar}" style="width:100%; height:100%; object-fit:cover;">` : `<i data-lucide="user" style="width: 20px; color: #ccc;"></i>`}
                    </div>
                    <div><p style="font-weight: 900; font-size: 13px; color: #000;">${u.username}</p><p style="font-size: 11px; color: #999; font-weight: 500;">${u.name}</p></div>
                </div>`).join('');
            if (window.lucide) lucide.createIcons();
        } else {
            resultsContainer.innerHTML = `<div style="padding: 16px; font-size: 12px; color: #999; text-align: center; font-weight: 800;">Nenhum perfil encontrado.</div>`;
            resultsContainer.style.display = 'block';
        }
    };

    app.viewPublicProfile = function(username) {
        this.toggleSocialSearch(false);
        this.navigate('perfil-publico');
        const realUsers = JSON.parse(localStorage.getItem('dito_usuarios') || '[]');
        const user = realUsers.find(u => u.username === username) || { username, name: username, bio: 'Membro da Dito Pro', fans: 0, sales: 0 };
        setTimeout(() => {
            const userDisp = document.getElementById('public-username-header');
            if (userDisp) {
                userDisp.innerText = user.username;
                const nameEl = document.getElementById('public-name');
                const bioEl = document.getElementById('public-bio');
                const fansEl = document.getElementById('public-fans-count');
                const revEl = document.getElementById('public-revenue');
                const avatarEl = document.getElementById('public-avatar-container');
                const btnFan = document.getElementById('btn-fan');
                
                if (nameEl) nameEl.innerText = user.name || user.username;
                if (bioEl) bioEl.innerText = user.bio || 'Membro da Dito Pro';
                if (fansEl) fansEl.innerText = parseInt(user.fans) || 0;
                if (revEl) revEl.innerText = (user.showRevenue === false) ? "Privado" : `R$ ${parseFloat(user.sales || 0).toLocaleString()}`;
                if (avatarEl) avatarEl.innerHTML = user.avatar ? `<img src="${user.avatar}" style="width:100%; height:100%; object-fit:cover;">` : `<i data-lucide="user" style="width: 40px; color: #ccc;"></i>`;
                
                // Atualiza estado do botão Fã
                if (btnFan) {
                    const myFans = JSON.parse(localStorage.getItem('dito_my_follows') || '{}');
                    const isFollower = myFans[username] === true;
                    if (isFollower) {
                        btnFan.innerText = 'Fã'; 
                        btnFan.style.background = '#f5f5f5'; 
                        btnFan.style.color = '#000';
                    } else {
                        btnFan.innerText = 'Tornar-se fã'; 
                        btnFan.style.background = '#000'; 
                        btnFan.style.color = '#fff';
                    }
                }

                const grid = document.getElementById('public-posts-grid');
                if (grid) {
                    const posts = user.posts ? (typeof user.posts === 'string' ? JSON.parse(user.posts) : user.posts) : [];
                    if (posts.length > 0) {
                        grid.innerHTML = posts.map(p => `<div style="aspect-ratio: 1; background: #eee; overflow: hidden;"><img src="${p.url}" style="width: 100%; height: 100%; object-fit: cover;"></div>`).join('');
                    } else {
                        grid.innerHTML = Array(6).fill(0).map(() => `<div style="aspect-ratio: 1; background: #f5f5f5; display: flex; align-items: center; justify-content: center;"><i data-lucide="image" style="width: 24px; color: #ddd;"></i></div>`).join('');
                    }
                }
                if (window.lucide) lucide.createIcons();
            }
        }, 150);
    };

    app.toggleFan = async function() {
        const btn = document.getElementById('btn-fan');
        const fanCountEl = document.getElementById('public-fans-count');
        const username = document.getElementById('public-username-header')?.innerText;
        if (!fanCountEl || !username || !this.currentUser) {
            this.showNotification('Faça login para seguir usuários.', 'error');
            return;
        }

        let current = parseInt(fanCountEl.innerText) || 0;
        
        // Controle de persistência local da relação
        const myFans = JSON.parse(localStorage.getItem('dito_my_follows') || '{}');
        const isCurrentlyFan = myFans[username] === true;

        if (!isCurrentlyFan) {
            // Tornar-se fã
            btn.innerText = 'Fã'; 
            btn.style.background = '#f5f5f5'; 
            btn.style.color = '#000';
            current++;
            myFans[username] = true;
            this.showNotification('Você agora é fã! ✨', 'success');
        } else {
            // Deixar de ser fã
            btn.innerText = 'Tornar-se fã'; 
            btn.style.background = '#000'; 
            btn.style.color = '#fff';
            current = Math.max(0, current - 1);
            delete myFans[username];
        }

        // Salva relação localmente (Quem EU sigo)
        localStorage.setItem('dito_my_follows', JSON.stringify(myFans));
        fanCountEl.innerText = current;

        // ATUALIZAÇÃO LOCAL IMEDIATA (Para persistir ao re-entrar no perfil)
        const allLists = ['dito_usuarios', 'dito_network_users', 'dito_usuarios_vanilla'];
        allLists.forEach(listKey => {
            let list = JSON.parse(localStorage.getItem(listKey) || '[]');
            let idx = list.findIndex(u => u.username === username);
            if (idx !== -1) {
                list[idx].fans = current;
                localStorage.setItem(listKey, JSON.stringify(list));
            }
        });

        // NOTIFICAÇÕES EM TEMPO REAL
        if (supabase) {
            try {
                const { error } = await supabase
                    .from('dito_users')
                    .update({ fans: current })
                    .eq('username', username);
                
                if (!error) {
                    console.log(`👥 [RealTime] Fãs de ${username} atualizados para ${current}`);
                    
                    // ENVIA NOTIFICAÇÃO PARA O ALVO
                    if (current > 0) {
                        this.sendNetworkNotification(username, 'fan', 'Novo Fã! ✨', `${this.currentUser.username} começou a ser seu fã.`);
                    }

                    this.fetchNetworkUsers(); 
                }
            } catch (e) {
                console.error("Erro ao sincronizar fãs:", e);
            }
        }
    };

    app.calculateNetProfit = function(value) {
        const label = document.getElementById('profit-calc-label');
        if (label) label.innerText = `Você receberá: R$ ${(parseFloat(value) * 0.97 || 0).toFixed(2)}`;
    };

    app.updateCartBadge = function() {
        const count = this.cart ? this.cart.length : 0;
        const globalBadge = document.getElementById('cart-badge-global');
        if (globalBadge) { globalBadge.innerText = count; globalBadge.style.display = count > 0 ? 'flex' : 'none'; }
    };

    app.initRewards = function() {
        const user = this.currentUser || { username: 'usuario' };
        const linkStr = `dito.app/ref/${user.username}`;
        const linkD = document.getElementById('profile-ref-link-display');
        const linkF = document.getElementById('referral-link-text');
        if (linkD) linkD.innerText = linkStr;
        if (linkF) linkF.innerText = linkStr;
        const coins = parseInt(localStorage.getItem('dito_coins') || '0');
        const gCoin = document.getElementById('global-coin-balance');
        const pCoin = document.getElementById('coins-page-balance');
        if (gCoin) gCoin.innerText = coins;
        if (pCoin) pCoin.innerText = coins;
        const hasP = localStorage.getItem('dito_purchased_products');
        const badge = document.getElementById('first-purchase-badge');
        if (badge) badge.style.display = (hasP && JSON.parse(hasP).length > 0) ? 'none' : 'flex';
        if (window.lucide) lucide.createIcons();
    };

    app.copyReferralLink = function() {
        const user = this.currentUser || { username: 'usuario' };
        navigator.clipboard.writeText(`dito.app/ref/${user.username}`).then(() => this.showNotification('Link copiado!', 'success'));
    };

    app.addRewardCoins = function(amount, reason) {
        const current = parseInt(localStorage.getItem('dito_coins') || '0');
        localStorage.setItem('dito_coins', (current + amount).toString());
        this.showNotification(`+${amount} Moedas Dito! (${reason})`, 'success');
        this.initRewards();
    };

    app.applyCoinDiscount = function(sliderValue) {
        const label = document.getElementById('coins-to-use-label');
        if (label) label.innerText = sliderValue;
        this.recalculateCheckoutTotal();
    };

    app.recalculateCheckoutTotal = function() {
        const totalBase = this.cart.reduce((acc, i) => acc + parseFloat(i.price || 0), 0);
        const hasP = localStorage.getItem('dito_purchased_products');
        const isFirst = !(hasP && JSON.parse(hasP).length > 0);
        let final = isFirst ? (totalBase * 0.25) : totalBase;
        
        // Limita o desconto das moedas em no máximo 75%
        let coins = parseInt(document.getElementById('coin-discount-slider')?.value || '0');
        if (coins > 75) coins = 75; 
        
        final -= (final * (coins / 100));
        const disp = document.getElementById('checkout-total-value');
        if (disp) disp.innerText = 'R$ ' + final.toFixed(2);
        return final;
    };

    app.renderMyProducts = function() {
        const list = document.getElementById('my-products-list');
        if (!list) return;
        const myP = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]').filter(p => p.author === this.currentUser?.username);
        if (myP.length === 0) {
            list.innerHTML = `<p style="text-align:center; padding:40px; color:#ccc;">Você não criou nenhum produto.</p>`;
            return;
        }
        list.innerHTML = myP.map(p => `
            <div style="background:#fff; border:1px solid #eee; border-radius:24px; padding:16px; display:flex; align-items:center; gap:16px;">
                <div style="width:60px; height:60px; background:#f9f9f9; border-radius:16px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                    ${p.image ? `<img src="${p.image}" style="width:100%; height:100%; object-fit:cover;">` : `<i data-lucide="package" style="width:24px; color:#ccc;"></i>`}
                </div>
                <div style="flex:1;"><h4 style="font-weight:900; font-size:14px;">${p.name}</h4><p style="font-size:10px; color:#999;">${p.type} • R$ ${parseFloat(p.price).toFixed(2)}</p></div>
                <button onclick="app.deleteProduct('${p.id}')" style="width:40px; height:40px; background:#fee2e2; color:#ef4444; border:none; border-radius:12px; cursor:pointer;"><i data-lucide="trash-2" style="width:18px;"></i></button>
            </div>`).join('');
        if (window.lucide) lucide.createIcons();
    };

    app.deleteProduct = function(id) {
        if (confirm('Deseja apagar este produto?')) {
            let market = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
            market = market.filter(p => p.id !== id);
            localStorage.setItem('dito_products_vanilla', JSON.stringify(market));
            this.showNotification('Produto removido.');
            this.renderMyProducts();
        }
    };

    app.filterMarket = function(query) {
        const results = document.getElementById('market-search-results');
        if (!query || query.length < 2) { if (results) results.style.display = 'none'; return; }
        const market = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
        const filtered = market.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
        if (filtered.length > 0) {
            results.style.display = 'block';
            results.innerHTML = filtered.map(p => `
                <div onclick="app.viewProduct('${p.id}')" style="display:flex; align-items:center; gap:12px; padding:12px; cursor:pointer; border-bottom:1px solid #f9f9f9;">
                    <div style="width:40px; height:40px; background:#f5f5f5; border-radius:10px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                        ${p.image ? `<img src="${p.image}" style="width:100%; height:100%; object-fit:cover;">` : `<i data-lucide="package" style="width:18px; color:#ccc;"></i>`}
                    </div>
                    <div><p style="font-weight:900; font-size:13px;">${p.name}</p><p style="font-size:11px; color:#22c55e; font-weight:900;">R$ ${parseFloat(p.price).toFixed(2)}</p></div>
                </div>`).join('');
            if (window.lucide) lucide.createIcons();
        } else {
            results.innerHTML = `<div style="padding:16px; color:#999; text-align:center;">Nenhum produto.</div>`;
            results.style.display = 'block';
        }
    };


    // ==========================================
    // 🔔 SISTEMA DE NOTIFICAÇÕES (NET)
    // ==========================================

    app.toggleNotifDrawer = function(show) {
        const drawer = document.getElementById('notif-drawer');
        const overlay = document.getElementById('notif-overlay');
        if (drawer && overlay) {
            overlay.style.display = show ? 'block' : 'none';
            drawer.style.right = show ? '0' : '-100%';
            if (show) this.markNotificationsAsRead();
        }
    };

    app.sendNetworkNotification = async function(targetUsername, type, title, message) {
        if (!supabase) return;
        try {
            await supabase.from('dito_notifications').insert([{
                target_username: targetUsername,
                type: type,
                title: title,
                message: message,
                sender: this.currentUser?.username || 'Sistema',
                read: false
            }]);
        } catch (e) { console.warn("Erro ao enviar notif:", e); }
    };

    app.fetchNotifications = async function() {
        if (!supabase || !this.currentUser) return;
        try {
            const { data, error } = await supabase
                .from('dito_notifications')
                .select('*')
                .eq('target_username', this.currentUser.username)
                .order('created_at', { ascending: false })
                .limit(20);
            
            if (data && !error) {
                this.notifications = data || [];
                this.renderNotifications();
                this.updateNotifBadge();
            }
        } catch (e) { console.warn("Erro ao buscar notif:", e); }
    };

    app.initRealtimeNotifications = function() {
        if (!supabase || !this.currentUser) return;

        // Escuta novas notificações para MEU usuário
        supabase
            .channel('realtime_notifs')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'dito_notifications',
                filter: `target_username=eq.${this.currentUser.username}` 
            }, (payload) => {
                console.log('🔔 Nova notificação em tempo real:', payload.new);
                if (!this.notifications) this.notifications = [];
                this.notifications.unshift(payload.new);
                this.renderNotifications();
                this.updateNotifBadge(true);
                this.playNotifSound();
            })
            .subscribe();
    };

    app.renderNotifications = function() {
        const container = document.getElementById('notif-list-content');
        if (!container) return;

        const list = this.notifications || [];

        if (list.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #ccc;">
                    <i data-lucide="bell-off" style="width: 32px; margin-bottom: 12px; opacity: 0.3;"></i>
                    <p style="font-size: 11px; font-weight: 800;">Silêncio por aqui...</p>
                </div>
            `;
        } else {
            container.innerHTML = list.map(n => {
                let icon = 'bell';
                let color = '#000';
                if (n.type === 'sale') { icon = 'shopping-bag'; color = '#22c55e'; }
                if (n.type === 'fan') { icon = 'star'; color = '#ff005c'; }
                
                return `
                    <div style="padding: 16px; background: ${n.read ? '#fff' : '#fafafa'}; border-radius: 20px; border: 1px solid ${n.read ? '#eee' : '#f0f0f0'}; display: flex; gap: 14px; position: relative; transition: 0.3s;">
                        ${!n.read ? `<div style="position: absolute; top: 12px; right: 12px; width: 6px; height: 6px; background: #ff005c; border-radius: 50%;"></div>` : ''}
                        <div style="width: 44px; height: 44px; background: ${color}10; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                            <i data-lucide="${icon}" style="width: 20px; color: ${color};"></i>
                        </div>
                        <div>
                            <h4 style="font-size: 13px; font-weight: 900; color: #000; margin-bottom: 2px;">${n.title}</h4>
                            <p style="font-size: 11px; font-weight: 500; color: #666; line-height: 1.4;">${n.message}</p>
                            <span style="font-size: 8px; font-weight: 800; color: #bbb; text-transform: uppercase; margin-top: 6px; display: block;">${new Date(n.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
        if (window.lucide) lucide.createIcons();
    };

    app.updateNotifBadge = function(animate = false) {
        const badge = document.getElementById('notif-badge');
        const list = this.notifications || [];
        const unreadCount = list.filter(n => !n.read).length;
        
        if (badge) {
            badge.style.display = unreadCount > 0 ? 'block' : 'none';
            if (animate && unreadCount > 0) {
                const btn = document.getElementById('header-notif-btn');
                if (btn) {
                    btn.style.transform = 'scale(1.2) rotate(15deg)';
                    setTimeout(() => btn.style.transform = 'scale(1) rotate(0deg)', 300);
                }
            }
        }
    };

    app.markNotificationsAsRead = async function() {
        if (!supabase || !this.currentUser || !this.notifications) return;
        const unreadIds = this.notifications.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length === 0) return;

        try {
            await supabase.from('dito_notifications').update({ read: true }).in('id', unreadIds);
            this.notifications.forEach(n => n.read = true);
            this.updateNotifBadge();
        } catch (e) { console.warn(e); }
    };

    app.clearNotifications = async function() {
        if (!supabase || !this.currentUser) return;
        if (confirm('Deseja limpar todo o histórico de notificações?')) {
            try {
                await supabase.from('dito_notifications').delete().eq('target_username', this.currentUser.username);
                this.notifications = [];
                this.renderNotifications();
                this.updateNotifBadge();
            } catch (e) { console.warn(e); }
        }
    };

    app.playNotifSound = function() {
        if (navigator.vibrate) navigator.vibrate(100);
    };

    app.flushStorage = function() {
        this.showLoading(true, 'Limpando sistema...');
        const essentialKeys = ['dito_users_db', 'is_logged_in_vanilla', 'is_guest_vanilla', 'dito_session_vanilla', 'dito_user_id'];
        let count = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!essentialKeys.includes(key) && !key.includes('balance') && !key.includes('cart')) {
                localStorage.removeItem(key);
                count++;
            }
        }
        setTimeout(() => {
            this.showNotification(`Sistema otimizado! ${count} caches removidos.`, 'success');
            setTimeout(() => location.reload(), 1000);
        }, 1500);
    };

    window.app = app;
    app.init();
})();
