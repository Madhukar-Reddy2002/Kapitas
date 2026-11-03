/* =====================================================================================
   site.js: everything that is not the form or the estimator
   00 core (config, theme, dynamic CTA, analytics) | 05 reviews carousel | 06 questions (knowledge base + Ask box)
   | 08 floating UI (mobile CTA bar, scroll to top). Load this file FIRST: estimator.js and form.js need window.KAP.
   ===================================================================================== */

/* ============ 00 CORE: config, state, dynamic CTA, analytics ============
   EDIT HERE: phone numbers, amount limits, qualification thresholds, storage. Form options are at the top of form.js. */
window.KAP = (function(){
  var cfg = {
    phoneSales: "(646) 630-7618", phoneSalesTel: "+16466307618",
    amountMin: 5000, amountMax: 5000000, defaultAmount: 100000,
    typical: {years: 2, revenue: 250000, credit: 650},   /* qualifications used by the fit check and the Ask box */
    resumeDays: 7,             /* how long a started request is remembered in this browser */
    storageKey: "kap_blhp_v3",
    analytics: true,           /* pushes events to window.dataLayer (GTM) */
    theme: {storageKey: "kap_theme"},   /* the default theme is set in index.html (data-default-theme on <html>) */
  };
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function $(s,r){ return (r||document).querySelector(s); }
  function $$(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); }
  function el(tag, cls, txt){ var n = document.createElement(tag); if(cls) n.className = cls; if(txt!=null) n.textContent = txt; return n; }
  function digits(v){ return (v||"").replace(/[^0-9]/g,""); }
  function fmt(n){ return n ? Number(n).toLocaleString("en-US") : ""; }

  /* analytics: events are prefixed blhp_. No free text or personal data is ever sent. */
  function track(name, data){
    if(!cfg.analytics) return;
    try{ (window.dataLayer = window.dataLayer || []).push(Object.assign({event:"blhp_" + name}, data || {})); }catch(e){}
  }

  /* progress state, kept in this browser only for resumeDays. Business answers, plus (cfg.form.savePersonal) first and last name,
     phone, email and business street. SSN, date of birth, EIN, home address, credit score, files and signature are NEVER stored. */
  var state = {started:false, step:0, data:{}, resumed:false};
  function store(){ try{ return window.localStorage; }catch(e){ return null; } }
  function load(){
    var s = store(); if(!s) return;
    try{
      var raw = s.getItem(cfg.storageKey); if(!raw) return;
      var d = JSON.parse(raw);
      if(!d || !d.ts || Date.now() - d.ts > cfg.resumeDays * 864e5){ s.removeItem(cfg.storageKey); return; }
      if(d.started){ state.started = true; state.step = d.step|0; state.data = d.data || {}; state.resumed = true; }
    }catch(e){}
  }
  function save(){
    var s = store(); if(!s) return;
    try{ s.setItem(cfg.storageKey, JSON.stringify({started:state.started, step:state.step, data:state.data, ts:Date.now()})); }catch(e){}
  }
  function clear(){ var s = store(); try{ s && s.removeItem(cfg.storageKey); }catch(e){} state.started=false; state.step=0; state.data={}; state.resumed=false; refreshCta(); }
  function set(patch){ Object.keys(patch).forEach(function(k){ state[k] = patch[k]; }); if(state.started) save(); refreshCta(); }

  /* dynamic CTA: every [data-cta] switches to "continue" once the visitor has started */
  function refreshCta(){
    $$("[data-cta]").forEach(function(a){ a.textContent = state.started ? a.dataset["continue"] : a.dataset.start; });
  }
  function goToCard(){
    var card = $("#card"); if(card) card.scrollIntoView({behavior: reduce ? "auto" : "smooth", block:"center"});
  }
  /* theme: "purple" (default) or "light". The header button switches it and the choice is remembered in this browser. */
  function currentTheme(){ return document.documentElement.getAttribute("data-theme") || "purple"; }
  function applyTheme(t){
    document.documentElement.setAttribute("data-theme", t);
    var m = $('meta[name="theme-color"]'); if(m) m.setAttribute("content", t==="light" ? "#ffffff" : "#3C1B50");
    var b = $("#themeToggle");
    if(b){ var nxt = t==="light" ? "purple" : "light"; b.setAttribute("aria-label","Switch to the " + nxt + " theme"); b.setAttribute("title","Switch to the " + nxt + " theme"); }
  }
  function toggleTheme(){
    var t = currentTheme()==="light" ? "purple" : "light"; applyTheme(t);
    try{ window.localStorage.setItem(cfg.theme.storageKey, t); }catch(e){}
    track("theme", {theme:t});
  }
  applyTheme(currentTheme());
  var tt = $("#themeToggle"); if(tt) tt.addEventListener("click", toggleTheme);

  var api = {cfg:cfg, state:state, $:$, $$:$$, el:el, digits:digits, fmt:fmt, track:track, set:set, clear:clear, save:save, refreshCta:refreshCta, goToCard:goToCard, reduce:reduce};
  document.addEventListener("click", function(e){
    var a = e.target.closest ? e.target.closest("[data-cta]") : null;
    if(!a) return;
    e.preventDefault();
    track("cta_click", {location:a.dataset.loc || "", mode: state.started ? "continue" : "start"});
    if(typeof api.openForm === "function") api.openForm(); else goToCard();   /* openForm comes from section 09 */
  });

  load();
  refreshCta();
  document.addEventListener("DOMContentLoaded", refreshCta);
  return api;
})();

