# Relatório da entrega

Esta é uma aplicação operacional, sem registros de exemplo na base do usuário. Os recursos abaixo têm persistência real. O escopo amplo do prompt também inclui itens que permanecem parciais ou pendentes; eles são explicitados para não confundir entrega funcional com implementação integral de todas as possibilidades.

## Implementado

| Área | Comportamento operacional |
| --- | --- |
| Base e interface | React/TypeScript, Electron, tema claro/escuro, 14 seções, layout adaptável, estados vazios e mensagens de erro. |
| Banco | SQLite em disco, migração inicial versionada, relacionamentos, validação, chaves estrangeiras, transações e auditoria. |
| Concursos | Múltiplos objetivos, principal, cargo, banca, data, metadados complementares, meta de acertos e amostra mínima. |
| Editais | Importação de abertura, anexos, cronogramas e retificações; texto por página; extração local conservadora de campos rotulados e estrutura reconhecível. |
| Conferência | Página, documento, seção, trecho e confiança preservados. Botões abrem o original na página de origem. Confirmar/corrigir/rejeitar fatos; tópicos editáveis e confirmação manual. |
| Retificações | Valores são sugeridos com o anterior e só aplicados após confirmação. Documentos e fatos antigos são mantidos; novos conteúdos não apagam estudos anteriores. |
| Conteúdo | Disciplina → assunto → subassunto com IDs próprios. Estados independentes de teoria e revisão; questões e acertos derivados de tentativas reais. |
| PDF | Importação local, total de páginas, texto, leitura no canvas, navegação, zoom, pesquisa, marcadores e anotações. Lista de sumário quando embutido no arquivo. |
| OCR | Modelo português incluído no pacote. OCR opcional nas páginas sem texto na importação e em uma página aberta no leitor. Validado com PDF digitalizado e requisições externas bloqueadas. |
| Leitura | Totais de páginas e percentuais por PDF, por disciplina e globais, independentes da cobertura. Registro de intervalos, data, tópico, observações, conclusão/interrupção e página de retomada. União de sobreposições; visualização não conclui páginas. |
| Correspondências | Sugestões textuais não confirmadas e associação manual de intervalos. Confirmação necessária para aproveitar histórico anterior de leitura. |
| Cobertura | Global e por ramo, pesos de tópicos finais, concluídos, parciais, pendentes, sem material validado e correspondências não verificadas. |
| Questões | Tentativa individual ou agregado, sessões distribuídas transacionais, edição/exclusão, banca, origem, data, modalidade, tempo, etiquetas e classificação principal. |
| Estatísticas | Totais e taxas em concurso/disciplina/assunto/subassunto; sem médias simples e sem duplicar tentativas. Brancos, aproveitamento e pontuação líquida separados. |
| Filtros e histórico | Período, banca, origem, modalidade e ramo da hierarquia. Curva diária e tabelas com tamanho de amostra. |
| Reutilização | Mesma tentativa ligada a concursos diferentes, com correspondência confirmada pelo usuário. Mesmo estudo reaproveitado sem duplicar o tempo global. |
| Simulados | Cadastro e resultados por classificação; integração opcional às estatísticas e edição dessa opção sem criar tentativas duplicadas. |
| Prontidão | Cobertura, cumprimento de revisões e acertos independentes, inclusive por ramo e período. Sem nota de probabilidade de aprovação. |
| Recomendações | Regras visíveis, amostra mínima, meta, cobertura, revisões, pesos e urgência. Ações para abrir material, registrar questões, ir às revisões, adicionar bloco e ignorar. |
| Ciclo | Duração e atividade por bloco, disciplinas repetidas, reordenação, posição atual, retorno ao início, voltas e histórico de avanço/adiamento. |
| Pomodoro | Foco/pausas configuráveis, iniciar, pausar, retomar, reiniciar e finalizar; deadline persistente e proteção contra finalização duplicada. Notificação local e sinal sonoro quando disponíveis. |
| Revisões | Intervalos configuráveis (1/7/30 dias por padrão), associação ao tópico/PDF/páginas, vencimentos, conclusão, dificuldade e duração própria. |
| Hábitos | Heatmap anual clicável, tempo, pomodoros, leitura, questões, revisões e simulados por dia; sequência, descanso, horas e consistência. |
| Planejamento | Dias até a prova, dias planejados, disponibilidade, teoria pendente, revisões, simulados e meta acumulada de questões, com premissas explícitas. |
| Backup | Exportação ZIP com banco e documentos; restauração confirmada, validada e com cópia completa anterior. Snapshots diários do banco. |
| Relatórios | CSV com estatísticas hierárquicas reais. |
| Empacotamento | Configurações para Windows x64, Linux e macOS; workflow de instalador Windows e scripts reproduzíveis. |

## Parcial ou pendente em relação ao prompt

