# PROMPT DEFINITIVO PARA O CODEX

# CRONOGRAMA DE ESTUDOS — SISTEMA INTELIGENTE DE PREPARAÇÃO PARA CONCURSOS

## 1. Papel e objetivo

Atue como um engenheiro de software sênior, arquiteto de sistemas, especialista em processamento de documentos, análise de dados educacionais e design UX/UI.

Desenvolva um aplicativo desktop completo, profissional e funcional denominado:

**CRONOGRAMA DE ESTUDOS**

O aplicativo será um sistema integrado de preparação para concursos públicos, capaz de analisar editais, organizar disciplinas, acompanhar conteúdos estudados, gerenciar PDFs, registrar exercícios, medir o desempenho, organizar revisões e indicar diariamente o que o estudante deve estudar.

O programa deverá integrar:

1. Método circular de estudos.
2. Analisador inteligente de editais.
3. Extração de conteúdos programáticos.
4. Comparação entre edital e materiais em PDF.
5. Controle de cobertura do edital.
6. Identificação de tópicos concluídos e pendentes.
7. Leitor integrado de PDFs.
8. Controle exato das páginas estudadas.
9. Histórico de sessões e interrupções.
10. Cronômetro Pomodoro.
11. Calendário de hábitos.
12. Revisões espaçadas.
13. Gerenciamento de exercícios e simulados.
14. Taxa de acertos por concurso, disciplina, assunto e subassunto.
15. Indicadores de cobertura, revisão e desempenho.
16. Painel de Prontidão para a Prova.
17. Recomendações de estudo baseadas em dados.
18. Planejamento até a data da prova.
19. Gerenciamento de múltiplos concursos.
20. Salvamento automático e backup.

O sistema deverá funcionar como um verdadeiro assistente pessoal de preparação para concursos.

**Não quero um protótipo ilustrativo. Quero um aplicativo real, com funcionalidades operacionais, banco de dados persistente, interface intuitiva e testes.**

## 2. Arquitetura e tecnologias

Desenvolva preferencialmente um aplicativo desktop para Windows, com possibilidade de execução em macOS e Linux.

Tecnologias sugeridas:

* Tauri 2 para o aplicativo desktop.
* React e TypeScript.
* Vite.
* Tailwind CSS.
* shadcn/ui.
* SQLite.
* PDF.js.
* OCR local para documentos digitalizados.
* Recharts.
* Lucide Icons.

Use versões atuais e compatíveis, consultando a documentação técnica quando necessário.

O aplicativo deverá funcionar offline após instalado.

Documentos pessoais, PDFs, editais, estatísticas e históricos deverão permanecer armazenados localmente.

Mantenha separação entre interface, lógica de negócios, análise documental, cálculos estatísticos e persistência.

## 3. Analisador Inteligente de Editais

Crie uma seção denominada **Meus Concursos**, com a funcionalidade **Analisar Edital**.

O usuário deverá importar arquivos PDF de editais de concursos públicos.

O programa deverá analisar o conteúdo e identificar automaticamente:

### Informações do concurso

* Nome completo do concurso.
* Órgão responsável.
* Número e ano do edital.
* Banca organizadora.
* Data de publicação.
* Cargo e especialidade.
* Escolaridade exigida.
* Número de vagas.
* Cadastro de reserva.
* Remuneração.
* Jornada de trabalho.
* Localidade de lotação, quando informada.
* Período de inscrições.
* Taxa de inscrição.
* Datas para pedidos de isenção.
* Data prevista da prova.
* Horário e duração da prova.
* Modalidade de avaliação.
* Quantidade de questões.
* Pesos das disciplinas.
* Pontuação máxima e mínima.
* Critérios de aprovação e eliminação.
* Prova discursiva, se houver.
* Outras etapas previstas.
* Endereços oficiais informados no edital.

Se um documento não possuir determinada informação, mostre "Não informado".

Não invente dados.

### Seleção de cargo

Se o edital contiver vários cargos, apresente uma seleção para o usuário escolher o cargo desejado.

O programa deverá identificar o conteúdo programático correspondente ao cargo selecionado, incluindo conteúdos comuns e específicos.

### Anexos e retificações

Permita importar:

* Edital de abertura.
* Anexos de conteúdo programático.
* Cronogramas.
* Quadros de provas.
* Retificações.
* Documentos complementares.

As retificações deverão atualizar as informações aplicáveis sem apagar o histórico das versões anteriores.

