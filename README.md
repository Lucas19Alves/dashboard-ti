# 📊 Dashboard Loja - Gestão de Auditoria e Vencimentos

O **Dashboard Loja** é uma solução web moderna e robusta desenvolvida para otimizar processos operacionais em lojas de varejo. Focado em **Auditorias de Estoque** e **Controle de Validades**, o projeto transforma planilhas brutas de ERP (como WinThor) em dashboards interativos e acionáveis.

![Vue.js](https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Dexie.js](https://img.shields.io/badge/Dexie.js-IndexedDB-blue?style=for-the-badge)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

---

## 🚀 Principais Funcionalidades

### 📅 Calendário Semanal de Auditorias
- Navegação horizontal entre semanas.
- Planejamento automático de tipos de auditoria (Etiqueta, Presença, Ruptura).
- Identificação visual de pendências e metas alcançadas por dia.

### 🔍 Auditoria Inteligente
- **Processamento de Planilhas**: Importação e tratamento automático de arquivos Excel/CSV.
- **Detecção de Ruptura**: Algoritmo que cruza dados de falta de presença com estoque positivo no sistema.
- **Análise Multidimensional**: Filtros por Setor, Local, Fornecedor e Usuário.

### 🍎 Controle de Vencimentos
- Monitoramento de prazos de validade com classificação por urgência (Vencidos, Hoje, 3 dias, Futuro).
- Visão por Setor para facilitar a conferência física.
- Suporte para impressão de listas de conferência.

### 💾 Persistência e Segurança
- **IndexedDB**: Armazenamento local de alta performance usando Dexie.js.
- **Privacidade**: Todos os dados permanecem no navegador do usuário.
- **Backup compacto e compatível**: Exportação Gzip, importação dos JSON antigos do Dashboard Loja e migração automática dos backups regionais baseados em sessões.
- **Modo offline**: Instalação como PWA e acesso ao painel mesmo sem conexão após o primeiro carregamento.
- **Fluxo operacional**: Registro de ação e responsável para itens de vencimento, mantendo histórico local.

---

## 🛠️ Tecnologias Utilizadas

- **Framework**: [Vue 3 (Composition API)](https://vuejs.org/)
- **Store**: [Pinia](https://pinia.vuejs.org/)
- **Roteamento**: [Vue Router 4](https://router.vuejs.org/)
- **Estilização**: [Tailwind CSS](https://tailwindcss.com/)
- **Banco de Dados**: [Dexie.js](https://dexie.org/)
- **Manipulação de Excel**: [SheetJS (XLSX)](https://sheetjs.com/)
- **Build Tool**: [Vite](https://vitejs.dev/)

---

## 📦 Como Instalar e Rodar

1. **Clone o repositório**
   ```bash
   git clone https://github.com/Lucas19Alves/dashboard-ti.git
   ```

2. **Instale as dependências**
   ```bash
   cd dashboard-ti
   npm install
   ```

3. **Inicie o servidor de desenvolvimento**
   ```bash
   npm run dev
   ```

4. **Acesse no navegador**
   ```
   http://localhost:5173
   ```

---

## 📖 Documentação Técnica

Para detalhes aprofundados sobre a arquitetura, algoritmos de detecção e manutenção do sistema, consulte a [Documentação Completa](./DOCUMENTATION.md).

---

## 👤 Desenvolvedor

**Lucas Alves**
- [GitHub](https://github.com/Lucas19Alves)
- [LinkedIn](https://www.linkedin.com/in/lucaas19alves/)
- [Portfólio](https://portfolio-lucasalves.vercel.app/)

---
*Desenvolvido para transformar dados em decisões operacionais eficientes.*
