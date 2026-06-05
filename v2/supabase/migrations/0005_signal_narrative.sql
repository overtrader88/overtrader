-- =====================================================================
-- TradeAI/Overtrader v2 — Narrativa do sinal (Fase D1, monitor ao vivo).
-- A leitura da IA é gerada UMA vez na emissão do sinal e guardada aqui, para o
-- monitor ao vivo exibir o sinal de qualidade já com a narrativa — sem gerar
-- texto a cada atualização (nada de "tagarelice" de IA por poll).
-- =====================================================================

alter table signals add column narrative text;
