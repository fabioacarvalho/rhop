-- AlterTable
ALTER TABLE "User" ADD COLUMN     "equipe_id" TEXT;

-- CreateTable
CREATE TABLE "equipes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "gestor_id" UUID NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipes_nome_key" ON "equipes"("nome");

-- CreateIndex
CREATE INDEX "equipes_gestor_id_idx" ON "equipes"("gestor_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_gestor_id_fkey" FOREIGN KEY ("gestor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
