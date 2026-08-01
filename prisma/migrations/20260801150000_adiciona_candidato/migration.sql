-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "StatusEmbedding" AS ENUM ('pendente', 'processado', 'falhou');

-- CreateTable
CREATE TABLE "candidatos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "curriculo_texto" TEXT NOT NULL,
    "curriculo_arquivo_url" TEXT,
    "transcricao_texto" TEXT NOT NULL,
    "embedding" vector(1536),
    "status_embedding" "StatusEmbedding" NOT NULL DEFAULT 'pendente',
    "solicitacao_id" TEXT,
    "criado_por" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidatos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidatos_email_key" ON "candidatos"("email");

-- CreateIndex
CREATE INDEX "candidatos_status_embedding_idx" ON "candidatos"("status_embedding");

-- CreateIndex
CREATE INDEX "candidatos_solicitacao_id_idx" ON "candidatos"("solicitacao_id");

-- AddForeignKey
ALTER TABLE "candidatos" ADD CONSTRAINT "candidatos_solicitacao_id_fkey" FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidatos" ADD CONSTRAINT "candidatos_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
