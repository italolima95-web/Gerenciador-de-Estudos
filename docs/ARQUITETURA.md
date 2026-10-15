# Arquitetura e decisões

## Execução local

A janela Electron usa `contextIsolation`, sandbox do renderer e `nodeIntegration: false`. O processo principal inicia uma API Express em `127.0.0.1`, numa porta livre. O frontend usa essa mesma origem. Navegação externa não substitui a aplicação; janelas externas são bloqueadas e links HTTP/HTTPS podem abrir no navegador padrão.

A API exige cabeçalho de cliente local, rejeita hosts e origens externas e não habilita CORS. O frontend compilado recebe uma política CSP restritiva. Nenhum serviço externo processa o conteúdo dos documentos. A política não transforma o modo de desenvolvimento em hospedagem pública autenticada.

## Camadas

1. `src`: apresentação e interação. Registros não são fictícios; o estado é relido do serviço após cada alteração.
2. `shared/domain.ts`: agregação hierárquica, denominadores, cobertura por folhas, união de intervalos, prontidão, hábitos, planejamento e recomendações.
3. `shared/analyzer.ts`: análise local por padrões de texto e sugestões de correspondência. Confiança é uma heurística, não uma probabilidade calibrada.
4. `server/app.ts`: validação Zod, limites de arquivos, vínculos e operações transacionais.
5. `server/db.ts`: SQLite via WASM, migração inicial idempotente, gravação atômica e auditoria.
6. `electron`: diretório persistente do sistema operacional e ciclo de vida desktop.

## Modelo relacional

`contests` guarda concurso, cargo selecionado, banca, metadados e metas. `documents` preserva cada original, tipo, texto por página, sumário e retomada. Edital, anexo e retificação são documentos distintos. `facts` relaciona cada valor extraído ao documento, página, trecho, seção, confiança, situação e valor anterior. `events` preserva as alterações.

`topics` usa `parent_id` para disciplina → assunto → subassunto, sempre no mesmo concurso. Cada tópico mantém proveniência própria. `mappings` associa intervalos de PDFs a tópicos e distingue sugestão de associação confirmada. `readings` mantém intervalos, posição, data, interrupção e observações.

`attempts` representa uma tentativa individual ou um agregado homogêneo de tentativas, com quantidades inteiras consistentes. `attempt_links` estabelece uma classificação principal por concurso; sua chave composta impede duplicação do vínculo. `mocks` agrupa tentativas e controla sua participação nos totais. Uma sessão distribuída salva todos os agregados na mesma transação.

`sessions` registra tempo de foco. `session_links` permite aproveitar o estudo em outro concurso sem criar outra sessão global. `blocks` e `cycles` preservam sequência, posição e voltas; `reviews` guarda agendamento, conclusão e dificuldade; `bookmarks` guarda páginas e notas. `preferences` persiste tema, intervalos, recomendações ignoradas e cronômetro.

Bancas e cargos são atributos do concurso nesta versão, não catálogos normalizados independentes. Há um cargo selecionado por preparação; para preparar dois cargos do mesmo edital, cadastre dois objetivos e importe ou reutilize os dados com correspondência validada.

## Integridade e falhas

- As chaves estrangeiras ficam habilitadas durante operações e após exportar SQLite: a exportação do sql.js reinicia a conexão interna, portanto o código reativa esse PRAGMA explicitamente.
- Uma transação usa uma imagem anterior para recuperar o banco em memória se a gravação no disco falhar após o commit.
- Exportações completas incluem PDFs originais. Restauração valida o banco e todos os arquivos antes da troca e cria uma cópia de segurança completa.
- Exclusões precisam de confirmação explícita. Dependências protegem entidades referenciadas; excluir um simulado confirmado remove suas tentativas e respectivos vínculos na mesma transação.
- O cronômetro usa deadline e revisão incremental. A finalização compara revisão, modo e deadline para impedir que duas janelas registrem a mesma sessão.
- A conclusão de um bloco compara o ID esperado para evitar avanço duplicado por uma interface desatualizada.

## Migrações

A migração `1` está declarada em `server/db.ts` e é registrada em `schema_migrations`. É aplicada ao abrir uma base nova e é idempotente para uma base já inicializada. Não altere silenciosamente o SQL inicial em bases já distribuídas: próximas evoluções devem adicionar uma nova migração sequencial, com backup prévio e teste de atualização. Backups de versão desconhecida são recusados nesta entrega.

## Premissas

O aplicativo é pessoal e local. SQLite WASM exporta a base inteira por gravação; bancos com milhões de registros ou PDFs com milhares de páginas exigem perfil de memória e possível migração para SQLite nativo. A análise documental prioriza rastreabilidade sobre inferência: rótulos e hierarquias não reconhecidos ficam para cadastro manual. Não há mecanismo de busca na internet por novas retificações.