/* ============ 05 REVIEWS: looping carousel with reviewer avatars ============
   EDIT HERE: the REVIEWS list. t = text, n = name, s = source label, alt:true = dark purple card,
   p = optional photo URL. Add a photo ONLY with the reviewer's written consent. Without p (or if the image fails
   to load) the card shows a coloured initials avatar. The loop drifts slowly and pauses on hover, focus, touch,
   after any manual navigation and with the pause button. */
(function(){
  var K = window.KAP, $ = K.$, $$ = K.$$, el = K.el;
  var track = $("#carTrack"); if(!track) return;
  var REVIEWS = [
    {t:"Very quick and painless procedure to obtain working capital loan for the third time! Efficient and friendly!", n:"Karen C.", s:"Kapitus customer", alt:true},
    {t:"Nick and the Kapitus team got me funded quickly and had a great streamlined process.", n:"Matthew", s:"Google review"},
    {t:"As good as it gets! You truly feel like you have a teammate that cares about your business.", n:"Kyle Flowers", s:"Google review"},
    {t:"Kind, supportive and easy to work with.", n:"Dawn Lepore", s:"Google review", alt:true},
    {t:"Great Company, Great People!", n:"Sean Lowery", s:"Google review"},
    {t:"Excellent service! great platform and customer services 5 stars", n:"Joan Efres Nazario", s:"Google review"}
  ];
  var N = REVIEWS.length, COPIES = 3, SPEED = 34;          /* SPEED = px per second of the slow drift */
  var PALETTE = [[268,52],[292,46],[222,56],[190,62],[332,50]];   /* hue, saturation for initials avatars */
  var dotsEl = $("#dots"), pauseBtn = $("#carPause"), carEl = $("#car"), reduce = K.reduce;

  function initials(n){
    var w = n.replace(/\./g,"").trim().split(/\s+/);
    return (w[0].charAt(0) + (w.length > 1 ? w[w.length-1].charAt(0) : "")).toUpperCase();
  }
  function tone(n){ var h = 0, i; for(i = 0; i < n.length; i++) h = (h*31 + n.charCodeAt(i)) >>> 0; return PALETTE[h % PALETTE.length]; }
  function avatar(r){
    var a = el("div","av"), p = tone(r.n);
    a.style.background = "hsl(" + p[0] + " " + p[1] + "% 36%)";
    a.setAttribute("aria-hidden","true");
    a.appendChild(el("span",null,initials(r.n)));
    if(r.p){
      var im = document.createElement("img");
      im.alt = ""; im.width = 46; im.height = 46; im.loading = "lazy"; im.decoding = "async";
      im.addEventListener("error", function(){ im.remove(); });   /* falls back to the initials */
      im.src = r.p; a.appendChild(im);
    }
    if(/google/i.test(r.s)) a.appendChild(el("span","gb","G"));
    return a;
  }
  function card(r, i, real){
    var c = el("figure","rcard" + (r.alt ? " alt" : ""));
    if(real){ c.setAttribute("role","group"); c.setAttribute("aria-label",(i+1) + " of " + N); }
    else { c.setAttribute("aria-hidden","true"); }          /* the two extra copies exist only for the endless loop */
    var st = el("div","stars","★★★★★"); st.setAttribute("aria-label","5 stars");
    var foot = el("figcaption","rfoot"), who = el("div");
    who.appendChild(el("div","who",r.n)); who.appendChild(el("div","src",r.s));
    foot.appendChild(avatar(r)); foot.appendChild(who);
    c.appendChild(st); c.appendChild(el("blockquote",null,r.t)); c.appendChild(foot);
    return c;
  }
  var c0, d;
  for(c0 = 0; c0 < COPIES; c0++){ REVIEWS.forEach(function(r,i){ track.appendChild(card(r,i,c0 === 1)); }); }
  REVIEWS.forEach(function(r,i){
    d = el("button"); d.type = "button"; d.setAttribute("aria-label","Go to review " + (i+1));
    d.addEventListener("click", function(){ go(i); hold(); });
    dotsEl.appendChild(d);
  });

  /* ---- geometry (fractional, from real layout) ---- */
  function kids(){ return track.children; }
  function stepPx(){ var k = kids(); return k[1].getBoundingClientRect().left - k[0].getBoundingClientRect().left; }
  function setW(){ var k = kids(); return k[N].getBoundingClientRect().left - k[0].getBoundingClientRect().left; }
  function cardIdx(){ var s = stepPx(); return s > 0 ? Math.round(track.scrollLeft / s) : 0; }
  function curIdx(){ return ((cardIdx() % N) + N) % N; }

  /* ---- endless loop: the middle copy is home. Whenever we rest anywhere else, jump by one set (identical content, so invisible) ---- */
  var lastW = 0;
  function wrapIdle(){
    var W = setW(); if(!(W > 0)) return;
    var x = track.scrollLeft;
    if(x >= 2*W) track.scrollLeft = x - W; else if(x < W) track.scrollLeft = x + W;
  }
  function layout(){
    var W = setW(); if(!(W > 0)) return;
    track.scrollLeft = lastW ? (track.scrollLeft / lastW) * W : W;
    lastW = W; pos = track.scrollLeft; paintDots();
  }

  /* ---- navigation (shortest way round the loop) ---- */
  function scrollToCard(k){ track.scrollTo({left: k * stepPx(), behavior: reduce ? "auto" : "smooth"}); }
  function nudge(dir){ scrollToCard(cardIdx() + dir); }
  function go(i){
    var k = cardIdx(), dlt = i - curIdx();
    if(dlt > N/2) dlt -= N; else if(dlt < -N/2) dlt += N;
    scrollToCard(k + dlt);
  }
  function paintDots(){
    var i = curIdx();
    $$("button", dotsEl).forEach(function(b,k){ b.setAttribute("aria-current", String(k === i)); });
  }
  var raf = 0, idleT = null, drifting = false;
  track.addEventListener("scroll", function(){
    cancelAnimationFrame(raf); raf = requestAnimationFrame(paintDots);
    if(drifting) return;
    clearTimeout(idleT); idleT = setTimeout(wrapIdle, 140);
  }, {passive:true});
  $("#carNext").addEventListener("click", function(){ nudge(1); hold(); K.track("review_nav",{dir:"next"}); });
  $("#carPrev").addEventListener("click", function(){ nudge(-1); hold(); K.track("review_nav",{dir:"prev"}); });
  track.addEventListener("keydown", function(e){
    if(e.key === "ArrowRight"){ nudge(1); hold(); e.preventDefault(); }
    if(e.key === "ArrowLeft"){ nudge(-1); hold(); e.preventDefault(); }
  });

  /* ---- slow continuous drift (requestAnimationFrame) ---- */
  var pos = 0, lastT = 0, dRaf = 0;
  function frame(t){
    if(!drifting) return;
    var dt = Math.min(64, t - lastT) / 1000; lastT = t;
    pos += SPEED * dt;
    var W = setW(); if(W > 0 && pos >= 2*W) pos -= W;
    track.scrollLeft = pos;
    dRaf = requestAnimationFrame(frame);
  }
  function startDrift(){ if(drifting) return; drifting = true; wrapIdle(); pos = track.scrollLeft; lastT = performance.now(); dRaf = requestAnimationFrame(frame); }
  function stopDrift(){ drifting = false; cancelAnimationFrame(dRaf); }

  var hover = false, focused = false, held = false, userPaused = false, visible = false, holdT = null;
  function sync(){
    if(reduce || userPaused || hover || focused || held || !visible || document.hidden) stopDrift(); else startDrift();
  }
  function hold(){ held = true; sync(); clearTimeout(holdT); holdT = setTimeout(function(){ held = false; sync(); }, 8000); }
  carEl.addEventListener("mouseenter", function(){ hover = true; sync(); });
  carEl.addEventListener("mouseleave", function(){ hover = false; sync(); });
  carEl.addEventListener("focusin", function(){ focused = true; sync(); });
  carEl.addEventListener("focusout", function(){ focused = false; sync(); });
  track.addEventListener("touchstart", function(){ held = true; sync(); clearTimeout(holdT); }, {passive:true});
  track.addEventListener("touchend", function(){ clearTimeout(holdT); holdT = setTimeout(function(){ held = false; sync(); }, 6000); }, {passive:true});
  track.addEventListener("wheel", function(e){ if(Math.abs(e.deltaX) > Math.abs(e.deltaY)) hold(); }, {passive:true});
  document.addEventListener("visibilitychange", sync);
  pauseBtn.addEventListener("click", function(){
    userPaused = !userPaused;
    pauseBtn.setAttribute("aria-pressed", String(userPaused));
    pauseBtn.setAttribute("aria-label", userPaused ? "Resume automatic scrolling" : "Pause automatic scrolling");
    $("#pauseIco").innerHTML = userPaused ? '<path d="M7 5l12 7-12 7z"/>' : '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>';
    sync();
  });
  if("IntersectionObserver" in window){
    new IntersectionObserver(function(en){ visible = en[0].isIntersecting; sync(); },{threshold:0.35}).observe(carEl);
  } else { visible = true; sync(); }
  if(reduce){ pauseBtn.hidden = true; }
  if("ResizeObserver" in window){ new ResizeObserver(layout).observe(track); } else { window.addEventListener("resize", layout); }
  window.addEventListener("load", layout);
  layout();
})();

