<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuditoriasStore } from '../stores/auditoriasStore'
import { useVencimentosStore } from '../stores/vencimentosStore'
import { usePaleta } from '../composables/usePaleta'
import { exportarBackupJson } from '../utils/backup'
import { useAparencia } from '../composables/useAparencia'
import { correspondeBusca, formatarDataBR } from '../utils/busca'

const router = useRouter()
const auditoriasStore = useAuditoriasStore()
const vencStore = useVencimentosStore()
const { aberta, abrir, fechar, alternar } = usePaleta()

const consulta = ref('')
const indiceAtivo = ref(0)
const campo = ref(null)
const lista = ref(null)

const hojeISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const paginas = [
  { id: 'p-inicio', titulo: 'Início', detalhe: 'Painel operacional', icone: 'fas fa-home', termos: 'painel dashboard home', acao: () => router.push('/') },
  { id: 'p-auditorias', titulo: 'Auditorias', detalhe: 'Calendário e histórico', icone: 'fas fa-clipboard-check', termos: 'calendario historico', acao: () => router.push('/auditorias') },
  { id: 'p-analise', titulo: 'Análise de auditorias', detalhe: 'Comparativos e evolução', icone: 'fas fa-chart-line', termos: 'analise graficos', acao: () => router.push('/auditorias/analise') },
  { id: 'p-documentacao', titulo: 'Documentação', detalhe: 'Como o sistema funciona', icone: 'fas fa-book', termos: 'ajuda manual docs guia', acao: () => router.push('/documentacao') },
  { id: 'p-vencimentos', titulo: 'Vencimentos', detalhe: 'Controle de validades', icone: 'fas fa-calendar-alt', termos: 'validade vencidos', acao: () => router.push('/vencimentos') }
]

const acoes = computed(() => {
  const tiposHoje = auditoriasStore.tiposAuditoriaPorDia[new Date().getDay()] || []
  const itens = tiposHoje.map(tipo => ({
    id: `a-nova-${tipo}`,
    titulo: `Nova auditoria de ${tipo} hoje`,
    detalhe: 'Abre o formulário com a data de hoje',
    icone: 'fas fa-plus',
    termos: 'criar nova auditoria',
    acao: () => router.push({ path: '/auditorias', query: { data: hojeISO(), tipo } })
  }))
  itens.push(
    { id: 'a-tema', titulo: 'Alternar tema claro/escuro', detalhe: 'Aparência salva neste navegador', icone: 'fas fa-circle-half-stroke', termos: 'tema escuro claro dark modo noturno aparencia', acao: () => useAparencia().alternarTema() },
    { id: 'a-criticos', titulo: 'Ver itens vencidos', detalhe: 'Explorar filtrado por vencidos', icone: 'fas fa-triangle-exclamation', termos: 'vencidos criticos', acao: () => router.push({ path: '/vencimentos', query: { prazo: 'vencidos' } }) },
    {
      id: 'a-backup',
      titulo: 'Exportar backup',
      detalhe: 'Baixa um arquivo .json.gz com todos os dados',
      icone: 'fas fa-download',
      termos: 'backup exportar salvar',
      acao: async () => {
        try {
          await exportarBackupJson()
          auditoriasStore.addToast('Backup exportado.', 'success')
        } catch (erro) {
          auditoriasStore.addToast('Erro ao exportar backup: ' + (erro?.message || 'desconhecido'), 'error')
        }
      }
    }
  )
  return itens
})

const auditoriasEncontradas = computed(() => {
  const todas = [...(auditoriasStore.auditorias || [])].sort((a, b) => String(b.data).localeCompare(String(a.data)) || b.id - a.id)
  const filtradas = consulta.value.trim()
    ? todas.filter(a => correspondeBusca(consulta.value, [a.tipo, formatarDataBR(a.data), `#${a.id}`, a.status === 'fechada' ? 'fechada' : 'aberta andamento']))
    : todas
  return filtradas.slice(0, consulta.value.trim() ? 8 : 4).map(a => ({
    id: `aud-${a.id}`,
    titulo: `${a.tipo} · ${formatarDataBR(a.data)}`,
    detalhe: `#${a.id} · ${a.status === 'fechada' ? 'Fechada' : 'Em andamento'}`,
    icone: a.status === 'fechada' ? 'fas fa-lock' : 'fas fa-clipboard-list',
    acao: () => router.push(`/auditoria/${a.id}`)
  }))
})

const produtosEncontrados = computed(() => {
  const termo = consulta.value.trim()
  if (termo.length < 2) return []
  const resultado = []
  for (const item of vencStore.itens || []) {
    if (!correspondeBusca(termo, [item._codigo, item._produto])) continue
    resultado.push({
      id: `v-${item.id ?? item._codigo}-${item._validadeISO}`,
      titulo: String(item._produto || item._codigo || '-'),
      detalhe: `${item._codigo || '-'} · validade ${formatarDataBR(item._validadeISO)} · ${item._setor || '-'}`,
      icone: 'fas fa-box',
      acao: () => router.push({ path: '/vencimentos', query: { busca: String(item._codigo || item._produto || '') } })
    })
    if (resultado.length >= 6) break
  }
  return resultado
})