Mostre quais informações foram alteradas.

Não afirme que o edital está atualizado sem evidência de que a versão mais recente foi analisada.

## 4. Extração hierárquica do conteúdo programático

O programa deverá extrair e estruturar o conteúdo programático da seguinte forma:

**Concurso → Cargo → Disciplina → Assunto → Subassunto.**

Exemplo:

Direito Constitucional

1. Direitos e Garantias Fundamentais.

   * Direitos individuais e coletivos.
   * Direitos sociais.
   * Nacionalidade.
   * Direitos políticos.
2. Organização do Estado.

   * Organização político-administrativa.
   * Competências constitucionais.
3. Controle de Constitucionalidade.

   * Controle difuso.
   * Controle concentrado.
   * Ações de controle.

O conteúdo deverá ser obtido do edital real, não de modelos genéricos.

Preserve o texto original e sua estrutura.

Cada disciplina, assunto e subassunto deverá possuir identificador próprio no banco de dados.

Permita editar manualmente a estrutura extraída.

## 5. Conferência humana da análise do edital

Implemente uma funcionalidade obrigatória chamada:

**Conferir com o Edital Original**

Sempre que o programa extrair uma informação, deverá armazenar:

* Documento de origem.
* Página em que a informação aparece.
* Item ou seção do edital.
* Trecho original utilizado.
* Grau de confiança da extração.

Ao clicar em uma disciplina, tópico, data ou informação relevante, o usuário deverá conseguir abrir o edital diretamente na página correspondente.

Exemplo:

Tópico: Controle de Constitucionalidade.

Origem: Edital de Abertura, Anexo II, página 37.

Botão: **Ver no edital**.

O aplicativo deverá abrir a página 37 e, quando tecnicamente possível, destacar o trecho correspondente.

Se a identificação for incerta, apresente:

"Informação não confirmada. Verifique no edital."

O usuário poderá confirmar, corrigir, substituir ou rejeitar a informação.

Nunca apresente extrações incertas como fatos confirmados.

## 6. Checklist completo do edital

Após importar e validar o conteúdo programático, gere automaticamente um checklist.

Cada tópico deverá possuir estados independentes:

**Cobertura teórica**

* Não estudado.
* Parcialmente estudado.
* Estudado.
* Não verificado.

**Revisão**

* Não revisado.
* Revisão pendente.
* Revisado.
* Precisa de nova revisão.

**Questões**

* Sem questões registradas.
* Questões realizadas.
* Desempenho abaixo da meta.
* Desempenho dentro da meta.

O sistema não deverá confundir um tópico lido com um tópico dominado.

Permita marcações manuais, mas mantenha histórico de alterações.

## 7. Biblioteca de PDFs

O usuário poderá importar múltiplos PDFs e associá-los às disciplinas.

O programa deverá:

* Identificar quantidade total de páginas.
* Extrair texto.
* Detectar sumário e marcadores.
* Identificar capítulos, assuntos e subassuntos.
* Oferecer OCR para PDFs digitalizados.
* Permitir pesquisar palavras.
* Permitir zoom.
* Navegar por páginas.
* Criar marcadores.
* Registrar anotações.
* Abrir automaticamente na página correta.

### Controle de leitura

O usuário poderá informar:

* Página inicial estudada.
* Página final estudada.
* Tópico relacionado.
* Data do estudo.
* Observações.
* Estudo concluído ou interrompido.

O programa deverá calcular automaticamente:

* Total de páginas concluídas.
* Total de páginas pendentes.
* Percentual por PDF.
* Percentual por disciplina.
* Percentual global.

Intervalos sobrepostos não poderão ser contabilizados duas vezes.

A página visualizada não será considerada automaticamente concluída.

Ao interromper a leitura, o programa deverá salvar exatamente onde o estudante parou.

## 8. Comparação entre edital e PDFs

Crie um mecanismo de correspondência entre os tópicos do edital e os conteúdos existentes nos PDFs.

O programa deverá identificar onde cada assunto pode ser estudado.

Exemplo:

**Edital:** Controle de Constitucionalidade.

**Material:** Apostila de Direito Constitucional.

**Páginas correspondentes:** 115 a 148.

**Páginas concluídas:** 115 a 130.

**Situação:** Parcialmente estudado.

O sistema deverá permitir que o usuário confirme ou corrija essa associação.

Não considere apenas a similaridade de palavras para estabelecer uma correspondência definitiva.

