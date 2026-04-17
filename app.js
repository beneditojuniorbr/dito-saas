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
            const hideSplash = () => {
                const s = document.getElementById('splash-screen');
                if (s) { s.style.opacity = '0'; s.style.pointerEvents = 'none'; setTimeout(() => s.remove(), 400); }
            };

            try {
                // Tenta conectar ao banco em background
                initSupabase(); 
                setTimeout(hideSplash, 1500); 

                // Captura Link de Convite (Suporta ?ref=CODE e /convite/CODE)
                const urlParams = new URLSearchParams(window.location.search);
                let refCode = urlParams.get('ref');
                
                // Se não estiver no parâmetro, tenta pegar do caminho da URL (/convite/ABC)
                if (!refCode && window.location.pathname.includes('/convite/')) {
                    const parts = window.location.pathname.split('/');
                    refCode = parts[parts.length - 1];
                }

                if (refCode) {
                    localStorage.setItem('dito_pending_ref', refCode);
                    // Limpa a URL para o usuário não ver o código técnico
                    window.history.replaceState({}, document.title, '/');
                }

                // Carrega dados locais
                this.products = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
                // Iniciado via initAutoLogout embaixo


                const savedUser = localStorage.getItem('current_user_vanilla');
                if (savedUser) {
                    this.currentUser = JSON.parse(savedUser);
                    this.loadUserScopedData(); // Carrega sacola e compras do usuário
                }
                
                // Conexão Única Inicial (Não bloqueante para mobile voar 🚀)
                this.fetchNetworkUsers();
                this.fetchNetworkProducts();

                this.checkLiveAdminStatus(); // Radar Automático ao Iniciar
                
                // Polling de segurança (20s - mais suave para não resetar scroll)
                setInterval(() => {
                    this.fetchNetworkUsers();
                    this.fetchNetworkProducts();
                }, 20000);

                // Inicia Canais Realtime (Supabase)
                if (supabase) {
                    // 1. Radar de Produtos
                    supabase
                        .channel('public:dito_market_products')
                        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'dito_market_products' }, payload => {
                            console.log('✨ Novo produto detectado em tempo real!');
                            this.fetchNetworkProducts();
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
                                this.showSystemNotification('Lucro Acumulado', `Você ganhou +${newlyProcessed * 225} cupons por indicações enquanto estava fora!`, 'success');
                            }
                        }
                    }
                }, 2000);

                this.checkMissionsNotification();

                // RESTAURAÇÃO DE ESTADO (F5 Seguro)
                const lastView = localStorage.getItem('dito_last_view') || 'dashboard';
                const isLoggedIn = localStorage.getItem('is_logged_in_vanilla') === 'true';

                if (isLoggedIn && this.currentUser) {
                    console.log("📍 [System] Restaurando sessão em:", lastView);
                    this.navigate(lastView);
                } else {
                    console.log("👋 [System] Nenhuma sessão ativa, indo para login.");
                    this.navigate('login');
                }
                
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

        initSystemBackButton() {
            // Inicializa o primeiro estado
            if (!window.history.state) {
                window.history.replaceState({ view: 'dashboard' }, '', '');
            }

            window.onpopstate = (event) => {
                // 1. Prioridade: Fechar Modais e Drawers se estiverem abertos
                const modal = document.getElementById('modal-container');
                if (modal && modal.style.display === 'flex') {
                    this.closeModal();
                    window.history.pushState({ view: this.currentView }, '', '');
                    return;
                }

                const friendsDrawer = document.getElementById('friends-drawer');
                if (friendsDrawer && friendsDrawer.classList.contains('active')) {
                    if (typeof closeFriendsDrawer === 'function') closeFriendsDrawer();
                    window.history.pushState({ view: this.currentView }, '', '');
                    return;
                }

                const worldChat = document.getElementById('world-chat-drawer');
                if (worldChat && (worldChat.style.bottom === '0px' || worldChat.classList.contains('active'))) {
                    this.closeWorldChat();
                    window.history.pushState({ view: this.currentView }, '', '');
                    return;
                }

                const chatDrawer = document.getElementById('chat-drawer');
                if (chatDrawer && chatDrawer.classList.contains('active')) {
                    this.closeChat();
                    window.history.pushState({ view: this.currentView }, '', '');
                    return;
                }

                const notifDrawer = document.getElementById('notif-drawer');
                if (notifDrawer && notifDrawer.style.right === '0px') {
                    this.toggleNotifDrawer(false);
                    window.history.pushState({ view: this.currentView }, '', '');
                    return;
                }

                // 2. Se nada estiver aberto, navega de volta
                if (event.state && event.state.view) {
                    this.navigate(event.state.view, 'popstate');
                }
            };
        },

        initAutoLogout() {
            // 🛡️ SEGURANÇA: Verificação de Sessão Expirada (15s)
            const lastAlive = localStorage.getItem('dito_session_heartbeat');
            const now = Date.now();
            if (lastAlive && (now - parseInt(lastAlive)) > 15000) {
                console.log("🔐 [Security] Sessão expirada por inatividade (>15s).");
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
                                    <button onclick="app.sendGift('${u.username}')" style="background: rgba(255, 214, 0, 0.1); border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                                        <i data-lucide="gift" style="width: 18px; color: #b8860b;"></i>
                                    </button>
                                    <button onclick="app.openChat('${u.username}'); closeFriendsDrawer();" style="background: #f5f5f5; border: none; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
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
            if (!this.currentUser || this.currentUser.isGuest) {
                this.showNotification('Visitantes não podem enviar presentes!', 'error');
                return;
            }
            if (targetUsername === this.currentUser.username) {
                this.showNotification('Você não pode enviar presente para si mesmo!', 'error');
                return;
            }

            // Exibe interface de escolha de presente
            const body = document.getElementById('modal-body');
            const container = document.getElementById('modal-container');
            
            body.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="width: 70px; height: 70px; background: rgba(255, 214, 0, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
                        <i data-lucide="gift" style="width: 32px; color: #b8860b;"></i>
                    </div>
                    <h3 style="font-weight: 900; font-size: 20px; margin-bottom: 8px;">Enviar Presente</h3>
                    <p style="font-size: 13px; color: #666; margin-bottom: 32px; font-weight: 700;">Escolha o valor para presentear <span style="color: #000;">@${targetUsername}</span></p>
                    
                    <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px;">
                        <button onclick="app.processGift('${targetUsername}', 30)" style="width: 100%; height: 60px; border-radius: 20px; border: 1px solid #eee; background: #fff; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.2s;">
                            <i data-lucide="circle-dollar-sign" style="width: 18px; color: #ffd600;"></i> 30 Cupons
                        </button>
                        <button onclick="app.processGift('${targetUsername}', 60)" style="width: 100%; height: 60px; border-radius: 20px; border: 1px solid #eee; background: #fff; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.2s;">
                            <i data-lucide="circle-dollar-sign" style="width: 18px; color: #ffd600;"></i> 60 Cupons
                        </button>
                        <button onclick="app.processGift('${targetUsername}', 90)" style="width: 100%; height: 60px; border-radius: 20px; border: 1px solid #eee; background: #fff; font-weight: 900; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.2s;">
                            <i data-lucide="circle-dollar-sign" style="width: 18px; color: #ffd600;"></i> 90 Cupons
                        </button>
                    </div>
                    
                    <button onclick="app.closeModal()" style="font-size: 11px; font-weight: 900; color: #999; background: none; border: none; cursor: pointer; text-transform: uppercase; letter-spacing: 1px;">Cancelar</button>
                </div>
            `;
            
            container.style.display = 'flex';
            if (window.lucide) lucide.createIcons();
        },

        async processGift(targetUsername, amount) {
            const myCoins = parseInt(localStorage.getItem('dito_coins') || '0');
            if (myCoins < amount) {
                this.showNotification('Você não tem cupons suficientes!', 'error');
                return;
            }

            this.showLoading(true, 'Verificando exclusividade...');

            try {
                // Verifica se já enviou presente para esta pessoa (usamos a tabela de notificações como registro)
                const { data: existing, error: checkError } = await supabase
                    .from('dito_notifications')
                    .select('id')
                    .eq('from_username', this.currentUser.username)
                    .eq('target_username', targetUsername)
                    .eq('type', 'presente_enviado')
                    .limit(1);

                if (existing && existing.length > 0) {
                    this.showLoading(false);
                    this.showNotification('Você já enviou um presente para esta pessoa!', 'error');
                    return;
                }

                this.showLoading(true, 'Enviando presente...');

                // 1. Deduz do saldo local e atualiza header
                const newBalance = myCoins - amount;
                localStorage.setItem('dito_coins', newBalance.toString());
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
            const avatarHtml = user && user.avatar ? `<img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover;">` : `<i data-lucide="user" style="width: 18px; color: #ccc;"></i>`;
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
                const icon = roomId === 'GLOBAL' ? 'globe' : 'video';
                headerTitle.innerHTML = `<i data-lucide="${icon}" style="width: 20px; color:#000;"></i> ${roomTitle}`;
            }

            // Limpa o feed para carregar apenas mensagens da sala atual (Se necessário, filtragem no append)
            document.getElementById('world-chat-feed').innerHTML = '';

            document.getElementById('world-chat-drawer').classList.add('active');
            document.getElementById('world-chat-drawer').style.bottom = '0';
            
            // Limpa notificação ao abrir
            const dot = document.getElementById('dot-world-chat');
            if (dot) dot.style.display = 'none';

            if (window.lucide) lucide.createIcons();
            
            this.checkLiveAdminStatus();
        },

        accessLiveDirectly(productId) {
            const p = this.products.find(p => String(p.id) === String(productId));
            if (!p) return;
            
            this.showNotification("Acesso Verificado! Abrindo sala...", "success");
            
            // Define o produto ativo e vai para a sala live interna
            this.selectedProduct = p;
            this.setMarketView('live-room');
        },

        checkLiveAdminStatus() {
            const btn = document.getElementById('btn-live-admin');
            if (!btn) return;
            
            if (!this.currentUser) {
                btn.style.display = 'none';
                return;
            }

            const isAdmin = this.currentUser.username === 'Ditão' || this.currentUser.username === 'Visitante'; // Visitante temporário para teste
            const isAuthPage = this.currentView === 'login' || this.currentView === 'cadastro';
            
            // Verifica se o produtor tem alguma MENTORIA ATIVA
            const activeLive = this.products && this.products.find(p => 
                p.type === 'Mentoria' && 
                p.seller === this.currentUser.username && 
                (p.visible === true || p.visible === 'true' || p.visible === undefined)
            );

            if (!isAuthPage && (isAdmin || activeLive)) {
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
                <div style="scroll-snap-align: start; min-width: 70px; display: flex; flex-direction: column; align-items: center; text-align: center; justify-content: space-between; padding: 12px 6px; border-radius: 12px; border: ${isToday ? '1.5px solid transparent' : '1px solid #f0f0f0'}; background: ${isToday ? 'linear-gradient(#fff, #fff) padding-box, linear-gradient(135deg, #ff005c 0%, #0487ff 100%) border-box' : '#fff'}; transition: 0.3s; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
                    <p style="font-weight: 950; font-size: 11px; margin-bottom: 4px; color: ${past && !item.checked ? '#ccc' : '#000'};">${item.dayName}</p>
                    
                    <div style="width: 24px; height: 24px; border-radius: 50%; background: ${past && !item.checked ? 'transparent' : '#f9f9f9'}; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; border: ${past && !item.checked ? '1px dashed #eee' : 'none'};">
                        <i data-lucide="${statusIcon}" style="color: ${past && !item.checked ? 'rgba(0,0,0,0.1)' : '#000'}; width: 12px; height: 12px; stroke-width: 3px;"></i>
                    </div>

                    ${canCheck ? `<button onclick="app.checkMissionDay(${i})" style="width: 100%; background: #000; color: white; border: none; padding: 6px 0; border-radius: 8px; font-weight: 950; font-size: 9px; cursor: pointer;">OK</button>` : `<div style="width: 100%; background: #f9f9f9; padding: 5px 0; border-radius: 8px; font-size: 8px; font-weight: 950; color: ${past && !item.checked ? '#ccc' : '#000'}; display: flex; align-items: center; justify-content: center; gap: 2px;">+60 <i data-lucide="ticket" style="width: 10px;"></i></div>`}
                </div>
                `;
            }).join('');

            // Título de missão inteligente
            const txt = document.getElementById('daily-mission-text');
            if(txt) txt.innerText = isTodayMissionCompleted(today, checklist) ? "Parabéns! Você já cumpriu a missão de hoje, volte amanhã!" : "Faça o seu check-in diário e garanta suas cupons!";

            if (window.lucide) lucide.createIcons();
            
            function isTodayMissionCompleted(dayIndex, list) {
                return list[dayIndex] && list[dayIndex].checked;
            }

            // --- RENDERIZA NOVAS SEÇÕES ---
            this.renderDailyChallenges();
            this.renderLongTermMissions();
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
                        { goal: 1, reward: 225 }, { goal: 5, reward: 1125 }, { goal: 10, reward: 2250 }, { goal: 25, reward: 5000 }, { goal: 50, reward: 10000 }
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
                        { goal: 10, reward: 350 }, { goal: 30, reward: 1000 }, { goal: 50, reward: 2500 }, { goal: 75, reward: 5000 }, { goal: 100, reward: 10000 }, { goal: 250, reward: 25000 }
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

        checkMissionDay(dayIndex) {
            const key = this.getUserKey();
            const storageKey = `dito_missions_${key}`;
            let checklist = JSON.parse(localStorage.getItem(storageKey) || '[]');
            
            if (checklist[dayIndex] && !checklist[dayIndex].checked) {
                // Nova Regra de Venda Diária (+60 cupons)
                const salesHistory = JSON.parse(localStorage.getItem(`dito_real_sales_history_${key}`) || '[]');
                const hasSaleToday = salesHistory.some(s => new Date(s.date).toDateString() === new Date().toDateString());
                
                if (!hasSaleToday) {
                    this.showNotification('Você precisa fazer pelo menos 1 venda hoje para resgatar!', 'error');
                    return;
                }

                checklist[dayIndex].checked = true;
                localStorage.setItem(storageKey, JSON.stringify(checklist));
                
                let currentCoins = parseInt(localStorage.getItem(`dito_coins_${key}`) || '0');
                currentCoins += 60;
                localStorage.setItem(`dito_coins_${key}`, currentCoins.toString());
                
                // --- SINCRONIZA COM SUPABASE (NUVEM) ---
                if (this.userId) {
                    supabase.from('profiles').update({ coins: currentCoins }).eq('id', this.userId).then(() => {
                        console.log('✅ Saldo sincronizado na nuvem.');
                    });
                }
                
                this.showSystemNotification('Check-in Realizado! ✅', 'Você ganhou 60 cupons de desconto.', 'success');
                this.renderMissions(); 
                this.checkMissionsNotification(); // Apaga o ponto amarelo na hora
            }
        },

        getWeekNumber() {
            const d = new Date();
            const firstDayOfYear = new Date(d.getFullYear(), 0, 1);
            const pastDaysOfYear = (d - firstDayOfYear) / 86400000;
            return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        },

        openLiveAdmin() {
            const actions = [
                { icon: 'pause-circle', label: 'Pausar Live', color: '#f59e0b', call: "app.updateLiveStatus('PAUSADO')" },
                { icon: 'play-circle', label: 'Retomar Live', color: '#10b981', call: "app.updateLiveStatus('AO VIVO')" },
                { icon: 'x-circle', label: 'Encerrar Live', color: '#ef4444', call: "app.updateLiveStatus('ENCERRADO')" },
                { icon: 'refresh-ccw', label: 'Remover Mentoria da Vitrine', color: '#6366f1', call: "app.updateLiveVisibility(false)" }
            ];

            const html = actions.map(a => `
                <button onclick="${a.call}; this.parentElement.parentElement.remove()" style="width: 100%; padding: 16px; border-radius: 12px; border: 1px solid #eee; background: #fff; display: flex; align-items: center; gap: 12px; margin-bottom: 8px; cursor: pointer; text-align: left; font-family: inherit;">
                    <i data-lucide="${a.icon}" style="width: 18px; color: ${a.color};"></i>
                    <span style="font-weight: 800; font-size: 13px;">${a.label}</span>
                </button>
            `).join('');

            // Cria um modal temporário simples
            const modal = document.createElement('div');
            modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:3000; display:flex; align-items:center; justify-content:center; padding:20px;";
            modal.innerHTML = `
                <div style="background:#fff; border-radius:30px; width:100%; max-width:350px; padding:24px; animation: slideBottom 0.3s ease;">
                    <h3 style="font-weight:900; margin-bottom:20px; text-align:center;">Controle da transmissão</h3>
                    ${html}
                    <button onclick="this.parentElement.parentElement.remove()" style="width:100%; padding:15px; background:#f5f5f5; border:none; border-radius:15px; font-weight:900; margin-top:10px; cursor:pointer;">Fechar</button>
                </div>
            `;
            document.body.appendChild(modal);
            if (window.lucide) lucide.createIcons();
        },

        async updateLiveStatus(status) {
            const msg = `📢 [SISTEMA] O status da transmissão mudou para: ${status}`;
            this.showNotification(msg, 'info');
            
            // Envia mensagem global do sistema
            if (supabase) {
                await supabase.from('dito_messages').insert([{
                    sender: 'Dito System',
                    receiver: 'GLOBAL',
                    content: msg
                }]);
            }
            alert(`Status alterado para ${status}! Todos os usuários no chat foram notificados.`);
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
            document.getElementById('world-chat-drawer').classList.remove('active');
            document.getElementById('world-chat-drawer').style.bottom = '-100%';
        },

        async sendWorldMessage() {
            const inp = document.getElementById('world-chat-input');
            let text = inp.value.trim();
            let content = text;
            
            // Lógica de Comandos (DDTank Style)
            if (text.startsWith('/s ')) {
                receiver = 'SOC_GLOBAL'; // Simplificação temporária: Chat global de soc
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
            
            // Definição das Cores de Alto Contraste (Fundo Branco)
            let channelColor = '#000000'; // Global (Preto Sólido)
            let prefix = '[Mundo]';
            
            if (msg.receiver === 'SOC_GLOBAL' || msg.receiver.startsWith('SOC_')) {
                channelColor = '#008f11'; // Sociedade (Verde Escuro)
                prefix = '[Sociedade]';
            } else if (msg.receiver !== 'GLOBAL') {
                channelColor = '#c70097'; // Privado/Sussurro (Rosa Escuro para fundo branco)
                prefix = `[Sussurro de ${msg.receiver === this.currentUser.username ? 'você' : msg.receiver}]`;
            }
            
            const isMe = msg.sender === this.currentUser?.username;
            const itemDiv = document.createElement('div');
            itemDiv.style.padding = '4px 0'; // Mais espaçamento no modo claro
            itemDiv.style.color = channelColor;
            itemDiv.style.fontSize = '14px';
            itemDiv.style.fontWeight = '700';
            itemDiv.style.fontFamily = "'Inter', sans-serif"; 
            itemDiv.style.lineHeight = '1.3';
            itemDiv.style.borderBottom = '1px solid #f9f9f9'; 
            
            itemDiv.innerHTML = `
                <span onclick="app.viewPublicProfile('${msg.sender}')" style="cursor: pointer; color: ${isMe ? '#ff005c' : channelColor}; text-decoration: none;">${msg.sender}</span>
                <span style="opacity: 0.7;">${prefix}:</span>
                <span style="font-weight: 500; color: #333;">${msg.content}</span>
            `;
            
            container.appendChild(itemDiv);
            container.scrollTop = container.scrollHeight;
        },

        async fetchWorldChatMessages() {
            if(!supabase || !this.currentUser) return;
            const container = document.getElementById('world-chat-feed');
            
            try {
                // Traz os últimos avisos globais e mensagens suas do mundo
                const { data, error } = await supabase.from('dito_messages')
                    .select('*')
                    .or(`receiver.eq.GLOBAL,receiver.eq.SOC_GLOBAL,receiver.eq.${this.currentUser.username},sender.eq.${this.currentUser.username}`)
                    .order('created_at', { ascending: false })
                    .limit(50);
                    
                if(!error && data) {
                    container.innerHTML = '';
                    // Reverte pois o select order by desc + limit pega os 50 mais recentes mas inverte a cronologia
                    data.reverse().forEach(msg => {
                        // Filtro fino: Se for sussurro entre outros, não mostra
                        if (msg.receiver !== 'GLOBAL' && msg.receiver !== 'SOC_GLOBAL' && msg.receiver !== this.currentUser.username && msg.sender !== this.currentUser.username) {
                            return;
                        }
                        // Não mostra mensagens normais de chat 1:1 no chat global (apenas os puramente enviados via World Chat)
                        // Para facilitar, por enquanto, mostraremos todas as Dito Messages. A magia está no receiver.
                        this.appendWorldMessageToChat(msg);
                    });
                }
            } catch(e) {
                console.warn(e);
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

                if (hallRes.data) {
                    this.networkUsers = hallRes.data.map(u => this.cleanPublicProfile(u));
                    
                    // Atualiza apenas se a view for a correta
                    if (this.currentView === 'hall') this.renderHallOfFame();
                    if (this.currentView === 'admin-contas') this.renderAdminUsers(true); 
                }

                if (meRes.data && this.currentUser) {
                    const netUser = meRes.data;
                    this.currentUser.sales = parseFloat(netUser.sales || 0);
                    localStorage.setItem('dito_balance', netUser.balance || '0');
                    this.saveSession(this.currentUser);
                }
            } catch (e) {
                console.warn("⚠️ [Network] Erro na rede:", e);
            } finally {
                this.isFetchingUsers = false;
            }
        },

        safeLocalStorageSet(key, value) {
            try {
                localStorage.setItem(key, value);
            } catch (e) {
                if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                    console.warn("⚠️ [Storage] Memória cheia! Fazendo faxina total...");
                    // Limpa absolutamente tudo que é cache não essencial
                    const keysToRemove = ['dito_network_users', 'dito_usuarios', 'dito_market_products', 'dito_last_p_hash', 'dito_profile_posts'];
                    keysToRemove.forEach(k => localStorage.removeItem(k));
                    
                    try {
                        localStorage.setItem(key, value);
                    } catch (retryError) {
                        console.error("❌ [Storage] Espaço insuficiente mesmo após limpeza.");
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

        async fetchNetworkProducts() {
            if (!supabase) return;
            try {
                // Busca apenas os produtos mais recentes do Mercado (Top 50)
                const { data, error } = await supabase.from('dito_market_products')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (data && !error) {
                    const currentHash = JSON.stringify(data);
                    const lastHash = localStorage.getItem('dito_last_p_hash');
                    if (currentHash === lastHash) return; // Nada mudou, mantém o scroll!
                    
                    localStorage.setItem('dito_last_p_hash', currentHash);

                    let local = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
                    data.forEach(net => {
                        const idx = local.findIndex(p => p.id === net.id);
                        const parsed = { ...net, price: Number(net.price), content: net.content ? JSON.parse(net.content) : null };
                        if (idx !== -1) local[idx] = parsed;
                        else local.push(parsed);
                    });
                    
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
            const coverContainer = document.getElementById('product-cover-container');
            if (coverContainer) {
                if (isMentoria) {
                    coverContainer.style.borderRadius = '50%';
                    coverContainer.style.border = '4px solid #ff005c';
                    coverContainer.style.boxShadow = '0 0 30px rgba(255,0,92,0.4)';
                    coverContainer.style.padding = '4px';
                    coverContainer.innerHTML = p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">` : `<div style="width: 100%; height: 100%; background: #ff005c; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 40px; font-weight: 900;">${(p.seller || p.name)[0].toUpperCase()}</div>`;
                    
                    const badge = document.createElement('div');
                    badge.innerHTML = `<span style="position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); background: #ff005c; color: white; font-size: 10px; font-weight: 900; padding: 4px 10px; border-radius: 12px; border: 2px solid #fff; letter-spacing: 1px; z-index: 12;">AO VIVO</span>`;
                    coverContainer.appendChild(badge);
                } else {
                    coverContainer.style.borderRadius = '40px';
                    coverContainer.style.border = 'none';
                    coverContainer.style.boxShadow = '0 20px 40px rgba(0,0,0,0.03)';
                    coverContainer.style.padding = '0';
                    coverContainer.innerHTML = p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="shopping-bag" style="width: 60px; color: #eee;"></i>`;
                }
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

                    <div style="margin-bottom: 10px;">
                        <h4 style="font-size: 13px; font-weight: 950; color: #000; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Sobre este produto</h4>
                        <p style="font-size: 14px; color: #444; line-height: 1.7; font-weight: 500;">${p.description || "Este produto premium oferece acesso exclusivo a conteúdos transformadores. Garanta sua vaga hoje mesmo."}</p>
                    </div>
                `;
            }

            // Customizar Botões de Ação
            const actionsContainer = document.getElementById('product-actions');
            if (actionsContainer) {
                const hasAccess = this.purchasedProducts && this.purchasedProducts.some(pp => String(pp.id) === String(p.id));

                if (isMentoria) {
                    if (hasAccess) {
                        actionsContainer.innerHTML = `
                            <button onclick="app.accessLiveDirectly('${p.id}')" style="flex: 1; height: 64px; background: #10b981; color: #fff; border: none; border-radius: 20px; font-size: 13px; font-weight: 900; letter-spacing: 1px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 10px 25px rgba(16,185,129,0.3);">
                                <i data-lucide="check-circle" style="width: 20px;"></i>
                                ENTRAR NA MENTORIA
                            </button>
                        `;
                    } else {
                        actionsContainer.innerHTML = `
                            <button onclick="app.ingressLive('${p.id}')" style="flex: 1; height: 64px; background: linear-gradient(90deg, #ff005c, #ff3366); color: #fff; border: none; border-radius: 20px; font-size: 13px; font-weight: 900; letter-spacing: 1px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 10px 25px rgba(255,0,92,0.3);">
                                <i data-lucide="shopping-cart" style="width: 20px;"></i>
                                COMPRAR POR R$ ${p.price.toFixed(2)}
                            </button>
                        `;
                    }
                } else {
                    actionsContainer.innerHTML = `
                        <button onclick="app.addToCartFromDetail()" style="flex: 1; height: 64px; background: #000; color: #fff; border: none; border-radius: 20px; font-size: 13px; font-weight: 900; letter-spacing: 1px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px;">
                            <i data-lucide="shopping-bag" style="width: 20px;"></i> ADICIONAR À SACOLA
                        </button>
                    `;
                }
            }

            document.getElementById('product-detail-content').innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                    <h1 style="font-size: 28px; font-weight: 900; letter-spacing: -1px; width: 70%;">${isMentoria ? 'Sala de Transmissão VIP' : p.name.toLowerCase()}</h1>
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
            localStorage.setItem(`dito_cart_${this.getUserKey()}`, JSON.stringify(this.cart));
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
            if (!this.currentUser || this.currentUser.isGuest) {
                this.showNotification('Faça login para avaliar!', 'error');
                return;
            }

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
            const key = this.getUserKey();
            const userCoins = parseInt(localStorage.getItem(`dito_coins_${key}`) || '0');
            
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
                    <span style="font-size: 12px; font-weight: 900; color: #000;">Usar Cupons:</span>
                    <span style="font-size: 11px; font-weight: 800; color: #999;"><span id="coins-to-use-label">0</span>% desconto</span>
                </div>
                <input type="range" class="coin-slider" id="coin-discount-slider" min="0" max="${Math.min(userCoins, 75)}" value="0" oninput="app.applyCoinDiscount(this.value)" style="width: 100%; margin-bottom: 8px;">
                <p style="font-size: 9px; color: #ccc; font-weight: 700;">Limite de desconto com cupons: 75%</p>
                
                <div id="pix-payment-actions">
                    <button onclick="app.processPaymentMP('pix')" style="width: 100%; height: 60px; background: #000; color: #fff; border: none; border-radius: 16px; font-weight: 900; font-size: 14px; margin-top: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                        <i data-lucide="diamond" style="width: 18px;"></i> GERAR PIX REAL
                    </button>
                </div>
            `;
            list.appendChild(rewardsSection);
            
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

        async creditSeller(sellerUsername, amount, productName) {
            if (!supabase) return;
            try {
                const totalAmount = parseFloat(amount);
                const appFee = totalAmount * 0.03;
                const sellerNet = totalAmount - appFee;

                // 1. CREDITA O VENDEDOR (97%)
                const { data: sellerData } = await supabase.from('dito_users').select('*').eq('username', sellerUsername).maybeSingle();
                if (sellerData) {
                    const newBalance = (parseFloat(sellerData.balance || 0) + sellerNet).toFixed(2);
                    const newSalesTotal = (parseFloat(sellerData.sales || 0) + sellerNet).toFixed(2);
                    let history = [];
                    try { history = sellerData.purchases ? (typeof sellerData.purchases === 'string' ? JSON.parse(sellerData.purchases) : sellerData.purchases) : []; } catch(e) {}
                    history.push({ item: productName, value: sellerNet, timestamp: new Date().toISOString(), type: 'sale', fee_deducted: appFee.toFixed(2) });

                    await supabase.from('dito_users').update({
                        balance: newBalance,
                        sales: newSalesTotal,
                        purchases: JSON.stringify(history)
                    }).eq('username', sellerUsername);

                    this.sendNetworkNotification(sellerUsername, 'sale', 'Venda Realizada! 💰', `Você vendeu "${productName}". Valor líquido: R$ ${sellerNet.toFixed(2)} (Taxa app: 3%)`);
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
                console.log("Navegando para:", view);
                this.currentView = view;
                this.checkLiveAdminStatus(); // Atualiza status ao trocar de tela
                
                // Salva o estado para restaurar no F5
                if (view !== 'login' && view !== 'cadastro') {
                    localStorage.setItem('dito_last_view', view);
                }

                const isLoggedIn = localStorage.getItem('is_logged_in_vanilla') === 'true';
                if (!isLoggedIn && view !== 'login' && view !== 'cadastro') {
                    view = 'login';
                    this.currentView = 'login';
                }

                // Sincroniza com o Histórico do Navegador (Botão Voltar do Celular)
                if (!direction || direction !== 'popstate') {
                    const state = { view: view };
                    window.history.pushState(state, '', '');
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
                    case 'admin-produtos': this.renderAdminProducts(); break;
                    case 'produtos': this.renderMyProducts(); break;
                    case 'meus-cursos': this.renderPurchasedProducts(); break;
                    case 'curso-player': this.renderCoursePlayer(); break;
                    case 'missoes': this.renderMissions(); break;
                    case 'admin-painel-unificado': break;
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
                    { id: '1', name: "Pro Digital", description: "O maior ecossistema de produtores.", owner: "benedito_pro", entryFee: 0, membersCount: 0 },
                    { id: '2', name: "Clube dos 6 Dígitos", description: "Focado em escala de anúncios.", owner: "ana_scaling", entryFee: 49.90, membersCount: 0 }
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
                // Verifica se já tem pedido pendente
                const requests = JSON.parse(localStorage.getItem('society_requests') || '[]');
                const hasPending = requests.find(r => r.society_id === this.currentSocietyId && r.username === this.currentUser.username);
                
                document.getElementById('soc-content-mural').style.display = 'none';
                document.getElementById('soc-content-membros').style.display = 'none';
                document.getElementById('soc-content-admin').style.display = 'none';
                document.getElementById('soc-join-section').style.display = 'block';

                const joinBtn = document.getElementById('btn-society-join');
                if (joinBtn) {
                    if (hasPending) {
                        joinBtn.innerText = 'SOLICITAÇÃO ENVIADA';
                        joinBtn.style.background = '#f5f5f5';
                        joinBtn.style.color = '#999';
                        joinBtn.disabled = true;
                    } else {
                        joinBtn.innerText = 'PEDIR PARA PARTICIPAR';
                        joinBtn.style.background = '#000';
                        joinBtn.disabled = false;
                        joinBtn.onclick = () => this.requestToJoinSociety(soc.id);
                    }
                }
            }
            if (window.lucide) lucide.createIcons();
        },

        requestToJoinSociety(id) {
            if (!this.currentUser) return this.showNotification("Faça login para participar.", "error");
            
            const requests = JSON.parse(localStorage.getItem('society_requests') || '[]');
            requests.push({
                id: Date.now(),
                society_id: id,
                username: this.currentUser.username,
                avatar: this.currentUser.avatar || "",
                created_at: new Date().toISOString()
            });

            const success = this.safeLocalStorageSet('society_requests', JSON.stringify(requests));
            
            if (success) {
                this.showNotification("Solicitação enviada ao Gestor!", "success");
                this.renderSocietyDetail();
            } else {
                this.showNotification("Memória cheia! Tente limpar o cache no perfil.", "error");
            }
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
            const cost = 0.00; // Ficou Grátis!

            if (!name) {
                this.showNotification("Dê um nome para sua sociedade.", "error");
                return;
            }

            if (confirm(`Deseja criar a sociedade "${name}" gratuitamente?`)) {
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
            this.checkMissionAlerts(); // Verifica conquistas na hora

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

                    // Força redesenho instantâneo
                    if (this.currentView === 'mercado') this.renderMarketHome();
                    if (this.currentView === 'admin-produtos') this.renderAdminProducts();

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
            const el = document.getElementById('label-balance'); // ID correto conforme index.html
            const dashEl = document.getElementById('dash-total-balance'); // ID alternativo usado em alguns templates
            
            const updateEl = (target) => {
                if (!target) return;
                const key = this.getUserKey();
                const baseBalance = parseFloat(localStorage.getItem(`user_balance_vanilla_${key}`) || '0');
                const realSales = JSON.parse(localStorage.getItem(`dito_real_sales_history_${key}`) || '[]');
                const salesTotal = realSales.reduce((acc, s) => acc + (parseFloat(s.value || s.amount || 0)), 0);
                
                const total = baseBalance + salesTotal;
                target.innerText = this.showBalance ? `R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '••••••••';
            };

            updateEl(el);
            updateEl(dashEl);
            
            // Atualiza o nome da saudação
            const nameEl = document.getElementById('user-greeting-name');
            if (nameEl && this.currentUser) {
                nameEl.innerText = this.currentUser.name || this.currentUser.username;
            }

            // Exibe as bolinhas de notificação se ainda não viu
            // Status de Conexão (Privado para o Ditão)
            const statusEl = document.getElementById('network-status-indicator');
            if (statusEl) statusEl.innerHTML = '';
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
            const category = document.getElementById('prod-category')?.value || "Dinheiro";
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
                    category: category,
                    createdAt: Date.now(),
                    content: this.selectedProductType === 'Curso' ? this.courseStructure : null
                };

                // Salva na lista global local
                const marketProducts = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
                marketProducts.unshift(newProd);
                localStorage.setItem('dito_products_vanilla', JSON.stringify(marketProducts));
                localStorage.setItem('dito_products', JSON.stringify(marketProducts)); 

                // Compartilha via Supabase
                app.syncProductToNetwork(newProd);

                if (notif) notif.remove();
                app.showNotification(`Produto "${name}" criado com sucesso!`, "success");
                app.navigate('dashboard');
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

            // Processa Recompensa de Indicação (+225 Cupons) - FOCO NO PADRINHO 🚀
            const refCode = localStorage.getItem('dito_pending_ref'); 
            if (refCode && supabase) {
                const targetId = parseInt(refCode, 36);
                supabase.from('dito_users').select('username').eq('id', targetId).maybeSingle().then(({ data }) => {
                    if (data && data.username) {
                        const rewardMessage = {
                            target_username: data.username,
                            type: 'referral_225',
                            title: 'Indicacao de Sucesso',
                            message: `O usuário @${username} acaba de criar uma conta pelo seu link! Você ganhou +225 cupons.`,
                            sender: 'Sistema',
                            read: false
                        };
                        supabase.from('dito_notifications').insert([rewardMessage]);
                        console.log(`✅ [Referral] Recompensa enviada para @${data.username}`);
                    }
                });

                localStorage.removeItem('dito_pending_ref');
                this.showSystemNotification('Seja bem-vindo', 'Você entrou para a rede Dito! Comece a convidar amigos para ganhar cupons.', 'success');
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
            if (this.marketView === 'live-room') this.renderMarketLiveRoom(container);
            
            this.updateCartBadge();
            if (window.lucide) lucide.createIcons();
        },

        // Placeholder removido para evitar sobreposição - funcionalidade real movida para renderMarketCheckout consolidado acima

        renderMarketLiveRoom(container) {
            const p = this.selectedProduct;
            if (!p) return this.setMarketView('home');

            const temp = document.getElementById('template-live-room');
            container.innerHTML = temp.innerHTML;

            document.getElementById('live-room-title').innerText = p.name;
            document.getElementById('live-host-name').innerText = p.seller || p.author || 'Mestre Dito';
            document.getElementById('live-description').innerText = p.description || "Bem-vindo à transmissão exclusiva.";

            const playerContainer = document.getElementById('live-player-container');
            const chatBtn = document.getElementById('btn-open-live-chat');

            if (chatBtn) {
                chatBtn.onclick = () => this.openWorldChat(`LIVE_${p.id}`, `Chat: ${p.name}`);
            }

            // Converter link de vendas em Player (YouTube/Vimeo)
            if (p.sales_link) {
                let embedUrl = p.sales_link;
                if (p.sales_link.includes('youtube.com/watch?v=')) {
                    embedUrl = p.sales_link.replace('watch?v=', 'embed/');
                } else if (p.sales_link.includes('youtu.be/')) {
                    embedUrl = p.sales_link.replace('youtu.be/', 'youtube.com/embed/');
                } else if (p.sales_link.includes('vimeo.com/')) {
                    embedUrl = p.sales_link.replace('vimeo.com/', 'player.vimeo.com/video/');
                }

                playerContainer.innerHTML = `
                    <iframe src="${embedUrl}" style="width:100%; height:100%; border:none;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                `;
            } else {
                playerContainer.innerHTML = `
                    <div style="text-align: center; color: #666; padding: 20px;">
                        <i data-lucide="video-off" style="width: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
                        <p style="font-size: 12px; font-weight: 700;">Aguardando início da transmissão pelo mentor...</p>
                    </div>
                `;
            }

            if (window.lucide) lucide.createIcons();
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

            const p1 = JSON.parse(localStorage.getItem('dito_products') || '[]');
            const p2 = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
            const p3 = JSON.parse(localStorage.getItem('dito_market_products') || '[]');
            let all = [...p1, ...p2, ...p3]
                .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
                .filter(p => p.visible !== false && p.visible !== 'false');
            
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
                                ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<b style="font-size: 24px; color: #ff005c;">${(p.seller || p.name)[0].toUpperCase()}</b>`}
                            </div>
                        </div>
                        <span style="font-size: 9px; font-weight: 800; color: #fff; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; line-height: 1.2;">${p.name}</span>
                    </div>
                `).join('');
            }

            // 1. DESTAQUES: Novos primeiro (Horizontal) (Excluindo Mentorias para não repetir)
            const arrival = [...all].filter(p => p.type !== 'Mentoria').sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));

            if (hContainer && hWrapper) {
                hWrapper.style.display = arrival.length > 0 ? 'block' : 'none';
                hContainer.innerHTML = arrival.map(p => {
                    const isMentoria = p.type === 'Mentoria';
                    const imgContainer = isMentoria ? `
                        <div style="aspect-ratio: 1; border-radius: 50%; padding: 3px; background: linear-gradient(45deg, #ff005c, #ff3366); display: flex; align-items: center; justify-content: center; margin-bottom: 12px; position: relative; box-shadow: 0 4px 15px rgba(255,0,92,0.3); overflow: visible; flex-shrink: 0;">
                            <span style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); background: #ff005c; color: white; font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 6px; border: 2px solid #fff; letter-spacing: 1px; z-index: 2;">AO VIVO</span>
                            <div style="width: 100%; height: 100%; border-radius: 50%; overflow: hidden; background: #fff; border: 2px solid #fff; display: flex; align-items: center; justify-content: center;">
                                ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<b style="font-size: 24px; color: #ff005c;">${(p.seller || p.name)[0].toUpperCase()}</b>`}
                            </div>
                        </div>
                    ` : `
                        <div style="aspect-ratio: 1; background: #f9f9f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; overflow: hidden; flex-shrink: 0;">
                            ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="package" stroke="url(#dito-gradient)" style="width: 20px;"></i>`}
                        </div>
                    `;
                    
                    return `
                    <div onclick="app.viewProduct('${p.id}')" style="width: 151px; min-width: 151px; background: #fff; padding: 10px; border-radius: 6px; border: 1px solid #f2f2f2; cursor: pointer; scroll-snap-align: start; display: flex; flex-direction: column; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                        ${imgContainer}
                        <h4 style="font-weight: 900; font-size: 11px; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;">${isMentoria ? 'Mentoria Privada' : p.name}</h4>
                        <div style="display: flex; gap: 2px; margin-bottom: 6px;">
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
                `}).join('');
            }

            // 2. TODOS (Grid Vertical Justo)
            feed.style.gap = '6px';
            feed.style.background = 'transparent'; 
            feed.innerHTML = all.map(p => {
                const isMentoria = p.type === 'Mentoria';
                const imgContainer = isMentoria ? `
                    <div style="aspect-ratio: 1; border-radius: 50%; padding: 3px; background: linear-gradient(45deg, #ff005c, #ff3366); display: flex; align-items: center; justify-content: center; margin-bottom: 12px; position: relative; box-shadow: 0 4px 15px rgba(255,0,92,0.3); overflow: visible;">
                        <span style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); background: #ff005c; color: white; font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 6px; border: 2px solid #fff; letter-spacing: 1px; z-index: 2;">AO VIVO</span>
                        <div style="width: 100%; height: 100%; border-radius: 50%; overflow: hidden; background: #fff; border: 2px solid #fff; display: flex; align-items: center; justify-content: center;">
                            ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<b style="font-size: 24px; color: #ff005c;">${(p.seller || p.name)[0].toUpperCase()}</b>`}
                        </div>
                    </div>
                ` : `
                    <div style="aspect-ratio: 1; background: #f9f9f9; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 8px; overflow: hidden;">
                        ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="layers" stroke="url(#dito-gradient)" style="width: 20px;"></i>`}
                    </div>
                `;

                return `
                <div onclick="app.viewProduct('${p.id}')" style="background: #fff; padding: 10px; border-radius: 6px; border: 1px solid #f2f2f2; cursor: pointer; display: flex; flex-direction: column; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                    ${imgContainer}
                    <h4 style="font-weight: 900; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; color: #000;">${isMentoria ? 'Mentoria Privada' : p.name}</h4>
                    <div style="display: flex; gap: 2px; margin-bottom: 6px;">
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
            `}).join('');

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
        
        // Link técnico que o navegador entende (fallback caso o Vercel não tenha redirecionamento)
        const realLink = `https://${domain}/?ref=${code}`;
        
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
            app.showSystemNotification('Link Copiado! 📋', 'Mande para seus amigos e garanta suas moedas.', 'success');
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



    app.addRewardCoins = function(amount, reason) {
        const current = parseInt(localStorage.getItem('dito_coins') || '0');
        localStorage.setItem('dito_coins', (current + amount).toString());
        this.showNotification(`+${amount} Cupons! (${reason})`, 'success');
        this.initRewards();
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
        const hasP = localStorage.getItem('dito_purchased_products');
        const isFirst = !(hasP && JSON.parse(hasP).length > 0);
        let final = isFirst ? (totalBase * 0.25) : totalBase;
        
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
                    ${p.image ? `<img src="${p.image}" style="width:100%; height:100%; object-fit:cover;">` : `<i data-lucide="package" style="width:24px; color:#ccc;"></i>`}
                </div>
                <div style="flex:1;"><h4 style="font-weight:900; font-size:14px;">${p.name}</h4><p style="font-size:10px; color:#999;">${p.type} • R$ ${parseFloat(p.price).toFixed(2)}</p></div>
                <button onclick="app.deleteProduct('${String(p.id)}', '${(p.name || '').replace(/'/g, "\\'")}')" style="width:40px; height:40px; background:#fee2e2; color:#ef4444; border:none; border-radius:12px; cursor:pointer;"><i data-lucide="trash-2" style="width:18px;"></i></button>
            </div>`).join('');
        if (window.lucide) lucide.createIcons();
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
                
                // Lógica Especial para VENDA (Sincroniza Saldo)
                if (notif.type === 'venda' || notif.title.toLowerCase().includes('venda')) {
                    const key = this.getUserKey();
                    const history = JSON.parse(localStorage.getItem(`dito_real_sales_history_${key}`) || '[]');
                    
                    // Extrai o valor se estiver na mensagem (ex: "Você recebeu R$ 50.00")
                    const valueMatch = notif.message.match(/R\$\s?([0-9.,]+)/);
                    if (valueMatch) {
                        const val = parseFloat(valueMatch[1].replace(',', '.'));
                        history.push({
                            id: notif.id,
                            value: val,
                            date: new Date().toISOString(),
                            product: 'Venda Realizada'
                        });
                        localStorage.setItem(`dito_real_sales_history_${key}`, JSON.stringify(history));
                        app.checkMissionAlerts(); // Atalho para avisar conquista
                        this.updateBalanceUI(); // Atualiza o saldo global na hora!
                    }
                }

                // Processa Recompensa de Indicação TIME REAL
                if (notif.type === 'referral_225') {
                    let processedRefs = JSON.parse(localStorage.getItem('dito_processed_refs') || '[]');
                    if (!processedRefs.includes(notif.id)) {
                        const key = this.getUserKey();
                        let currentCoins = parseInt(localStorage.getItem(`dito_coins_${key}`) || '0');
                        localStorage.setItem(`dito_coins_${key}`, (currentCoins + 225).toString());
                        processedRefs.push(notif.id);
                        localStorage.setItem('dito_processed_refs', JSON.stringify(processedRefs));
                        this.showSystemNotification('Saldo Atualizado', 'Um amigo entrou! +225 cupons creditados!', 'success');
                    }
                }

                if (!this.notifications) this.notifications = [];
                this.notifications.unshift(notif);
                this.renderNotifications();
                this.updateNotifBadge(true);
                this.playNotifSound();
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
                    const isMyRoom = msg.receiver === room;
                    const isForMe = msg.receiver === this.currentUser.username || msg.sender === this.currentUser.username;
                    
                    if (isMyRoom || (room === 'GLOBAL' && (msg.receiver === 'SOC_GLOBAL' || isForMe))) {
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
