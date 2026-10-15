# Arquitetura e decisões

## Execução local

A janela Electron usa `contextIsolation`, sandbox do renderer e `nodeIntegration: false`. O processo principal inicia uma API Express em `127.0.0.1`, numa porta livre. O frontend usa essa mesma origem. Navegação externa não substitui a aplicação; janelas externas são bloqueadas e links HTTP/HTTPS podem abrir no navegador padrão.

A API exige cabeçalho de cliente local, rejeita hosts e origens externas e não habilita CORS. O frontend compilado recebe uma política CSP restritiva. Nenhum serviço externo processa o conteúdo dos documentos. A política não transforma o modo de desenvolvimento em hospedagem pública autenticada.

## Camadas

1. `src`: apresentação e interação. Registros não são fictícios; o estado é relido do serviço após cada alteração.
2. `shared/domain.ts`: agregação hierárquica, denominadores, cobertura por folhas, união de intervalos, prontidão, hábitos, planejamento e recomendações.
3. `shared/analyzer.ts`: análise local por padrões de texto e sugestões de correspondência. Confiança é uma heurística, não uma probabilidade calibrada.
4. `server/app.ts`: validação Zod, limites de arquivos, vínculos e operações transacionais.
5. `server/db.ts`: SQLite via WASM, migrações sequenciais e cópia antes da atualização, gravação atômica e auditoria.
6. `electron`: diretório persistente do sistema operacional e ciclo de vida desktop.

## Modelo relacional

`contests` guarda o contexto de estudo: plano manual (`kind=plan`) ou concurso (`kind=contest`), cargo, banca, metadados e metas. Um plano manual é criado na primeira seleção de disciplinas, sem preencher dados fictícios de concurso. `documents` preserva cada original, tipo, texto por página, sumário e retomada. Edital, anexo e retificação são documentos distintos. `facts` relaciona cada valor extraído ao documento, página, trecho, seção, confiança, situação e valor anterior. `events` preserva as alterações.

`topics` usa `parent_id` para disciplina → assunto → subassunto, sempre no mesmo concurso. Cada tópico mantém proveniência própria. `syllabus_items` preserva separadamente as exigências selecionadas do edital, sua hierarquia, texto original, página e correspondência com um tópico. Assim, um tópico manual reaproveitado mantém seu ID e seu histórico. Reanalisar o mesmo documento desativa as exigências anteriores desse documento e salva a nova seleção; não exclui os tópicos ou os estudos. Aliases de disciplinas são explícitos em `shared/catalog.ts`; tópicos só são reaproveitados automaticamente por título normalizado e mesmo ramo. Associações diferentes exigem escolha do usuário. `mappings` associa intervalos de PDFs a tópicos e distingue sugestão de associação confirmada. `readings` mantém intervalos, posição, data, interrupção e observações.

`attempts` representa uma tentativa individual ou um agregado homogêneo de tentativas, com quantidades inteiras consistentes. `attempt_links` estabelece uma classificação principal por concurso; sua chave composta impede duplicação do vínculo. `mocks` agrupa tentativas e controla sua participação nos totais. Uma sessão distribuída salva todos os agregados na mesma transação.

`sessions` registra tempo de foco, bloco, volta e atividade original quando iniciado pelo ciclo. `cycle_completions` mantém a conclusão e o caminho do conteúdo por volta, sem acrescentar minutos. `shared/comparison.ts` usa essas evidências para sugerir questões apenas sobre o que foi estudado naquela volta; registros antigos sem volta não recebem classificação retroativa. `session_links` permite aproveitar o estudo em outro concurso sem criar outra sessão global. `blocks` e `cycles` preservam sequência, posição e voltas; `reviews` guarda agendamento, conclusão e dificuldade; `bookmarks` guarda páginas e notas. `preferences` persiste tema, intervalos, recomendações ignoradas e cronômetro.

Bancas e cargos são atributos do concurso nesta versão, não catálogos normalizados independentes. Há um cargo selecionado por preparação; para preparar dois cargos do mesmo edital, cadastre dois objetivos e importe ou reutilize os dados com correspondência validada.

## Integridade e falhas

- As chaves estrangeiras ficam habilitadas durante operações e após exportar SQLite: a exportação do sql.js reinicia a conexão interna, portanto o código reativa esse PRAGMA explicitamente.
- Uma transação usa uma imagem anterior para recuperar o banco em memória se a gravação no disco falhar após o commit.
- Exportações completas incluem PDFs originais. Restauração valida o banco e todos os arquivos antes da troca e cria uma cópia de segurança completa.
- Exclusões precisam de confirmação explícita. Dependências protegem entidades referenciadas; excluir um simulado confirmado remove suas tentativas e respectivos vínculos na mesma transação.
- O cronômetro usa deadline e revisão incremental. A finalização compara revisão, modo e deadline para impedir que duas janelas registrem a mesma sessão.
- A conclusão de um bloco compara o ID esperado para evitar avanço duplicado por uma interface desatualizada.

## Migrações

As migrações `1` e `2` estão declaradas em `server/db.ts` e são registradas em `schema_migrations`. A migração 2 adiciona planos, exigências independentes do edital e histórico por volta, com cópia do SQLite anterior. Restaurações de bancos versão 1 migram antes de substituir os dados ativos. A criação e a atualização são idempotentes para bases já inicializadas. Não altere silenciosamente o SQL inicial em bases já distribuídas: próximas evoluções devem adicionar uma nova migração sequencial, com backup prévio e teste de atualização. Backups de versão desconhecida são recusados nesta entrega.

## Premissas

O aplicativo é pessoal e local. SQLite WASM exporta a base inteira por gravação; bancos com milhões de registros ou PDFs com milhares de páginas exigem perfil de memória e possível migração para SQLite nativo. A análise documental prioriza rastreabilidade sobre inferência: rótulos e hierarquias não reconhecidos ficam para cadastro manual. Não há mecanismo de busca na internet por novas retificações.

## Comparação com o edital

Os pontos de atenção usam somente folhas ativas de `syllabus_items`, confrontadas com a cobertura dos tópicos correspondentes. Disciplinas extras, metadados, datas, desempenho em questões e revisões não entram nessa lista. Tempo registrado indica estudo parcial, sem concluir automaticamente o conteúdo. A comparação e os indicadores de cobertura do edital não usam os tópicos manuais extras como denominador.