Quando um tópico não for encontrado nos materiais, mostre:

**Assunto do edital sem material identificado.**

Esses assuntos deverão aparecer em uma lista própria.

O histórico de leitura anterior à importação do edital deverá ser preservado e aproveitado quando houver correspondência validada.

## 9. Cobertura do edital

Crie o indicador **Cobertura do Edital**.

Ele deverá calcular a proporção de conteúdos exigidos que foram efetivamente estudados.

Mostre:

* Cobertura global do edital.
* Cobertura de cada disciplina.
* Cobertura de cada assunto.
* Cobertura dos subassuntos.
* Total de tópicos concluídos.
* Total de tópicos parcialmente estudados.
* Total de tópicos pendentes.
* Total de tópicos sem material.
* Total de correspondências não verificadas.

Evite contagens duplicadas entre assuntos e subassuntos.

Como regra inicial, utilize os tópicos finais da estrutura hierárquica como unidades de cobertura.

Permita pesos diferentes quando apropriado.

Mantenha essa métrica separada da taxa de acertos em questões e do total de páginas lidas.

## 10. Sistema avançado de questões

Desenvolva um módulo completo denominado **Questões e Desempenho**.

Este módulo deverá registrar o desempenho do estudante de maneira hierárquica, contemplando obrigatoriamente:

1. Concurso como um todo.
2. Disciplina como um todo.
3. Assunto de uma disciplina.
4. Subassunto específico, quando cadastrado.

### Registro de questões

O usuário deverá poder cadastrar sessões de questões e informar:

* Concurso associado.
* Banca organizadora.
* Disciplina.
* Assunto.
* Subassunto, quando disponível.
* Data.
* Origem das questões.
* Quantidade de questões resolvidas.
* Quantidade de acertos.
* Quantidade de erros.
* Quantidade de questões em branco.
* Tempo gasto.
* Tipo de questão.
* Observações.

Permita tanto registros individuais por questão quanto registros agregados de sessões, desde que seja possível manter a consistência dos totais.

Uma sessão poderá conter questões de diferentes disciplinas e assuntos.

Nesse caso, permita distribuir os resultados entre eles.

### Regras de classificação

Cada questão deverá possuir uma disciplina principal e um tópico principal para fins de agregação.

Permita adicionar etiquetas secundárias relacionadas a outros assuntos, mas não contabilize a mesma tentativa várias vezes dentro dos totais gerais.

Questões sem assunto identificado deverão aparecer como "Assunto não classificado", permanecendo no total da disciplina.

Questões sem disciplina identificada poderão permanecer no total do concurso como "Disciplina não classificada".

Um registro agregado que não discrimine assuntos não deverá produzir taxas fictícias para tópicos individuais.

## 11. Taxa de acertos global do edital

Calcule automaticamente a taxa de acertos considerando todas as questões realizadas e vinculadas ao concurso selecionado.

Fórmula padrão:

**Taxa de acertos do concurso = total de questões corretas / total de questões efetivamente respondidas × 100.**

Por padrão, o denominador deverá considerar acertos e erros.

Questões em branco deverão ser contabilizadas separadamente e não entrar nesse denominador, salvo quando o usuário selecionar uma métrica de aproveitamento sobre o total apresentado.

Exemplo:

Concurso: Analista Administrativo.

* Questões respondidas: 1.000.
* Acertos: 780.
* Erros: 220.
* Taxa de acertos: 78%.

O dashboard deverá apresentar:

**Desempenho geral no concurso: 78%.**

Mostre também os totais absolutos, pois uma taxa sem tamanho de amostra pode ser enganosa.

Permita filtrar por períodos, banca, origem e tipo de questão.

Não calcule o percentual global como média simples das porcentagens das disciplinas.

O cálculo deverá usar as quantidades reais de acertos e questões respondidas.

## 12. Taxa de acertos por disciplina

Cada disciplina deverá possuir uma taxa própria.

Exemplo:

| Disciplina        |  Questões | Acertos |    Taxa |
| ----------------- | --------: | ------: | ------: |
| Português         |       200 |     150 |     75% |
| Constitucional    |       200 |     160 |     80% |
| Administrativo    |       250 |     175 |     70% |
| Informática       |       150 |     120 |     80% |
| Raciocínio Lógico |       200 |     175 |   87,5% |
| **Total**         | **1.000** | **780** | **78%** |

Os números são ilustrativos.

O programa deverá recalcular os resultados automaticamente sempre que uma sessão for incluída, alterada ou removida.

