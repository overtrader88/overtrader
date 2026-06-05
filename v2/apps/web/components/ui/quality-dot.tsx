export type Seal = "green" | "amber" | "red" | "gray";

const TITLES: Record<Seal, string> = {
  green: "Selo verde · robusto no pior caso do IC",
  amber: "Selo âmbar · na borda do limiar",
  red: "Selo vermelho · não recomendado",
  gray: "Amostra insuficiente",
};

/** Indicador de qualidade (selo do backtest) como ponto colorido. */
export function QualityDot({ seal }: { seal: Seal }) {
  return <span className={`qdot ${seal}`} title={TITLES[seal]} />;
}
