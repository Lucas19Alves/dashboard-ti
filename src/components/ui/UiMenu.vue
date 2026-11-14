<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { executarAcao, seccionarAcoes } from '../../composables/useAcoes'

// Menu "Mais": ações agrupadas em seções (Ações, Dados, Exportar, Ver; perigosas por último).
// Fecha ao clicar fora ou com Esc; setas navegam entre as opções.
const props = defineProps({
  acoes: { type: Array, default: () => [] },
  rotulo: { type: String, default: 'Mais' },
  icone: { type: String, default: 'fas fa-ellipsis' },
  // 'botao': altura dos botões de página; 'ferramenta': altura da barra das tabelas.
  estilo: { type: String, default: 'botao' },
  // Esconde o texto do botão em telas pequenas (fica só o ícone).
  compacto: { type: Boolean, default: false },
  titulo: { type: String, default: 'Mais ações' }
})

const aberto = ref(false)
const raiz = ref(null)
const painel = ref(null)
const secoes = computed(() => seccionarAcoes(props.acoes.filter(a => a && !a.oculta)))
// Sem nenhuma opção disponível (lista vazia, nada a exportar), o botão não aparece.
const disponivel = computed(() => secoes.value.some(sec => sec.acoes.some(x => !x.desativado)))

// O painel abre sobre a página (fora de cartões com overflow escondido), junto ao botão:
// alinhado à direita dele (ou à esquerda, perto da borda) e para cima quando falta espaço embaixo.
const posicao = ref({})
const LARGURA = 256
const posicionar = () => {
  const r = raiz.value?.getBoundingClientRect()
  if (!r) return
  const altura = painel.value?.offsetHeight || 0
  const cabeEmbaixo = r.bottom + 4 + altura <= window.innerHeight - 8 || r.top < altura + 12
  const p = r.right - LARGURA < 8 ? { left: `${Math.max(8, r.left)}px` } : { right: `${Math.max(8, window.innerWidth - r.right)}px` }
  posicao.value = { ...p, ...(cabeEmbaixo ? { top: `${r.bottom + 4}px` } : { bottom: `${window.innerHeight - r.top + 4}px` }) }
}
const abrir = async () => {
  aberto.value = !aberto.value
  if (!aberto.value) return
  posicionar()
  await nextTick()
  posicionar()
  painel.value?.querySelector('button:not(:disabled)')?.focus()
}
const fecharFora = (e) => {
  if (aberto.value && !raiz.value?.contains(e.target) && !painel.value?.contains(e.target)) aberto.value = false
}
const fechar = () => { aberto.value = false }
const ouvir = (ligar) => {
  const f = ligar ? 'addEventListener' : 'removeEventListener'
  document[f]('pointerdown', fecharFora)
  window[f]('resize', fechar)
  window[f]('scroll', fechar, true)
}
watch(aberto, ouvir)
onBeforeUnmount(() => ouvir(false))

const escolher = async (acao) => {
  if (acao.desativado) return
  aberto.value = false
  await executarAcao(acao)
}
const teclar = (e) => {
  if (!aberto.value) return
  if (e.key === 'Escape') { aberto.value = false; e.stopPropagation(); raiz.value?.querySelector('button')?.focus(); return }
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  e.preventDefault()
  const botoes = [...(painel.value?.querySelectorAll('button:not(:disabled)') || [])]
  const i = botoes.indexOf(document.activeElement)
  botoes[(i + (e.key === 'ArrowDown' ? 1 : -1) + botoes.length) % botoes.length]?.focus()
}
</script>

<template>
  <div v-if="disponivel" ref="raiz" class="relative" @keydown="teclar">
    <button
      type="button"
      class="inline-flex items-center justify-center gap-2 border font-semibold transition"
      :class="[
        estilo === 'ferramenta' ? 'h-9 rounded-lg px-3 text-[13px]' : 'min-h-10 rounded-xl px-4 py-2 text-sm shadow-sm',
        aberto ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
      ]"
      :title="titulo"
      :aria-label="titulo"
      aria-haspopup="menu"
      :aria-expanded="aberto"
      @click="abrir"
    >
      <i :class="icone"></i><span v-if="rotulo" :class="compacto ? 'hidden sm:inline' : ''">{{ rotulo }}</span>
    </button>
    <Teleport to="body">
    <div
      v-if="aberto"
      ref="painel"
      role="menu"
      class="fixed z-[70] w-64 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-xl"
      :style="posicao"
      @keydown="teclar"
    >
      <div v-for="(s, i) in secoes" :key="s.nome || 'perigo'" :class="i ? 'mt-1 border-t border-slate-100 pt-1' : ''">
        <p v-if="s.nome && secoes.length > 1" class="px-3 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{{ s.nome }}</p>
        <button
          v-for="a in s.acoes"
          :key="a.id || a.rotulo"
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
          :class="[s.perigo ? 'text-red-700 hover:bg-red-50 focus:bg-red-50' : 'text-slate-700 hover:bg-slate-50 focus:bg-slate-100']"
          :disabled="a.desativado"
          :title="a.dica || undefined"
          @click="escolher(a)"
        >
          <i :class="[a.icone || 'fas fa-circle-dot', 'w-4 text-center text-xs', s.perigo ? '' : 'text-slate-400']"></i>
          <span class="min-w-0 flex-1">{{ a.rotulo }}<span v-if="a.detalhe" class="block text-xs text-slate-400">{{ a.detalhe }}</span></span>
        </button>
      </div>
    </div>
    </Teleport>
  </div>
</template>
