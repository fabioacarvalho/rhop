-- RenameColumn (feito manualmente com RENAME COLUMN em vez de DROP+ADD gerado
-- pelo `prisma migrate diff`, para preservar os dados já cadastrados na
-- coluna `transcricao_texto` — ver .specs/features/banco-de-talentos/design.md,
-- secao "Rodada 2", risco #1)
ALTER TABLE "candidatos" RENAME COLUMN "transcricao_texto" TO "parecer_tecnico";

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CandidatoToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CandidatoToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "tags_nome_key" ON "tags"("nome");

-- CreateIndex
CREATE INDEX "_CandidatoToTag_B_index" ON "_CandidatoToTag"("B");

-- AddForeignKey
ALTER TABLE "_CandidatoToTag" ADD CONSTRAINT "_CandidatoToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "candidatos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CandidatoToTag" ADD CONSTRAINT "_CandidatoToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
