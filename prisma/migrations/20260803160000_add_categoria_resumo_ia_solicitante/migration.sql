-- CreateEnum
CREATE TYPE "CategoriaTipoFluxo" AS ENUM ('PADRAO', 'FERIAS', 'DAYOFF');

-- AlterEnum
ALTER TYPE "StatusSolicitacao" ADD VALUE 'CANCELADA';

-- AlterTable
ALTER TABLE "tipos_fluxo" ADD COLUMN     "categoria" "CategoriaTipoFluxo" NOT NULL DEFAULT 'PADRAO';

-- AlterTable
ALTER TABLE "solicitacoes" ADD COLUMN     "resumo_ia_solicitante" TEXT;
