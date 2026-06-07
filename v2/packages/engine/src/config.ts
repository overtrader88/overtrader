/**
 * Configuração do motor — TODOS os parâmetros num único lugar versionado.
 *
 * Princípio de design (blueprint §1): ZERO parâmetro mágico espalhado pelo código.
 * Cada número que afeta uma decisão de trading vive aqui, documentado.
 *
 * ⚠️ M0 (scaffold): os valores abaixo são os HERDADOS DO v1 e estão marcados como
 * NÃO CALIBRADOS. Eles existem para definir a ESTRUTURA do config — a calibração
 * empírica (estudo de sensibilidade + backtest) acontece no M1/M2. Não trate
 * nenhum número aqui como final.
 */
import type { AssetType } from "@tradeai/shared";

export interface EngineConfig {
  /** Mínimo de candles para rodar análise confiável. */
  minCandles: number;

  /** Pesos por categoria de indicador na votação. [NÃO CALIBRADO] */
  categoryWeights: Record<string, number>;

  /** Multiplicadores de peso por regime de mercado. [NÃO CALIBRADO] */
  regimeMultipliers: {
    trending: { trend: number; meanReversion: number };
    ranging: { trend: number; meanReversion: number };
    explosive: { trend: number; meanReversion: number };
    transitional: { trend: number; meanReversion: number };
  };

  /** Thresholds de classificação de regime. [NÃO CALIBRADO] */
  regime: {
    adxTrending: number;
    adxRanging: number;
    atrExplosiveRatio: number;
  };

  /** Multiplicadores de ATR para níveis de risco. [NÃO CALIBRADO] */
  risk: {
    slMult: number;
    tp1Mult: number;
    tp2Mult: number;
    tp3Mult: number;
  };

  /** Estratégia de sinal. [NÃO CALIBRADO] */
  signal: {
    /**
     * Quando true, usa estratégia CONDICIONAL por regime: trend-following em
     * trending, mean-reversion (fade de extremos) em ranging, NEUTRAL nos demais.
     * Quando false, usa a votação ponderada dos 20 indicadores (default histórico).
     */
    conditionalByRegime: boolean;
    /** Limiares de mean-reversion no modo condicional (ranging). */
    mrOversold: number;
    mrOverbought: number;
    /** ADX a partir do qual a tendência é "forte" (trending → STRONG). */
    strongAdx: number;
    /** Filtros de confluência (confirmações) sobre o sinal condicional. */
    filters: {
      /** Lado deve concordar com preço vs EMA200 (não brigar com a tendência de fundo). */
      macroAlign: boolean;
      /** Inclinação do OBV deve estar na direção do trade. */
      volumeConfirm: boolean;
      /** Mínimo de checks concordando p/ o lado vencedor (precisão; 1 = sem filtro). */
      minAgree: number;
    };
  };

  /** Thresholds dos gates de qualidade. [NÃO CALIBRADO] */
  gates: {
    minConfluence: number;
    minAdx: number;
    minRr1: number;
    minStrength: number;
    /** Bandwidth mínimo de Bollinger p/ "volatilidade ativa". */
    minBandwidth: number;
  };

  /**
   * Thresholds que convertem valor de indicador → voto BUY/SELL/NEUTRAL.
   * No v1 estavam hardcoded no cálculo; aqui ficam explícitos. [NÃO CALIBRADO]
   */
  voteThresholds: {
    rsi: { buyAbove: number; sellBelow: number; overbought: number; oversold: number };
    mfi: { buyAbove: number; sellBelow: number };
    cci: { buyAbove: number; sellBelow: number };
    williamsR: { overbought: number; oversold: number };
    stoch: { overbought: number; oversold: number };
    cmf: { buyAbove: number; sellBelow: number };
    obvSlope: { buyAbove: number; sellBelow: number };
    /** ADX mínimo para o indicador ADX emitir voto direcional. */
    adxDirectional: number;
  };

