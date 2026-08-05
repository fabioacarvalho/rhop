import { listarBoard } from "./lib/services/pipelineService";
import { Role } from "./lib/generated/prisma/client";

async function main() {
  try {
    const usuario = {
      id: "00000000-0000-0000-0000-000000000000",
      nome: "Test",
      email: "test@01tec.com.br",
      role: Role.RH_ADMIN
    };
    const board = await listarBoard(usuario, {});
    console.log("Board:", board);
  } catch (err) {
    console.error("ERRO:", err);
  }
}

main();
