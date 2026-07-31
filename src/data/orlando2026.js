const createUtcDate = (date, time) => {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes));
};

const itinerary = [
  {
    importKey: 'orlando-2026-10-02-carro-eletrico',
    type: 'transfer',
    title: 'Retirada do carro elétrico',
    date: '2026-10-02',
    time: '17:30',
    location: 'Locadora de veículos – Orlando, Flórida',
    description: 'Retirar o carro elétrico, fotografar o veículo e o nível da bateria, confirmar o conector NACS/CCS, os adaptadores disponíveis e a carga exigida na devolução. Seguir para o Hotel Monreale Express e fazer uma recarga curta se a bateria estiver abaixo de 70%.'
  },
  {
    importKey: 'orlando-2026-10-03-ingressos-outlets',
    type: 'passeio',
    title: 'Navy Exchange, ingressos e outlets',
    date: '2026-10-03',
    time: '10:00',
    location: 'NEX Tickets & Travel, 7151 Earhart Dr, Orlando, FL',
    description: 'Comprar os ingressos com desconto militar levando identificação válida. Confirmar Park-to-Park para 05/10, Halloween Horror Nights separado para 08/10 e comparar ingresso Disney de 2 dias com a promoção militar. Depois, compras no Orlando International Premium Outlets e recarga no EVgo do outlet ou no Phillips Crossing, conferindo o aplicativo antes de estacionar.'
  },
  {
    importKey: 'orlando-2026-10-04-kennedy-space-center',
    type: 'passeio',
    title: 'Kennedy Space Center — NASA',
    date: '2026-10-04',
    time: '08:00',
    location: 'Kennedy Space Center Visitor Complex, Merritt Island, FL',
    description: 'Sair de Orlando com pelo menos 90% de bateria. Prioridades: ônibus para Apollo/Saturn V, Atlantis, Gateway e Heroes & Legends. Reservar praticamente o dia inteiro. Pontos de precaução na região de Cocoa: Flying J na Friday Road para CCS ou Tesla Supercharger de Cocoa, conforme a compatibilidade do veículo.'
  },
  {
    importKey: 'orlando-2026-10-05-universal-dois-parques',
    type: 'passeio',
    title: 'Universal Studios + Islands of Adventure',
    date: '2026-10-05',
    time: '07:30',
    location: 'Universal Orlando Resort, 6000 Universal Blvd, Orlando, FL',
    description: 'Usar ingresso 2-Park Park-to-Park. Começar no Islands of Adventure com Hagrid, VelociCoaster, Forbidden Journey, Hulk e Spider-Man. Usar o Hogwarts Express para seguir ao Universal Studios e visitar Diagon Alley, Gringotts, Mummy, Transformers, Men in Black e Bourne Stuntacular. Chegar antes da abertura e usar Single Rider quando for vantajoso.'
  },
  {
    importKey: 'orlando-2026-10-06-st-augustine',
    type: 'passeio',
    title: 'St. Augustine + Buc-ee’s e Walmart',
    date: '2026-10-06',
    time: '07:00',
    location: 'Historic Downtown Parking Facility, 10 S Castillo Dr, St. Augustine, FL',
    description: 'Visitar Castillo de San Marcos, Bayfront, St. George Street, Flagler College e Lightner Museum. Na volta, parar no Buc-ee’s, 200 World Commerce Pkwy, para compras e recarga, e depois no Walmart Supercenter, 8990 Turkey Lake Rd, Orlando. Previsão de retorno ao hotel perto de 21h45.'
  },
  {
    importKey: 'orlando-2026-10-07-magic-kingdom',
    type: 'passeio',
    title: 'Magic Kingdom até os fogos',
    date: '2026-10-07',
    time: '07:30',
    location: 'Magic Kingdom Park, Walt Disney World Resort, FL',
    description: 'Chegar 45 a 60 minutos antes da abertura. Prioridades: TRON, Seven Dwarfs, Tiana’s Bayou Adventure, Space Mountain e Haunted Mansion. Jantar sem pressa e escolher o ponto dos fogos 45 a 60 minutos antes. Há poucas vagas ChargePoint e são por ordem de chegada; não depender delas como única opção.'
  },
  {
    importKey: 'orlando-2026-10-08-outlets-descanso',
    type: 'passeio',
    title: 'Outlets, descanso e recarga',
    date: '2026-10-08',
    time: '10:30',
    location: 'International Drive, Orlando, FL',
    description: 'Manhã tranquila. Fazer compras até aproximadamente 14h30, aproveitar para recarregar o carro e descansar no hotel entre 15h e 17h antes do Halloween Horror Nights.'
  },
  {
    importKey: 'orlando-2026-10-08-halloween-horror-nights',
    type: 'passeio',
    title: 'Halloween Horror Nights',
    date: '2026-10-08',
    time: '17:15',
    location: 'Universal Studios Florida, 6000 Universal Blvd, Orlando, FL',
    description: 'Evento com ingresso separado. Priorizar as casas mais desejadas nas primeiras horas. Uber ou Lyft pode ser mais confortável por causa do estacionamento e da proximidade do hotel. Para preservar o dia seguinte no EPCOT, considerar sair entre meia-noite e 1h.'
  },
  {
    importKey: 'orlando-2026-10-09-epcot',
    type: 'passeio',
    title: 'EPCOT',
    date: '2026-10-09',
    time: '10:30',
    location: 'EPCOT, Walt Disney World Resort, FL',
    description: 'Depois do Halloween Horror Nights, chegar em ritmo mais tranquilo. Prioridades: Guardians of the Galaxy, Remy, Frozen, Soarin’ e Test Track, conforme operação e filas. Explorar o World Showcase, o Food & Wine e permanecer para o espetáculo noturno. Sair do hotel com carga confortável.'
  },
  {
    importKey: 'orlando-2026-10-10-portofino-bay',
    type: 'passeio',
    title: 'Loews Portofino Bay + Harbor Piazza',
    date: '2026-10-10',
    time: '10:00',
    location: 'Loews Portofino Bay Hotel, 5601 Universal Blvd, Orlando, FL',
    description: 'Trajeto do Hotel Monreale de aproximadamente 1,2 milha e normalmente 5 a 10 minutos. Caminhar pela Harbor Piazza, fotografar fachadas, carros italianos e Vespas, visitar lojas, almoçar na Trattoria del Porto ou no Sal’s Market Deli, tomar gelato e assistir à Musica della Notte ao pôr do sol. O estacionamento para visitante é pago. No destino há carregadores nível 2 NACS e J1772; confirmar acesso pelo telefone +1 407-503-1000. Precaução: Tesla Supercharger, 6315 International Dr, ou EVgo Phillips Crossing, 8015 Turkey Lake Rd.'
  },
  {
    importKey: 'orlando-2026-10-11-devolucao-carro',
    type: 'transfer',
    title: 'Devolução do carro elétrico no SFB',
    date: '2026-10-11',
    time: '10:00',
    location: 'Orlando Sanford International Airport (SFB)',
    description: 'Sair do hotel às 8h30 e chegar ao aeroporto entre 10h e 10h30. Cumprir a carga exigida no contrato, retirar objetos pessoais, fotografar o carro e o painel e guardar o comprovante da devolução antes do voo.'
  }
];

export const ORLANDO_2026_IMPORT_KEYS = itinerary.map(({ importKey }) => importKey);

export const createOrlando2026Events = () =>
  itinerary.map(({ date, time, ...event }) => ({
    ...event,
    date: createUtcDate(date, time)
  }));
