import { shallowRef } from 'vue'
import { conferirPlanilha } from '../utils/conferenciaPlanilha'

// Conferência da planilha antes de salvar: sem nenhum apontamento segue direto;
// com erro ou aviso, abre o modal e espera a decisão do usuário.
const pendente = shallowRef(null) // { resultado, contexto, responder }

export const useConferencia = () => ({
  pendente,
  conferir: (dados, contexto = {}) => new Promise((resolve) => {
    const resultado = conferirPlanilha(dados, contexto)
    if (resultado.nivel === 'ok') return resolve(true)
    pendente.value = {
      resultado,
      contexto,
      responder: (ok) => {
        pendente.value = null
        resolve(ok)
      }
    }
  })
})
