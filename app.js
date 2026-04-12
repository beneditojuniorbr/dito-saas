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
        purchasedProducts: JSON.parse(localStorage.getItem('dito_purchased_products') || '[]'),
        currentLessonId: 1, // Default lesson
        courseComments: JSON.parse(localStorage.getItem('dito_course_comments') || '{}'),
        courseRatings: JSON.parse(localStorage.getItem('dito_course_ratings') || '{}'),
        globalRatings: JSON.parse(localStorage.getItem('dito_global_ratings') || '{}'),
        
        toSentenceCase(str) {
            if (!str) return "";
            return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
        },

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
                this.checkNewProducts();
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
            if (this.marketView === 'checkout') this.renderMarketCheckout(container);
            
            if (window.lucide) lucide.createIcons();
        },

        renderMarketHome(container) {
            const temp = document.getElementById('template-mercado-home');
            container.innerHTML = temp.innerHTML;
            
            // Garantir que carregamos os produtos reais criados
            const saved = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
            const marketProducts = saved.length > 0 ? saved : [
                { id: 'm1', name: "Método Escala Rápida", price: 97.00, oldPrice: 197.00, rating: 4.8, sales: 1240, seller: "Benedito" },
                { id: 'm2', name: "Template Notion PRO", price: 47.00, oldPrice: 87.00, rating: 4.9, sales: 850, seller: "Ana" }
            ];



            // Render Main Feed (Shopee Style 2 columns) - Ordenado por vendas
            const feed = document.getElementById('main-market-feed');
            if (feed) {
                const sortedProducts = [...marketProducts].sort((a, b) => (b.sales || 0) - (a.sales || 0));
                
                feed.innerHTML = sortedProducts.map(p => `
                    <div onclick="app.viewProduct('${p.id}')" style="cursor: pointer; background: #fff; border-radius: 12px; border: 1px solid #f0f0f0; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                        <div style="aspect-ratio: 1; background: #f8f8f8; display: flex; align-items: center; justify-content: center; position: relative;">
                            <i data-lucide="shopping-bag" style="color: #eee; width: 40px; height: 40px;"></i>
                        </div>
                        <div style="padding: 10px;">
                            <h4 style="font-size: 12px; font-weight: 500; color: #333; height: 32px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-bottom: 8px; line-height: 1.3;">${this.toSentenceCase(p.name)}</h4>
                            <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 8px;">
                                <i data-lucide="star" style="width: 10px; color: #facc15; fill: #facc15;"></i>
                                <span style="font-size: 9px; font-weight: 700; color: #999;">${p.rating || '5.0'} | ${p.sales || '0'} vendidos</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-size: 16px; font-weight: 900; color: #ee4d2d;">R$ ${p.price.toFixed(2)}</span>
                                <div style="font-size: 10px; color: #999; font-weight: 700;">Brasil</div>
                            </div>
                        </div>
                    </div>
                `).join('');
            }

            // Contador do carrinho
            const cartCount = document.getElementById('market-cart-count');
            if (cartCount) cartCount.innerText = this.cart.length;
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
                document.getElementById('cart-footer').querySelector('button').onclick = () => this.setMarketView('checkout');
            }
        },

        renderMarketCheckout(container) {
            const temp = document.getElementById('template-checkout');
            container.innerHTML = temp.innerHTML;
            
            const list = document.getElementById('checkout-items-list');
            list.innerHTML = this.cart.map(item => `
                <div style="display: flex; justify-content: space-between; font-size: 13px;">
                    <span style="color: #666; font-weight: 500;">${item.name}</span>
                    <span style="font-weight: 800;">R$ ${item.price.toFixed(2)}</span>
                </div>
            `).join('');
            
            const total = this.cart.reduce((acc, i) => acc + i.price, 0);
            document.getElementById('checkout-total-value').innerText = 'R$ ' + total.toFixed(2);
            if (window.lucide) lucide.createIcons();
        },

        selectPayment(method, btn) {
            this.selectedPaymentMethod = method;
            document.querySelectorAll('.payment-opt').forEach(opt => {
                opt.style.borderColor = '#eee';
                opt.style.background = '#fff';
            });
            btn.style.borderColor = '#ee4d2d';
            
            document.getElementById('pix-details').style.display = (method === 'pix') ? 'block' : 'none';
            document.getElementById('card-details').style.display = (method === 'card') ? 'flex' : 'none';
        },

        copyPix() {
            this.showNotification("Código Pix copiado!", "success");
        },

        processPayment() {
            const itemsToBuy = [...this.cart];
            this.showNotification("Processando pagamento...", "centered");
            setTimeout(() => {
                this.showNotification("Pagamento aprovado com sucesso!", "success");
                
                // Ao "processar", o saldo do produtor (usuário atual para teste) aumenta
                const total = this.cart.reduce((sum, p) => sum + parseFloat(p.price || 0), 0);
                const netAmount = total * 0.97; // Deduz taxa de 3%
                
                const currentBalance = parseFloat(localStorage.getItem('dito_balance') || '0');
                const newBalance = currentBalance + netAmount;
                
                localStorage.setItem('dito_balance', newBalance.toString());
                
                // Limpa carrinho e finaliza
                this.purchasedProducts = [...this.purchasedProducts, ...this.cart];
                localStorage.setItem('dito_purchased_products', JSON.stringify(this.purchasedProducts));
                this.cart = [];
                localStorage.setItem('dito_cart', '[]');
                
                this.showNotification(`Venda realizada! Você recebeu R$ ${netAmount.toFixed(2)} (Taxa de 3% aplicada)`);
                this.navigate('dashboard');
            }, 1500);
        },

        renderPurchasedProducts() {
            const list = document.getElementById('purchased-products-list');
            if (!list) return;

            if (this.purchasedProducts.length === 0) {
                list.innerHTML = `
                    <div style="text-align: center; padding: 60px 20px; color: #ccc;">
                        <i data-lucide="play-circle" style="width: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
                        <p style="font-weight: 800; font-size: 14px;">Você ainda não comprou nenhum curso.</p>
                        <button onclick="app.navigate('mercado')" style="margin-top: 20px; background: #ee4d2d; color: #fff; border: none; padding: 14px 32px; border-radius: 40px; font-weight: 900; font-size: 12px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.5px;">Ir para o Mercado</button>
                    </div>
                `;
                if (window.lucide) lucide.createIcons();
                return;
            }

            list.innerHTML = this.purchasedProducts.map(p => `
                <div style="background: #fff; border-radius: 24px; border: 1px solid #eee; padding: 20px; display: flex; gap: 16px; align-items: center; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                    <div style="width: 64px; height: 64px; background: #f8f8f8; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #ee4d2d;">
                        <i data-lucide="play-circle" style="width: 32px;"></i>
                    </div>
                    <div style="flex: 1;">
                        <h4 style="font-size: 14px; font-weight: 900; margin-bottom: 4px;">${p.name.toLowerCase()}</h4>
                        <p style="font-size: 11px; color: #999; font-weight: 700;">Comprado em: ${p.buyDate || 'Recente'}</p>
                    </div>
                    <button onclick="app.openCourse('${p.id}')" style="width: 44px; height: 44px; background: #000; color: #fff; border: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                        <i data-lucide="chevron-right" style="width: 20px;"></i>
                    </button>
                </div>
            `).join('');
            if (window.lucide) lucide.createIcons();
        },

        openCourse(id) {
            this.activeCourse = this.purchasedProducts.find(p => p.id === id);
            if (this.activeCourse) {
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

            // Aulas Fake
            const lessonsList = document.getElementById('lessons-list');
            const lessons = [
                { id: 1, title: 'Introdução e Boas Vindas', duration: '05:20' },
                { id: 2, title: 'Mentalidade de Sucesso', duration: '12:45' },
                { id: 3, title: 'Primeiros Passos no Mercado', duration: '15:10' },
                { id: 4, title: 'Estratégia de Escala PRO', duration: '22:30' }
            ];

            lessonsList.innerHTML = lessons.map(l => `
                <div style="display: flex; align-items: center; gap: 12px; padding: 16px; background: ${this.currentLessonId === l.id ? '#f0f0f0' : '#fdfdfd'}; border: 1px solid ${this.currentLessonId === l.id ? '#ddd' : '#f5f5f5'}; border-radius: 16px; cursor: pointer;" onclick="app.switchLesson(${l.id}, '${l.title}')">
                    <div style="width: 32px; height: 32px; background: ${this.currentLessonId === l.id ? '#000' : '#eee'}; color: ${this.currentLessonId === l.id ? '#fff' : '#000'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900;">${l.id}</div>
                    <div style="flex: 1;">
                        <p style="font-size: 12px; font-weight: 900;">${l.title}</p>
                        <p style="font-size: 10px; color: #ccc; font-weight: 700;">${l.duration}</p>
                    </div>
                </div>
            `).join('');

            this.renderLessonInteractive();
            if (window.lucide) lucide.createIcons();
        },

        switchLesson(id, title) {
            this.currentLessonId = id;
            document.getElementById('player-lesson-name').innerText = `Aula ${id}: ${title}`;
            this.renderCoursePlayer(); // Re-render to update highlights and interactive parts
        },

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
            const firstAvatar = document.getElementById('hall-1st-avatar');
            const firstName = document.getElementById('hall-1st-name');
            const firstSales = document.getElementById('hall-1st-sales');
            
            if (!listTop) return;

            // Carrega usuários reais ou gera lista de espera
            const users = JSON.parse(localStorage.getItem('dito_usuarios') || '[]');
            
            if (users.length === 0) {
                if (firstName) firstName.innerText = "Aguardando competidores...";
                listTop.innerHTML = `<p style="text-align: center; color: #ccc; padding: 20px; font-weight: 800; font-size: 11px; text-transform: uppercase;">A elite ainda está se preparando.</p>`;
                return;
            }

            // Ordena por vendas REAIS (começando em 0)
            const sortedRank = users.map(u => ({
                ...u,
                sales: u.sales || 0
            })).sort((a,b) => b.sales - a.sales);

            const winner = sortedRank[0];
            const others = sortedRank.slice(1, 10);

            // Renderiza o 1º Lugar
            if (winner) {
                if (firstAvatar) firstAvatar.innerHTML = winner.avatar ? `<img src="${winner.avatar}" style="width: 100%; height: 100%; object-cover">` : `<i data-lucide="star" style="width: 60px; color: #eee;"></i>`;
                if (firstName) firstName.innerText = winner.name;
                if (firstSales) firstSales.innerHTML = `<span style="font-size: 20px; opacity: 0.3;">R$</span> ${winner.sales.toLocaleString()}`;
            }

            // Renderiza o Ranking (2º ao 10º)
            listTop.innerHTML = others.map((u, i) => {
                const pos = i + 2;
                const isSilver = pos === 2;
                const isBronze = pos === 3;
                const bg = isSilver ? '#f9f9f9' : (isBronze ? '#fffaf5' : '#fff');
                const border = isSilver ? '#eee' : (isBronze ? '#ffe8d1' : '#f9f9f9');
                const rankColor = isSilver ? '#999' : (isBronze ? '#d97706' : '#ddd');
                const title = isSilver ? 'Vice-Líder' : (isBronze ? 'Terceiro Lugar' : 'Elite');

                return `
                <div onclick="window.location.href='/perfil/${u.name.toLowerCase().replace(/\s+/g, '-')}'" style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: ${bg}; border-radius: 28px; border: 1px solid ${border}; transition: 0.3s; cursor: pointer;">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <span style="font-weight: 900; color: ${rankColor}; font-size: 14px; font-style: italic; width: 30px; text-align: center;">${pos}º</span>
                        <div style="width: 44px; height: 44px; border-radius: 50%; overflow: hidden; background: #fff; border: 2px solid ${border}; display: flex; align-items: center; justify-content: center;">
                            ${u.avatar ? `<img src="${u.avatar}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="user" style="width: 18px; color: #ccc;"></i>`}
                        </div>
                        <div>
                            <p style="font-weight: 900; font-size: 13px; color: #000; margin-bottom: 2px; text-decoration: underline;">${u.name}</p>
                            <p style="font-size: 8px; font-weight: 800; color: ${rankColor}; text-transform: uppercase; letter-spacing: 1px;">${title}</p>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-weight: 900; font-size: 13px; color: #000;">R$ ${u.sales.toLocaleString()}</span>
                        <span style="display: block; font-size: 8px; font-weight: 800; color: #ccc; text-transform: uppercase;">Faturamento</span>
                    </div>
                </div>
                `;
            }).join('');

            if (window.lucide) lucide.createIcons();
        },



        updateWithdrawUI() {
            const label = document.getElementById('label-balance-withdraw');
            if (label) {
                const balance = parseFloat(localStorage.getItem('dito_balance') || '0');
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

                const isLoggedIn = localStorage.getItem('is_logged_in_vanilla') === 'true';
                if (!isLoggedIn && view !== 'login' && view !== 'cadastro') {
                    view = 'login';
                    this.currentView = 'login';
                }

                // Force background for Market
                const rootContainer = document.querySelector('.app-container');
                if (rootContainer) {
                    if (view === 'mercado') {
                        rootContainer.classList.add('bg-mercado-premium');
                    } else {
                        rootContainer.classList.remove('bg-mercado-premium');
                    }
                }

                // Renderiza o template básico
                const appContainer = document.getElementById('app');
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
                    case 'hall': this.renderHallOfFame(); break;
                    case 'perfil': this.renderProfile(); break;
                    case 'vendas': this.renderSales(); break;
                    case 'sacar': this.updateWithdrawUI(); break;
                    case 'admin-contas': this.renderAdminUsers(); break;
                    case 'meus-cursos': this.renderPurchasedProducts(); break;
                    case 'curso-player': this.renderCoursePlayer(); break;
                }
                
                // Atualiza Barra de Navegação Global
                const nav = document.getElementById('global-nav');
                const downloadLink = document.getElementById('download-app-link');
                const isAuthPage = view === 'login' || view === 'cadastro';
                
                if (nav) {
                    nav.style.display = isAuthPage ? 'none' : 'flex';
                    nav.querySelectorAll('.nav-item').forEach(item => {
                        const targetView = item.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
                        if (targetView === view) {
                            item.classList.add('active-nav');
                        } else {
                            item.classList.remove('active-nav');
                        }
                    });
                }

                if (downloadLink) {
                    downloadLink.style.display = isAuthPage ? 'none' : 'block';
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
            const el = document.getElementById('label-balance');
            if (el) {
                const balance = parseFloat(localStorage.getItem('user_balance_vanilla') || '0');
                el.innerText = this.showBalance ? `R$ ${balance.toFixed(2)}` : '••••••••';
            }
            
            // Atualiza o nome da saudação
            const nameEl = document.getElementById('user-greeting-name');
            if (nameEl && this.currentUser) {
                nameEl.innerText = this.currentUser.name || this.currentUser.username;
            }
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
            
            // Visual logic for selection - Gradient Border highlight
            document.querySelectorAll('.product-type-btn').forEach(b => {
                b.style.background = '#f5f5f5';
                b.style.border = '2px solid transparent';
            });
            
            // Apply Premium Gradient Border
            btn.style.background = 'linear-gradient(#f5f5f5, #f5f5f5) padding-box, linear-gradient(90deg, #ff005c 0%, #0487ff 100%) border-box';
            btn.style.border = '2px solid transparent';
            btn.style.boxShadow = '0 10px 25px rgba(0, 0, 0, 0.08)';

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
            const desc = document.getElementById('prod-desc')?.value.trim() || "";
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
                id: 'p-' + Date.now(),
                name: name,
                description: desc,
                price: price,
                oldPrice: price * 1.4,
                type: this.selectedProductType,
                visible: visible,
                rating: 5.0,
                sales: 0,
                author: this.currentUser?.username || "Você",
                seller: this.currentUser?.username || "Você"
            };

            // Salva na lista do mercado global se estiver visível
            const marketProducts = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
            marketProducts.unshift(newProd);
            localStorage.setItem('dito_products_vanilla', JSON.stringify(marketProducts));

            // Salva nos meus produtos
            const myProducts = JSON.parse(localStorage.getItem('dito_my_products') || '[]');
            myProducts.unshift(newProd);
            localStorage.setItem('dito_my_products', JSON.stringify(myProducts));

            this.showNotification(`Produto "${name}" criado com sucesso!`, "success");
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
            const container = document.getElementById('main-market-feed');
            const hContainer = document.getElementById('ebooks-horizontal-list');
            const hWrapper = document.getElementById('ebooks-carousel-container');
            if (!container) return;

            // Marca que o usuário viu o mercado agora
            localStorage.setItem('dito_market_last_seen', Date.now().toString());
            const dot = document.getElementById('dot-mercado');
            if (dot) dot.style.display = 'none';

            const lastSeen = parseInt(localStorage.getItem('dito_market_last_seen_before') || '0');
            localStorage.setItem('dito_market_last_seen_before', Date.now().toString());

            const p1 = JSON.parse(localStorage.getItem('dito_products') || '[]');
            const p2 = JSON.parse(localStorage.getItem('dito_products_vanilla') || '[]');
            let allProducts = [...p1, ...p2];
            
            if (allProducts.length === 0) {
                allProducts = [
                    { id: 'elite-1', name: 'Método Anti-Crise Módulos 1 a 4', type: 'Curso', price: '297.00', salesCount: 1420, createdAt: Date.now() - 86400000 },
                    { id: 'elite-2', name: 'Pack Dito Premium Ebook', type: 'Ebook', price: '47.90', salesCount: 843, createdAt: Date.now() - 86400000 },
                    { id: 'elite-3', name: 'Acesso Sala de Sinais', type: 'Dito', price: '19.90', salesCount: 3105, createdAt: Date.now() - 86400000 },
                    { id: 'elite-4', name: 'Mentoria 1-on-1 Avançada', type: 'Mentoria', price: '997.00', salesCount: 22, createdAt: Date.now() - 86400000 }
                ];
                localStorage.setItem('dito_products', JSON.stringify(allProducts));
            }

            // Filtrar Ebooks para o Carrossel
            const ebooks = allProducts.filter(p => p.type === 'Ebook');
            const others = allProducts.filter(p => p.type !== 'Ebook');

            if (ebooks.length > 0 && hContainer && hWrapper) {
                hWrapper.style.display = 'block';
                hContainer.innerHTML = ebooks.map(p => `
                    <div onclick="app.viewProduct('${p.id}')" style="min-width: 130px; max-width: 130px; background: #ffffff; padding: 12px; border-radius: 24px; border: 1px solid #f0f0f0; transition: 0.3s; box-shadow: 0 10px 20px rgba(0,0,0,0.05);">
                        <div style="aspect-ratio: 1; background: #f9f9f9; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; position: relative; overflow: hidden;">
                            <i data-lucide="book-open" stroke="url(#dito-gradient)" style="width: 20px;"></i>
                            ${(p.createdAt || 0) > lastSeen ? '<div class="notif-dot" style="position: absolute; top: 10px; left: 10px; z-index: 10;"></div>' : ''}
                        </div>
                        <h4 style="font-weight: 900; font-size: 10px; color: #000; margin-bottom: 6px; line-height: 1.2; height: 2.4em; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${p.name}</h4>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 900; font-size: 14px; color: #000;">R$ ${parseFloat(p.price || 0).toFixed(2)}</span>
                            <div style="width: 24px; height: 24px; background: #000; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                <i data-lucide="plus" style="width: 10px;"></i>
                            </div>
                        </div>
                    </div>
                `).join('');
            } else if (hWrapper) {
                hWrapper.style.display = 'none';
            }

            // Renderizar outros produtos no Grid Vertical
            if (others.length === 0 && ebooks.length === 0) {
                 container.innerHTML = `<div style="grid-column: 1/-1; padding: 40px; text-align: center; color: rgba(255,255,255,0.4); font-weight: 800;">Nenhum produto encontrado.</div>`;
            } else {
                const listToShow = others.length > 0 ? others : []; 
                container.innerHTML = listToShow.map(p => `
                    <div onclick="app.viewProduct('${p.id}')" style="background: #ffffff; padding: 16px; border-radius: 28px; border: 1px solid #f0f0f0; cursor: pointer; transition: 0.3s; box-shadow: 0 10px 20px rgba(0,0,0,0.05);">
                        <div style="aspect-ratio: 1; background: #f9f9f9; border-radius: 20px; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; position: relative; overflow: hidden;">
                            <i data-lucide="package" stroke="url(#dito-gradient)" style="width: 28px;"></i>
                            <div style="position: absolute; top: 10px; right: 10px; background: #000; color: #fff; padding: 4px 10px; border-radius: 10px; font-size: 8px; font-weight: 900; text-transform: uppercase;">${p.type || 'Dito'}</div>
                            ${(p.createdAt || 0) > lastSeen ? '<div class="notif-dot" style="position: absolute; top: 10px; left: 10px; z-index: 10;"></div>' : ''}
                        </div>
                        <h4 style="font-weight: 900; font-size: 11px; color: #000; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</h4>
                        <p style="font-size: 8px; font-weight: 800; color: #999; text-transform: uppercase; margin-bottom: 8px;">${p.salesCount || p.sales || 0} vendidas</p>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 900; font-size: 16px; color: #000;">R$ ${parseFloat(p.price || 0).toFixed(2)}</span>
                            <div style="width: 32px; height: 32px; background: #000; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                                <i data-lucide="plus" style="width: 14px;"></i>
                            </div>
                        </div>
                    </div>
                `).join('');
            }

            if (window.lucide) lucide.createIcons();
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

    // Funções de Rede Social e Busca
    app.toggleSocialSearch = function(open, event) {
        if (event) event.stopPropagation();
        const container = document.getElementById('search-container');
        const input = document.getElementById('social-search-input');
        const close = document.getElementById('search-close');
        const results = document.getElementById('social-search-results');

        if (open) {
            container.style.width = '260px';
            container.style.background = '#fff';
            container.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
            input.style.width = '180px';
            input.style.opacity = '1';
            input.style.paddingLeft = '8px';
            input.focus();
            close.style.display = 'block';
        } else {
            container.style.width = '40px';
            container.style.background = '#f5f5f5';
            container.style.boxShadow = 'none';
            input.style.width = '0';
            input.style.opacity = '0';
            input.style.paddingLeft = '0';
            input.value = '';
            close.style.display = 'none';
            results.style.display = 'none';
        }
    };

    app.searchUsers = function(query) {
        const resultsContainer = document.getElementById('social-search-results');
        if (!query || query.length < 2) {
            resultsContainer.style.display = 'none';
            return;
        }

        const mockUsers = [
            { username: 'ana_crypto', name: 'Ana Silva', bio: 'Buscando a liberdade financeira ₿', fans: 1240, sales: 850 },
            { username: 'marcos_dito', name: 'Marcos Oliveira', bio: 'Estrategista de Vendas Online', fans: 3100, sales: 2100 },
            { username: 'julia_vendas', name: 'Julia Santos', bio: 'Copywriter de Elite | 7 Dígitos', fans: 890, sales: 420 },
            { username: 'benedito_pro', name: 'Benedito Santos', bio: 'Infoprodutor de Elite', fans: 5000, sales: 12000 }
        ];

        const filtered = mockUsers.filter(u => 
            u.username.toLowerCase().includes(query.toLowerCase()) || 
            u.name.toLowerCase().includes(query.toLowerCase())
        );

        if (filtered.length > 0) {
            resultsContainer.style.display = 'block';
            resultsContainer.innerHTML = filtered.map(u => `
                <div onclick="app.viewPublicProfile('${u.username}')" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f9f9f9; transition: 0.2s;" onmouseover="this.style.background='#f9f9f9'" onmouseout="this.style.background='white'">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #eee; display: flex; align-items: center; justify-content: center;">
                        <i data-lucide="user" style="width: 20px; color: #ccc;"></i>
                    </div>
                    <div>
                        <p style="font-weight: 900; font-size: 13px; color: #000;">${u.username}</p>
                        <p style="font-size: 11px; color: #999; font-weight: 500;">${u.name}</p>
                    </div>
                </div>
            `).join('');
            if (window.lucide) lucide.createIcons();
        } else {
            resultsContainer.innerHTML = `<div style="padding: 16px; font-size: 12px; color: #999; text-align: center; font-weight: 800;">Nenhum perfil encontrado.</div>`;
            resultsContainer.style.display = 'block';
        }
    };

    app.viewPublicProfile = function(username) {
        this.toggleSocialSearch(false);
        this.navigate('perfil-publico');
        
        const mockUsers = [
            { username: 'ana_crypto', name: 'Ana Silva', bio: 'Buscando a liberdade financeira ₿. Especialista em DeFi.', fans: 1240, sales: 850 },
            { username: 'marcos_dito', name: 'Marcos Oliveira', bio: 'Estrategista de Vendas Online.', fans: 3100, sales: 2100 },
            { username: 'julia_vendas', name: 'Julia Santos', bio: 'Copywriter de Elite | 7 Dígitos.', fans: 890, sales: 420 }
        ];

        const user = mockUsers.find(u => u.username === username) || { username, name: username, bio: 'Membro da Dito Elite', fans: 0, sales: 0 };
        
        setTimeout(() => {
            const userDisp = document.getElementById('public-username-header');
            if (userDisp) {
                userDisp.innerText = user.username;
                document.getElementById('public-name').innerText = user.name;
                document.getElementById('public-bio').innerText = user.bio;
                document.getElementById('public-fans-count').innerText = user.fans;
                document.getElementById('public-vendas-count').innerText = user.sales;
                
                const grid = document.getElementById('public-posts-grid');
                grid.innerHTML = Array(12).fill(0).map(() => `
                    <div style="aspect-ratio: 1; background: #f5f5f5; display: flex; align-items: center; justify-content: center;">
                        <i data-lucide="image" style="width: 24px; color: #ddd;"></i>
                    </div>
                `).join('');
                if (window.lucide) lucide.createIcons();
            }
        }, 50);
    };

    app.toggleFan = function() {
        const btn = document.getElementById('btn-fan');
        const fanCount = document.getElementById('public-fans-count');
        let current = parseInt(fanCount.innerText);

        if (btn.innerText === 'Tornar-se Fã') {
            btn.innerText = 'Fã ✓';
            btn.style.background = '#f5f5f5';
            btn.style.color = '#000';
            fanCount.innerText = current + 1;
            this.showNotification('Você agora é fã deste perfil!');
        } else {
            btn.innerText = 'Tornar-se Fã';
            btn.style.background = '#000';
            btn.style.color = '#fff';
            fanCount.innerText = current - 1;
        }
    };

    app.calculateNetProfit = function(value) {
        const label = document.getElementById('profit-calc-label');
        if (!label) return;
        const val = parseFloat(value) || 0;
        const net = val * 0.97; // 3% fee
        label.innerText = `Você receberá: R$ ${net.toFixed(2)}`;
    };

    window.app = app;
    app.init();
})();
