-- AlterTable
ALTER TABLE "solicitacoes" ADD COLUMN     "ultima_cobranca_em" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "solicitacoes_status_prazo_sla_idx" ON "solicitacoes"("status", "prazo_sla");
