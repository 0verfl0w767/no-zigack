const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8282;
const STATIC_DIR = path.join(__dirname, "public");

app.use("/static", express.static(STATIC_DIR));

app.get("/api/subway/down", async (req, res) => {
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
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    const status = error.response?.status || 500;
    res.status(status).json({
      message: "지하철 도착 정보를 불러오지 못했습니다.",
      detail: error.response?.data || error.message,
    });
  }
});

app.get("/api/bus/stop", async (req, res) => {
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

    const lines = Array.isArray(payload.lines) ? payload.lines : [];

    res.json({
      id: payload.id,
      name: payload.name,
      direction: payload.direction,
      lines,
      fetched_at: new Date().toISOString(),
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
