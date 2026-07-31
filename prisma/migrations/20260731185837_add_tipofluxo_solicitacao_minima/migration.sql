-- CreateEnum
CREATE TYPE "StatusSolicitacao" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');

-- CreateTable
CREATE TABLE "tipos_fluxo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "campos_formulario" JSONB NOT NULL,
    "etapas" JSONB NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_fluxo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitacoes" (
    "id" TEXT NOT NULL,
    "tipo_fluxo_id" TEXT NOT NULL,
    "status" "StatusSolicitacao" NOT NULL DEFAULT 'PENDENTE',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipos_fluxo_nome_key" ON "tipos_fluxo"("nome");

-- CreateIndex
CREATE INDEX "solicitacoes_tipo_fluxo_id_idx" ON "solicitacoes"("tipo_fluxo_id");

-- CreateIndex
CREATE INDEX "solicitacoes_status_idx" ON "solicitacoes"("status");

-- AddForeignKey
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_tipo_fluxo_id_fkey" FOREIGN KEY ("tipo_fluxo_id") REFERENCES "tipos_fluxo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
