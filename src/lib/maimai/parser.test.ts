import { describe, expect, it } from "vitest";

import {
  parseSongDetailHtml,
  parseSongDetailScoreHtml,
  parsePlayerDataHtml,
  parsePlaylogHtml,
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

  it("returns an empty player name when playerData HTML is not loaded", () => {
    expect(parsePlayerDataHtml("<html><body>login required</body></html>").name).toBe("");
  });

  it("extracts song charts and DX score fields from a difficulty score page", () => {
    expect(parseSongScoreHtml(songScoreHtml, 3)).toEqual([
      {
        title: "Overdose",
        difficulty: 3,
        difficultyLabel: "MASTER",
        level: "13+",
        kind: "DX",
        versionNumber: null,
        versionName: null,
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
        versionNumber: null,
        versionName: null,
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

  it("attaches version metadata when parsing version catalog pages", () => {
    expect(
      parseSongScoreHtml(songScoreHtml, 3, {
        versionNumber: 25,
        versionName: "CiRCLE",
      })[0],
    ).toMatchObject({
      title: "Overdose",
      versionNumber: 25,
      versionName: "CiRCLE",
    });
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

  it("includes no-record songs for catalog parsing", () => {
    const html = `
      <div class="w_450 m_15 p_r f_0">
        <div class="music_master_score_back pointer p_3">
          <form>
            <div class="music_lv_block">13</div>
            <div class="music_name_block">美しく燃える森</div>
            <div class="music_score_block">-</div>
            <div class="music_score_block">- / 1,234</div>
            <input type="hidden" name="idx" value="no-record-idx">
          </form>
        </div>
        <img src="./music_standard.png" class="music_kind_icon">
      </div>
    `;

    expect(parseSongScoreHtml(html, 3)).toEqual([]);
    expect(parseSongScoreHtml(html, 3, { includeNoRecord: true })).toMatchObject([
      {
        title: "美しく燃える森",
        dxScore: 0,
        maxDxScore: 1234,
        officialIdx: "no-record-idx",
      },
    ]);
  });

  it("includes search page detail forms without score blocks for catalog parsing", () => {
    const html = `
      <body>
        <div class="wrapper main_wrapper t_c o_v">
          <div></div><div></div><div></div><div></div><div></div><div></div>
          <div>
            <form action="https://maimaidx-eng.com/maimai-mobile/record/musicDetail/" method="get">
              <div class="music_lv_block">12+</div>
              <div class="music_name_block">ワールズエンド・ダンスホール</div>
              <input type="hidden" name="idx" value="search-no-record-idx">
            </form>
          </div>
        </div>
      </body>
    `;

    expect(parseSongScoreHtml(html, 3)).toEqual([]);
    expect(parseSongScoreHtml(html, 3, { includeNoRecord: true })).toMatchObject([
      {
        title: "ワールズエンド・ダンスホール",
        difficulty: 3,
        difficultyLabel: "MASTER",
        level: "12+",
        dxScore: 0,
        maxDxScore: 0,
        officialIdx: "search-no-record-idx",
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
              -
            </div>
            <div class="music_score_block w_310 m_r_0 d_ib t_r f_12">
              - / 2,500
            </div>
          </div>
        </div>
        `,
        4,
      ),
    ).toEqual({
      achievementRate: null,
      dxScore: 0,
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

  it("extracts recent playlog records from the game record page", () => {
    const html = `
      <div class="p_10 t_l f_0 v_b">
        <div class="playlog_top_container p_r">
          <img src="./files/diff_master.png" class="playlog_diff v_b">
          <div class="sub_title t_c f_r f_11">
            <span class="red f_b v_b">TRACK 03</span><span class="v_b">2026/06/10 01:31</span>
          </div>
        </div>
        <div class="playlog_master_container">
          <div class="basic_block m_5 m_t_17 m_r_60 p_5 p_l_10 f_13 break">
            <div class="w_80 f_r"><div class="music_lv_back">12+</div></div>
            ヤミツキ
          </div>
          <div class="p_r f_0">
            <img src="./files/music_dx.png" class="playlog_music_kind_icon">
            <div class="playlog_result_block">
              <div class="playlog_achievement_txt t_r">100<span class="f_20">.9545%</span></div>
              <div class="playlog_result_innerblock basic_block p_5 f_13">
                <div class="playlog_score_block playlog_score_block_star f_0">
                  <div class="white p_r_5 f_15 f_r">2,106 / 2,172</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="p_10 t_l f_0 v_b">
        <div class="playlog_top_container p_r">
          <img src="./files/diff_remaster.png" class="playlog_diff v_b">
          <div class="sub_title t_c f_r f_11">
            <span class="red f_b v_b">TRACK 02</span><span class="v_b">2026/06/10 01:29</span>
          </div>
        </div>
        <div class="playlog_remaster_container">
          <div class="basic_block m_5 m_t_17 m_r_60 p_5 p_l_10 f_13 break">
            <div class="w_80 f_r"><div class="music_lv_back">14</div></div>
            スーパーシンメトリー
          </div>
          <div class="p_r f_0">
            <img src="./files/music_standard.png" class="playlog_music_kind_icon">
            <div class="playlog_result_block">
              <div class="playlog_achievement_txt t_r">100<span class="f_20">.7788%</span></div>
              <div class="playlog_result_innerblock basic_block p_5 f_13">
                <div class="playlog_score_block playlog_score_block_star f_0">
                  <div class="white p_r_5 f_15 f_r">2,936 / 3,000</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    expect(parsePlaylogHtml(html)).toEqual([
      {
        achievementRate: 100.9545,
        difficulty: 3,
        difficultyLabel: "MASTER",
        dxScore: 2106,
        kind: "DX",
        maxDxScore: 2172,
        playedAt: "2026-06-10T01:31:00+09:00",
        title: "ヤミツキ",
      },
      {
        achievementRate: 100.7788,
        difficulty: 4,
        difficultyLabel: "Re:MASTER",
        dxScore: 2936,
        kind: "STANDARD",
        maxDxScore: 3000,
        playedAt: "2026-06-10T01:29:00+09:00",
        title: "スーパーシンメトリー",
      },
    ]);
  });
});
