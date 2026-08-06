import "dotenv/config";
import { verificarSla } from "../lib/services/slaService.js";

async function main() {
  console.log("Executando verificação de SLA...");
  const resumo = await verificarSla();
  console.log("Resumo:", resumo);
}

main().catch(console.error);
