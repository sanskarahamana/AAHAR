/* Aahar - vanilla MPA logic */
(function(){
  const KEYS = {
    targets: 'aahar.targets',
    logs:    'aahar.logs',     // { 'YYYY-MM-DD': [{name,p,c,f,k}] }
    weights: 'aahar.weights',  // [{date,kg}]
    profile: 'aahar.profile',
  };

  const todayKey = () => new Date().toISOString().slice(0,10);
  const fmtDate = d => new Date(d).toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
  const get = (k,fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
  const set = (k,v) => localStorage.setItem(k, JSON.stringify(v));

  function getTodayLogs(){
    const all = get(KEYS.logs,{});
    return all[todayKey()] || [];
  }
  function setTodayLogs(arr){
    const all = get(KEYS.logs,{});
    all[todayKey()] = arr;
    set(KEYS.logs, all);
  }
  function totals(entries){
    return entries.reduce((a,e)=>({
      p:a.p+(+e.p||0), c:a.c+(+e.c||0), f:a.f+(+e.f||0), k:a.k+(+e.k|| (4*(+e.p||0)+4*(+e.c||0)+9*(+e.f||0)))
    }),{p:0,c:0,f:0,k:0});
  }

  /* ---------- DASHBOARD ---------- */
  function initDashboard(){
    document.getElementById('today-date').textContent = fmtDate(new Date());
    const t = get(KEYS.targets, null);
    const tEl = document.getElementById('target-summary');
    if(t){
      tEl.textContent = `Targets: ${t.kcal} kcal · ${t.p}P / ${t.c}C / ${t.f}F`;
      ['p','c','f'].forEach(k => document.getElementById(k+'-target').textContent = t[k]);
      document.getElementById('kcal-target').textContent = t.kcal;
    }
    renderTotals();
    renderLog();
    renderWeight();

    document.getElementById('open-log').onclick = ()=> document.getElementById('log-modal').hidden=false;
    document.getElementById('close-log').onclick = ()=> document.getElementById('log-modal').hidden=true;
    document.getElementById('save-log').onclick = ()=>{
      const e = {
        name: document.getElementById('m-name').value || 'Entry',
        p: +document.getElementById('m-p').value||0,
        c: +document.getElementById('m-c').value||0,
        f: +document.getElementById('m-f').value||0,
        k: +document.getElementById('m-k').value||0,
      };
      if(!e.k) e.k = Math.round(4*e.p+4*e.c+9*e.f);
      const arr = getTodayLogs(); arr.push(e); setTodayLogs(arr);
      ['m-name','m-p','m-c','m-f','m-k'].forEach(id=>document.getElementById(id).value='');
      document.getElementById('log-modal').hidden=true;
      renderTotals(); renderLog();
    };
    document.getElementById('clear-log').onclick = ()=>{
      if(!confirm('Clear today\'s log?')) return;
      setTodayLogs([]); renderTotals(); renderLog();
    };
    document.getElementById('log-weight').onclick = ()=>{
      const v = parseFloat(document.getElementById('weight-input').value);
      if(!v) return;
      const arr = get(KEYS.weights,[]);
      arr.push({date:todayKey(), kg:v}); set(KEYS.weights,arr);
      document.getElementById('weight-input').value='';
      renderWeight();
    };
  }
  function renderTotals(){
    const t = get(KEYS.targets,null);
    const tot = totals(getTodayLogs());
    ['p','c','f'].forEach(k=>{
      document.getElementById(k+'-current').textContent = Math.round(tot[k]);
      const tgt = t? t[k] : 0;
      const pct = tgt? Math.min(100,(tot[k]/tgt)*100) : 0;
      document.getElementById(k+'-bar').style.width = pct+'%';
    });
    document.getElementById('kcal-current').textContent = Math.round(tot.k);
  }
  function renderLog(){
    const list = document.getElementById('log-list');
    const arr = getTodayLogs();
    if(!arr.length){ list.innerHTML = '<li class="empty">No entries yet.</li>'; return; }
    list.innerHTML = arr.map((e,i)=>`
      <li>
        <div><div>${escapeHtml(e.name)}</div><div class="macros">${e.p}P · ${e.c}C · ${e.f}F · ${e.k} kcal</div></div>
        <button class="del" data-i="${i}" aria-label="Delete">×</button>
      </li>`).join('');
    list.querySelectorAll('.del').forEach(b=>b.onclick=()=>{
      const arr = getTodayLogs(); arr.splice(+b.dataset.i,1); setTodayLogs(arr);
      renderTotals(); renderLog();
    });
  }
  function renderWeight(){
    const arr = get(KEYS.weights,[]);
    const last = arr[arr.length-1];
    document.getElementById('latest-weight').textContent = last? `${last.kg} kg` : '—';
  }

  /* ---------- ONBOARDING ---------- */
  function initOnboarding(){
    const profile = get(KEYS.profile,null);
    if(profile){
      ['weight','height','age'].forEach(id=>{
        if(profile[id]!=null) document.getElementById(id).value = profile[id];
      });
    }
    let goal = (profile && profile.goal) || 'recomp';
    const opts = document.querySelectorAll('.goal-opt');
    const setGoal = g => {
      goal = g;
      opts.forEach(o=> o.classList.toggle('active', o.dataset.goal===g));
    };
    setGoal(goal);
    opts.forEach(o => o.onclick = () => setGoal(o.dataset.goal));

    document.getElementById('calc').onclick = () => {
      const w = +document.getElementById('weight').value;
      const h = +document.getElementById('height').value;
      const a = +document.getElementById('age').value;
      if(!w||!h||!a){ alert('Please fill in weight, height, and age.'); return; }

      // Defaults: male, moderate activity (1.55) — recomp-tuned engine
      const sex = (profile && profile.sex) || 'male';
      const act = 1.55;
      const bmr = sex==='male' ? (10*w + 6.25*h - 5*a + 5) : (10*w + 6.25*h - 5*a - 161);
      const tdee = bmr * act;
      let kcal = tdee;
      if(goal==='cut') kcal = tdee*0.80;
      if(goal==='bulk') kcal = tdee*1.12;
      kcal = Math.round(kcal);

      const p = Math.round(2.0*w);
      const f = Math.round(0.9*w);
      const c = Math.max(0, Math.round((kcal - (p*4 + f*9))/4));

      set(KEYS.targets, { kcal, p, c, f, bmr:Math.round(bmr), tdee:Math.round(tdee), goal });
      set(KEYS.profile, { weight:w, height:h, age:a, sex, activity:String(act), goal });

      const btn = document.getElementById('calc');
      btn.textContent = 'Targets locked ✓ Redirecting…';
      btn.disabled = true;
      setTimeout(()=> window.location.href='/dashboard.html', 500);
    };
  }

  /* ---------- PROGRESS ---------- */
  function initProgress(){
    const weights = get(KEYS.weights,[]);
    const last = weights[weights.length-1];
    const first = weights[0];
    document.getElementById('s-weight').textContent = last? last.kg.toFixed(1) : '—';
    document.getElementById('s-delta').textContent = (last && first)? ((last.kg-first.kg).toFixed(1)) : '—';

    // consistency over last 7 days = avg(% of macro target hit, capped at 100)
    const t = get(KEYS.targets,null);
    const logs = get(KEYS.logs,{});
    const days = lastNDates(7);
    let consSum = 0, consDays = 0;
    days.forEach(d=>{
      const entries = logs[d]||[];
      if(!entries.length || !t) return;
      const tot = totals(entries);
      const pcts = ['p','c','f'].map(k=> Math.min(100,(tot[k]/t[k])*100));
      consSum += pcts.reduce((a,b)=>a+b,0)/3;
      consDays++;
    });
    document.getElementById('s-consistency').textContent = consDays? Math.round(consSum/consDays) : '—';

    drawWeightChart(weights);
    drawBars7(days, logs, t);
  }

  function lastNDates(n){
    const arr=[]; const d=new Date();
    for(let i=n-1;i>=0;i--){ const x=new Date(d); x.setDate(d.getDate()-i); arr.push(x.toISOString().slice(0,10)); }
    return arr;
  }
  function drawWeightChart(weights){
    const svg = document.getElementById('weight-chart');
    if(weights.length<2){ svg.innerHTML = `<text x="400" y="130" fill="#8a8a8a" font-size="13" text-anchor="middle" font-family="Inter">Log at least 2 weight entries to see your trend.</text>`; return; }
    const W=800,H=260,P=30;
    const ys = weights.map(w=>w.kg);
    const min = Math.min(...ys)-0.5, max = Math.max(...ys)+0.5;
    const xs = weights.map((_,i)=> P + i*(W-2*P)/(weights.length-1));
    const yps = ys.map(v=> H-P - ((v-min)/(max-min))*(H-2*P));
    const path = xs.map((x,i)=> (i?'L':'M')+x.toFixed(1)+' '+yps[i].toFixed(1)).join(' ');
    const area = path + ` L${xs[xs.length-1]} ${H-P} L${xs[0]} ${H-P} Z`;
    svg.innerHTML = `
      <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#g)"/>
      <path d="${path}" fill="none" stroke="#22d3ee" stroke-width="2"/>
      ${xs.map((x,i)=>`<circle cx="${x}" cy="${yps[i]}" r="3" fill="#0a0a0a" stroke="#22d3ee" stroke-width="1.5"/>`).join('')}
      <text x="${P}" y="20" fill="#8a8a8a" font-size="11" font-family="Inter">${max.toFixed(1)} kg</text>
      <text x="${P}" y="${H-8}" fill="#8a8a8a" font-size="11" font-family="Inter">${min.toFixed(1)} kg</text>
    `;
  }
  function drawBars7(days, logs, t){
    const wrap = document.getElementById('bars-7');
    wrap.innerHTML = days.map(d=>{
      const entries = logs[d]||[];
      const tot = totals(entries);
      const pct = (k)=> t? Math.min(100,(tot[k]/t[k])*100) : 0;
      const lbl = new Date(d).toLocaleDateString(undefined,{weekday:'short'}).slice(0,2);
      return `
        <div class="col">
          <div class="stack" title="${d}">
            <div class="seg" style="height:${pct('p')*0.5}%;background:#22d3ee"></div>
            <div class="seg" style="height:${pct('c')*0.5}%;background:#7dd3fc;opacity:.7"></div>
            <div class="seg" style="height:${pct('f')*0.5}%;background:#a5f3fc;opacity:.5"></div>
          </div>
          <div class="lbl">${lbl}</div>
        </div>`;
    }).join('');
  }

  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

  window.Aahar = { initDashboard, initOnboarding, initProgress };
})();
