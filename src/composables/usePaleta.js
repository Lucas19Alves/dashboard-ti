import { ref } from 'vue'

// Estado global da busca rápida (Ctrl+K), compartilhado entre Navbar e a paleta.
const aberta = ref(false)

export const usePaleta = () => ({
  aberta,
  abrir: () => { aberta.value = true },
  fechar: () => { aberta.value = false },
  alternar: () => { aberta.value = !aberta.value }
})
