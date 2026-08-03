-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_gestor_id_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "gestor_id";
