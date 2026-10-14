// Aceite dos Termos e consentimento de saúde no cadastro. Só interface: nada disso vai ao servidor ainda.
// As caixas nascem desmarcadas; quem barra o envio é o Cadastro (e-mail e Google).
import { TEXTO_ACEITE_TERMOS, TEXTO_CONSENTIMENTO_SAUDE } from "../../lib/documentosLegais";

export const ID_ACEITE_TERMOS = "aceite-termos";
export const ID_CONSENTIMENTO_SAUDE = "aceite-saude";
export const ID_ERRO_CADASTRO = "erro-cadastro";

type Props = {
  aceitaTermos: boolean;
  consenteSaude: boolean;
  setAceitaTermos: (valor: boolean) => void;
  setConsenteSaude: (valor: boolean) => void;
  erroAceite: boolean;
};

const ROTULO =
  "flex min-h-11 cursor-pointer items-start gap-3 py-1 text-base leading-6 text-[#071A38] dark:text-[#F5F5FA] sm:text-lg";
const CAIXA = "mt-0.5 h-6 w-6 shrink-0 cursor-pointer accent-[#5F56EC] dark:accent-[#A89FFF]";
const LINK =
  "inline-flex min-h-11 items-center font-bold text-[#5F56EC] underline underline-offset-4 hover:text-[#3F37B5] focus:outline-none focus:ring-2 focus:ring-[#6C63FF]/40 dark:text-[#A89FFF]";

const DOCUMENTOS = [
  { href: "/termos", titulo: "Termos de Uso" },
  { href: "/privacidade", titulo: "Política de Privacidade" },
];

function AceiteCadastro({ aceitaTermos, consenteSaude, setAceitaTermos, setConsenteSaude, erroAceite }: Props) {
  const descricao = erroAceite ? ID_ERRO_CADASTRO : undefined;
  return (
    <div className="mt-6 space-y-2 sm:mt-7">
      <label htmlFor={ID_ACEITE_TERMOS} className={ROTULO}>
        <input
          id={ID_ACEITE_TERMOS}
          type="checkbox"
          checked={aceitaTermos}
          onChange={(e) => setAceitaTermos(e.target.checked)}
          aria-describedby={descricao}
          className={CAIXA}
        />
        <span>{TEXTO_ACEITE_TERMOS}</span>
      </label>

      <p className="flex flex-wrap gap-x-4 gap-y-2 pl-9">
        {DOCUMENTOS.map((d) => (
          <a key={d.href} href={d.href} target="_blank" rel="noopener noreferrer" className={LINK}>
            {d.titulo}
            <span className="sr-only"> (abre em nova aba)</span>
          </a>
        ))}
      </p>

      <label htmlFor={ID_CONSENTIMENTO_SAUDE} className={ROTULO}>
        <input
          id={ID_CONSENTIMENTO_SAUDE}
          type="checkbox"
          checked={consenteSaude}
          onChange={(e) => setConsenteSaude(e.target.checked)}
          aria-describedby={descricao}
          className={CAIXA}
        />
        <span>{TEXTO_CONSENTIMENTO_SAUDE}</span>
      </label>
    </div>
  );
}

export default AceiteCadastro;
