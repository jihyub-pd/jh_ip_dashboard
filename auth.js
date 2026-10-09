// Server policies enforce ownership; the UI stays read-only until verified.
window.DashboardAuth = (() => {
  let client = null;
  let allowed = false;
  let revision = 0;
  let mailSending = false;
  let mailCooldownUntil = 0;
  let cooldownTimer = null;
  const writeSelector = '#saveBtn, #addSampleBtn, #toggleSelectBtn, #deleteSelectedBtn, #restoreBtn, .star-btn, .delete-btn, .memo-input, .review-complete-btn';
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
    const setup = document.querySelector('#authPasswordSetup');
    if (setup) setup.hidden = true;
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
    if (setup) setup.hidden = !allowed;
    applyControls();
  }
  function installPasswordOptions() {
    const form = document.querySelector('#authForm');
    const button = document.querySelector('#authSend');
    const label = document.createElement('label'); label.htmlFor = 'authMethod'; label.textContent = '로그인 방법';
    const method = document.createElement('select'); method.id = 'authMethod';
    for (const [value, text] of [['link','이메일 링크'], ['password','비밀번호']]) { const option = document.createElement('option'); option.value = value; option.textContent = text; method.append(option); }
    const passwordLabel = document.createElement('label'); passwordLabel.htmlFor = 'authPassword'; passwordLabel.textContent = '비밀번호'; passwordLabel.hidden = true;
    const password = document.createElement('input'); password.id = 'authPassword'; password.type = 'password'; password.autocomplete = 'current-password'; password.hidden = true;
    form.insertBefore(label, button); form.insertBefore(method, button); form.insertBefore(passwordLabel, button); form.insertBefore(password, button);
    const updateButton = () => {
      const usePassword = method.value === 'password';
      password.hidden = passwordLabel.hidden = !usePassword; password.required = usePassword;
      const remaining = Math.max(0, Math.ceil((mailCooldownUntil - Date.now()) / 1000));
      button.disabled = mailSending || (!usePassword && remaining > 0);
      button.textContent = usePassword ? '비밀번호로 로그인' : remaining ? `재전송 대기 ${remaining}초` : '로그인 링크 받기';
      if (!remaining && cooldownTimer) { clearInterval(cooldownTimer); cooldownTimer = null; }
    };
    method.addEventListener('change', updateButton);
    const setup = document.createElement('details'); setup.id = 'authPasswordSetup'; setup.hidden = true;
    const summary = document.createElement('summary'); summary.textContent = '이 계정의 로그인 비밀번호 설정'; setup.append(summary);
    const setupForm = document.createElement('form');
    const setupLabel = document.createElement('label'); setupLabel.htmlFor = 'authNewPassword'; setupLabel.textContent = '새 비밀번호 (8자 이상)';
    const newPassword = document.createElement('input'); newPassword.id = 'authNewPassword'; newPassword.type = 'password'; newPassword.autocomplete = 'new-password'; newPassword.minLength = 8; newPassword.required = true;
    const save = document.createElement('button'); save.type = 'submit'; save.textContent = '비밀번호 설정';
    setupForm.append(setupLabel, newPassword, save); setup.append(setupForm); form.parentNode.append(setup);
    setupForm.addEventListener('submit', async event => {
      event.preventDefault(); if (!allowed || !client) return; save.disabled = true;
      try { const {error} = await client.auth.updateUser({password: newPassword.value});
        if (error) { setStatus('비밀번호 설정 실패: ' + error.message); return; }
        newPassword.value = ''; setup.open = false; setStatus('비밀번호를 설정했습니다. 다음부터 메일 없이 로그인할 수 있습니다.');
      } catch { setStatus('비밀번호 설정 결과를 확인하지 못했습니다. 다시 확인해 주세요.'); }
      finally { save.disabled = false; }
    });
    return updateButton;
  }
  async function initialize(supabase) {
    client = supabase;
    applyControls();
    const updateLoginButton = installPasswordOptions();
    new MutationObserver(applyControls).observe(document.querySelector('.app-shell'), { childList: true, subtree: true });
    document.querySelector('#authForm').addEventListener('submit', async event => {
      event.preventDefault();
      if (!client) { setStatus('로그인 서비스에 연결할 수 없습니다.'); return; }
      const method = document.querySelector('#authMethod').value;
      if (mailSending || (method === 'link' && Date.now() < mailCooldownUntil)) return;
      mailSending = true; updateLoginButton();
      setStatus(method === 'password' ? '로그인하고 있습니다.' : '로그인 링크를 보내고 있습니다.');
      try {
        const email = document.querySelector('#authEmail').value.trim();
        if (method === 'password') {
          const {data, error} = await client.auth.signInWithPassword({email, password: document.querySelector('#authPassword').value});
          document.querySelector('#authPassword').value = '';
          if (error) { setStatus(error.status === 429 ? '로그인 시도 한도를 초과했습니다. 잠시 후 다시 시도하세요.' : '로그인 실패 · 이메일과 비밀번호를 확인하세요.'); return; }
          await refresh(data.session);
        } else {
          const redirect = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
            ? window.location.origin + '/' : 'https://ip-dashboard-kappa.vercel.app/';
          const {error} = await client.auth.signInWithOtp({email, options: {shouldCreateUser: false, emailRedirectTo: redirect}});
          if (error) {
            const limited = error.code === 'over_email_send_rate_limit' || /email rate limit exceeded/i.test(error.message);
            setStatus(limited ? '로그인 메일 발송 한도를 초과했습니다. 비밀번호가 설정돼 있다면 로그인 방법을 비밀번호로 바꾸세요. 메일 재시도는 한도 복구 후 가능합니다.' : `로그인 링크 전송 실패: ${error.message}`);
            if (limited || error.status === 429) mailCooldownUntil = Date.now() + 60000;
          } else {
            mailCooldownUntil = Date.now() + 60000;
            setStatus('등록된 계정이면 로그인 링크가 전송됩니다. 이메일을 확인하세요.');
          }
          if (mailCooldownUntil > Date.now() && !cooldownTimer) cooldownTimer = setInterval(updateLoginButton, 1000);
        }
      } catch { setStatus('로그인 요청 결과를 확인하지 못했습니다. 잠시 후 다시 시도하세요.'); }
      finally { mailSending = false; updateLoginButton(); }
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