  // ===== Camadas probabilísticas (M2) — [NÃO CALIBRADO] =====

  /** Monte Carlo: nº de simulações, horizonte (candles) e seed determinística. */
  monteCarlo: { simulations: number; horizon: number; seed: number };

  /** Cenários compra/venda: horizonte, simulações e seed. */
  scenarios: { horizon: number; simulations: number; seed: number };

  /** Sazonalidade: amostra mínima p/ veredito; janela recente opcional. */
  seasonality: { minSampleSize: number; recentYears?: number };

  /** Backtest: janela e regras de simulação. */
  backtest: {
    minCandlesForEngine: number;
    maxTradeDuration: number;
    cooldown: number;
    partialExitFraction: number;
    /** Teto de calendário (meses) para ativos voláteis (cripto/commodities). */
    targetMonths: number;
    /** Teto de calendário (meses) para ativos mais estacionários (forex/ações/índices). */
    targetMonthsStationary: number;
    /** Teto de calendário (meses) p/ timeframes de baixa frequência (1d/1w/1M), que
     *  precisam de mais tempo para acumular trades decisivos suficientes. */
    targetMonthsLowFreq: number;
    /** Alvo de trades DECISIVOS (win+SL) p/ amostra suficiente — janela dirigida por amostra. */
    minDecisiveTrades: number;
    /** Fração final dos trades reservada para teste out-of-sample. */
    oosFraction: number;
    seed: number;
  };

  /** Selo de qualidade: limiares (aplicados aos limites inferiores do IC no verde). */
  qualityBanner: {
    pfGreen: number;
    wrGreen: number;
    tp1Green: number;
    pfRed: number;
    wrRed: number;
    tp1Red: number;
  };

  // ===== Camadas qualitativas (M3) — [NÃO CALIBRADO] =====

  /** Smart Money Concepts. */
  smc: {
    minCandles: number;
    swingLookback: number;
    impulseLookahead: number;
    impulseAtrMult: number;
    obStrengthAtrMult: number;
    clusterAtrMult: number;
    biasThreshold: number;
    maxBlocks: number;
    maxFvgs: number;
    maxZones: number;
    /** Distância máx. (fração do preço atual) p/ uma zona de liquidez ser RELEVANTE.
     *  Evita surfacing de swings ancestrais (ex.: fundo de anos atrás, ~90% longe). */
    maxDistPct: number;
  };

  /** Padrões harmônicos. Tolerância endurecida vs v1 (0.08 → 0.04). */
  harmonics: {
    minCandles: number;
    swingLookback: number;
    tolerance: number;
    abWeight: number;
    maxScan: number;
    maxPatterns: number;
  };

  /** WEGD (Wyckoff/Elliott/Gann/Dow). */
  wegd: {
    minCandles: number;
    swingLookback: number;
    gannSwingLookback: number;
    gannAtrPeriod: number;
    wyckoffRangePct: number;
    wyckoffTrendSlope: number;
    wyckoffVolRatio: number;
  };

  /** Confluência multi-timeframe (combinador puro). [NÃO CALIBRADO] */
  multiTimeframe: {
    higherWeight: number;
    highestWeight: number;
    /** Pontos descontados por TF contraditório. */
    opposingPenalty: number;
    fullyAlignedMin: number;
    partiallyAlignedMin: number;
  };

  /**
   * Custos de transação (basis points POR LADO), aplicados no backtest. Convertidos
   * para R via preço/risco — penaliza corretamente stops apertados e alta frequência.
   * [NÃO CALIBRADO] — ajustar à corretora/spread real de cada mercado.
   */
  costs: {
    /** Fallback quando o assetType não está em `byAsset`. */
    perSideBps: number;
    byAsset: Partial<Record<AssetType, number>>;
  };
}

/**
 * Default herdado do v1. Marcado [NÃO CALIBRADO] — a calibração entra no M1/M2.
 */
