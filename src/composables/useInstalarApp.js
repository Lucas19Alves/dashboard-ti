import { ref } from 'vue'

// Instalação como aplicativo (PWA): o navegador avisa quando é possível instalar.
const podeInstalar = ref(false)
const instalado = ref(typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches)
let aviso = null

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault()
    aviso = evento
    podeInstalar.value = true
  })
  window.addEventListener('appinstalled', () => {
    podeInstalar.value = false
    instalado.value = true
    aviso = null
  })
}

export const useInstalarApp = () => ({
  podeInstalar,
  instalado,
  instalar: async () => {
    if (!aviso) return false
    aviso.prompt()
    const { outcome } = await aviso.userChoice
    aviso = null
    podeInstalar.value = false
    return outcome === 'accepted'
  }
})
