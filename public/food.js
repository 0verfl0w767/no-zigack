const listEl = document.getElementById("list");
const updatedAtEl = document.getElementById("updatedAt");
const refreshBtn = document.getElementById("refreshBtn");

let isLoading = false;

function renderMenuSection(title, items, delayMs) {
  if (!items || items.length === 0) return "";
  const content = items.join("<br>");
  return `
    <article class="card bus-card" style="animation-delay:${delayMs}ms">
      <div style="display:flex; flex-direction:column; gap:8px; align-items:center; text-align:center;">
        <span class="direction bus-line-name" style="font-size: 1.1rem; color: #2C3E50;">${title}</span>
        <div style="font-size: 0.95rem; color: #555; line-height: 1.4; width: 100%;">${content}</div>
      </div>
    </article>
  `;
}

async function loadFoodMenu() {
  if (isLoading) return;
  isLoading = true;
  refreshBtn.classList.add("is-loading");

  try {
    const response = await fetch("/api/food");
    if (!response.ok) {
      throw new Error("학식 정보를 불러오는데 실패했습니다.");
    }
    const data = await response.json();

    const now = new Date();
    let dayIndex = now.getDay() - 1;

    let todayName = "오늘";
    if (dayIndex < 0 || dayIndex > 4) {
      dayIndex = 0;
      todayName = "월요일";
    } else {
      if (data.days && data.days[dayIndex]) {
        todayName = data.days[dayIndex];
      } else {
        const dayNames = ["월요일", "화요일", "수요일", "목요일", "금요일"];
        todayName = dayNames[dayIndex];
      }
    }

    const { menu } = data;
    const breakfast = menu.breakfast[dayIndex] || [];
    const lunchA = menu.lunchA[dayIndex] || [];
    const lunchB = menu.lunchB[dayIndex] || [];
    const dinner = menu.dinner[dayIndex] || [];

    const lunchCombined = [];
    if (lunchA.length > 0 || lunchB.length > 0) {
      let html = `<div style="display: flex; gap: 16px; width: 100%; justify-content: center;">`;
      if (lunchA.length > 0) {
        html += `<div style="flex: 1; text-align: center;"><span style="font-weight:bold; color:#0056b3; display:block; margin-bottom:6px;">[A 코너]</span>${lunchA.join("<br>")}</div>`;
      }
      if (lunchA.length > 0 && lunchB.length > 0) {
        html += `<div style="width: 1px; background-color: #e2e8f0; margin: 4px 0;"></div>`;
      }
      if (lunchB.length > 0) {
        html += `<div style="flex: 1; text-align: center;"><span style="font-weight:bold; color:#d35400; display:block; margin-bottom:6px;">[B 코너]</span>${lunchB.join("<br>")}</div>`;
      }
      html += `</div>`;
      lunchCombined.push(html);
    }

    let delay = 0;
    const cardsHtml = [
      renderMenuSection("조식 (08:00~09:30)", breakfast, (delay += 60)),
      renderMenuSection("중식 (11:30~14:00)", lunchCombined, (delay += 60)),
      renderMenuSection("석식 (17:30~18:30)", dinner, (delay += 60)),
    ].join("");

    const sectionHtml = `
      <section class="station-section" style="animation-delay:0ms; text-align: center;">
        <div class="station-head" style="justify-content: center;">
          <h2>${todayName} · 학식</h2>
        </div>
        <div class="arrival-list">${cardsHtml || '<div class="empty">등록된 메뉴가 없습니다.</div>'}</div>
      </section>
    `;

    listEl.innerHTML = sectionHtml;

    const fetchedAt = data.fetched_at || new Date().toISOString();
    updatedAtEl.textContent = `업데이트 ${new Date(fetchedAt).toLocaleTimeString("ko-KR")}`;
  } catch (error) {
    listEl.innerHTML =
      '<div class="error">학식 정보를 가져오지 못했습니다.</div>';
    updatedAtEl.textContent = "";
  } finally {
    refreshBtn.classList.remove("is-loading");
    isLoading = false;
  }
}

refreshBtn.addEventListener("click", loadFoodMenu);
loadFoodMenu();
