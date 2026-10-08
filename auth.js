// Server policies enforce ownership; the UI stays read-only until verified.
window.DashboardAuth = (() => {
  let client = null;
  let allowed = false;
  let revision = 0;
  const writeSelector = '#saveBtn, #addSampleBtn, #toggleSelectBtn, #deleteSelectedBtn, #restoreBtn, .star-btn, .delete-btn, .memo-input';
  const disabledBefore = new WeakMap();
  const status = () => document.querySelector('#authStatus');
  function applyControls() {
    document.querySelectorAll(writeSelector).forEach(node => {
      if (!allowed) {
        if (!disabledBefore.has(node)) disabledBefore.set(node, node.disabled);
        node.disabled = true;
      } else if (disabledBefore.has(node)) {
        node.disabled = disabledBefore.get(node);
        disabledBefore.delete(node);
      }
    });
  }
  function setStatus(message) { if (status()) status().textContent = message; }
  async function refresh(session) {
    const current = ++revision;
    allowed = false;
    applyControls();
    document.querySelector('#authLogout').hidden = !session;
    document.querySelector('#authForm').hidden = !!session;
    if (!session) { setStatus('읽기 전용 · 수정하려면 소유자로 로그인하세요.'); return; }
    setStatus('로그인 권한을 확인하고 있습니다.');
    try {
      const { data, error } = await client.rpc('ip_dashboard_can_write');
      if (current !== revision) return;
      allowed = !error && data === true;
      setStatus(allowed ? '소유자 로그인 · 수정할 수 있습니다.' : error ? '권한 확인 실패 · 잠시 후 다시 로그인해 주세요.' : '읽기 전용 · 이 계정에는 수정 권한이 없습니다.');
    } catch {
      if (current !== revision) return;
      setStatus('권한 확인 실패 · 읽기 전용으로 이용할 수 있습니다.');
    }
    applyControls();
  }
  async function initialize(supabase) {
    client = supabase;
    applyControls();
    new MutationObserver(applyControls).observe(document.querySelector('.app-shell'), { childList: true, subtree: true });
    document.querySelector('#authForm').addEventListener('submit', async event => {
      event.preventDefault();
      if (!client) { setStatus('로그인 서비스에 연결할 수 없습니다.'); return; }
      const button = document.querySelector('#authSend');
      button.disabled = true;
      setStatus('로그인 링크를 보내고 있습니다.');
      try {
        // Only configured production and localhost redirects are supported.
        const redirect = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
          ? window.location.origin + '/' : 'https://ip-dashboard-kappa.vercel.app/';
        const { error } = await client.auth.signInWithOtp({
          email: document.querySelector('#authEmail').value.trim(),
          options: { shouldCreateUser: false, emailRedirectTo: redirect },
        });
        setStatus(error ? `로그인 링크 전송 실패: ${error.message}` : '등록된 계정이면 로그인 링크가 전송됩니다. 이메일을 확인하세요.');
      } catch { setStatus('로그인 링크를 보내지 못했습니다. 잠시 후 다시 시도하세요.'); }
      finally { button.disabled = false; }
    });
    document.querySelector('#authLogout').addEventListener('click', async () => {
      allowed = false;
      ++revision;
      applyControls();
      try {
        const { error } = await client.auth.signOut();
        if (error) { setStatus('로그아웃 실패 · 수정을 잠갔습니다. 다시 시도해 주세요.'); return; }
        await refresh(null);
      } catch { setStatus('로그아웃 실패 · 수정을 잠갔습니다.'); }
    });
    if (!client) { setStatus('로그인 서비스 연결 실패 · 읽기 전용'); return; }
    client.auth.onAuthStateChange((_event, session) => {
      // Do not await another Supabase operation inside the auth callback.
      allowed = false;
      ++revision;
      applyControls();
      setTimeout(() => refresh(session), 0);
    });
    try {
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      await refresh(data.session);
    } catch { setStatus('로그인 상태를 확인하지 못했습니다. 읽기 전용으로 이용하세요.'); }
  }
  return { initialize, get canWrite() { return allowed; } };
})();
