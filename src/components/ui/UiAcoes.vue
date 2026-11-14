<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { executarAcao, registrarAcoes } from '../../composables/useAcoes'
import UiButton from './UiButton.vue'
import UiMenu from './UiMenu.vue'

// Linha de ações padrão: a ação principal em destaque, poucas secundárias como botão e o resto
// em "Mais" (Ações, Dados, Exportar, Ver; Limpar/Apagar sempre por último, em vermelho).
// No celular as secundárias também vão para o menu. Todas entram na busca rápida (Ctrl+K).
// Ações: ver composables/useAcoes.js.
const props = defineProps({
  acoes: { type: Array, default: () => [] },
  // Nome da tela/aba na busca rápida (ex.: "Estoque · Não vinculados").
  contexto: { type: String, default: '' },
  registrar: { type: Boolean, default: true },
  tamanho: { type: String, default: 'md' }
})

const visiveis = computed(() => props.acoes.filter(a => a && !a.oculta))
const principais = computed(() => visiveis.value.filter(a => a.nivel === 'principal'))
const secundarias = computed(() => visiveis.value.filter(a => a.nivel === 'secundaria'))

// Telas estreitas: as secundárias entram no menu.
const consulta = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 639px)') : null
const pequena = ref(Boolean(consulta?.matches))
const mudou = e => { pequena.value = e.matches }
consulta?.addEventListener?.('change', mudou)
onBeforeUnmount(() => consulta?.removeEventListener?.('change', mudou))

const doMenu = computed(() => {
  const lista = visiveis.value.filter(a => !a.nivel || a.nivel === 'menu' || (pequena.value && a.nivel === 'secundaria'))
  // Menu com tudo indisponível (ex.: plano de ação ainda vazio) não aparece: só ocuparia espaço.
  return lista.some(a => !a.desativado) ? lista : []
})

if (props.registrar) registrarAcoes(props.contexto, () => visiveis.value)
</script>

<template>
  <div v-if="visiveis.length" class="flex flex-wrap items-center gap-2">
    <template v-if="!pequena">
      <UiButton
        v-for="a in secundarias"
        :key="a.id || a.rotulo"
        :variant="a.perigo ? 'dangerSoft' : 'secondary'"
        :size="tamanho"
        :disabled="a.desativado"
        :title="a.dica || undefined"
        @click="executarAcao(a)"
      >
        <i v-if="a.icone" :class="a.icone"></i>{{ a.rotulo }}
      </UiButton>
    </template>
    <UiMenu :acoes="doMenu" :estilo="tamanho === 'sm' ? 'ferramenta' : 'botao'" />
    <UiButton
      v-for="a in principais"
      :key="a.id || a.rotulo"
      :variant="a.perigo ? 'danger' : 'primary'"
      :size="tamanho"
      :disabled="a.desativado"
      :title="a.dica || undefined"
      @click="executarAcao(a)"
    >
      <i v-if="a.icone" :class="a.icone"></i>{{ a.rotulo }}
    </UiButton>
  </div>
</template>
