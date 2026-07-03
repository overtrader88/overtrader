/** Constantes de cobrança compartilhadas entre servidor e cliente.
 *  Arquivo PURO (sem imports server-only) p/ poder ser usado no browser. */

/** Custo, em créditos, de criar/renovar um alerta de watchlist (por ativo + TF + lado). */
export const WATCHLIST_ALERT_COST = 15;

/** Validade do alerta de watchlist, em dias. */
export const WATCHLIST_ALERT_DAYS = 5;

/** Validade em milissegundos (derivada). */
export const WATCHLIST_ALERT_MS = WATCHLIST_ALERT_DAYS * 24 * 60 * 60 * 1000;

/** Simulador "Máquina do Tempo": simulações grátis por dia (dia UTC). */
export const SIMULATOR_FREE_PER_DAY = 3;

/** Custo, em créditos, de cada simulação além da cota grátis diária. */
export const SIMULATOR_CREDIT_COST = 1;

/** Custo, em créditos, de cada pergunta ao Conselho de Guerra (chat pós-análise). */
export const WAR_COUNCIL_COST = 1;