A taxa da disciplina deverá agregar os resultados de todos os assuntos pertencentes a ela, além de eventuais questões ainda não classificadas por assunto.

Permita visualizar o desempenho histórico de cada disciplina.

## 13. Taxa de acertos por assunto e subassunto

Esta funcionalidade é obrigatória e deverá receber atenção especial.

Cada assunto do edital possuirá seus próprios indicadores de desempenho.

Exemplo:

**Disciplina: Direito Constitucional**

| Assunto                         | Questões | Acertos |    Taxa |
| ------------------------------- | -------: | ------: | ------: |
| Princípios Fundamentais         |       30 |      27 |     90% |
| Direitos Fundamentais           |       50 |      40 |     80% |
| Organização do Estado           |       40 |      30 |     75% |
| Controle de Constitucionalidade |       40 |      24 |     60% |
| Poder Legislativo               |       40 |      39 |   97,5% |
| **Total da disciplina**         |  **200** | **160** | **80%** |

O programa deverá permitir expandir cada assunto e mostrar os resultados de seus subassuntos.

Por exemplo:

**Controle de Constitucionalidade**

* Controle difuso: 70%.
* Controle concentrado: 55%.
* Ação Direta de Inconstitucionalidade: 60%.
* Arguição de Descumprimento de Preceito Fundamental: 50%.

Esses valores deverão resultar de registros reais.

A taxa de um assunto deverá considerar os registros pertencentes a ele e aos seus subassuntos, sem duplicações.

### Estrutura visual

A navegação deverá permitir:

**Concurso → Disciplina → Assunto → Subassunto → Histórico de questões.**

Ao selecionar qualquer nível, o usuário visualizará:

* Quantidade de questões respondidas.
* Quantidade de acertos.
* Quantidade de erros.
* Taxa de acertos.
* Tempo gasto.
* Histórico de sessões.
* Evolução do desempenho.
* Quantidade de questões recentes.
* Desempenho nas últimas sessões.
* Meta desejada de acertos.

Essa estrutura permitirá identificar com precisão os assuntos em que o estudante apresenta maiores dificuldades.

## 14. Regras matemáticas e integridade das estatísticas

Implemente regras claras de agregação.

### Regra 1 — Contagem única

Cada tentativa de questão deverá ser contabilizada uma única vez nos totais do concurso.

### Regra 2 — Agregação hierárquica

O resultado de um assunto deverá agregar corretamente seus subassuntos.

O resultado de uma disciplina deverá agregar seus assuntos.

O resultado global deverá agregar todas as disciplinas do concurso.

### Regra 3 — Não utilizar médias simples

Nunca obtenha a taxa de acertos global calculando a média aritmética das taxas individuais.

Utilize sempre:

**Total de acertos / total de questões respondidas × 100.**

### Regra 4 — Questões não classificadas

Registros sem classificação completa deverão permanecer nos níveis em que houver vínculo conhecido, sem produzir resultados inventados para níveis inferiores.

### Regra 5 — Amostras pequenas

Se o usuário acertar 5 de 5 questões, mostre 100% de acertos, mas também informe que o resultado se baseia em apenas cinco questões.

Permita configurar um número mínimo de questões antes de considerar o desempenho suficientemente representativo para gerar alertas de prioridade.

### Regra 6 — Diferentes modalidades

Suporte questões com pontuação negativa, pesos ou regras específicas de determinada banca.

Mantenha separadas:

* Taxa bruta de acertos.
* Aproveitamento sobre questões apresentadas.
* Pontuação líquida conforme regras da prova.

### Regra 7 — Reutilização entre concursos

O mesmo registro de estudo ou tentativa poderá estar associado a mais de um concurso quando houver correspondência validada.

Porém, a reutilização não poderá duplicar a tentativa dentro do mesmo concurso, disciplina ou assunto.

### Regra 8 — Dados insuficientes

Se não houver questões respondidas, mostre "Sem dados" em vez de 0% de acertos.

## 15. Painel de Prontidão para a Prova

Crie uma seção de destaque chamada:

**PRONTIDÃO PARA A PROVA**

O painel deverá apresentar três indicadores independentes.

### Indicador 1 — Cobertura do edital

Representa o percentual do conteúdo programático efetivamente estudado.

Exemplo: 72%.

### Indicador 2 — Revisões realizadas

Representa a proporção de revisões planejadas que foram realizadas dentro do período selecionado.

