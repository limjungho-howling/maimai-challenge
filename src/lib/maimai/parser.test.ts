import { describe, expect, it } from "vitest";

import {
  parseSongDetailHtml,
  parseSongDetailScoreHtml,
  parsePlayerDataHtml,
  parseSongScoreHtml,
} from "@/lib/maimai/parser";

const playerHtml = `
<div class="basic_block p_10 f_0">
  <div class="trophy_block"><div class="trophy_inner_block f_13"><span>ナツ 推し</span></div></div>
  <div class="name_block f_l f_16">Ｅ．ＨＯＷＬ</div>
  <div class="rating_block">16598</div>
  <div class="m_5 m_b_5 t_r f_12">play count of current version：1,281<br>maimaiDX total play count：7,546</div>
</div>`;

const songScoreHtml = `
<div class="screw_block m_15 f_15 p_s">POPS＆ANIME</div>
<div class="w_450 m_15 p_r f_0">
  <img src="https://maimaidx-eng.com/maimai-mobile/img/Music/000001.png" class="music_jacket">
  <div class="music_master_score_back pointer p_3">
    <form action="https://maimaidx-eng.com/maimai-mobile/record/musicDetail/" method="get">
      <img src="./files/diff_master.png" class="h_20 f_l">
      <div class="clearfix"></div>
      <div class="music_lv_block f_r t_c f_14">13+</div>
      <div class="music_name_block t_l f_13 break">Overdose</div>
      <div class="music_score_block w_112 t_r f_l f_12">100.9833%</div>
      <div class="music_score_block w_190 t_r f_l f_12">
        <img src="./files/deluxscore.png" class="v_b f_l">
        1,358 / 1,404
      </div>
      <input type="hidden" name="idx" value="opaque-session-value">
    </form>
  </div>
  <img src="./files/music_dx.png" class="music_kind_icon ">
</div>
<div class="w_450 m_15 p_r f_0">
  <div class="music_master_score_back pointer p_3">
    <form action="https://maimaidx-eng.com/maimai-mobile/record/musicDetail/" method="get">
      <img src="./files/diff_master.png" class="h_20 f_l">
      <div class="music_lv_block f_r t_c f_14">11</div>
      <div class="music_name_block t_l f_13 break">アイドル</div>
      <div class="music_score_block w_112 t_r f_l f_12">101.0000%</div>
      <div class="music_score_block w_190 t_r f_l f_12">
        <img src="./files/deluxscore.png" class="v_b f_l">
        1,807 / 1,887
      </div>
    </form>
  </div>
  <img src="./files/music_standard.png" class="music_kind_icon">
</div>`;

describe("maimai parser", () => {
  it("extracts player profile fields from playerData HTML", () => {
    expect(parsePlayerDataHtml(playerHtml)).toEqual({
      name: "Ｅ．ＨＯＷＬ",
      rating: 16598,
      trophy: "ナツ 推し",
      currentVersionPlayCount: 1281,
      totalPlayCount: 7546,
    });
  });

  it("extracts song charts and DX score fields from a difficulty score page", () => {
    expect(parseSongScoreHtml(songScoreHtml, 3)).toEqual([
      {
        title: "Overdose",
        difficulty: 3,
        difficultyLabel: "MASTER",
        level: "13+",
        kind: "DX",
        achievementRate: 100.9833,
        dxScore: 1358,
        maxDxScore: 1404,
        officialIdx: "opaque-session-value",
        genre: "POPS＆ANIME",
        jacketUrl: "https://maimaidx-eng.com/maimai-mobile/img/Music/000001.png",
      },
      {
        title: "アイドル",
        difficulty: 3,
        difficultyLabel: "MASTER",
        level: "11",
        kind: "STANDARD",
        achievementRate: 101,
        dxScore: 1807,
        maxDxScore: 1887,
        officialIdx: null,
        genre: "POPS＆ANIME",
        jacketUrl: null,
      },
    ]);
  });

  it("extracts Re:MASTER song charts from remaster score blocks", () => {
    const remasterHtml = songScoreHtml
      .replaceAll("music_master_score_back", "music_remaster_score_back")
      .replaceAll("diff_master.png", "diff_remaster.png");

    expect(parseSongScoreHtml(remasterHtml, 4)).toMatchObject([
      {
        title: "Overdose",
        difficulty: 4,
        difficultyLabel: "Re:MASTER",
        dxScore: 1358,
        maxDxScore: 1404,
      },
      {
        title: "アイドル",
        difficulty: 4,
        difficultyLabel: "Re:MASTER",
        dxScore: 1807,
        maxDxScore: 1887,
      },
    ]);
  });

  it("extracts score fields from the music genre form list fallback", () => {
    const fallbackHtml = `
      <body>
        <div class="wrapper main_wrapper t_c o_v">
          <div></div><div></div><div></div><div></div><div></div><div></div><div></div>
          <div>
            <div>
              <form>
                <div class="music_lv_block">14+</div>
                <div class="music_name_block">Endless World</div>
                <div class="music_score_block">100.1234%</div>
                <div class="music_score_block">2,345 / 2,500</div>
                <input type="hidden" name="idx" value="fallback-idx">
              </form>
            </div>
          </div>
        </div>
      </body>
    `;

    expect(parseSongScoreHtml(fallbackHtml, 4)).toMatchObject([
      {
        title: "Endless World",
        difficulty: 4,
        difficultyLabel: "Re:MASTER",
        level: "14+",
        achievementRate: 100.1234,
        dxScore: 2345,
        maxDxScore: 2500,
        officialIdx: "fallback-idx",
      },
    ]);
  });

  it("extracts Re:MASTER DX score from the detail remaster selector", () => {
    expect(
      parseSongDetailScoreHtml(
        `
        <div id="remaster">
          <div class="t_l">
            <div class="music_score_block w_120 d_ib t_r f_12">
              100.9876%
            </div>
            <div class="music_score_block w_310 m_r_0 d_ib t_r f_12">
              2,456 / 2,500
            </div>
          </div>
        </div>
        `,
        4,
      ),
    ).toEqual({
      achievementRate: 100.9876,
      dxScore: 2456,
      maxDxScore: 2500,
    });
  });

  it("extracts the jacket URL from a song detail page", () => {
    expect(
      parseSongDetailHtml(
        '<div style="background-image:url(/maimai-mobile/img/Music/012345.png?ver=1.0)"></div>',
        "idx-token",
      ),
    ).toEqual({
      officialIdx: "idx-token",
      jacketUrl: "https://maimaidx-eng.com/maimai-mobile/img/Music/012345.png",
    });
  });
});
