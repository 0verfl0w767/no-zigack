const listEl = document.getElementById("list");
const updatedAtEl = document.getElementById("updatedAt");
const refreshBtn = document.getElementById("refreshBtn");

const STATIONS = [
  { id: "SES2716", name: "7호선 중계역 (하계역 방면)" },
  { id: "SES2646", name: "6호선 태릉입구역 (화랑대역 방면)" },
];

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

async function loadSubwayArrivals() {
  refreshBtn.classList.add("is-loading");

  try {
    const responses = await Promise.all(
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
    );

    const stationStates = responses.map((data, index) => ({
      id: STATIONS[index].id,
      name: STATIONS[index].name,
      items: (data.down_subway_vehicle_arrivals || []).map((item) => ({
        ...item,
        arrival_second: Number(item.arrival_second) || 0,
      })),
      fetchedAt: data.fetched_at,
    }));

    const fetchedAt = stationStates[0]?.fetchedAt || new Date().toISOString();
    updatedAtEl.textContent = `업데이트 ${new Date(fetchedAt).toLocaleTimeString("ko-KR")}`;

    listEl.innerHTML = stationStates
      .map((station, index) => renderStationSection(station, index))
      .join("");
  } catch (error) {
    listEl.innerHTML =
      '<div class="error">지하철 도착 정보를 가져오지 못했습니다.</div>';
    updatedAtEl.textContent = "";
  } finally {
    refreshBtn.classList.remove("is-loading");
  }
}

refreshBtn.addEventListener("click", loadSubwayArrivals);
loadSubwayArrivals();