Exemplo: 45%.

Também apresente o número absoluto de revisões pendentes, concluídas e vencidas.

### Indicador 3 — Taxa de acertos

Representa o percentual de acertos nas questões respondidas do concurso.

Exemplo: 68%.

Mostre também o número de questões que fundamenta essa taxa.

### Importante

Não transforme automaticamente esses três indicadores em uma nota única de probabilidade de aprovação.

Eles representam dimensões diferentes:

* Cobertura mede o conteúdo estudado.
* Revisão mede o cumprimento das revisões programadas.
* Taxa de acertos mede o desempenho observado nas questões.

Não afirme que determinado percentual corresponde a uma probabilidade real de aprovação.

## 16. Prontidão por disciplina e tópico

O painel de Prontidão para a Prova deverá funcionar também nos níveis de disciplina e assunto.

Exemplo:

**Direito Administrativo**

* Cobertura teórica: 80%.
* Revisões realizadas: 60%.
* Taxa de acertos: 55%.
* Questões respondidas: 200.

**Assunto: Atos Administrativos**

* Cobertura teórica: 100%.
* Revisões realizadas: 50%.
* Taxa de acertos: 42%.
* Questões respondidas: 50.

Nesse exemplo, o sistema deverá reconhecer que o assunto já foi lido, mas o desempenho em questões ainda é baixo.

Portanto, poderá recomendar nova revisão e resolução de questões, em vez de simplesmente repetir toda a leitura teórica.

Mantenha a distinção entre cobertura, revisão e desempenho em todos os níveis.

## 17. Identificação de pontos fracos

Crie uma funcionalidade chamada:

**Pontos que Precisam de Atenção**

Ela deverá analisar:

* Tópicos não estudados.
* Tópicos parcialmente estudados.
* Assuntos com revisões pendentes.
* Assuntos com baixa taxa de acertos.
* Assuntos com maior peso na prova.
* Assuntos com quantidade insuficiente de questões respondidas.
* Tempo restante até a prova.

Exemplos de recomendações:

"Controle de Constitucionalidade apresenta 60% de acertos em 40 questões. Considere priorizar exercícios e revisão."

"Licitações e Contratos possui conteúdos pendentes no edital."

"Português apresenta bom desempenho geral, mas o tópico Crase possui taxa de acertos abaixo da meta."

Não classifique automaticamente como fraco um assunto com poucos registros.

O usuário deverá poder definir metas, como 70%, 80%, 85% ou 90% de acertos.

As recomendações deverão indicar os dados utilizados para justificá-las.

## 18. Recomendações inteligentes de estudo

Implemente um mecanismo de recomendação baseado em regras transparentes.

O sistema deverá considerar:

1. Conteúdos ainda não estudados.
2. Conteúdos parcialmente estudados.
3. Peso da disciplina no edital.
4. Quantidade prevista de questões.
5. Taxa de acertos da disciplina.
6. Taxa de acertos de cada assunto.
7. Revisões pendentes.
8. Tempo disponível até a prova.
9. Metas pessoais do usuário.

As recomendações deverão ajudar a definir o próximo conteúdo, sem substituir automaticamente a organização escolhida pelo estudante.

Permita exibir:

**Próxima prioridade sugerida: Direito Administrativo — Atos Administrativos.**

Motivo:

* Cobertura teórica completa.
* Taxa de acertos inferior à meta.
* Revisão pendente.
* Quantidade de questões suficiente para análise.

Ofereça ações:

* Revisar assunto.
* Resolver questões.
* Abrir material correspondente.
* Adicionar bloco ao ciclo.
* Ignorar recomendação.

## 19. Método circular de estudos

O método circular será o núcleo da organização.

O usuário definirá uma sequência de disciplinas e blocos de estudo.

O ciclo deverá funcionar independentemente dos dias da semana.

Ao concluir o último bloco, o sistema deverá voltar ao primeiro.

Ao interromper os estudos, deverá salvar a posição atual.

Permita:

* Duração personalizada por bloco.
* Repetição de disciplinas.
* Inclusão de revisões.
* Inclusão de questões.
* Inclusão de simulados.
* Reordenação de blocos.
* Pausa e retomada.
* Histórico de voltas concluídas.

Quando existir concurso associado, o programa poderá sugerir blocos orientados aos assuntos pendentes e ao desempenho.

Nenhuma recomendação poderá modificar o ciclo sem confirmação do usuário.

