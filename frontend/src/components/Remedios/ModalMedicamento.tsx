import { Pill } from 'lucide-react'

import ModalBase from '../common/ModalBase'
import CadastroMedicamento from './CadastroMedicamento'

interface ModalMedicamentoProps {
  aberto: boolean
  onFechar: () => void
  idosoId?: string
  idosoNome?: string
}

function ModalMedicamento({
  aberto,
  onFechar,
  idosoId,
  idosoNome,
}: ModalMedicamentoProps) {
  return (
    <ModalBase
      aberto={aberto}
      onFechar={onFechar}
      idTitulo="titulo-modal-medicamento"
      icone={<Pill size={22} aria-hidden="true" />}
      sobretitulo="Medicamentos"
      titulo="Adicionar medicamento"
      descricao="Preencha os dados do medicamento."
    >
      <CadastroMedicamento
        idosoId={idosoId}
        idosoNome={idosoNome}
      />
    </ModalBase>
  )
}

export default ModalMedicamento
