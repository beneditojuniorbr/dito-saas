-- ==========================================================
-- 🚀 DITO NETWORK - SCRIPT DE RECONSTRUÇÃO TOTAL
-- Copie e cole este código no SQL EDITOR do seu Supabase
-- ==========================================================

-- 1. TABELA DE USUÁRIOS (Perfil, Saldo e Vendas)
CREATE TABLE IF NOT EXISTS dito_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    bio TEXT DEFAULT 'Membro Dito',
    balance DECIMAL(12,2) DEFAULT 0.00,
    sales DECIMAL(12,2) DEFAULT 0.00,
    fans INTEGER DEFAULT 0,
    avatar TEXT,
    gender TEXT,
    purchases JSONB DEFAULT '[]'::jsonb,
    coins INTEGER DEFAULT 0,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELA DO MERCADO (Produtos e Serviços)
CREATE TABLE IF NOT EXISTS dito_market_products (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    author TEXT REFERENCES dito_users(username),
    seller TEXT,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(12,2) DEFAULT 0.00,
    image TEXT,
    category TEXT DEFAULT 'Micro SaaS',
    slug TEXT UNIQUE,
    content JSONB, -- Link de aula, PDF, etc
    sales INTEGER DEFAULT 0,
    hasLimit BOOLEAN DEFAULT false,
    stockLimit INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA DE NOTIFICAÇÕES (Sincronia Social)
CREATE TABLE IF NOT EXISTS dito_notifications (
    id BIGSERIAL PRIMARY KEY,
    target_username TEXT NOT NULL,
    sender TEXT,
    type TEXT, -- 'sale', 'visit', 'referral', 'chat'
    title TEXT,
    message TEXT,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABELA DE CHAT GLOBAL E MENSAGENS
CREATE TABLE IF NOT EXISTS dito_world_chat (
    id BIGSERIAL PRIMARY KEY,
    sender TEXT NOT NULL,
    content TEXT NOT NULL,
    room_id TEXT DEFAULT 'global',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABELA DE SOCIEDADES (Grupos)
CREATE TABLE IF NOT EXISTS dito_societies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    owner TEXT REFERENCES dito_users(username),
    name TEXT NOT NULL,
    description TEXT,
    members JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================================
-- 📡 CONFIGURAÇÃO DE REALTIME (MUITO IMPORTANTE!)
-- ==========================================================

-- Habilita o Realtime para as tabelas essenciais
-- Se estas tabelas não estiverem aqui, o celular não sincroniza com o PC
BEGIN;
  -- Remove publicações antigas se existirem para evitar erro
  DROP PUBLICATION IF EXISTS supabase_realtime;
  
  -- Cria a publicação para Realtime
  CREATE PUBLICATION supabase_realtime FOR TABLE 
    dito_users, 
    dito_market_products, 
    dito_notifications,
    dito_world_chat;
COMMIT;

-- ==========================================================
-- 🔐 SEGURANÇA (RLS) - Opcional para facilitar testes
-- Para o Dito funcionar via Anon Key sem complicações iniciais:
ALTER TABLE dito_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE dito_market_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE dito_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE dito_world_chat DISABLE ROW LEVEL SECURITY;
ALTER TABLE dito_societies DISABLE ROW LEVEL SECURITY;

-- ✅ SUCESSO: Agora seu banco de dados está pronto para o Dito!