## 20. Planejamento até a data da prova

O sistema deverá considerar a data prevista da prova e a disponibilidade do estudante.

Calcule:

* Dias restantes.
* Dias planejados para estudo.
* Conteúdos pendentes.
* Horas disponíveis.
* Horas estimadas para cobertura teórica.
* Revisões programadas.
* Simulados previstos.
* Metas de questões.

Permita estabelecer metas diárias, semanais e mensais.

Exemplo:

"Faltam 60 dias para a prova."

"Existem 45 tópicos ainda não estudados."

"Você dispõe de 180 horas planejadas até a prova."

As estimativas deverão usar premissas explícitas e poderão ser recalculadas com base no histórico real.

Não forneça previsões de tempo como se fossem certezas.

## 21. Pomodoro

Implemente um cronômetro Pomodoro configurável.

Configuração padrão:

* Foco: 25 minutos.
* Pausa curta: 5 minutos.
* Pausa longa: 15 minutos.

O usuário poderá modificar os tempos.

Funcionalidades:

* Iniciar.
* Pausar.
* Continuar.
* Reiniciar.
* Finalizar.
* Notificações.
* Alertas sonoros.
* Histórico de sessões.

Cada sessão deverá ser vinculada à disciplina e, quando aplicável, ao concurso e ao assunto estudado.

Não contabilize pausas como tempo de estudo.

Preserve os dados quando o aplicativo for minimizado ou fechado.

## 22. Revisões espaçadas

Implemente revisões programadas por assunto.

Utilize inicialmente intervalos configuráveis de:

* 1 dia.
* 7 dias.
* 30 dias.

Registre:

* Disciplina.
* Assunto.
* PDF.
* Páginas.
* Data prevista.
* Data de conclusão.
* Tempo gasto.
* Grau de dificuldade.

As revisões deverão aparecer no calendário e no painel de estudos.

O programa deverá permitir relacionar revisões realizadas com a evolução posterior da taxa de acertos.

## 23. Simulados

Crie um sistema de gerenciamento de simulados.

Permita cadastrar:

* Concurso.
* Banca.
* Data.
* Duração.
* Quantidade de questões.
* Disciplinas.
* Resultado por disciplina.
* Resultado por assunto, quando disponível.
* Acertos.
* Erros.
* Questões em branco.
* Pontuação final.

O sistema deverá permitir registrar resultados detalhados e integrar as questões às estatísticas gerais quando o usuário escolher essa opção.

**Não contabilize a mesma tentativa duas vezes.**

Permita diferenciar questões de simulados e questões de exercícios avulsos.

Mostre a evolução dos resultados ao longo do tempo.

## 24. Calendário de hábitos

Crie um calendário semelhante ao mapa de contribuições do GitHub.

Cada dia deverá exibir a intensidade do tempo estudado.

Ao selecionar uma data, mostre:

* Tempo estudado.
* Pomodoros realizados.
* Disciplinas.
* Assuntos.
* Páginas concluídas.
* Questões respondidas.
* Taxa de acertos do dia.
* Revisões realizadas.
* Simulados.
* Cumprimento das metas.

Calcule:

* Dias estudados.
* Sequência atual.
* Maior sequência.
* Horas semanais.
* Horas mensais.
* Horas anuais.
* Média de estudo.
* Consistência em relação aos dias planejados.

Permita configurar dias de descanso.

## 25. Dashboard principal

A tela inicial deverá responder imediatamente:

**O que estudar agora?**

Apresente:

* Concurso principal.
* Banca.
* Cargo.
* Data da prova.
* Dias restantes.
* Próxima disciplina do ciclo.
* Próximo assunto recomendado.
* Último tópico estudado.
* PDF correspondente.
* Próxima página.
* Tempo programado.
* Pomodoro.
* Cobertura do edital.
* Revisões realizadas.
* Taxa global de acertos.
* Meta diária.
* Principais pendências.

Botões:

* Iniciar estudo.
* Abrir PDF.
* Iniciar Pomodoro.
* Ver conteúdo do edital.
* Registrar questões.
* Ver estatísticas.
* Adiar bloco.

## 26. Dashboard de desempenho

Crie uma página específica chamada:

**Desempenho em Questões**

Ela deverá possuir três níveis de navegação.

### Nível 1 — Desempenho do concurso

Exibir:

* Taxa geral de acertos.
* Questões respondidas.
* Acertos.
* Erros.
* Questões em branco.
* Evolução no tempo.
* Disciplinas com melhor desempenho.
* Disciplinas com pior desempenho.
* Evolução nos simulados.

