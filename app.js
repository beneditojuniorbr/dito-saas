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
        selectedProductImages: [], // Novo: Suporte a múltiplas fotos
        editingProductId: null,    // Novo: ID do produto em edição
        
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

        // Resolve imagens para renderização (Lida com stripping de memória)
        rGetPImage(img, name = "D") {
            if (!img || img === 'stripped_for_cache' || img === 'null' || img === '' || img === 'default_product.png') {
                const officialDitoImg = "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?q=80&w=2070&auto=format&fit=crop";
                if (name && name.length < 15) {
                    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=000&color=fff&size=128&bold=true`;
                }
                return officialDitoImg;
            }
            return img;
        },

        rGetMentoriaBg(img) {
            if (!img || img === "" || img === "null") {
                return 'linear-gradient(135deg, #ff0045 0%, #0094ff 100%)';
            }
            return `url(${img})`;
        },

        // Helper para salvar no localStorage com segurança (evita QuotaExceeded e otimiza imagens)
        safeLocalStorageSet(key, value) {
            try {
                // OTIMIZAÇÃO: Apenas limpa se for algo ABSURDO (evita quebra do app)
                if (value.length > 2000000) { // 2MB
                    try {
                        let parsed = JSON.parse(value);
                        if (Array.isArray(parsed)) {
                            parsed = parsed.map(item => {
                                // Apenas limpa galeria se for extremamente pesada no cache local
                                if (item.images && item.images.length > 5 && value.length > 4000000) {
                                    return { ...item, images: ["stripped_for_cache"] };
                                }
                                return item;
                            });
                            value = JSON.stringify(parsed);
                        }
                    } catch(e) {}
                }

                localStorage.setItem(key, value);
                return true;
            } catch (e) {
                if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                    console.error("🚨 [Storage] Memória cheia! Limpando agressivamente...");
                    // Faxina Nível 2
                    const trash = [
                        'dito_network_users', 'dito_usuarios', 'dito_market_products', 
                        'dito_profile_posts', 'dito_last_p_hash', 'dito_real_sales_history',
                        'dito_notifications_v2', 'dito_market_notifications', 'dito_temp_cache'
                    ];
                    trash.forEach(k => {
                        try { localStorage.removeItem(k); } catch(i) {}
                    });
                    
                    try {
                        localStorage.setItem(key, value);
                        return true;
                    } catch (retryErr) {
                        console.error("🚨 [Storage] Espaço insuficiente mesmo após limpeza.", retryErr);
                        // Tenta salvar pelo menos o status de login para não deslogar
                        if(key === 'is_logged_in_vanilla') localStorage.setItem(key, value);
                        return false;
                    }
                }
                return false;
            }
        },

        // Salva a sessão do usuário de forma enxuta
        saveSession(user) {
            if (!user) return;
            // Cria uma versão leve para o storage
            const thinUser = { ...user };
            delete thinUser.posts;
            delete thinUser.purchases;
            delete thinUser.password;
            
            // Otimização Crítica: Se o avatar for um monstro Base64 (não otimizado), limpa para economizar espaço
            if (thinUser.avatar && thinUser.avatar.startsWith('data:') && thinUser.avatar.length > 100000) {
                console.warn("🛡️ [Otimização] Foto muito pesada para o cache. Reduzindo...");
                thinUser.avatar = ""; 
            }

            const json = JSON.stringify(thinUser);
            this.safeLocalStorageSet('current_user_vanilla', json);
            localStorage.setItem('current_user', json);
            localStorage.setItem('dito_user_id', user.id || user.username);
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
            const hideSplash = () => {
                const s = document.getElementById('splash-screen');
                if (s) { s.style.opacity = '0'; s.style.pointerEvents = 'none'; setTimeout(() => s.remove(), 400); }
            };

            try {
                // 1. Conecta ao banco imediatamente
                initSupabase(); 

                // 2. Detecta se e um link de checkout (Query ou Path)
                const urlParams = new URLSearchParams(window.location.search);
                const isPathCheckout = window.location.pathname.startsWith('/p/');
                const currentCheckoutId = urlParams.get('checkout') || (isPathCheckout ? window.location.pathname.split('/p/')[1] : null);
                
                // Limpa histórico de chat local ao entrar (Novas Mensagens serão salvas apenas nesta sessão)
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('chat_history_')) localStorage.removeItem(key);
                });
                
                // Inteligencia anti-F5 para local (file://)
                const lastProcessedLink = localStorage.getItem('dito_last_processed_checkout');
                const isNewLink = currentCheckoutId && (currentCheckoutId !== lastProcessedLink);
                
                if (currentCheckoutId && (isNewLink || window.location.protocol !== 'file:')) {
                    console.log("Novo Checkout Identificado:", currentCheckoutId);
                    this.isProcessingDeepLink = true;
                    this.marketView = 'checkout';
                    localStorage.setItem('dito_last_processed_checkout', currentCheckoutId);
                }

                // 3. Gerencia o Splash Screen
                setTimeout(hideSplash, currentCheckoutId ? 300 : 1500); 

                // Captura Link de Convite (Suporta ?ref=CODE e /convite/CODE)
                let refCode = urlParams.get('ref');
                
                // Se não estiver no parâmetro, tenta pegar do caminho da URL (/convite/ABC)
                if (!refCode && window.location.pathname.includes('/convite/')) {
                    const parts = window.location.pathname.split('/');
                    refCode = parts[parts.length - 1];
                }

                if (refCode) {
                    localStorage.setItem('dito_pending_ref', refCode);
                    // Limpeza adiada para não quebrar outros parâmetros
                }

                // Deep Linking: Checkout Direto (?checkout=p-123)
                if (currentCheckoutId && this.isProcessingDeepLink) {
                    const checkoutId = currentCheckoutId;
                    console.log("Processando Checkout:", checkoutId);

                    
                    const tryLoadProduct = async (attempts = 0) => {
                        if (attempts > 8) return; // Aumentado para 8 tentativas (cerca de 2s)

                        // Tenta local primeiro
                        let allProducts = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
                        let targetProd = allProducts.find(p => p.id === checkoutId);
                        
                        // Se não achar local, busca no Supabase
                        if (!targetProd && typeof supabase !== 'undefined') {
                            const { data } = await supabase.from('dito_products').select('*').eq('id', checkoutId).maybeSingle();
                            if (data) targetProd = data;
                        }

                        if (targetProd) {
                            const buyerKey = this.getUserKey();
                            
                            if (localStorage.getItem('is_logged_in_vanilla') !== 'true') {
                                localStorage.setItem('is_logged_in_vanilla', 'true');
                                localStorage.setItem('is_guest_vanilla', 'true');
                                this.currentUser = { username: "Convidado", name: "Visitante", isGuest: true };
                                console.log("Sessao de Convidado iniciada para compra.");
                            }

                            this.cart = [targetProd];
                            localStorage.setItem(`dito_cart_${buyerKey}`, JSON.stringify(this.cart));
                            
                            this.navigate('checkout-direto');
                            if (window.location.protocol !== 'file:') {
                                window.history.replaceState({}, document.title, '/'); 
                            }

                        } else {
                            // Tenta de novo em 200ms (mais rápido)
                            setTimeout(() => tryLoadProduct(attempts + 1), 200);
                        }
                    };

                    tryLoadProduct();
                } else {
                    // Tenta detectar Slug no Pathname (ex: /XASJNSADJ)
                    let path = window.location.pathname.split('/').filter(p => p !== "").pop() || "";
                    let slug = (path && path.length > 3 && !path.includes('.') && path !== 'index.html') ? path : "";

                    if (slug) {
                        console.log("Slug detectado:", slug);
                        
                        const tryLoadSlug = async (attempts = 0) => {
                            if (attempts > 5) return;

                            let allProducts = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
                            let targetProd = allProducts.find(p => p.slug === slug || p.id === slug);
                            
                            if (!targetProd && typeof supabase !== 'undefined') {
                                const { data } = await supabase.from('dito_products').select('*').eq('slug', slug).maybeSingle();
                                if (data) targetProd = data;
                            }

                            if (targetProd) {
                                const buyerKey = this.getUserKey();
                                if (localStorage.getItem('is_logged_in_vanilla') !== 'true') {
                                    localStorage.setItem('is_logged_in_vanilla', 'true');
                                    localStorage.setItem('is_guest_vanilla', 'true');
                                    this.currentUser = { username: "Convidado", name: "Visitante", isGuest: true };
                                }

                                this.cart = [targetProd];
                                localStorage.setItem(`dito_cart_${buyerKey}`, JSON.stringify(this.cart));
                                
                                this.navigate('mercado');
                                if (window.location.protocol !== 'file:') {
                                    window.history.replaceState({}, document.title, '/');
                                }
                                setTimeout(() => this.setMarketView('checkout'), 50);
                            } else {
                                setTimeout(() => tryLoadSlug(attempts + 1), 200);
                            }
                        };

                        tryLoadSlug();
                    }
                }

                // Reset temporário de cupons (Desativado)
                // this.resetCoins();

                // Carrega dados locais
                this.products = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
                // Iniciado via initAutoLogout embaixo


                const savedUser = localStorage.getItem('current_user_vanilla');
                if (savedUser) {
                    this.currentUser = JSON.parse(savedUser);
                    this.loadUserScopedData(); // Carrega sacola e compras do usuário
                }
                
                // Conexão Única Inicial (Não bloqueante)
                this.fetchNetworkUsers();
                this.fetchNetworkProducts(true);

                this.checkLiveAdminStatus();
                
                // Polling de segurança
                setInterval(() => {
                    this.fetchNetworkUsers();
                    this.fetchNetworkProducts();
                }, 30000);

                // Inicia Canais Realtime (Supabase)
                if (supabase) {
                    supabase.channel('radar-p-init')
                        .on('postgres_changes', { event: '*', schema: 'public', table: 'dito_market_products' }, () => {
                            this.fetchNetworkProducts(true);
                        })
                        .subscribe();

                    // 2. Radar de Usuários (Sincronia de Perfis e Online)
                    supabase
                        .channel('public:dito_users')
                        .on('postgres_changes', { 
                            event: '*', // Escuta INSERT e UPDATE (Entradas e mudanças de perfil)
                            schema: 'public', 
                            table: 'dito_users' 
                        }, payload => {
                            console.log('👤 Mudança de perfil detectada na rede!');
                            this.fetchNetworkUsers(); 
                        })
                        .subscribe();
                    
                    // 3. Lobby da Rede (DDTank Style)
                    supabase
                        .channel('public:dito_world_chat')
                        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dito_world_chat' }, payload => {
                            this.receiveWorldMessage(payload.new);
                        })
                        .subscribe();
                }

                // Inicia Notificações Realtime
                this.initRealtimeNotifications();
                this.initAutoLogout();
                this.initSystemBackButton();
                this.fetchNotifications();
                
                // Processa prêmios acumulados (Indicações que rolaram enquanto eu estava offline)
                setTimeout(() => {
                    if (this.notifications) {
                        const pendingRefs = this.notifications.filter(n => n.type === 'referral_225' && !n.read);
                        if (pendingRefs.length > 0) {
                            let processedRefs = JSON.parse(localStorage.getItem('dito_processed_refs') || '[]');
                            let newlyProcessed = 0;
                            
                            pendingRefs.forEach(notif => {
                                if (!processedRefs.includes(notif.id)) {
                                    const key = this.getUserKey();
                                    let currentCoins = parseInt(localStorage.getItem(`dito_coins_${key}`) || '0');
                                    localStorage.setItem(`dito_coins_${key}`, (currentCoins + 225).toString());
                                    processedRefs.push(notif.id);
                                    newlyProcessed++;
                                }
                            });
                            
                            if (newlyProcessed > 0) {
                                localStorage.setItem('dito_processed_refs', JSON.stringify(processedRefs));
                                this.updateCoinsUI();
                                this.showSystemNotification('Lucro Acumulado', `Voce ganhou +${newlyProcessed * 100} cupons por indicacoes enquanto estava fora!`, 'success');
                            }
                        }
                    }
                }, 2000);

                this.checkMissionsNotification();

                // RESTAURAÇÃO DE ESTADO (F5 Seguro com Proteção Anti-Crash)
                const allowedViews = ['dashboard', 'mercado', 'sociedade', 'hall', 'perfil', 'vendas', 'sacar', 'admin-contas', 'admin-produtos', 'produtos', 'meus-cursos', 'missoes', 'centro-notificacoes', 'criar-produto', 'links'];
                let lastView = localStorage.getItem('dito_last_view') || 'dashboard';
                
                // Se a view salva for lixo ou de outro app (ex: 'av'), volta pro dashboard
                if (!allowedViews.includes(lastView)) {
                    console.warn("⚠️ View desconhecida detectada:", lastView, "Redirecionando para Dashboard.");
                    lastView = 'dashboard';
                    localStorage.setItem('dito_last_view', 'dashboard');
                }

                // FORÇA PRIORIDADE MÁXIMA PARA CHECKOUT/DEEP-LINK
                if (!this.isProcessingDeepLink) {
                    const isLoggedIn = localStorage.getItem('is_logged_in_vanilla') === 'true';
                    if (isLoggedIn && this.currentUser) {
                        console.log("Restaurando:", lastView);
                        this.navigate(lastView);
                    } else {
                        console.log("Indo para Login (Sem Link Ativo)");
                        this.navigate('login');
                    }
                } else {
                    // Cria sessao de convidado imediatamente para nao ser bloqueado
                    if (localStorage.getItem('is_logged_in_vanilla') !== 'true') {
                        localStorage.setItem('is_logged_in_vanilla', 'true');
                        localStorage.setItem('is_guest_vanilla', 'true');
                        this.currentUser = { username: "Convidado", name: "Visitante", isGuest: true };
                    }
                    console.log("Modo Checkout Ativo: Aguardando produto carregar...");
                    // Nao navega aqui - o tryLoadProduct vai navegar quando o produto estiver pronto
                }

                
                if (window.lucide) lucide.createIcons();
                
                // Sistema de proteção de dados ativo: Preservando moedas e conquistas.
                if (this.currentUser) {
                    const key = this.getUserKey();
                    const coins = localStorage.getItem(`dito_coins_${key}`) || '0';
                    console.log(`💎 [Wallet] Cupons carregados para ${this.currentUser.username}: ${coins}`);
                }

            } catch (err) {
                console.error("Erro no INIT:", err);
            }
        },

        initSystemBackButton() {
            // Inicializa o primeiro estado
            if (!window.history.state) {
                if (window.location.protocol !== 'file:') {
                    window.history.replaceState({ view: 'dashboard' }, '', '');
                }
            }

            window.onpopstate = (event) => {
                // 1. Prioridade: Fechar Modais e Drawers se estiverem abertos
                const modal = document.getElementById('modal-container');
                if (modal && modal.style.display === 'flex') {
                    this.closeModal();
                    if (window.location.protocol !== 'file:') {
                        window.history.pushState({ view: this.currentView }, '', '');
                    }
                    return;
                }

                const friendsDrawer = document.getElementById('friends-drawer');
                if (friendsDrawer && friendsDrawer.classList.contains('active')) {
                    if (typeof closeFriendsDrawer === 'function') closeFriendsDrawer();
                    if (window.location.protocol !== 'file:') {
                        window.history.pushState({ view: this.currentView }, '', '');
                    }
                    return;
                }

                const worldChat = document.getElementById('world-chat-drawer');
                if (worldChat && (worldChat.style.bottom === '0px' || worldChat.classList.contains('active'))) {
                    this.closeWorldChat();
                    if (window.location.protocol !== 'file:') {
                        window.history.pushState({ view: this.currentView }, '', '');
                    }
                    return;
                }

                const chatDrawer = document.getElementById('chat-drawer');
                if (chatDrawer && chatDrawer.classList.contains('active')) {
                    this.closeChat();
                    if (window.location.protocol !== 'file:') {
                        window.history.pushState({ view: this.currentView }, '', '');
                    }
                    return;
                }

                const notifDrawer = document.getElementById('notif-drawer');
                if (notifDrawer && notifDrawer.style.right === '0px') {
                    this.toggleNotifDrawer(false);
                    if (window.location.protocol !== 'file:') {
                        window.history.pushState({ view: this.currentView }, '', '');
                    }
                    return;
                }

                // 2. Se nada estiver aberto, navega de volta
                if (event.state && event.state.view) {
                    this.navigate(event.state.view, 'popstate');
                }
            };
        },

        initAutoLogout() {
            // 🛡️ SEGURANÇA: Verificação de Sessão Expirada (15s) - Ignorado em Checkouts
            if (this.isProcessingDeepLink) return;

            const lastAlive = localStorage.getItem('dito_session_heartbeat');
            const now = Date.now();
            if (lastAlive && (now - parseInt(lastAlive)) > 300000) { // Aumentado para 5 minutos
                console.log("🔐 [Security] Sessão expirada por inatividade.");
                this.logout();
            }

            // Inicia o Heartbeat (atualiza a cada 2s para garantir que não deslogue no F5)
            setInterval(() => {
                localStorage.setItem('dito_session_heartbeat', Date.now().toString());
            }, 2000);
        },

        // ==========================================
        // 💰 MERCADO PAGO REAL PAYMENTS
        // ==========================================

        async processPaymentMP(method = 'pix', paymentId = null) {
            console.log("Iniciando processPaymentMP...");
            
            // Permite convidados pagarem (eles se cadastram no formulário integrado)
            if (!this.currentUser) {
                this.showNotification('Erro: Conta não identificada.', 'error');
                return;
            }

            const total = this.recalculateCheckoutTotal();
            console.log("💰 [Debug] Valor total calculado:", total);

            if (total <= 0) {
                this.showNotification('Carrinho vazio ou valor zerado.', 'error');
                return;
            }

            if (!this.currentUser.email && !this.currentUser.isGuest) {
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
                            payment_id: paymentId,
                            user_id: this.currentUser.id || this.currentUser.username,
                            username: this.currentUser.username,
                            product: this.cart[0] // Envia o primeiro produto (Mentoria/Curso) para liberação automática
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
                    this.showLoading(false);
                    this.displayPixModal(data.qr_code, total, paymentId); // Passa o ID para o modal
                    this.showNotification('Pix gerado com sucesso! ✨', 'success');
                    
                    // Inicia polling e REALTIME para detecção instantânea
                    this.startPaymentPolling(paymentId);
                    this.initPaymentRealtime(paymentId);
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

        async verifyPaymentDirectly(paymentId) {
            this.showLoading(true, "Estamos buscando seu pagamento...");
            
            try {
                const key = this.getUserKey();
                
                // 1. BUSCA INTELIGENTE: Procura QUALQUER pagamento aprovado deste usuário nos últimos 20 minutos
                const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
                
                // Busca pagamentos onde o status é aprovado, recente, e o username no metadata bate com o atual
                const { data: recentPayments, error: searchError } = await supabase
                    .from('dito_payments')
                    .select('*')
                    .eq('status', 'approved')
                    .gte('created_at', twentyMinsAgo)
                    .filter('metadata->>username', 'ilike', this.currentUser.username)
                    .order('created_at', { ascending: false });

                // Se achar um pagamento aprovado recente, libera na hora!
                if (recentPayments && recentPayments.length > 0) {
                    console.log("💎 [PAGAMENTO] Encontramos um pagamento aprovado recente! Liberando...");
                    this.finalizeSuccessfulPurchase();
                    return;
                }

                // 2. Se não achou no banco, tenta forçar um check na ponte do Mercado Pago para o ID específico
                if (paymentId) {
                    const resp = await fetch(`${SUPABASE_URL}/functions/v1/mercado-pago-bridge`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                        },
                        body: JSON.stringify({ action: 'check-status', payment_id: paymentId })
                    });
                    
                    const check = await resp.json();
                    if (check.status === 'approved' || check.payment_status === 'approved') {
                        this.showNotification("Confirmado pelo Mercado Pago! ✨", "success");
                        const productFromMeta = check.metadata ? check.metadata.product : null;
                        this.finalizeSuccessfulPurchase(productFromMeta);
                    } else {
                        this.showLoading(false);
                        const isAdm = this.currentUser && this.currentUser.username === 'Ditão';
                        const admBtn = isAdm ? `<br><br><button onclick="app.finalizeSuccessfulPurchase()" style="background:#000; color:#fff; border:none; padding:8px 15px; border-radius:10px; font-size:10px; cursor:pointer; font-weight:900;">FORÇAR LIBERAÇÃO AGORA (DITÃO)</button>` : '';
                        this.showNotification(`Pagamento ainda não identificado. Se você já pagou, aguarde 30 segundos e clique novamente.${admBtn}`, "info");
                    }
                } else {
                    this.showLoading(false);
                    this.showNotification("Aguardando confirmação do banco...", "info");
                }
            } catch (e) {
                console.error("🚨 [Verify Error]:", e);
                this.showLoading(false);
                this.showNotification("Erro na consulta. Tente novamente em alguns instantes.", "error");
            }
        },

        async processPaymentCheckout() {
            // 1. Se for convidado, valida e cria a conta DURANTE o checkout
            if (this.currentUser && this.currentUser.isGuest) {
                const name = document.getElementById('reg-checkout-name')?.value.trim();
                const user = document.getElementById('reg-checkout-user')?.value.trim();
                const pass = document.getElementById('reg-checkout-pass')?.value.trim();

                if (!name || !user || !pass) {
                    this.showNotification("Por favor, crie sua conta para receber o acesso ao produto.", "error");
                    document.getElementById('checkout-registration-form')?.scrollIntoView({ behavior: 'smooth' });
                    return;
                }

                this.showLoading(true, "Registrando sua conta real...");
                
                try {
                    // Verifica se usuário já existe
                    const { data: existing } = await supabase.from('dito_users').select('username').eq('username', user).maybeSingle();
                    if (existing) {
                        this.showLoading(false);
                        this.showNotification("Este usuário já existe. Escolha outro!", "error");
                        return;
                    }

                    const { data, error } = await supabase.from('dito_users').insert([{
                        username: user,
                        password: pass,
                        name: name,
                        balance: 0,
                        sales: 0,
                        bio: "Membro Dito",
                        referred_by: localStorage.getItem('dito_pending_ref') || null,
                        created_at: new Date().toISOString()
                    }]).select().single();

                    if (error) throw error;

                    // Sucesso no Cadastro -> Converte Sessão
                    localStorage.setItem('is_logged_in_vanilla', 'true');
                    localStorage.setItem('is_guest_vanilla', 'false');
                    this.currentUser = data;
                    this.saveSession(data);
                    this.showNotification('Conta criada com sucesso! ✨', 'success');
                } catch (e) {
                    console.error("Erro ao criar conta:", e);
                    this.showLoading(false);
                    this.showNotification("Erro ao criar conta comercial.", "error");
                    return;
                }
            }

            // Inicia o fluxo de pagamento real e monitoramento
            const paymentId = 'pay_' + Date.now();
            
            // Trava o paymentId no localStorage para não perder em caso de F5
            localStorage.setItem('dito_active_checkout_id', paymentId);
            
            this.startPaymentPolling(paymentId);
            await this.processPaymentMP('pix', paymentId);
        },

        initPaymentRealtime(paymentId) {
            if (!supabase || !paymentId) return;
            console.log(`🔌 [Realtime] Escutando pagamento: ${paymentId}`);
            
            supabase
                .channel(`pay_${paymentId}`)
                .on('postgres_changes', { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'dito_payments',
                    filter: `id=eq.${paymentId}` 
                }, payload => {
                    console.log('⚡ [Realtime] Mudança de status detectada:', payload.new.status);
                    if (payload.new.status === 'approved') {
                        this.finalizeSuccessfulPurchase();
                        supabase.removeChannel(`pay_${paymentId}`);
                    }
                })
                .subscribe();
        },

        startPaymentPolling(paymentId) {
            if (this.paymentPollingInterval) clearInterval(this.paymentPollingInterval);
            console.log(`🕒 [Dito] Vigilante de Pagamento Ativo: ${paymentId}`);
            
            const initialCount = this.purchasedProducts.length;
            
            this.paymentPollingInterval = setInterval(async () => {
                try {
                    // 1. CHECA O STATUS DO PAGAMENTO NO BANCO (Fallback se o Realtime falhar)
                    if (paymentId) {
                        const { data } = await supabase
                            .from('dito_payments')
                            .select('status')
                            .eq('id', paymentId)
                            .maybeSingle();

                        if (data && data.status === 'approved') {
                            console.log("✅ [Pagamento] Confirmado via Tabela!");
                            clearInterval(this.paymentPollingInterval);
                            this.finalizeSuccessfulPurchase();
                            return;
                        }
                    }

                    // 2. CHECK DE SEGURANÇA NA CONTA DO USUÁRIO
                    if (supabase && this.currentUser && !this.currentUser.isGuest) {
                        await this.fetchPurchasedProducts();
                        if (this.purchasedProducts.length > initialCount) {
                            console.log("✅ [Pagamento] Confirmado via Entrega!");
                            clearInterval(this.paymentPollingInterval);
                            this.finalizeSuccessfulPurchase();
                        }
                    }
                } catch (e) {}
            }, 5000); 

            setTimeout(() => clearInterval(this.paymentPollingInterval), 10 * 60 * 1000);
        },

        finalizeSuccessfulPurchase(productData = null) {
            this.showLoading(false);
            this.launchVictoryConfetti();
            this.showNotification("PAGAMENTO CONFIRMADO! 🚀", "success");
            
            // Se recebemos os dados do produto pelo recibo, usamos eles. Caso contrário, liberamos o carrinho.
            if (productData) {
                // Converte de volta de JSON se necessário
                const p = typeof productData === 'string' ? JSON.parse(productData) : productData;
                this.unlockPurchasedProducts(p.id, p);
            } else {
                this.unlockPurchasedProducts();
            }
            
            this.closeModal(); // Fecha o Pix automaticamente após o sucesso
        },

        async simulateSuccessfulPurchase() {
            if (!this.currentUser || this.currentUser.isGuest) {
                this.showNotification("⚠️ Crie uma conta ou faça login antes de testar o fluxo de dinheiro.", "error");
                return;
            }
            if (this.cart.length === 0) {
                this.showNotification("Seu carrinho está vazio.", "error");
                return;
            }

            this.showLoading(true, "Simulando Pagamento e Distribuição...");

            try {
                const buyerKey = this.getUserKey();
                
                for (const prod of this.cart) {
                    const price = prod.price;
                    const mentorUsername = prod.seller || prod.author;
                    const adminUsername = 'janavan'; // PLATAFORMA (VOCÊ)

                    // 1. DISTRIBUIÇÃO E NOTIFICAÇÃO (97/3)
                    await this.creditSeller(mentorUsername, price, prod.name, prod);

                    // 2. ADICIONA PRODUTO AOS COMPRADOS DO COMPRADOR
                    if (!this.purchasedProducts.find(p => p.id === prod.id)) {
                        this.purchasedProducts.unshift({
                            ...prod,
                            purchased_at: Date.now()
                        });
                    }
                }

                // 3. SALVA PERMANENTEMENTE NO LOCALSTORAGE
                this.safeLocalStorageSet(`dito_purchased_products_${buyerKey}`, JSON.stringify(this.purchasedProducts));

                // 4. LIMPA CARRINHO E SUCESSO
                this.cart = [];
                localStorage.setItem(`dito_cart_${buyerKey}`, '[]');
                this.updateCartBadge();
                this.showLoading(false);
                this.launchVictoryConfetti();
                this.showNotification("TESTE OK: Dinheiro distribuído 97/3 e acesso liberado!", "success");

                // Vai para o painel ver o Dashboard com o produto novo
                this.navigate('dashboard');
                this.updateBalanceUI();
            } catch (e) {
                console.error("Erro na simulação:", e);
                this.showLoading(false);
                this.showNotification("Erro ao processar simulação financeira.", "error");
            }
        },

        //startPaymentPolling unificado acima

        launchVictoryConfetti() {
            if (typeof confetti === 'function') {
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#ff005c', '#0487ff', '#ffd600']
                });
            } else {
                console.log("🎉 [Confetti] Ativo!");
            }
        },

        displayPixModal(qrCode, amount, paymentId) {
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
                    
                    <button onclick="app.verifyPaymentDirectly('${paymentId}')" style="margin-top: 16px; background: #fff; color: #000; border: 2px solid #eee; padding: 12px 24px; border-radius: 50px; font-size: 12px; font-weight: 900; cursor: pointer; width: 100%; transition: 0.3s;" onmouseover="this.style.borderColor='#000'" onmouseout="this.style.borderColor='#eee'">
                        JÁ PAGUEI, LIBERAR ACESSO
                    </button>

                    ${(this.currentUser && this.currentUser.username === 'Ditão') ? `
                        <div style="margin-top: 15px; border-top: 1px dashed #eee; padding-top: 15px;">
                            <p style="font-size: 10px; color: #ff005c; font-weight: 950; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 1px;">⚙️ Painel de Testes (DITÃO)</p>
                            <button onclick="app.finalizeSuccessfulPurchase()" style="background: #ff005c; color: #fff; border: none; padding: 12px 20px; border-radius: 12px; font-size: 11px; font-weight: 950; cursor: pointer; width: 100%; box-shadow: 0 4px 15px rgba(255,0,92,0.2); transition: 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                                <i data-lucide="zap" style="width: 14px;"></i> SIMULAR PAGAMENTO (COMPRA TESTE)
                            </button>
                        </div>
                    ` : ''}
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
                        const isOnline = diffMinutes < 10;
                        const hasUnread = app.unreadMessages && app.unreadMessages[u.username];
                        
                        // Busca timestamp da última interação para ordenar
                        const interactions = JSON.parse(localStorage.getItem('dito_last_interactions') || '{}');
                        const lastInteraction = interactions[u.username] || 0;
                        
                        return { ...u, isOnline, hasUnread, lastInteraction };
                    }).sort((a, b) => {
                        // 1. Prioridade para Mensagens Não Lidas (Bolinha Amarela)
                        if (a.hasUnread && !b.hasUnread) return -1;
                        if (!a.hasUnread && b.hasUnread) return 1;
                        
                        // 2. Prioridade pela ÚLTIMA MENSAGEM (Interação mais recente)
                        if (b.lastInteraction !== a.lastInteraction) {
                            return b.lastInteraction - a.lastInteraction;
                        }
                        
                        // 3. Prioridade para quem está Online (Bolinha Verde)
                        if (a.isOnline && !b.isOnline) return -1;
                        if (!a.isOnline && b.isOnline) return 1;
                        
                        return 0;
                    });

                    container.innerHTML = sortedUsers.map(u => {
                        const isOnline = u.isOnline;
                        const color = isOnline ? '#000' : '#ccc';
                        
                        let genderIcon = '';
                        if (u.gender === 'male') genderIcon = '<i data-lucide="scan-face" style="width: 12px; color: #3b82f6; margin-left: 4px;"></i>';
                        if (u.gender === 'female') genderIcon = '<i data-lucide="flower-2" style="width: 12px; color: #ec4899; margin-left: 4px;"></i>';
                        
                        // Verifica se há mensagens não lidas deste usuário para o usuário atual
                        let hasUnread = false;
                        if (app.currentUser && app.unreadMessages && app.unreadMessages[u.username]) {
                            hasUnread = true;
                        }

                        return `
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 10px; background: transparent; transition: 0.2s;">
                                <div style="display: flex; align-items: center; gap: 14px; flex: 1;" onclick="app.viewPublicProfile('${u.username}')">
                                    <div style="position: relative;">
                                        <div style="width: 50px; height: 50px; border-radius: 50%; background: #f9f9f9; overflow: hidden; border: 1px solid #f0f0f0;">
                                            ${u.avatar ? `<img src="${u.avatar}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #ccc;"><i data-lucide="user" style="width: 20px;"></i></div>`}
                                        </div>
                                        ${isOnline ? `<div style="position: absolute; bottom: 2px; right: 2px; width: 12px; height: 12px; background: #22c55e; border-radius: 50%; border: 2.5px solid #fff;"></div>` : ''}
                                        ${hasUnread ? '<div style="position: absolute; top: -2px; left: -2px; width: 14px; height: 14px; background: #FFD600; border-radius: 50%; border: 2px solid #fff; z-index: 10;"></div>' : ''}
                                    </div>
                                    <div style="overflow: hidden;">
                                        <p style="font-weight: 900; font-size: 15px; color: ${color}; display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
                                            ${u.name || u.username} ${genderIcon}
                                        </p>
                                        <p style="font-size: 10px; font-weight: 800; color: #bbb; text-transform: uppercase; letter-spacing: 0.5px;">
                                            ${isOnline ? 'Ativo agora' : 'Offline'}
                                        </p>
                                    </div>
                                </div>
                                
                                <div style="display: flex; gap: 8px;">
                                    <button onclick="event.stopPropagation(); app.sendGift('${u.username}')" style="background: #f5f5f5; border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                                        <i data-lucide="gift" style="width: 18px; color: #000;"></i>
                                    </button>
                                    <button onclick="event.stopPropagation(); app.openChat('${u.username}'); closeFriendsDrawer();" style="background: #f5f5f5; border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                                        <i data-lucide="message-circle" style="width: 18px; color: #000;"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('');
                    if (window.lucide) lucide.createIcons();
                }
            } catch (e) {
                console.error(e);
            }
        },

        // --- SISTEMA DE PRESENTES ---
        async sendGift(targetUsername) {
            if (!this.currentUser) return;

            if (targetUsername === this.currentUser.username) {
                this.showNotification('Você não pode enviar presente para si mesmo!', 'error');
                return;
            }

            // Exibe interface de escolha de presente
            const body = document.getElementById('modal-body');
            const container = document.getElementById('modal-container');
            
            body.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="width: 70px; height: 70px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                        <i data-lucide="gift" style="width: 32px; color: #000;"></i>
                    </div>
                    <h3 style="font-weight: 900; font-size: 20px; margin-bottom: 8px;">Enviar Presente</h3>
                    <p style="font-size: 13px; color: #666; margin-bottom: 32px; font-weight: 700;">Escolha o valor para presentear <span style="color: #000;">@${targetUsername}</span></p>
                    
                    <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px;">
                        <button onclick="app.processGift('${targetUsername}', 15)" style="width: 100%; height: 60px; border-radius: 20px; border: 1px solid #eee; background: #fff; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.2s;">
                            <i data-lucide="circle-dollar-sign" style="width: 18px; color: #ffd600;"></i> 15 Cupons
                        </button>
                        <button onclick="app.processGift('${targetUsername}', 30)" style="width: 100%; height: 60px; border-radius: 20px; border: 1px solid #eee; background: #fff; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.2s;">
                            <i data-lucide="circle-dollar-sign" style="width: 18px; color: #ffd600;"></i> 30 Cupons
                        </button>
                        <button onclick="app.processGift('${targetUsername}', 75)" style="width: 100%; height: 60px; border-radius: 20px; border: 1px solid #eee; background: #fff; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.2s;">
                            <i data-lucide="circle-dollar-sign" style="width: 18px; color: #ffd600;"></i> 75 Cupons
                        </button>
                    </div>
                    
                    <button onclick="app.closeModal()" style="font-size: 11px; font-weight: 900; color: #999; background: none; border: none; cursor: pointer; text-transform: uppercase; letter-spacing: 1px;">Cancelar</button>
                </div>
            `;
            
            container.style.display = 'flex';
            if (window.lucide) lucide.createIcons();
        },

        async processGift(targetUsername, amount) {
            const key = this.getUserKey();
            const myCoins = parseInt(localStorage.getItem(`dito_coins_${key}`) || '0');
            if (myCoins < amount) {
                this.showNotification('Você não tem cupons suficientes!', 'error');
                return;
            }

            this.showLoading(true, 'Verificando exclusividade...');

            try {
                // Verifica se já enviou presente para esta pessoa (usamos a tabela de notificações como registro)
                const { data: existing, error: checkError } = await supabase
                    .from('dito_notifications')
                    .select('value')
                    .eq('from_username', this.currentUser.username)
                    .eq('target_username', targetUsername)
                    .eq('type', 'presente_enviado');

                let totalSent = 0;
                if (existing) {
                    existing.forEach(p => totalSent += (parseInt(p.value) || 0));
                }

                if (totalSent + amount > 75) {
                    this.showLoading(false);
                    const remaining = 75 - totalSent;
                    this.showNotification(`Limite atingido! Você só pode enviar mais ${remaining} cupons para este amigo.`, 'error');
                    return;
                }

                this.showLoading(true, 'Enviando presente...');

                // 1. Deduz do saldo local e atualiza header
                const key = this.getUserKey();
                const newBalance = myCoins - amount;
                localStorage.setItem(`dito_coins_${key}`, newBalance.toString());
                this.updateCoinsUI();

                // 2. Faz a transação de fato no Supabase (Precisa de um RPC ou Function, mas faremos via Update Simples por agora)
                // Nota: Idealmente cupons devem estar no DB, mas usaremos a lógica atual do app
                
                // 3. Envia a notificação/registro de presente
                await supabase.from('dito_notifications').insert({
                    from_username: this.currentUser.username,
                    target_username: targetUsername,
                    type: 'presente_enviado',
                    title: 'Presente Recebido! 🎁',
                    message: `Você recebeu ${amount} Cupons de @${this.currentUser.username}!`,
                    value: amount // Valor para o receptor somar ao carregar
                });

                this.showLoading(false);
                this.closeModal();
                this.showNotification(`Presente de ${amount} cupons enviado com sucesso!`, 'success');
                if (this.updateBalanceUI) this.updateBalanceUI();

            } catch (e) {
                console.error(e);
                this.showLoading(false);
                this.showNotification('Erro ao enviar presente.', 'error');
            }
        },

        // --- SISTEMA DE CHAT INSTAGRAM-STYLE ---
        activeChatUser: null,
        unreadMessages: JSON.parse(localStorage.getItem('dito_unread_messages') || '{}'),

        openChat(username) {
            if (!this.currentUser) return this.showNotification("Faça login para usar o chat.", "error");
            this.activeChatUser = username;
            
            // Marca como lido localmente
            if(this.unreadMessages && this.unreadMessages[username]) {
                delete this.unreadMessages[username];
                localStorage.setItem('dito_unread_messages', JSON.stringify(this.unreadMessages));
                
                // Atualiza a bolinha no menu se existir
                this.updateFriendsNotifBadge();
            }

            document.getElementById('chat-header-username').innerText = username;
            
            const allUsers = JSON.parse(localStorage.getItem('dito_network_users') || '[]');
            const user = allUsers.find(u => u.username === username);
                const avatarHtml = `<img src="${this.rGetPImage(user ? user.avatar : null, user ? user.username : 'User')}" style="width:100%;height:100%;object-fit:cover;">`;
            document.getElementById('chat-header-avatar').innerHTML = avatarHtml;

            const chatDrawer = document.getElementById('chat-drawer');
            chatDrawer.style.bottom = '0';
            chatDrawer.classList.add('active');
            
            if (window.lucide) lucide.createIcons();
            
            this.fetchChatMessages();
        },

        closeChat() {
            this.activeChatUser = null;
            const chatDrawer = document.getElementById('chat-drawer');
            chatDrawer.style.bottom = '-100%';
            chatDrawer.classList.remove('active');
        },

        async sendChatMessage() {
            const inp = document.getElementById('chat-input');
            const text = inp.value.trim();
            if(!text || !this.activeChatUser || !this.currentUser) return;
            
            inp.value = '';
            
            const msg = {
                sender: this.currentUser.username,
                receiver: this.activeChatUser,
                content: text,
                created_at: new Date().toISOString(),
                is_read: false
            };
            
            this.appendMessageToChat(msg);
            
            // SALVA NO CACHE LOCAL (Persistência imediata)
            this.saveMessageToLocal(msg);
            
            // Marca última interação para ordenação
            this.markLastInteraction(this.activeChatUser);
            
            if(supabase) {
                const { error } = await supabase.from('dito_messages').insert([msg]);
                if(error) {
                    console.error("❌ [Chat] Erro ao enviar:", error.message);
                    if (error.message.includes('relation "dito_messages" does not exist')) {
                        this.showNotification('Erro Fatal: Tabela de mensagens não existe no Supabase. Rode o SQL!', 'error');
                    } else {
                        this.showNotification('Erro ao enviar mensagem: ' + error.message, 'error');
                    }
                } else {
                    console.log("📨 [Chat] Mensagem enviada para rede!");
                }
            }
        },

        appendMessageToChat(msg) {
            const container = document.getElementById('chat-messages-content');
            if (!container) return;
            const isMe = msg.sender === this.currentUser.username;
            const bubbleDiv = document.createElement('div');
            bubbleDiv.style.display = 'flex';
            bubbleDiv.style.justifyContent = isMe ? 'flex-end' : 'flex-start';
            bubbleDiv.innerHTML = `
                <div style="max-width: 75%; padding: 12px 16px; border-radius: 20px; font-weight: 700; font-size: 14px; line-height: 1.4; position: relative; ${isMe ? 'background: #ff005c; color: #fff; border-bottom-right-radius: 4px;' : 'background: #fff; border: 1px solid #eee; color: #000; border-bottom-left-radius: 4px; box-shadow: 0 4px 15px rgba(0,0,0,0.02);'}">
                    ${msg.content}
                    <div style="font-size: 9px; margin-top: 4px; text-align: right; opacity: 0.6; font-weight: 800;">${new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </div>
            `;
            container.appendChild(bubbleDiv);
            container.scrollTop = container.scrollHeight;
        },

        async fetchChatMessages() {
            if(!supabase || !this.currentUser || !this.activeChatUser) return;
            const container = document.getElementById('chat-messages-content');
            
            // 1. CARREGA DO CACHE LOCAL PRIMEIRO (INSTANTÂNEO)
            const cacheKey = `chat_history_${this.currentUser.username}_${this.activeChatUser}`;
            const localHistory = JSON.parse(localStorage.getItem(cacheKey) || '[]');
            
            if (localHistory.length > 0) {
                container.innerHTML = '';
                localHistory.forEach(msg => this.appendMessageToChat(msg));
            } else {
                container.innerHTML = '<p style="text-align:center;color:#ccc;font-size:12px;margin-top:20px;">Carregando mensagens...</p>';
            }

            try {
                // 2. BUSCA NO SUPABASE PARA ATUALIZAR
                const { data, error } = await supabase.from('dito_messages')
                    .select('*')
                    .or(`and(sender.eq.${this.currentUser.username},receiver.eq.${this.activeChatUser}),and(sender.eq.${this.activeChatUser},receiver.eq.${this.currentUser.username})`)
                    .order('created_at', { ascending: true })
                    .limit(100);
                    
                if(!error && data) {
                    container.innerHTML = '';
                    if (data.length === 0) {
                        container.innerHTML = '<p style="text-align:center;color:#ccc;font-size:12px;margin-top:20px;">Nenhuma mensagem ainda. Envie um oi!</p>';
                    }
                    data.forEach(msg => this.appendMessageToChat(msg));
                    
                    // 3. ATUALIZA O CACHE LOCAL COM OS DADOS REAIS DO SERVIDOR
                    localStorage.setItem(cacheKey, JSON.stringify(data));
                    
                    // 4. MARCA COMO LIDO NO SERVIDOR
                    await supabase.from('dito_messages')
                        .update({ is_read: true })
                        .eq('receiver', this.currentUser.username)
                        .eq('sender', this.activeChatUser)
                        .eq('is_read', false);
                }
            } catch(e) {
                console.warn("Erro ao buscar histórico:", e);
            }
        },

        saveMessageToLocal(msg) {
            if (!this.currentUser) return;
            const otherUser = msg.sender === this.currentUser.username ? msg.receiver : msg.sender;
            const cacheKey = `chat_history_${this.currentUser.username}_${otherUser}`;
            const history = JSON.parse(localStorage.getItem(cacheKey) || '[]');
            
            // Evita duplicatas se já veio via Realtime
            if (!history.find(m => m.created_at === msg.created_at && m.content === msg.content)) {
                history.push(msg);
                // Mantém apenas as últimas 100 mensagens no cache local por chat
                if (history.length > 100) history.shift();
                localStorage.setItem(cacheKey, JSON.stringify(history));
            }
        },

        updateFriendsNotifBadge() {
            const dot = document.getElementById('dot-friends');
            if (!dot) return;
            
            // Verifica se há alguma mensagem não lida de QUALQUER pessoa
            const hasUnread = Object.keys(this.unreadMessages || {}).length > 0;
            dot.style.display = hasUnread ? 'block' : 'none';
        },

        markLastInteraction(username) {
            const interactions = JSON.parse(localStorage.getItem('dito_last_interactions') || '{}');
            interactions[username] = Date.now();
            localStorage.setItem('dito_last_interactions', JSON.stringify(interactions));
        },

        // --- SISTEMA DE CHAT MUNDIAL (DDTANK STYLE) ---
        worldChatMessages: [],
        
        openWorldChat(roomId = 'GLOBAL', roomTitle = 'Chat Global') {
            if (!this.currentUser) return this.showNotification("Faça login para usar o Chat.", "error");

            this.activeWorldRoom = roomId;
            const headerTitle = document.querySelector('#world-chat-drawer h3');
            if (headerTitle) {
                // Sempre usa message-circle agora
                headerTitle.innerHTML = `<i data-lucide="message-circle" style="width: 22px; color:#000;"></i> ${roomTitle}`;
            }

            this.fetchWorldChatMessages();

            const drawer = document.getElementById('world-chat-drawer');
            drawer.classList.add('active');
            drawer.style.left = '0';
            
            const dot = document.getElementById('dot-world-chat');
            if (dot) dot.style.display = 'none';

            if (window.lucide) lucide.createIcons();
            
            this.checkLiveAdminStatus();
        },

        async accessLiveDirectly(productId) {
            const p = this.products.find(p => String(p.id) === String(productId));
            if (!p) return;
            
            this.showNotification("Acesso Verificado! Abrindo sala...", "success");
            
            // Força sincronia para garantir o link mais recente da transmissão
            await this.fetchNetworkProducts(true);
            
            // Re-localiza o produto na lista atualizada para pegar o sales_link novo
            const updatedP = this.products.find(item => String(item.id) === String(productId));
            this.selectedProduct = updatedP || p;
            
            this.setMarketView('live-room');
        },

        async startLiveCamera() {
            const playerContainer = document.getElementById('live-player-container');
            const p = this.selectedProduct;
            if (!playerContainer || !p) return;

            try {
                this.showNotification("Iniciando Transmissão Nativa Dito...", "default");
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: 'user', width: 1280, height: 720 }, 
                    audio: true 
                });
                
                this.liveStream = stream;
                
                // UI do Mentor
                playerContainer.innerHTML = `
                    <div style="position: relative; width: 100%; height: 100%; background: #000; border-radius: 0; overflow: hidden;">
                        <video id="live-mentor-video" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover;"></video>
                        <div style="position: absolute; top: 20px; left: 20px; background: #ff005c; color: #fff; font-size: 10px; font-weight: 900; padding: 6px 12px; border-radius: 50px; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(255,0,92,0.3); animation: pulse 2s infinite;">
                            <div style="width: 8px; height: 8px; background: #fff; border-radius: 50%;"></div> TRANSMITINDO AO VIVO (NATIVO DITO)
                        </div>
                        <div style="position: absolute; bottom: 20px; left: 20px; display: flex; gap: 8px;">
                            <div id="live-viewer-count" style="background: rgba(0,0,0,0.6); color: #fff; font-size: 10px; font-weight: 800; padding: 8px 12px; border-radius: 12px; backdrop-filter: blur(10px);">
                                👤 0 Online
                            </div>
                        </div>
                        <button onclick="app.stopLiveCamera()" style="position: absolute; bottom: 20px; right: 20px; background: rgba(255,255,255,0.2); color: #fff; border: none; width: 44px; height: 44px; border-radius: 50%; cursor: pointer; backdrop-filter: blur(10px);">
                             <i data-lucide="square" style="width: 20px;"></i>
                        </button>
                    </div>
                `;

                const video = document.getElementById('live-mentor-video');
                video.srcObject = stream;
                
                if (window.lucide) lucide.createIcons();

                // --- LOGICA DE SINALIZACAO WEBRTC (DITO NATIVE) ---
                this.initMentorSignaling(p.id, stream);
                
                // Notifica a rede que a live nativa começou
                p.sales_link = 'NATIVE_LIVE'; // Flag especial
                this.syncProductToNetwork(p);

                this.showNotification("Você está AO VIVO no Dito!", "success");
            } catch (err) {
                console.error("Erro Câmera:", err);
                this.showNotification("Permissão de câmera negada ou erro técnico.", "error");
            }
        },

        initMentorSignaling(productId, stream) {
            if (!supabase) return;
            const channelName = `live-native-${productId}`;
            this.mentorChannel = supabase.channel(channelName, { config: { broadcast: { ack: true } } });
            this.peerConnections = this.peerConnections || {}; 

            // Heartbeat para avisar que o mentor esta online
            this.heartbeatInterval = setInterval(() => {
                this.mentorChannel.send({
                    type: 'broadcast',
                    event: 'mentor-presence',
                    payload: { mentorId: this.currentUser.username, status: 'active' }
                });
            }, 5000);

            this.mentorChannel
                .on('broadcast', { event: 'request-stream' }, async ({ payload }) => {
                    const studentId = payload.studentId;
                    
                    // Protecao contra conexoes duplicadas ou em andamento
                    if (this.peerConnections[studentId]) {
                        const pc = this.peerConnections[studentId];
                        if (pc.connectionState === 'connected') return;
                        // Se estiver tentando ha muito tempo, limpa e tenta de novo
                        pc.close();
                    }

                    console.log(`[Mentor] Criando ponte para: ${studentId}`);
                    const pc = new RTCPeerConnection({
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:stun1.l.google.com:19302' },
                            { urls: 'stun:stun2.l.google.com:19302' }
                        ]
                    });
                    
                    this.peerConnections[studentId] = pc;
                    stream.getTracks().forEach(track => pc.addTrack(track, stream));

                    pc.onicecandidate = (event) => {
                        if (event.candidate) {
                            this.mentorChannel.send({
                                type: 'broadcast',
                                event: 'ice-candidate',
                                payload: { target: studentId, candidate: event.candidate }
                            });
                        }
                    };

                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);

                    this.mentorChannel.send({
                        type: 'broadcast',
                        event: 'offer',
                        payload: { target: studentId, mentorId: this.currentUser.username, offer }
                    });
                    
                    this.updateViewerCount();
                })
                .on('broadcast', { event: 'answer' }, async ({ payload }) => {
                    if (payload.target === this.currentUser.username) {
                        const pc = this.peerConnections[payload.studentId];
                        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
                    }
                })
                .on('broadcast', { event: 'ice-candidate-from-student' }, async ({ payload }) => {
                    if (payload.target === this.currentUser.username) {
                        const pc = this.peerConnections[payload.studentId];
                        if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
                    }
                })
                .subscribe();
        },

        updateViewerCount() {
            const el = document.getElementById('live-viewer-count');
            const count = Object.keys(this.peerConnections || {}).length;
            if (el) el.innerText = `👤 ${count} Online`;
        },

        stopLiveCamera() {
            if (this.liveStream) {
                this.liveStream.getTracks().forEach(track => track.stop());
                this.liveStream = null;
            }
            const p = this.selectedProduct;
            if (p) this.renderMarketLiveRoom(document.getElementById('market-container'));
            this.showNotification("Transmissão encerrada.", "default");
        },

        async startParticipantCamera() {
            try {
                this.showNotification("Ativando sua câmera para a mentoria...", "default");
                const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
                
                let overlay = document.getElementById('student-camera-overlay');
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.id = 'student-camera-overlay';
                    overlay.style.cssText = `
                        position: fixed; bottom: 100px; right: 20px; width: 120px; height: 160px; 
                        background: #000; border-radius: 20px; overflow: hidden; 
                        box-shadow: 0 10px 30px rgba(0,0,0,0.3); z-index: 1000; border: 2px solid #ff005c;
                        display: flex; flex-direction: column;
                    `;
                    document.body.appendChild(overlay);
                }

                overlay.style.display = 'flex';
                overlay.innerHTML = `
                    <video id="student-video-el" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover;"></video>
                    <button onclick="app.stopParticipantCamera()" style="position: absolute; top: 5px; right: 5px; width: 24px; height: 24px; border-radius: 50%; background: rgba(0,0,0,0.5); border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                        <i data-lucide="x" style="width: 14px;"></i>
                    </button>
                    <span style="position: absolute; bottom: 5px; left: 5px; font-size: 8px; color: #fff; font-weight: 900; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">Você</span>
                `;

                const video = document.getElementById('student-video-el');
                video.srcObject = stream;
                this.participantStream = stream;

                if (window.lucide) lucide.createIcons();
                this.showNotification("Sua câmera está ativa! Agora o mentor pode te ver.", "success");
            } catch (err) {
                console.error("Erro ao ativar câmera do aluno:", err);
                this.showNotification("Não foi possível acessar sua câmera.", "error");
            }
        },

        stopParticipantCamera() {
            if (this.participantStream) {
                this.participantStream.getTracks().forEach(track => track.stop());
                this.participantStream = null;
            }
            const overlay = document.getElementById('student-camera-overlay');
            if (overlay) overlay.style.display = 'none';
            this.showNotification("Sua câmera foi desligada.", "default");
        },

        checkLiveAdminStatus() {
            const btn = document.getElementById('btn-live-admin');
            if (!btn) return;
            
            if (!this.currentUser) {
                btn.style.display = 'none';
                return;
            }

            const isAuthPage = this.currentView === 'login' || this.currentView === 'cadastro';
            if (isAuthPage) {
                btn.style.display = 'none';
                return;
            }
            
            const activeLive = this.products && this.products.find(p => 
                p.type === 'Mentoria' && 
                p.seller === this.currentUser.username && 
                (p.visible === true || p.visible === 'true' || p.visible === undefined)
            );

            btn.style.display = activeLive ? 'flex' : 'none';

            if (!isAuthPage && activeLive) {
                this.adminLiveProduct = activeLive;
                btn.style.display = 'flex';
            } else {
                btn.style.display = 'none';
            }
        },

        openMissions() {
            this.navigate('missoes');
        },

        renderMissions() {
            const container = document.getElementById('weekly-checklist-container');
            const balanceEl = document.getElementById('missions-coin-balance');
            if(!container) return;

            const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            const today = new Date().getDay();
            const key = this.getUserKey();
            const storageKey = `dito_missions_${key}`;
            
            // Calcula o reset semanal inteligente
            let checklist = JSON.parse(localStorage.getItem(storageKey) || '[]');
            if (checklist.length === 0 || checklist[0].week !== this.getWeekNumber()) {
                checklist = days.map((d, i) => ({ dayName: d, index: i, checked: false, week: this.getWeekNumber() }));
                localStorage.setItem(storageKey, JSON.stringify(checklist));
            }

            // Atualiza saldo de cupons na barra superior
            const currentCoins = parseInt(localStorage.getItem(`dito_coins_${key}`) || '0');
            if (balanceEl) balanceEl.innerText = currentCoins.toLocaleString();

            this.renderDailyChallenges();
            this.renderLongTermMissions();
            this.renderUserCoupons();
            this.renderEventMissions();

            container.innerHTML = checklist.map((item, i) => {
                const isToday = i === today;
                const past = i < today;
                const statusColor = item.checked ? '#10b981' : (past ? '#ef4444' : (isToday ? '#f59e0b' : '#e4e4e7'));
                const statusIcon = item.checked ? 'check-circle-2' : (past ? 'x-circle' : 'circle');
                
                // Nova Regra: Precisa de 1 venda hoje para liberar
                const salesHistory = JSON.parse(localStorage.getItem(`dito_real_sales_history_${key}`) || '[]');
                const hasSaleToday = salesHistory.some(s => new Date(s.date).toDateString() === new Date().toDateString());
                
                const canCheck = isToday && !item.checked && hasSaleToday;
                const showsLocked = isToday && !item.checked && !hasSaleToday;

                return `
                <div style="scroll-snap-align: start; min-width: 70px; display: flex; flex-direction: column; align-items: center; text-align: center; justify-content: space-between; padding: 12px 6px; border-radius: 12px; border: ${isToday ? '1.5px solid transparent' : '1px solid #f0f0f0'}; background: ${isToday ? 'linear-gradient(#fff, #fff) padding-box, linear-gradient(135deg, #ff005c 0%, #0487ff 100%) border-box' : '#fff'}; transition: 0.3s; box-shadow: ${isToday ? '0 4px 15px rgba(255, 0, 92, 0.1)' : '0 4px 10px rgba(0,0,0,0.02)'};">
                    <p style="font-weight: 950; font-size: 11px; margin-bottom: 4px; color: ${past && !item.checked ? '#ccc' : '#000'};">${item.dayName}</p>
                    
                    <div style="width: 24px; height: 24px; border-radius: 50%; background: ${item.checked ? '#fff' : (past && !item.checked ? 'transparent' : (isToday ? '#fbbf24' : '#f9f9f9'))}; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; border: ${past && !item.checked ? '1px dashed #eee' : 'none'};">
                        <i data-lucide="${statusIcon}" style="width: 14px; color: ${item.checked ? '#22c55e' : (isToday && !item.checked ? '#fff' : statusColor)};"></i>
                    </div>

                    ${item.checked ? `
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                            <span style="font-size: 8px; font-weight: 950; color: #10b981; text-transform: uppercase;">Concluído</span>
                            <span style="font-size: 9px; font-weight: 950; color: #000;">+75</span>
                        </div>
                    ` : (past ? `
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 2px; opacity: 0.6;">
                            <span style="font-size: 8px; font-weight: 950; color: #ef4444; text-transform: uppercase;">Perdeu</span>
                            <span style="font-size: 9px; font-weight: 950; color: #999;">-75</span>
                        </div>
                    ` : (isToday ? `
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                            <div style="display: flex; align-items: center; gap: 2px; color: #000; font-size: 10px; font-weight: 950; margin-bottom: 4px;">
                                <i data-lucide="ticket" style="width: 10px; color: #ff005c;"></i> +75
                            </div>
                            <button onclick="app.claimDailyCheckin(${i})" style="background: #fbbf24; color: #000; border: none; border-radius: 20px; padding: 6px 14px; font-size: 10px; font-weight: 950; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                                 Receber
                            </button>
                        </div>
                    ` : `
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 2px; opacity: 0.8;">
                             <span style="font-size: 8px; font-weight: 950; color: #999; text-transform: uppercase;">Aguarde</span>
                             <span style="font-size: 9px; font-weight: 950; color: #000;">+75</span>
                        </div>
                    `))}
                </div>
                `;
            }).join('');

            if (window.lucide) lucide.createIcons();
        },

        renderUserCoupons() {
            const container = document.getElementById('my-coupons-container');
            if (!container) return;

            const coupons = this.currentUser?.referralCoupons || [];
            if (coupons.length === 0) {
                container.innerHTML = `<p style="font-size: 12px; color: #999; text-align: center; padding: 20px;">Você ainda não recebeu cupons de indicação.</p>`;
                return;
            }

            container.innerHTML = coupons.map(c => `
                <div style="background: #fff; border-radius: 16px; padding: 16px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #efefef; box-shadow: 0 4px 10px rgba(0,0,0,0.02); margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <i data-lucide="ticket" style="width: 18px; color: #ff005c;"></i>
                        <div>
                            <h4 style="font-size: 13px; font-weight: 950; color: #000;">Cupom de Indicação</h4>
                            <p style="font-size: 10px; font-weight: 700; color: #999;">Recebido em ${new Date(c.date).toLocaleDateString('pt-BR')}</p>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span style="display: block; font-size: 14px; font-weight: 950; color: #22c55e;">+${c.value}</span>
                        <span style="font-size: 8px; font-weight: 900; color: #bbb; text-transform: uppercase;">Disponível</span>
                    </div>
                </div>
            `).reverse().join('');
            
            if (window.lucide) lucide.createIcons();
        },

        handleReferralReward() {
            if (!this.currentUser) return;
            const key = this.getUserKey();
            const reward = 225;
            const newCoupon = {
                id: 'cp-' + Date.now(),
                value: reward,
                date: Date.now(),
                type: 'Indicação'
            };

            // 1. Atualiza Cupons
            if (!this.currentUser.referralCoupons) this.currentUser.referralCoupons = [];
            this.currentUser.referralCoupons.push(newCoupon);

            // 2. Atualiza Saldo Global de Cupons (Coins)
            const currentCoins = parseInt(localStorage.getItem(`dito_coins_${key}`) || '0');
            const total = currentCoins + reward;
            localStorage.setItem(`dito_coins_${key}`, total.toString());
            
            // 3. Persiste no DB Local
            let db = JSON.parse(localStorage.getItem('dito_users_db') || '[]');
            let idx = db.findIndex(u => u.username === this.currentUser.username);
            if (idx !== -1) {
                db[idx].referralCoupons = this.currentUser.referralCoupons;
                db[idx].coins = total;
                localStorage.setItem('dito_users_db', JSON.stringify(db));
            }
            
            localStorage.setItem('dito_current_user', JSON.stringify(this.currentUser));
            if (app.view === 'missoes') this.renderMissions();
        },



        renderDailyChallenges() {
            const container = document.getElementById('daily-challenges-container');
            if (!container) return;

            const key = this.getUserKey();
            const today = new Date().toDateString();
            
            // Definição do desafio: Fazer uma venda = 100 cupons
            const salesHistory = JSON.parse(localStorage.getItem(`dito_real_sales_history_${key}`) || '[]');
            const hasSaleToday = salesHistory.some(s => new Date(s.date).toDateString() === today);
            
            const claimedKey = `dito_claimed_daily_${key}_${today}`;
            const isClaimed = localStorage.getItem(claimedKey) === 'true';

            container.innerHTML = `
                <div style="scroll-snap-align: start; min-width: 180px; background: linear-gradient(135deg, #fff 0%, #fff 100%); padding: 22px; border-radius: 24px; border: 1px solid #eee; display: flex; flex-direction: column; gap: 14px; position: relative; overflow: hidden;">
                    <div style="position: absolute; top: -10px; right: -10px; width: 60px; height: 60px; background: rgba(0, 0, 0, 0.03); border-radius: 50%;"></div>
                    <div style="width: 50px; height: 50px; background: #fff; border: 1px solid #f0f0f0; border-radius: 16px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.03);">
                        <i data-lucide="handshake" style="width: 24px; color: #000;"></i>
                    </div>
                    <div>
                        <p style="font-weight: 950; font-size: 14px; color: #000; margin-bottom: 4px;">Fazer uma venda</p>
                        <p style="font-size: 10px; font-weight: 800; color: #999; line-height: 1.3;">Realize 1 venda hoje para liberar seu bônus extra.</p>
                    </div>
                    <div style="margin-top: 10px;">
                        ${isClaimed ? 
                            `<div style="background: #f0fdf4; color: #16a34a; padding: 12px; border-radius: 14px; font-size: 11px; font-weight: 950; text-align: center;">CONCLUÍDO</div>` :
                            (hasSaleToday ? 
                                `<button onclick="app.claimDailyChallenge('sale_100', 100)" style="width: 100%; background: #000; color: #fff; border: none; padding: 12px; border-radius: 14px; font-size: 11px; font-weight: 950; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">RESGATAR +100</button>` :
                                `<button onclick="app.showNotification('Faça uma venda para liberar!', 'info')" style="width: 100%; background: #f5f5f5; color: #ccc; border: none; padding: 12px; border-radius: 14px; font-size: 11px; font-weight: 950; cursor: not-allowed;">BLOQUEADO</button>`
                            )
                        }
                    </div>
                </div>
            `;

            if (window.lucide) lucide.createIcons();
        },

        renderEventMissions() {
            const section = document.getElementById('event-missions-section');
            const container = document.getElementById('event-missions-container');
            if (!container || !section) return;

            const key = this.getUserKey();
            const today = new Date().toDateString();
            const types = ['flash', 'master', 'king'];
            const activeEvents = [];

            const salesHistory = JSON.parse(localStorage.getItem(`dito_real_sales_history_${key}`) || '[]');
            const salesToday = salesHistory.filter(s => new Date(s.date).toDateString() === today).length;
            const processedRefs = JSON.parse(localStorage.getItem('dito_processed_refs') || '[]');
            const claimedEvents = JSON.parse(localStorage.getItem(`dito_claimed_events_${key}`) || '[]');

            const eventConfigs = {
                'flash': { name: 'Missão Veloz', goal: 1, current: salesToday, reward: 300, unit: 'venda', icon: 'ticket', color: '#ef4444' },
                'master': { name: 'Missão Especialista', goal: 5, current: salesToday, reward: 500, unit: 'vendas', icon: 'ticket', color: '#0487ff' },
                'king': { name: 'Rei da Rede', goal: 3, current: processedRefs.length, reward: 750, unit: 'indicações', icon: 'ticket', color: '#ffd600' }
            };

            types.forEach(type => {
                if (localStorage.getItem(`dito_event_${type}_${key}`) === 'active') {
                    activeEvents.push({ type, ...eventConfigs[type] });
                }
            });

            if (activeEvents.length === 0) {
                section.style.display = 'none';
                return;
            }

            section.style.display = 'block';
            container.innerHTML = activeEvents.map(evt => {
                const isClaimed = claimedEvents.includes(evt.type);
                const isCompleted = evt.current >= evt.goal;
                const progress = Math.min((evt.current / evt.goal) * 100, 100);

                return `
                <div style="scroll-snap-align: start; min-width: 200px; padding: 20px; border-radius: 24px; border: 2px solid transparent; background: linear-gradient(#fff, #fff) padding-box, linear-gradient(135deg, #ef4444 0%, #0ea5e9 100%) border-box; display: flex; flex-direction: column; gap: 12px; position: relative; box-shadow: 0 10px 30px rgba(239, 68, 68, 0.05);">
                    <div style="position: absolute; top: 12px; right: 12px; background: ${evt.color}15; color: ${evt.color}; font-size: 9px; font-weight: 950; padding: 4px 10px; border-radius: 50px;">+${evt.reward}</div>
                    <div style="width: 44px; height: 44px; background: ${evt.color}15; border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
                        <i data-lucide="ticket" style="width: 22px; color: ${evt.color};"></i>
                    </div>
                    <div>
                        <p style="font-weight: 950; font-size: 14px; color: #000; margin-bottom: 2px;">${evt.name}</p>
                        <p style="font-size: 10px; font-weight: 700; color: #999;">Meta: ${evt.goal} ${evt.unit}</p>
                    </div>
                    <div style="margin-top: 5px;">
                        <div style="width: 100%; height: 8px; background: #f5f5f5; border-radius: 10px; overflow: hidden; margin-bottom: 12px;">
                            <div style="width: ${progress}%; height: 100%; background: ${evt.color}; transition: 0.5s;"></div>
                        </div>
                        ${isClaimed ? 
                            `<div style="background: #f0fdf4; color: #16a34a; padding: 10px; border-radius: 14px; font-size: 10px; font-weight: 950; text-align: center;">RESGATADO ✅</div>` :
                            (isCompleted ? 
                                `<button onclick="app.claimEventReward('${evt.type}', ${evt.reward})" style="width: 100%; background: ${evt.color}; color: #fff; border: none; padding: 12px; border-radius: 14px; font-size: 10px; font-weight: 950; cursor: pointer; animation: pulse 2s infinite;">RESGATAR</button>` :
                                `<div style="background: #f5f5f5; color: #999; padding: 10px; border-radius: 14px; font-size: 10px; font-weight: 950; text-align: center;">${evt.current}/${evt.goal} ${evt.unit}</div>`
                            )
                        }
                    </div>
                </div>
                `;
            }).join('');

            if (window.lucide) lucide.createIcons();
        },

        claimEventReward(type, amount) {
            const key = this.getUserKey();
            const claimedKey = `dito_claimed_events_${key}`;
            let claimed = JSON.parse(localStorage.getItem(claimedKey) || '[]');
            
            if (!claimed.includes(type)) {
                claimed.push(type);
                localStorage.setItem(claimedKey, JSON.stringify(claimed));
                
                const coinsKey = `dito_coins_${key}`;
                let current = parseInt(localStorage.getItem(coinsKey) || '0');
                const newBalance = current + amount;
                localStorage.setItem(coinsKey, newBalance.toString());
                
                if (this.userId) {
                    supabase.from('profiles').update({ coins: newBalance }).eq('id', this.userId).then(() => {});
                }
                
                this.launchVictoryConfetti();
                this.showSystemNotification('Evento Concluído!', `Você ganhou ${amount} cupons extras!`, 'success');
                this.renderMissions();
                this.updateBalanceUI();
            }
        },

        claimDailyChallenge(id, amount) {
            const key = this.getUserKey();
            const today = new Date().toDateString();
            const claimedKey = `dito_claimed_daily_${key}_${today}`;
            
            if (localStorage.getItem(claimedKey) !== 'true') {
                localStorage.setItem(claimedKey, 'true');
                
                const coinsKey = `dito_coins_${key}`;
                let current = parseInt(localStorage.getItem(coinsKey) || '0');
                const newBalance = current + amount;
                localStorage.setItem(coinsKey, newBalance.toString());
                
                // --- SINCRONIZA COM SUPABASE (NUVEM) ---
                if (this.userId) {
                    supabase.from('profiles').update({ coins: newBalance }).eq('id', this.userId).then(() => {
                        console.log('✅ Bônus diário salvo na nuvem.');
                    });
                }
                
                this.showSystemNotification('Desafio Concluido', `Você resgatou +${amount} cupons pelo desafio do dia!`, 'success');
                this.renderMissions();
                this.updateBalanceUI(); // Sincroniza Dashboard e Mercado
            }
        },

        checkMissionAlerts() {
            const key = this.getUserKey();
            const today = new Date().toDateString();
            const sales = JSON.parse(localStorage.getItem(`dito_real_sales_history_${key}`) || '[]');
            const hasSaleToday = sales.some(s => new Date(s.date).toDateString() === today);
            
            // Alerta para Missão Diária (100 cupons)
            const dailyClaimed = localStorage.getItem(`dito_claimed_daily_${key}_${today}`) === 'true';
            if (hasSaleToday && !dailyClaimed) {
                this.showNotification('Missão Diária Concluída! Resgate seus 100 cupons.', 'success');
            }
        },

        renderLongTermMissions() {
            const container = document.getElementById('long-term-missions-container');
            if (!container) return;

            const key = this.getUserKey();
            const processedRefs = JSON.parse(localStorage.getItem('dito_processed_refs') || '[]');
            const salesHistory = JSON.parse(localStorage.getItem(`dito_real_sales_history_${key}`) || '[]');
            const fansCount = (this.currentUser && this.currentUser.fans) ? this.currentUser.fans : 0;
            const claimedMissions = JSON.parse(localStorage.getItem(`dito_claimed_missions_${key}`) || '[]');

            // Definição das Escalas Progressivas
            const configs = [
                { 
                    id: 'ref', title: 'Fazedor de Amigos', icon: 'users',
                    stages: [
                        { goal: 1, reward: 30 }, { goal: 5, reward: 150 }, { goal: 10, reward: 300 }, { goal: 25, reward: 750 }, { goal: 50, reward: 1500 }
                    ],
                    currentVal: processedRefs.length
                },
                { 
                    id: 'sale', title: 'Mestre das Vendas', icon: 'shopping-cart',
                    stages: [
                        { goal: 1, reward: 1000 }, { goal: 5, reward: 5000 }, { goal: 10, reward: 10000 }, { goal: 25, reward: 25000 }, { goal: 50, reward: 50000 }
                    ],
                    currentVal: salesHistory.length
                },
                { 
                    id: 'fans', title: 'Influenciador', icon: 'heart',
                    stages: [
                        { goal: 10, reward: 300 }, { goal: 30, reward: 900 }, { goal: 50, reward: 1500 }, { goal: 75, reward: 2250 }, { goal: 100, reward: 3000 }, { goal: 250, reward: 7500 }
                    ],
                    currentVal: fansCount
                }
            ];

            container.innerHTML = configs.map(cfg => {
                // Acha o primeiro estágio não resgatado
                let activeStage = cfg.stages.find(s => !claimedMissions.includes(`${cfg.id}_${s.goal}`));
                
                // Se completou todos, mostra o último como resgatado
                if (!activeStage) activeStage = cfg.stages[cfg.stages.length - 1];

                const missionId = `${cfg.id}_${activeStage.goal}`;
                const isCompleted = cfg.currentVal >= activeStage.goal;
                const isClaimed = claimedMissions.includes(missionId);

                return `
                <div style="scroll-snap-align: start; min-width: 170px; background: #fff; padding: 20px; border-radius: 24px; border: 1px solid #eee; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.02); position: relative;">
                    <div style="position: absolute; top: 12px; right: 12px; background: rgba(255, 0, 92, 0.05); color: #ff005c; font-size: 9px; font-weight: 950; padding: 4px 10px; border-radius: 50px;">+${activeStage.reward}</div>
                    <div style="width: 48px; height: 48px; background: #f8f8f8; border-radius: 14px; display: flex; align-items: center; justify-content: center;">
                        <i data-lucide="${cfg.icon}" style="width: 24px; color: #000;"></i>
                    </div>
                    <div>
                        <p style="font-weight: 950; font-size: 13px; color: #000; margin-bottom: 2px;">${cfg.title}</p>
                        <p style="font-size: 10px; font-weight: 700; color: #999;">Meta: ${activeStage.goal} ${cfg.id === 'fans' ? 'fãs' : (cfg.id === 'ref' ? 'amigos' : 'vendas')}</p>
                    </div>
                    <div style="margin-top: 5px;">
                        <div style="width: 100%; height: 6px; background: #f0f0f0; border-radius: 10px; overflow: hidden; margin-bottom: 12px;">
                            <div style="width: ${Math.min((cfg.currentVal / activeStage.goal) * 100, 100)}%; height: 100%; background: linear-gradient(90deg, #ff005c, #0487ff); transition: 0.5s;"></div>
                        </div>
                        ${isClaimed ? 
                            `<div style="background: #f0fdf4; color: #16a34a; padding: 10px; border-radius: 14px; font-size: 10px; font-weight: 950; text-align: center;">CONCLUÍDO</div>` :
                            (isCompleted ? 
                                `<button onclick="app.claimLongTermMission('${missionId}', ${activeStage.reward})" style="width: 100%; background: #000; color: #fff; border: none; padding: 12px; border-radius: 14px; font-size: 10px; font-weight: 950; cursor: pointer; animation: pulse 2s infinite;">RESGATAR</button>` :
                                `<div style="background: #f5f5f5; color: #999; padding: 10px; border-radius: 14px; font-size: 10px; font-weight: 950; text-align: center;">${cfg.currentVal}/${activeStage.goal}</div>`
                            )
                        }
                    </div>
                </div>
                `;
            }).join('');

            if (window.lucide) lucide.createIcons();
        },

        claimLongTermMission(missionId, amount) {
            const key = this.getUserKey();
            const claimedKey = `dito_claimed_missions_${key}`;
            let claimed = JSON.parse(localStorage.getItem(claimedKey) || '[]');
            
            if (!claimed.includes(missionId)) {
                claimed.push(missionId);
                localStorage.setItem(claimedKey, JSON.stringify(claimed));
                
                const coinsKey = `dito_coins_${key}`;
                let current = parseInt(localStorage.getItem(coinsKey) || '0');
                const newBalance = current + amount;
                localStorage.setItem(coinsKey, newBalance.toString());
                
                // --- SINCRONIZA COM SUPABASE (NUVEM) ---
                if (this.userId) {
                    supabase.from('profiles').update({ coins: newBalance }).eq('id', this.userId).then(() => {
                        console.log('✅ Missão progressiva salva na nuvem.');
                    });
                }
                
                this.showSystemNotification('Missão Cumprida', `Você resgatou +${amount} cupons!`, 'success');
                this.renderMissions();
                this.updateBalanceUI(); // Sincroniza Dashboard e Mercado
            }
        },

        checkMissionsNotification() {
            if (!this.currentUser) return;
            const key = this.getUserKey();
            const storageKey = `dito_missions_${key}`;
            
            // Tenta carregar. Se não existir, gera o checklist inicial para poder alertar
            let checklist = JSON.parse(localStorage.getItem(storageKey) || '[]');
            if (checklist.length === 0 || checklist[0].week !== this.getWeekNumber()) {
                const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                checklist = days.map((d, i) => ({ dayName: d, index: i, checked: false, week: this.getWeekNumber() }));
                localStorage.setItem(storageKey, JSON.stringify(checklist));
            }

            const todayIndex = new Date().getDay(); // getDay() retorna 0 para Domingo, 1 para Segunda...
            
            const dot = document.getElementById('dot-missions');
            if (dot) {
                // A lógica de index na renderMissions é: 0=Dom, 1=Seg...
                const hasPending = checklist[todayIndex] && !checklist[todayIndex].checked;
                dot.style.display = hasPending ? 'block' : 'none';
            }
        },

        claimDailyCheckin(dayIndex) {
            const key = this.getUserKey();
            const storageKey = `dito_missions_${key}`;
            const historyKey = `dito_checkin_history_${key}`;
            let checklist = JSON.parse(localStorage.getItem(storageKey) || '[]');
            
            if (checklist[dayIndex] && !checklist[dayIndex].checked) {
                checklist[dayIndex].checked = true;
                localStorage.setItem(storageKey, JSON.stringify(checklist));
                
                let currentCoins = parseInt(localStorage.getItem(`dito_coins_${key}`) || '0');
                const REWARD = 75;
                currentCoins += REWARD;
                localStorage.setItem(`dito_coins_${key}`, currentCoins.toString());

                // REGISTRA NO HISTÓRICO PERMANENTE
                let history = JSON.parse(localStorage.getItem(historyKey) || '[]');
                history.push({ 
                    date: new Date().toISOString(), 
                    amount: REWARD, 
                    day: checklist[dayIndex].dayName,
                    week: this.getWeekNumber()
                });
                localStorage.setItem(historyKey, JSON.stringify(history));
                
                // Atualiza saldo na tela IMEDIATAMENTE
                const balanceEl = document.getElementById('missions-coin-balance');
                if (balanceEl) balanceEl.innerText = currentCoins.toLocaleString();

                this.launchVictoryConfetti();
                this.showNotification(`${REWARD} Cupons coletados! 🎫✨`, 'success');
                this.showSystemNotification('Check-in Realizado! ✅', `Você ganhou ${REWARD} cupons de bônus diário.`, 'success');
                
                this.renderMissions();
                this.checkMissionsNotification(); 
                
                // Sincronização opcional com Supabase se o perfil existir
                if (this.currentUser && this.currentUser.username) {
                    supabase.from('dito_users').update({ balance: currentCoins }).eq('username', this.currentUser.username).then(() => {
                        console.log('✅ Saldo de check-in sincronizado.');
                    });
                }
            }
        },

        getWeekNumber() {
            const d = new Date();
            const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
            const pastDaysOfYear = (d - firstDayOfYear) / 86400000;
            return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        },

        openLiveAdmin() {
            const existing = document.getElementById('live-production-hub');
            if (existing) {
                existing.remove();
                // Não paramos a câmera aqui para permitir que ela continue rodando em background se estiver em live
                return;
            }

            const actions = [
                { icon: 'play-circle', label: 'Iniciar', color: '#000', call: "app.updateLiveStatus('AO VIVO')" },
                { icon: 'pause-circle', label: 'Pausar', color: '#000', call: "app.updateLiveStatus('PAUSADO')" },
                { icon: 'x-circle', label: 'Encerrar', color: '#000', call: "app.updateLiveStatus('ENCERRADO')" },
                { icon: 'refresh-ccw', label: 'Sair', color: '#000', call: "app.updateLiveVisibility(false)" }
            ];

            const buttonsHtml = actions.map(a => `
                <button onclick="${a.call}" style="flex: 1; padding: 12px 6px; border-radius: 12px; border: 1px solid #f2f2f2; background: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; cursor: pointer; transition: 0.2s;">
                    <i data-lucide="${a.icon}" style="width: 20px; color: ${a.color};"></i>
                    <span style="font-weight: 800; font-size: 8px; text-transform: uppercase; color: #000;">${a.label}</span>
                </button>
            `).join('');

            const hub = document.createElement('div');
            hub.id = 'live-production-hub';
            hub.style = `
                position: fixed; 
                top: 50%; 
                left: 50%; 
                transform: translate(-50%, -50%); 
                width: 320px; 
                background: #fff; 
                border-radius: 32px; 
                box-shadow: 0 30px 100px rgba(0,0,0,0.5); 
                z-index: 4000; 
                overflow: hidden; 
                animation: slideHub 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28);
                border: 1px solid rgba(0,0,0,0.05);
            `;

            // Adiciona um overlay de fundo para foco
            const overlayHub = document.createElement('div');
            overlayHub.id = 'live-hub-overlay';
            overlayHub.style = "position:fixed; inset:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(5px); z-index:3999;";
            overlayHub.onclick = () => { hub.remove(); overlayHub.remove(); };
            document.body.appendChild(overlayHub);
            
            hub.innerHTML = `
                <!-- Cabeçalho de Ativação -->
                <div style="padding: 16px 16px 12px; background: #fff; border-bottom: 1px solid #f5f5f5;">
                    <button onclick="app.activateLiveCamera()" style="width: 100%; height: 44px; background: #000; color: #fff; border: none; border-radius: 12px; font-weight: 950; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.2s;">
                        <i data-lucide="video" style="width: 16px;"></i>
                        Iniciar minha câmera
                    </button>
                </div>

                <div id="live-monitor-container" style="width: 100%; height: 160px; background: #0b0b0b; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    <video id="live-preview-video" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover; display: none;"></video>
                    <div id="live-overlay-status" style="position: absolute; inset: 0; background: rgba(0,0,0,0.7); display: none; align-items: center; justify-content: center; flex-direction: column; z-index: 5;">
                         <i data-lucide="pause" style="width: 32px; color: #fff; margin-bottom: 8px;"></i>
                         <span style="color: #fff; font-size: 10px; font-weight: 900; letter-spacing: 2px;">PAUSADO</span>
                    </div>
                    <div id="live-placeholder" style="color: #fff; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; text-align: center; opacity: 0.4;">
                        <i data-lucide="video-off" style="width: 32px; margin-bottom: 8px; display: block; margin-left: auto; margin-right: auto;"></i>
                        ESTÚDIO DESLIGADO
                    </div>
                    <div style="position: absolute; top: 12px; left: 12px; display: flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.5); padding: 4px 10px; border-radius: 100px; backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); z-index: 10;">
                        <div id="live-indicator-dot" style="width: 6px; height: 6px; background: #666; border-radius: 50%;"></div>
                        <span id="live-indicator-text" style="color: #fff; font-size: 8px; font-weight: 900; letter-spacing: 0.5px;">STBY</span>
                    </div>
                </div>

                <div style="padding: 18px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
                        <h3 style="font-weight: 950; font-size: 11px; text-transform: uppercase; margin: 0; letter-spacing: 0.5px; color: #999;">Console de Direção</h3>
                        <div onclick="document.getElementById('live-production-hub').remove(); document.getElementById('live-hub-overlay').remove();" style="width: 28px; height: 28px; border-radius: 50%; background: #f5f5f5; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                            <i data-lucide="x" style="width: 14px; color: #666;"></i>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 6px;">
                        ${buttonsHtml}
                    </div>

                    <div style="margin-top: 14px; padding: 12px; background: #f9f9f9; border-radius: 16px; display: flex; align-items: center; justify-content: space-between; border: 1px solid #f0f0f0;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 32px; height: 32px; background: #000; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                                <i data-lucide="activity" style="width: 16px; color: #fff;"></i>
                            </div>
                            <span style="font-weight: 900; font-size: 11px; color: #000;">Sinal 100%</span>
                        </div>
                        <span style="font-weight: 900; font-size: 9px; color: #10b981;">ESTÁVEL</span>
                    </div>
                </div>
            `;

            document.body.appendChild(hub);
            if (window.lucide) lucide.createIcons();

            // Se já estiver ao vivo ao abrir, reconecta o preview
            if (this.currentLiveStatus === 'AO VIVO' && this.liveStream) {
                 const video = document.getElementById('live-preview-video');
                 if (video) {
                     video.srcObject = this.liveStream;
                     video.style.display = 'block';
                     if(document.getElementById('live-placeholder')) document.getElementById('live-placeholder').style.display = 'none';
                     const dot = document.getElementById('live-indicator-dot');
                     if(dot) { dot.style.background = '#ef4444'; dot.style.animation = 'pulse 1s infinite'; }
                     const text = document.getElementById('live-indicator-text');
                     if(text) text.innerText = 'LIVE';
                 }
            }
        },

        async activateLiveCamera() {
            try {
                if (!this.liveStream) {
                    this.liveStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                }
                const video = document.getElementById('live-preview-video');
                const placeholder = document.getElementById('live-placeholder');
                if (video && placeholder) {
                    video.srcObject = this.liveStream;
                    video.play();
                    video.style.display = 'block';
                    placeholder.style.display = 'none';
                    this.showNotification("Sinal de vídeo ativado no estúdio.", "info");
                }
            } catch (e) {
                console.error("Erro ao ativar câmera:", e);
                this.showNotification("Não foi possível acessar sua câmera.", "error");
            }
        },

        async updateLiveStatus(status) {
            this.currentLiveStatus = status;
            const video = document.getElementById('live-preview-video');
            const placeholder = document.getElementById('live-placeholder');
            const overlay = document.getElementById('live-overlay-status');
            const dot = document.getElementById('live-indicator-dot');
            const text = document.getElementById('live-indicator-text');

            if (status === 'AO VIVO') {
                if (!this.liveStream) {
                    try {
                        this.liveStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    } catch (e) {
                        this.showNotification("Não foi possível acessar a câmera.", "error");
                        return;
                    }
                }
                if (video) {
                    video.srcObject = this.liveStream;
                    video.play();
                    video.style.display = 'block';
                    if(placeholder) placeholder.style.display = 'none';
                    if(overlay) overlay.style.display = 'none';
                    if(dot) { dot.style.background = '#000'; dot.style.animation = 'pulse 1s infinite'; }
                    if(text) text.innerText = 'AO VIVO';
                }
                this.showNotification("TRANSMISSÃO INICIADA! 🚀", "success");
            } 
            else if (status === 'PAUSADO') {
                if (video) video.pause();
                if (overlay) overlay.style.display = 'flex';
                if (dot) { dot.style.background = '#333'; dot.style.animation = 'none'; }
                if(text) text.innerText = 'PAUSADO';
                this.showNotification("Transmissão Pausada.", "info");
            } 
            else if (status === 'ENCERRADO') {
                if (this.liveStream) {
                    this.liveStream.getTracks().forEach(track => track.stop());
                    this.liveStream = null;
                }
                if (video) {
                    video.srcObject = null;
                    video.style.display = 'none';
                }
                if(placeholder) placeholder.style.display = 'flex';
                if(overlay) overlay.style.display = 'none';
                if(dot) { dot.style.background = '#999'; dot.style.animation = 'none'; }
                if(text) text.innerText = 'OFFLINE';
                this.showNotification("Transmissão Encerrada.", "error");
            }

            // Notifica os usuários via Chat
            if (supabase) {
                await supabase.from('dito_messages').insert([{
                    sender: 'Dito System',
                    receiver: 'GLOBAL',
                    content: `📢 [ESTÚDIO] Status: ${status}`
                }]);
            }
            if (window.lucide) lucide.createIcons();
        },

        async updateLiveVisibility(visible) {
            let targetId = this.selectedProduct?.id || this.adminLiveProduct?.id;
            let targetName = this.selectedProduct?.name || this.adminLiveProduct?.name || "Mentoria";

            // Prioridade para a sala de chat ativa se estiver em uma Live
            if (this.activeWorldRoom && this.activeWorldRoom.startsWith('LIVE_')) {
                targetId = this.activeWorldRoom.replace('LIVE_', '');
            }

            if (!targetId) return this.showNotification("Identificador da mentoria não encontrado.", "error");

            if (confirm(`Deseja alterar a visibilidade de "${targetName}" no mercado?`)) {
                if (supabase) {
                    // Tenta atualizar no Supabase (String ou Number)
                    const { error } = await supabase.from('dito_market_products')
                        .update({ visible: visible })
                        .eq('id', String(targetId));
                    
                    if (error) {
                        await supabase.from('dito_market_products').update({ visible: visible }).eq('id', Number(targetId));
                    }
                    
                    // LIMPEZA LOCAL IMEDIATA (Faxina em todos os buffers)
                    const cacheKeys = ['dito_products', 'dito_products_vanilla', 'dito_market_products'];
                    cacheKeys.forEach(key => {
                        let list = JSON.parse(localStorage.getItem(key) || '[]');
                        list = list.map(p => {
                            if (String(p.id) === String(targetId)) return { ...p, visible: visible };
                            return p;
                        });
                        localStorage.setItem(key, JSON.stringify(list));
                    });

                    localStorage.removeItem('dito_last_p_hash'); 
                    this.showNotification(`Mentoria ${visible ? 'ativada' : 'removida'} com sucesso!`);
                    
                    // Se ocultou, fecha o chat para limpar o contexto
                    if (!visible) this.closeWorldChat();
                    
                    this.fetchNetworkProducts(); 
                }
            }
        },

        closeWorldChat() {
            const drawer = document.getElementById('world-chat-drawer');
            drawer.classList.remove('active');
            drawer.style.left = '-100%';
        },

        async sendWorldMessage() {
            const inp = document.getElementById('world-chat-input');
            let text = inp.value.trim();
            if(!text || !this.currentUser) return;
            let content = text;
            // Se estiver em uma sala (Live ou Sociedade), usa ela como receptor, senão GLOBAL
            let receiver = this.activeWorldRoom || 'GLOBAL';
            
            // Lógica de Comandos (DDTank Style)
            if (text.startsWith('/s ')) {
                // Se estiver no detalhe de uma sociedade, envia apenas para aquela sala isolada
                const isSocDetail = this.currentView === 'sociedade-detalhe';
                receiver = isSocDetail ? `SOC_${this.currentSocietyId}` : 'SOC_GLOBAL';
                content = text.replace('/s ', '');
            } else if (text.startsWith('/p ')) {
                const parts = text.split(' ');
                if (parts.length > 2) {
                    receiver = parts[1]; // O nome do usuário
                    content = parts.slice(2).join(' ');
                }
            }
            
            const msg = {
                sender: this.currentUser.username,
                receiver: receiver,
                content: content,
                created_at: new Date().toISOString(),
                is_read: false
            };
            
            if(supabase) {
                const { error } = await supabase.from('dito_messages').insert([msg]);
                if(error) console.error("❌ [World Chat] Erro ao enviar:", error.message);
            }

            inp.value = '';
        },

        receiveWorldMessage(msg) {
            // Se for para mim ou Global/Sociedade, adiciona ao feed
            const isForMe = msg.receiver === 'GLOBAL' || 
                            msg.receiver === 'SOC_GLOBAL' || 
                            msg.receiver === this.currentUser?.username ||
                            msg.sender === this.currentUser?.username;

            if (isForMe) {
                this.appendWorldMessageToChat(msg);
                
                // Notifica se o chat estiver fechado
                const drawer = document.getElementById('world-chat-drawer');
                if (drawer && !drawer.classList.contains('active')) {
                    const dot = document.getElementById('dot-world-chat');
                    if (dot) dot.style.display = 'block';
                }
            }
        },

        appendWorldMessageToChat(msg) {
            const container = document.getElementById('world-chat-feed');
            if (!container) return;
            
            // Evita duplicatas visuais se vier do fetch e do realtime ao mesmo tempo
            const msgId = msg.id || (msg.created_at + msg.content);
            if (document.getElementById(`world-msg-${msgId}`)) return;

            // Definição das Cores de Alto Contraste (Fundo Branco)
            let channelColor = '#000000'; // Global (Preto Sólido)
            let prefix = '[Mundo]';
            
            const isSpecificSoc = msg.receiver && msg.receiver.startsWith('SOC_');
            
            if (isSpecificSoc && msg.receiver !== 'SOC_GLOBAL') {
                channelColor = '#0057ff'; // Sociedade Específica (Azul vibrante)
                const socId = msg.receiver.replace('SOC_', '');
                prefix = `[Sociedade #${socId.substring(0,4)}]`;
            } else if (msg.receiver === 'SOC_GLOBAL') {
                channelColor = '#008f11'; // Sociedade Geral (Verde Escuro)
                prefix = '[Sociedade]';
            } else if (msg.receiver !== 'GLOBAL') {
                channelColor = '#c70097'; // Privado/Sussurro (Rosa Escuro para fundo branco)
                prefix = `[Sussurro de ${msg.receiver === this.currentUser?.username ? 'você' : msg.receiver}]`;
            }
            
            const isMe = msg.sender === this.currentUser?.username;
            const itemDiv = document.createElement('div');
            itemDiv.id = `world-msg-${msgId}`;
            itemDiv.style.padding = '4px 0'; 
            itemDiv.style.color = channelColor;
            itemDiv.style.fontSize = '14px';
            itemDiv.style.fontWeight = '700';
            itemDiv.style.fontFamily = "'Inter', sans-serif"; 
            itemDiv.style.lineHeight = '1.3';
            itemDiv.style.borderBottom = '1px solid #f9f9f9'; 
            
            // Remove emojis da mensagem
            const cleanContent = (msg.content || "").replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');

            let user = (this.networkUsers || []).find(u => u.username === msg.sender);
            if (!user && this.currentUser && msg.sender === this.currentUser.username) {
                user = this.currentUser;
            }
            
            const avatarUrl = (user && user.avatar) ? user.avatar : (msg.sender_avatar || "");
            const avatarId = `chat-avatar-${msg.sender}-${msgId}`;
            const avatarHtml = `<img id="${avatarId}" src="${this.rGetPImage(avatarUrl, msg.sender)}" style="width: 100%; height: 100%; object-fit: cover;">`;

            itemDiv.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 2px;">
                    <div onclick="app.viewPublicProfile('${msg.sender}')" style="width: 28px; height: 28px; border-radius: 50%; background: #f9f9f9; border: 1px solid #eee; overflow: hidden; flex-shrink: 0; cursor: pointer; margin-top: 2px;">
                        ${avatarHtml}
                    </div>
                    <div style="flex: 1; line-height: 1.4;">
                        <span onclick="app.viewPublicProfile('${msg.sender}')" style="cursor: pointer; color: ${isMe ? '#ff005c' : channelColor}; font-weight: 950; font-size: 13px;">${msg.sender}</span>
                        <span style="font-weight: 600; color: #333; font-size: 13px; margin-left: 2px;">${cleanContent}</span>
                    </div>
                </div>
            `;
            
            container.appendChild(itemDiv);
            container.scrollTop = container.scrollHeight;

            // Salva no cache local para persistência total (DDTank Style)
            this.saveWorldMessageToLocal(msg);
        },

        saveWorldMessageToLocal(msg) {
            const key = 'dito_world_chat_history';
            let history = [];
            try {
                history = JSON.parse(localStorage.getItem(key) || '[]');
            } catch(e) { history = []; }

            // Evita duplicatas no storage
            const alreadyExists = history.some(m => (m.id && m.id === msg.id) || (m.created_at === msg.created_at && m.content === msg.content));
            if (!alreadyExists) {
                history.push(msg);
                if (history.length > 100) history.shift(); // Mantém as últimas 100 mensagens
                localStorage.setItem(key, JSON.stringify(history));
            }
        },

        async fetchWorldChatMessages() {
            if(!this.currentUser) return;
            const container = document.getElementById('world-chat-feed');
            if (!container) return;

            // 1. CARREGA DO CACHE LOCAL (INSTANTÂNEO)
            const localKey = 'dito_world_chat_history';
            let localData = [];
            try {
                localData = JSON.parse(localStorage.getItem(localKey) || '[]');
            } catch(e) { localData = []; }

            if (localData.length > 0) {
                container.innerHTML = '';
                localData.forEach(msg => this.appendWorldMessageToChat(msg));
            } else {
                container.innerHTML = '<p style="text-align:center;color:#ccc;font-size:12px;margin-top:20px;">Carregando mensagens da rede...</p>';
            }

            if (!supabase) return;

            try {
                // 2. BUSCA NO SUPABASE PARA ATUALIZAR O HISTÓRICO REAL
                const currentRoom = this.activeWorldRoom || 'GLOBAL';
                
                const { data, error } = await supabase.from('dito_messages')
                    .select('*')
                    .eq('receiver', currentRoom)
                    .order('created_at', { ascending: false })
                    .limit(50);
                    
                if(!error && data) {
                    // Re-renderiza com dados novos para garantir sincronia
                    container.innerHTML = '';
                    const reversed = data.reverse();
                    reversed.forEach(msg => {
                        if (msg.receiver !== 'GLOBAL' && msg.receiver !== 'SOC_GLOBAL' && msg.receiver !== this.currentUser.username && msg.sender !== this.currentUser.username) {
                            return;
                        }
                        this.appendWorldMessageToChat(msg);
                    });
                    
                    // Atualiza o cache local com os dados mais recentes do servidor
                    localStorage.setItem(localKey, JSON.stringify(reversed));
                }
            } catch(e) {
                console.warn("Erro ao buscar world chat:", e);
            }
        },

        // ==========================================
        // 🌐 SISTEMA DE REDE MULTIPLAYER
        // ==========================================
        
        networkUsers: [], // Cache em memória (RAM) para evitar estourar o localStorage

        async fetchNetworkUsers() {
            if (!supabase || this.isFetchingUsers) return;
            this.isFetchingUsers = true;
            try {
                const [hallRes, meRes] = await Promise.all([
                    supabase.from('dito_users').select('username, name, bio, fans, sales, avatar, last_seen, gender').order('sales', { ascending: false }).limit(80), 
                    this.currentUser ? supabase.from('dito_users').select('*').eq('username', this.currentUser.username).maybeSingle() : Promise.resolve({ data: null })
                ]);

                if (hallRes && hallRes.data) {
                    this.networkUsers = hallRes.data.map(u => this.cleanPublicProfile(u));
                    this.safeLocalStorageSet('dito_network_users', JSON.stringify(this.networkUsers));
                    if (this.currentView === 'hall') this.renderHallOfFame();
                    if (this.currentView === 'admin-contas') this.renderAdminUsers(true); 
                }

                if (meRes && meRes.data && this.currentUser) {
                    const netUser = meRes.data;
                    this.currentUser.sales = parseFloat(netUser.sales || 0);
                    localStorage.setItem('dito_balance', netUser.balance || '0');
                    
                    // RESTAURAÇÃO DE SEGURANÇA (Caso cache tenha sido limpo ou compra manual por ADM)
                    const key = this.getUserKey();
                    if (netUser.coins !== undefined) {
                        localStorage.setItem(`dito_coins_${key}`, String(netUser.coins || 0));
                    }
                    if (netUser.booster_expiry !== undefined) {
                        localStorage.setItem(`dito_booster_expiry_${key}`, String(netUser.booster_expiry || 0));
                    }
                    
                    // Restaura os produtos comprados da nuvem
                    if (netUser.purchases) {
                        try {
                            const cloudPurchases = typeof netUser.purchases === 'string' ? JSON.parse(netUser.purchases) : netUser.purchases;
                            if (Array.isArray(cloudPurchases) && cloudPurchases.length > 0) {
                                this.purchasedProducts = cloudPurchases;
                                this.safeLocalStorageSet(`dito_purchased_products_${key}`, JSON.stringify(this.purchasedProducts));
                            }
                        } catch (e) { console.error("Erro ao restaurar compras:", e); }
                    }

                    this.saveSession(this.currentUser);
                    this.updateCoinsUI();
                    this.updateBoosterUI();
                    if (this.currentView === 'meus-cursos') this.renderPurchasedProducts();
                    this.checkSocietyPendingRequests(); 
                }
                this.syncChatAvatars();
            } catch (err) {
                console.warn("⚠️ [REDE] Radar offline. Usando cache.");
                const cached = localStorage.getItem('dito_network_users');
                if (cached) {
                    this.networkUsers = JSON.parse(cached);
                    if (this.currentView === 'hall') this.renderHallOfFame();
                }
            } finally {
                this.isFetchingUsers = false;
            }
        },

        syncChatAvatars() {
            if (!this.networkUsers) return;
            this.networkUsers.forEach(u => {
                if (!u.avatar) return;
                // Procura todos os elementos de avatar deste usuário no chat e atualiza para a foto nova
                const avatars = document.querySelectorAll(`[id^="chat-avatar-${u.username}-"]`);
                avatars.forEach(el => {
                    if (el.tagName === 'IMG') {
                        if (el.src !== u.avatar) el.src = u.avatar;
                    } else {
                        // Era um placeholder, vira imagem
                        el.outerHTML = `<img id="${el.id}" src="${u.avatar}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    }
                });
            });
        },



        async syncUserToNetwork(user) {
            if (!supabase) return;
            try {
                const key = this.getUserKey();
                const payload = {
                    username: user.username,
                    password: user.password,
                    email: user.email || "",
                    gender: user.gender || "none",
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
                    if (error.message.includes('column "gender" does not exist')) {
                        this.showNotification('Erro de Banco: A coluna "gender" não existe no Supabase', 'error');
                    }
                } else {
                    console.log("🚀 Sincronizado com sucesso!");
                    this.updateBalanceUI();
                }
            } catch (e) {
                console.warn("⚠️ [Network] Erro crítico sync:");
            }
        },

        async fetchNetworkProducts(force = false) {
            // 1. Efeito Visual
            const mContainer = document.getElementById('market-actual-content');
            const rIcon = document.getElementById('market-refresh-icon');

            if (rIcon && force) {
                rIcon.style.transition = 'transform 1.5s ease-in-out';
                rIcon.style.transform = rIcon.style.transform === 'rotate(180deg)' ? 'rotate(0deg)' : 'rotate(180deg)';
            }

            if (mContainer) {
                mContainer.style.transition = 'none';
                mContainer.style.opacity = '0';
                setTimeout(() => {
                    mContainer.style.transition = 'opacity 1.5s ease-out';
                    mContainer.style.opacity = '1';
                }, 50);
            }

            if (!supabase) return;
            try {
                // 2. BUSCA NO SUPABASE
                const { data, error } = await supabase.from('dito_market_products')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (data && !error) {
                    // Hash ultra-leve para comparação
                    const currentHash = data.map(p => `${p.id}-${p.created_at}`).join('|');
                    
                    // SEMPRE atualiza a memória interna (RAM) para garantir que
                    // o usuário veja as mudanças mesmo sem refresh ou se o storage estiver bugado
                    
                    // Atualiza local anyway para garantir que tudo esteja fresco
                    // 2. Mirroring: Transformamos o dado da rede na nossa base real
                    const synchronized = data.map(net => {
                        const contentData = net.content ? (typeof net.content === 'string' ? JSON.parse(net.content) : net.content) : null;
                        return { ...net, price: Number(net.price), content: contentData };
                    });

                    // 3. Atualizamos a memória e o storage local
                    this.products = synchronized;
                    this.safeLocalStorageSet('dito_products_vanilla', JSON.stringify(synchronized));

                    // FORÇA a renderização se for o caso
                    if (this.currentView === 'mercado' && this.marketView === 'home') {
                        this.renderMarketHome();
                    }
                    
                    // Se estivermos na live, atualiza o produto selecionado para pegar novos links (Câmera do Mentor)
                    if (this.currentView === 'mercado' && this.marketView === 'live-room' && this.selectedProduct) {
                        const updated = synchronized.find(p => String(p.id) === String(this.selectedProduct.id));
                        if (updated) {
                            this.selectedProduct = updated;
                            this.renderMarketLiveRoom(document.getElementById('market-container'));
                        }
                    }

                    this.safeLocalStorageSet('dito_last_p_hash', currentHash);
                }
            } catch (err) {
                console.warn("⚠️ [REDE] Mercado offline. Usando cache local.");
                const cached = localStorage.getItem('dito_products_vanilla');
                if (cached) {
                    this.products = JSON.parse(cached);
                    if (this.currentView === 'mercado' && this.marketView === 'home') this.renderStore();
                }
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
                    guarantee: product.guarantee,
                    sales_link: product.sales_link, // Essencial para transmitir Native Live e Links
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
            
            const isMentoria = p.type === 'Mentoria';

            // Customizar capa ou foto de perfil (Live)
            const galleryContainer = document.getElementById('product-gallery-container');
            const dotsContainer = document.getElementById('gallery-dots');
            
            if (galleryContainer && dotsContainer && p) {
                galleryContainer.innerHTML = '';
                dotsContainer.innerHTML = '';
                
                // Pegar todas as imagens ou apenas a principal se for antigo
                const images = p.images && p.images.length > 0 ? p.images : [p.image];
                
                images.forEach((imgUrl, idx) => {
                    // Slide da Imagem
                    const slide = document.createElement('div');
                    slide.style.cssText = `min-width: 100%; height: 100%; scroll-snap-align: start; display: flex; align-items: center; justify-content: center; background: #fff;`;
                    slide.innerHTML = `<img src="${this.rGetPImage(imgUrl, p.name)}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    galleryContainer.appendChild(slide);
                    
                    // Pontinho indicador (se houver mais de uma foto)
                    if (images.length > 1) {
                        const dot = document.createElement('div');
                        dot.style.cssText = `width: 6px; height: 6px; border-radius: 50%; background: ${idx === 0 ? '#000' : 'rgba(0,0,0,0.1)'}; transition: 0.3s;`;
                        dotsContainer.appendChild(dot);
                    }
                });

                // Lógica simples para atualizar os pontinhos ao rolar
                galleryContainer.onscroll = () => {
                    const idx = Math.round(galleryContainer.scrollLeft / galleryContainer.offsetWidth);
                    Array.from(dotsContainer.children).forEach((dot, i) => {
                        dot.style.background = (i === idx) ? '#000' : 'rgba(0,0,0,0.1)';
                        dot.style.width = (i === idx) ? '12px' : '6px';
                        dot.style.borderRadius = (i === idx) ? '3px' : '50%';
                    });
                };
            }

            // Customizar Informações (Nome, Preço, Descrição, Avaliações)
            const detailContent = document.getElementById('product-detail-content');
            if (detailContent && p) {
                const stars = '★'.repeat(Math.round(p.rating || 5)) + '☆'.repeat(5 - Math.round(p.rating || 5));
                detailContent.innerHTML = `
                    <div style="margin-bottom: 24px;">
                        <span style="font-size: 10px; font-weight: 900; color: #ff005c; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 8px;">${p.category || 'Geral'}</span>
                        <h2 style="font-size: 28px; font-weight: 950; line-height: 1.1; letter-spacing: -1.5px; color: #000; margin-bottom: 12px;">${p.name}</h2>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="color: #ff9d00; font-size: 16px; letter-spacing: -2px;">${stars}</div>
                            <span style="font-size: 13px; font-weight: 900; color: #000;">${p.rating || '5.0'}</span>
                            <span style="font-size: 12px; color: #999; font-weight: 700;">• ${p.sales || '0'}+ vendas</span>
                        </div>
                    </div>

                    <div style="margin-bottom: 32px;">
                        <h3 style="font-size: 32px; font-weight: 950; color: #000; letter-spacing: -1px;">R$ ${p.price.toFixed(2)}</h3>
                        <p style="font-size: 11px; font-weight: 800; color: #22c55e;">Parcelamento disponível em até 12x</p>
                    </div>

                    <div style="margin-bottom: 32px;">
                        <h4 style="font-size: 13px; font-weight: 950; color: #000; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Sobre este produto</h4>
                        <p style="font-size: 14px; color: #444; line-height: 1.7; font-weight: 500; margin-bottom: 24px;">${p.description || "Este produto premium oferece acesso exclusivo a conteúdos transformadores. Garanta sua vaga hoje mesmo."}</p>
                        
                        <!-- SEÇÃO DO PRODUTOR (NOVO) -->
                        <div style="background: #f9f9f9; padding: 20px; border-radius: 20px; display: flex; align-items: center; gap: 16px;">
                            <div style="width: 60px; height: 60px; border-radius: 50%; overflow: hidden; border: 2px solid #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                                ${(() => {
                                    const allUsers = JSON.parse(localStorage.getItem('dito_users_db') || '[]');
                                    const seller = allUsers.find(u => u.username === p.seller);
                                    return seller && seller.avatar ? `<img src="${seller.avatar}" style="width: 100%; height: 100%; object-fit: cover;">` : `<div style="width: 100%; height: 100%; background: #000; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 20px;">${(p.seller || "P")[0].toUpperCase()}</div>`;
                                })()}
                            </div>
                            <div>
                                <span style="font-size: 10px; font-weight: 950; color: #999; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">Publicado por</span>
                                <h4 style="font-size: 16px; font-weight: 950; color: #000; display: flex; align-items: center; gap: 6px;">
                                    ${p.seller || "Produtor Dito"} 
                                    <i data-lucide="check-circle" style="width: 14px; color: #0487ff; fill: #0487ff20;"></i>
                                </h4>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Customizar Botões de Ação
            const actionsContainer = document.getElementById('product-actions');
            if (actionsContainer) {
                const isOwner = this.currentUser && (p.seller === this.currentUser.username || p.author === this.currentUser.username);
                const hasAccess = isOwner || (this.purchasedProducts && this.purchasedProducts.some(pp => String(pp.id) === String(p.id)));

                if (isMentoria) {
                    if (hasAccess) {
                        actionsContainer.innerHTML = `
                            <button onclick="app.accessLiveDirectly('${p.id}')" style="flex: 1; height: 64px; background: #10b981; color: #fff; border: none; border-radius: 100px; font-size: 13px; font-weight: 900; letter-spacing: 1px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 10px 25px rgba(16,185,129,0.3);">
                                <i data-lucide="check-circle" style="width: 20px;"></i>
                                ENTRAR NA MENTORIA
                            </button>
                        `;
                    } else {
                        actionsContainer.innerHTML = `
                            <button onclick="app.ingressLive('${p.id}')" style="flex: 1; height: 64px; background: linear-gradient(90deg, #ff005c, #ff3366); color: #fff; border: none; border-radius: 100px; font-size: 13px; font-weight: 900; letter-spacing: 1px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 10px 25px rgba(255,0,92,0.3);">
                                <i data-lucide="shopping-cart" style="width: 20px;"></i>
                                COMPRAR INGRESSO POR R$ ${p.price.toFixed(2)}
                            </button>
                        `;
                    }
                } else {
                    actionsContainer.innerHTML = `
                        <button onclick="app.addToCartFromDetail()" style="flex: 1; height: 64px; background: #000; color: #fff; border: none; border-radius: 100px; font-size: 13px; font-weight: 900; letter-spacing: 1px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                            <i data-lucide="shopping-bag" style="width: 20px;"></i> ADICIONAR À SACOLA
                        </button>
                    `;
                }
            }

            document.getElementById('product-detail-content').innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                    <h1 style="font-size: 28px; font-weight: 900; letter-spacing: -1px; width: 70%;">${p.name}</h1>
                    <div style="text-align: right;">
                        <span style="display: block; font-size: 22px; font-weight: 900; color: #ee4d2d;">R$ ${p.price.toFixed(2)}</span>
                        ${p.oldPrice ? `<span style="font-size: 12px; font-weight: 700; color: #ccc; text-decoration: line-through;">R$ ${p.oldPrice.toFixed(2)}</span>` : ''}
                    </div>
                </div>

                <div id="product-rating-container" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px;">
                     <div style="display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="star" style="width: 14px; color: #facc15; fill: #facc15;"></i>
                        <span id="product-avg-rating" style="font-size: 12px; font-weight: 800; color: #bbb;">Carregando nota...</span>
                     </div>
                     <div id="product-interactive-stars" style="display: flex; gap: 4px;">
                        <i data-pstar="1" onclick="app.rateProduct('${p.id}', 1)" data-lucide="star" style="width: 20px; color: #eee; cursor: pointer;"></i>
                        <i data-pstar="2" onclick="app.rateProduct('${p.id}', 2)" data-lucide="star" style="width: 20px; color: #eee; cursor: pointer;"></i>
                        <i data-pstar="3" onclick="app.rateProduct('${p.id}', 3)" data-lucide="star" style="width: 20px; color: #eee; cursor: pointer;"></i>
                        <i data-pstar="4" onclick="app.rateProduct('${p.id}', 4)" data-lucide="star" style="width: 20px; color: #eee; cursor: pointer;"></i>
                        <i data-pstar="5" onclick="app.rateProduct('${p.id}', 5)" data-lucide="star" style="width: 20px; color: #eee; cursor: pointer;"></i>
                     </div>
                </div>

                <p style="font-size: 14px; color: #666; font-weight: 500; line-height: 1.6; margin-bottom: 32px;">${p.description || 'Sem descrição detalhada disponível para este produto no momento.'}</p>
                
                <div style="background: transparent; padding: 10px 0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 44px; height: 44px; background: #000; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 900; overflow: hidden;">
                            ${p.seller_avatar ? `<img src="${p.seller_avatar}" style="width:100%; height:100%; object-fit:cover;">` : (p.seller ? p.seller[0] : 'U')}
                        </div>
                        <div>
                            <p style="font-size: 12px; font-weight: 900;">${p.seller || 'Membro'}</p>
                            <p style="font-size: 10px; color: #ccc; font-weight: 700;">Loja Oficial</p>
                        </div>
                    </div>
                    <button onclick="app.navigate('perfil')" style="font-size: 10px; font-weight: 900; text-transform: uppercase; background: transparent; border: 1px solid #eee; padding: 10px 16px; border-radius: 30px; cursor: pointer; color: #ccc;">Ver perfil</button>
                </div>
            `;

            if (window.lucide) lucide.createIcons();
            this.fetchAndRenderProductRating(p.id); 
        },

        ingressLive(productId) {
            // Busca o produto real
            const p1 = JSON.parse(localStorage.getItem('dito_products') || '[]');
            const p2 = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
            const p3 = JSON.parse(localStorage.getItem('dito_market_products') || '[]');
            const product = [...p1, ...p2, ...p3].find(p => String(p.id) === String(productId));

            if (!product) return this.showNotification("Erro ao localizar ingressos da Live.", "error");

            // Limpa o carrinho atual para focar apenas na Live (Venda direta)
            this.cart = [product];
            this.safeLocalStorageSet(`dito_cart_${this.getUserKey()}`, JSON.stringify(this.cart));
            this.updateCartBadge();

            // Vai direto para o Checkout
            this.setMarketView('checkout');
            this.showNotification("Ingresso adicionado! Escolha a forma de pagamento para entrar na Live.", "info");
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

        async fetchAndRenderProductRating(productId) {
            if (!supabase || this._ratingTableMissing) return; 
            try {
                const { data, error } = await supabase
                    .from('dito_product_ratings')
                    .select('score, username')
                    .eq('product_id', productId);

                const el = document.getElementById('product-avg-rating');
                if (!el) return;

                if (error && (error.status === 404 || error.code === 'PGRST116')) {
                    this._ratingTableMissing = true;
                    el.innerText = "5.0 (Novo Produto)";
                    return;
                }

                const prodRatings = (data || []).map(r => r.score);
                
                // Highlight current user's rating if exists
                if (this.currentUser) {
                    const myRating = (data || []).find(r => r.username === this.currentUser.username);
                    if (myRating) {
                        this.updateStarsUI(myRating.score);
                    }
                }

                if (prodRatings.length > 0) {
                    const avg = (prodRatings.reduce((a, b) => a + b, 0) / prodRatings.length).toFixed(1);
                    el.innerText = `${avg} (${prodRatings.length} avaliações)`;
                } else {
                    el.innerText = "5.0 (Novo Produto)";
                }
            } catch (e) {
                console.warn("Erro ao buscar avaliações:", e);
            }
        },

        updateStarsUI(score) {
            const stars = document.querySelectorAll('[data-pstar]');
            stars.forEach(s => {
                const sVal = parseInt(s.getAttribute('data-pstar'));
                if (sVal <= score) {
                    s.style.color = '#facc15';
                    s.style.fill = '#facc15';
                } else {
                    s.style.color = '#eee';
                    s.style.fill = 'transparent';
                }
            });
        },

        async rateProduct(productId, score) {
            if (!this.currentUser) return;


            // Se clicar na mesma nota, a intenção é "desmarcar" (nota 0)
            const currentSelected = document.querySelectorAll('[data-pstar][style*="facc15"]').length;
            const newScore = (currentSelected === score) ? 0 : score;

            // Feedback visual imediato (Optimistic UI)
            this.updateStarsUI(newScore);

            try {
                const { error } = await supabase
                    .from('dito_product_ratings')
                    .upsert({
                        product_id: productId,
                        username: this.currentUser.username,
                        score: newScore
                    }, { onConflict: 'product_id,username' });

                if (!error) {
                    this.showNotification(newScore === 0 ? 'Avaliação removida.' : 'Avaliado com sucesso!', 'success');
                    this.fetchAndRenderProductRating(productId);
                } else {
                    // Reverte se der erro
                    this.fetchAndRenderProductRating(productId);
                }
            } catch (e) {
                console.error(e);
            }
        },


        renderMarketCheckout(container, templateId = 'template-checkout') {
            const template = document.getElementById(templateId); 
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

            // Adiciona Selo de Garantia / Saque Imediato
            const mainProd = this.cart[0];
            const hasWarranty = mainProd && (mainProd.guarantee === true || mainProd.guarantee === 'true');
            
            const warrantyBadge = document.createElement('div');
            warrantyBadge.style.margin = '20px 0';
            warrantyBadge.style.padding = '12px 16px';
            warrantyBadge.style.borderRadius = '14px';
            warrantyBadge.style.background = hasWarranty ? '#f0fdf4' : '#fffcfc';
            warrantyBadge.style.border = `1px solid ${hasWarranty ? '#dcfce7' : '#fee2e2'}`;
            warrantyBadge.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 12px;">
                    <i data-lucide="${hasWarranty ? 'shield-check' : 'zap'}" style="width: 20px; color: ${hasWarranty ? '#16a34a' : '#ff005c'}; flex-shrink: 0;"></i>
                    <div style="flex: 1;">
                        <p style="font-size: 13px; font-weight: 950; color: #000; margin-bottom: 2px;">${hasWarranty ? 'Compra com Garantia (7 dias)' : 'Venda Final (Entrega Imediata)'}</p>
                        <p style="font-size: 11px; font-weight: 700; color: #666; line-height: 1.3;">
                            ${hasWarranty ? 'Seu dinheiro fica protegido pela plataforma por 7 dias.' : 'Sem garantias de devolução. Saque imediato para o produtor.'}
                        </p>
                    </div>
                </div>
            `;
            list.appendChild(warrantyBadge);
            if (window.lucide) lucide.createIcons();

            const hasPurchased = localStorage.getItem('dito_purchased_products');
            const isFirstPurchase = !(hasPurchased && JSON.parse(hasPurchased).length > 0);
            const key = this.getUserKey();
            const userCoins = parseInt(localStorage.getItem(`dito_coins_${key}`) || '0');
            
            const rewardsSection = document.createElement('div');
            rewardsSection.style.borderTop = '1px solid #f0f0f0';
            rewardsSection.style.marginTop = '16px';
            rewardsSection.style.paddingTop = '16px';
            rewardsSection.innerHTML = `
                <!-- Oferta de primeira compra removida -->


                <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 12px; font-weight: 900; color: #000;">Usar Cupons:</span>
                    <span style="font-size: 11px; font-weight: 800; color: #999;"><span id="coins-to-use-label">0</span>% desconto</span>
                </div>
                </div>
                <input type="range" class="coin-slider" id="coin-discount-slider" min="0" max="${Math.min(userCoins, 75)}" value="0" oninput="app.applyCoinDiscount(this.value)" style="width: 100%; margin-bottom: 8px;">
                <p style="font-size: 9px; color: #ccc; font-weight: 700;">Limite de desconto com cupons: 75%</p>
            `;
            list.appendChild(rewardsSection);

            // 2. Renderiza Ação Final (Botão Pix e Cadastro) em Container Dedicado
            const dynamicActions = document.getElementById('checkout-dynamic-actions');
            if (dynamicActions) {
                dynamicActions.innerHTML = `
                    <div id="pix-payment-actions">
                        ${this.currentUser && this.currentUser.isGuest ? `
                            <div id="checkout-registration-form" style="background: #fff; border: 1px solid #f0f0f0; padding: 20px; border-radius: 20px; margin-top: 10px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                                    <div style="background: #000; color: #fff; width: 24px; height: 24px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900;">1</div>
                                    <h3 style="font-size: 14px; font-weight: 950; color: #000; margin: 0;">CRIAR SUA CONTA DITO</h3>
                                </div>
                                <input type="text" id="reg-checkout-name" placeholder="Seu Nome Completo" style="width: 100%; height: 50px; border-radius: 12px; border: 1px solid #eee; padding: 0 16px; margin-bottom: 12px; font-weight: 700; font-size: 13px;">
                                <input type="text" id="reg-checkout-user" placeholder="Como quer ser chamado (usuário)" style="width: 100%; height: 50px; border-radius: 12px; border: 1px solid #eee; padding: 0 16px; margin-bottom: 12px; font-weight: 700; font-size: 13px;">
                                <input type="password" id="reg-checkout-pass" placeholder="Crie uma Senha" style="width: 100%; height: 50px; border-radius: 12px; border: 1px solid #eee; padding: 0 16px; font-weight: 700; font-size: 13px;">
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding-left: 5px;">
                                <div style="background: #000; color: #fff; width: 24px; height: 24px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900;">2</div>
                                <h3 style="font-size: 14px; font-weight: 950; color: #000; margin: 0;">PAGAMENTO</h3>
                            </div>
                        ` : ''}
                        <button id="btn-pix-checkout" onclick="app.processPaymentCheckout()" style="width: 100%; height: 60px; background: #000; color: #fff; border: none; border-radius: 100px; font-weight: 900; font-size: 14px; margin-top: 0; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                            <i data-lucide="diamond" style="width: 18px;"></i> ${this.currentUser && this.currentUser.isGuest ? 'CADASTRAR E GERAR PIX' : 'GERAR PIX AGORA'}
                        </button>
                    </div>
                `;
            }

            this.paymentMethod = 'pix'; // Reset para Pix

            this.recalculateCheckoutTotal();

            // Sincroniza o preenchimento inicial do slider
            const initSlider = document.getElementById('coin-discount-slider');
            if (initSlider) {
                const max = parseInt(initSlider.max) || 1;
                const pct = (parseInt(initSlider.value) / max) * 100;
                initSlider.style.setProperty('--range-progress', pct + '%');
            }

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

        async unlockPurchasedProducts(productId = null, directProduct = null) {
            this.showNotification("Acesso Liberado!", "success");
            
            // Lógica de descoberta do produto:
            // 1. directProduct (veio do recibo do pagamento)
            // 2. productId (busca na lista local)
            // 3. fallback: usa o carrinho atual (this.cart)
            let productsToUnlock = [];
            
            if (directProduct) {
                productsToUnlock = [directProduct];
            } else if (productId) {
                const found = this.products.find(p => String(p.id) === String(productId));
                productsToUnlock = [found || { name: 'Produto Dito', id: productId }];
            } else {
                productsToUnlock = [...this.cart];
            }

            if (productsToUnlock.length === 0) {
                console.warn("⚠️ [Unlock] Nenhum produto identificado para liberar.");
                return;
            }

            const buyerKey = this.getUserKey();

            for (let product of productsToUnlock) {
                // 0. TRATAMENTO DE VANTAGENS (PRODUTOS VIRTUAIS)
                if (product.type === 'Vantagem') {
                    const key = this.getUserKey();
                    if (product.id.startsWith('VIRTUAL_COINS_')) {
                        const amount = parseInt(product.id.replace('VIRTUAL_COINS_', ''));
                        const current = parseInt(localStorage.getItem(`dito_coins_${key}`) || '0');
                        localStorage.setItem(`dito_coins_${key}`, current + amount);
                        this.showNotification(`+${amount} Cupons adicionados!`, "success");
                    } else if (product.id === 'VIRTUAL_BOOSTER_3X') {
                        const expiry = Date.now() + (24 * 60 * 60 * 1000);
                        localStorage.setItem(`dito_booster_expiry_${key}`, expiry);
                        this.updateBoosterUI();
                        this.showNotification("Reforço 3x Ativado por 24h! 🔥", "success");
                    }
                    this.launchVictoryConfetti();
                    continue; // Vantagens não entram na lista de produtos comprados
                }

                // 1. REGISTRA PARA O COMPRADOR (Com Timestamp para Reembolso)
                if (!this.purchasedProducts.find(p => p.id === product.id)) {
                    this.purchasedProducts.push({ 
                        ...product, 
                        purchased_at: Date.now() 
                    });
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
            
            // SINCRONIZAÇÃO COM A NUVEM (Crucial para não perder o acesso no F5)
            if (supabase && this.currentUser && !this.currentUser.isGuest) {
                console.log("☁️ [Cloud] Sincronizando acesso aos produtos comprados...");
                supabase.from('dito_users').update({ 
                    purchases: this.purchasedProducts 
                }).eq('username', this.currentUser.username).then(() => {
                    console.log("✅ [Cloud] Compras salvas com sucesso!");
                });
            }
            
            setTimeout(() => {
                const wasMentoria = productsToUnlock.some(p => p.type === 'Mentoria');
                if (wasMentoria) {
                    const mentorProduct = productsToUnlock.find(p => p.type === 'Mentoria');
                    this.showNotification("Acesso Liberado!", "success");
                    this.selectedProduct = mentorProduct;
                    setTimeout(() => {
                        this.setMarketView('live-room');
                    }, 1500);
                } else {
                    this.navigate('meus-cursos');
                    this.showNotification("Obrigado pela compra! Acesso liberado.", "success");
                }
            }, 1000);
        },

        async creditSeller(sellerUsername, amount, productName, fullProduct = null) {
            if (!supabase) return;
            try {
                const totalAmount = parseFloat(amount);
                const appFee = totalAmount * 0.03;
                const sellerNet = totalAmount - appFee;

                // 1. CREDITA O VENDEDOR (97%)
                const { data: sellerData } = await supabase.from('dito_users').select('*').eq('username', sellerUsername).maybeSingle();
                if (sellerData) {
                    const isGuaranteed = fullProduct && (fullProduct.guarantee === true || fullProduct.guarantee === 'true');
                    
                    const currentBalance = parseFloat(sellerData.balance || 0);
                    const currentPending = parseFloat(sellerData.pending_balance || 0);
                    
                    let newBalance = currentBalance;
                    let newPending = currentPending;

                    if (isGuaranteed) {
                        newPending = (currentPending + sellerNet).toFixed(2);
                    } else {
                        newBalance = (currentBalance + sellerNet).toFixed(2);
                    }

                    const newSalesTotal = (parseFloat(sellerData.sales || 0) + sellerNet).toFixed(2);
                    let history = [];
                    try { history = sellerData.purchases ? (typeof sellerData.purchases === 'string' ? JSON.parse(sellerData.purchases) : sellerData.purchases) : []; } catch(e) {}
                    history.push({ item: productName, value: sellerNet, timestamp: new Date().toISOString(), type: 'sale', guarantee: isGuaranteed, fee_deducted: appFee.toFixed(2) });

                    await supabase.from('dito_users').update({
                        balance: newBalance,
                        pending_balance: newPending,
                        sales: newSalesTotal,
                        purchases: JSON.stringify(history)
                    }).eq('username', sellerUsername);

                    const msg = isGuaranteed ? 
                        `Você vendeu "${productName}". R$ ${sellerNet.toFixed(2)} em garantia (7 dias).` : 
                        `Venda Realizada! R$ ${sellerNet.toFixed(2)} disponível para saque imediato! 🔥`;

                    this.sendNetworkNotification(sellerUsername, 'venda', isGuaranteed ? 'Venda Garantida 🔒' : 'Dinheiro na Mão! ⚡', msg);
                }

                // 2. NOTIFICA O COMPRADOR (Entrega/Liberação)
                // Buscamos o comprador atual na sessão
                if (this.currentUser) {
                    this.sendNetworkNotification(this.currentUser.username, 'compra_aprovada', 'Pagamento Confirmado! ✅', `Seu acesso ao produto "${productName}" foi liberado.`);
                }

                // 2. CREDITA O ADMIN DITÃO (3%)
                const adminUsername = 'Ditão'; // Nome da sua conta mestre
                const { data: adminData } = await supabase.from('dito_users').select('*').eq('username', adminUsername).maybeSingle();
                if (adminData) {
                    const newAdminBalance = (parseFloat(adminData.balance || 0) + appFee).toFixed(2);
                    let adminHistory = [];
                    try { adminHistory = adminData.purchases ? (typeof adminData.purchases === 'string' ? JSON.parse(adminData.purchases) : adminData.purchases) : []; } catch(e) {}
                    adminHistory.push({ item: `Taxa App: ${productName}`, value: appFee, seller: sellerUsername, timestamp: new Date().toISOString(), type: 'commission' });

                    await supabase.from('dito_users').update({
                        balance: newAdminBalance,
                        purchases: JSON.stringify(adminHistory)
                    }).eq('username', adminUsername);
                    
                    console.log(`💎 [Taxa Dito] R$ ${appFee.toFixed(2)} creditados na conta mestre.`);
                }

            } catch (e) {
                console.error("❌ [Financeiro] Erro no Split de comissão:", e);
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

            list.innerHTML = this.purchasedProducts.map(p => {
                const now = Date.now();
                const purchaseDate = p.purchased_at || now; // Fallback para compras antigas
                const diffTime = now - purchaseDate;
                const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
                // Reembolso permitido apenas para Curso e Ebook dento de 7 dias
                const isRefundable = (diffTime <= sevenDaysMs) && (p.type === 'Curso' || p.type === 'Ebook');
                
                // Calcula dias restantes para o UI
                const daysRemaining = Math.max(0, Math.ceil((sevenDaysMs - diffTime) / (1000 * 60 * 60 * 24)));

                return `
                    <div style="background: #fff; border-radius: 24px; border: 1px solid #eee; padding: 16px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.02); position: relative;">
                        <div style="display: flex; gap: 16px; align-items: center;">
                            <div style="width: 60px; height: 60px; background: #f8f8f8; border-radius: 18px; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="play-circle" style="width: 24px; color: #ccc;"></i>`}
                            </div>
                            <div style="flex: 1; min-width: 0;">
                                <span style="font-size: 8px; font-weight: 900; background: #f5f5f5; padding: 4px 8px; border-radius: 6px; text-transform: uppercase; color: #999; margin-bottom: 4px; display: inline-block;">${p.type || 'Produto'}</span>
                                <h4 style="font-size: 14px; font-weight: 900; color: #000; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</h4>
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <p style="font-size: 10px; color: #22c55e; font-weight: 900;">Acesso Vitalício</p>
                                    ${isRefundable ? `<span style="font-size: 9px; color: #f59e0b; font-weight: 800;">• ${daysRemaining}d para reembolso</span>` : ''}
                                </div>
                            </div>
                            <button onclick="app.openCourse('${p.id}')" style="width: 42px; height: 42px; background: #000; color: #fff; border: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                                <i data-lucide="arrow-right" style="width: 18px;"></i>
                            </button>
                        </div>
                        
                        ${isRefundable ? `
                            <div style="border-top: 1px solid #f9f9f9; padding-top: 12px; display: flex; justify-content: flex-start;">
                                <button onclick="app.requestRefund('${p.id}')" style="background: none; border: none; color: #999; font-size: 10px; font-weight: 800; padding: 0; cursor: pointer; display: flex; align-items: center; gap: 4px; text-decoration: underline;">
                                    <i data-lucide="refresh-cw" style="width: 10px;"></i> Solicitar Reembolso (Garantia Dito)
                                </button>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
            if (window.lucide) lucide.createIcons();
        },

        async requestRefund(id) {
            const product = this.purchasedProducts.find(p => p.id === id);
            if (!product) return;

            if (product.type === 'Mentoria') {
                this.showNotification("🚫 Consultorias e Mentorias não são elegíveis para reembolso automático.", "error");
                return;
            }

            const confirmRefund = confirm(`Deseja solicitar o reembolso de "${product.name}"?\n\nO acesso será removido imediatamente e o valor será estornado conforme a política de 7 dias.`);
            
            if (confirmRefund) {
                this.showLoading(true, "Processando estorno...");
                
                try {
                    // 1. Remove do array local
                    this.purchasedProducts = this.purchasedProducts.filter(p => p.id !== id);
                    const buyerKey = this.getUserKey();
                    this.safeLocalStorageSet(`dito_purchased_products_${buyerKey}`, JSON.stringify(this.purchasedProducts));
                    
                    // 2. Simula reversão financeira (Logs apenas neste MVP)
                    console.log(`💸 [Reembolso] Estornando R$ ${product.price} para o comprador.`);
                    
                    setTimeout(() => {
                        this.showLoading(false);
                        this.showNotification("Reembolso solicitado com sucesso! ✅", "success");
                        this.renderPurchasedProducts();
                    }, 1500);
                } catch (e) {
                    console.error("Erro ao processar reembolso:", e);
                    this.showLoading(false);
                    this.showNotification("Erro ao processar reembolso.", "error");
                }
            }
        },

        openCourse(id) {
            // Busca nas compras ou, se for o dono, busca na vitrine global
            let product = this.purchasedProducts.find(p => p.id === id);
            
            if (!product) {
                const globalP = this.products.find(p => p.id === id);
                const isOwner = globalP && (globalP.seller === this.currentUser?.username || globalP.author === this.currentUser?.username);
                if (isOwner) product = globalP;
            }

            this.activeCourse = product;
            if (this.activeCourse) {
                if (this.activeCourse.type === 'Mentoria') {
                    this.accessLiveDirectly(id);
                    return;
                }
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
                contentArea.innerHTML = `<div style="text-align: center;"><i data-lucide="users" style="width: 60px; margin-bottom: 12px;"></i><p style="font-weight: 900; font-size: 14px;">MENTORIA AO VIVO</p><button onclick="app.enterMentorshipRoom('${course.id}')" style="margin-top: 16px; background: #ee4d2d; color: #fff; border: none; padding: 12px 28px; border-radius: 30px; font-weight: 900; font-size: 12px; cursor: pointer; text-transform: uppercase;">Entrar na Sala</button></div>`;
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
                                        ${this.currentLessonId === l.id ? '<i data-lucide="play" style="width: 14px; color: #fff;"></i>' : ''}
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
            const pod1 = document.getElementById('hall-1st-podium'); 
            const firstAvatar = document.getElementById('hall-1st-avatar');
            const firstName = document.getElementById('hall-1st-name');
            const firstSales = document.getElementById('hall-1st-sales');
            
            if (!listTop) return;

            // Prioriza Memória (Sincronia RAM)
            const users = this.networkUsers && this.networkUsers.length > 0 ? this.networkUsers : JSON.parse(localStorage.getItem('dito_usuarios') || '[]');
            
            if (users.length === 0) {
                if (firstName) firstName.innerText = "Conectando...";
                listTop.innerHTML = `<div style="text-align: center; padding: 40px;"><p style="color: #ccc; font-weight: 800; font-size: 11px;">Buscando competidores...</p></div>`;
                this.fetchNetworkUsers();
                return;
            }

            // Busca usuários e calcula vendas baseadas no CICLO 30 DIAS
            const now = Date.now();
            const sortedRank = users.map(u => {
                let salesHistory = [];
                const userKey = u.username || u.id; // Chave para identificar o dono do histórico
                
                try {
                    // Se for o usuário atual, usa o histórico local com o sufixo correto
                    if (this.currentUser && u.username === this.currentUser.username) {
                        const storageKey = `dito_real_sales_history_${this.getUserKey()}`;
                        salesHistory = JSON.parse(localStorage.getItem(storageKey) || '[]');
                    } else {
                        // Para outros, tenta pegar o que veio do banco (vendas globais)
                        salesHistory = u.sales_history ? (typeof u.sales_history === 'string' ? JSON.parse(u.sales_history) : u.sales_history) : [];
                    }
                } catch(e) {}

                // Cálculo robusto: Vendas dos últimos 30 dias (ms)
                const cycleSum = Array.isArray(salesHistory) ? salesHistory.reduce((acc, s) => {
                    const diffDays = (now - new Date(s.timestamp || now).getTime()) / (1000 * 60 * 60 * 24);
                    if (diffDays <= 30) return acc + (Number(s.value) || 0);
                    return acc;
                }, 0) : Number(u.sales || 0);

                // Se o usuário ainda resultar em 0 mas tiver saldo no banco, usa o campo fixo de segurança
                const finalSales = (cycleSum === 0 && u.sales > 0) ? u.sales : cycleSum;

                return {
                    ...u,
                    sales: finalSales,
                    username: u.username || 'membro_pro',
                    avatar: u.avatar || ''
                };
            }).sort((a,b) => b.sales - a.sales);

            const winner = sortedRank[0];
            const others = sortedRank.slice(1, 100); // Exibe do 2º ao 100º lugar!

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
                    rankLabel.innerText = `Você é o ${sortedRank.length + 1}º (Novo Membro)`;
                } else {
                    rankLabel.innerText = 'Entre para entrar no ranking';
                }
            }

            if (window.lucide) lucide.createIcons();
        },

        showSystemNotification(title, message, type = 'info') {
            let container = document.querySelector('.system-notif-container');
            if (!container) {
                container = document.createElement('div');
                container.className = 'system-notif-container';
                document.body.appendChild(container);
            }

            const notif = document.createElement('div');
            notif.className = 'system-notif';
            
            let badgeIcon = 'bell';
            let badgeBg = '#000';
            if (type === 'sale') { badgeIcon = 'shopping-bag'; badgeBg = '#22c55e'; }
            if (type === 'fan') { badgeIcon = 'star'; badgeBg = '#ff005c'; }
            if (type === 'error') { badgeIcon = 'alert-circle'; badgeBg = '#ef4444'; }
            if (type === 'success') { badgeIcon = 'check-circle'; badgeBg = '#22c55e'; }

            notif.innerHTML = `
                <div class="system-notif-icon" style="position: relative; background: transparent; overflow: visible;">
                    <img src="D.png" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px; border: 1px solid #f0f0f0;">
                    <div style="position: absolute; bottom: -4px; right: -4px; width: 22px; height: 22px; background: ${badgeBg}; border-radius: 50%; border: 2px solid #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                        <i data-lucide="${badgeIcon}" style="width: 12px; color: #fff;"></i>
                    </div>
                </div>
                <div class="system-notif-content">
                    <div class="system-notif-title">${title}</div>
                    <div class="system-notif-desc">${message}</div>
                </div>
            `;

            container.appendChild(notif);
            if (window.lucide) lucide.createIcons();

            setTimeout(() => notif.classList.add('show'), 10);
            
            if (type === 'sale' && navigator.vibrate) {
                navigator.vibrate([100, 50, 200]);
            } else if (navigator.vibrate) {
                navigator.vibrate(50);
            }

            setTimeout(() => {
                notif.classList.remove('show');
                setTimeout(() => notif.remove(), 500);
            }, 6000);
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
                // Notificação de Memória (Opcional - Debug)
                console.log("🚀 Mudando de Tela:", view);
                
                if (view === 'login') console.trace("RASTREIO DE LOGIN:");
                
                // Controle da Barra de Progresso Global
                const progressContainer = document.getElementById('product-progress-container');
                if (progressContainer) {
                    progressContainer.style.display = (view === 'criar-produto') ? 'flex' : 'none';
                }

                const isLoggedIn = localStorage.getItem('is_logged_in_vanilla') === 'true';
                
                // Reset do modo checkout se navegar para fora do mercado e do checkout direto
                if (view !== 'mercado' && view !== 'checkout-direto') {
                    this.isProcessingDeepLink = false;
                }

                // Checkout direto NUNCA exige login
                if (!isLoggedIn && (view !== 'login' && view !== 'cadastro' && view !== 'mercado' && view !== 'checkout-direto')) {
                    view = 'login';
                }

                // FORÇA VOLTA PARA A HOME DO MERCADO SE CLICAR NO MENU (Evita o "vício" do checkout)
                if (view === 'mercado' && !this.isProcessingDeepLink) {
                    this.marketView = 'home';
                }

                this.currentView = view;
                this.checkLiveAdminStatus();

                // Salva o estado para restaurar no F5
                if (view !== 'login' && view !== 'cadastro') {
                    localStorage.setItem('dito_last_view', view);
                }


                // Sincroniza com o Histórico do Navegador (Botão Voltar do Celular)
                if (!direction || direction !== 'popstate') {
                    if (window.location.protocol !== 'file:') {
                        const state = { view: view };
                        window.history.pushState(state, '', '');
                    }
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
                let template = document.getElementById(`template-${view}`);
                if (!template) {
                    console.warn("Template não encontrado, redirecionando para dashboard:", view);
                    view = 'dashboard';
                    template = document.getElementById('template-dashboard');
                }
                
                if (template) {
                    // Limpeza de Espaço em Tempo Real (Memória/DOM)
                    appContainer.innerHTML = ''; 
                    
                    // Otimização de Storage Proativa
                    this.optimizeStorageOnNavigation();
                    
                    appContainer.innerHTML = template.innerHTML;
                } else {
                    console.error("Erro crítico: Template do Dashboard não encontrado!");
                    return;
                }

                // Chamadas lógicas específicas de cada tela
                switch(view) {
                    case 'dashboard': 
                        this.updateBalanceUI(); 
                        // Movimento automático desativado conforme solicitado
                        // this.startEventsCarousel();
                        break;
                    case 'mercado': setTimeout(() => this.renderStore(), 10); break;
                    case 'sociedade': this.fetchSocieties(); break;
                case 'sociedade-detalhe': this.renderSocietyDetail(); break;
                    case 'hall': this.renderHallOfFame(); break;
                    case 'perfil': this.renderProfile(); break;
                    case 'vendas': this.renderSales(); break;
                    case 'sacar': this.updateWithdrawUI(); break;
                    case 'admin-contas': this.renderAdminUsers(); break;
                    case 'admin-produtos': this.renderAdminProducts(); break;
                    case 'produtos': this.renderMyProducts(); break;
                    case 'meus-cursos': this.renderPurchasedProducts(); break;
                    case 'curso-player': this.renderCoursePlayer(); break;
                    case 'missoes': this.renderMissions(); break;
                    case 'loja-cupons': this.renderLojaCupons(appContainer); break;
                    case 'links': this.renderLinks(); break;
                    case 'checkout-direto': this.renderMarketCheckout(appContainer, 'template-checkout-direto'); break;
                    case 'admin-painel-unificado': break;
                }

                // Atualiza Barra de Navegação Global e Header
                const nav = document.getElementById('global-nav');
                const header = document.getElementById('global-header');
                const downloadLink = document.getElementById('download-app-link');
                const isAuthPage = view === 'login' || view === 'cadastro';
                const isCheckoutPage = view === 'checkout-direto';
                
                if (nav) {
                    nav.style.display = (isAuthPage || isCheckoutPage) ? 'none' : 'flex';
                    nav.querySelectorAll('.nav-item').forEach(item => {
                        const targetView = item.getAttribute('data-view');
                        const icon = item.querySelector('i');
                        if (targetView === view) {
                            item.classList.add('active-nav');
                        } else {
                            item.classList.remove('active-nav');
                        }
                    });
                }
                
                const worldChatBtn = document.getElementById('btn-world-chat');
                const missionsBtn = document.getElementById('btn-missions');
                const liveBtn = document.getElementById('btn-live-admin');

                if (worldChatBtn) worldChatBtn.style.display = isAuthPage ? 'none' : 'flex';
                if (missionsBtn) missionsBtn.style.display = isAuthPage ? 'none' : 'flex';
                
                // Re-calcula status do admin para o botão de live
                this.checkLiveAdminStatus();

                
                if (header) {
                    const isMercado = view === 'mercado';
                    header.style.display = (isAuthPage || isCheckoutPage) ? 'none' : 'flex';
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
            if (view === 'home') {
                this.isProcessingDeepLink = false;
            }
            this.marketView = view;
            this.renderStore();
        },

        async fetchSocieties() {
            try {
                const { data, error } = await supabase.from('dito_societies').select('*').order('created_at', { ascending: false });
                if (error) throw error;
                
                // Salva no cache e renderiza
                localStorage.setItem('dito_societies', JSON.stringify(data || []));
                this.renderSocieties(data || []);
            } catch (e) {
                if (e.code === 'PGRST205') {
                    console.warn("Tabela 'dito_societies' não encontrada. Rodar SQL de conserto.");
                } else {
                    console.warn("DB offline, usando local:", e);
                }
                const local = JSON.parse(localStorage.getItem('dito_societies') || '[]');
                this.renderSocieties(local);
            }
        },

        renderSocieties(data = null) {
            const list = document.getElementById('societies-list');
            if (!list) return;

            const saved = data || JSON.parse(localStorage.getItem('dito_societies') || '[]');
            
            // FILTRO DE EXCLUSIVIDADE: 
            // Se eu já sou dono de uma sociedade ou entrei em uma, só mostro ela (escondo as outras)
            let displayList = saved;
            if (this.currentUser) {
                const myGroups = JSON.parse(localStorage.getItem('my_societies') || '[]');
                const joinedOrAdmin = saved.filter(s => s.owner === this.currentUser.username || myGroups.includes(s.id));
                
                if (joinedOrAdmin.length > 0) {
                    displayList = joinedOrAdmin;
                }
            }

            if (displayList.length === 0) {
                list.innerHTML = `<div style="text-align: center; padding: 40px; color: #ccc; font-weight: 800; font-size: 13px;">Nenhuma sociedade encontrada.<br><span style="font-size: 10px; font-weight: 500;">Crie a primeira agora!</span></div>`;
                return;
            }

            list.innerHTML = displayList.map(s => {
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
            
            // Solicitações Pendentes (Somente ADM vê esta aba extra)
            const adminTab = document.getElementById('tab-soc-admin');
            if (adminTab) adminTab.style.display = isAdmin ? 'flex' : 'none';

            if (isMember) {
                document.getElementById('soc-content-mural').style.display = 'block';
                document.getElementById('soc-content-membros').style.display = 'none';
                document.getElementById('soc-content-admin').style.display = 'none';
                document.getElementById('soc-join-section').style.display = 'none';
                this.fetchSocietyMural();
            } else {
                // Sincroniza status do pedido com Supabase
                const { data: pendingReq } = await supabase.from('dito_society_requests')
                    .select('id')
                    .eq('society_id', this.currentSocietyId)
                    .eq('username', this.currentUser.username)
                    .maybeSingle();
                
                document.getElementById('soc-content-mural').style.display = 'none';
                document.getElementById('soc-content-membros').style.display = 'none';
                document.getElementById('soc-content-admin').style.display = 'none';
                document.getElementById('soc-join-section').style.display = 'block';

                const joinBtn = document.getElementById('btn-society-join');
                if (joinBtn) {
                    if (pendingReq) {
                        joinBtn.innerText = 'SOLICITAÇÃO EM ANÁLISE';
                        joinBtn.style.background = '#f5f5f5';
                        joinBtn.style.color = '#999';
                        joinBtn.disabled = true;
                    } else {
                        joinBtn.innerText = 'PEDIR PARA PARTICIPAR';
                        joinBtn.style.background = '#000';
                        joinBtn.style.color = '#fff';
                        joinBtn.disabled = false;
                        joinBtn.onclick = () => this.requestToJoinSociety(soc.id);
                    }
                }
            }
            if (window.lucide) lucide.createIcons();
            if (isAdmin) this.fetchSocietyRequests();
        },

        async fetchSocietyRequests() {
            const list = document.getElementById('soc-admin-list');
            if (!list) return;

            try {
                const { data, error } = await supabase
                    .from('dito_society_requests')
                    .select('*')
                    .eq('society_id', this.currentSocietyId);
                
                if (error) throw error;

                if (!data || data.length === 0) {
                    list.innerHTML = `<p style="text-align: center; color: #ccc; font-size: 11px; padding: 20px;">Nenhuma solicitação pendente.</p>`;
                    return;
                }

                list.innerHTML = data.map(req => `
                    <div style="background: #fff; padding: 16px; border-radius: 20px; border: 1px solid #f5f5f5; display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 36px; height: 36px; border-radius: 50%; background: #f9f9f9; overflow: hidden; border: 1px solid #eee;">
                                ${req.avatar ? `<img src="${req.avatar}" style="width:100%;height:100%;object-fit:cover;">` : `<i data-lucide="user" style="width:16px;"></i>`}
                            </div>
                            <div>
                                <p style="font-weight: 950; font-size: 13px; color: #000;">${req.username}</p>
                                <p style="font-size: 9px; font-weight: 800; color: #ccc; text-transform: uppercase;">QUER ENTRAR</p>
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="app.handleSocietyRequest('${req.id}', 'reject')" style="width: 36px; height: 36px; border-radius: 50%; background: #fff; border: 1px solid #fee2e2; color: #ef4444; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                <i data-lucide="x" style="width: 16px;"></i>
                            </button>
                            <button onclick="app.handleSocietyRequest('${req.id}', 'approve')" style="width: 36px; height: 36px; border-radius: 50%; background: #000; color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                                <i data-lucide="check" style="width: 16px;"></i>
                            </button>
                        </div>
                    </div>
                `).join('');
                if (window.lucide) lucide.createIcons();
            } catch (e) { console.error(e); }
        },

        async handleSocietyRequest(requestId, action) {
            try {
                const { data: reqData } = await supabase.from('dito_society_requests').select('*').eq('id', requestId).single();
                if (!reqData) return;

                if (action === 'approve') {
                    // 1. Busca dados ATUAIS da sociedade no banco
                    const { data: socDb } = await supabase.from('dito_societies').select('*').eq('id', reqData.society_id).single();
                    if (!socDb) return;

                    let currentMembers = socDb.members || [];
                    if (!Array.isArray(currentMembers)) currentMembers = [];
                    
                    if (!currentMembers.includes(reqData.username)) {
                        currentMembers.push(reqData.username);
                        const newCount = (socDb.membersCount || currentMembers.length);
                        
                        // 2. Atualiza no Banco (Usa RPC ou Update direto)
                        await supabase.from('dito_societies').update({ 
                            members: currentMembers, 
                            membersCount: currentMembers.length 
                        }).eq('id', socDb.id);
                    }
                    
                    this.sendNetworkNotification(reqData.username, 'society', `Aprovado na Sociedade! 🎉`, `Gestor aceitou seu pedido. Bem-vindo!`);
                    this.showNotification("Membro aprovado com sucesso!", "success");
                }

                await supabase.from('dito_society_requests').delete().eq('id', requestId);
                this.fetchSocietyRequests();
                this.fetchSocietyMembers(); // Recarrega lista
            } catch (e) { this.showNotification("Erro ao processar.", "error"); }
        },

        async requestToJoinSociety(id) {
            if (!this.currentUser) return this.showNotification("Login necessário.", "error");
            
            const societies = JSON.parse(localStorage.getItem('dito_societies') || '[]');
            const soc = societies.find(s => s.id === id);
            
            try {
                const request = {
                    id: Date.now().toString(),
                    society_id: id,
                    username: this.currentUser.username,
                    avatar: this.currentUser.avatar || "",
                    created_at: new Date().toISOString()
                };

                await supabase.from('dito_society_requests').insert([request]);
                
                if (soc && soc.owner) {
                    this.sendNetworkNotification(soc.owner, 'society_request', `${this.currentUser.username} quer entrar!`, `Alguém pediu acesso à sua sociedade "${soc.name}".`);
                }

                this.showNotification("Solicitação enviada ao Gestor!", "success");
                this.renderSocietyDetail();
            } catch (e) { this.showNotification("Erro ao enviar pedido.", "error"); }
        },

        setSocTab(tab) {
            this.currentSocietyTab = tab;
            const isMural = tab === 'mural';
            const isMembros = tab === 'membros';
            const isAdmin = tab === 'admin';

            document.getElementById('soc-content-mural').style.display = isMural ? 'block' : 'none';
            document.getElementById('soc-content-membros').style.display = isMembros ? 'block' : 'none';
            document.getElementById('soc-content-admin').style.display = isAdmin ? 'block' : 'none';
            
            if (document.getElementById('tab-soc-mural')) document.getElementById('tab-soc-mural').classList.toggle('active-tab', isMural);
            if (document.getElementById('tab-soc-membros')) document.getElementById('tab-soc-membros').classList.toggle('active-tab', isMembros);
            if (document.getElementById('tab-soc-admin')) document.getElementById('tab-soc-admin').classList.toggle('active-tab', isAdmin);
            
            if (isMembros) this.fetchSocietyMembers();
            if (isAdmin) this.fetchSocietyRequests();
        },

        fetchSocietyRequests() {
            const list = document.getElementById('soc-admin-list');
            if (!list) return;

            const requests = JSON.parse(localStorage.getItem('society_requests') || '[]')
                            .filter(r => r.society_id === this.currentSocietyId);

            if (requests.length > 0) {
                list.innerHTML = requests.map(r => `
                    <div style="background: #fff; border: 1px solid #eee; border-radius: 20px; padding: 16px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 40px; height: 40px; background: #000; color: #fff; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 950; font-size: 14px;">${r.username[0].toUpperCase()}</div>
                            <div>
                                <h4 style="font-size: 14px; font-weight: 900; color: #000;">${r.username}</h4>
                                <span style="font-size: 9px; color: #bbb; font-weight: 800;">PEDIDO EM ${new Date(r.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button onclick="app.processJoinRequest('${r.username}', true)" style="width: 36px; height: 36px; background: #10b981; color: #fff; border: none; border-radius: 50%; cursor: pointer;"><i data-lucide="check" style="width: 18px; margin: 0 auto;"></i></button>
                            <button onclick="app.processJoinRequest('${r.username}', false)" style="width: 36px; height: 36px; background: #ef4444; color: #fff; border: none; border-radius: 50%; cursor: pointer;"><i data-lucide="x" style="width: 18px; margin: 0 auto;"></i></button>
                        </div>
                    </div>
                `).join('');
            } else {
                list.innerHTML = `<div style="text-align: center; padding: 40px; color: #ccc; font-weight: 900; font-size: 12px;">Nenhuma solicitação pendente.</div>`;
            }
            if (window.lucide) lucide.createIcons();
        },

        processJoinRequest(username, approve) {
            let requests = JSON.parse(localStorage.getItem('society_requests') || '[]');
            requests = requests.filter(r => !(r.society_id === this.currentSocietyId && r.username === username));
            this.safeLocalStorageSet('society_requests', JSON.stringify(requests));

            if (approve) {
                // Adiciona aos membros (no storage local da sociedade)
                const socList = JSON.parse(localStorage.getItem('dito_societies') || '[]');
                const soc = socList.find(s => s.id === this.currentSocietyId);
                if (soc) {
                    if (!soc.members) soc.members = [];
                    if (!soc.members.includes(username)) {
                        soc.members.push(username);
                        soc.membersCount = (soc.membersCount || 0) + 1;
                    }
                    this.safeLocalStorageSet('dito_societies', JSON.stringify(socList));
                }
                this.showNotification(`Usuário @${username} aprovado!`, "success");
            } else {
                this.showNotification(`Solicitação de @${username} recusada.`, "info");
            }

            this.fetchSocietyRequests();
        },

        kickMember(username) {
            if (!confirm(`Tem certeza que deseja expulsar @${username}?`)) return;

            const socList = JSON.parse(localStorage.getItem('dito_societies') || '[]');
            const soc = socList.find(s => s.id === this.currentSocietyId);
            if (soc && soc.members) {
                soc.members = soc.members.filter(m => m !== username);
                soc.membersCount = Math.max(0, (soc.membersCount || 1) - 1);
                this.safeLocalStorageSet('dito_societies', JSON.stringify(socList));

                this.showNotification(`@${username} foi removido da sociedade.`, "info");
                this.fetchSocietyMembers();
            }
        },

        inviteToSociety() {
            const url = window.location.origin + "?soc=" + this.currentSocietyId;
            navigator.clipboard.writeText(url).then(() => {
                this.showNotification("Link de convite copiado! Quem clicar pedirá acesso.", "success");
            });
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
            this.safeLocalStorageSet('society_mural_posts', JSON.stringify(posts));
            
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

        async deleteMySociety() {
            if (!this.currentSocietyId) return;
            if (!confirm("⚠️ ATENÇÃO: Esta ação é permanente. Deseja realmente EXCLUIR sua sociedade e remover todos os posts e membros?")) return;

            try {
                // 1. Remove do Supabase
                const { error: err1 } = await supabase.from('dito_societies').delete().eq('id', this.currentSocietyId);
                const { error: err2 } = await supabase.from('dito_society_requests').delete().eq('society_id', this.currentSocietyId);
                
                if (err1) throw err1;

                // 2. Atualiza LocalStorage (Remove da lista global)
                let allSocs = JSON.parse(localStorage.getItem('dito_societies') || '[]');
                allSocs = allSocs.filter(s => s.id !== this.currentSocietyId);
                localStorage.setItem('dito_societies', JSON.stringify(allSocs));

                // 3. Me remove de 'my_societies' caso eu estivesse nela
                let myGroups = JSON.parse(localStorage.getItem('my_societies') || '[]');
                myGroups = myGroups.filter(id => id !== this.currentSocietyId);
                localStorage.setItem('my_societies', JSON.stringify(myGroups));

                this.showNotification("Sociedade excluída com sucesso.", "success");
                this.navigate('sociedade');
                this.fetchNetworkSocieties(); // Recarrega do banco para garantir sincronia
            } catch (e) {
                console.error(e);
                this.showNotification("Erro ao excluir sociedade.", "error");
            }
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
            // BLOQUEIO: Apenas 1 Sociedade por pessoa
            const allSocs = JSON.parse(localStorage.getItem('dito_societies') || '[]');
            const myGroups = JSON.parse(localStorage.getItem('my_societies') || '[]');
            const isAlreadyManaged = allSocs.some(s => s.owner === this.currentUser?.username);
            const isAlreadyMember = myGroups.length > 0;

            if (isAlreadyManaged || isAlreadyMember) {
                const motive = isAlreadyManaged ? "Você já possui uma sociedade ativa." : "Você já participa de uma sociedade.";
                this.showNotification(`${motive} Saia ou exclua a atual para criar uma nova.`, "error");
                return;
            }

            const nameEl = document.getElementById('new-soc-name');
            const feeEl = document.getElementById('new-soc-fee');
            
            const name = nameEl.value.trim();
            const fee = parseFloat(feeEl.value) || 0;

            if (!name) {
                this.showNotification("Dê um nome para sua sociedade.", "error");
                return;
            }

            if (confirm(`Deseja criar a sociedade "${name}" gratuitamente?`)) {
                const newSociety = {
                    id: Date.now().toString(),
                    name: name,
                    description: "Ecossistema pro criado via App Dito.",
                    owner: this.currentUser?.username || "Anônimo",
                    entryFee: fee,
                    membersCount: 1,
                    created_at: new Date().toISOString()
                };
                
                // Sincroniza com a nuvem (Supabase) para todos os celulares verem
                supabase.from('dito_societies').insert([newSociety]).then(({ error }) => {
                    if (error) {
                        console.error(error);
                        if (error.code === 'PGRST205') {
                            this.showNotification("Erro: Tabelas de Sociedade ausentes. Execute o SQL de conserto no painel Supabase.", "error");
                        } else {
                            this.showNotification("Erro ao sincronizar. Verifique sua conexão.", "error");
                        }
                    } else {
                        this.showNotification("Sociedade criada e sincronizada!", "success");
                        this.fetchSocieties(); // Recarrega do banco
                        this.toggleCreateSocietyModal(false);
                    }
                });

                // Limpar campos
                nameEl.value = '';
                feeEl.value = '0';
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
            this.renderSalesRuler(days);
            this.renderSalesHistory(realSales.filter(s => s.isSale).sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 15));

            if (window.lucide) lucide.createIcons();
        },

        renderSalesRuler(days) {
            const ruler = document.getElementById('sales-chart-ruler');
            if (!ruler) return;
            
            let steps = [];
            if (days === 30) {
                // De 3 em 3 dias
                for (let i = 1; i <= 30; i += 3) steps.push({ val: i, label: (i < 10 ? '0' : '') + i });
                if (steps[steps.length - 1].val !== 30) steps.push({ val: 30, label: '30' });
            } else if (days === 60) {
                // De 10 em 10 dias
                for (let i = 10; i <= 60; i += 10) steps.push({ val: i, label: i + 'd' });
            } else if (days === 90) {
                // De 2 em 2 meses (60 dias e 90 dias)
                steps = [
                    { val: 30, label: '1 MÊS', ghost: true }, 
                    { val: 60, label: '2 MESES' }, 
                    { val: 90, label: '3 MESES' }
                ];
            }
            
            ruler.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-end; padding: 0 4px; position: relative;">
                    ${steps.map((s, i) => `
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; opacity: ${s.ghost ? '0' : '1'}; height: ${s.ghost ? '0' : 'auto'}; pointer-events: none;">
                            <div style="width: 1px; height: ${i % 2 === 0 ? '8px' : '4px'}; background: ${i % 2 === 0 ? '#eee' : '#f5f5f5'};"></div>
                            <span style="font-size: 8px; font-weight: ${i % 2 === 0 ? '950' : '800'}; color: ${i % 2 === 0 ? '#000' : '#ccc'}; white-space: nowrap;">${s.label}</span>
                        </div>
                    `).join('')}
                </div>
            `;
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
            this.checkMissionAlerts(); // Verifica conquistas na hora

            this.showNotification("Venda simulada com sucesso!", "success");
            this.launchVictoryConfetti();
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
                        <div style="width: 40px; height: 40px; background: transparent; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #000;">
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
            
            const genderInp = document.getElementById('edit-gender');
            if (genderInp) genderInp.value = this.currentUser.gender || 'none';
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
                
                const newGender = document.getElementById('edit-gender') ? document.getElementById('edit-gender').value : 'none';
                this.currentUser.gender = newGender;
                
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

        renderAdminUsers(skipFetch = false) {
            const list = document.getElementById('admin-users-list');
            if (!list) return;

            // Usa a lista em memória (muito mais rápido e sem bug de Quota)
            const usuarios = this.networkUsers && this.networkUsers.length > 0 ? this.networkUsers : JSON.parse(localStorage.getItem('dito_usuarios') || '[]');
            
            if (usuarios.length === 0 && !skipFetch) {
                list.innerHTML = `<p style="text-align: center; color: #999; font-weight: 800; padding: 40px;">Buscando usuários na rede...</p>`;
                this.fetchNetworkUsers();
                return;
            }

            list.innerHTML = usuarios.map(user => `
                <div style="background: #fff; border: 1px solid #f2f2f2; border-radius: 24px; padding: 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                    <div style="display: flex; gap: 14px; align-items: center;">
                        <div style="width: 46px; height: 46px; border-radius: 50%; overflow: hidden; background: #f5f5f5; border: 1px solid #eee; display: flex; align-items: center; justify-content: center;">
                            <img src="${this.rGetPImage(user.avatar, user.username)}" style="width: 100%; height: 100%; object-fit: cover;">
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

        renderAdminProducts() {
            const list = document.getElementById('admin-products-list');
            if (!list) return;

            // Busca produtos usando a mesma lógica consolidada da vitrine para garantir sincronia
            const p1 = JSON.parse(localStorage.getItem('dito_products') || '[]');
            const p2 = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
            const p3 = JSON.parse(localStorage.getItem('dito_market_products') || '[]');
            let allProducts = [...p1, ...p2, ...p3].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
            
            if (allProducts.length === 0) {
                list.innerHTML = `<p style="text-align: center; color: #999; font-weight: 800; padding: 40px;">Buscando produtos na rede...</p>`;
                this.fetchNetworkProducts();
                return;
            }

            list.innerHTML = allProducts.map(p => {
                const safeName = (p.name || '').replace(/'/g, "\\'");
                // Garantimos que o ID seja passado como string segura
                const pId = String(p.id);
                return `
                <div id="admin-prod-${pId}" style="background: #fff; border: 1px solid #f2f2f2; border-radius: 20px; padding: 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                    <div style="display: flex; gap: 14px; align-items: center;">
                        <div style="width: 54px; height: 54px; border-radius: 12px; overflow: hidden; background: #f9f9f9; border: 1px solid #eee; display: flex; align-items: center; justify-content: center;">
                            ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="package" style="width: 20px; color: #ccc;"></i>`}
                        </div>
                        <div style="max-width: 180px;">
                            <h4 style="font-weight: 900; font-size: 13px; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</h4>
                            <p style="font-size: 10px; font-weight: 800; color: #ccc; margin-top: 2px;">Vendedor: @${p.seller || 'admin'} • R$ ${(parseFloat(p.price || 0)).toFixed(2)}</p>
                        </div>
                    </div>
                    <button onclick="app.deleteProduct('${pId}', '${safeName}')" style="width: 40px; height: 40px; background: #fee2e2; color: #ef4444; border: none; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                        <i data-lucide="trash-2" style="width: 18px;"></i>
                    </button>
                </div>
            `}).join('');
            if (window.lucide) lucide.createIcons();
        },

        async deleteProduct(id, name) {
            console.log("🗑️ Tentando deletar produto ID:", id);
            
            if (confirm(`Ditão, tem certeza que deseja EXCLUIR permanentemente o produto "${name}" da loja?`)) {
                this.showLoading(true, 'Removendo da loja...');
                
                try {
                    // 1. OTIMISTA: Remove instantaneamente da interface e do cache local
                    const allKeys = ['dito_products', 'dito_products_vanilla', 'dito_market_products', 'dito_network_products'];
                    allKeys.forEach(key => {
                        try {
                            let listString = localStorage.getItem(key);
                            if (listString) {
                                let list = JSON.parse(listString);
                                if (Array.isArray(list)) {
                                    const newList = list.filter(p => p && String(p.id) !== String(id));
                                    localStorage.setItem(key, JSON.stringify(newList));
                                }
                            }
                        } catch(e) { console.error("Erro ao limpar key:", key, e); }
                    });

                    // Limpa do estado em memória
                    if (Array.isArray(this.products)) {
                        this.products = this.products.filter(p => String(p.id) !== String(id));
                    }
                    
                    // Esconde o elemento da tela na hora pelo ID manual para garantir visibilidade
                    const card = document.getElementById(`admin-prod-${id}`);
                    if (card) card.style.display = 'none';

                    // Força redesenho instantâneo das abas de produtos
                    if (this.currentView === 'mercado' && this.marketView === 'home') this.renderMarketHome();
                    if (this.currentView === 'admin-produtos') this.renderAdminProducts();
                    if (this.currentView === 'produtos') this.renderMyProducts();

                    // 2. Exclui de forma verdadeira no Servidor Supabase
                    if (supabase) {
                        const { error } = await supabase
                            .from('dito_market_products')
                            .delete()
                            .eq('id', id);
                        
                        if (error) {
                            console.error("Erro Supabase na exclusão:", error);
                            alert("Erro no servidor ao apagar: " + error.message);
                        }
                    }

                    this.showNotification(`O produto "${name}" foi apagado.`);
                    localStorage.setItem('dito_last_p_hash', ''); // Reseta hash para forçar refresh limpo

                } catch (e) {
                    console.error("Erro fatal ao deletar:", e);
                    alert("Erro interno: " + e.message);
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
                if (document.getElementById('edit-profile-gender')) document.getElementById('edit-profile-gender').value = this.currentUser.gender || 'none';
                
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
            const notif = { remove: () => {} }; // Mock para não quebrar o código posterior
            setTimeout(async () => {
                // Atualiza o objeto do usuário
                const newEmail = document.getElementById('edit-profile-email') ? document.getElementById('edit-profile-email').value.trim() : this.currentUser.email;
                this.currentUser.name = newName;
                this.currentUser.bio = newBio;
                this.currentUser.link = newLink;
                
                const newGender = document.getElementById('edit-profile-gender') ? document.getElementById('edit-profile-gender').value : 'none';
                this.currentUser.gender = newGender;
                
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
                
                // Busca dados atualizados do banco global
                const usersDB = JSON.parse(localStorage.getItem('dito_users_db') || '[]');
                const freshData = usersDB.find(u => u.username === this.currentUser?.username);
                const currentFans = freshData ? (parseInt(freshData.fans) || 0) : (this.currentUser?.fans || 0);

                const key = this.getUserKey();
                const balance = localStorage.getItem(`user_balance_vanilla_${key}`) || '0.00';
                
                if (revEl) {
                    if (this.currentUser && this.currentUser.showRevenue === false) {
                        revEl.innerText = "Privado";
                    } else {
                        // Calcula o saldo real (Vindo direto do Supabase via currentUser)
                        const total = parseFloat(this.currentUser.balance || 0);
                        revEl.innerText = `R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
                    }
                }
                if (fansEl) fansEl.innerText = currentFans;
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
            if (!file) return;

            // Compressor de Imagem (Para evitar QuotaExceededError)
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = async () => {
                    // Define o tamanho máximo (Ex: 256px para perfil)
                    const MAX_SIZE = 256;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Converte para JPG leve
                    const avatarData = canvas.toDataURL('image/jpeg', 0.7);
                    
                    const cont = document.getElementById('profile-avatar-container');
                    if (cont) cont.innerHTML = `<img src="${avatarData}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    
                    if (this.currentUser) {
                        this.currentUser.avatar = avatarData;
                        this.saveSession(); // Usa o método centralizado
                        
                        // Atualiza no Banco de Dados Local proativamente
                        this.syncUserToNetwork(this.currentUser);
                        
                        // Limpa caches antigos de usuários para abrir espaço
                        this.optimizeStorageOnNavigation();
                        
                        this.renderProfile();
                        this.showNotification('Sua foto foi otimizada e salva! ✨', 'success');
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
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
            const dashEl = document.getElementById('dash-total-balance');
            
            const updateEl = (target) => {
                if (!target) return;
                const total = parseFloat(this.currentUser?.balance || 0);
                target.innerText = this.showBalance ? `R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '••••••••';
                this.updateBoosterUI();
            };

            updateEl(el);
            updateEl(dashEl);
            this.updateCoinsUI();

            // Atualiza o nome da saudação
            const nameEl = document.getElementById('user-greeting-name');
            if (nameEl && this.currentUser) {
                nameEl.innerText = this.currentUser.name || this.currentUser.username;
            }
        },

        async requestWithdrawal() {
            const balance = parseFloat(this.currentUser?.balance || 0);
            if (balance <= 0) {
                alert("Você não tem saldo disponível para saque no momento.");
                return;
            }

            const pixKey = prompt(`Saldo disponível: R$ ${balance.toFixed(2)}\n\nDigite sua chave PIX para o saque:`);
            if (!pixKey) return;

            const confirmDraw = confirm(`Confirmar pedido de saque de R$ ${balance.toFixed(2)} para a chave:\n${pixKey}?`);
            if (!confirmDraw) return;

            try {
                const { error } = await supabase.from('dito_withdrawals').insert([{
                    username: this.currentUser.username,
                    amount: balance,
                    pix_key: pixKey,
                    status: 'pending'
                }]);

                if (error) throw error;

                // Zera saldo localmente e no banco
                this.currentUser.balance = 0;
                await supabase.from('dito_users').update({ balance: 0 }).eq('username', this.currentUser.username);
                
                this.updateBalanceUI();
                if (this.currentView === 'perfil') this.renderProfile();
                
                alert("Pedido de saque enviado com sucesso! ✅\nO dinheiro cairá na sua conta em breve.");
            } catch (err) {
                console.error(err);
                alert("Erro ao processar pedido de saque. Tente novamente.");
            }
        },

        updateCoinsUI() {
            const key = this.getUserKey();
            const coins = localStorage.getItem(`dito_coins_${key}`) || '0';
            
            const dashCoins = document.getElementById('dashboard-coin-balance');
            const missCoins = document.getElementById('missions-coin-balance');
            const markCoins = document.getElementById('market-coin-balance');
            const podCoins = document.getElementById('global-coin-balance');
            
            if (dashCoins) dashCoins.innerText = coins;
            if (missCoins) missCoins.innerText = coins;
            if (markCoins) markCoins.innerText = coins;
            if (podCoins) podCoins.innerText = coins;
            
            // Sincroniza loja também se estiver aberta
            const storeCoins = document.getElementById('store-coin-balance');
            if (storeCoins) storeCoins.innerText = coins;
        },

        renderLojaCupons(container) {
            const temp = document.getElementById('template-loja-cupons');
            if (!temp) return;
            container.innerHTML = temp.innerHTML;
            if (window.lucide) lucide.createIcons();

            const key = this.getUserKey();
            const currentCoins = localStorage.getItem(`dito_coins_${key}`) || '0';
            const balEl = document.getElementById('store-coin-balance');
            if (balEl) balEl.innerText = currentCoins;
        },

        buyCouponPack(amount, price) {
            if (!this.currentUser || this.currentUser.isGuest) {
                this.showNotification("⚠️ Entre na sua conta para comprar cupons.", "error");
                return;
            }
            
            // Cria um produto virtual para o checkout
            const virtualProd = {
                id: `VIRTUAL_COINS_${amount}`,
                name: `${amount} Cupons Dito`,
                price: price,
                type: 'Vantagem',
                image: '', // Removido
                seller: 'Ditão'
            };

            this.cart = [virtualProd];
            this.safeLocalStorageSet(`dito_cart_${this.getUserKey()}`, JSON.stringify(this.cart));
            this.marketView = 'checkout';
            this.navigate('mercado');
            setTimeout(() => this.renderStore(), 50);
        },

        buyBooster(type, price) {
            if (!this.currentUser || this.currentUser.isGuest) {
                this.showNotification("⚠️ Entre na sua conta para adquirir reforços.", "error");
                return;
            }

            const virtualProd = {
                id: `VIRTUAL_BOOSTER_3X`,
                name: `Reforço Rápido 3x (24h)`,
                price: price,
                type: 'Vantagem',
                image: '', // Removido
                seller: 'Ditão'
            };

            this.cart = [virtualProd];
            this.safeLocalStorageSet(`dito_cart_${this.getUserKey()}`, JSON.stringify(this.cart));
            this.marketView = 'checkout';
            this.navigate('mercado');
            setTimeout(() => this.renderStore(), 50);
        },

        updateBoosterUI() {
            const key = this.getUserKey();
            const expiry = parseInt(localStorage.getItem(`dito_booster_expiry_${key}`) || '0');
            const now = Date.now();
            const isActive = expiry > now;
            
            const badge = document.getElementById('active-booster-badge');
            const timer = document.getElementById('booster-timer');
            
            if (badge) {
                badge.style.display = isActive ? 'inline-block' : 'none';
                
                if (isActive && timer) {
                    const diff = expiry - now;
                    const hours = Math.floor(diff / 3600000);
                    const mins = Math.floor((diff % 3600000) / 60000);
                    const secs = Math.floor((diff % 60000) / 1000);
                    
                    timer.innerText = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                    
                    // Agenda o próximo tick se não houver um ativo
                    if (!this.boosterInterval) {
                        this.boosterInterval = setInterval(() => this.updateBoosterUI(), 1000);
                    }
                } else if (!isActive && this.boosterInterval) {
                    clearInterval(this.boosterInterval);
                    this.boosterInterval = null;
                }
            }
            return isActive;
        },

        awardCoins(baseAmount, reason = "") {
            const key = this.getUserKey();
            const expiry = parseInt(localStorage.getItem(`dito_booster_expiry_${key}`) || '0');
            const isBoosterActive = expiry > Date.now();
            
            const multiplier = isBoosterActive ? 3 : 1;
            const finalAmount = baseAmount * multiplier;
            
            const current = parseInt(localStorage.getItem(`dito_coins_${key}`) || '0');
            const newVal = current + finalAmount;
            
            localStorage.setItem(`dito_coins_${key}`, newVal);
            this.updateCoinsUI();
            
            if (reason) {
                const msg = isBoosterActive ? `+${finalAmount} Cupons (BOOSTER 3X 🔥)` : `+${finalAmount} Cupons`;
                this.showNotification(`${msg} • ${reason}`, "success");
            }

            // Sincroniza com Supabase para segurança contra limpeza de cache
            if (supabase && this.currentUser && !this.currentUser.isGuest) {
                const expiry = parseInt(localStorage.getItem(`dito_booster_expiry_${key}`) || '0');
                supabase.from('dito_users').update({ 
                    coins: newVal,
                    booster_expiry: expiry
                }).eq('username', this.currentUser.username).then(() => {
                    console.log("☁️ [Cloud] Saldo e Booster sincronizados!");
                });
            }
            
            return finalAmount;
        },

        startEventsCarousel() {
            // Movimento automático desativado conforme solicitado
            /*
            if (this.eventsInterval) clearInterval(this.eventsInterval);
            ...
            */
        },

        participateEvent(type) {
            const key = this.getUserKey();
            const eventMap = {
                'flash': { name: 'Missão Veloz', goal: 1, reward: 300, desc: 'Realize 1 venda em 1 hora' },
                'master': { name: 'Missão Especialista', goal: 5, reward: 500, desc: 'Realize 5 vendas hoje' },
                'king': { name: 'Rei da Rede', goal: 3, reward: 750, desc: 'Indique 3 novos usuários' }
            };

            const eventData = eventMap[type];
            if (!eventData) return;

            // Salva a participação
            localStorage.setItem(`dito_event_${type}_${key}`, 'active');
            
            this.showNotification(`Você entrou no evento: ${eventData.name}!`, 'success');
            
            // Navega para Missões para ver o progresso
            setTimeout(() => {
                this.navigate('missoes');
            }, 800);
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

        updateProductProgress() {
            const bar = document.getElementById('product-progress-bar');
            const percentLabel = document.getElementById('product-progress-percent');
            const textLabel = document.getElementById('product-progress-text');
            if (!bar || !percentLabel || !textLabel) return;

            // Cálculo Granular (6 Tarefas)
            let completed = 0;
            const type = this.selectedProductType;
            
            if (this.selectedProductImage) completed++; // 1. Capa
            if (document.getElementById('prod-name')?.value.trim().length > 3) completed++; // 2. Nome
            if (document.getElementById('prod-category')?.value) completed++; // 3. Categoria
            if (document.getElementById('prod-desc')?.value.trim().length > 10) completed++; // 4. Descrição
            
            const price = parseFloat(document.getElementById('prod-price')?.value);
            if (price > 0) completed++; // 5. Preço
            
            // 6. Conteúdo Específico
            let contentOk = false;
            if (type === 'Ebook' && document.getElementById('ebook-file')?.files.length > 0) contentOk = true;
            if (type === 'Curso' && this.courseStructure.length > 0) contentOk = true;
            if (type === 'Mentoria' && document.getElementById('prod-date')?.value) contentOk = true;
            if (contentOk) completed++;

            const progress = Math.round((completed / 6) * 100);

            bar.style.width = `${progress}%`;
            percentLabel.innerText = `${progress}%`;
            
            textLabel.innerText = `${completed} de 6 tarefas concluídas`;
            textLabel.style.color = (completed === 6) ? '#22c55e' : '#000';
            
            // Se terminou, muda a frase motivacional final
            if (completed === 6) {
                textLabel.innerText = "PRONTO PARA PUBLICAR! ✨";
            }

            this.updateProductPreview();
        },

        updateProductPreview() {
            // Get inputs
            const name = document.getElementById('prod-name')?.value || "Nome do Produto";
            const category = document.getElementById('prod-category')?.value || "Categoria";
            const desc = document.getElementById('prod-desc')?.value || "Os detalhes que você escrever aparecerão aqui para o seu cliente...";
            const price = parseFloat(document.getElementById('prod-price')?.value) || 0;
            const formattedPrice = `R$ ${price.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            const type = this.selectedProductType;
            const img = this.selectedProductImage;

            // 0. Image Updates
            const vitrineImg = document.getElementById('preview-vitrine-image');
            if (vitrineImg) {
                if (type === 'Mentoria') {
                    vitrineImg.style.height = '200px'; // Recuo para a bola caber bem
                    vitrineImg.style.background = 'transparent';
                    vitrineImg.innerHTML = `
                        <div style="position: relative; width: 120px; height: 120px; margin: 0 auto;">
                            <div class="live-pulse-border" style="position: absolute; inset: -4px; border-radius: 50%; border: 2.5px solid #ff005c; opacity: 0.8;"></div>
                            <div style="width: 100%; height: 100%; border-radius: 50%; background-image: url('${img || ''}'); background-size: cover; background-position: center; background-color: #f9f9f9; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; position: relative; z-index: 2;">
                                ${!img ? '<i data-lucide="image" style="width: 32px; color: #eee;"></i>' : ''}
                            </div>
                            <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); background: #ff005c; color: #fff; font-size: 9px; font-weight: 950; padding: 3px 12px; border-radius: 20px; text-transform: uppercase; white-space: nowrap; z-index: 10; box-shadow: 0 4px 12px rgba(255, 0, 92, 0.3);">
                                Ao Vivo
                            </div>
                        </div>
                    `;
                    if (window.lucide) lucide.createIcons();
                } else {
                    vitrineImg.style.height = '280px';
                    vitrineImg.style.backgroundImage = img ? `url(${img})` : 'none';
                    vitrineImg.style.backgroundSize = 'cover';
                    vitrineImg.style.backgroundPosition = 'center';
                    vitrineImg.style.backgroundColor = '#f9f9f9';
                    vitrineImg.innerHTML = !img ? '<i data-lucide="image" style="width: 40px; color: #eee;"></i>' : '';
                    if (window.lucide) lucide.createIcons();
                }
            }

            // 1. Vitrine Updates
            const vitrineName = document.getElementById('preview-vitrine-name');
            const vitrineCategory = document.getElementById('preview-vitrine-category');
            const vitrinePrice = document.getElementById('preview-vitrine-price');
            if (vitrineName) vitrineName.innerText = name;
            if (vitrineCategory) vitrineCategory.innerText = category;
            if (vitrinePrice) vitrinePrice.innerText = formattedPrice;

            // 2. Checkout Updates
            const checkoutName = document.getElementById('preview-checkout-name');
            const checkoutPrice = document.getElementById('preview-checkout-price');
            if (checkoutName) checkoutName.innerText = name;
            if (checkoutPrice) checkoutPrice.innerText = formattedPrice;

            // 3. Content Area Updates
            const contentName = document.getElementById('preview-content-name');
            const contentDesc = document.getElementById('preview-content-desc');
            if (contentName) contentName.innerText = name;
            if (contentDesc) contentDesc.innerText = desc;

            // Sync Modules List
            const previewModules = document.getElementById('preview-content-modules');
            if (previewModules && this.courseStructure) {
                previewModules.innerHTML = this.courseStructure.map((m, i) => `
                    <div style="padding: 12px 16px; background: #f9f9f9; border-radius: 12px; font-size: 11px; font-weight: 850; color: #333; display: flex; align-items: center; gap: 10px;">
                        <span style="width: 20px; height: 20px; background: #000; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px;">${i+1}</span>
                        ${m.title || 'Módulo sem título'}
                    </div>
                `).join('');
            }
            
            if (window.lucide) lucide.createIcons();
        },

        launchVictoryConfetti() {
            const colors = ['#FFD600', '#FFCC00', '#FFEA00']; 
            for (let i = 0; i < 100; i++) {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                
                const isLeft = i < 50;
                const startY = window.innerHeight;
                
                confetti.style.left = (isLeft ? '-10px' : (window.innerWidth + 'px'));
                confetti.style.top = startY + 'px';
                confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
                
                const xMove = isLeft ? (Math.random() * 400 + 200) : -(Math.random() * 400 + 200);
                const yMove = -(Math.random() * 700 + 400); 
                
                confetti.style.setProperty('--x', `${xMove}px`);
                confetti.style.setProperty('--y', `${yMove}px`);
                
                const duration = Math.random() * 1.5 + 2;
                confetti.style.animation = `confetti-fall ${duration}s cubic-bezier(0.1, 0.7, 1.0, 0.1) forwards`;
                
                document.body.appendChild(confetti);
                setTimeout(() => confetti.remove(), duration * 1000);
            }
        },

        initCreateProduct() {
            this.editingProductId = null; // Reset estado de edição
            this.hasSeenCreateProd = true;
            const dotDash = document.getElementById('create-product-dot');
            const dotHeader = document.getElementById('header-create-dot');
            if (dotDash) dotDash.style.display = 'none';
            if (dotHeader) dotHeader.style.display = 'none';

            // Show Global Progress Bar
            const container = document.getElementById('product-progress-container');
            if (container) container.style.display = 'flex';

            this.selectedProductType = null;
            const form = document.getElementById('create-product-form');
            if (form) form.style.display = 'none';
            const selection = document.getElementById('product-type-selection');
            if (selection) selection.style.display = 'flex';
            
            this.courseStructure = [];
            this.selectedProductImages = [];
            const gallery = document.getElementById('product-images-gallery-preview');
            if (gallery) gallery.innerHTML = '';
            
            // Reset fields
            if(document.getElementById('prod-name')) document.getElementById('prod-name').value = '';
            if(document.getElementById('prod-desc')) document.getElementById('prod-desc').value = '';
            if(document.getElementById('prod-price')) document.getElementById('prod-price').value = '';
            if(document.getElementById('prod-image-preview')) {
                document.getElementById('prod-image-preview').innerHTML = `<i data-lucide="image-plus" style="width: 32px; color: #ddd;"></i><span style="font-size: 9px; font-weight: 900; color: #bbb; margin-top: 8px;">Upload</span>`;
            }

            const profitLabel = document.getElementById('profit-calc-label');
            if (profitLabel) profitLabel.innerText = "Você receberá: R$ 0,00";
            
            document.querySelectorAll('#product-type-selection button').forEach(btn => {
                btn.style.borderColor = 'transparent';
                btn.style.background = '#f5f5f5';
            });

            this.updateProductProgress();

            // Cálculo de lucro em tempo real
            const priceInp = document.getElementById('prod-price');
            if (priceInp) {
                priceInp.oninput = () => {
                    const val = parseFloat(priceInp.value) || 0;
                    const net = (val * 0.97).toFixed(2);
                    const label = document.getElementById('profit-calc-label');
                    if (label) label.innerText = `Você receberá: R$ ${net} (Taxa de 3% inclusa)`;
                    this.updateProductProgress();
                };
            }
        },

        editProduct(id) {
            const market = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
            const prod = market.find(p => p.id === id);
            if (!prod) return;

            this.editingProductId = id;
            
            // Navega e inicializa apenas a estrutura básica sem resetar campos
            this.navigate('criar-produto');
            const container = document.getElementById('product-progress-container');
            if (container) container.style.display = 'flex';
            
            // Força a seleção do tipo de produto e pula para o formulário
            this.selectedProductType = prod.type;
            
            setTimeout(() => {
                const selection = document.getElementById('product-type-selection');
                const form = document.getElementById('create-product-form');
                if (selection) selection.style.display = 'none';
                if (form) form.style.display = 'block';

                if(document.getElementById('prod-name')) document.getElementById('prod-name').value = prod.name || '';
                if(document.getElementById('prod-desc')) document.getElementById('prod-desc').value = prod.description || '';
                if(document.getElementById('prod-price')) {
                    document.getElementById('prod-price').value = prod.price || '';
                    const val = parseFloat(prod.price) || 0;
                    const net = (val * 0.97).toFixed(2);
                    const label = document.getElementById('profit-calc-label');
                    if (label) label.innerText = `Você receberá: R$ ${net} (Taxa de 3% inclusa)`;
                }
                
                // Carrega Galeria
                this.selectedProductImages = prod.images && prod.images.length > 0 ? [...prod.images] : (prod.image ? [prod.image] : []);
                this.renderProductImageGallery();
                
                if (this.selectedProductImages.length > 0) {
                    const mainPreview = document.getElementById('prod-image-preview');
                    if (mainPreview) {
                        mainPreview.innerHTML = `<img src="${this.rGetPImage(this.selectedProductImages[0], prod.name)}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    }
                }
                
                this.updateProductProgress();
                if (window.lucide) lucide.createIcons();
            }, 50);
        },

        selectProductType(type, btn) {
            if (type === 'App') {
                this.showNotification("📱 A criação de Apps está temporariamente bloqueada.", "info");
                const form = document.getElementById('create-product-form');
                if (form) form.style.display = 'none';
                this.selectedProductType = null;
                // Efeito visual de erro/bloqueio temporário no botão
                btn.style.transform = 'shake 0.5s'; 
                return;
            }
            this.selectedProductType = type;
            
            // Visual logic for selection - Reset others
            document.querySelectorAll('.product-type-btn').forEach(b => {
                b.style.background = '#f5f5f5';
                b.style.border = '2px solid transparent';
                b.style.boxShadow = 'none';
                b.style.transform = 'scale(1)';
                const icon = b.querySelector('i') || b.querySelector('svg');
                if (icon) icon.style.color = '#777';
            });
            
            // Select effect: Background white + Gradient Border + Deep Luxury Shadow
            btn.style.background = 'linear-gradient(#fff, #fff) padding-box, linear-gradient(90deg, #ff005c 0%, #0094ff 100%) border-box';
            btn.style.border = '2px solid transparent';
            btn.style.transform = 'scale(1.1)';
            
            const selectedIcon = btn.querySelector('i') || btn.querySelector('svg');
            if (selectedIcon) selectedIcon.style.color = '#000';

            // Show form and conditional fields
            const form = document.getElementById('create-product-form');
            if (form) form.style.display = 'flex';

            const ebookEl = document.getElementById('ebook-upload');
            const cursoEl = document.getElementById('curso-upload');
            const mentoriaLinkEl = document.getElementById('mentoria-link');
            const mentoriaFieldsEl = document.getElementById('mentoria-fields');

            if (ebookEl) ebookEl.style.display = (type === 'Ebook') ? 'block' : 'none';
            if (cursoEl) {
                cursoEl.style.display = (type === 'Curso') ? 'flex' : 'none';
                if (type === 'Curso') this.renderCourseStructure();
            }
            if (mentoriaLinkEl) mentoriaLinkEl.style.display = (type === 'Mentoria') ? 'block' : 'none';
            if (mentoriaFieldsEl) mentoriaFieldsEl.style.display = (type === 'Mentoria') ? 'block' : 'none';
            
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

            this.updateProductProgress();
        },

        handleProductImage(input) {
            if (!this.selectedProductImages) this.selectedProductImages = [];
            const gallery = document.getElementById('product-images-gallery-preview');
            
            const files = Array.from(input.files);
            const maxSize = 800 * 1024; // 800kb

            files.forEach((file, index) => {
                if (file.size > maxSize) {
                    this.showNotification(`A foto é muito pesada (${(file.size/1024).toFixed(0)}kb). Máximo 800kb.`, "error");
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataUrl = e.target.result;
                    this.selectedProductImages.push(dataUrl);
                    this.renderProductImageGallery(); // Nova função para redesenhar a galeria
                    
                    // Se for a primeira imagem total, atualiza as prévias principais
                    if (this.selectedProductImages.length === 1) {
                        this.selectedProductImage = dataUrl;
                        const mainPreview = document.getElementById('prod-image-preview');
                        if (mainPreview) mainPreview.innerHTML = `<img src="${dataUrl}" style="width: 100%; height: 100%; object-fit: cover;">`;
                    }

                    this.updateProductProgress();
                };
                reader.readAsDataURL(file);
            });
            input.value = ''; // Limpa para permitir selecionar o mesmo arquivo novamente
        },

        renderProductImageGallery() {
            const gallery = document.getElementById('product-images-gallery-preview');
            if (!gallery) return;
            
            gallery.innerHTML = '';
            
            // Renderiza as fotos atuais
            this.selectedProductImages.forEach((img, idx) => {
                const thumb = document.createElement('div');
                thumb.style.cssText = `width: 60px; height: 60px; border-radius: 12px; background: #fff; border: 1px solid #f0f0f0; flex-shrink: 0; overflow: hidden; position: relative;`;
                thumb.innerHTML = `
                    <img src="${this.rGetPImage(img)}" style="width: 100%; height: 100%; object-fit: cover;">
                    <div onclick="app.removeProductImage(${idx})" style="position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; background: #000; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 950; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.2); line-height: 1;">×</div>
                `;
                gallery.appendChild(thumb);
            });

            // Botão "ADICIONAR MAIS" (+)
            const addBtn = document.createElement('div');
            addBtn.onclick = () => document.getElementById('prod-image-file').click();
            addBtn.style.cssText = `width: 60px; height: 60px; border-radius: 12px; background: #fbfbfb; border: 2px dashed #eee; flex-shrink: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.3s;`;
            addBtn.onmouseover = () => addBtn.style.borderColor = '#ff005c';
            addBtn.onmouseout = () => addBtn.style.borderColor = '#eee';
            addBtn.innerHTML = `<i data-lucide="plus" style="width: 20px; color: #ccc;"></i>`;
            gallery.appendChild(addBtn);
            
            if (window.lucide) lucide.createIcons();
        },

        removeProductImage(index) {
            this.selectedProductImages.splice(index, 1);
            this.renderProductImageGallery();
            if (this.selectedProductImages.length > 0) {
                this.selectedProductImage = this.selectedProductImages[0];
            } else {
                this.selectedProductImage = null;
                const mainPreview = document.getElementById('prod-image-preview');
                if (mainPreview) mainPreview.innerHTML = `<i data-lucide="image-plus" style="width: 32px; color: #ddd;"></i><span style="font-size: 9px; font-weight: 900; color: #bbb; margin-top: 8px;">Upload</span>`;
                if (window.lucide) lucide.createIcons();
            }
            this.updateProductProgress();
        },

        handleFileUpload(input, targetId) {
            const file = input.files[0];
            const display = document.getElementById(targetId);
            if (file && display) {
                display.innerText = `Arquivo realizado upload : ${file.name}`;
                this.updateProductProgress();
            }
        },

        calculateNetProfit(price) {
            const label = document.getElementById('profit-calc-label');
            const net = (parseFloat(price) * 0.97 || 0).toFixed(2);
            if (label) {
                label.innerText = `Receba até R$ ${parseFloat(net).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            }
        },


        handleImageUrlInput(url) {
            if (!url) {
                this.selectedProductImage = null;
                const preview = document.getElementById('prod-image-preview');
                if (preview) {
                    preview.style.backgroundImage = 'none';
                    preview.innerHTML = '<i data-lucide="image-plus" style="width: 32px; color: #ddd;"></i><span style="font-size: 9px; font-weight: 900; color: #bbb; margin-top: 8px;">Upload</span>';
                    if (window.lucide) lucide.createIcons();
                }
                return;
            }
            this.selectedProductImage = url;
            const preview = document.getElementById('prod-image-preview');
            const vPreview = document.getElementById('preview-vitrine-image');
            const cPreview = document.getElementById('preview-checkout-thumb');
            const hPreview = document.getElementById('preview-content-hero');
            
            if (preview) {
                preview.style.backgroundImage = `url(${url})`;
                preview.innerHTML = '';
            }
            if (vPreview) {
                vPreview.style.backgroundImage = `url(${url})`;
                vPreview.innerHTML = '';
            }
            if (cPreview) {
                cPreview.style.backgroundImage = `url(${url})`;
                cPreview.innerHTML = '';
            }
            if (hPreview) {
                hPreview.style.backgroundImage = `url(${url})`;
                hPreview.innerHTML = '';
            }
        },

        saveProduct() {
            const name = document.getElementById('prod-name').value.trim();
            const desc = document.getElementById('prod-desc')?.value.trim() || "";
            const price = parseFloat(document.getElementById('prod-price').value) || 0;
            const category = document.getElementById('prod-category')?.value || "Dinheiro";
            const visible = document.getElementById('prod-visible').checked;
            const hasGuarantee = document.getElementById('prod-guarantee').checked;
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
            const notif = { remove: () => {} }; // Mock para não quebrar o código posterior

            // Disparar festa IMEDIATAMENTE ao clicar
            this.launchVictoryConfetti();

            setTimeout(() => {
                const urlInput = document.getElementById('prod-image-url')?.value.trim();
                const finalImage = urlInput || this.selectedProductImage || null;

                let newProd = {
                    id: this.editingProductId || ('p-' + Date.now()),
                    name: name,
                    description: desc,
                    price: price,
                    oldPrice: price * 1.4,
                    type: this.selectedProductType,
                    visible: visible,
                    rating: 5.0,
                    sales: 0,
                    image: finalImage,
                    images: this.selectedProductImages && this.selectedProductImages.length > 0 ? this.selectedProductImages : [finalImage], // Galeria completa
                    image_url: finalImage,
                    author: this.currentUser?.username || "Você",
                    seller: this.currentUser?.username || "Você",
                    sales_link: salesLink,
                    guarantee: hasGuarantee,
                    category: category,
                    createdAt: Date.now(),
                    slug: this.generateRandomSlug(),
                    content: this.selectedProductType === 'Curso' ? this.courseStructure : null
                };

                const isEdit = !!this.editingProductId;
                const networkProd = { ...newProd };
                if (networkProd.image && networkProd.image.length > 200000) {
                     console.warn("Imagem muito grande para nuvem, enviando compactada...");
                }

                // Salva na Nuvem (Supabase) - Usa UPSERT para atualizar se existir
                supabase.from('dito_products').upsert([networkProd]).then(({ error }) => {
                    if (error) console.error("Erro ao sincronizar produto na nuvem:", error);
                });

                // Salva na lista global local com proteção de cota
                try {
                    let marketProducts = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
                    if (isEdit) {
                        const idx = marketProducts.findIndex(p => p.id === this.editingProductId);
                        if (idx !== -1) marketProducts[idx] = newProd;
                        else marketProducts.unshift(newProd);
                    } else {
                        marketProducts.unshift(newProd);
                    }
                    localStorage.setItem('dito_products_vanilla', JSON.stringify(marketProducts));
                    localStorage.setItem('dito_products', JSON.stringify(marketProducts));
                } catch (e) {
                    if (e.name === 'QuotaExceededError') {
                        console.warn("🚨 Limpeza de Emergência: Memória Cheia!");
                        // Limpa lixo agressivamente
                        const keysToClear = [
                            'dito_products_vanilla',
                            'dito_checkin_history', 
                            'dito_real_sales_history',
                            'dito_market_notifications'
                        ];
                        keysToClear.forEach(k => localStorage.removeItem(k));
                        
                        // Tenta salvar APENAS o necessário para o funcionamento
                        try {
                            localStorage.setItem('dito_products', JSON.stringify([newProd]));
                        } catch(inner) {
                            app.showNotification("Imagem muito grande! Reduza a foto ou use um link.", "error");
                        }
                    }
                }
                // Compartilha via Supabase (USA A VERSÃO COM IMAGEM FULL)
                app.syncProductToNetwork(networkProd);

                if (notif) notif.remove();
                app.showNotification(`Produto "${name}" criado com sucesso!`, "success");
                app.launchVictoryConfetti();

                // Recarrega rede IMEDIAMENTE para aparecer
                setTimeout(() => app.fetchNetworkProducts(true), 500);

                // Verifica se precisa mostrar o botão de Transmissão imediatamente
                if (this.selectedProductType === 'Mentoria') app.checkLiveAdminStatus();
                app.navigate('dashboard');
            }, 1500); // Reduzido de 3s para 1.5s para ser mais ágil
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
            
            const pendingBase = parseFloat(localStorage.getItem(`user_pending_vanilla_${key}`) || '0');
            const total = baseBalance + salesTotal;

            if (balanceEl) balanceEl.innerText = `R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

            // Atualiza Saldo Pendente
            const pendingContainer = document.getElementById('withdraw-balance-pending-container');
            const pendingVal = document.getElementById('withdraw-balance-pending-val');
            if (pendingContainer && pendingVal) {
                pendingVal.innerText = pendingBase.toLocaleString('pt-BR', {minimumFractionDigits: 2});
                pendingContainer.style.display = pendingBase > 0 ? 'inline-block' : 'none';
            }

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
            const email = document.getElementById('reg-email').value.trim().toLowerCase();

            if (!username || !password || !email) {
                this.showNotification('Preencha todos os campos, incluindo o e-mail.', 'error');
                return;
            }

            const termsCheck = document.getElementById('reg-terms-check');
            if (termsCheck && !termsCheck.checked) {
                this.showNotification('Você precisa confirmar que leu os Termos de Uso.', 'error');
                return;
            }

            if (!email.includes('@')) {
                this.showNotification('Insira um e-mail válido.', 'error');
                return;
            }

            let users = JSON.parse(localStorage.getItem('dito_users_db') || '[]');
            
            // 1. Verifica se Username ou E-mail já existem
            if (users.find(u => u.username === username)) {
                this.showNotification('Este usuário já existe.', 'error');
                return;
            }
            if (users.find(u => u.email === email)) {
                this.showNotification('Este e-mail já está sendo usado.', 'error');
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

            this.syncUserToNetwork(newUser);

            // 2. Processa Recompensa de Indicação (Blindada por E-mail)
            const refCode = localStorage.getItem('dito_pending_ref'); 
            if (refCode) {
                const targetId = parseInt(refCode, 36);
                let referrerUsername = "";

                // Verifica se este e-mail já foi usado para ganhar indicação
                let rewardBlacklist = JSON.parse(localStorage.getItem('dito_referral_emails_blacklist') || '[]');
                if (rewardBlacklist.includes(email)) {
                    console.warn(`🛑 Indicação invalidada: E-mail ${email} já gerou bônus anteriormente.`);
                    localStorage.removeItem('dito_pending_ref');
                } else {
                    // Tenta achar o padrinho no DB Local
                    let db = JSON.parse(localStorage.getItem('dito_users_db') || '[]');
                    let referrerIdx = db.findIndex(u => u.id === targetId);
                    
                    if (referrerIdx !== -1) {
                        const referrer = db[referrerIdx];
                        referrerUsername = referrer.username;
                        
                        // Adiciona Cupom e Moedas ao Padrinho
                        if (!referrer.referralCoupons) referrer.referralCoupons = [];
                        referrer.referralCoupons.push({
                            id: 'cp-' + Date.now(),
                            value: 225,
                            date: Date.now(),
                            type: 'Indicação Direta',
                            referredUser: username,
                            referredEmail: email
                        });
                        
                        referrer.coins = (parseInt(referrer.coins) || 0) + 225;
                        db[referrerIdx] = referrer;
                        localStorage.setItem('dito_users_db', JSON.stringify(db));
                        
                        // Marca e-mail na lista negra para não pontuar de novo
                        rewardBlacklist.push(email);
                        localStorage.setItem('dito_referral_emails_blacklist', JSON.stringify(rewardBlacklist));
                        
                        console.log(`✅ [Local] Recompensa creditada para @${referrerUsername}`);

                        // Notifica via Supabase
                        if (supabase && referrerUsername) {
                            const rewardMessage = {
                                target_username: referrerUsername,
                                type: 'referral_225',
                                title: 'Indicação de Sucesso',
                                message: `O usuário @${username} acaba de criar uma conta pelo seu link! Você ganhou +100 cupons.`,
                                sender: 'Sistema',
                                read: false
                            };
                            supabase.from('dito_notifications').insert([rewardMessage]);
                            
                            supabase.from('profiles').select('coins').eq('username', referrerUsername).maybeSingle().then(({ data }) => {
                               if (data) {
                                   const newTotal = (data.coins || 0) + 225;
                                   supabase.from('profiles').update({ coins: newTotal }).eq('username', referrerUsername);
                               }
                            });
                        }

                        this.showSystemNotification('Seja bem-vindo', 'Você entrou pela rede de um amigo! Comece a convidar para ganhar cupons também.', 'success');
                    }
                    localStorage.removeItem('dito_pending_ref');
                }
            }

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
            this.updateProductProgress();
        },

        removeCourseModule(moduleId) {
            this.courseStructure = this.courseStructure.filter(m => m.id !== moduleId);
            this.renderCourseStructure();
            this.updateProductProgress();
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
                        this.updateProductProgress();
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
                <div style="background: transparent; border-bottom: 2px solid #f5f5f5; padding: 24px 0; margin-bottom: 32px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding: 0 10px;">
                        <input type="text" value="${m.title}" oninput="app.updateModuleTitle('${m.id}', this.value)" style="border: none; border-bottom: 2px solid #000; background: transparent; font-weight: 900; font-size: 16px; color: #000; outline: none; width: 60%; padding: 8px 0;">
                        <div style="display: flex; gap: 8px;">
                            <button onclick="app.addCourseLesson('${m.id}')" style="background: #000; color: #fff; border: none; padding: 8px 20px; border-radius: 50px; font-size: 10px; font-weight: 950; cursor: pointer; transition: 0.3s;">+ Aula</button>
                            <button onclick="app.removeCourseModule('${m.id}')" style="background: #f5f5f5; color: #999; border: none; padding: 8px; border-radius: 50%; cursor: pointer;"><i data-lucide="trash-2" style="width: 14px;"></i></button>
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 0;">
                        ${m.lessons.map(l => `
                            <div style="display: flex; align-items: center; gap: 16px; padding: 16px 10px; border-bottom: 1px dashed #eee;">
                                <div style="flex: 1; display: flex; align-items: center; gap: 16px;">
                                    <input type="text" value="${l.title}" oninput="app.updateLessonTitle('${m.id}', '${l.id}', this.value)" placeholder="Título da aula" style="border: none; border-bottom: 1px solid #eee; background: transparent; font-weight: 700; font-size: 14px; color: #000; outline: none; flex: 1; padding: 8px 0;">
                                    
                                    <div onclick="this.nextElementSibling.click()" style="min-width: 130px; height: 38px; background: #fff; border: 1px solid #eee; border-radius: 10px; display: flex; align-items: center; justify-content: center; cursor: pointer; gap: 8px; transition: 0.3s; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">
                                        <i data-lucide="video" style="width: 14px; color: ${l.fileName ? '#22c55e' : '#ccc'};"></i>
                                        <span style="font-size: 9px; font-weight: 800; color: ${l.fileName ? '#22c55e' : '#999'}; text-transform: uppercase;">${l.fileName ? 'Vídeo OK' : 'Subir Vídeo'}</span>
                                    </div>
                                    <input type="file" accept="video/*" onchange="app.handleLessonUpload(this, '${m.id}', '${l.id}')" style="display: none;">
                                </div>
                                <button onclick="app.removeCourseLesson('${m.id}', '${l.id}')" style="color: #ccc; border: none; background: transparent; cursor: pointer; padding: 5px; transition: 0.3s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#ccc'">
                                    <i data-lucide="x" style="width: 18px;"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');

            if (window.lucide) lucide.createIcons();
        },

        async login(isGuest = false) { 
            this.showLoading(true, 'Autenticando...');
            
            try {
                if (isGuest) {
                    localStorage.setItem('is_logged_in_vanilla', 'true');
                    localStorage.setItem('is_guest_vanilla', 'true');
                    this.currentUser = { username: "Convidado", name: "Visitante", bio: "Explorando o Dito", isGuest: true };
                    this.navigate('dashboard');
                    return;
                }

                const userInp = document.getElementById('username')?.value.trim();
                const passInp = document.getElementById('password')?.value.trim();

                if (!userInp || !passInp) {
                    this.showNotification('Preencha os campos de login.', 'error');
                    return;
                }

                // 1. Tenta Login Local (Cache)
                let users = JSON.parse(localStorage.getItem('dito_users_db') || '[]');
                let user = users.find(u => u.username === userInp && u.password === passInp);

                // 2. Se não achou local, TENTA LOGIN GLOBAL (Supabase)
                if (!user && supabase) {
                    try {
                        const { data, error } = await supabase
                            .from('dito_users')
                            .select('*')
                            .eq('username', userInp)
                            .eq('password', passInp)
                            .maybeSingle();
                        
                        if (data && !error) {
                            user = data;
                            users.push(data);
                            localStorage.setItem('dito_users_db', JSON.stringify(users));
                        }
                    } catch (e) { 
                        console.warn("⚠️ [Auth] Falha na rede:", e); 
                    }
                }

                // 3. Validação Final
                if (user || (userInp === 'admin' && passInp === 'admin')) {
                    const loggedUser = user || { id: 1, username: 'admin', name: 'Admin', bio: 'Admin', sales: 0 };
                    localStorage.setItem('is_logged_in_vanilla', 'true');
                    localStorage.setItem('is_guest_vanilla', 'false');
                    this.saveSession(loggedUser);
                    this.currentUser = loggedUser;
                    this.loadUserScopedData();
                    
                    localStorage.setItem('dito_user_id', loggedUser.id);
                    
                    // Background sync
                    this.fetchNetworkUsers(); 
                    
                    if (this.currentUser) this.saveSession(this.currentUser);
                    this.navigate('dashboard');
                } else {
                    this.showNotification('Usuário ou senha incorretos.', 'error');
                }
            } catch (err) {
                console.error("Erro no login:", err);
                this.showNotification('Erro ao autenticar. Tente novamente.', 'error');
            } finally {
                this.showLoading(false);
            }
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

        showNotification(msg, type = 'default') {
            return; // Notificações desativadas por solicitação do usuário
            const container = document.getElementById('notification-container');
            if (!container) {
                const newContainer = document.createElement('div');
                newContainer.id = 'notification-container';
                newContainer.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 9999; display: flex; flex-direction: column; gap: 10px; width: 90%; max-width: 400px; pointer-events: none;';
                document.body.appendChild(newContainer);
            }

            const toast = document.createElement('div');
            let bg = '#000';
            if (type === 'success') bg = '#10b981';
            if (type === 'error') bg = '#ef4444';
            if (type === 'info') bg = '#0487ff';

            toast.style.cssText = `
                background: ${bg};
                color: #fff;
                padding: 16px 24px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 900;
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                display: flex;
                align-items: center;
                gap: 12px;
                animation: slideDownFade 0.4s ease-out;
                pointer-events: auto;
            `;

            const iconMap = {
                'success': 'check-circle',
                'error': 'alert-circle',
                'info': 'info',
                'default': 'bell'
            };

            toast.innerHTML = `
                <i data-lucide="${iconMap[type] || 'bell'}" style="width: 18px;"></i>
                <span>${msg}</span>
            `;

            document.getElementById('notification-container').appendChild(toast);
            if (window.lucide) lucide.createIcons();

            setTimeout(() => {
                toast.style.animation = 'slideUpFade 0.4s ease-in forwards';
                setTimeout(() => toast.remove(), 400);
            }, 4000);
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
                    const productImg = (p.images && p.images.length > 0) ? p.images[0] : (p.image || p.image_url || "");
                    return `
                    <div style="background: #fff; padding: 16px; border-radius: 24px; border: 1px solid #f2f2f2; display: flex; align-items: center; gap: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                        <div style="width: 70px; height: 70px; background: #f9f9f9; border-radius: 16px; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; flex-shrink: 0;">
                            <img src="${this.rGetPImage(productImg, p.name)}" style="width: 100%; height: 100%; object-fit: cover;">
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
            // Acesso total liberado para qualquer pessoa, inclusive convidados.
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
                setTimeout(() => this.renderStore(), 50);
                return;
            }

            // Se for Deep Link mas o produto ainda nao carregou, mostra loading interno
            if (this.isProcessingDeepLink && this.marketView === 'checkout' && this.cart.length === 0) {
                container.innerHTML = `
                    <div style="padding: 100px 24px; text-align: center;">
                        <div class="loading-spinner" style="margin: 0 auto 20px;"></div>
                        <p style="font-weight: 800; font-size: 14px; color: #000;">Preparando seu checkout...</p>
                    </div>
                `;
                return;
            }

            if (this.marketView === 'home') this.renderMarketHome(container);
            if (this.marketView === 'product') this.renderMarketProduct(container);
            if (this.marketView === 'cart') this.renderMarketCart(container);
            if (this.marketView === 'checkout') this.renderMarketCheckout(container);
            if (this.marketView === 'live-room') this.renderMarketLiveRoom(container);

            
            this.updateCartBadge();
            if (window.lucide) lucide.createIcons();
        },

        // Placeholder removido para evitar sobreposição - funcionalidade real movida para renderMarketCheckout consolidado acima

        renderMarketLiveRoom(container) {
            // Tenta pegar a versão mais fresca do produto na memória
            if (this.selectedProduct) {
                const fresh = this.products.find(p => String(p.id) === String(this.selectedProduct.id));
                if (fresh) this.selectedProduct = fresh;
            }

            const p = this.selectedProduct;
            if (!p) return this.setMarketView('home');

            if (!container) return; 
            
            // Notifica o Mentor sobre a entrada se não for o próprio mentor
            const host = p.seller || p.author;
            if (host && this.currentUser && host !== this.currentUser.username) {
                this.sendNetworkNotification(host, 'visit', '👣 Novo Espectador!', `${this.currentUser.username} acabou de entrar na sua Mentoria.`);
            }
            
            const temp = document.getElementById('template-live-room');
            if (!temp) return;
            
            container.innerHTML = temp.innerHTML;

            document.getElementById('live-room-title').innerText = p.name;
            document.getElementById('live-host-name').innerText = p.seller || p.author || 'Mestre Dito';
            document.getElementById('live-description').innerText = p.description || "Bem-vindo à transmissão exclusiva.";

            const playerContainer = document.getElementById('live-player-container');
            const chatBtn = document.getElementById('btn-open-live-chat');

            if (chatBtn) {
                chatBtn.onclick = () => this.openWorldChat(`LIVE_${p.id}`, `Chat: ${p.name}`);
            }

            // Converter link de vendas em Player (YouTube/Vimeo) - Suporte Mobile Robusto
            // Converter link de vendas em Player (YouTube/Vimeo) - Suporte Mobile Robusto
            if (p.sales_link === 'NATIVE_LIVE') {
                playerContainer.innerHTML = `
                    <div style="width: 100%; height: 100%; background: #000; position: relative; overflow: hidden;">
                        <video id="live-native-video" autoplay playsinline muted style="width: 100%; height: 100%; object-fit: cover; background: #000;"></video>
                        
                        <!-- Log de Diagnóstico (Visível durante conexão) -->
                        <div id="live-diag-log" style="position: absolute; bottom: 80px; left: 20px; color: rgba(255,255,255,0.5); font-family: monospace; font-size: 8px; pointer-events: none; z-index: 100;">
                            Status: Iniciando...
                        </div>

                        <!-- Overlay de Conexão -->
                        <div id="live-native-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10; backdrop-filter: blur(5px);">
                            <div class="live-pulse" style="width: 16px; height: 16px; background: #ff005c; border-radius: 50%; margin-bottom: 12px;"></div>
                            <p id="live-native-status" style="color: #fff; font-size: 11px; font-weight: 950; text-transform: uppercase; letter-spacing: 1px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">Sincronizando com o Mentor...</p>
                            <button id="btn-unmute-live" onclick="app.unmuteNativeLive()" style="display: none; margin-top: 16px; background: #ff005c; color: #fff; border: none; padding: 12px 24px; border-radius: 50px; font-weight: 950; font-size: 11px; cursor: pointer; box-shadow: 0 10px 20px rgba(255,0,92,0.3); animation: bounce 2s infinite;">
                                <i data-lucide="volume-2" style="width: 16px; vertical-align: middle; margin-right: 6px;"></i> OUVIR MENTOR
                            </button>
                        </div>
                        
                        <div style="position: absolute; top: 20px; left: 20px; z-index: 5;">
                           <div style="background: #ff005c; color: #fff; font-size: 10px; font-weight: 950; padding: 6px 12px; border-radius: 50px; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(255,0,92,0.3);">
                               <div style="width: 6px; height: 6px; background: #fff; border-radius: 50%; animation: pulse 1s infinite;"></div> DITO NATIVE LIVE
                           </div>
                        </div>
                    </div>
                `;
                this.startWatchingNativeLive(p.id);
            } else if (p.sales_link) {
                let embedUrl = p.sales_link;
                if (p.sales_link.includes('youtube.com/watch?v=')) {
                    embedUrl = p.sales_link.replace('watch?v=', 'embed/').split('&')[0] + '?autoplay=1&mute=1&playsinline=1&rel=0';
                } else if (p.sales_link.includes('youtu.be/')) {
                    embedUrl = p.sales_link.replace('youtu.be/', 'youtube.com/embed/').split('?')[0] + '?autoplay=1&mute=1&playsinline=1&rel=0';
                } else if (p.sales_link.includes('youtube.com/live/')) {
                    embedUrl = p.sales_link.replace('/live/', '/embed/') + '?autoplay=1&mute=1&playsinline=1&rel=0';
                } else if (p.sales_link.includes('vimeo.com/')) {
                    embedUrl = p.sales_link.replace('vimeo.com/', 'player.vimeo.com/video/') + '?autoplay=1&muted=1&playsinline=1';
                }

                playerContainer.innerHTML = `
                    <iframe src="${embedUrl}" style="width:100%; height:100%; border:none;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen playsinline></iframe>
                `;
            } else {
                playerContainer.innerHTML = `
                    <div style="text-align: center; color: #666; padding: 40px 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: #fdfdfd;">
                        <style>
                            .live-pulse {
                                animation: pulse-red 2s infinite;
                            }
                            @keyframes pulse-red {
                                0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 0, 92, 0.7); }
                                70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(255, 0, 92, 0); }
                                100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 0, 92, 0); }
                            }
                        </style>
                        <div class="live-pulse" style="width: 12px; height: 12px; background: #ff005c; border-radius: 50%; margin-bottom: 20px;"></div>
                        <i data-lucide="video-off" style="width: 48px; margin-bottom: 16px; color: #eee;"></i>
                        <p style="font-size: 15px; font-weight: 950; color: #000; letter-spacing: -0.5px; margin-bottom: 4px;">Aguardando o Mentor iniciar...</p>
                        <p style="font-size: 12px; color: #999; font-weight: 500;">A transmissão começará automaticamente à medida que o sinal for detectado.</p>
                        ${this.currentUser && this.currentUser.username === p.seller ? `
                            <div style="margin-top: 24px; display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 240px;">
                                <button onclick="app.isLocalProtocol() ? app.showRemoteCameraHelp('${p.id}') : app.startLiveCamera()" style="background: #ff005c; color: #fff; border: none; padding: 14px; border-radius: 16px; font-weight: 900; font-size: 11px; cursor: pointer; box-shadow: 0 10px 20px rgba(255,0,92,0.2);">
                                    <i data-lucide="camera" style="width: 14px; margin-right: 4px;"></i> ${app.isLocalProtocol() ? 'CONECTAR CÂMERA DO CELULAR' : 'INICIAR CÂMERA (NATIVO)'}
                                </button>
                                <button onclick="app.updateLiveLink('${p.id}')" style="background: #000; color: #fff; border: none; padding: 14px; border-radius: 16px; font-weight: 900; font-size: 11px; cursor: pointer;">
                                    USAR LINK EXTERNO (YOUTUBE)
                                </button>
                            </div>
                        ` : ''}
                    </div>
                `;
            }

            // CONTROLES DE TRANSMISSÃO (Exclusivo Mentor)
            const controls = document.createElement('div');
            controls.style.cssText = 'padding: 16px; display: flex; gap: 10px; overflow-x: auto; background: #fff; border-top: 1px solid #eee;';
            
            if (this.currentUser && this.currentUser.username === p.seller) {
                controls.innerHTML = `
                    <button onclick="app.startLiveCamera()" style="background: #ff005c; color: #fff; border: none; padding: 10px 20px; border-radius: 50px; font-weight: 900; font-size: 11px; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(255,0,92,0.2);">
                        <i data-lucide="camera" style="width: 14px;"></i> INICIAR MINHA CÂMERA
                    </button>
                    ${p.sales_link ? `
                        <button onclick="app.updateLiveLink('${p.id}')" style="background: #000; color: #fff; border: none; padding: 10px 20px; border-radius: 50px; font-weight: 900; font-size: 11px; cursor: pointer; white-space: nowrap;">
                            TROCAR VÍDEO
                        </button>
                        <button onclick="app.renderMarketLiveRoom(document.getElementById('market-container'))" style="background: #f5f5f5; color: #666; border: none; padding: 10px 20px; border-radius: 50px; font-weight: 900; font-size: 11px; cursor: pointer; white-space: nowrap;">
                            RESTAURAR VÍDEO
                        </button>
                    ` : `
                        <button onclick="app.updateLiveLink('${p.id}')" style="background: #000; color: #fff; border: none; padding: 10px 20px; border-radius: 50px; font-weight: 900; font-size: 11px; cursor: pointer; white-space: nowrap;">
                            DEFINIR LINK (YOUTUBE/VIMEO)
                        </button>
                    `}
                `;
                container.appendChild(controls);
            } else {
                // Versão Participante
                controls.innerHTML = `
                     <button onclick="app.startParticipantCamera()" style="background: #000; color: #fff; border: none; padding: 10px 20px; border-radius: 50px; font-weight: 900; font-size: 11px; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="video" style="width: 14px;"></i> MINHA CÂMERA
                    </button>
                `;
                container.appendChild(controls);
            }

            if (window.lucide) lucide.createIcons();
        },

        async updateLiveLink(productId) {
            const newLink = prompt("Cole o link do YouTube ou Vimeo para a transmissão:");
            if (!newLink) return;

            const p = this.products.find(item => String(item.id) === String(productId));
            if (!p) return;

            p.sales_link = newLink;
            
            // Sincroniza com a rede (Supabase envia o sinal para todos)
            await this.syncProductToNetwork(p);
            
            this.showNotification("Link de transmissão atualizado e enviado para todos! 🚀", "success");
            
            // Atualiza UI local
            this.renderMarketLiveRoom(document.getElementById('market-container'));
        },

        async setTestLiveLink(productId) {
            const testLink = "https://www.youtube.com/watch?v=5Uf67vK9L1o"; // Vídeo demo de música ou similar
            const p = this.products.find(item => String(item.id) === String(productId));
            if (!p) return;
            p.sales_link = testLink;
            await this.syncProductToNetwork(p);
            this.showNotification("Vídeo de Teste ativado! Todos já podem ver. 🎥", "success");
            this.renderMarketLiveRoom(document.getElementById('market-container'));
        },

        startWatchingNativeLive(productId) {
            if (!supabase) return;
            
            const diag = (txt) => {
                const el = document.getElementById('live-diag-log');
                if (el) el.innerText = `Status: ${txt}`;
                console.log(`[NativeLive] ${txt}`);
            };

            // LIMPEZA
            if (this.activePC) { this.activePC.close(); this.activePC = null; }
            if (this.signalInterval) { clearInterval(this.signalInterval); this.signalInterval = null; }
            if (this.studentChannel) { this.studentChannel.unsubscribe(); }

            const channelName = `live-native-${productId}`;
            this.studentChannel = supabase.channel(channelName);
            const myId = this.currentUser ? this.currentUser.username : `guest-${Math.random().toString(36).substr(2, 9)}`;

            diag(`Iniciando sessao como ${myId}...`);

            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }
                ]
            });

            pc.ontrack = (event) => {
                diag("Sinal de vídeo recebido!");
                const video = document.getElementById('live-native-video');
                const overlay = document.getElementById('live-native-overlay');
                const status = document.getElementById('live-native-status');
                const unmuteBtn = document.getElementById('btn-unmute-live');

                if (video) {
                    video.srcObject = event.streams[0];
                    video.onloadedmetadata = () => {
                        video.play().catch(e => console.warn("Autoplay bloqueado, aguardando clique."));
                    };
                    
                    if (status) status.innerText = 'CONEXÃO ESTABELECIDA!';
                    if (overlay) overlay.style.background = 'transparent';
                    if (unmuteBtn) {
                        unmuteBtn.style.display = 'block';
                        if (window.lucide) lucide.createIcons();
                    }
                    setTimeout(() => { 
                        if(status) status.style.opacity = '0';
                        const d = document.getElementById('live-diag-log');
                        if (d) d.style.display = 'none';
                        if (overlay) overlay.style.display = 'none';
                    }, 5000);
                }
            };

            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    this.studentChannel.send({
                        type: 'broadcast',
                        event: 'ice-candidate-from-student',
                        payload: { studentId: myId, target: this.selectedProduct.seller, candidate: event.candidate }
                    });
                }
            };

            this.studentChannel
                .on('broadcast', { event: 'offer' }, async ({ payload }) => {
                    if (payload.target === myId) {
                        diag("Oferta recebida do mentor. Conectando...");
                        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        
                        this.studentChannel.send({
                            type: 'broadcast',
                            event: 'answer',
                            payload: { studentId: myId, target: payload.mentorId || this.selectedProduct.seller, answer }
                        });
                    }
                })
                .on('broadcast', { event: 'mentor-presence' }, ({ payload }) => {
                    diag("Mentor detectado na sala!");
                    this.studentChannel.send({
                        type: 'broadcast',
                        event: 'request-stream',
                        payload: { studentId: myId }
                    });
                })
                .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
                    if (payload.target === myId) {
                        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
                    }
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        diag("Buscando mentor na rede...");
                        this.signalInterval = setInterval(() => {
                            if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') {
                                this.studentChannel.send({
                                    type: 'broadcast',
                                    event: 'request-stream',
                                    payload: { studentId: myId }
                                });
                            } else {
                                diag("Conectado com sucesso!");
                                clearInterval(this.signalInterval);
                            }
                        }, 2500);
                    }
                });
            
            this.activePC = pc;
        },

        unmuteNativeLive() {
            const video = document.getElementById('live-native-video');
            const btn = document.getElementById('btn-unmute-live');
            const overlay = document.getElementById('live-native-overlay');
            if (video) {
                video.muted = false;
                video.play();
                if (btn) btn.style.display = 'none';
                if (overlay) overlay.style.display = 'none';
            }
        },

        isLocalProtocol() {
            return window.location.protocol === 'file:';
        },

        showRemoteCameraHelp(productId) {
            const p = this.products.find(item => String(item.id) === String(productId));
            const msg = `Para usar a câmera no celular, publique seu app no GitHub ou use o link de acesso remoto do Dito. Deseja iniciar o modo de espera de sinal?`;
            
            if (confirm(msg)) {
                // Ativa modo espera
                p.sales_link = 'NATIVE_LIVE';
                this.syncProductToNetwork(p);
                this.renderMarketLiveRoom(document.getElementById('market-container'));
                this.showNotification("Aguardando sinal do celular... Ligue a câmera lá!", "default");
            }
        },

        toggleMarketFilter() {
            const dropdown = document.getElementById('market-filter-dropdown');
            const chevron = document.getElementById('filter-chevron');
            if (!dropdown) return;
            
            const isOpen = dropdown.style.display === 'block';
            dropdown.style.display = isOpen ? 'none' : 'block';
            if (chevron) {
                chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        },

        setMarketCategory(category, el) {
            this.marketCategory = category;
            
            // Fecha o menu após selecionar
            this.toggleMarketFilter();
            
            // Atualiza o texto do botão de gatilho para mostrar o filtro atual
            const triggerText = document.querySelector('#market-filter-trigger span');
            if (triggerText) {
                triggerText.innerText = category === 'Todas' ? 'Filtro' : category;
            }

            // Renderiza novamente a Home do Mercado com o filtro
            const container = document.getElementById('market-actual-content');
            if (container) this.renderMarketHome(container);
        },
        
        renderMarketHome(container) {
            if (!container) container = document.getElementById('market-actual-content');
            if (!container) return; // Aborta se não houver onde renderizar

            const temp = document.getElementById('template-mercado-home');
            if (!temp) return;
            container.innerHTML = temp.innerHTML;
            
            const feed = document.getElementById('main-market-feed');
            const hContainer = document.getElementById('ebooks-horizontal-list');
            const hWrapper = document.getElementById('ebooks-carousel-container');
            if (!feed) return;

            // Marca que o usuário viu o mercado agora
            localStorage.setItem('dito_market_last_seen', Date.now().toString());

            let all = (this.products || [])
                .filter(p => p.visible !== false && p.visible !== 'false' && p.visible !== 0);
            
            // --- ORDENAR POR NOVOS PRIMEIRO (DESC) ---
            all = all.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));

            // --- FILTRO POR NICHO (NOVO) ---
            const currentCat = this.marketCategory || 'Todas';
            if (currentCat !== 'Todas') {
                all = all.filter(p => p.category === currentCat);
            }

            if (all.length === 0 && currentCat === 'Todas') {
                // Mercado começa vazio para os usuários cadastrarem seus produtos
                localStorage.setItem('dito_products', '[]');
            }

            // 0. LIVES AO VIVO (Stories Style)
            const liveContainer = document.getElementById('live-horizontal-list');
            const liveWrapper = document.getElementById('live-carousel-container');
            const activeLives = all.filter(p => p.type === 'Mentoria');

            if (liveContainer && liveWrapper) {
                liveWrapper.style.display = activeLives.length > 0 ? 'block' : 'none';
                liveContainer.innerHTML = activeLives.map(p => `
                    <div onclick="app.viewProduct('${p.id}')" style="display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; flex-shrink: 0; width: 72px;">
                        <div style="width: 72px; height: 72px; border-radius: 50%; padding: 3px; background: linear-gradient(45deg, #ff005c, #ff3366); display: flex; align-items: center; justify-content: center; position: relative; box-shadow: 0 4px 15px rgba(255,0,92,0.3);">
                            <div style="width: 100%; height: 100%; border-radius: 50%; overflow: hidden; background: #fff; border: 2px solid #fff; display: flex; align-items: center; justify-content: center;">
                                <img src="${this.rGetPImage(p.image, p.name)}" style="width: 100%; height: 100%; object-fit: cover;">
                            </div>
                        </div>
                        <span style="font-size: 9px; font-weight: 800; color: #fff; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; line-height: 1.2;">${p.name}</span>
                    </div>
                `).join('');
            }

            // 1. DESTAQUES: Novos primeiro (Horizontal)
            const arrival = [...all].sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));

            if (hContainer && hWrapper) {
                hWrapper.style.display = arrival.length > 0 ? 'block' : 'none';
                hContainer.innerHTML = arrival.map(p => {
                    const isMentoria = p.type === 'Mentoria';
                    const hasImage = p.image && p.image !== "" && p.image !== "null";
                    const imgContainer = isMentoria ? `
                        <div style="aspect-ratio: 1; border-radius: 50%; padding: 3px; background: linear-gradient(45deg, #ff005c, #ff3366); display: flex; align-items: center; justify-content: center; margin-bottom: 12px; position: relative; box-shadow: 0 4px 15px rgba(255,0,92,0.3); overflow: visible; flex-shrink: 0;">
                            <span style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); background: #ff005c; color: white; font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 6px; border: 2px solid #fff; letter-spacing: 1px; z-index: 2;">AO VIVO</span>
                            <div style="width: 100%; height: 100%; border-radius: 50%; overflow: hidden; background: ${hasImage ? '#fff' : this.rGetMentoriaBg(null)}; border: 2px solid #fff; display: flex; align-items: center; justify-content: center; background-size: cover; background-position: center;">
                                ${hasImage ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : ''}
                            </div>
                        </div>
                    ` : `
                        <div style="aspect-ratio: 1; background: #f9f9f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; overflow: hidden; flex-shrink: 0;">
                            <img src="${this.rGetPImage(p.image, p.name)}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                    `;
                    
                    return `
                    <div onclick="app.viewProduct('${p.id}')" style="width: 165px; min-width: 165px; background: #fff; border-radius: 6px; border: 1px solid #f2f2f2; cursor: pointer; scroll-snap-align: start; display: flex; flex-direction: column; box-shadow: 0 4px 20px rgba(0,0,0,0.03); overflow: hidden; transition: 0.3s; position: relative;">
                        ${isMentoria ? `
                            <div style="padding: 12px; display: flex; flex-direction: column; align-items: center;">
                                ${imgContainer}
                            </div>
                        ` : `
                            <div style="width: 100%; aspect-ratio: 1; background: #f9f9f9; overflow: hidden;">
                                <img src="${this.rGetPImage(p.image, p.name)}" style="width: 100%; height: 100%; object-fit: cover;">
                            </div>
                        `}
                        
                        <div style="padding: 10px; display: flex; flex-direction: column; gap: 4px; flex-grow: 1;">
                            <h4 style="font-weight: 900; font-size: 11px; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0;">${isMentoria ? 'Mentoria Privada' : p.name}</h4>
                            <div style="display: flex; gap: 2px;">
                                <i data-lucide="star" style="width: 7px; color: #facc15; fill: #facc15;"></i>
                                <i data-lucide="star" style="width: 7px; color: #facc15; fill: #facc15;"></i>
                                <i data-lucide="star" style="width: 7px; color: #facc15; fill: #facc15;"></i>
                                <i data-lucide="star" style="width: 7px; color: #facc15; fill: #facc15;"></i>
                                <i data-lucide="star" style="width: 7px; color: #facc15; fill: #facc15;"></i>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
                                <span style="font-weight: 900; font-size: 14px; color: #ff005c;">R$ ${parseFloat(p.price || 0).toFixed(2)}</span>
                                <span style="font-size: 8px; font-weight: 800; color: #ccc;">${isMentoria ? 'Transmitindo' : `${p.salesCount || 0} v.`}</span>
                            </div>
                        </div>
                    </div>
                `}).join('');
            }

            // 2. TODOS (Grid Vertical Justo)
            feed.style.gap = '8px';
            feed.style.background = 'transparent'; 
            feed.innerHTML = all.map(p => {
                const isMentoria = p.type === 'Mentoria';
                const imgContainer = isMentoria ? `
                    <div style="aspect-ratio: 1; border-radius: 50%; padding: 3px; background: linear-gradient(45deg, #ff005c, #ff3366); display: flex; align-items: center; justify-content: center; margin-bottom: 12px; position: relative; box-shadow: 0 4px 15px rgba(255,0,92,0.3); overflow: visible;">
                        <span style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); background: #ff005c; color: white; font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 6px; border: 2px solid #fff; letter-spacing: 1px; z-index: 2;">AO VIVO</span>
                        <div style="width: 100%; height: 100%; border-radius: 50%; overflow: hidden; background: #fff; border: 2px solid #fff; display: flex; align-items: center; justify-content: center;">
                            <img src="${this.rGetPImage(p.image, p.name)}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                    </div>
                ` : `
                    <div style="aspect-ratio: 1; background: #f9f9f9; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; overflow: hidden;">
                        <img src="${this.rGetPImage(p.image, p.name)}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                `;

                return `
                <div onclick="app.viewProduct('${p.id}')" style="background: #fff; border-radius: 6px; border: 1px solid #f2f2f2; cursor: pointer; display: flex; flex-direction: column; box-shadow: 0 4px 20px rgba(0,0,0,0.03); overflow: hidden; transition: 0.3s; position: relative;">
                    ${isMentoria ? `
                        <div style="padding: 12px; display: flex; flex-direction: column; align-items: center;">
                            ${imgContainer}
                        </div>
                    ` : `
                        <div style="width: 100%; aspect-ratio: 1; background: #f9f9f9; overflow: hidden;">
                            <img src="${this.rGetPImage(p.image, p.name)}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                    `}
                    
                    <div style="padding: 10px; display: flex; flex-direction: column; gap: 4px; flex-grow: 1;">
                        <h4 style="font-weight: 900; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0; color: #000;">${isMentoria ? 'Mentoria Privada' : p.name}</h4>
                        <div style="display: flex; gap: 2px;">
                            <i data-lucide="star" style="width: 7px; color: #facc15; fill: #facc15;"></i>
                            <i data-lucide="star" style="width: 7px; color: #facc15; fill: #facc15;"></i>
                            <i data-lucide="star" style="width: 7px; color: #facc15; fill: #facc15;"></i>
                            <i data-lucide="star" style="width: 7px; color: #facc15; fill: #facc15;"></i>
                            <i data-lucide="star" style="width: 7px; color: #facc15; fill: #facc15;"></i>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
                            <span style="font-weight: 900; font-size: 14px; color: #000;">R$ ${parseFloat(p.price || 0).toFixed(2)}</span>
                            <span style="font-size: 8px; font-weight: 800; color: #ccc;">${isMentoria ? 'Transmitindo' : `${p.salesCount || 0} v.`}</span>
                        </div>
                    </div>
                </div>
            `}).join('');

            if (window.lucide) lucide.createIcons();
        },

        addToCartDirectly(id, event) {
            if (event) event.stopPropagation();
            const p2 = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
            const product = p2.find(p => p.id === id);
            if (product) {
                this.cart.push(product);
                this.safeLocalStorageSet(`dito_cart_${this.getUserKey()}`, JSON.stringify(this.cart));
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
        if (!query || query.length < 1) { if (resultsContainer) resultsContainer.style.display = 'none'; return; }
        
        // Unifica as fontes de usuários
        const db1 = JSON.parse(localStorage.getItem('dito_users_db') || '[]');
        const db2 = JSON.parse(localStorage.getItem('dito_usuarios_vanilla') || '[]');
        const db3 = JSON.parse(localStorage.getItem('dito_usuarios') || '[]');
        
        // Remove duplicados pelo username
        const allUsers = [...db1, ...db2, ...db3];
        const uniqueUsers = Array.from(new Map(allUsers.map(u => [u.username, u])).values());

        const filtered = uniqueUsers.filter(u => 
            (u.username && u.username.toLowerCase().includes(query.toLowerCase())) || 
            (u.name && u.name.toLowerCase().includes(query.toLowerCase()))
        );
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
        
        // Busca priorizando a memória (RAM)
        const user = (this.networkUsers && this.networkUsers.find(u => u.username === username)) || 
                     JSON.parse(localStorage.getItem('dito_usuarios') || '[]').find(u => u.username === username) || 
                     { username, name: username, bio: 'Membro da Dito Pro', fans: 0, sales: 0 };
                     
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
                
                if (revEl) {
                    const salesVal = parseFloat(user.sales || 0);
                    revEl.innerText = (user.showRevenue === false) ? "Privado" : `R$ ${salesVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                }

                if (avatarEl) avatarEl.innerHTML = `<img src="${this.rGetPImage(user.avatar, user.username)}" style="width:100%; height:100%; object-fit:cover;">`;
                
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

    app.getUserReferralCode = function() {
        if (!app.currentUser) return '';
        // Gera um código de 6 caracteres baseado no ID para ser curto e profissional
        const id = app.currentUser.id || Date.now();
        const fullCode = id.toString(36).toUpperCase();
        return fullCode.slice(-6); // Pega apenas os últimos 6 caracteres
    };

    app.shareReferralLink = function() {
        if (!app.currentUser) {
            app.showNotification('Faça login para pegar seu link de indicação!', 'error');
            return;
        }

        const code = app.getUserReferralCode();
        // Domínio oficial e profissional solicitado
        const domain = "dito-saas.vercel.app";
        const prettyLink = `https://${domain}/convite/${code}`;
        
        const modal = document.getElementById('referral-modal');
        const textEl = document.getElementById('referral-link-text');
        
        if (modal && textEl) {
            textEl.innerText = prettyLink; 
            modal.style.display = 'flex';
            if (window.lucide) lucide.createIcons();
        }
    };

    app.copyReferralLink = function() {
        const textEl = document.getElementById('referral-link-text');
        if (!textEl) return;

        const workingLink = textEl.innerText;

        navigator.clipboard.writeText(workingLink).then(() => {
            app.showSystemNotification('Link Copiado!', 'Mande para seus amigos e garanta seus +100 cupons.', 'success');
            
            document.getElementById('referral-modal').style.display = 'none';
        }).catch(err => {
            app.showNotification('Erro ao copiar.', 'error');
        });
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
        const allLists = ['dito_usuarios', 'dito_network_users', 'dito_usuarios_vanilla', 'dito_users_db'];
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
        if (label) {
            const brute = parseFloat(value) || 0;
            const net = brute * 0.93; // 3% Dito + 4% MP = 7% total
            label.innerHTML = `
                <div style="margin-top: 10px; margin-left: 12px;">
                    <p style="font-size: 14px; font-weight: 900; color: #22c55e; margin-bottom: 2px;">Você receberá: R$ ${net.toFixed(2)}</p>
                    <p style="font-size: 9px; color: #999; font-weight: 600;">(Já descontando 3% da Dito + taxas do Mercado Pago)</p>
                </div>
            `;
        }
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
        const key = app.getUserKey ? app.getUserKey() : 'guest';
        const coins = parseInt(localStorage.getItem(`dito_coins_${key}`) || '0');
        const gCoin = document.getElementById('global-coin-balance');
        const pCoin = document.getElementById('coins-page-balance');
        if (gCoin) gCoin.innerText = coins;
        if (pCoin) pCoin.innerText = coins;
        const hasP = localStorage.getItem('dito_purchased_products');
        const badge = document.getElementById('first-purchase-badge');
        if (badge) badge.style.display = (hasP && JSON.parse(hasP).length > 0) ? 'none' : 'flex';
        if (window.lucide) lucide.createIcons();
    };



    app.addRewardCoins = function(amount, reason) {
        const key = this.getUserKey ? this.getUserKey() : 'guest';
        const current = parseInt(localStorage.getItem(`dito_coins_${key}`) || '0');
        localStorage.setItem(`dito_coins_${key}`, (current + amount).toString());
        this.showNotification(`+${amount} Cupons! (${reason})`, 'success');
        this.updateCoinsUI();
    };

    app.applyCoinDiscount = function(sliderValue) {
        const slider = document.getElementById('coin-discount-slider');
        const label = document.getElementById('coins-to-use-label');
        if (label) label.innerText = sliderValue;
        
        if (slider) {
            const max = parseInt(slider.max) || 1;
            const percentage = (parseInt(sliderValue) / max) * 100;
            // Altera a variável de CSS para pintar o rastro
            slider.style.setProperty('--range-progress', percentage + '%');
        }

        this.recalculateCheckoutTotal();
    };

    app.recalculateCheckoutTotal = function() {
        const totalBase = this.cart.reduce((acc, i) => acc + parseFloat(i.price || 0), 0);
        let final = totalBase;
        
        // Limita o desconto das cupons em no máximo 75%
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
                    <img src="${this.rGetPImage(p.image, p.name)}" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div style="flex:1;"><h4 style="font-weight:900; font-size:14px;">${p.name}</h4><p style="font-size:10px; color:#999;">${p.type} • R$ ${parseFloat(p.price).toFixed(2)}</p></div>
                <div style="display:flex; gap:8px;">
                    <button onclick="app.openCourse('${String(p.id)}')" title="Ver Produto" style="width:40px; height:40px; background:#f0f9ff; color:#0369a1; border:none; border-radius:12px; cursor:pointer;"><i data-lucide="external-link" style="width:18px;"></i></button>
                    <button onclick="app.editProduct('${String(p.id)}')" title="Editar" style="width:40px; height:40px; background:#f5faff; color:#0e7490; border:none; border-radius:12px; cursor:pointer;"><i data-lucide="edit-3" style="width:18px;"></i></button>
                    <button onclick="app.deleteProduct('${String(p.id)}', '${(p.name || '').replace(/'/g, "\\'")}')" title="Excluir" style="width:40px; height:40px; background:#fee2e2; color:#ef4444; border:none; border-radius:12px; cursor:pointer;"><i data-lucide="trash-2" style="width:18px;"></i></button>
                </div>
            </div>`).join('');
        if (window.lucide) lucide.createIcons();
    };


    app.toggleMarketSearch = function(show) {
        const title = document.getElementById('market-title-container');
        const container = document.getElementById('market-search-container');
        const input = document.getElementById('market-search');
        const searchBtn = document.getElementById('btn-market-search');
        const closeBtn = document.getElementById('btn-market-close-search');
        const results = document.getElementById('market-search-results');

        if (show) {
            if(title) { title.style.opacity = '0'; title.style.transform = 'translateX(-50%) translateY(-20px)'; }
            if(container) { 
                container.style.opacity = '1'; 
                container.style.transform = 'translateX(0)'; 
                container.style.pointerEvents = 'all';
            }
            if(searchBtn) searchBtn.style.display = 'none';
            if(closeBtn) closeBtn.style.display = 'flex';
            if(input) {
                setTimeout(() => input.focus(), 400);
            }
        } else {
            if(title) { title.style.opacity = '1'; title.style.transform = 'translateX(-50%) translateY(0)'; }
            if(container) { 
                container.style.opacity = '0'; 
                container.style.transform = 'translateX(100%)'; 
                container.style.pointerEvents = 'none';
            }
            if(searchBtn) searchBtn.style.display = 'flex';
            if(closeBtn) closeBtn.style.display = 'none';
            if(input) {
                input.value = '';
                this.filterMarket('');
            }
            if(results) results.style.display = 'none';
        }
    };


    app.filterMarket = function(query) {
        const results = document.getElementById('market-search-results');
        if (!query || query.length < 1) { 
            if (results) {
                results.classList.remove('active');
                results.style.display = 'none';
            }
            return; 
        }
        
        const market = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
        const filtered = market.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
        
        if (filtered.length > 0) {
            results.innerHTML = filtered.map(p => `
                <div onclick="app.viewProduct('${p.id}')" style="display:flex; align-items:center; gap:14px; padding:16px; cursor:pointer; border-bottom:1px solid #f5f5f5; transition: 0.2s;" onmouseover="this.style.background='#f9f9f9'" onmouseout="this.style.background='#fff'">
                    <div style="width:44px; height:44px; background:#f0f0f0; border-radius:12px; display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink: 0;">
                        <img src="${this.rGetPImage(p.image, p.name)}" style="width:100%; height:100%; object-fit:cover;">
                    </div>
                    <div style="flex: 1;">
                        <p style="font-weight:900; font-size:13px; color: #000; margin: 0; line-height: 1.2;">${p.name}</p>
                        <p style="font-size:11px; color:#10b981; font-weight:900; margin-top: 2px;">R$ ${parseFloat(p.price).toFixed(2)}</p>
                    </div>
                    <i data-lucide="chevron-right" style="width: 14px; color: #ccc;"></i>
                </div>`).join('');
            
            results.classList.add('active');
            if (window.lucide) lucide.createIcons();
        } else {
            results.innerHTML = `<div style="padding:20px; color:#999; text-align:center; font-size: 11px; font-weight: 800;">NENHUM PRODUTO ENCONTRADO</div>`;
            results.classList.add('active');
        }
    };


    // ==========================================
    // 🔔 SISTEMA DE NOTIFICAÇÕES (NET)
    // ==========================================

    app.toggleNotifDrawer = function(show) {
        const drawer = document.getElementById('notif-drawer');
        const overlay = document.getElementById('notif-overlay');
        if (drawer) {
            if (overlay) overlay.style.display = show ? 'block' : 'none';
            drawer.style.right = show ? '0' : '-100%';
            if (show) {
                this.renderNotifications();
                this.markNotificationsAsRead();
            }
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
                
                // Processa Recompensas de Indicação Pendentes
                let processedRefs = JSON.parse(localStorage.getItem('dito_processed_refs') || '[]');
                let coinsToAdd = 0;
                
                this.notifications.forEach(n => {
                    if (n.type === 'referral_225' && !processedRefs.includes(n.id)) {
                        coinsToAdd += 225;
                        processedRefs.push(n.id);
                    }
                });
                
                if (coinsToAdd > 0) {
                    const key = this.getUserKey();
                    let currentCoins = parseInt(localStorage.getItem(`dito_coins_${key}`) || '0');
                    localStorage.setItem(`dito_coins_${key}`, (currentCoins + coinsToAdd).toString());
                    localStorage.setItem('dito_processed_refs', JSON.stringify(processedRefs));
                    this.showSystemNotification('Você ganhou Moedas! 💰', `Resgate de Indicações recebido: +${coinsToAdd} cupons!`, 'success');
                }

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
                const notif = payload.new;
                console.log('🔔 Nova notificação em tempo real:', notif);
                
                // Despacha para o processador central
                this.processIncomingNotification(notif);

                if (!this.notifications) this.notifications = [];
                this.notifications.unshift(notif);
                this.renderNotifications();
                this.updateNotifBadge(true);
                this.playNotifSound();
            })
            .subscribe();

        // 3. MONITORAMENTO DE PRODUTOS REAL-TIME (Para Mentor/Live Link)
        supabase.channel('products-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'dito_market_products' }, payload => {
                console.log("♻️ [RealTime] Produto atualizado na rede:", payload);
                this.fetchNetworkProducts(true);
            })
            .subscribe();


        // Escuta novas MENSAGENS DE CHAT (Sistema mais resiliente sem filtros pesados)
        supabase
            .channel('realtime_chat_resilient')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'dito_messages' 
            }, (payload) => {
                const msg = payload.new;
                
                // 1. Injeta sempre na Rádio se estiver aberta e for da sala certa
                const worldDrawer = document.getElementById('world-chat-drawer');
                const room = this.activeWorldRoom || 'GLOBAL';

                if (worldDrawer) {
                    const isActive = worldDrawer.classList.contains('active');
                    const isSocDetail = this.currentView === 'sociedade-detalhe';
                    const socRoom = isSocDetail ? `SOC_${this.currentSocietyId}` : 'SOC_GLOBAL';
                    
                    const isMyRoom = msg.receiver === room;
                    const isSocRoom = msg.receiver === socRoom;
                    const isForMe = msg.receiver === this.currentUser.username || msg.sender === this.currentUser.username;
                    
                    if (isMyRoom || isSocRoom || isForMe) {
                        if (isActive) {
                            this.appendWorldMessageToChat(msg);
                        } else if (msg.sender !== this.currentUser.username) {
                            // Se fechei a sala e recebi msg de GLOBAL ou da MINHA LIVE, avisa
                            const dot = document.getElementById('dot-world-chat');
                            if (dot) dot.style.display = 'block';
                        }
                    }
                }
                
                // 2. Não processa notificação de chat direto se não for pra mim (Ou se for Global)
                if (msg.receiver !== this.currentUser.username || msg.receiver === 'GLOBAL' || msg.receiver === 'SOC_GLOBAL') return;

                console.log('📨 Nova mensagem recebida:', msg);
                
                // Se o chat com essa pessoa está aberto, adiciona na tela
                if (this.activeChatUser === msg.sender) {
                    this.appendMessageToChat(msg);
                    this.saveMessageToLocal(msg); // Salva no cache mesmo aberto
                } else {
                    // Senão, marca como não lida
                    if (!this.unreadMessages) this.unreadMessages = {};
                    this.unreadMessages[msg.sender] = true;
                    localStorage.setItem('dito_unread_messages', JSON.stringify(this.unreadMessages));
                    
                    this.saveMessageToLocal(msg); // Salva no cache em background
                    this.markLastInteraction(msg.sender); // Registra interação para organizar lista
                    
                    // Atualiza o ponto no menu principal
                    this.updateFriendsNotifBadge();
                    
                    this.showNotification(`Mensagem de ${msg.sender}: ${msg.content.substring(0, 20)}...`, 'info');
                    this.playNotifSound();
                    
                    // Se for na tela de amigos, atualiza visualmente para mostrar a bolinha amarela
                    if (this.currentView === 'friends' || document.getElementById('friends-drawer').classList.contains('active')) {
                        this.showOnlineFriends(); 
                    }
                }
            })
            .subscribe((status) => {
                console.log("📡 [Chat] Status da conexão Realtime:", status);
            });
    };

    app.processIncomingNotification = function(notif) {
        // 1. Lógica de VENDA
        if (notif.type === 'venda' || notif.type === 'sale' || notif.title.toLowerCase().includes('venda realizado')) {
            const key = this.getUserKey();
            const history = JSON.parse(localStorage.getItem(`dito_real_sales_history_${key}`) || '[]');
            const valueMatch = notif.message.match(/R\$\s?([0-9.,]+)/);
            if (valueMatch) {
                const val = parseFloat(valueMatch[1].replace(',', '.'));
                history.unshift({ 
                    id: notif.id, 
                    value: val, 
                    timestamp: Date.now(),
                    date: new Date().toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'}),
                    fullDate: new Date().toLocaleDateString('pt-BR'),
                    productName: 'Venda Realizada',
                    isSale: true 
                });
                localStorage.setItem(`dito_real_sales_history_${key}`, JSON.stringify(history));
                this.updateBalanceUI();
                this.playNotifSound();
                if (this.currentView === 'vendas') this.renderSales();
            }
        }

        // 2. Lógica de COMPRA APROVADA
        if (notif.type === 'compra_aprovada') {
            const productNameMatch = notif.message.match(/"([^"]+)"/);
            const prodName = productNameMatch ? productNameMatch[1] : "seu produto";
            this.showSystemNotification('Acesso Liberado!', `O produto "${prodName}" já está na sua área de membros.`, 'success');
            this.fetchPurchasedProducts(); 
            if (this.currentView === 'meus-cursos') this.renderPurchasedProducts();
            this.playNotifSound();
        }

        // 3. Lógica de INDICAÇÃO
        if (notif.type === 'referral_225') {
            let processedRefs = JSON.parse(localStorage.getItem('dito_processed_refs') || '[]');
            if (!processedRefs.includes(notif.id)) {
                const key = this.getUserKey();
                let currentCoins = parseInt(localStorage.getItem(`dito_coins_${key}`) || '0');
                localStorage.setItem(`dito_coins_${key}`, (currentCoins + 100).toString());
                processedRefs.push(notif.id);
                localStorage.setItem('dito_processed_refs', JSON.stringify(processedRefs));
                this.showSystemNotification('Saldo Atualizado', 'Um amigo entrou! +100 cupons creditados!', 'success');
                this.updateCoinsUI();
            }
        }
    };

    app.simulatePurchase = function() {
        const dummyProduct = {
            id: 'PROD_TESTE_' + Date.now(),
            name: 'Curso Dito Pro (E-book incluso)',
            type: 'Curso',
            image: '',
            seller: 'admin',
            price: 0,
            content: [
                {
                    id: 'mod1',
                    title: 'Iniciando no Dito',
                    lessons: [
                        { id: 'aula1', title: 'Boas vindas ao ecossistema', fileName: '' }
                    ]
                }
            ]
        };

        // Injeta na lista de compras local para o teste aparecer
        if (!this.purchasedProducts) this.purchasedProducts = [];
        this.purchasedProducts.unshift(dummyProduct);

        this.processIncomingNotification({
            id: Date.now(),
            type: 'compra_aprovada',
            title: 'Acesso Liberado!',
            message: 'O produto "' + dummyProduct.name + '" foi liberado!',
            created_at: new Date().toISOString()
        });
        
        if (this.currentView === 'meus-cursos') this.renderPurchasedProducts();
        this.launchVictoryConfetti();
    };

    app.testFullFlow = async function() {
        this.showLoading(true, "Iniciando teste de fluxo...");
        setTimeout(() => {
            this.simulateSale(); // Testa o lado do vendedor
            setTimeout(() => {
                this.simulatePurchase(); // Testa o lado do comprador
                this.showNotification("Teste concluído! Verifique seu saldo e área de membros.", "success");
                this.showLoading(false);
            }, 1000);
        }, 1000);
    };

    app.renderNotifications = function() {
        const container = document.getElementById('notif-list-content');
        if (!container) return;

        const list = this.notifications || [];
        let listHtml = '';
        
        // 1. Injeta virtualmente a notificação de Sociedade se houver pendências
        if (this.hasPendingSocietyRequests) {
            listHtml += `
                <div onclick="app.navigate('sociedade'); app.toggleNotifDrawer(false);" style="padding: 16px; background: #fffdf0; border-radius: 20px; border: 1.5px solid #ffd600; display: flex; gap: 14px; position: relative; margin-bottom: 12px; cursor: pointer;">
                    <div style="position: absolute; top: 12px; right: 12px; width: 8px; height: 8px; background: #ffd600; border-radius: 50%;"></div>
                    <div style="width: 44px; height: 44px; background: #ffd60020; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <i data-lucide="users" style="width: 20px; color: #b8860b;"></i>
                    </div>
                    <div style="flex: 1;">
                        <h4 style="font-size: 13px; font-weight: 900; color: #000; margin-bottom: 2px;">Solicitações de Entrada</h4>
                        <p style="font-size: 11px; font-weight: 600; color: #666; line-height: 1.4;">Existem membros aguardando aprovação na sua Sociedade.</p>
                        <span style="font-size: 9px; font-weight: 900; color: #b8860b; text-transform: uppercase; margin-top: 8px; display: block;">Clique para gerenciar →</span>
                    </div>
                </div>
            `;
        }

        if (list.length === 0 && !this.hasPendingSocietyRequests) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #ccc;">
                    <i data-lucide="bell-off" style="width: 32px; margin-bottom: 12px; opacity: 0.3;"></i>
                    <p style="font-size: 11px; font-weight: 800;">Silêncio por aqui...</p>
                </div>
            `;
        } else {
            container.innerHTML = listHtml + list.map(n => {
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
        const dotHeader = document.getElementById('notif-dot-header');
        const list = this.notifications || [];
        const unreadCount = list.filter(n => !n.read).length;
        
        // Só mostra se houver unread ou se o número de pedidos de sociedade for MAIOR que o que o usuário já viu
        const hasNewSociety = (this.societyPendingCount || 0) > (this.lastSeenSocietyCount || 0);

        if (dotHeader) dotHeader.style.display = (unreadCount > 0 || hasNewSociety) ? 'block' : 'none';
        
        if (badge) {
            badge.style.display = (unreadCount > 0 || hasNewSociety) ? 'block' : 'none';
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
            
            // "Lê" também as solicitações de sociedade visualmente
            this.lastSeenSocietyCount = this.societyPendingCount || 0;
            
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

    app.enterMentorshipRoom = function(id) {
        const prod = this.products.find(p => String(p.id) === String(id));
        if (prod) {
            this.selectedProduct = prod;
            this.navigate('mercado');
            setTimeout(() => {
                this.setMarketView('live-room');
            }, 50);
        } else {
            this.showNotification("Não foi possível acessar a sala agora.", "error");
        }
    };

    app.playNotifSound = function() {
        if (navigator.vibrate) navigator.vibrate(100);
    };

    app.fetchPurchasedProducts = async function() {
        if (!supabase || !this.currentUser) return;
        const key = this.getUserKey();
        try {
            const { data, error } = await supabase.from('dito_users').select('purchases').eq('username', this.currentUser.username).maybeSingle();
            if (data && data.purchases) {
                const cloudPurchases = typeof data.purchases === 'string' ? JSON.parse(data.purchases) : data.purchases;
                // O campo purchases no dito_users armazena tanto saldo (para vendedores) quanto acesso (para compradores)
                // Vamos filtrar apenas o que é item de acesso para o comprador
                const myItems = cloudPurchases.filter(p => !p.type || p.type !== 'sale');
                
                if (myItems.length > 0) {
                    this.purchasedProducts = myItems;
                    localStorage.setItem(`dito_purchased_products_${key}`, JSON.stringify(this.purchasedProducts));
                    
                    // Atualiza a tela se o usuário estiver vendo os cursos
                    if (this.currentView === 'meus-cursos') {
                        this.renderPurchasedProducts();
                    }
                    // Atualiza o Dashboard se houver lista de compras lá também
                    this.updateBalanceUI(); 
                }
            }
        } catch (e) {
            console.error("Erro ao sincronizar compras:", e);
        }
    };

    app.toggleTerms = function(show) {
        const modal = document.getElementById('terms-modal');
        if (modal) {
            modal.style.display = show ? 'flex' : 'none';
        }
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


    app.resetCoins = function() {
        if (!this.currentUser) return;
        const key = this.getUserKey();
        localStorage.setItem(`dito_coins_${key}`, "0");
        this.currentUser.coins = 0;
        localStorage.setItem('current_user_vanilla', JSON.stringify(this.currentUser));
        this.showNotification('Cupons zerados com sucesso!', 'success');
        if (this.currentView === 'missoes') this.renderMissions();
    };

    // --- SISTEMA DE LINKS DE VENDA ---
    app.renderLinks = function() {
        const container = document.getElementById('links-list-container');
        if (!container) return;

        const myProducts = this.products.filter(p => p.seller === this.currentUser?.username);
        
        if (myProducts.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; background: #fafafa; border-radius: 24px; border: 1px dashed #eee;">
                    <i data-lucide="package-search" style="width: 32px; color: #ccc; margin-bottom: 12px;"></i>
                    <p style="font-size: 13px; font-weight: 800; color: #999;">Voce ainda nao criou produtos.</p>
                </div>
            `;
            if (window.lucide) lucide.createIcons();
            return;
        }

        const prodDomain = "https://dito-saas.vercel.app";
        const isLocalFile = window.location.protocol === 'file:';

        container.innerHTML = myProducts.map(p => {
            // Link de Producao (O que voce vai mandar para clientes)
            const shareUrl = `${prodDomain}/p/${p.id}`;
            // Link de Teste Local (So funciona no seu PC)
            const localTestUrl = `${window.location.pathname}?checkout=${p.id}`;

            
            return `
                <div style="background: #fff; border-radius: 20px; padding: 16px; display: flex; align-items: center; gap: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                    <div style="width: 50px; height: 50px; background: #f5f5f5; border-radius: 12px; background-image: url('${p.image || ''}'); background-size: cover; background-position: center;">
                        ${!p.image ? `<div style="display:flex; align-items:center; justify-content:center; height:100%"><i data-lucide="package" style="width:20px; color:#ccc"></i></div>` : ''}
                    </div>
                    <div style="flex: 1; overflow: hidden;">
                        <h4 style="font-size: 14px; font-weight: 950; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">${p.name}</h4>
                        <p style="font-size: 10px; font-weight: 700; color: #0487ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: none;">/${p.slug || p.id}</p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="app.copyToClipboard('${shareUrl}', 'Link de Venda copiado!')" title="Copiar link para clientes" style="width: 40px; height: 40px; border-radius: 12px; background: #000; color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                            <i data-lucide="share-2" style="width: 18px;"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        if (window.lucide) lucide.createIcons();
    };

    app.copyToClipboard = function(text, successMsg) {
        // Tenta HTTPS Clipboard API primeiro
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                this.showNotification(successMsg || 'Copiado!', 'success');
            }).catch(() => this.fallbackCopy(text, successMsg));
        } else {
            this.fallbackCopy(text, successMsg);
        }
    };

    app.fallbackCopy = function(text, successMsg) {
        const inp = document.createElement('textarea'); // Textarea é melhor para multiline se houver
        inp.value = text;
        inp.style.position = 'fixed';
        inp.style.opacity = '0';
        document.body.appendChild(inp);
        inp.select();
        try {
            document.execCommand('copy');
            this.showNotification(successMsg || 'Copiado!', 'success');
        } catch (err) {
            console.error('Falha ao copiar:', err);
        }
        document.body.removeChild(inp);
    };

    app.generateRandomSlug = function(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    app.checkSocietyPendingRequests = async function() {
        if (!supabase || !this.currentUser) return;
        try {
            const { data: mySocs } = await supabase.from('dito_societies').select('id').eq('owner', this.currentUser.username);
            if (!mySocs || mySocs.length === 0) {
                this.hasPendingSocietyRequests = false;
                this.updateNotifBadge();
                return;
            }
            const socIds = mySocs.map(s => s.id);
            const { count, error } = await supabase
                .from('dito_society_requests')
                .select('*', { count: 'exact', head: true })
                .in('society_id', socIds);
            if (!error) {
                this.societyPendingCount = count || 0;
                this.hasPendingSocietyRequests = (this.societyPendingCount > 0);
                this.updateNotifBadge();
            }
        } catch (e) {
            console.error("Erro ao checar solicitações:", e);
        }
    };

    app.optimizeStorageOnNavigation = function() {
        // Remove dados transientes para garantir espaço em tempo real
        const transientKeys = [
            'dito_temp_image',
            'dito_social_results',
            'dito_last_search'
        ];
        transientKeys.forEach(k => localStorage.removeItem(k));
        
        // Compacta históricos se estiverem muito grandes (> 50 itens)
        const historicalKeys = ['dito_checkin_history', 'dito_market_notifications'];
        historicalKeys.forEach(k => {
            try {
                let data = JSON.parse(localStorage.getItem(k) || '[]');
                if (data.length > 50) {
                    localStorage.setItem(k, JSON.stringify(data.slice(0, 10))); // Mantém só os 10 mais recentes
                }
            } catch(e) {}
        });
    };

    app.resetStorage = async function() {
        if (confirm("⚠️ Isso irá limpar TODA a memória local do app (histórico, produtos locais, etc). Seus dados no Supabase estão seguros. Continuar?")) {
            localStorage.clear();
            location.reload();
        }
    };

    window.app = app;
    app.init();
})();
