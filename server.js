const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8282;
const STATIC_DIR = path.join(__dirname, "public");

function getKstIsoString() {
  const now = new Date();
  const kstTime = now.getTime() + 9 * 60 * 60 * 1000;
  return new Date(kstTime).toISOString().replace("Z", "+09:00");
}

app.set("trust proxy", 1);

app.use("/static", express.static(STATIC_DIR));

app.get("/api/subway/down", async (req, res) => {
  const timestamp = getKstIsoString();
  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.ip ||
    req.socket.remoteAddress;
  console.log(
    `[${timestamp}] ${clientIp} GET /api/subway/down - Query: ${JSON.stringify(req.query)}`,
  );

  const stationId = req.query.stationId || "SES2716";
  const serviceType = req.query.serviceType || "TIMETABLE";

  const url = `https://place-api.map.kakao.com/places/subways/arrival/${stationId}?service_type=${encodeURIComponent(serviceType)}`;

  try {
    const response = await axios.get(url, {
      headers: {
        Referer: "https://place.map.kakao.com",
        Pf: "PC",
      },
      timeout: 10000,
    });

    const downArrivals = Array.isArray(
      response.data.down_subway_vehicle_arrivals,
    )
      ? response.data.down_subway_vehicle_arrivals
      : [];

    res.json({
      station_id: response.data.station_id,
      service_type: response.data.service_type,
      down_subway_realtime_state: response.data.down_subway_realtime_state,
      down_subway_vehicle_arrivals: downArrivals,
      fetched_at: getKstIsoString(),
    });
  } catch (error) {
    const status = error.response?.status || 500;
    res.status(status).json({
      message: "지하철 도착 정보를 불러오지 못했습니다.",
      detail: error.response?.data || error.message,
    });
  }
});

const SHUTTLE_TIMES_MON_THU = [
  "12:00",
  "12:25",
  "12:50",
  "13:15",
  "13:40",
  "14:05",
  "14:30",
  "15:00",
  "15:20",
  "15:40",
  "16:00",
  "16:20",
  "16:40",
  "17:00",
  "17:20",
  "17:40",
  "18:00",
  "18:15",
];

const SHUTTLE_TIMES_FRI = [
  "12:00",
  "12:25",
  "12:50",
  "13:15",
  "13:40",
  "14:05",
  "14:30",
  "15:00",
  "15:20",
  "15:30",
];

function getNextShuttleArrivals() {
  const now = new Date(getKstIsoString());
  const day = now.getDay();

  if (day === 0 || day === 6) return null;

  const schedule = day === 5 ? SHUTTLE_TIMES_FRI : SHUTTLE_TIMES_MON_THU;
  const currentTotalSeconds =
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  const futureTimes = schedule
    .map((t) => {
      const [h, m] = t.split(":");
      return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60;
    })
    .filter((s) => s > currentTotalSeconds);

  if (futureTimes.length === 0) return null;

  return {
    arrivalTime: futureTimes[0] - currentTotalSeconds,
    arrivalTime2: futureTimes[1] ? futureTimes[1] - currentTotalSeconds : 0,
    busStopCount: 0,
    busStopCount2: 0,
  };
}