/* ============ 06 QUESTIONS (a): ASK BOX knowledge base ============
   Answers may only use Kapitus pages: the flexible-terms page, the /simple/ application, and the Business Loans page.
   check:true = needs Kapitus / compliance confirmation before launch (not shown to visitors).
   link:{text,href} adds a link under the answer. */
var DISCLOSURE = "Product availability is subject to confirmation of eligibility and underwriting. Products may vary based on credit profile and the state in which your business is located. Certain products may not be available in all states or to all customers. SBA loans, business lines of credit, invoice factoring, and purchase order financing are offered only by members of Kapitus\u2019s financing network and not by Kapitus directly.";
var KB = [
 {id:"qualify", q:"What do I need to qualify?",
  a:["Our qualifications are 2+ years in business, a 650+ credit score and $250K+ in revenue.","A financing specialist can tell you where you stand."],
  src:"flexible-terms page", kw:"qualify qualification requirement eligible eligibility need minimum criteria", rx:/(what (do|does) i need|qualif|eligib|requirement|criteria)/},
 {id:"credit", q:"What is the minimum credit score?",
  a:["At this time, the minimum credit score requirement for our small business financing is 650."],
  src:"flexible-terms page FAQ", kw:"credit score fico minimum", rx:/(credit score|fico|minimum score|bad credit|low credit)/, not:/(affect|hurt|impact|ding|pull|inquir|check)/},
 {id:"time", q:"How long do I need to be in business?",
  a:["2+ years in business is one of our qualifications, along with a 650+ credit score and $250K+ in revenue.","If you have less time in business, a financing specialist can look at your full picture and tell you where you stand."],
  src:"flexible-terms page", kw:"business years year long time established startup new", rx:/(how long.*(business|operat)|time in business|years in business|new business|start-?up)/},
 {id:"revenue", q:"How much revenue do I need?",
  a:["$250K+ in revenue is one of our qualifications. In the application you’ll choose your annual revenue range."],
  src:"flexible-terms page", kw:"revenue sales income annual minimum", rx:/(how much revenue|minimum revenue|annual revenue|sales)/},
 {id:"coowner", q:"What if I own less than 50% of the business?",
  a:["If your ownership is under 50%, we’ll ask for co-owner details to assess eligibility."],
  src:"application", kw:"own ownership percent partner coowner co-owner partners owners", rx:/(\bown(ership)?\b|\bpartners?\b|co-?owner|percent|%)/},
 {id:"amount", check:true, q:"How much funding can I get?",
  a:["We provide $5K to $5M in financing. The amount you’re offered depends on your business profile, so not every business qualifies for the full range."],
  src:"application and Business Loans page (the flexible-terms form shows a $100,000 minimum, so confirm the floor)", kw:"amount much funding borrow maximum max loan largest biggest smallest", rx:/(how much (can|could|will).*(get|borrow|fund|loan|approv)|maximum|max loan|loan amount|borrow)/},
 {id:"speed", q:"How fast can I get funded?",
  a:["Decisions can come in as little as 4 hours.","You can apply online in minutes, get approved in as little as 24 hours, and receive funding quickly."],
  src:"Kapitus landing pages (4-hour decisions) and flexible-terms page (24-hour approval)", kw:"fast quick speed days hours funded funding approval approved decision time when", rx:/(how (fast|quick|soon)|how long.*(fund|approv|get (the )?money|decision)|decision|turnaround|same day|24 hours|4 hours)/},
 {id:"offers", q:"Can I compare offers?",
  a:["Yes. You can compare up to 6 offers."],
  src:"Kapitus landing pages", kw:"compare offer offers multiple several options six", rx:/((multiple|more than one|several|compare).*(offer|option)|(how many|any) offers?|compare)/},
 {id:"terms", q:"What are the repayment terms?",
  a:["Business loan terms run from 6 to 24 months, with daily, weekly or monthly payment options."],
  src:"Business Loans page", kw:"term terms repayment repay payment payments monthly weekly daily months", rx:/(repay|payment (options|schedule|terms|frequency)|(daily|weekly|monthly) payments?|\bterms?\b|how long (to|do i) pay)/, not:/(terms (of|and)|conditions)/},
 {id:"fees", q:"Are there any hidden fees?",
  a:["No hidden fees. Our terms are transparent, with no surprises.","A financing specialist will walk you through the details of your offer."],
  src:"flexible-terms page", kw:"hidden fee fees surprise surprises transparent", rx:/(hidden|\bfees?\b|surprise|transparent)/},
 {id:"specialist", q:"How does a financing specialist help?",
  a:["Kapitus financing specialists take a consultative approach. We get to know you and your business to help you weigh your options and choose the best financing option for your current needs, without over-extending your business."],
  src:"flexible-terms page", kw:"specialist consultative advice advise guide options help works", rx:/(specialist|consultative|advis|how (do|does).*help)/},
 {id:"apply", q:"How do I apply?",
  a:["You apply online in minutes, one question at a time, and you can go back at any step.","A financing specialist may call to guide you personally."],
  src:"flexible-terms page and application", kw:"apply application process steps long minutes how", rx:/(how (do|can) i apply|how long.*(appl|take)|application process|how many (steps|questions)|minutes)/},
 {id:"docs", q:"Which documents do I need?",
  a:["Your 3 most recent, complete business bank statements. If your business is in California or New York, you’ll upload 4."],
  src:"application", kw:"document documents bank statement statements upload paperwork papers need", rx:/(document|bank statement|statements|paperwork|upload)/},
 {id:"later", check:true, q:"Can I apply without my bank statements handy?",
  a:["Yes. You can submit your application first, and we’ll email you a secure link to upload your statements later."],
  src:"Proposed feature: confirm before launch", kw:"later handy statements skip without proceed submit email link", rx:/(don.?t have.*(statement|document)|without.*(statement|document)|upload.*later|later)/},
 {id:"ssn", q:"Is my Social Security number safe?",
  a:["Your SSN is encrypted and securely protected."],
  src:"application", kw:"ssn social security number safe secure privacy protected encrypted", rx:/(ssn|social security|secure|safe|privacy|encrypt)/},
 {id:"creditpull", q:"Will applying affect my credit score?",
  a:["Kapitus’s request for your credit report doesn’t affect your personal credit score.","If your application is shared with other lenders, they may run their own checks, which can include hard credit pulls. This is explained in the application terms."],
  src:"application terms", kw:"credit pull inquiry hard soft affect hurt impact check report", rx:/(hard (pull|inquiry|check)|soft (pull|inquiry|check)|(affect|hurt|impact|ding).*credit|credit (check|pull|inquiry))/},
 {id:"banks", q:"How is working with an online lender different from a traditional bank?",
  a:["There are a variety of reasons that business owners will choose one type of provider over another, and each has its advantages and disadvantages."],
  link:{text:"Read: Traditional Bank vs. Alternative Lender", href:"https://kapitus.com/blog/manage-your-money/financing/traditional-bank-vs-alternative-lender-which-is-better-for-your-small-business-kapitus/"},
  src:"flexible-terms page FAQ", kw:"bank banks traditional online alternative lender difference different", rx:/(bank|traditional|alternative lender|online lender)/},
 {id:"options", q:"What other financing options can I access?",
  a:["Kapitus can help you explore a full suite of financing products and all your options at the same time. Additional options include a business line of credit, revenue-based financing, equipment financing, invoice factoring and purchase order financing."],
  disclosure:DISCLOSURE,
  src:"flexible-terms page FAQ", kw:"other financing options products sba line credit equipment factoring invoice purchase order revenue-based types", rx:/(sba|line of credit|equipment|factoring|invoice|purchase order|other (products|types|financing|options))/},
 {id:"person", q:"Can I talk to a person?",
  a:["Yes. Financing specialists are at (646) 630-7618. Customer service is at (800) 780-7133."],
  src:"Kapitus site", kw:"talk speak call person human phone representative contact agent", rx:/(talk|speak|call|phone|human|person|representative|contact)/},
 {id:"about", q:"How long has Kapitus been around?",
  a:["Kapitus has been providing financing solutions for small businesses since 2006. We’ve provided $10 billion in capital to 69,000 businesses, and Google reviewers rate us 4.6 out of 5 across 881 reviews."],
  src:"flexible-terms page and landing page", kw:"kapitus legit trust reputable founded since experience company about reviews", rx:/(legit|trust|reputable|scam|since|founded|experience|how old|reviews)/}
];

