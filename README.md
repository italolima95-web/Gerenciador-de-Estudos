# Cronograma de Estudos

Aplicativo local de preparação para concursos: disciplinas → estudo e ciclo → edital opcional → comparação de conteúdo → revisões → desempenho. Interface em português, sem dados demonstrativos e sem serviços de IA externos.

**Tecnologias:** Electron, React, TypeScript, Vite, SQLite (sql.js), PDF.js, Tesseract.js e Recharts. Electron substitui a sugestão de Tauri para compartilhar o mesmo serviço local entre a aplicação desktop e o ambiente de desenvolvimento, sem exigir Rust ou módulos SQLite nativos.

## Download para Windows

As versões publicadas ficam em [GitHub Releases](https://github.com/italolima95-web/Gerenciador-de-Estudos/releases). Abra a versão e, em **Assets**, escolha `Cronograma-de-Estudos-Windows-x64.exe` (portátil) ou `cronograma-windows.zip`. Os downloads aparecem após o workflow de Windows concluir com sucesso.

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

1. Clique em **Cadastrar minhas disciplinas**. Selecione as matérias que você estuda no catálogo jurídico e/ou digite uma disciplina personalizada. Nenhum edital ou concurso é obrigatório.
2. Em **Disciplinas**, adicione assuntos e subassuntos, informando o que já estudou. Esses registros serão preservados ao analisar um edital.
3. Monte **Meu Ciclo** com as disciplinas e tópicos cadastrados. As atividades **Exercícios do Ciclo** e **SIMULADO** têm atalhos próprios. Registre sessões no bloco ou conclua os blocos que efetivamente estudou.
4. **Opcional:** em **Analisar Edital**, importe o edital, anexos ou retificações. Use OCR para digitalizações. Revise a extração e salve as sugestões; dados do concurso só mudam quando você confirma ou corrige cada informação.
5. Confira **Conteúdo programático × meus estudos**. O confronto e os **Pontos que precisam de atenção** usam apenas exigências do edital, com página e trecho. Nomes equivalentes de disciplinas são reconhecidos; tópicos diferentes podem ser associados manualmente. Uma disciplina geral estudada não conclui automaticamente todos os seus tópicos.
6. Em **Exercícios do Ciclo**, consulte disciplinas/tópicos realmente estudados na volta atual ou em uma anterior. Registre questões diretamente nos conteúdos indicados; blocos planejados, adiados, simulados e sessões de questões não são tratados como teoria estudada.
7. Importe apostilas na **Biblioteca de PDFs**, confirme correspondências, registre páginas, programe revisões e acompanhe desempenho e hábitos. **Meus Concursos** continua disponível para cadastrar um concurso com nome, cargo, data e metas.

Para atualizar a partir da versão 1.0, feche o aplicativo antigo e abra o executável novo no mesmo usuário do Windows. O programa usa o mesmo diretório de dados e migra o SQLite, guardando uma cópia anterior em `data/backups/`. Backups completos da versão 1.0 continuam aceitos. Registros antigos de tempo permanecem no histórico geral; a identificação da volta começa nos novos registros, pois a versão anterior não guardava essa informação.

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

A saída esperada do build nativo bem-sucedido é `release/Cronograma de Estudos Setup 1.1.0.exe`, instalador NSIS para Windows x64, com escolha de diretório. A configuração está em `package.json`. O workflow `.github/workflows/windows.yml` gera a versão portátil Windows usando um runner Linux, por acionamento manual, uma tag `v*` ou um ramo `release/windows-*`. Tags e ramos de release publicam o executável e o ZIP em GitHub Releases; o acionamento manual disponibiliza os arquivos como artefatos do workflow. O instalador NSIS deve ser gerado separadamente no Windows.

Para uma versão Windows portátil, sem instalação, use `npm run dist:win:portable`. A saída é `release/Cronograma de Estudos 1.1.0.exe`.

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
