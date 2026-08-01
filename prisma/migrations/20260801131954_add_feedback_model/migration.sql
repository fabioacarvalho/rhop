-- CreateEnum
CREATE TYPE "TipoRelato" AS ENUM ('BUG', 'MELHORIA', 'DUVIDA');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('ENVIADO', 'ERRO');

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo" "TipoRelato" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tela_contexto" TEXT NOT NULL,
    "github_issue_url" TEXT,
    "github_issue_numero" INTEGER,
    "status" "FeedbackStatus" NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feedbacks_usuario_id_idx" ON "feedbacks"("usuario_id");

-- CreateIndex
CREATE INDEX "feedbacks_status_idx" ON "feedbacks"("status");

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
