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
  versionNumber: number | null;
  versionName: string | null;
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

export interface ParsedSongDetailScore {
  achievementRate: number | null;
  dxScore: number;
  maxDxScore: number;
}

export interface ParsedPlaylogScore {
  achievementRate: number | null;
  difficulty: Difficulty;
  difficultyLabel: string;
  dxScore: number;
  kind: SongKind;
  maxDxScore: number;
  playedAt: string;
  title: string;
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

  return {
    officialIdx,
    jacketUrl: findFirstJacketUrl(html, $),
  };
}

export function parsePlaylogHtml(html: string): ParsedPlaylogScore[] {
  const $ = cheerio.load(html);
  const playlogs: ParsedPlaylogScore[] = [];

  for (const node of $(".playlog_top_container").toArray()) {
    const root = $(node).closest(".p_10.t_l.f_0.v_b");
    if (root.length === 0) {
      continue;
    }

    const difficulty = parsePlaylogDifficulty(
      root.find(".playlog_diff").first().attr("src"),
    );
    if (difficulty === null) {
      continue;
    }

    const content = root.find(".playlog_master_container, .playlog_remaster_container").first();
    const title = extractPlaylogTitle(content);
    const playedAt = parsePlaylogPlayedAt(
      root.find(".playlog_top_container .sub_title span").last().text(),
    );
    const kind = parseSongKind(root.find(".playlog_music_kind_icon").first().attr("src"));
    const achievementRate = parseAchievement(
      root.find(".playlog_achievement_txt").first().text(),
    );
    const [dxScore, maxDxScore] = parseDxScorePair(
      root.find(".playlog_score_block").first().text(),
    );

    if (!title || !playedAt || maxDxScore === null) {
      continue;
    }

    playlogs.push({
      achievementRate,
      difficulty,
      difficultyLabel: getDifficultyLabel(difficulty),
      dxScore,
      kind,
      maxDxScore,
      playedAt,
      title,
    });
  }

  return playlogs;
}

export function parseSongScoreHtml(
  html: string,
  difficulty: Difficulty,
  options: {
    includeNoRecord?: boolean;
    versionNumber?: number | null;
    versionName?: string | null;
  } = {},
): ParsedSongScore[] {
  const $ = cheerio.load(html);
  const scores: ParsedSongScore[] = [];
  const scoreBlockSelector = getScoreBlockSelector(difficulty);
  const scoreNodes = $(scoreBlockSelector).toArray();
  const catalogFormNodes = $(
    [
      "body > div.wrapper.main_wrapper.t_c.o_v > div:nth-child(7) > form",
      "body > div.wrapper.main_wrapper.t_c.o_v > div:nth-child(8) > div > form",
      "body > div.wrapper.main_wrapper.t_c.o_v > div:nth-child(9) > form",
      'form[action*="/record/musicDetail/"]',
    ].join(", "),
  ).toArray();
  const nodes =
    options.includeNoRecord
      ? uniqueNodes([...scoreNodes, ...catalogFormNodes])
      : scoreNodes.length > 0
      ? scoreNodes
      : $(
          "body > div.wrapper.main_wrapper.t_c.o_v > div:nth-child(8) > div > form",
        ).toArray();
  const seenScores = new Set<string>();

  for (const node of nodes) {
    const root = $(node);
    const form = root.is("form") ? root : root.find("form").first();
    const scope = form.length > 0 ? form : root;
    const container = root.closest(".w_450");
    const containerScope = container.length > 0 ? container : scope;
    const title = normalizeText(scope.find(".music_name_block").first().text());
    const level = normalizeText(scope.find(".music_lv_block").first().text());
    const scoreBlocks = scope.find(".music_score_block");
    const achievementRate = parseAchievement(scoreBlocks.eq(0).text());
    const dxScoreText = scoreBlocks.eq(1).text();
    const [dxScore, maxDxScore, isNoRecord] = parseDxScorePair(dxScoreText);
    const kind = parseSongKind(containerScope.find(".music_kind_icon").attr("src"));
    const officialIdx =
      scope.find('input[type="hidden"][name="idx"]').attr("value") ?? null;
    const genre = findGenre($, containerScope);
    const jacketUrl = findJacketUrl(containerScope);
    const resolvedMaxDxScore =
      maxDxScore ?? (options.includeNoRecord && scoreBlocks.length === 0 ? 0 : null);
    const scoreKey = officialIdx ?? `${title}|${difficulty}`;

    if (
      !title ||
      !level ||
      resolvedMaxDxScore === null ||
      (isNoRecord && !options.includeNoRecord)
    ) {
      continue;
    }

    if (seenScores.has(scoreKey)) {
      continue;
    }
    seenScores.add(scoreKey);

    scores.push({
      title,
      difficulty,
      difficultyLabel: getDifficultyLabel(difficulty),
      level,
      kind,
      versionNumber: options.versionNumber ?? null,
      versionName: options.versionName ?? null,
      achievementRate,
      dxScore,
      maxDxScore: resolvedMaxDxScore,
      officialIdx,
      genre,
      jacketUrl,
    });
  }

  return scores;
}

