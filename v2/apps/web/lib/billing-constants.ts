/** Constantes de cobrança compartilhadas entre servidor e cliente.
 *  Arquivo PURO (sem imports server-only) p/ poder ser usado no browser. */

/** Custo, em créditos, de criar/renovar um alerta de watchlist (por ativo + TF + lado). */
export const WATCHLIST_ALERT_COST = 15;

/** Validade do alerta de watchlist, em dias. */
export const WATCHLIST_ALERT_DAYS = 5;

/** Validade em milissegundos (derivada). */
export const WATCHLIST_ALERT_MS = WATCHLIST_ALERT_DAYS * 24 * 60 * 60 * 1000;
