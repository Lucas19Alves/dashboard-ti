<script setup>
import { computed, nextTick, ref } from 'vue'
import { toPng } from 'html-to-image'
import { configuracoes } from '../composables/useConfiguracoes'

// Imagem quadrada (1080, até 4x) dos itens sem local para mandar no grupo:
// quantos faltam vincular, quantos chegaram hoje, por setor e os de maior estoque.
const props = defineProps({
  itens: { type: Array, default: () => [] } // ativos (pendente/vinculado/ignorado)
})

const QUADRADO = 1080
const ESCALAS = [4, 2, 1]
const gerando = ref(false)
const quadro = ref(null)
const hoje = new Date()
const loja = computed(() => [configuracoes.relatorio.empresa, configuracoes.relatorio.unidade].map(v => String(v || '').trim()).filter(Boolean).join(', '))

const pendentes = computed(() => props.itens)
const hojeISO = hoje.toLocaleDateString('sv-SE')
const recebidosHoje = computed(() => pendentes.value.filter(i => i.primeiroVisto === hojeISO).length)
const lista = computed(() => [...pendentes.value].sort((a, b) => b.estoque - a.estoque).slice(0, 10))
const semVenda = d => (d === null || d === undefined ? '—' : d === 1 ? '1 dia' : `${d.toLocaleString('pt-BR')} dias`)
const setores = computed(() => {
  const m = new Map()
  pendentes.value.forEach(i => m.set(i.setor, (m.get(i.setor) || 0) + 1))
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
})
const maxSetor = computed(() => Math.max(1, ...setores.value.map(s => s[1])))

const salvar = async () => {
  gerando.value = true
  try {
    await nextTick()
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    let url = ''
    for (const escala of ESCALAS) {
      try {
        url = await toPng(quadro.value, { cacheBust: true, pixelRatio: escala, width: QUADRADO, height: QUADRADO, backgroundColor: '#ffffff' })
      } catch {
        url = ''
      }
      if (url.length > 100) break
    }
    if (!url) throw new Error('Não foi possível gerar a imagem.')
    const link = document.createElement('a')
    link.download = `nao-vinculados-${hoje.toISOString().slice(0, 10)}.png`
    link.href = url
    link.click()
  } finally {
    gerando.value = false
  }
}
defineExpose({ salvar, gerando })
</script>

<template>
  <div v-if="gerando" class="pointer-events-none fixed top-0" style="left: -99999px" aria-hidden="true">
    <div ref="quadro" class="flex flex-col gap-5 bg-white p-9 text-slate-900" :style="{ width: `${QUADRADO}px`, height: `${QUADRADO}px`, fontFamily: 'IBM Plex Sans, system-ui, sans-serif' }">
      <div class="flex items-baseline justify-between">
        <p class="text-[30px] font-bold tracking-tight">Itens sem local, {{ hoje.toLocaleDateString('pt-BR') }}</p>
        <p class="text-[20px] font-semibold text-slate-500">{{ loja }}</p>
      </div>

      <div class="grid h-[230px] shrink-0 grid-cols-[430px_1fr] gap-5">
        <div class="flex flex-col justify-center rounded-[28px] px-8 text-white" :class="pendentes.length ? 'bg-blue-800' : 'bg-emerald-700'">
          <p class="text-[24px] font-semibold text-white/80">Não vinculados</p>
          <p class="text-[110px] font-bold leading-[1.02] tracking-tight">{{ pendentes.length.toLocaleString('pt-BR') }}</p>
          <p class="text-[20px] font-semibold text-white/90">{{ pendentes.length ? 'Fora da auditoria até ganhar local' : 'Todos os itens têm local' }}</p>
        </div>
        <div class="flex flex-col justify-center rounded-[28px] bg-blue-50 px-8">
          <p class="text-[24px] font-semibold text-blue-900">Recebidos hoje</p>
          <p class="text-[110px] font-bold leading-[1.02] tracking-tight text-blue-800">{{ recebidosHoje.toLocaleString('pt-BR') }}</p>
          <p class="text-[20px] font-semibold text-blue-900/80">{{ recebidosHoje === 1 ? 'item chegou' : 'itens chegaram' }} sem local hoje</p>
        </div>
      </div>

      <div class="grid min-h-0 flex-1 grid-cols-[380px_1fr] gap-5">
        <section class="flex min-h-0 min-w-0 flex-col rounded-[24px] p-6 ring-2 ring-slate-200">
          <p class="text-[24px] font-bold">Por setor</p>
          <ul class="mt-4 flex flex-col gap-3">
            <li v-for="[nome, n] in setores" :key="nome">
              <div class="flex justify-between text-[16px]"><span class="truncate pr-2 font-semibold">{{ nome }}</span><span class="font-bold">{{ n }}</span></div>
              <div class="mt-1 h-2 rounded-full bg-slate-100"><div class="h-2 rounded-full bg-blue-700" :style="{ width: `${(n / maxSetor) * 100}%` }"></div></div>
            </li>
          </ul>
        </section>
        <section class="flex min-h-0 min-w-0 flex-col rounded-[24px] p-6 ring-2 ring-slate-200">
          <p class="text-[24px] font-bold">Maior estoque</p>
          <p v-if="!lista.length" class="mt-6 text-[20px] text-slate-500">Nada pendente.</p>
          <ol v-else class="mt-3 flex flex-col divide-y divide-slate-100">
            <li v-for="item in lista" :key="item.codigo" class="flex items-center gap-3 py-[9px]">
              <div class="min-w-0 flex-1">
                <p class="truncate text-[17px] font-semibold leading-tight">{{ item.produto }}</p>
                <p class="truncate text-[14px] text-slate-500">{{ item.codigo }}, {{ item.estoque.toLocaleString('pt-BR') }} em estoque</p>
              </div>
              <div class="w-[118px] shrink-0 rounded-lg px-2.5 py-1 leading-tight" :class="item.sugestao?.local ? 'bg-blue-50 text-blue-900' : ''">
                <template v-if="item.sugestao?.local">
                  <p class="text-[12px] font-semibold opacity-75">Local sugerido</p>
                  <p class="truncate text-[17px] font-bold">{{ item.sugestao.local }}</p>
                </template>
              </div>
              <div class="w-[118px] shrink-0 rounded-lg bg-slate-50 px-2.5 py-1 leading-tight text-slate-800">
                <p class="text-[12px] font-semibold text-slate-500">Sem venda há</p>
                <p class="truncate text-[17px] font-bold" :class="item.diasSemVenda >= 30 ? 'text-red-700' : ''">{{ semVenda(item.diasSemVenda) }}</p>
              </div>
            </li>
          </ol>
        </section>
      </div>
    </div>
  </div>
</template>