1. **Compreensão universal de editais:** a extração é por regras, não um modelo semântico. Tabelas de provas, múltiplas colunas, cargos sem rótulo, anexos com formatação complexa e tópicos corridos em parágrafos podem exigir cadastro manual. A confiança exibida não é probabilidade estatística calibrada.
2. **Retificações estruturais completas:** confirmação de campos e adição de tópicos funcionam; comparação visual lado a lado, inferência automática de tópicos removidos/substituídos e migração automática dos vínculos antigos não estão implementadas. O usuário precisa revisar a estrutura sem apagar registros vinculados.
3. **Catálogos normalizados de bancas/cargos:** há cargo e banca por objetivo e seleção quando o rótulo é reconhecido; não há catálogo independente com múltiplos cargos simultâneos no mesmo objetivo. Use um objetivo por cargo.
4. **Sumário e capítulos:** marcadores embutidos são extraídos e listados; inferência completa de capítulos/sumários de qualquer apostila e navegação clicável por destino de marcador permanecem pendentes. A navegação por página e a pesquisa funcionam.
5. **Correspondência semântica:** sugestões usam palavras e não são consideradas definitivas. Não há classificador semântico local; o usuário deve validar tanto o tópico quanto os intervalos.
6. **Metas avançadas:** metas diárias, disponibilidade e descanso estão operacionais. Metas semanais/mensais personalizadas e previsão de duração aprendida automaticamente com o histórico ainda não estão implementadas; o planejamento mostra premissas manuais.
7. **Análises longitudinais avançadas:** há evolução diária de acertos e resumos de simulados; gráficos específicos de evolução de simulados, taxa móvel das últimas sessões e correlação causal entre revisões e acertos permanecem pendentes. Não há alegação causal.
8. **Integração de tempo:** duração de questões/revisões é armazenada separadamente. O tempo de foco e o heatmap vêm das sessões manuais/Pomodoro para evitar dupla contagem. Sessões que atravessam a meia-noite são atribuídas à data da finalização, sem divisão entre dias.
9. **Documentos protegidos e volume:** PDFs com senha não têm fluxo de desbloqueio. Arquivos muito grandes podem pressionar a memória; upload/restauração têm limite de 200 MB e restauração descompactada de 1 GB. Não há ensaio de escala com milhões de registros.
10. **Criptografia e sincronização:** os dados ficam locais, mas não são criptografados pela aplicação. Não há nuvem, conta, sincronização, atualização automática ou consulta por novos editais.
11. **Distribuição nativa:** assinatura digital/notarização e validação manual em Windows/macOS não estão concluídas. O ambiente de execução desta entrega é Linux.

## Evidências de verificação

- `npm test`: **51 testes passaram**, em domínio, API e armazenamento. Os 12 cenários obrigatórios do prompt estão cobertos nos testes nomeados 1–12.
- `npm run build`: checagem TypeScript e compilação de produção concluídas.
- `npm run test:e2e`: **2 testes passaram** no Chromium do ambiente, tanto no desenvolvimento quanto no build de produção, incluindo o fluxo completo da interface e OCR sem serviços externos.
- `npm run test:desktop`: janela Electron de desenvolvimento abriu, cadastrou e preservou um concurso após reinício.
- `node scripts/test-desktop.mjs --packaged`: a mesma verificação passou no executável Linux empacotado. O teste headless usa flags de teste adequadas ao contêiner; essas flags não são adicionadas ao aplicativo distribuído.
- `npm audit --omit=dev`: **nenhuma vulnerabilidade reportada nas dependências de produção** no momento da verificação.
- `npm run format:check`: formatação dos fontes verificada.
- Os testes criam suas próprias bases temporárias; a base de uso permanece vazia.

O instalador NSIS Windows foi tentado em Linux e encontrou um toolset Wine sem DLLs essenciais (`ntdll`/`kernel32`). O arquivo intermediário pequeno de instalação não é uma entrega válida e foi removido. O workflow nativo Windows e `npm run dist:win` estão preparados para produzir o instalador no sistema de destino. A versão portátil Windows x64 foi gerada com sucesso em `release/Cronograma de Estudos 1.0.0.exe`. O pacote Linux fica em `release/linux-unpacked/`. Gerar um executável Windows não equivale a testá-lo no Windows.

## Artefatos

- `release/Cronograma de Estudos 1.0.0.exe`: versão portátil Windows x64; build concluído, execução nativa Windows não testada.
- `release/linux-unpacked/`: aplicação Linux empacotada; inicialização, cadastro e persistência após reinício verificados.
- `release/cronograma-de-estudos-fonte.zip`: código-fonte, lockfile, documentação e testes; não inclui dependências, dados locais ou binários gerados.
- `.github/workflows/windows.yml`: publicação automatizada da versão portátil Windows. O instalador NSIS permanece separado.

O install_script e as instruções start_skill do ambiente foram salvos como rascunho para reutilização. Eles não publicam o código nem o ambiente automaticamente.
