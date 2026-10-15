export const disciplineCatalog = [
  'Processo Penal',
  'Direito Civil',
  'Direito Penal Especial',
  'Tributário',
  'Jurisprudência',
  'Direito Empresarial',
  'Direitos Humanos',
  'Noções Gerais/Formação Humanística',
  'Ambiental',
  'Eleitoral',
  'Código de Defesa do Consumidor',
  'Estatuto da Criança e do Adolescente',
  'Direito Penal',
  'Direito Administrativo',
  'Direito Constitucional',
  'Direito Processual Civil',
];
export const cycleActivities = ['Exercícios do Ciclo', 'SIMULADO'];
export const normalizeTitle = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const aliases: Record<string, string> = {
  'direito processual penal': 'processo penal',
  'processual penal': 'processo penal',
  'direito tributario': 'tributario',
  'direito ambiental': 'ambiental',
  'direito eleitoral': 'eleitoral',
  'direito do consumidor': 'codigo de defesa do consumidor',
  consumidor: 'codigo de defesa do consumidor',
  cdc: 'codigo de defesa do consumidor',
  'direito da crianca e do adolescente': 'estatuto da crianca e do adolescente',
  eca: 'estatuto da crianca e do adolescente',
  'formacao humanistica': 'nocoes gerais formacao humanistica',
  'processo civil': 'direito processual civil',
  'processual civil': 'direito processual civil',
};
export function disciplineKey(s: string) {
  const key = normalizeTitle(s);
  return aliases[key] || key;
}
