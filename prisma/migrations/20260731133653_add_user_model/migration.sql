-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SOLICITANTE', 'GESTOR', 'RH_ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "gestor_id" UUID,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_gestor_id_fkey" FOREIGN KEY ("gestor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