/* ============ 06 QUESTIONS (b): Ask engine (retrieves only from KB; never invents an answer) ============ */
(function(){
  var K = window.KAP, $ = K.$, $$ = K.$$, el = K.el, cfg = K.cfg;
  if(!$("#askForm")) return;
  var T = cfg.typical;

  /* original FAQ (static HTML in section 06): just track which questions people open */
  $$("#faqList details").forEach(function(d, i){ d.addEventListener("toggle", function(){ if(d.open) K.track("faq_open", {index:i}); }); });

  var STOP = new Set("the and for you your can are but not with have has had this that from what when how will would could should about any get got does did its into our out all one who why where than then them they there their been being was were just only also very more most some such like want need".split(" "));
  function stem(w){ return w.length>4 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0,-1) : w; }
  function tokens(s){ return String(s).toLowerCase().replace(/[^a-z0-9\s-]/g," ").split(/\s+/).filter(function(w){return w.length>2 && !STOP.has(w)}).map(stem); }
  KB.forEach(function(e){ e.kwSet = new Set(tokens(e.kw)); });
  function retrieve(q){
    var tk = tokens(q), low = q.toLowerCase();
    return KB.map(function(e){
      var s = 0; tk.forEach(function(t){ if(e.kwSet.has(t)) s += 2; });
      if(e.rx && e.rx.test(low)) s += 4;
      if(e.not && e.not.test(low)) s -= 6;
      return {e:e, s:s};
    }).sort(function(a,b){return b.s-a.s});
  }

  /* reads numbers people type about their own business: years, months, revenue (annual or monthly), credit score */
  var WORDNUM = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
  function parseProfile(raw){
    var text = " " + raw.toLowerCase().replace(/\bone and a half\b/g,"1.5").replace(/\ba year and a half\b/g,"1.5") + " ";
    text = text.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(years?|yrs?|months?)\b/g,function(m,w,u){return WORDNUM[w]+" "+u});
    text = text.replace(/\b(for|in business|about|almost|over|nearly)\s+a\s+year\b/g,function(m,w){return w+" 1 year"});
    var out = {}, m;
    if((m = text.match(/(?:credit|fico|score)[^0-9]{0,25}(\d{3})\b/)) || (m = text.match(/\b(\d{3})\s*(?:credit|fico|score)/))){
      var c = parseInt(m[1],10);
      if(c>=300 && c<=850){ out.credit = c; text = text.replace(m[0]," "); }
    }
    if((m = text.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/))){
      out.years = parseFloat(m[1]); out.yearsLabel = m[1] + (parseFloat(m[1])===1 ? " year" : " years");
      text = text.replace(m[0]," ");
      var mm = text.match(/(\d+)\s*months?\b/);
      if(mm){ out.years += parseInt(mm[1],10)/12; text = text.replace(mm[0]," "); }
    } else if((m = text.match(/(\d+)\s*months?\b/))){
      var mo = parseInt(m[1],10);
      out.years = mo/12; out.yearsLabel = mo + (mo===1 ? " month" : " months");
      text = text.replace(m[0]," ");
    } else if(/(less than|under|not even|just under)\s+(a\s+|1\s+)?year|just started|recently started|brand new/.test(text)){
      out.years = 0.5; out.yearsLabel = "under 1 year";
    }
    var re = /(\$)?\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|m|mm|thousand|million)?\b/g, cand;
    var revRx = /(revenue|sales|income|earn\w*|making|make|turnover|gross|annual|per year|a year)/g;
    var amtRx = /(need|loan|fund\w*|borrow\w*|looking for|amount|request\w*)/g;
    function last(rx, str){ var m2, pos = -1; rx.lastIndex = 0; while((m2 = rx.exec(str))){ pos = m2.index; } return pos; }
    function first(rx, str){ rx.lastIndex = 0; var m3 = rx.exec(str); return m3 ? m3.index : -1; }
    while((cand = re.exec(text))){
      var val = parseFloat(cand[2].replace(/,/g,"")), suf = cand[3];
      if(suf==="k"||suf==="thousand") val*=1e3; else if(suf==="m"||suf==="mm"||suf==="million") val*=1e6;
      if(!(cand[1] || suf || val>=10000)) continue;
      var end = cand.index + cand[0].length;
      var before = text.slice(Math.max(0,cand.index-30), cand.index), after = text.slice(end, end+20);
      var rb = last(revRx, before), ab = last(amtRx, before), label = null;
      if(rb>=0 || ab>=0){ label = rb > ab ? "rev" : "amt"; }
      else { var ra = first(revRx, after), aa = first(amtRx, after); if(ra>=0 && (aa<0 || ra<aa)) label = "rev"; else if(aa>=0) label = "amt"; }
      if(label==="rev" && out.revenue==null){
        var monthly = /(per month|a month|monthly|\/mo\b|each month|every month)/.test(after + " " + before.slice(-12));
        out.revenue = monthly ? val*12 : val; out.monthly = monthly;
      } else if(label==="amt" && out.amount==null){ out.amount = val; }
      else if(label===null && out.revenue==null){ out.revenue = val; }
    }
    return out;
  }
  function money(n){ if(n>=1e6) return "$" + (Math.round(n/1e5)/10) + "M"; if(n>=1e3) return "$" + Math.round(n/1e3) + "K"; return "$" + Math.round(n); }
  function profileAnswer(p){
    var rows = [], soft = [], creditLow = false;
    if(p.years!=null){ var ok = p.years >= T.years; rows.push({label:"Time in business", val:p.yearsLabel, note:"qualification "+T.years+"+ years", ok:ok, yes:"Meets", no:"Below"}); if(!ok) soft.push("time in business"); }
    if(p.revenue!=null){ var ok2 = p.revenue >= T.revenue; rows.push({label:"Annual revenue", val:money(p.revenue) + (p.monthly ? " (from monthly)" : ""), note:"qualification $"+Math.round(T.revenue/1000)+"K+", ok:ok2, yes:"Meets", no:"Below"}); if(!ok2) soft.push("annual revenue"); }
    if(p.credit!=null){ var ok3 = p.credit >= T.credit; creditLow = !ok3; rows.push({label:"Credit score", val:String(p.credit), note:"minimum "+T.credit, ok:ok3, yes:"Meets minimum", no:"Below minimum"}); }
    var paras = [];
    if(!creditLow && soft.length===0){
      paras.push("On the points you shared, you line up with our qualifications. Start an application and a specialist will take it from there.");
    } else {
      if(creditLow) paras.push("Our minimum credit score requirement is " + T.credit + ".");
      if(soft.length) paras.push("You’re under our usual range on " + soft.join(" and ") + ". A financing specialist can look at your full profile, and you can apply to find out where you stand.");
      else paras.push("If your score is close or has recently improved, a financing specialist can talk through where you stand.");
    }
    var missing = [];
    if(p.years==null) missing.push("time in business");
    if(p.revenue==null) missing.push("annual revenue");
    if(p.credit==null) missing.push("credit score");
    if(missing.length) paras.push("Add your " + missing.join(" and ") + " and I’ll compare those too.");
    return {rows:rows, paras:paras};
  }

  var answerEl = $("#answer"), input = $("#askInput");
  function actions(parent){
    var row = el("div","a-actions");
    var go = el("a","btn btn-primary btn-sm"); go.href = "#apply";
    go.setAttribute("data-cta",""); go.dataset.loc = "ask"; go.dataset.start = "Start my application"; go.dataset["continue"] = "Continue your application";
    go.textContent = K.state.started ? go.dataset["continue"] : go.dataset.start;
    var call = el("a","btn btn-ghost btn-sm","Call a specialist: " + cfg.phoneSales); call.href = "tel:" + cfg.phoneSalesTel;
    row.appendChild(go); row.appendChild(call); parent.appendChild(row);
  }
  function render(q){
    var card = el("div","a-card");
    card.appendChild(el("p","a-q","You asked: " + q));
    var body = el("div","a-body");
    var prof = parseProfile(q), hasProfile = prof.years!=null || prof.revenue!=null || prof.credit!=null;
    var ranked = retrieve(q), matched = "none";
    if(hasProfile){
      matched = "profile";
      var pa = profileAnswer(prof);
      body.appendChild(el("p",null,"Here’s how what you shared compares with our qualifications:"));
      var ul = el("ul","cmp");
      pa.rows.forEach(function(r){
        var li = el("li"); li.appendChild(el("span",null, r.label + ": " + r.val + " (" + r.note + ")"));
        li.appendChild(el("span","tag " + (r.ok?"meets":"below"), r.ok ? r.yes : r.no));
        ul.appendChild(li);
      });
      body.appendChild(ul);
      pa.paras.forEach(function(t){ body.appendChild(el("p",null,t)); });
      card.appendChild(body); actions(card);
    } else if(ranked[0].s >= 3){
      var e0 = ranked[0].e; matched = e0.id;
      e0.a.forEach(function(t){ body.appendChild(el("p",null,t)); });
      if(e0.link){ var p = el("p"); var a = el("a",null,e0.link.text); a.href = e0.link.href; a.target = "_blank"; a.rel = "noopener"; p.appendChild(a); body.appendChild(p); }
      if(e0.disclosure){ body.appendChild(el("p","disclosure",e0.disclosure)); }
      card.appendChild(body);
      if(["person","qualify","credit","time","specialist"].indexOf(matched)>-1) actions(card);
    } else {
      body.appendChild(el("p",null,"I don’t have an answer to that in the Kapitus information I can use, and I won’t guess."));
      body.appendChild(el("p",null,"A financing specialist can help at " + cfg.phoneSales + ", or try rephrasing your question."));
      card.appendChild(body); actions(card);
    }
    var rel = (hasProfile || ranked[0].s>=3) ? ranked.filter(function(x,i){ return x.s>=2 && (hasProfile || i>0); }).slice(0,2) : [];
    if(rel.length){
      var rb = el("div","related"); rb.appendChild(el("b",null,"You might also ask"));
      rel.forEach(function(x){
        var b = el("button","linkbtn",x.e.q); b.type = "button";
        b.addEventListener("click", function(){ input.value = x.e.q; submit(x.e.q); });
        rb.appendChild(b);
      });
      card.appendChild(rb);
    }
    answerEl.innerHTML = ""; answerEl.appendChild(card);
    K.track("ask_submit", {matched:matched});   /* only the matched topic id is sent, never the typed text */
  }
  function submit(q){
    q = (q||"").trim();
    if(!q){ input.focus(); return; }
    render(q);
    answerEl.scrollIntoView({behavior: K.reduce ? "auto" : "smooth", block:"nearest"});
  }
  $("#askForm").addEventListener("submit", function(e){ e.preventDefault(); submit(input.value); });
  input.addEventListener("keydown", function(e){ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); submit(input.value); } });
})();

