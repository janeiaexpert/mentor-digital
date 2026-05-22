-- Execute este SQL no SQL Editor do Supabase (https://supabase.com/dashboard/project/_/sql/new)

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT DEFAULT ''::text,
  categoria TEXT NOT NULL DEFAULT 'diaria'::text,
  prioridade TEXT NOT NULL DEFAULT 'media'::text,
  concluida BOOLEAN NOT NULL DEFAULT false,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluida_em TIMESTAMPTZ,
  CONSTRAINT tasks_categoria_check CHECK (categoria = ANY (ARRAY['diaria'::text, 'semanal'::text, 'mensal'::text])),
  CONSTRAINT tasks_prioridade_check CHECK (prioridade = ANY (ARRAY['alta'::text, 'media'::text, 'baixa'::text]))
);

CREATE INDEX idx_tasks_criada_em ON tasks USING btree (criada_em DESC);
CREATE INDEX idx_tasks_concluida ON tasks USING btree (concluida);

-- Desabilitar RLS (app single-user com chave service_role)
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