const grupos = computed(() => {
  const filtrar = itens => itens.filter(i => correspondeBusca(consulta.value, [i.titulo, i.detalhe, i.termos]))
  return [
    { nome: 'Ações', itens: filtrar(acoes.value) },
    { nome: 'Páginas', itens: filtrar(paginas) },
    { nome: 'Auditorias', itens: auditoriasEncontradas.value },
    { nome: 'Produtos com validade', itens: produtosEncontrados.value }
  ].filter(g => g.itens.length)
})

const resultadosPlanos = computed(() => grupos.value.flatMap(g => g.itens))
const posicao = item => resultadosPlanos.value.indexOf(item)

watch(consulta, () => { indiceAtivo.value = 0 })
watch(aberta, async valor => {
  if (!valor) return
  consulta.value = ''
  indiceAtivo.value = 0
  await nextTick()
  campo.value?.focus()
})

const executar = async (item) => {
  if (!item) return
  fechar()
  await item.acao()
}

const mover = async (passo) => {
  const total = resultadosPlanos.value.length
  if (!total) return
  indiceAtivo.value = (indiceAtivo.value + passo + total) % total
  await nextTick()
  lista.value?.querySelector('[data-ativo="true"]')?.scrollIntoView({ block: 'nearest' })
}

const aoTeclarCampo = (evento) => {
  if (evento.key === 'ArrowDown') { evento.preventDefault(); mover(1) }
  else if (evento.key === 'ArrowUp') { evento.preventDefault(); mover(-1) }
  else if (evento.key === 'Enter') { evento.preventDefault(); executar(resultadosPlanos.value[indiceAtivo.value]) }
  else if (evento.key === 'Escape') { evento.preventDefault(); fechar() }
}

const estaDigitando = alvo => alvo instanceof HTMLElement && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))

const atalhoGlobal = (evento) => {
  if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'k') {
    evento.preventDefault()
    alternar()
  } else if (evento.key === '/' && !aberta.value && !estaDigitando(evento.target)) {
    evento.preventDefault()
    abrir()
  }
}

onMounted(() => window.addEventListener('keydown', atalhoGlobal))
onBeforeUnmount(() => window.removeEventListener('keydown', atalhoGlobal))
</script>

<template>
  <Teleport to="body">
    <div v-if="aberta" class="ui-fade-in fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/40 px-4 pt-[12vh]" @click.self="fechar">
      <section class="ui-pop-in w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label="Busca rápida">
        <div class="flex items-center gap-3 border-b border-slate-100 px-4">
          <i class="fas fa-search text-slate-400"></i>
          <input
            ref="campo"
            v-model="consulta"
            type="search"
            class="h-14 min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
            placeholder="Buscar páginas, auditorias, produtos..."
            aria-label="Buscar"
            autocomplete="off"
            @keydown="aoTeclarCampo"
          >
          <kbd class="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 sm:inline">Esc</kbd>
        </div>

        <div ref="lista" class="max-h-[55vh] overflow-y-auto p-2">
          <p v-if="!resultadosPlanos.length" class="px-3 py-10 text-center text-sm text-slate-500">
            Nada encontrado para "{{ consulta }}".
          </p>
          <div v-for="grupo in grupos" :key="grupo.nome" class="mb-1">
            <p class="px-3 pb-1 pt-2 text-xs font-semibold text-slate-400">{{ grupo.nome }}</p>
            <button
              v-for="item in grupo.itens"
              :key="item.id"
              type="button"
              class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition"
              :class="posicao(item) === indiceAtivo ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-50'"
              :data-ativo="posicao(item) === indiceAtivo"
              @mousemove="indiceAtivo = posicao(item)"
              @click="executar(item)"
            >
              <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-lg" :class="posicao(item) === indiceAtivo ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'">
                <i :class="[item.icone, 'text-xs']"></i>
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold">{{ item.titulo }}</span>
                <span v-if="item.detalhe" class="block truncate text-xs text-slate-500">{{ item.detalhe }}</span>
              </span>
              <i v-if="posicao(item) === indiceAtivo" class="fas fa-arrow-turn-down rotate-90 text-xs text-blue-500"></i>
            </button>
          </div>
        </div>

        <footer class="flex items-center gap-4 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          <span><kbd class="font-semibold">↑↓</kbd> navegar</span>
          <span><kbd class="font-semibold">Enter</kbd> abrir</span>
          <span class="ml-auto"><kbd class="font-semibold">Ctrl K</kbd> ou <kbd class="font-semibold">/</kbd> abre a busca</span>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
