<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import UiButton from './ui/UiButton.vue'
import UiModal from './ui/UiModal.vue'
import { tutorial } from '../composables/useTutorial'

// Tutorial página por página: o que cada tela faz e como usar, em passos curtos.
const PASSOS = [
  {
    titulo: 'Bem-vindo ao Dashboard Loja',
    icone: 'fas fa-store',
    resumo: 'O sistema transforma as planilhas da loja (auditorias, validades e itens sem local) em listas, gráficos, relatórios e imagens para o time.',
    itens: [
      ['Menu de cima', 'Início, Auditorias, Análise, Vencimentos e Estoque. No celular, abra pelo botão de três linhas.'],
      ['Dados no navegador', 'Tudo fica salvo neste navegador, neste computador. Nada vai para a internet. Por isso, faça backup (último passo do tutorial).'],
      ['Planilhas', 'Exporte do sistema da loja em .xlsx ou .csv e arraste para a tela certa. O sistema acha o cabeçalho sozinho.'],
      ['Este tutorial', 'Use Próximo e Anterior. No computador, os tópicos ficam numa lista à esquerda. "Abrir esta página" leva até a tela explicada.']
    ]
  },
  {
    titulo: 'Início',
    rota: '/',
    icone: 'fas fa-home',
    resumo: 'O painel do dia: o que já foi feito, o que falta e o que precisa de atenção.',
    itens: [
      ['Agenda da semana', 'Mostra os tipos de auditoria de cada dia e a situação: na meta, fora da meta, em andamento ou não criada. Clique para abrir ou criar.'],
      ['Evolução do % pendente', 'As últimas auditorias de cada tipo comparadas com a meta.'],
      ['Saúde das validades', 'Setores mais críticos e itens mais urgentes da última planilha de vencimentos.'],
      ['Últimas auditorias', 'Atalho para as auditorias mais recentes.'],
      ['Dados e backup', 'Exportar e importar backup, e o espaço usado no navegador.']
    ]
  },
  {
    titulo: 'Auditorias: criar e acompanhar',
    rota: '/auditorias',
    icone: 'fas fa-clipboard-check',
    resumo: 'Onde cada auditoria (Etiqueta, Presença e Ruptura) é criada a partir da planilha do sistema.',
    itens: [
      ['Calendário semanal', 'Escolha o dia (setas mudam a semana) e clique em Criar no tipo desejado, ou arraste a planilha.'],
      ['SKU total', 'Informe quantos itens deveriam ser auditados. É a base do % pendente. Pode ser corrigido depois no detalhe.'],
      ['Conferência da planilha', 'Antes de salvar, o sistema mostra o que encontrou e o que vale conferir. Confirme para salvar.'],
      ['Em andamento', 'Cada auditoria aberta mostra quanto falta para a meta. Envie planilhas novas ao longo do dia para atualizar.'],
      ['Fechar', 'Quando a contagem terminar, feche a auditoria. Ela vai para o histórico.'],
      ['Histórico', 'Abas Etiqueta, Presença e Ruptura listam as auditorias por mês, com filtro por situação.'],
      ['Ruptura', 'Continua a Presença da mesma semana: o local e o % por setor vêm da Presença.']
    ]
  },
  {
    titulo: 'Detalhe da auditoria',
    rota: '/auditorias',
    rotaTexto: 'Abra uma auditoria na lista',
    icone: 'fas fa-magnifying-glass-chart',
    resumo: 'Clique numa auditoria para ver tudo sobre ela. As abas ficam no topo e o endereço guarda a aba aberta.',
    itens: [
      ['Visão geral', '% pendente, lidos, pendentes, com problema, caminho até a meta e comparação com a auditoria anterior.'],
      ['Mapa da loja', 'A planta da loja colorida por % pendente ou por leituras. Clique numa área para ver quem leu e os itens.'],
      ['Usuários', 'Pódio, leituras por hora, ritmo de cada pessoa e quem leu cada setor. Clique num nome para abrir a ficha.'],
      ['Plano e escala', 'Ações geradas dos pendentes (a fazer, em andamento, resolvida) e escala sugerida por setor.'],
      ['Dados', 'A lista completa com busca, filtros por setor, local e usuário, CSV e impressão.'],
      ['Estatísticas', 'Números por setor, local, fornecedor e situação.'],
      ['Relatório', 'Gera o PDF da auditoria ou salva uma imagem quadrada para o WhatsApp.']
    ]
  },
  {
    titulo: 'Mapa da loja',
    rota: '/auditorias',
    rotaTexto: 'Abra uma auditoria e a aba Mapa',
    icone: 'fas fa-map-location-dot',
    resumo: 'O mapa é montado pelos locais da planilha (ex.: G05A é corredor 05, face A).',
    itens: [
      ['Cores', 'Escolha colorir por % pendente, por leituras ou pelas leituras de um usuário.'],
      ['Editar layout', 'Arraste, redimensione, gire e renomeie as áreas. Aumente ou diminua o mapa em cada borda.'],
      ['Locais fora do padrão', 'Aparecem numa lista abaixo do mapa. No modo edição, clique para colocar no mapa.'],
      ['Vale para tudo', 'O layout fica salvo e é usado em todas as auditorias, na Análise e nos Vencimentos.']
    ]
  },
  {
    titulo: 'Análise de auditorias',
    rota: '/auditorias/analise',
    icone: 'fas fa-chart-line',
    resumo: 'Visão de várias auditorias juntas para ver tendências e reincidências.',
    itens: [
      ['Filtros', 'Período (30 dias a 12 meses ou datas), tipo, status e meta. Ficam lembrados neste navegador.'],
      ['Visão geral', 'Indicadores comparados com o período anterior, destaques automáticos e gráfico mensal (clique num mês para filtrar).'],
      ['Setores e Usuários', 'Quantas vezes cada setor passou da meta e o ranking de leituras por pessoa.'],
      ['Mapa, Reincidência e Ruptura em valor', 'Onde os pendentes se repetem e quanto a ruptura custa.'],
      ['Auditorias', 'Lista com busca, CSV e comparação de duas auditorias lado a lado.'],
      ['Relatório PDF', 'Resumo do período, setores, usuários e auditorias em folhas A4 numeradas.']
    ]
  },
  {
    titulo: 'Ficha do colaborador',
    icone: 'fas fa-id-badge',
    resumo: 'Tudo sobre uma pessoa ao longo das auditorias, pronta para usar no feedback.',
    itens: [
      ['Como abrir', 'Clique no nome de um usuário na aba Usuários da auditoria ou da Análise e escolha "Ficha do colaborador".'],
      ['O que mostra', 'Leituras, ritmo, problemas, evolução e as auditorias em que a pessoa participou.'],
      ['Imprimir', 'O botão Relatório gera a ficha em PDF.']
    ]
  },
  {
    titulo: 'Vencimentos',
    rota: '/vencimentos',
    icone: 'fas fa-calendar-alt',
    resumo: 'Controle das validades a partir da planilha do sistema.',
    itens: [
      ['Importar', 'Clique em Nova importação e envie a planilha de validades. A nova substitui a anterior.'],
      ['Visão geral', 'Vencidos, que vencem hoje e em até 3 dias, com os itens mais urgentes.'],
      ['Explorar', 'Filtre por setor, fornecedor, prazo ou busca. Exporte a lista filtrada em CSV.'],
      ['Análise', 'Setores e fornecedores com mais itens críticos.'],
      ['Mapa e ruptura', 'Onde estão os itens perto de vencer e quais vencem no estoque enquanto faltam na gôndola.'],
      ['Compartilhar', 'Relatório em PDF, CSV da lista filtrada e imagem quadrada para o WhatsApp.']
    ]
  },
  {
    titulo: 'Estoque',
    rota: '/estoque',
    icone: 'fas fa-boxes-stacked',
    resumo: 'Problemas de estoque a partir da planilha de estoque total da loja, cruzada com as auditorias de Presença e Ruptura, as validades e os não vinculados.',
    itens: [
      ['Importar estoque total', 'Envie o relatório de produtos com estoque do sistema (Código, Nome, Estoque, Dias sem venda...). Ele passa a ser a base: só entram os itens dele, com o estoque e os dias sem venda dele. Importe de novo para atualizar.'],
      ['Visão geral', 'Quantos problemas há de cada tipo, os itens mais graves e os locais com mais problemas.'],
      ['Estoque da loja', 'Todos os itens da planilha com local, situação na última auditoria, validade e problemas. Filtre por situação, setor e local e exporte em CSV.'],
      ['Reincidências', 'Itens com estoque que não são lidos há 14 dias ou mais (dá para mudar para 21, 30 ou 60). O diagnóstico diz se o item vende, se foi achado em outro local ou se o estoque provavelmente não existe.'],
      ['Estoque zerado', 'Itens lidos na gôndola com estoque zerado no sistema: falta lançar a entrada ou ajustar.'],
      ['Parados', 'Itens com estoque e 30+ dias sem venda, cruzados com as validades.'],
      ['Sem local', 'Itens com estoque na planilha que nunca apareceram nas auditorias: não vinculados, com o local sugerido. Insumos (setor Outros) ficam de fora. Os que já foram auditados e saíram da Presença entram nas Reincidências.'],
      ['Insumos', 'Itens do setor Outros (sacolas, pallets, tabloides...): não entram em nenhuma lista de problema; a aba serve para acompanhar o estoque e o consumo deles.'],
      ['Filtros das listas', 'Toda tabela do sistema tem a mesma barra: busca, filtros rápidos por coluna, atalhos, filtros avançados (condições por qualquer coluna), ordenação por vários critérios, colunas, agrupamento, CSV, impressão e paginação.'],
      ['Onde agir', 'Os problemas somados por local, setor ou fornecedor. Clique num número para ver os itens.'],
      ['Consultar item', 'Busque um código ou nome para ver a ficha do produto em todas as auditorias.']
    ]
  },
  {
    titulo: 'Não vinculados (em Estoque)',
    rota: '/estoque?aba=nao-vinculados',
    icone: 'fas fa-link-slash',
    resumo: 'Itens que chegaram sem local no sistema ficam fora da auditoria. Aqui você vê onde cada um deve ficar.',
    itens: [
      ['Importar todo dia', 'Envie a planilha de itens não vinculados do dia. Quem sumiu da planilha sai da lista sozinho (conta como vinculado).'],
      ['Local sugerido', 'Vem do histórico das auditorias: onde o item foi lido, onde já esteve vinculado ou onde ficam os itens da mesma classe.'],
      ['Itens', 'Lista do mais importante (vende toda semana) ao menos importante, com estoque e dias sem venda. Clique no nome para ver o item nas auditorias.'],
      ['Por local sugerido', 'Os itens agrupados por local, para conferir um local de cada vez.'],
      ['Vínculos suspeitos', 'Itens com local que foram lidos em outro local em duas ou mais auditorias.'],
      ['Vincular', 'O vínculo é feito no sistema da loja. Depois, use Recalcular se importar auditorias novas.'],
      ['Compartilhar', 'Relatório em PDF, CSV e imagem quadrada para o WhatsApp.']
    ]
  },
  {
    titulo: 'Relatórios, imagens e CSV',
    icone: 'fas fa-file-pdf',
    resumo: 'Todas as telas usam o mesmo jeito de gerar relatório.',
    itens: [
      ['Relatório', 'Abre uma janela para escolher as seções, as colunas, a orientação da folha, observações e campos de assinatura. Depois, "Gerar PDF" e "Salvar como PDF" na impressão.'],
      ['Escolhas lembradas', 'O sistema lembra o que você marcou em cada relatório.'],
      ['Salvar imagem', 'Gera uma imagem quadrada em alta resolução, boa para mandar no grupo.'],
      ['CSV', 'Baixa a lista para abrir no Excel.']
    ]
  },
  {
    titulo: 'Busca rápida e atalhos',
    icone: 'fas fa-magnifying-glass',
    resumo: 'Encontre qualquer coisa sem navegar pelos menus.',
    itens: [
      ['Abrir', 'Ctrl + K (⌘ + K no Mac), a tecla / fora de campos de texto, ou a lupa no menu.'],
      ['O que encontra', 'Páginas, ações (nova auditoria do dia, exportar backup, tema), auditorias por tipo ou data e produtos com validade.'],
      ['Esc', 'Fecha qualquer janela aberta.']
    ]
  },
  {
    titulo: 'Configurações',
    icone: 'fas fa-gear',
    acao: 'configuracoes',
    resumo: 'O botão de engrenagem no menu ajusta o sistema para a sua loja.',
    itens: [
      ['Aparência', 'Tema claro ou escuro e tamanho do texto.'],
      ['Auditoria', 'Horário de início e fim das auditorias e a meta de % pendente.'],
      ['Relatórios', 'Orientação padrão da folha, nome da empresa e da unidade no cabeçalho e campos de assinatura.'],
      ['Backup automático', 'Escolha uma pasta (ex.: OneDrive) e o sistema grava o backup sozinho.']
    ]
  },
  {
    titulo: 'Backup e segurança',
    rota: '/',
    rotaTexto: 'Ir para Dados e backup',
    icone: 'fas fa-shield-halved',
    resumo: 'Como os dados ficam só neste navegador, o backup é o que protege o histórico.',
    itens: [
      ['Exportar backup', 'No Início (Dados e backup) ou na busca rápida. Gera um arquivo .json.gz com tudo.'],
      ['Importar backup', 'Recupera tudo em outro computador ou depois de limpar o navegador. Substitui os dados atuais.'],
      ['Lembrete', 'O sistema avisa quando há mudanças sem backup ou quando faz 7 dias sem backup.'],
      ['Instalar app', 'Quando o navegador permitir, o botão "Instalar app" abre o sistema em janela própria e funciona sem internet.'],
      ['Documentação', 'Detalhes técnicos de cada função em Sobre → Documentação.']
    ]
  }
]

