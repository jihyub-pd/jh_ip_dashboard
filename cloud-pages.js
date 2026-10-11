(function (root) {
  async function collectPages(fetchPage, pageSize = 500) {
    const rows = [], seen = new Set();
    for (;;) {
      const page = await fetchPage(rows.length, pageSize);
      if (!Array.isArray(page) || page.length > pageSize) throw new Error("서버 목록 응답을 확인하세요.");
      for (const row of page) {
        if (!row?.id || seen.has(row.id)) throw new Error("목록이 조회 중 변경됐습니다. 새로고침하세요.");
        seen.add(row.id);
      }
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  }
  const api = { collectPages };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CloudPages = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
