import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Item 9.3 (RNF-010): o CI builda a imagem Docker do backend (sem publicar nem rodar), para o erro de
// build aparecer antes do deploy do Render. Teste de contrato: lê arquivos fora de backend/ a partir da
// raiz do repo, só com fs e regex (sem lib de YAML). Roda no host e no CI, não dentro do container do
// docker-compose.yml (que monta só ./backend).
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

const ler = (...partes: string[]): string =>
  readFileSync(path.join(REPO_ROOT, ...partes), "utf8").replace(/\r\n/g, "\n");

const ci = ler(".github", "workflows", "ci.yml");
const render = ler("render.yaml");
const dockerfile = ler("backend", "Dockerfile");
const dockerignore = ler("backend", ".dockerignore");
const nvmrc = ler(".nvmrc");

// Texto de um job: do cabeçalho "  <nome>:" até o próximo cabeçalho de job (ou o fim do arquivo).
function job(nome: string): string {
  const inicio = ci.search(new RegExp(`^ {2}${nome}:\\s*$`, "m"));
  if (inicio < 0) return "";
  const resto = ci.slice(inicio + 1);
  const proximo = resto.search(/^ {2}[A-Za-z0-9_-]+:\s*$/m);
  return proximo < 0 ? resto : resto.slice(0, proximo);
}

// Passos do job: cada item da lista "      - ..." (o primeiro pedaço é o cabeçalho do job, descartado).
const passosBackend = job("backend").split(/^ {6}- /m).slice(1);
const RE_DOCKER_BUILD = /^\s*run:\s*docker build\b(.*)$/m;
const indiceDocker = passosBackend.findIndex((p) => RE_DOCKER_BUILD.test(p));
const passoDocker = indiceDocker >= 0 ? passosBackend[indiceDocker] : "";
const comandoDocker = RE_DOCKER_BUILD.exec(passoDocker)?.[0].replace(/^\s*run:\s*/, "").trim() ?? "";

describe("CI builda a imagem Docker do backend (item 9.3, RNF-010)", () => {
  it("T1: passo docker build ./backend existe dentro do job backend, não no frontend", () => {
    expect(indiceDocker).toBeGreaterThanOrEqual(0);
    expect(comandoDocker.split(/\s+/).pop()).toBe("./backend");
    expect(job("frontend")).not.toMatch(/docker build/);
  });

  it("T2: o passo declara working-directory: . (o job tem working-directory: backend por padrão)", () => {
    expect(passoDocker).toMatch(/^\s*working-directory:\s*\.\s*$/m);
  });

  it("T3: o passo vem depois do passo npm run build do job backend", () => {
    const indiceBuild = passosBackend.findIndex((p) => /^\s*run:\s*npm run build\s*$/m.test(p));
    expect(indiceBuild).toBeGreaterThanOrEqual(0);
    expect(indiceDocker).toBeGreaterThan(indiceBuild);
  });

  it("T4: o CI não publica a imagem nem faz login em registry", () => {
    for (const proibido of ["docker push", "docker login", "login-action", "build-push-action", "--push"]) {
      expect(ci.includes(proibido)).toBe(false);
    }
  });

  it("T5: o contexto do build no CI é o dockerContext do render.yaml e o dockerfilePath é backend/Dockerfile", () => {
    const contextoRender = /^\s*dockerContext:\s*(\S+)\s*$/m.exec(render)?.[1] ?? "";
    const arquivoRender = /^\s*dockerfilePath:\s*(\S+)\s*$/m.exec(render)?.[1] ?? "";
    const contextoCi = comandoDocker.split(/\s+/).pop() ?? "";
    expect(contextoRender).not.toBe("");
    expect(path.posix.normalize(contextoCi)).toBe(path.posix.normalize(contextoRender));
    expect(existsSync(path.resolve(REPO_ROOT, arquivoRender))).toBe(true);
    expect(path.resolve(REPO_ROOT, arquivoRender)).toBe(path.join(REPO_ROOT, "backend", "Dockerfile"));
  });

  it("T6: Dockerfile parte de node:24 e o .nvmrc tem major 24 (RNF-008)", () => {
    const primeiraLinha = dockerfile.split("\n").find((l) => l.trim() !== "" && !l.trim().startsWith("#")) ?? "";
    expect(primeiraLinha).toMatch(/^FROM node:24(\D|$)/);
    expect(parseInt(nvmrc.trim().replace(/^v/, ""), 10)).toBe(24);
  });

  it("T7: .dockerignore exclui node_modules, .env e .env.*, e mantém !.env.example", () => {
    const linhas = dockerignore.split("\n").map((l) => l.trim());
    for (const esperada of ["node_modules", ".env", ".env.*", "!.env.example"]) {
      expect(linhas).toContain(esperada);
    }
  });

  it("T8: o Dockerfile não faz COPY nem ADD de .env por nome", () => {
    expect(dockerfile).not.toMatch(/^\s*(COPY|ADD)\b.*\.env/im);
  });
});
