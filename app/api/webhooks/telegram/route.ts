/**
 * POST /api/webhooks/telegram
 *
 * Webhook do bot Telegram. Lida com:
 *   /start <token>          — vincula chat ao usuario
 *   /start                  — boas vindas + instrucoes
 *   /help                   — lista de comandos
 *   /analise <ASSET> [TF]   — roda analise leve, devolve resumo
 *   /<asset> [tf]           — atalho (ex: /btc 1h)
 *   /watchlist              — lista watchlist do usuario
 *   /desvincular            — desconecta o chat
 *
 * Seguranca: valida X-Telegram-Bot-Api-Secret-Token (configurado no setWebhook).
 */
import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import {
  sendTelegramMessage,
  escapeMarkdownV2,
} from "@/lib/telegram/client";
import { getAsset, getCandles } from "@/lib/market";
import { runAnalysis } from "@/lib/analysis/engine";
import {
  signalLabel,
  signalSide,
  hasDirection,
} from "@/lib/analysis/signal-utils";
import type { SignalDirection, AnalysisResult } from "@/lib/analysis/types";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string };
    chat: { id: number; type: string };
    text?: string;
  };
}

const VALID_TIMEFRAMES = ["15m", "1h", "4h", "1d", "1w", "1M"];

export async function POST(req: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const provided = req.headers.get("x-telegram-bot-api-secret-token");
    if (provided !== expectedSecret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const msg = update.message;
  if (!msg || !msg.text || !msg.from) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const chatId = String(msg.chat.id);
  const text = msg.text.trim();
  const username = msg.from.username;

  // Resolve user_id pelo chat_id (se ja parou)
  const supabase = createServiceClient();
  const { data: link } = await supabase
    .from("telegram_links")
    .select("user_id, paired_at")
    .eq("chat_id", chatId)
    .maybeSingle();

  const isLinked = link?.paired_at != null;
  const linkedUserId = isLinked ? link!.user_id : null;

  // ============================================================
  // /start [token]
  // ============================================================
  if (text.startsWith("/start")) {
    const parts = text.split(/\s+/);
    const pairToken = parts[1];

    if (pairToken) {
      // Tenta vincular
      const { data: pending } = await supabase
        .from("telegram_links")
        .select("id, user_id, pair_token_expires_at")
        .eq("pair_token", pairToken)
        .maybeSingle();

      if (!pending) {
        await sendTelegramMessage(
          chatId,
          "Token invalido. Gere um novo no site em Alertas > Telegram."
        );
        return NextResponse.json({ ok: true });
      }

      if (
        pending.pair_token_expires_at &&
        new Date(pending.pair_token_expires_at).getTime() < Date.now()
      ) {
        await sendTelegramMessage(
          chatId,
          "Token expirado. Gere um novo (validade 15 minutos)."
        );
        return NextResponse.json({ ok: true });
      }

      await supabase
        .from("telegram_links")
        .update({
          chat_id: chatId,
          username,
          paired_at: new Date().toISOString(),
          pair_token: null,
          pair_token_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pending.id);

      await sendTelegramMessage(
        chatId,
        `Vinculado com sucesso!\n\nAgora voce pode mandar comandos como:\n/btc 1h\n/eth 4h\n/xauusd 1d\n\nUse /help para ver tudo.`
      );
      return NextResponse.json({ ok: true });
    }

    // /start sem token
    await sendTelegramMessage(
      chatId,
      `Ola! Sou o bot do TradingAI.\n\nPara comecar:\n1) Acesse o site -> Alertas -> Telegram\n2) Copie o token gerado\n3) Mande /start <SEU_TOKEN>\n\nDepois disso, podera consultar analises por /asset.`
    );
    return NextResponse.json({ ok: true });
  }

  // ============================================================
  // /help
  // ============================================================
  if (text === "/help") {
    await sendTelegramMessage(
      chatId,
      `Comandos disponiveis:\n\n/btc 1h — analise do BTC em 1h (qualquer ativo do catalogo + timeframe)\n/eth 4h\n/xauusd 1d\n/watchlist — lista sua watchlist\n/desvincular — remove o vinculo\n/help — este menu\n\nTimeframes: 15m, 1h, 4h, 1d, 1w, 1M`
    );
    return NextResponse.json({ ok: true });
  }

  // ============================================================
  // /desvincular
  // ============================================================
  if (text === "/desvincular") {
    if (!isLinked) {
      await sendTelegramMessage(chatId, "Este chat nao esta vinculado.");
      return NextResponse.json({ ok: true });
    }
    await supabase.from("telegram_links").delete().eq("chat_id", chatId);
    await sendTelegramMessage(chatId, "Vinculo removido.");
    return NextResponse.json({ ok: true });
  }

  // Comandos a seguir exigem vinculo
  if (!isLinked) {
    await sendTelegramMessage(
      chatId,
      "Voce precisa vincular sua conta primeiro. Va em Alertas > Telegram no site e siga as instrucoes."
    );
    return NextResponse.json({ ok: true });
  }

  // ============================================================
  // /watchlist
  // ============================================================
  if (text === "/watchlist") {
    const { data: items } = await supabase
      .from("watchlist")
      .select("asset, timeframe, min_signal_strength")
      .eq("user_id", linkedUserId!)
      .order("created_at", { ascending: false });

    if (!items || items.length === 0) {
      await sendTelegramMessage(
        chatId,
        "Sua watchlist esta vazia. Adicione ativos no site (menu Alertas)."
      );
      return NextResponse.json({ ok: true });
    }

    const lines = items
      .slice(0, 20)
      .map(
        (i, idx) =>
          `${idx + 1}. ${i.asset} ${i.timeframe} (min: ${i.min_signal_strength})`
      )
      .join("\n");
    await sendTelegramMessage(
      chatId,
      `Sua watchlist (${items.length} ativos):\n\n${lines}`
    );
    return NextResponse.json({ ok: true });
  }

  // ============================================================
  // /analise <asset> [tf]  OU  /<asset> [tf]
  // ============================================================
  const cmd = text.toLowerCase().replace(/^\//, "").split(/\s+/);
  const rawAsset = cmd[0] === "analise" ? cmd[1] : cmd[0];
  const rawTf = cmd[0] === "analise" ? cmd[2] : cmd[1];

  if (!rawAsset) {
    await sendTelegramMessage(
      chatId,
      "Comando nao reconhecido. Use /help para ver opcoes."
    );
    return NextResponse.json({ ok: true });
  }

  // Normaliza o asset (case-insensitive). Tenta com USDT pra cripto.
  const candidates = [
    rawAsset.toUpperCase(),
    `${rawAsset.toUpperCase()}USDT`,
    `${rawAsset.toUpperCase()}USD`,
  ];

  let asset: { symbol: string; type: "crypto" | "forex" | "stocks" | "indices" | "commodities" } | null = null;
  for (const candidate of candidates) {
    const found = getAsset(candidate);
    if (found) {
      asset = { symbol: found.symbol, type: found.type };
      break;
    }
  }

  if (!asset) {
    await sendTelegramMessage(
      chatId,
      `Ativo "${rawAsset}" nao encontrado no catalogo. Exemplos: BTC, ETH, XAUUSD, EURUSD, AAPL.`
    );
    return NextResponse.json({ ok: true });
  }

  const timeframe = (rawTf && VALID_TIMEFRAMES.includes(rawTf))
    ? rawTf
    : "1h";

  try {
    const candles = await getCandles(
      asset.symbol,
      timeframe as "15m" | "1h" | "4h" | "1d" | "1w" | "1M",
      250
    );
    if (candles.length < 60) {
      await sendTelegramMessage(
        chatId,
        `Dados insuficientes para ${asset.symbol} ${timeframe}.`
      );
      return NextResponse.json({ ok: true });
    }

    const result = runAnalysis({
      symbol: asset.symbol,
      assetType: asset.type,
      timeframe: timeframe as "15m" | "1h" | "4h" | "1d" | "1w" | "1M",
      candles,
    });

    const reply = formatAnalysisReply(result, asset.symbol, timeframe);
    await sendTelegramMessage(chatId, reply, {
      parseMode: "MarkdownV2",
      disableWebPreview: true,
    });
  } catch (err) {
    console.error("[telegram] erro na analise:", err);
    await sendTelegramMessage(
      chatId,
      `Erro ao analisar ${asset.symbol} ${timeframe}: ${err instanceof Error ? err.message : "tente novamente"}`
    );
  }

  return NextResponse.json({ ok: true });
}

// Aceita GET para health check
export async function GET() {
  return NextResponse.json({ ok: true, bot: "tradingai", version: 1 });
}

// ============================================================
// Formata resposta de analise pra Markdown V2
// ============================================================

function formatAnalysisReply(
  result: AnalysisResult,
  asset: string,
  timeframe: string
): string {
  const sig = result.signal.signal as SignalDirection;
  const sigLabel = signalLabel(sig);
  const side = signalSide(sig);

  const passedGates = result.gates.filter((g) => g.passed).length;
  const totalGates = result.gates.length;

  const lines: string[] = [];
  lines.push(
    `*${escapeMarkdownV2(asset)}* ${escapeMarkdownV2(timeframe)}`
  );
  lines.push(``);

  // Indicador visual do sinal
  const emoji = sigEmoji(sig);
  lines.push(`${emoji} *${escapeMarkdownV2(sigLabel)}*`);
  lines.push(
    `Forca: ${result.signal.strength}/100 \\| Confluencia: ${result.signal.confluence}/10`
  );
  lines.push(`Filtros: ${passedGates}/${totalGates} aprovados`);

  if (hasDirection(sig)) {
    lines.push(``);
    lines.push(`Entrada: \`${result.risk.entry.toFixed(2)}\``);
    lines.push(`Stop: \`${result.risk.stopLoss.toFixed(2)}\``);
    lines.push(
      `TP1: \`${result.risk.takeProfit1.toFixed(2)}\` \\(R:R ${result.risk.rr1.toFixed(2)}\\)`
    );
  }

  if (result.meta.regime) {
    lines.push(``);
    lines.push(
      `Regime: _${escapeMarkdownV2(result.meta.regime)}_${
        result.meta.adxValue
          ? ` \\(ADX ${result.meta.adxValue.toFixed(1)}\\)`
          : ""
      }`
    );
  }

  lines.push(``);
  lines.push(
    `_Analise informativa\\. Nao constitui recomendacao personalizada\\._`
  );

  return lines.join("\n");
}

function sigEmoji(sig: SignalDirection): string {
  switch (sig) {
    case "STRONG_BUY":
      return "🟢🟢";
    case "BUY":
      return "🟢";
    case "WEAK_BUY":
      return "🟡";
    case "NEUTRAL":
      return "⚪";
    case "WEAK_SELL":
      return "🟠";
    case "SELL":
      return "🔴";
    case "STRONG_SELL":
      return "🔴🔴";
  }
}
