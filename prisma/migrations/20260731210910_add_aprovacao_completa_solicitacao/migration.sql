/*
  Warnings:

  - Added the required column `dados` to the `solicitacoes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `etapa_atual` to the `solicitacoes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `prazo_sla` to the `solicitacoes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `solicitante_id` to the `solicitacoes` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DecisaoAprovacao" AS ENUM ('APROVADA', 'REJEITADA');

-- AlterTable
ALTER TABLE "solicitacoes" ADD COLUMN     "dados" JSONB NOT NULL,
ADD COLUMN     "etapa_atual" "Role" NOT NULL,
ADD COLUMN     "prazo_sla" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "solicitante_id" UUID NOT NULL;

-- CreateTable
CREATE TABLE "aprovacoes" (
    "id" TEXT NOT NULL,
    "solicitacao_id" TEXT NOT NULL,
    "etapa" INTEGER NOT NULL,
    "aprovador_role" "Role" NOT NULL,
    "aprovador_id" UUID,
    "decisao" "DecisaoAprovacao",
    "comentario" TEXT,
    "resumo_ia" TEXT,
    "decidido_em" TIMESTAMP(3),

    CONSTRAINT "aprovacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "aprovacoes_solicitacao_id_idx" ON "aprovacoes"("solicitacao_id");

-- CreateIndex
CREATE UNIQUE INDEX "aprovacoes_solicitacao_id_etapa_key" ON "aprovacoes"("solicitacao_id", "etapa");

-- CreateIndex
CREATE INDEX "solicitacoes_solicitante_id_idx" ON "solicitacoes"("solicitante_id");

-- CreateIndex
CREATE INDEX "solicitacoes_etapa_atual_idx" ON "solicitacoes"("etapa_atual");

-- AddForeignKey
ALTER TABLE "solicitacoes" ADD CONSTRAINT "solicitacoes_solicitante_id_fkey" FOREIGN KEY ("solicitante_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacoes" ADD CONSTRAINT "aprovacoes_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprovacoes" ADD CONSTRAINT "aprovacoes_aprovador_id_fkey" FOREIGN KEY ("aprovador_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
