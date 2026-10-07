// Leitura de arquivos do repositório para os testes de contrato de infra (itens 9.3 e 9.4): só fs e regex,
// sem biblioteca de YAML. Lê fora de backend/ a partir da raiz do repo, então só roda no host e no CI, não dentro
// do container do docker-compose.yml (que monta só ./backend). Fora do build e não coletada como suíte.
import { readFileSync } from "node:fs";
import path from "node:path";

export const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

export const ler = (...partes: string[]): string =>
  readFileSync(path.join(REPO_ROOT, ...partes), "utf8").replace(/\r\n/g, "\n");

// Texto de um job do workflow: do cabeçalho "  <nome>:" até o próximo cabeçalho de job (ou o fim do arquivo).
export function jobDe(workflow: string, nome: string): string {
  const inicio = workflow.search(new RegExp(`^ {2}${nome}:\\s*$`, "m"));
  if (inicio < 0) return "";
  const resto = workflow.slice(inicio + 1);
  const proximo = resto.search(/^ {2}[A-Za-z0-9_-]+:\s*$/m);
  return proximo < 0 ? resto : resto.slice(0, proximo);
}

// Passos do job: cada item da lista "      - ..." (o primeiro pedaço é o cabeçalho do job, descartado).
export const passosDe = (job: string): string[] => job.split(/^ {6}- /m).slice(1);

// Remove comentários de YAML (da primeira # de cada linha em diante). Os arquivos de infra aqui não têm # em string.
export const semComentariosYaml = (texto: string): string => texto.replace(/#.*$/gm, "");