### Nível 2 — Desempenho da disciplina

Exibir:

* Taxa geral de acertos na disciplina.
* Quantidade de questões.
* Histórico.
* Desempenho por assunto.
* Assuntos com maior taxa de erro.
* Assuntos sem dados suficientes.

### Nível 3 — Desempenho por assunto

Exibir:

* Taxa de acertos do assunto.
* Acertos e erros.
* Quantidade de questões.
* Desempenho dos subassuntos.
* Evolução histórica.
* Revisões realizadas.
* Data do último estudo.
* Material PDF associado.
* Recomendação específica.

Todos os indicadores deverão ser calculados a partir de registros reais.

Permita filtros por período, banca, concurso e origem das questões.

## 27. Múltiplos concursos

Permita cadastrar diversos concursos.

O usuário poderá selecionar um concurso principal.

Cada concurso deverá possuir:

* Edital próprio.
* Cargo.
* Conteúdo programático.
* Datas.
* Indicadores de cobertura.
* Desempenho em questões.
* Planejamento.
* Metas.

O mesmo estudo poderá beneficiar mais de um concurso quando houver correspondência validada.

Entretanto, isso não deverá duplicar o tempo registrado ou as tentativas de questões dentro de um mesmo contexto estatístico.

## 28. Banco de dados

Crie entidades relacionadas para:

* Concursos.
* Editais.
* Versões e retificações.
* Cargos.
* Bancas.
* Disciplinas.
* Assuntos.
* Subassuntos.
* Correspondências com PDFs.
* PDFs.
* Intervalos de páginas concluídas.
* Registros de tópicos estudados.
* Ciclos.
* Blocos do ciclo.
* Sessões de estudo.
* Pomodoros.
* Revisões.
* Questões.
* Tentativas de questões.
* Sessões agregadas de exercícios.
* Simulados.
* Resultados dos simulados.
* Metas.
* Histórico de hábitos.
* Recomendações.
* Preferências.

Implemente relações hierárquicas e chaves estrangeiras.

Garanta integridade referencial.

Centralize os cálculos estatísticos em serviços próprios.

Salve os dados automaticamente.

## 29. Interface e identidade visual

Quero uma interface moderna, elegante, minimalista e intuitiva.

Utilize:

* Tema claro e escuro.
* Cores sóbrias.
* Tipografia legível.
* Cartões visuais.
* Barras de progresso.
* Gráficos interativos.
* Calendário heatmap.
* Ícones consistentes.
* Animações discretas.

Menu lateral:

1. Início.
2. Meus Concursos.
3. Analisar Edital.
4. Meu Ciclo.
5. Disciplinas.
6. Biblioteca de PDFs.
7. Pomodoro.
8. Questões e Desempenho.
9. Simulados.
10. Revisões.
11. Prontidão para a Prova.
12. Meus Hábitos.
13. Estatísticas.
14. Configurações.

Priorize a clareza das informações.

Evite uma interface sobrecarregada.

## 30. Salvamento e backup

Utilize SQLite e diretórios persistentes de arquivos.

Não dependa exclusivamente de localStorage.

Todos os registros deverão continuar disponíveis após fechar e reabrir o aplicativo.

Implemente backup e restauração completos.

O backup deverá incluir PDFs, editais e dados relacionados.

Permita exportar relatórios e estatísticas.

Não exclua informações permanentemente sem confirmação explícita.

## 31. Testes obrigatórios

Implemente testes para validar:

### Teste 1 — Taxa global

Concurso com:

* 1.000 questões respondidas.
* 780 acertos.
* 220 erros.

Resultado esperado: 78% de acertos.

### Teste 2 — Taxa da disciplina

Direito Constitucional com:

* 200 questões.
* 160 acertos.
* 40 erros.

Resultado esperado: 80%.

### Teste 3 — Taxa do assunto

Controle de Constitucionalidade com:

* 40 questões.
* 24 acertos.
* 16 erros.

Resultado esperado: 60%.

### Teste 4 — Agregação correta

Uma disciplina possui:

* Assunto A: 10 questões e 9 acertos.
* Assunto B: 90 questões e 54 acertos.

Resultado esperado:

63 acertos em 100 questões, ou 63%.

Não utilizar média simples de 90% e 60%.

### Teste 5 — Questões em branco

Sessão com:

