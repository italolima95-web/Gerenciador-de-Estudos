# Cronograma de Estudos

Aplicativo local de preparação para concursos: edital → conteúdos → materiais → estudo → revisões → desempenho. Interface em português, sem dados demonstrativos e sem serviços de IA externos.

**Tecnologias:** Electron, React, TypeScript, Vite, SQLite (sql.js), PDF.js, Tesseract.js e Recharts. Electron substitui a sugestão de Tauri para compartilhar o mesmo serviço local entre a aplicação desktop e o ambiente de desenvolvimento, sem exigir Rust ou módulos SQLite nativos.

## Download para Windows

As versões publicadas ficam em [GitHub Releases](https://github.com/italolima95-web/Gerenciador-de-Estudos/releases). Abra a versão e, em **Assets**, escolha `Cronograma-de-Estudos-Windows-x64.exe` (portátil), `Cronograma-de-Estudos-Instalador-x64.exe` (instalador) ou `cronograma-windows.zip`. Os downloads aparecem após o workflow de Windows concluir com sucesso.

## Iniciar

Requisito para desenvolver: **Node.js 24 LTS** e npm. O instalador desktop inclui o runtime; o usuário final não precisa instalar Node.js.

```bash
npm ci
npm run desktop
```

O script pós-instalação prepara dependências, o runtime Electron, o modelo OCR em português e os recursos do PDF.js. Eles são incluídos no pacote: depois de instalado, o aplicativo funciona offline.

Para desenvolver com recarga automática:

```bash
npm run dev
```

A interface usa a porta `5173`; o serviço local usa `127.0.0.1:4318`. Para executar o build sem a janela desktop:

```bash
npm run build
npm start
```

Nesse modo, a interface é servida na porta `4318`. O serviço escuta apenas na interface de loopback. Não publique esse serviço como uma aplicação multiusuário.

## Primeiro uso

1. Em **Meus Concursos**, cadastre concurso, cargo, banca, data e metas. Os campos desconhecidos podem permanecer vazios.
2. Em **Analisar Edital**, importe o edital, anexos ou retificações. Habilite OCR para documentos digitalizados. Analise e selecione o cargo quando reconhecido.
3. Salve as sugestões e confira as informações no documento original. Datas e demais dados só atualizam o concurso após confirmação ou correção explícita.
4. Em **Disciplinas**, confira os tópicos extraídos, corrija os títulos ou cadastre conteúdos manualmente. Cada nível tem seu próprio identificador.
5. Importe apostilas na **Biblioteca de PDFs**. Sugira correspondências e confirme os intervalos corretos em **Disciplinas**. Similaridade textual nunca confirma uma associação.
6. Monte **Meu Ciclo**, use o **Pomodoro** e registre os intervalos de leitura. Visualizar uma página não a conclui.
7. Registre questões, sessões distribuídas e simulados; programe revisões. Acompanhe a prontidão, os hábitos e as recomendações calculadas a partir desses registros.
8. Exporte regularmente um **backup completo** em Configurações.

## Regras dos indicadores

- **Acertos:** `acertos / (acertos + erros) × 100`. Sem respostas: **Sem dados**. Brancos são separados; o aproveitamento sobre todas as questões e a pontuação líquida também são exibidos.
- **Hierarquia:** os totais somam tentativas reais, uma vez por ID, sem médias simples de percentuais. Registros ligados apenas à disciplina não inventam resultados para seus assuntos.
- **Reutilização:** uma tentativa pode ter um vínculo principal por concurso. Etiquetas são secundárias. Reutilizar uma sessão de estudo não duplica o tempo global.
- **Cobertura:** usa somente os tópicos finais, com seus pesos. Pais e filhos não são contados juntos. Tópicos parciais são apresentados separadamente e não contam como concluídos.
- **Páginas:** intervalos concluídos são unidos por documento. Leitura interrompida guarda a posição; não conclui o intervalo. Correspondências não confirmadas não alteram a cobertura.
- **Revisões:** realizadas / planejadas, com pendentes e vencidas separados. O período usa a data prevista da revisão.
- **Prontidão:** cobertura, revisões e taxa de acertos permanecem independentes; não são probabilidade de aprovação.
- **Prioridades:** regras transparentes consideram cobertura, pesos, revisões, meta, amostra mínima e proximidade da prova. Não alteram o ciclo sem ação do usuário.
- **Tempo:** o Pomodoro registra somente foco. Concluir um bloco do ciclo não soma o tempo novamente. Revisões e questões guardam sua duração própria; use o Pomodoro ou o registro manual para contabilizá-las como tempo de foco, sem duplicar sessões.

## Persistência e backup

A base é um arquivo SQLite real, com tabelas relacionais, chaves estrangeiras e migrações versionadas em `server/db.ts`. O banco não depende de `localStorage`. Alterações são transacionais e gravadas por substituição atômica do arquivo; falha de gravação recupera também o estado anterior em memória.

No desktop, os dados ficam em `app.getPath('userData')/data`:

- Windows: normalmente `%APPDATA%/Cronograma de Estudos/data` (o nome da pasta segue a identificação do aplicativo).
- Linux: diretório de configuração do usuário / aplicativo.
- macOS: `~/Library/Application Support/` / aplicativo.

Em desenvolvimento ou com `npm start`, o padrão é `.data/` no diretório de execução. Para outro diretório, defina `STUDIES_DATA_DIR` antes de iniciar; para outra porta do serviço, defina `PORT`.

```text
.data/
  studies.sqlite       banco de dados
  files/               PDFs originais
  backups/             cópias diárias do banco e backups antes de restaurar
```

O ZIP exportado contém banco, PDFs e manifesto de versão. A restauração valida integridade, chaves estrangeiras, caminhos e presença dos PDFs e exige confirmação. Antes de substituir os dados, cria um ZIP completo do estado anterior. Cópias automáticas do banco mantêm até sete dias em que o serviço foi iniciado; elas não substituem a exportação completa para outro dispositivo.

Limites atuais: um PDF ou ZIP enviado à restauração pode ter até 200 MB; o backup descompactado deve ter até 1 GB. O texto extraído por importação tem limite de 32 MB. Bases maiores exigem ampliar esses limites e validar o consumo de memória. Não armazene o banco aberto em uma pasta sincronizada nem abra dois serviços sobre o mesmo diretório. O desktop bloqueia instâncias duplicadas.

## Testar

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:desktop
npm run format:check
```

Os testes de unidade e integração cobrem os 12 cenários obrigatórios do prompt, incluindo estatísticas ponderadas, brancos, hierarquia, reutilização, leitura parcial, retificação, persistência e origem documental. Também cobrem integridade referencial, validações, sessões distribuídas atômicas, ciclo, revisões, simulados, Pomodoro e recuperação após falha de gravação.

Os testes de navegador percorrem o fluxo real com PDF de duas páginas e OCR de um PDF digitalizado sem acesso a serviços externos. Usam um diretório temporário isolado e não inserem dados de exemplo na base do usuário.

Se o Chromium já estiver instalado no sistema:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

## Gerar aplicativo e instalador

No **Windows**, com Node.js 24 e o projeto clonado:

```powershell
npm ci
npm test
npm run dist:win
```

A saída esperada do build nativo bem-sucedido é `release/Cronograma de Estudos Setup 1.0.0.exe`, instalador NSIS para Windows x64, com escolha de diretório. A configuração está em `package.json`. O workflow `.github/workflows/windows.yml` também pode gerar o artefato em um runner Windows, por acionamento manual ou uma tag `v*`. Uma tag `v*` dispara o build, os testes e a publicação dos arquivos no GitHub Releases. O acionamento manual disponibiliza os arquivos como artefatos do workflow.

Para uma versão Windows portátil, sem instalação, use `npm run dist:win:portable`. A saída é `release/Cronograma de Estudos 1.0.0.exe`.

Para gerar o instalador Windows a partir de Linux com electron-builder 26.15, use o toolset Wine suportado, com verificação de checksum:

```bash
npx electron-builder --win nsis --x64 -c.toolsets.wine=1.0.1
```

Execute `npm run build` antes. O toolset Wine 1.0.1 disponível neste ambiente estava incompleto, sem DLLs essenciais; essa tentativa não concluiu o NSIS. Prefira o build em Windows para esse instalador. Em ambientes com diretório pessoal somente leitura, configure `ELECTRON_BUILDER_CACHE` e `-c.electronDownload.cache` para diretórios graváveis. Use o proxy HTTPS fornecido pelo ambiente quando necessário; não desative TLS ou verificações de artefatos.

```bash
npm run dist:linux  # diretório executável Linux
npm run dist:mac    # DMG; gerar e validar em macOS
```

Assinatura digital Windows e notarização macOS exigem certificados próprios e não estão configuradas. O pacote deve passar por validação nativa em cada plataforma antes de distribuição pública.

## Estrutura

```text
electron/             janela desktop, instância única e serviço local
server/               API local, armazenamento, arquivos e migração SQLite
shared/               tipos, análise documental e cálculos de domínio
src/components/       telas e componentes da interface
src/lib/              acesso à API e processamento de PDFs/OCR
scripts/              preparação dos recursos locais
build/                ícones do aplicativo
tests/                testes de domínio, API e armazenamento
e2e/                  testes de navegador com PDFs reais
.github/workflows/    verificações e empacotamento Windows
docs/                 relatório da entrega e arquitetura
```

Consulte [o relatório de funcionalidades e limitações](docs/ENTREGA.md) e [a arquitetura](docs/ARQUITETURA.md). A análise automática de documentos usa heurísticas e revisão humana; não há promessa de reconhecimento universal de editais ou tabelas.