app.get("/api/bus/stop", async (req, res) => {
  const timestamp = getKstIsoString();
  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.ip ||
    req.socket.remoteAddress;
  console.log(
    `[${timestamp}] [${clientIp}] GET /api/bus/stop - Query: ${JSON.stringify(req.query)}`,
  );

  const busStopId = req.query.busStopId || "BS268518";
  const url = "https://map.kakao.com/bus/stop.json";

  try {
    const response = await axios.get(url, {
      params: { busstopid: busStopId },
      headers: {
        Referer: "https://map.kakao.com",
        Pf: "PC",
      },
      timeout: 10000,
      responseType: "text",
    });

    const raw = response.data;
    let payload;

    if (typeof raw === "string") {
      const jsonpMatch = raw.match(/^[^(]+\((.*)\)\s*;?\s*$/s);
      const jsonText = jsonpMatch ? jsonpMatch[1] : raw;
      payload = JSON.parse(jsonText);
    } else {
      payload = raw;
    }

    let lines = Array.isArray(payload.lines) ? payload.lines : [];

    lines = lines.filter((line) => line.name !== "86");

    if (busStopId === "BS268518") {
      const shuttleArrivals = getNextShuttleArrivals();
      if (shuttleArrivals) {
        lines.unshift({
          id: "shuttle",
          name: "[학교 셔틀] 석계역 방면",
          arrival: shuttleArrivals,
        });
      }
    }

    res.json({
      id: payload.id,
      name: payload.name,
      direction: payload.direction,
      lines,
      fetched_at: getKstIsoString(),
    });
  } catch (error) {
    const status = error.response?.status || 500;
    res.status(status).json({
      message: "버스 도착 정보를 불러오지 못했습니다.",
      detail: error.response?.data || error.message,
    });
  }
});

app.get("/subway", (req, res) => {
  res.sendFile(path.join(STATIC_DIR, "subway.html"));
});

app.get("/bus", (req, res) => {
  res.sendFile(path.join(STATIC_DIR, "bus.html"));
});

app.get("/api/food", async (req, res) => {
  const timestamp = getKstIsoString();
  const clientIp =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.ip ||
    req.socket.remoteAddress;
  console.log(`[${timestamp}] [${clientIp}] GET /api/food`);

  const url =
    "https://www.syu.ac.kr/school-life/facility-information/cafeteria/";

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      timeout: 10000,
    });
    const $ = cheerio.load(response.data);

    const table = $("table.weekly-menu-table").first();
    const days = [];
    table.find("thead th").each((i, el) => {
      const text = $(el).text().trim();
      if (text && text !== "구분") {
        days.push(text);
      }
    });

    const menu = {
      breakfast: [[], [], [], [], []],
      lunchA: [[], [], [], [], []],
      lunchB: [[], [], [], [], []],
      dinner: [[], [], [], [], []],
    };

    const tbody = table.find("tbody");

    const cleanItem = (s) => {
      let text = $($.parseHTML(`<div>${s}</div>`))
        .text()
        .trim();
      text = text.replace(
        /\(\s*오\s*늘\s*의\s*메\s*인\s*토\s*핑\s*[:]?\s*(.*?)\s*\)/g,
        "$1",
      );
      return text;
    };

    // 조식
    const breakfastTds = tbody.find("tr").eq(0).find("td");
    breakfastTds.each((i, el) => {
      const html = $(el).html() || "";
      const textArray = html.split(/<br\s*\/?>/i);
      const items = textArray.map(cleanItem).filter((s) => s);
      menu.breakfast[i] = items;
    });

    // 중식 A
    const lunchATds = tbody.find("tr").eq(1).find("td");
    let aIndex = 0;
    lunchATds.each((i, el) => {
      if ($(el).hasClass("weekly-menu-table__corner-label")) return;
      const html = $(el).html() || "";
      const textArray = html.split(/<br\s*\/?>/i);
      const items = textArray.map(cleanItem).filter((s) => s);
      if (aIndex < 5) menu.lunchA[aIndex] = items;
      aIndex++;
    });

    // 중식 B
    const lunchBTds = tbody.find("tr").eq(2).find("td");
    let bIndex = 0;
    lunchBTds.each((i, el) => {
      if ($(el).hasClass("weekly-menu-table__corner-label")) return;
      const html = $(el).html() || "";
      const textArray = html.split(/<br\s*\/?>/i);
      const items = textArray.map(cleanItem).filter((s) => s);
      if (bIndex < 5) menu.lunchB[bIndex] = items;
      bIndex++;
    });

    // 석식
    const dinnerTds = tbody.find("tr").eq(3).find("td");
    let dIndex = 0;
    dinnerTds.each((i, el) => {
      const html = $(el).html() || "";
      if ($(el).hasClass("weekly-menu-table__no-dinner")) {
        if (dIndex < 5) menu.dinner[dIndex] = ["운영 없음"];
        dIndex++;
      } else {
        const textArray = html.split(/<br\s*\/?>/i);
        const items = textArray.map(cleanItem).filter((s) => s);
        const colspan = parseInt($(el).attr("colspan") || "1", 10);
        for (let c = 0; c < colspan; c++) {
          if (dIndex < 5) menu.dinner[dIndex] = items;
          dIndex++;
        }
      }
    });

    res.json({
      days,
      menu,
      fetched_at: getKstIsoString(),
    });
  } catch (error) {
    console.error(error);
    const status = error.response?.status || 500;
    res.status(status).json({
      message: "식단 정보를 불러오지 못했습니다.",
      detail: error.message,
    });
  }
});

app.get("/food", (req, res) => {
  res.sendFile(path.join(STATIC_DIR, "food.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
