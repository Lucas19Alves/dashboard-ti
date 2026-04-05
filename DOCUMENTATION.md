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
- **Processamento de Planilhas**: [SheetJS (XLSX)](https://sheetjs.com/)
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

---

## � 5. Guia de Uso

### 5.1 Realizando uma Auditoria
1. Acesse a aba **Auditorias**.
2. No **Calendário**, selecione o dia desejado (ou use as setas para navegar entre semanas).
3. Clique no botão **Criar** do tipo desejado (ou arraste o arquivo Excel).
4. Informe o **SKU Total** (quantidade de itens que deveriam ser auditados).
5. O sistema processará o arquivo e abrirá a tela de **Detalhes**.
6. Utilize os filtros de **Setor**, **Local** ou **Usuário** para analisar gargalos na operação.

### 5.2 Gerindo Vencimentos
1. Acesse a aba **Vencimentos**.
2. Importe a planilha de validade do sistema.
3. O Dashboard classificará automaticamente os produtos por urgência.
4. Utilize a visão por **Setor** para imprimir listas de conferência para os repositores.

---

## 🔧 6. Manutenção e Expansão

### Backup e Segurança
- O sistema oferece funcionalidades de **Exportar Backup** e **Importar Backup** (em `utils/backup.js`). Isso gera um arquivo JSON contendo todo o banco de dados local. É recomendado fazer backup antes de limpezas de cache do navegador.

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
*Documentação ampliada e atualizada em 05/04/2026.*