/* ============ 08 FLOATING UI: slim mobile CTA bar + scroll to top (shows after ~50% scroll) ============ */
(function(){
  var K = window.KAP, $ = K.$;
  var bar = $("#stickyCta"), top = $("#toTop"); if(!bar || !top) return;
  var inCard=false, inFoot=false, typing=false;
  var mqMobile = window.matchMedia ? window.matchMedia("(max-width: 960px)") : {matches:false};
  function update(){
    var y = window.scrollY || window.pageYOffset;
    var inForm = document.body.classList.contains("form-mode");
    var showBar = mqMobile.matches && !inCard && !inFoot && !typing && !inForm && y > 200;
    bar.classList.toggle("show", showBar);
    document.body.classList.toggle("has-bar", showBar);
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var showTop = !inForm && max > 0 && (y / max) >= 0.5;
    top.classList.toggle("show", showTop);
    top.tabIndex = showTop ? 0 : -1;
  }
  if("IntersectionObserver" in window){
    new IntersectionObserver(function(en){ inCard = en[0].isIntersecting; update(); },{threshold:0.05}).observe($("#card"));
    new IntersectionObserver(function(en){ inFoot = en[0].isIntersecting; update(); },{threshold:0.01}).observe($("#fFoot"));
  }
  /* hide the bar while someone is typing so the on-screen keyboard keeps the whole view */
  document.addEventListener("focusin", function(e){ var t = e.target; typing = !!(t && (t.tagName==="TEXTAREA" || (t.tagName==="INPUT" && t.type!=="range"))); update(); });
  document.addEventListener("focusout", function(){ typing = false; setTimeout(update, 50); });
  window.addEventListener("scroll", update, {passive:true});
  window.addEventListener("resize", update);
  top.addEventListener("click", function(){
    K.track("scroll_top");
    window.scrollTo({top:0, behavior: K.reduce ? "auto" : "smooth"});
    var h = $("#top"); if(h){ h.setAttribute("tabindex","-1"); h.focus({preventScroll:true}); }
  });
  update();
})();
