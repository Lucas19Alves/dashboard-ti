import { shallowRef } from 'vue'
import { conferirPlanilha } from '../utils/conferenciaPlanilha'

// Conferência da planilha antes de salvar: abre o modal e espera a decisão do usuário.
const pendente = shallowRef(null) // { resultado, contexto, responder }

export const useConferencia = () => ({
  pendente,
  conferir: (dados, contexto = {}) => new Promise((resolve) => {
    pendente.value = {
      resultado: conferirPlanilha(dados, contexto),
      contexto,
      responder: (ok) => {
        pendente.value = null
        resolve(ok)
      }
    }
  })
})
