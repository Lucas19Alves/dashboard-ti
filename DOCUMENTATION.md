# Documentação Técnica - Dashboard TI

Este documento fornece uma visão detalhada da arquitetura, tecnologias e funcionalidades do projeto **Dashboard TI**, um painel de controle desenvolvido para otimizar operações de varejo, com foco em auditorias de estoque e controle de validades.

---

## 🚀 1. Visão Geral

O Dashboard TI é uma aplicação web (SPA) moderna que permite aos gestores de loja:
1. **Realizar Auditorias**: Processar planilhas de inventário para identificar rupturas, problemas de etiquetas e presença de produtos.
2. **Controlar Vencimentos**: Monitorar datas de validade de produtos para reduzir perdas.
3. **Análise de Dados**: Visualizar métricas de desempenho de auditorias por setor, usuário e fornecedor.
4. **Persistência Local**: Todos os dados são armazenados no navegador do usuário (IndexedDB), garantindo privacidade e funcionamento offline.

---

## 🛠️ 2. Stack Tecnológica

- **Frontend**: [Vue.js 3](https://vuejs.org/) (Composition API)
- **Gerenciamento de Estado**: [Pinia](https://pinia.vuejs.org/)
- **Roteamento**: [Vue Router 4](https://router.vuejs.org/)
- **Estilização**: [Tailwind CSS](https://tailwindcss.com/)
- **Banco de Dados Local**: [Dexie.js](https://dexie.org/) (Wrapper para IndexedDB)
- **Processamento de Planilhas**: [read-excel-file](https://gitlab.com/catamphetamine/read-excel-file) em Web Worker
- **Imagens de relatório**: [html-to-image](https://github.com/bubkoo/html-to-image)
- **Ícones**: [Font Awesome](https://fontawesome.com/)

---

## 📂 3. Estrutura do Projeto

### Arquitetura de Pastas
```text
src/
├── components/     # Componentes Vue reutilizáveis (Navbar, Modais, Tabelas)
├── db/             # Configuração do Dexie.js (Esquema do IndexedDB)
├── pages/          # Componentes de página (Início, Auditorias, Vencimentos)
├── router/         # Configuração das rotas da aplicação
├── stores/         # Estados globais (Pinia) para Auditorias e Vencimentos
├── utils/          # Funções auxiliares (Backup, Impressão, Formatação)
├── App.vue         # Componente raiz
└── main.js         # Ponto de entrada da aplicação
```

---

## 🧠 4. Lógica de Negócio e Módulos

### 4.1 Sistema de Auditorias (`auditoriasStore.js`)
O sistema possui uma inteligência de processamento de planilhas Excel (comumente extraídas do ERP WinThor).

#### Algoritmos de Detecção e Processamento:
- **Detecção Automática de Tipo**: O sistema analisa as primeiras 100 linhas da planilha. Se encontrar termos como "atualizado/desatualizado", classifica como **Etiqueta**. Se encontrar "com/sem presença" em massa, classifica como **Presença**. Se detectar "sem presença + com estoque", prioriza **Ruptura**.
- **Correção de Cabeçalho Agrupado**: Possui um algoritmo robusto para identificar a linha correta do cabeçalho caso a planilha venha com linhas de título ou agrupamentos no topo.
- **Ruptura como continuação da Presença** (`utils/rupturaPresenca.js`): a planilha de ruptura traz só os itens que ficaram pendentes e vem sem local. O % por setor parte do resultado final da Presença anterior (mesma semana) e desconta a evolução: pendentes lidos ou fora da lista deixam de ser pendentes; itens que voltaram a faltar ou novos entram como pendentes. O local de cada item vem da Presença. O % geral (sobre o SKU) não muda. Rupturas antigas são recalculadas ao abrir o sistema e quando a Presença base é importada ou atualizada.
- **Deduplicação Inteligente**: Ao importar dados de Ruptura, o sistema prioriza itens auditados no dia atual da auditoria, evitando duplicatas de contagens anteriores.

#### Classificação de Itens:
- **Lido Corretamente**: Item com presença confirmada.
- **Pendente**: Item sem presença, mas que possui estoque no sistema.
- **Com Problema**: Itens "Lidos sem estoque" ou "Lido não pertence" (fora do local correto).

### 4.2 Controle de Vencimentos (`vencimentosStore.js`)
Gerencia o ciclo de vida dos produtos na prateleira com base na data de validade.

- **Cálculo de Prazos**:
  - `Vencidos`: Data de validade < hoje.
  - `Hoje`: Vence no dia atual.
  - `Até 3 dias`: Alerta crítico de vencimento próximo.
  - `Futuro`: Vencimento controlado.
- **Extração de Quantidade**: Algoritmo especializado em limpar strings complexas de estoque (ex: "### 09:51:41 25,502 KG") para obter o valor numérico puro.

### 4.3 Persistência de Dados (`appDb.js`)
Utiliza o **IndexedDB** via Dexie para armazenar grandes volumes de dados.
- **Esquema**:
  - `auditorias`: Armazena o histórico completo de auditorias, incluindo os dados brutos processados e as análises calculadas.
  - `vencimentos`: Armazena a última lista de vencimentos importada.
- **Sincronização de Status**: O status de "fechada/aberta" das auditorias é sincronizado entre o IndexedDB e o LocalStorage para garantir consistência rápida na UI.

### 4.4 Painel inicial, busca rápida e saúde dos dados
- **Agenda da semana**: mostra os tipos planejados para cada dia (Seg–Qui) e o estado de cada auditoria (na meta, fora da meta, em andamento, não criada). Clicar abre a auditoria ou o formulário já preenchido (`/auditorias?data=AAAA-MM-DD&tipo=Etiqueta`).
- **Evolução do % pendente**: série das últimas 10 auditorias por tipo, com a meta de 3% como referência (`utils/metricasAuditoria.js`).
- **Busca rápida** (`Ctrl/⌘ + K` ou `/`): páginas, ações (nova auditoria do dia, exportar backup), auditorias por tipo/data/ID e produtos com validade.
- **Vencimentos filtráveis por URL**: `/vencimentos?prazo=vencidos`, `?setor=...`, `?busca=...`; a aba Explorar exporta a lista filtrada em CSV.
- **Saúde dos dados**: lembrete quando não há backup há 7 dias ou mais, uso do armazenamento do navegador e opção de proteger o IndexedDB contra limpeza automática (`navigator.storage.persist`).

### 4.5 Desempenho
- `dados` e `analise` das auditorias são guardados com `markRaw` (sem proxies reativos profundos), pois sempre são substituídos por inteiro.
- Deduplicação por código em O(n) (`utils/deduplicar.js`) e agrupamento por local/setor em passada única na tela de detalhes.
- Bibliotecas em chunks separados (`vendor-vue`, `vendor-db`) e `console.log` removido do build de produção.

### 4.6 Análise de auditorias (`pages/AnaliseAuditorias.vue`, `utils/analiseHistorica.js`)
- **Filtros lembrados** neste navegador: período rápido (30 dias a 12 meses, tudo) ou datas, tipo, status e meta. Datas comparadas como texto ISO (sem erro de fuso).
- **Indicadores com comparação** ao período anterior de mesma duração (auditorias, taxa na meta, % pendente médio, itens auditados). Todos derivados do SKU atual.
- **Destaques automáticos**: tendência mensal, variação vs período anterior, melhor mês, tipo com menor taxa na meta e setor reincidente.
- **Gráfico mensal** do % pendente com linha da meta; clicar em um mês filtra e abre a lista daquele mês. Alternativa em tabela.
- **Setores**: consolidado do período, quantas vezes cada setor passou da meta (reincidência), último valor, tendência e mini gráfico das últimas 12 auditorias.
- **Usuários**: ranking por leituras, média por auditoria, % de leituras com problema e última participação.
- **Mapa da loja**: o mesmo mapa do detalhe da auditoria, somando todas as auditorias filtradas (% pendente acumulado, leituras e usuários por área). Rupturas só entram com o filtro de tipo Ruptura, pois repetem os pendentes da presença.
- **Auditorias**: busca, paginação, CSV e **comparação de duas auditorias** (variação geral e por setor).
- **Relatório PDF** em folhas A4 numeradas ("Página X de Y"): 1 resumo do período (indicadores, conclusões, gráfico mensal, tabela por tipo e comparação com o período anterior), 2 setores (reincidentes, % pendente, tendência e evolução), 3 usuários (matrícula, nome, leituras, % problema) e 4 auditorias do período com resumo por mês. Tabelas longas continuam na folha seguinte repetindo o cabeçalho.
- **Detalhe da auditoria**: card "Caminho até a meta" (quantos itens faltam ler ou a folga) e comparação com a auditoria anterior do mesmo tipo (setores que melhoraram/pioraram).

### 4.7 Interface, listas e relatórios
- **Layout**: largura máxima única (`.ui-container` / `.ui-page`, até 1760px) para aproveitar telas grandes; navbar em cor sólida.
- **Auditorias**: cards de auditorias em andamento sem bordas, com anel de conclusão e "faltam X itens para a meta"; histórico por tipo agrupado por mês, com resumo do tipo, filtro por situação e "mostrar mais".
- **Aba Usuários** (`components/AbaUsuariosAuditoria.vue`): pódio, leituras do time por hora, cartões/tabela/mapa de horas por usuário (ritmo, pico, período ativo, problemas) e "quem leu cada setor" com alerta de dependência de uma só pessoa. Exporta CSV.
- **Modais de lista** (`components/ui/UiListaItens.vue`): busca, filtros com contagem, agrupamento, ordenação, carregamento incremental, CSV, impressão e cópia do código. Usado em métricas, itens do local, usuário e vencimentos.
- **Relatório da auditoria** (`components/RelatorioAuditoria.vue`): % pendente em destaque, cards (SKU, lidos, pendentes, com problema e desatualizados na Etiqueta), tabela de % pendente por setor, top 10 locais e locais sem leitura; imprime/salva PDF e salva uma imagem quadrada em alta resolução para compartilhar.
- **PDFs visuais** (`utils/print.js`): cabeçalho, indicadores, barras, colunas e tabelas com mini barras em todos os relatórios impressos.
- **Documentação in-app** (`/documentacao`, `utils/markdown.js`): este documento dentro do sistema, com sumário fixo, busca e links para cada seção (`/documentacao#backup-e-seguranca`). Aberta pelo botão Documentação em "Sobre" ou pela busca rápida.

### 4.8 Detalhe da auditoria: navegação e mapa da loja
- **Navegação**: barra de abas fixa (Visão geral, Mapa da loja, Usuários, Dados e Estatísticas; a aba Atenção só aparece pelo endereço `?aba=atencao`), com contadores, setas do teclado e resumo compacto (% pendente) ao rolar. A aba fica na URL (`?aba=mapa`).
- **Mapa da loja** (`components/MapaLoja.vue`, `utils/mapaLoja.js`): monta a planta a partir dos locais da auditoria.
  - `G05A` = corredor 05, face A. O número é o corredor; cada corredor tem 4 faces de gôndola (A de frente para B, C de frente para D; C/D no fundo e A/B na frente). Corredores numerados da direita para a esquerda e encostados (vizinhos dividem a mesma gôndola).
  - `PL01` paredão de líquida (extrema direita), `F01..` freezers (esquerda), `PF01` paredão de frios, `EMP01` empório de frios, `ACG` açougue, `FLV`.
  - **Planta padrão**: à esquerda, paredões de frios (PF01 no topo, PF02–PF04 na lateral), açougue, IF01/I02, freezers F03–F01, empório, FLV, PAO, IF02/I01/SORV e GELO; no centro, os corredores da direita para a esquerda com PA01 acima e CS01 abaixo; PL01 na extrema direita. Outras áreas conhecidas vão para o primeiro espaço livre.
  - Locais fora do padrão sem lugar na planta ficam numa lista abaixo do mapa; no modo edição, clicar em um deles o adiciona ao mapa e "Remover do mapa" o tira de volta.
  - Cores por % pendente, por leituras ou pelas leituras de um usuário; clique mostra faces, quem leu e os itens.
  - **Editar layout**: arrastar, redimensionar, girar e renomear áreas; aumentar ou diminuir o mapa em cada borda (esquerda, direita, topo, base), sendo que aumentar à esquerda/topo empurra as áreas e diminuir só remove espaço vazio; o layout fica salvo neste navegador, vale para todas as auditorias e vai junto no backup (`configuracoes.mapaLoja`).

### 4.9 Itens não vinculados (`pages/NaoVinculados.vue`, `utils/naoVinculados.js`)
Itens que chegam na loja sem local no sistema ficam fora da auditoria. A aba **Não vinculados** recebe a planilha do dia (Código, Nome, Estoque, Dias sem venda, Classe de Produto, Classe de Produto Raiz, Fornecedor) e cruza com o histórico das auditorias.
- **Sugestão de local**, da evidência mais forte para a mais fraca: local onde o item foi *lido não pertence* (está fisicamente lá), último local em que esteve vinculado, local mais comum dos itens da mesma classe de produto. Sem nada disso: "procurar na loja".
- **Prioridade**: vende toda semana (≤ 7 dias sem venda) > com estoque > sem estoque.
- **Tratamento**: confirmar o local e marcar "Vinculei" ou "Ignorar". A cada importação, quem continua na lista mantém o tratamento e quem saiu vai para **Resolvidos** (vinculado no sistema). Fica salvo no IndexedDB (`naoVinculados`) e vai no backup.
- **Por local sugerido**: lista para o repositor conferir local a local.
- **Vínculos suspeitos**: itens com local que as auditorias indicam estar errado (lido em outro local em 2+ auditorias, ou setor que quase não aparece no local onde está vinculado).
- **Salvar imagem** quadrada para o WhatsApp, CSV da lista filtrada e **Recalcular** as sugestões depois de importar novas auditorias.

---

## 📖 5. Guia de Uso

### 5.1 Realizando uma Auditoria
1. Acesse a aba **Auditorias**.
2. No **Calendário**, selecione o dia desejado (ou use as setas para navegar entre semanas).
3. Clique no botão **Criar** do tipo desejado (ou arraste o arquivo Excel).
4. Informe o **SKU Total** (quantidade de itens que deveriam ser auditados).
5. O sistema processará o arquivo e abrirá a tela de **Detalhes**.
6. Utilize os filtros de **Setor**, **Local** ou **Usuário** para analisar gargalos na operação.

### 5.2 Tratando itens não vinculados
1. Exporte do sistema a planilha de itens sem local e importe na aba **Não vinculados**.
2. Confira o local sugerido de cada item (ou procure na loja os "sem pista") e vincule no sistema.
3. Marque "Vinculei". Na importação do dia seguinte, os itens que sumiram da planilha vão para Resolvidos.

### 5.3 Gerindo Vencimentos
1. Acesse a aba **Vencimentos**.
2. Importe a planilha de validade do sistema.
3. O Dashboard classificará automaticamente os produtos por urgência.
4. Utilize a visão por **Setor** para imprimir listas de conferência para os repositores.

---

## 🔧 6. Manutenção e Expansão

### Backup e Segurança
- O sistema oferece funcionalidades de **Exportar Backup** e **Importar Backup** (em `utils/backup.js`). A exportação gera um arquivo `.json.gz`, reduzindo o tamanho sem remover informações. A importação aceita o formato compactado, backups `.json` antigos do Dashboard TI e backups regionais com `sessions`, que são migrados automaticamente para auditorias agregadas por loja. Todo conteúdo é validado antes de substituir o banco local. É recomendado fazer backup antes de limpezas de cache do navegador.

### Adicionando Novas Regras
- **Novas Colunas Excel**: Se o layout da planilha do ERP mudar, atualize os arrays `colunasPresenca` ou `colunasEtiqueta` no `auditoriasStore.js`.
- **Novas Métricas**: As métricas de desempenho são calculadas na função `analisarDadosPresenca`. Novas fórmulas devem ser inseridas ali para refletir em todos os tipos de auditoria.

---

## 👤 7. Desenvolvedor
**Lucas Alves**
- GitHub: [Lucas19Alves](https://github.com/Lucas19Alves)
- LinkedIn: [lucaas19alves](https://www.linkedin.com/in/lucaas19alves/)
- Portfólio: [Portfolio Lucas Alves](https://portfolio-lucasalves.vercel.app/)

---
*Documentação ampliada e atualizada em 10/10/2026.*
