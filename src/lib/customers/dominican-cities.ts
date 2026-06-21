/**
 * Predetermined Dominican Republic city list used for receiver addresses.
 *
 * Receivers do not use Google verification. Instead the user picks a city from
 * this list, which auto-fills the province (stored in the address `state` field)
 * and the country (always `DO`). Street, apartment, address 2, and zip remain
 * free-text inputs.
 *
 * Edit this list to match the destinations you actually deliver to — the city
 * picker and province auto-fill are driven entirely from these entries.
 */

export const DOMINICAN_REPUBLIC_COUNTRY_CODE = "DO";

export type DominicanCity = {
  city: string;
  /** Province name, stored in the address `state` field. */
  province: string;
};

export const DOMINICAN_CITIES: DominicanCity[] = [
  // Distrito Nacional
  { city: "Santo Domingo", province: "Distrito Nacional" },

  // Santo Domingo
  { city: "Santo Domingo Este", province: "Santo Domingo" },
  { city: "Santo Domingo Norte", province: "Santo Domingo" },
  { city: "Santo Domingo Oeste", province: "Santo Domingo" },
  { city: "Boca Chica", province: "Santo Domingo" },
  { city: "Los Alcarrizos", province: "Santo Domingo" },
  { city: "Pedro Brand", province: "Santo Domingo" },
  { city: "San Antonio de Guerra", province: "Santo Domingo" },

  // Santiago
  { city: "Santiago de los Caballeros", province: "Santiago" },
  { city: "Tamboril", province: "Santiago" },
  { city: "Licey al Medio", province: "Santiago" },
  { city: "Villa González", province: "Santiago" },
  { city: "Puñal", province: "Santiago" },
  { city: "Jánico", province: "Santiago" },
  { city: "San José de las Matas", province: "Santiago" },
  { city: "Sabana Iglesia", province: "Santiago" },
  { city: "Navarrete", province: "Santiago" },

  // La Vega
  { city: "La Vega", province: "La Vega" },
  { city: "Constanza", province: "La Vega" },
  { city: "Jarabacoa", province: "La Vega" },
  { city: "Jima Abajo", province: "La Vega" },

  // Puerto Plata
  { city: "Puerto Plata", province: "Puerto Plata" },
  { city: "Sosúa", province: "Puerto Plata" },
  { city: "Imbert", province: "Puerto Plata" },
  { city: "Altamira", province: "Puerto Plata" },
  { city: "Luperón", province: "Puerto Plata" },
  { city: "Villa Isabela", province: "Puerto Plata" },
  { city: "Guananico", province: "Puerto Plata" },

  // Duarte
  { city: "San Francisco de Macorís", province: "Duarte" },
  { city: "Pimentel", province: "Duarte" },
  { city: "Castillo", province: "Duarte" },
  { city: "Villa Riva", province: "Duarte" },
  { city: "Las Guáranas", province: "Duarte" },

  // La Altagracia
  { city: "Higüey", province: "La Altagracia" },
  { city: "Punta Cana", province: "La Altagracia" },
  { city: "Bávaro", province: "La Altagracia" },
  { city: "San Rafael del Yuma", province: "La Altagracia" },

  // La Romana
  { city: "La Romana", province: "La Romana" },
  { city: "Guaymate", province: "La Romana" },
  { city: "Villa Hermosa", province: "La Romana" },

  // San Pedro de Macorís
  { city: "San Pedro de Macorís", province: "San Pedro de Macorís" },
  { city: "Consuelo", province: "San Pedro de Macorís" },
  { city: "Quisqueya", province: "San Pedro de Macorís" },
  { city: "Ramón Santana", province: "San Pedro de Macorís" },
  { city: "Los Llanos", province: "San Pedro de Macorís" },

  // San Cristóbal
  { city: "San Cristóbal", province: "San Cristóbal" },
  { city: "Bajos de Haina", province: "San Cristóbal" },
  { city: "Villa Altagracia", province: "San Cristóbal" },
  { city: "Yaguate", province: "San Cristóbal" },
  { city: "Cambita Garabitos", province: "San Cristóbal" },
  { city: "Sabana Grande de Palenque", province: "San Cristóbal" },
  { city: "Los Cacaos", province: "San Cristóbal" },

  // Peravia
  { city: "Baní", province: "Peravia" },
  { city: "Nizao", province: "Peravia" },
  { city: "Matanzas", province: "Peravia" },

  // Azua
  { city: "Azua de Compostela", province: "Azua" },
  { city: "Las Charcas", province: "Azua" },
  { city: "Padre Las Casas", province: "Azua" },
  { city: "Sabana Yegua", province: "Azua" },
  { city: "Estebanía", province: "Azua" },

  // Barahona
  { city: "Barahona", province: "Barahona" },
  { city: "Cabral", province: "Barahona" },
  { city: "Enriquillo", province: "Barahona" },
  { city: "Paraíso", province: "Barahona" },

  // Espaillat
  { city: "Moca", province: "Espaillat" },
  { city: "Gaspar Hernández", province: "Espaillat" },
  { city: "Cayetano Germosén", province: "Espaillat" },
  { city: "Jamao al Norte", province: "Espaillat" },

  // Monseñor Nouel
  { city: "Bonao", province: "Monseñor Nouel" },
  { city: "Maimón", province: "Monseñor Nouel" },
  { city: "Piedra Blanca", province: "Monseñor Nouel" },

  // Sánchez Ramírez
  { city: "Cotuí", province: "Sánchez Ramírez" },
  { city: "Cevicos", province: "Sánchez Ramírez" },
  { city: "Fantino", province: "Sánchez Ramírez" },

  // Monte Plata
  { city: "Monte Plata", province: "Monte Plata" },
  { city: "Bayaguana", province: "Monte Plata" },
  { city: "Sabana Grande de Boyá", province: "Monte Plata" },
  { city: "Yamasá", province: "Monte Plata" },

  // María Trinidad Sánchez
  { city: "Nagua", province: "María Trinidad Sánchez" },
  { city: "Cabrera", province: "María Trinidad Sánchez" },
  { city: "Río San Juan", province: "María Trinidad Sánchez" },
  { city: "El Factor", province: "María Trinidad Sánchez" },

  // Samaná
  { city: "Santa Bárbara de Samaná", province: "Samaná" },
  { city: "Las Terrenas", province: "Samaná" },
  { city: "Sánchez", province: "Samaná" },

  // Valverde
  { city: "Mao", province: "Valverde" },
  { city: "Esperanza", province: "Valverde" },
  { city: "Laguna Salada", province: "Valverde" },

  // Monte Cristi
  { city: "Monte Cristi", province: "Monte Cristi" },
  { city: "Castañuelas", province: "Monte Cristi" },
  { city: "Guayubín", province: "Monte Cristi" },
  { city: "Villa Vásquez", province: "Monte Cristi" },

  // Dajabón
  { city: "Dajabón", province: "Dajabón" },
  { city: "Loma de Cabrera", province: "Dajabón" },
  { city: "Partido", province: "Dajabón" },

  // Santiago Rodríguez
  { city: "Sabaneta", province: "Santiago Rodríguez" },
  { city: "Monción", province: "Santiago Rodríguez" },

  // Hermanas Mirabal
  { city: "Salcedo", province: "Hermanas Mirabal" },
  { city: "Tenares", province: "Hermanas Mirabal" },
  { city: "Villa Tapia", province: "Hermanas Mirabal" },

  // San Juan
  { city: "San Juan de la Maguana", province: "San Juan" },
  { city: "Las Matas de Farfán", province: "San Juan" },
  { city: "Bohechío", province: "San Juan" },
  { city: "El Cercado", province: "San Juan" },

  // Elías Piña
  { city: "Comendador", province: "Elías Piña" },
  { city: "Bánica", province: "Elías Piña" },
  { city: "El Llano", province: "Elías Piña" },
  { city: "Hondo Valle", province: "Elías Piña" },

  // San José de Ocoa
  { city: "San José de Ocoa", province: "San José de Ocoa" },
  { city: "Sabana Larga", province: "San José de Ocoa" },
  { city: "Rancho Arriba", province: "San José de Ocoa" },

  // Hato Mayor
  { city: "Hato Mayor del Rey", province: "Hato Mayor" },
  { city: "Sabana de la Mar", province: "Hato Mayor" },
  { city: "El Valle", province: "Hato Mayor" },

  // El Seibo
  { city: "El Seibo", province: "El Seibo" },
  { city: "Miches", province: "El Seibo" },

  // Independencia
  { city: "Jimaní", province: "Independencia" },
  { city: "Duvergé", province: "Independencia" },
  { city: "La Descubierta", province: "Independencia" },
  { city: "Postrer Río", province: "Independencia" },

  // Bahoruco
  { city: "Neiba", province: "Bahoruco" },
  { city: "Galván", province: "Bahoruco" },
  { city: "Tamayo", province: "Bahoruco" },
  { city: "Villa Jaragua", province: "Bahoruco" },

  // Pedernales
  { city: "Pedernales", province: "Pedernales" },
  { city: "Oviedo", province: "Pedernales" },
];

const DOMINICAN_CITY_LOOKUP = new Map<string, DominicanCity>(
  DOMINICAN_CITIES.map((entry) => [entry.city.trim().toLowerCase(), entry]),
);

/** Find a city entry (case-insensitive) from the predetermined list. */
export function findDominicanCity(city: string): DominicanCity | undefined {
  return DOMINICAN_CITY_LOOKUP.get(city.trim().toLowerCase());
}

/** Options for a searchable city dropdown; value is the city name. */
export function getDominicanCityOptions(): { value: string; label: string }[] {
  return DOMINICAN_CITIES.map((entry) => ({
    value: entry.city,
    label: `${entry.city}, ${entry.province}`,
  }));
}
