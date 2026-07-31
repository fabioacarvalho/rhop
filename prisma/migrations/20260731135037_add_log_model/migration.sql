-- CreateEnum
CREATE TYPE "LogTipo" AS ENUM ('AUDITORIA', 'ERRO');

-- CreateTable
CREATE TABLE "logs" (
    "id" TEXT NOT NULL,
    "tipo" "LogTipo" NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidade_id" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "usuario_id" UUID,
    "detalhes" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "logs_tipo_idx" ON "logs"("tipo");

-- CreateIndex
CREATE INDEX "logs_entidade_idx" ON "logs"("entidade");

-- CreateIndex
CREATE INDEX "logs_usuario_id_idx" ON "logs"("usuario_id");

-- CreateIndex
CREATE INDEX "logs_criado_em_idx" ON "logs"("criado_em");

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
