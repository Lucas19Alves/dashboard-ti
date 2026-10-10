<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import fonte from '../../DOCUMENTATION.md?raw'
import { renderizarMarkdown } from '../utils/markdown'
import UiPageHeader from '../components/ui/UiPageHeader.vue'

// Documentação do sistema dentro do app, gerada do DOCUMENTATION.md do projeto.
const route = useRoute()
const router = useRouter()
const { html, titulos } = renderizarMarkdown(fonte.replace(/^# .*\n/, ''))
const sumario = titulos.filter(t => t.nivel === 2 || t.nivel === 3)
const conteudo = ref(null)
const ativo = ref(sumario[0]?.id || '')
const busca = ref('')
const sumarioVisivel = computed(() => {
  const termo = busca.value.trim().toLowerCase()
  if (!termo) return sumario
  return sumario.filter(t => t.texto.toLowerCase().includes(termo) ||
    conteudo.value?.querySelector(`#${CSS.escape(t.id)}`)?.parentElement?.textContent.toLowerCase().includes(termo))
})

const imprimir = () => window.print()

const irPara = (id, comportamento = 'smooth') => {
  const alvo = conteudo.value?.querySelector(`#${CSS.escape(id)}`)
  if (!alvo) return
  ativo.value = id
  window.scrollTo({ top: alvo.getBoundingClientRect().top + window.scrollY - 88, behavior: comportamento })
  if (route.hash !== `#${id}`) router.replace({ hash: `#${id}` })
}

// Links internos (#secao) rolam até a seção sem recarregar.
const aoClicar = (evento) => {
  const link = evento.target.closest('a[href^="#"]')
  if (!link) return
  evento.preventDefault()
  irPara(decodeURIComponent(link.getAttribute('href').slice(1)))
}

let observador
onMounted(async () => {
  await nextTick()
  const secoes = sumario.map(t => conteudo.value?.querySelector(`#${CSS.escape(t.id)}`)).filter(Boolean)
  observador = new IntersectionObserver(entradas => {
    const visivel = entradas.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
    if (visivel) ativo.value = visivel.target.id
  }, { rootMargin: '-90px 0px -65% 0px' })
  secoes.forEach(s => observador.observe(s))
  if (route.hash) irPara(decodeURIComponent(route.hash.slice(1)), 'auto')
})
onBeforeUnmount(() => observador?.disconnect())
watch(ativo, id => {
  document.querySelector(`[data-sumario="${id}"]`)?.scrollIntoView({ block: 'nearest' })
})
</script>

<template>
  <div class="ui-page">
    <UiPageHeader title="Documentação do sistema" subtitle="Como o Dashboard TI funciona: auditorias, vencimentos, análise, mapa da loja e backup." icon="fas fa-book" tone="indigo">
      <template #actions>
        <button type="button" class="ui-btn-secondary py-2 print:hidden" @click="imprimir"><i class="fas fa-print"></i>Imprimir</button>
      </template>
    </UiPageHeader>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside class="print:hidden lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start">
        <nav class="ui-card flex max-h-[inherit] flex-col p-3" aria-label="Sumário">
          <div class="relative">
            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
            <input v-model="busca" type="search" class="ui-input py-2 pl-8 text-xs" placeholder="Buscar na documentação...">
          </div>
          <ul class="mt-3 min-h-0 flex-1 space-y-0.5 overflow-y-auto text-sm">
            <li v-for="t in sumarioVisivel" :key="t.id">
              <a
                :href="`#${t.id}`"
                :data-sumario="t.id"
                class="block truncate rounded-lg px-2.5 py-1.5 transition"
                :class="[t.nivel === 3 ? 'pl-6 text-xs' : 'font-semibold', ativo === t.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900']"
                @click.prevent="irPara(t.id)"
              >{{ t.texto }}</a>
            </li>
            <li v-if="!sumarioVisivel.length" class="px-2.5 py-4 text-center text-xs text-slate-400">Nada encontrado.</li>
          </ul>
        </nav>
      </aside>

      <!-- eslint-disable-next-line vue/no-v-html -- conteúdo do próprio projeto, escapado em renderizarMarkdown -->
      <article ref="conteudo" class="doc ui-card min-w-0 px-5 py-6 md:px-10 md:py-8" @click="aoClicar" v-html="html"></article>
    </div>
  </div>
</template>

<style scoped>
.doc { color: #334155; font-size: 0.9375rem; line-height: 1.7; }
.doc :deep(h2) { margin: 2.25rem 0 0.75rem; padding-top: 1.25rem; border-top: 1px solid #e2e8f0; font-size: 1.35rem; font-weight: 800; color: #0f172a; letter-spacing: -0.01em; scroll-margin-top: 6rem; }
.doc :deep(h2:first-of-type) { margin-top: 0; padding-top: 0; border-top: 0; }
.doc :deep(h3) { margin: 1.75rem 0 0.5rem; font-size: 1.05rem; font-weight: 700; color: #1e293b; scroll-margin-top: 6rem; }
.doc :deep(h4) { margin: 1.25rem 0 0.35rem; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6366f1; }
.doc :deep(p) { margin: 0.6rem 0; }
.doc :deep(ul), .doc :deep(ol) { margin: 0.5rem 0; padding-left: 1.35rem; }
.doc :deep(ul) { list-style: disc; }
.doc :deep(ol) { list-style: decimal; }
.doc :deep(li) { margin: 0.3rem 0; }
.doc :deep(li::marker) { color: #94a3b8; }
.doc :deep(strong) { color: #0f172a; font-weight: 700; }
.doc :deep(a) { color: #4f46e5; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }
.doc :deep(code) { border-radius: 0.375rem; background: #f1f5f9; padding: 0.1rem 0.35rem; font-size: 0.82em; color: #be185d; }
.doc :deep(pre) { margin: 0.75rem 0; overflow-x: auto; border-radius: 0.75rem; background: #0f172a; padding: 1rem 1.25rem; font-size: 0.8rem; line-height: 1.6; }
.doc :deep(pre code) { background: none; padding: 0; color: #e2e8f0; }
.doc :deep(hr) { display: none; }
@media print {
  .doc { border: 0; box-shadow: none; padding: 0; }
}
</style>
