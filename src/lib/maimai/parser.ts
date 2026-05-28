import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

import {
  type Difficulty,
  getDifficultyLabel,
  type SongKind,
} from "@/lib/maimai/constants";

export interface ParsedPlayerData {
  name: string;
  rating: number | null;
  trophy: string | null;
  currentVersionPlayCount: number | null;
  totalPlayCount: number | null;
}

export interface ParsedSongScore {
  title: string;
  difficulty: Difficulty;
  difficultyLabel: string;
  level: string;
  kind: SongKind;
  achievementRate: number | null;
  dxScore: number;
  maxDxScore: number;
  officialIdx: string | null;
  genre: string | null;
  jacketUrl: string | null;
}

export interface ParsedSongDetail {
  officialIdx: string;
  jacketUrl: string | null;
}

export function parsePlayerDataHtml(html: string): ParsedPlayerData {
  const $ = cheerio.load(html);
  const name = normalizeText($(".name_block").first().text());
  const trophy = nullableText($(".trophy_inner_block span").first().text());
  const rating = parseNullableInteger($(".rating_block").first().text());
  const playCountText = normalizeText($(".m_5.m_b_5.t_r.f_12").first().text());

  return {
    name,
    rating,
    trophy,
    currentVersionPlayCount: extractCount(
      playCountText,
      /play count of current version：([\d,]+)/,
    ),
    totalPlayCount: extractCount(
      playCountText,
      /maimaiDX total play count：([\d,]+)/,
    ),
  };
}

export function parseSongDetailHtml(
  html: string,
  officialIdx: string,
): ParsedSongDetail {
  const $ = cheerio.load(html);
  const imageSource = $("img")
    .toArray()
    .map((image) => $(image).attr("src"))
    .find((src) => src?.includes("/Music/") || src?.includes("img/Music/"));

  return {
    officialIdx,
    jacketUrl: normalizeJacketUrl(imageSource),
  };
}

export function parseSongScoreHtml(
  html: string,
  difficulty: Difficulty,
): ParsedSongScore[] {
  const $ = cheerio.load(html);
  const scores: ParsedSongScore[] = [];

  $(".music_master_score_back").each((_, block) => {
    const container = $(block).closest(".w_450");
    const title = normalizeText($(block).find(".music_name_block").first().text());
    const level = normalizeText($(block).find(".music_lv_block").first().text());
    const scoreBlocks = $(block).find(".music_score_block");
    const achievementRate = parseAchievement(scoreBlocks.eq(0).text());
    const dxScoreText = scoreBlocks.eq(1).text();
    const [dxScore, maxDxScore] = parseDxScorePair(dxScoreText);
    const kind = parseSongKind(container.find(".music_kind_icon").attr("src"));
    const officialIdx =
      $(block).find('input[type="hidden"][name="idx"]').attr("value") ?? null;
    const genre = findGenre($, container);
    const jacketUrl = findJacketUrl(container);

    if (!title || !level || maxDxScore === null) {
      return;
    }

    scores.push({
      title,
      difficulty,
      difficultyLabel: getDifficultyLabel(difficulty),
      level,
      kind,
      achievementRate,
      dxScore,
      maxDxScore,
      officialIdx,
      genre,
      jacketUrl,
    });
  });

  return scores;
}

function findJacketUrl(container: cheerio.Cheerio<AnyNode>): string | null {
  const imageSource = container
    .find("img")
    .toArray()
    .map((image) => container.find(image).attr("src"))
    .find((src) => src?.includes("/Music/") || src?.includes("img/Music/"));

  if (!imageSource) {
    return null;
  }

  return normalizeJacketUrl(imageSource);
}

function normalizeJacketUrl(imageSource: string | undefined): string | null {
  if (!imageSource) {
    return null;
  }

  const match = imageSource.match(/(?:^|\/)(?:img\/)?Music\/([^/?#]+\.png)/);
  return match ? `https://maimaidx-eng.com/maimai-mobile/img/Music/${match[1]}` : null;
}

function findGenre(
  $: cheerio.CheerioAPI,
  container: cheerio.Cheerio<AnyNode>,
): string | null {
  let cursor = container.prev();

  while (cursor.length > 0) {
    if (cursor.hasClass("screw_block")) {
      return nullableText(cursor.text());
    }
    cursor = cursor.prev();
  }

  return null;
}

function parseSongKind(src: string | undefined): SongKind {
  if (src?.includes("music_standard.png")) {
    return "STANDARD";
  }

  return "DX";
}

function parseAchievement(value: string): number | null {
  const cleaned = normalizeText(value).replace("%", "");
  return parseNullableFloat(cleaned);
}

function parseDxScorePair(value: string): [number, number | null] {
  const match = normalizeText(value).match(/([\d,]+)\s*\/\s*([\d,]+)/);
  if (!match) {
    return [0, null];
  }

  return [parseInteger(match[1]), parseInteger(match[2])];
}

function extractCount(value: string, pattern: RegExp): number | null {
  const match = value.match(pattern);
  return match ? parseInteger(match[1]) : null;
}

function parseNullableInteger(value: string): number | null {
  const normalized = normalizeText(value);
  return normalized ? parseInteger(normalized) : null;
}

function parseNullableFloat(value: string): number | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseFloat(normalized.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: string): number {
  return Number.parseInt(value.replace(/,/g, ""), 10);
}

function nullableText(value: string): string | null {
  const normalized = normalizeText(value);
  return normalized ? normalized : null;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
