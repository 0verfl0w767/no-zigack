const listEl = document.getElementById("list");
const updatedAtEl = document.getElementById("updatedAt");
const refreshBtn = document.getElementById("refreshBtn");

const BUS_STOPS = [
  { id: "BS268518", label: "삼육대후문 (정문 방면)" },
  { id: "BS226801" },
];

function formatLeftTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const min = Math.floor(safeSeconds / 60);
  const sec = safeSeconds % 60;
  return `${min}분 ${sec}초`;
}

function formatBusArrival(seconds) {
  const safeSeconds = Number(seconds) || 0;
  if (safeSeconds <= 0) {
    return "도착 정보 없음";
  }
  return formatLeftTime(safeSeconds);
}

function normalizeLine(line) {
  return {
    ...line,
    arrival: {
      ...(line.arrival || {}),
      arrivalTime: Number(line.arrival?.arrivalTime) || 0,
      arrivalTime2: Number(line.arrival?.arrivalTime2) || 0,
      busStopCount: Number(line.arrival?.busStopCount) || 0,
      busStopCount2: Number(line.arrival?.busStopCount2) || 0,
    },
  };
}

function pickBetterLine(baseLine, nextLine) {
  const baseTime = Number(baseLine.arrival?.arrivalTime) || 0;
  const nextTime = Number(nextLine.arrival?.arrivalTime) || 0;

  if (baseTime <= 0 && nextTime > 0) {
    return nextLine;
  }

  if (nextTime <= 0 && baseTime > 0) {
    return baseLine;
  }

  if (baseTime > 0 && nextTime > 0 && nextTime < baseTime) {
    return nextLine;
  }

  return baseLine;
}

function renderBusSection(bus, sectionIndex) {
  if (!bus) {
    return "";
  }

  const lines = bus.lines || [];

  if (!lines.length) {
    return `
      <section class="station-section" style="animation-delay:${sectionIndex * 70}ms">
        <div class="station-head">
          <h2>${bus.displayName}</h2>
          <span class="station-count">버스 0건</span>
        </div>
        <div class="empty">현재 표시할 버스 도착 정보가 없습니다.</div>
      </section>
    `;
  }

  const cards = lines
    .map((line, index) => {
      const delay = index * 60;
      const arrival = line.arrival || {};
      const firstSeconds = Number(arrival.arrivalTime) || 0;
      const secondSeconds = Number(arrival.arrivalTime2) || 0;
      const firstStops = Number(arrival.busStopCount) || 0;
      const secondStops = Number(arrival.busStopCount2) || 0;

      return `
        <article class="card bus-card" style="animation-delay:${delay}ms">
          <div class="row-top">
            <span class="direction bus-line-name">${line.name || "노선명 없음"}</span>
            <span class="arrival">${formatBusArrival(firstSeconds)}</span>
          </div>
          <div class="row-bottom bus-row-bottom">
            <span class="train">이번: ${formatBusArrival(firstSeconds)}${firstStops > 0 ? ` · ${firstStops}정류장 전` : ""}</span>
            <span class="train">다음: ${formatBusArrival(secondSeconds)}${secondStops > 0 ? ` · ${secondStops}정류장 전` : ""}</span>
          </div>
        </article>
      `;
    })
    .join("");

  return `
    <section class="station-section" style="animation-delay:${sectionIndex * 70}ms">
      <div class="station-head">
        <h2>${bus.displayName}</h2>
        <span class="station-count">버스 ${lines.length}건</span>
      </div>
      <div class="arrival-list">${cards}</div>
    </section>
  `;
}

async function loadBusArrivals() {
  refreshBtn.classList.add("is-loading");

  try {
    const responses = await Promise.all(
      BUS_STOPS.map((stop) =>
        fetch(`/api/bus/stop?busStopId=${stop.id}`).then((response) => {
          if (!response.ok) {
            throw new Error("버스 API 응답 실패");
          }
          return response.json();
        }),
      ),
    );

    const mergedLinesMap = new Map();

    responses.forEach((data) => {
      (data.lines || []).forEach((line) => {
        const normalized = normalizeLine(line);
        const key =
          normalized.id || normalized.name || Math.random().toString();
        const existing = mergedLinesMap.get(key);

        if (!existing) {
          mergedLinesMap.set(key, normalized);
          return;
        }

        mergedLinesMap.set(key, pickBetterLine(existing, normalized));
      });
    });

    const mergedState = {
      id: BUS_STOPS.map((stop) => stop.id).join(","),
      name: responses[0]?.name || "",
      displayName: BUS_STOPS[0].label,
      direction: responses[0]?.direction || "",
      lines: Array.from(mergedLinesMap.values()).sort((a, b) => {
        const aName = String(a.name || "");
        const bName = String(b.name || "");
        return aName.localeCompare(bName, "ko");
      }),
      fetchedAt: responses[0]?.fetched_at || new Date().toISOString(),
    };

    const fetchedAt = mergedState.fetchedAt || new Date().toISOString();
    updatedAtEl.textContent = `업데이트 ${new Date(fetchedAt).toLocaleTimeString("ko-KR")}`;
    listEl.innerHTML = renderBusSection(mergedState, 0);
  } catch (error) {
    listEl.innerHTML =
      '<div class="error">버스 도착 정보를 가져오지 못했습니다.</div>';
    updatedAtEl.textContent = "";
  } finally {
    refreshBtn.classList.remove("is-loading");
  }
}

refreshBtn.addEventListener("click", loadBusArrivals);
loadBusArrivals();
