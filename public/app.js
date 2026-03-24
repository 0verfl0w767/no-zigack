const listEl = document.getElementById("list");
const updatedAtEl = document.getElementById("updatedAt");
const refreshBtn = document.getElementById("refreshBtn");

const STATIONS = [
  { id: "SES2716", name: "7호선 중계역 (하계역 방면)" },
  { id: "SES2646", name: "6호선 태릉입구역 (화랑대역 방면)" },
];

const BUS_STOP = {
  id: "BS268518",
  name: "삼육대후문 (정문 방면)",
};

let stationStates = [];
let busState = null;

function formatLeftTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const min = Math.floor(safeSeconds / 60);
  const sec = safeSeconds % 60;
  return `${min}분 ${sec}초`;
}

function renderStationSection(station, sectionIndex) {
  const items = station.items || [];

  if (!items.length) {
    return `
      <section class="station-section" style="animation-delay:${sectionIndex * 70}ms">
        <div class="station-head">
          <h2>${station.name}</h2>
          <span class="station-count">하행 0건</span>
        </div>
        <div class="empty">현재 표시할 하행 도착 정보가 없습니다.</div>
      </section>
    `;
  }

  const cards = items
    .map((item, index) => {
      const delay = index * 80;
      return `
        <article class="card" style="animation-delay:${delay}ms">
          <div class="row-top">
            <span class="direction">${item.direction || "방면 정보 없음"}</span>
            <span class="arrival">${formatLeftTime(item.arrival_second || 0)}</span>
          </div>
          <div class="row-bottom">
            <span class="train">열차번호 ${item.train_id || "-"}</span>
          </div>
        </article>
      `;
    })
    .join("");

  return `
    <section class="station-section" style="animation-delay:${sectionIndex * 70}ms">
      <div class="station-head">
        <h2>${station.name}</h2>
        <span class="station-count">하행 ${items.length}건</span>
      </div>
      <div class="arrival-list">${cards}</div>
    </section>
  `;
}

function renderStations(stations) {
  listEl.innerHTML = stations
    .map((station, index) => renderStationSection(station, index))
    .join("");
}

function formatBusArrival(seconds) {
  const safeSeconds = Number(seconds) || 0;
  if (safeSeconds <= 0) {
    return "도착 정보 없음";
  }
  return formatLeftTime(safeSeconds);
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
          <h2>${BUS_STOP.name}</h2>
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
        <h2>${BUS_STOP.name}</h2>
        <span class="station-count">버스 ${lines.length}건</span>
      </div>
      <div class="arrival-list">${cards}</div>
    </section>
  `;
}

function renderAllSections() {
  const subwayHtml = stationStates
    .map((station, index) => renderStationSection(station, index))
    .join("");
  const busHtml = renderBusSection(busState, stationStates.length);
  listEl.innerHTML = subwayHtml + busHtml;
}

async function loadDownArrivals() {
  refreshBtn.classList.add("is-loading");

  try {
    const [subwayResponses, busResponse] = await Promise.all([
      Promise.all(
        STATIONS.map((station) =>
          fetch(
            `/api/subway/down?stationId=${station.id}&serviceType=TIMETABLE`,
          ).then((response) => {
            if (!response.ok) {
              throw new Error("지하철 API 응답 실패");
            }
            return response.json();
          }),
        ),
      ),
      fetch(`/api/bus/stop?busStopId=${BUS_STOP.id}`).then((response) => {
        if (!response.ok) {
          throw new Error("버스 API 응답 실패");
        }
        return response.json();
      }),
    ]);

    stationStates = subwayResponses.map((data, index) => ({
      id: STATIONS[index].id,
      name: STATIONS[index].name,
      items: (data.down_subway_vehicle_arrivals || []).map((item) => ({
        ...item,
        arrival_second: Number(item.arrival_second) || 0,
      })),
      fetchedAt: data.fetched_at,
    }));

    busState = {
      id: busResponse.id,
      name: busResponse.name,
      direction: busResponse.direction,
      lines: (busResponse.lines || []).map((line) => ({
        ...line,
        arrival: {
          ...(line.arrival || {}),
          arrivalTime: Number(line.arrival?.arrivalTime) || 0,
          arrivalTime2: Number(line.arrival?.arrivalTime2) || 0,
        },
      })),
      fetchedAt: busResponse.fetched_at,
    };

    const fetchedAt =
      busState.fetchedAt ||
      stationStates[0]?.fetchedAt ||
      new Date().toISOString();
    updatedAtEl.textContent = `업데이트 ${new Date(fetchedAt).toLocaleTimeString("ko-KR")}`;

    renderAllSections();
  } catch (error) {
    listEl.innerHTML =
      '<div class="error">도착 정보를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
    updatedAtEl.textContent = "";
  } finally {
    refreshBtn.classList.remove("is-loading");
  }
}

refreshBtn.addEventListener("click", loadDownArrivals);
loadDownArrivals();