function uniqueNodes(nodes: AnyNode[]): AnyNode[] {
  const seen = new Set<AnyNode>();
  return nodes.filter((node) => {
    if (seen.has(node)) {
      return false;
    }
    seen.add(node);
    return true;
  });
}

export function parseSongDetailScoreHtml(
  html: string,
  difficulty: Difficulty,
): ParsedSongDetailScore | null {
  const $ = cheerio.load(html);
  const rootSelector = getDetailDifficultySelector(difficulty);
  const achievementText = $(`${rootSelector} > div.t_l > div.music_score_block.w_120.d_ib.t_r.f_12`)
    .first()
    .text();
  const detailScoreText = $(
    `${rootSelector} > div.t_l > div.music_score_block.w_310.m_r_0.d_ib.t_r.f_12`,
  )
    .first()
    .text();
  const fallbackScoreText = $(`${rootSelector} .music_score_block`)
    .toArray()
    .map((block) => $(block).text())
    .find((text) => normalizeText(text).includes("/"));
  const [dxScore, maxDxScore] = parseDxScorePair(
    detailScoreText || fallbackScoreText || "",
  );

  return maxDxScore === null
    ? null
    : {
        achievementRate: parseAchievement(achievementText),
        dxScore,
        maxDxScore,
      };
}

function getScoreBlockSelector(difficulty: Difficulty): string {
  const classNames: Record<Difficulty, string> = {
    0: ".music_basic_score_back",
    1: ".music_advanced_score_back",
    2: ".music_expert_score_back",
    3: ".music_master_score_back",
    4: ".music_remaster_score_back",
  };

  return classNames[difficulty];
}

function getDetailDifficultySelector(difficulty: Difficulty): string {
  const selectors: Record<Difficulty, string> = {
    0: "#basic",
    1: "#advanced",
    2: "#expert",
    3: "#master",
    4: "#remaster",
  };

  return selectors[difficulty];
}

function parsePlaylogDifficulty(src: string | undefined): Difficulty | null {
  if (src?.includes("diff_master.png")) {
    return 3;
  }

  if (src?.includes("diff_remaster.png")) {
    return 4;
  }

  return null;
}

function extractPlaylogTitle(content: cheerio.Cheerio<AnyNode>): string {
  const titleBlock = content
    .find(".basic_block.m_5.m_t_17.m_r_60.p_5.p_l_10.f_13.break")
    .first()
    .clone();
  titleBlock.find(".w_80, .music_lv_back").remove();
  return normalizeText(titleBlock.text());
}

function parsePlaylogPlayedAt(value: string): string | null {
  const normalized = normalizeText(value);
  const match = normalized.match(
    /(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})/,
  );

  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00+09:00`;
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

function findFirstJacketUrl(html: string, $: cheerio.CheerioAPI): string | null {
  const imageSource = $("img")
    .toArray()
    .map((image) => $(image).attr("src"))
    .find((src) => src?.includes("/Music/") || src?.includes("img/Music/"));
  return normalizeJacketUrl(imageSource) ?? normalizeJacketUrl(html);
}

function normalizeJacketUrl(imageSource: string | undefined): string | null {
  if (!imageSource) {
    return null;
  }

  const normalized = imageSource.replace(/\\\//g, "/");
  const match = normalized.match(/(?:^|\/)(?:maimai-mobile\/)?img\/Music\/([^/?#"' )]+\.png)/i);
  if (match) {
    return `https://maimaidx-eng.com/maimai-mobile/img/Music/${match[1]}`;
  }

  const shortMatch = normalized.match(/(?:^|\/)Music\/([^/?#"' )]+\.png)/i);
  return shortMatch
    ? `https://maimaidx-eng.com/maimai-mobile/img/Music/${shortMatch[1]}`
    : null;
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

function parseDxScorePair(value: string): [number, number | null, boolean] {
  const normalized = normalizeText(value);
  const match = normalized.match(/([\d,]+)\s*\/\s*([\d,]+)/);
  const noRecordMatch = normalized.match(/(?:-|―|－|未プレイ|NO PLAY)\s*\/\s*([\d,]+)/i);
  if (!match) {
    return noRecordMatch ? [0, parseInteger(noRecordMatch[1]), true] : [0, null, false];
  }

  return [parseInteger(match[1]), parseInteger(match[2]), false];
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