const router = useRouter()
const atual = ref(0)
const passo = computed(() => PASSOS[atual.value])
const fechar = () => { tutorial.aberto = false }
const ir = (i) => { atual.value = Math.max(0, Math.min(PASSOS.length - 1, i)) }
const abrirPagina = () => {
  if (passo.value.acao === 'configuracoes') {
    fechar()
    window.dispatchEvent(new CustomEvent('abrir-configuracoes'))
    return
  }
  if (!passo.value.rota) return
  router.push(passo.value.rota)
  fechar()
}
</script>

<template>
  <UiModal v-if="tutorial.aberto" title="Tutorial" :subtitle="`Passo ${atual + 1} de ${PASSOS.length}`" width="max-w-4xl" @close="fechar">
    <div class="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
      <nav class="hidden md:block" aria-label="Tópicos do tutorial">
        <ol class="space-y-0.5">
          <li v-for="(p, i) in PASSOS" :key="p.titulo">
            <button
              type="button"
              class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors"
              :class="i === atual ? 'bg-blue-50 font-semibold text-blue-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'"
              :aria-current="i === atual ? 'step' : undefined"
              @click="ir(i)"
            >
              <span class="w-5 shrink-0 text-right text-xs tabular-nums" :class="i < atual ? 'text-blue-600' : 'text-slate-400'">{{ i + 1 }}</span>
              <span class="truncate">{{ p.titulo }}</span>
            </button>
          </li>
        </ol>
      </nav>

      <article class="min-w-0" aria-live="polite">
        <div class="flex items-start gap-3">
          <span class="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white"><i :class="[passo.icone, 'text-lg']" aria-hidden="true"></i></span>
          <div class="min-w-0">
            <h3 class="text-xl font-semibold leading-tight text-slate-900">{{ passo.titulo }}</h3>
            <p class="mt-1 max-w-[70ch] text-sm leading-relaxed text-slate-600">{{ passo.resumo }}</p>
          </div>
        </div>
        <dl class="mt-5 divide-y divide-slate-100 border-y border-slate-100">
          <div v-for="[t, d] in passo.itens" :key="t" class="grid gap-1 py-3 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-4">
            <dt class="text-sm font-semibold text-slate-900">{{ t }}</dt>
            <dd class="text-sm leading-relaxed text-slate-600">{{ d }}</dd>
          </div>
        </dl>
        <UiButton v-if="passo.rota || passo.acao" variant="secondary" size="sm" class="mt-4" @click="abrirPagina">
          <i :class="passo.icone" aria-hidden="true"></i>{{ passo.rotaTexto || 'Abrir esta página' }}
        </UiButton>
      </article>
    </div>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-3">
        <div class="flex gap-1" aria-hidden="true">
          <span v-for="(p, i) in PASSOS" :key="p.titulo" class="h-1.5 rounded-full transition-all" :class="i === atual ? 'w-5 bg-blue-700' : 'w-1.5 bg-slate-300'"></span>
        </div>
        <div class="flex gap-2">
          <UiButton variant="ghost" size="sm" :disabled="atual === 0" @click="ir(atual - 1)"><i class="fas fa-arrow-left" aria-hidden="true"></i>Anterior</UiButton>
          <UiButton v-if="atual < PASSOS.length - 1" size="sm" @click="ir(atual + 1)">Próximo<i class="fas fa-arrow-right" aria-hidden="true"></i></UiButton>
          <UiButton v-else size="sm" variant="success" @click="fechar"><i class="fas fa-check" aria-hidden="true"></i>Concluir</UiButton>
        </div>
      </div>
    </template>
  </UiModal>
</template>
