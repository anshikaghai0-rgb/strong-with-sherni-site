// Personal REWIRE report page: www.strongwithsherni.com/r/<code>
const cleanUrl = u => String(u || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
const SBU = () => cleanUrl(process.env.SUPABASE_URL || process.env.CHALLENGE_SUPABASE_URL);
const SBK = () => String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.CHALLENGE_SUPABASE_KEY || '').trim();
const SITE = 'https://www.strongwithsherni.com';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default async function handler(req, res) {
  const c = String(req.query.c || '').toLowerCase();
  if (!/^[a-z0-9]{8}$/.test(c)) return res.status(404).send('Report not found');
  const r = await fetch(`${SBU()}/rest/v1/rewire_leads?code=eq.${c}&select=code,first,score,pct,target,grp,problems,answers,quiz_date`,
    { headers: { apikey: SBK(), Authorization: `Bearer ${SBK()}` } });
  const p = r.ok ? (await r.json())[0] : null;
  if (!p) return res.status(404).send('Report not found');
  const img = `${SBU()}/storage/v1/object/public/rewire`;
  const has = p.score != null;
  const rows = (p.problems || []).map(x => `<div class="row"><div class="p">${esc(x[0])}</div><div class="f"><b>${esc(String(x[1]).toUpperCase())}</b><span>${esc(x[2])}</span></div></div>`).join('');
  const ans = (p.answers || []).map(x => `<div class="ans${x[2] ? ' weak' : ''}"><span>${esc(x[0])}</span><b>${esc(x[1])}</b></div>`).join('');
  const title = `${p.first}, your Brain Report is ready`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="robots" content="noindex">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="Your personal Brain Fitness report from Strong With Sherni. Tap to see it.">
<meta property="og:image" content="${img}/${c}.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="${SITE}/r/${c}"><meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--bg:#FAF6EE;--ink:#1C2B24;--green:#1A3C2E;--gold:#BE9637;--red:#C0392B;--grey:#78807A;--line:#E2DBCC;--soft:#F0E9DA}
*{box-sizing:border-box;margin:0;padding:0}body{font-family:Poppins,system-ui,sans-serif;background:#ECE6D8;color:var(--ink)}
.wrap{max-width:480px;margin:0 auto;background:var(--bg);min-height:100vh}
header{display:flex;align-items:center;gap:12px;padding:18px 20px;border-bottom:1px solid var(--line)}header img{width:48px;height:48px;border-radius:12px;object-fit:cover}
header b{display:block;color:var(--green);font-size:16px}header span{font-size:13px;color:var(--grey)}
section{padding:22px 20px;border-bottom:1px solid var(--line)}
.hero{display:grid;grid-template-columns:1fr 150px;gap:14px;align-items:center}.hi{color:var(--grey);font-size:15px}.name{font-size:32px;font-weight:800;line-height:1.1;color:var(--gold)}
.ringbox{position:relative;width:150px;height:150px;margin:14px 0 4px}.ringbox svg{transform:rotate(-90deg)}
.ringnum{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}.ringnum b{font-size:46px;color:var(--green);line-height:1}.ringnum small{color:var(--grey);font-size:12px}
.coach{border-radius:18px;overflow:hidden;border:3px solid var(--gold);position:relative}.coach img{width:100%;display:block}
.coach span{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);background:var(--green);color:var(--bg);font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;white-space:nowrap}
.pill{display:inline-block;background:var(--soft);border-radius:14px;padding:8px 14px;font-size:14px;margin-top:8px}
.label{font-size:12px;font-weight:700;letter-spacing:.8px;color:var(--grey);text-transform:uppercase;margin-bottom:6px}
.problem{color:var(--red)}.problem h2{font-size:26px;font-weight:800}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px 0;border-top:1px solid var(--line)}.row .p{font-weight:500}
.row .f b{color:var(--gold);font-size:13px;display:block}.row .f span{font-size:13px;color:var(--grey)}
.bar{height:12px;background:var(--soft);border-radius:8px;overflow:hidden;margin:6px 0 14px}.bar i{display:block;height:100%;width:0;border-radius:8px;transition:width 1.4s cubic-bezier(.2,.8,.2,1)}
.bl{display:flex;justify-content:space-between;font-size:14px}
.ans{display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid var(--line);font-size:14px}.ans b{color:var(--green)}.ans.weak b{color:var(--red)}
a{color:var(--green)}.note{background:#F3EDE0}.note p{font-size:15px;line-height:1.6}
.poll{text-align:center}.poll h3{font-size:22px;margin-bottom:4px}.poll p{color:var(--grey);font-size:14px;margin-bottom:16px}
.btns{display:flex;gap:12px}.btns button{flex:1;padding:16px;border-radius:16px;font:600 18px Poppins,sans-serif;cursor:pointer;border:2px solid var(--green)}
.yes{background:var(--green);color:var(--bg)}.no{background:transparent;color:var(--green)}.thanks{display:none;padding:18px;border-radius:16px;background:var(--soft);font-size:16px;font-weight:500}
</style></head><body><div class="wrap">
<header><img src="/logo.png" alt=""><div><b>STRONG WITH SHERNI</b><span>Personal Brain Report</span></div></header>
<section class="hero"><div><div class="hi">Hi</div><div class="name">${esc(p.first)}</div>
${has ? `<div class="ringbox"><svg width="150" height="150"><circle cx="75" cy="75" r="62" fill="none" stroke="#E2DBCC" stroke-width="14"/><circle id="arc" cx="75" cy="75" r="62" fill="none" stroke="#BE9637" stroke-width="14" stroke-linecap="round" stroke-dasharray="389.6" stroke-dashoffset="389.6" style="transition:stroke-dashoffset 1.6s cubic-bezier(.2,.8,.2,1)"/></svg><div class="ringnum"><b id="num">0</b><small>out of 100</small></div></div>
<div class="pill"><b>Higher than ${esc(p.pct)}%</b> of people who took this test</div>` : `<p style="margin-top:12px;color:var(--grey)">Here's what your answers say about you.</p>`}
</div><div class="coach"><img src="${img}/coach.jpg" alt="Coach Vanshika"><span>Coach Vanshika</span></div></section>
<section><div class="label problem">Your main problem</div><div class="problem"><h2>${esc(String(p.grp).toUpperCase())}</h2></div><div style="height:10px"></div>
<div class="row" style="border:0;padding-top:0"><div class="label">What you told us</div><div class="label">How REWIRE fixes it</div></div>${rows}</section>
${has ? `<section><div class="label">In 60 days</div><div class="bl"><span>Today</span><b>${esc(p.score)}</b></div><div class="bar"><i data-w="${esc(p.score)}" style="background:#AAB2AC"></i></div>
<div class="bl"><b style="color:var(--green)">After REWIRE</b><b style="color:var(--green)">${esc(p.target)}+</b></div><div class="bar"><i data-w="${esc(p.target)}" style="background:var(--gold)"></i></div></section>` : ''}
<section><div class="label">Your answers · ${esc(p.quiz_date)}</div>${ans}
<p style="font-size:13px;color:var(--grey);margin-top:10px">From the <a href="https://form.jotform.com/vanshikasherni99/brain-fitness-score-">Brain Fitness Score test</a> you took with us.</p></section>
<section class="note"><div class="label">A note from Anshika · Team SWS</div><p>Hi ${esc(p.first)}, we made this from your own answers. If it sounds like you, <b>REWIRE</b> is built for exactly this: 60 days, personally coached by Vanshika, starting this January.</p></section>
<section class="poll"><h3>Want to know more?</h3><p>One tap, and we'll reach out to you shortly.</p>
<div class="btns" id="btns"><button class="yes" onclick="vote('yes')">Yes</button><button class="no" onclick="vote('no')">No</button></div><div class="thanks" id="thanks"></div></section>
</div><script>
var C=${JSON.stringify(c)},S=${has ? Number(p.score) : 'null'};
function post(d){try{fetch('/api/rewire',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d),keepalive:true})}catch(e){}}
function vote(v){post({action:'vote',c:C,v:v});document.getElementById('btns').style.display='none';var t=document.getElementById('thanks');t.style.display='block';
t.textContent=v==='yes'?"Amazing! We'll reach out to you shortly.":"No worries, thanks for letting us know.";}
post({action:'opened',c:C});
window.addEventListener('load',function(){setTimeout(function(){if(S!==null){document.getElementById('arc').style.strokeDashoffset=389.6*(1-S/100);
var n=document.getElementById('num'),i=0,iv=setInterval(function(){i+=2;n.textContent=Math.min(i,S);if(i>=S)clearInterval(iv)},26);}
document.querySelectorAll('.bar i').forEach(function(b){b.style.width=b.dataset.w+'%'});},300);});
</script></body></html>`);
}