export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  minCandles: 60,
  categoryWeights: {
    "Tendência": 1.5,
    "Médias Móveis": 1.2,
    "Osciladores": 1.0,
    "Volatilidade": 0.8,
    "Volume": 0.8,
  },
  regimeMultipliers: {
    trending: { trend: 1.3, meanReversion: 0.5 },
    ranging: { trend: 0.6, meanReversion: 1.4 },
    explosive: { trend: 0.8, meanReversion: 0.3 },
    transitional: { trend: 1.0, meanReversion: 1.0 },
  },
  regime: {
    adxTrending: 25,
    adxRanging: 20,
    atrExplosiveRatio: 2.0,
  },
  risk: {
    slMult: 1.2,
    tp1Mult: 1.8,
    tp2Mult: 3.0,
    tp3Mult: 4.5,
  },
  signal: {
    conditionalByRegime: false,
    mrOversold: 35,
    mrOverbought: 65,
    strongAdx: 30,
    filters: { macroAlign: false, volumeConfirm: false, minAgree: 1 },
  },
  gates: {
    minConfluence: 6,
    minAdx: 20,
    minRr1: 1.5,
    minStrength: 50,
    minBandwidth: 0.01,
  },
  voteThresholds: {
    rsi: { buyAbove: 60, sellBelow: 40, overbought: 70, oversold: 30 },
    mfi: { buyAbove: 60, sellBelow: 40 },
    cci: { buyAbove: 100, sellBelow: -100 },
    williamsR: { overbought: -20, oversold: -80 },
    stoch: { overbought: 80, oversold: 20 },
    cmf: { buyAbove: 0.05, sellBelow: -0.05 },
    obvSlope: { buyAbove: 5, sellBelow: -5 },
    adxDirectional: 25,
  },
  monteCarlo: { simulations: 5000, horizon: 20, seed: 12345 },
  scenarios: { horizon: 30, simulations: 5000, seed: 12345 },
  seasonality: { minSampleSize: 5 },
  backtest: {
    minCandlesForEngine: 200,
    maxTradeDuration: 50,
    cooldown: 5,
    partialExitFraction: 0.5,
    targetMonths: 24,
    targetMonthsStationary: 36,
    targetMonthsLowFreq: 72,
    minDecisiveTrades: 100,
    oosFraction: 0.3,
    seed: 12345,
  },
  qualityBanner: {
    pfGreen: 1.5,
    wrGreen: 0.5,
    tp1Green: 0.55,
    pfRed: 1.0,
    wrRed: 0.4,
    tp1Red: 0.4,
  },
  smc: {
    minCandles: 50,
    swingLookback: 3,
    impulseLookahead: 5,
    impulseAtrMult: 2,
    obStrengthAtrMult: 25,
    clusterAtrMult: 0.5,
    biasThreshold: 1.3,
    maxBlocks: 5,
    maxFvgs: 8,
    maxZones: 5,
    maxDistPct: 0.4,
  },
  harmonics: {
    minCandles: 60,
    swingLookback: 3,
    tolerance: 0.04,
    abWeight: 0.6,
    maxScan: 12,
    maxPatterns: 5,
  },
  wegd: {
    minCandles: 50,
    swingLookback: 3,
    gannSwingLookback: 5,
    gannAtrPeriod: 14,
    wyckoffRangePct: 8,
    wyckoffTrendSlope: 0.05,
    wyckoffVolRatio: 1.2,
  },
  multiTimeframe: {
    higherWeight: 1.3,
    highestWeight: 1.5,
    opposingPenalty: 10,
    fullyAlignedMin: 90,
    partiallyAlignedMin: 60,
  },
  costs: {
    perSideBps: 5,
    // taker fee + spread típicos por classe (retail): cripto alto, forex baixo.
    byAsset: { crypto: 7.5, forex: 1, stocks: 2, indices: 2, commodities: 3 },
  },
};
