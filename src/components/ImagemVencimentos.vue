<script setup>
import { computed, nextTick, ref } from 'vue'
import { toPng } from 'html-to-image'
import { configuracoes } from '../composables/useConfiguracoes'

// Imagem quadrada das validades para mandar no WhatsApp (1080×1080 em até 4x),
// no mesmo formato da imagem do relatório de auditoria: o alerta em destaque,
// todos os setores e os itens mais urgentes.
const props = defineProps({
  resumo: { type: Object, required: true }, // { total, vencidos, hoje, ate3 }
  setores: { type: Array, default: () => [] }, // [{ nome, total, vencidos, hoje, ate3 }]
  urgentes: { type: Array, default: () => [] } // itens com _produto, _setor, _diasParaVencer, _prazo
})

const QUADRADO = 1080
const ESCALAS = [4, 2, 1]
const gerando = ref(false)
const quadro = ref(null)

const hoje = new Date()
const dataBR = hoje.toLocaleDateString('pt-BR')
const loja = computed(() => [configuracoes.relatorio.empresa, configuracoes.relatorio.unidade].map(v => String(v || '').trim()).filter(Boolean).join(', '))

// Setores com algo crítico primeiro; a altura da linha se ajusta para caber todos.
const setoresOrdenados = computed(() => [...props.setores]
  .sort((a, b) => b.vencidos - a.vencidos || b.hoje - a.hoje || b.ate3 - a.ate3 || b.total - a.total))
const ALTURA_TABELA = 520
const linha = computed(() => Math.max(24, Math.min(46, Math.floor(ALTURA_TABELA / (setoresOrdenados.value.length + 1)))))
const fonte = computed(() => Math.max(13, Math.min(21, Math.round(linha.value * 0.46))))
const lista = computed(() => props.urgentes.slice(0, 10))
const quando = d => (d === 0 ? 'hoje' : d < 0 ? `há ${-d} dia${d === -1 ? '' : 's'}` : `em ${d} dia${d === 1 ? '' : 's'}`)
const COR_PRAZO = { vencidos: 'bg-red-600', hoje: 'bg-orange-500', ate3: 'bg-amber-400' }

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
    link.download = `validades-${hoje.toISOString().slice(0, 10)}.png`
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
        <p class="text-[30px] font-bold tracking-tight">Validades, {{ dataBR }}</p>
        <p class="text-[20px] font-semibold text-slate-500">{{ loja || `${resumo.total.toLocaleString('pt-BR')} itens monitorados` }}</p>
      </div>

      <!-- Topo: vencidos em destaque e os outros prazos -->
      <div class="grid h-[250px] shrink-0 grid-cols-[430px_1fr] gap-5">
        <div class="flex flex-col justify-center rounded-[28px] px-8 text-white" :class="resumo.vencidos ? 'bg-red-700' : 'bg-emerald-700'">
          <p class="text-[24px] font-semibold text-white/80">Vencidos</p>
          <p class="text-[110px] font-bold leading-[1.02] tracking-tight">{{ resumo.vencidos.toLocaleString('pt-BR') }}</p>
          <p class="text-[20px] font-semibold text-white/90">{{ resumo.vencidos ? 'Retirar da venda hoje' : 'Nenhum item vencido' }}</p>
        </div>
        <div class="grid grid-cols-2 grid-rows-2 gap-4">
          <div class="flex flex-col justify-center rounded-[22px] bg-orange-50 px-6">
            <p class="text-[17px] font-semibold text-orange-800">Vencem hoje</p>
            <p class="text-[46px] font-bold leading-tight text-orange-700">{{ resumo.hoje.toLocaleString('pt-BR') }}</p>
            <p class="text-[15px] text-orange-800/80">rebaixar e expor</p>
          </div>
          <div class="flex flex-col justify-center rounded-[22px] bg-amber-50 px-6">
            <p class="text-[17px] font-semibold text-amber-800">Em até 3 dias</p>
            <p class="text-[46px] font-bold leading-tight text-amber-700">{{ resumo.ate3.toLocaleString('pt-BR') }}</p>
            <p class="text-[15px] text-amber-800/80">planejar giro</p>
          </div>
          <div class="col-span-2 flex items-center justify-between rounded-[22px] bg-slate-50 px-6">
            <div>
              <p class="text-[17px] font-semibold text-slate-500">Itens monitorados</p>
              <p class="text-[40px] font-bold leading-tight">{{ resumo.total.toLocaleString('pt-BR') }}</p>
            </div>
            <p class="max-w-[260px] text-right text-[16px] text-slate-500">{{ (resumo.vencidos + resumo.hoje + resumo.ate3).toLocaleString('pt-BR') }} precisam de ação nos próximos 3 dias</p>
          </div>
        </div>
      </div>

      <!-- Setores (esquerda) e itens mais urgentes (direita) -->
      <div class="grid min-h-0 flex-1 grid-cols-2 gap-5">
        <section class="flex min-h-0 flex-col rounded-[24px] p-6 ring-2 ring-slate-200">
          <p class="text-[24px] font-bold">Por setor</p>
          <table class="mt-3 w-full table-fixed">
            <thead>
              <tr class="text-left text-[14px] font-semibold text-slate-500" :style="{ height: `${linha}px` }">
                <th>Setor</th>
                <th class="w-[70px] text-right">Venc.</th>
                <th class="w-[60px] text-right">Hoje</th>
                <th class="w-[60px] text-right">3 dias</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in setoresOrdenados" :key="s.nome" class="border-t border-slate-100" :style="{ height: `${linha}px`, fontSize: `${fonte}px` }">
                <td class="truncate pr-2 font-semibold">{{ s.nome }}</td>
                <td class="text-right font-bold" :class="s.vencidos ? 'text-red-700' : 'text-slate-300'">{{ s.vencidos }}</td>
                <td class="text-right font-bold" :class="s.hoje ? 'text-orange-700' : 'text-slate-300'">{{ s.hoje }}</td>
                <td class="text-right font-bold" :class="s.ate3 ? 'text-amber-700' : 'text-slate-300'">{{ s.ate3 }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="flex min-h-0 flex-col rounded-[24px] p-6 ring-2 ring-slate-200">
          <p class="text-[24px] font-bold">Mais urgentes</p>
          <p v-if="!lista.length" class="mt-6 text-[20px] text-slate-500">Nenhum item vencido ou perto de vencer.</p>
          <ol v-else class="mt-3 flex flex-1 flex-col justify-between">
            <li v-for="item in lista" :key="item._codigo + item._validadeISO" class="flex items-center gap-3">
              <span class="h-9 w-1.5 shrink-0 rounded-full" :class="COR_PRAZO[item._prazo] || 'bg-slate-300'"></span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-[18px] font-semibold leading-tight">{{ item._produto }}</p>
                <p class="truncate text-[14px] text-slate-500">{{ item._codigo }}, {{ item._setor }}</p>
              </div>
              <span class="shrink-0 text-[17px] font-bold" :class="item._prazo === 'vencidos' ? 'text-red-700' : item._prazo === 'hoje' ? 'text-orange-700' : 'text-amber-700'">{{ quando(item._diasParaVencer) }}</span>
            </li>
          </ol>
        </section>
      </div>
    </div>
  </div>
</template>