* 10 questões apresentadas.
* 6 acertos.
* 2 erros.
* 2 em branco.

Resultado esperado:

* Taxa sobre respondidas: 75%.
* Aproveitamento sobre apresentadas: 60%.

### Teste 6 — Assuntos sem questões

Um assunto não possui tentativas registradas.

Resultado esperado: "Sem dados".

### Teste 7 — Subassuntos

Um assunto contém diversos subassuntos.

O sistema deverá agregar os resultados sem contabilizar registros duplicados.

### Teste 8 — Mesmo estudo em concursos diferentes

O sistema deverá reaproveitar registros validados sem duplicar sessões ou questões dentro do mesmo concurso.

### Teste 9 — Cobertura do edital

Uma apostila possui páginas concluídas que correspondem parcialmente a um tópico.

O sistema deverá indicar cobertura parcial, sem tratá-la como conclusão integral.

### Teste 10 — Retificação

Uma retificação altera a data da prova e adiciona conteúdo programático.

O sistema deverá preservar o histórico anterior e atualizar as informações aplicáveis.

### Teste 11 — Persistência

Após reinicialização, todos os concursos, PDFs, registros de estudo, questões e estatísticas deverão permanecer salvos.

### Teste 12 — Conferência humana

Ao clicar em um tópico extraído do edital, o leitor deverá abrir sua página de origem.

O usuário deverá conseguir confirmar ou corrigir a extração.

## 32. Etapas de implementação

Desenvolva em fases, mantendo uma aplicação executável ao final de cada etapa.

**Fase 1:** Arquitetura, interface e banco de dados.

**Fase 2:** Disciplinas e ciclo circular.

**Fase 3:** Leitor de PDFs e controle de páginas.

**Fase 4:** Analisador de editais, cargos e conteúdo programático.

**Fase 5:** Correspondência entre edital e materiais.

**Fase 6:** Cobertura do edital.

**Fase 7:** Registro de questões e cálculo hierárquico de desempenho.

**Fase 8:** Painel de Prontidão para a Prova.

**Fase 9:** Pomodoro e calendário de hábitos.

**Fase 10:** Revisões e simulados.

**Fase 11:** Recomendações e planejamento até a prova.

**Fase 12:** Backup, relatórios, testes e empacotamento.

Não substitua funcionalidades reais por demonstrações com dados fictícios.

## 33. Entrega obrigatória

Forneça:

1. Código-fonte completo.
2. Estrutura organizada em módulos.
3. Banco de dados funcional.
4. Migrações.
5. Instruções de instalação.
6. Comandos para execução.
7. Procedimento para gerar instalador Windows.
8. README.md.
9. Testes automatizados.
10. Relatório de funcionalidades concluídas e pendentes.

Execute os testes e a compilação disponíveis.

Corrija os problemas encontrados.

Não declare concluído um recurso que ainda não esteja operacional.

## 34. Resultado final esperado

O programa deverá oferecer uma visão completa da preparação do estudante.

Ao abrir o Cronograma de Estudos, o usuário deverá conseguir verificar:

**Sobre o concurso:**

* Nome.
* Banca.
* Cargo.
* Data da prova.
* Conteúdos exigidos.

**Sobre o estudo:**

* Matérias concluídas.
* Tópicos pendentes.
* Cobertura do edital.
* Último PDF.
* Página de retomada.
* Próxima disciplina do ciclo.

**Sobre o desempenho:**

* Taxa geral de acertos do concurso.
* Taxa de acertos por disciplina.
* Taxa de acertos por assunto.
* Taxa de acertos por subassunto.
* Quantidade de questões realizadas.
* Evolução do desempenho.
* Principais dificuldades.

**Sobre a preparação:**

* Cobertura teórica.
* Revisões realizadas.
* Desempenho em questões.
* Prioridades de estudo.
* Tempo disponível até a prova.
* Evolução dos hábitos.

A função mais importante do sistema será integrar o conteúdo programático do edital com os estudos efetivamente realizados e os resultados obtidos nas questões.

O estudante deverá saber não apenas quanto já leu, mas **quais tópicos do edital realmente estudou, quais ainda faltam, em quais está acertando questões e quais precisam ser reforçados**.

**Inicie a implementação diretamente no ambiente de desenvolvimento. Crie os arquivos, instale as dependências, desenvolva os módulos, execute os testes e produza o aplicativo funcional mais completo possível. Não se limite a fornecer explicações ou exemplos de código.**
