import { reactive, watch } from 'vue'

// Aparência e acessibilidade, salvas neste navegador e aplicadas na tag <html>.
// O index.html aplica as mesmas classes antes do app montar, para não piscar o tema claro.
const CHAVE = 'dashboard_ti_aparencia'
export const TAMANHOS_TEXTO = { normal: '100%', grande: '112.5%', maior: '125%' }
const PADRAO = { tema: 'sistema', texto: 'normal', contraste: false, menosMovimento: false }

const ler = () => {
  try {
    return { ...PADRAO, ...JSON.parse(localStorage.getItem(CHAVE) || '{}') }
  } catch {
    return { ...PADRAO }
  }
}

const estado = reactive(ler())
const midiaEscura = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null
const sistemaEscuro = reactive({ ativo: Boolean(midiaEscura?.matches) })
midiaEscura?.addEventListener?.('change', e => { sistemaEscuro.ativo = e.matches })

export const temaEfetivo = () => (estado.tema === 'sistema' ? (sistemaEscuro.ativo ? 'escuro' : 'claro') : estado.tema)

const aplicar = () => {
  if (typeof document === 'undefined') return
  const html = document.documentElement
  const escuro = temaEfetivo() === 'escuro'
  html.classList.toggle('dark', escuro)
  html.classList.toggle('alto-contraste', Boolean(estado.contraste))
  html.classList.toggle('menos-movimento', Boolean(estado.menosMovimento))
  html.style.fontSize = TAMANHOS_TEXTO[estado.texto] || '100%'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#0f1d3d' : '#1d4ed8')
}

watch([estado, sistemaEscuro], () => {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)) } catch {}
  aplicar()
}, { deep: true, immediate: true })

export const useAparencia = () => ({
  estado,
  temaEfetivo,
  alternarTema: () => { estado.tema = temaEfetivo() === 'escuro' ? 'claro' : 'escuro' },
  restaurar: () => Object.assign(estado, PADRAO)
})
