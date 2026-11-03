/* ============ 09 APPLICATION FORM: focus mode + 20 screens ============
   Follows the live /simple/ form (same questions, options, helper text and rules). Co-owner screens are skipped for now.
   Order: Business details (10) > Profile information (7) > Documents (3).
   EDIT HERE: STEPS (order, copy, options), the validators, TERMS_HTML. Options for the form live in cfg.form (section 00).
   PRIVACY: see KEEP below for the only answers remembered in this browser. SSN, DOB, EIN, home address, files and signature stay in memory only.
   Nothing is submitted unless cfg.form.submitUrl is set. */
/* =====================================================================================
   form.js: the application form (focus mode, 18 screens) and the small motivating pop-ups
   Follows the live /simple/ form (same questions, options, helper text and rules). Co-owner screens are skipped for now.
   Business details (11) > Profile information (5) > Documents (2). Needs site.js loaded first.
   EDIT HERE: F (options), STEPS (order, copy, options), CATEGORY_DONE (the "next up" messages), the validators, TERMS_HTML.
   PRIVACY: see KEEP below for the only answers remembered in this browser. SSN, DOB, EIN, home address, credit score, files
   and signature stay in memory only. Nothing is submitted unless F.submitUrl is set.
   ===================================================================================== */
(function(){
  "use strict";
  var K = window.KAP, $ = K.$, $$ = K.$$, el = K.el, cfg = K.cfg, st = K.state;
  var card = $("#card"); if(!card) return;

  /* ---------- OPTIONS ---------- */
  var F = cfg.form = Object.assign({
    autoAdvance: true,           /* single-choice screens move on by themselves after a tap */
    autoAdvanceDelay: 260,       /* ms */
    maxFileMB: 10,               /* per bank statement. Must match the real upload limit on the server */
    minFiles: 1,                 /* statements needed to continue (3 expected, 4 in CA and NY) */
    allowUploadLater: true,      /* "email me a link to upload later" option on the documents screen */
    mergeReviewAndSign: true,    /* one "Review and sign" screen. Set false to keep Acknowledgement and Signature separate (19 screens). Legal should approve the merge. */
    savePersonal: true,          /* remember first and last name, phone, email and business street in this browser (cfg.resumeDays). false = business answers only */
    zipLookupUrl: "https://api.zippopotam.us/us/",   /* ZIP > city and state. Only the 5-digit ZIP is sent. "" turns the lookup off */
    submitUrl: ""                /* WIRE-UP: endpoint that receives the finished application (JSON). Empty = preview only */
  }, cfg.form || {});

  var body=$("#fbody"), prog=$("#fprog"), meta=$("#fmeta"), catEl=$("#fcat"), cntEl=$("#fcount"),
      nav=$("#fnav"), backBtn=$("#fback"), nextBtn=$("#fnext"), closeBtn=$("#fclose");
  var reduce = K.reduce, formMode = false, finished = false, idx = 0, ctrl = null, leaving = false, advTimer = null;
  var A = {};                                   /* all answers (personal ones never leave memory) */
  /* ONLY these are remembered in this browser. NEVER add: SSN, date of birth, EIN, home address, credit score, files, signature. */
  var SAFE = ["amount","uses","usesOther","industry","industryOther","entity","entityOther","startMonth","startYear","ownership","revenue","loans","loanBalance","lender","dba","legal","multi","bizCity","bizState","bizZip","bizWeb"];
  var PERSONAL = ["first","last","phone","email","bizStreet"];   /* switched off by cfg.form.savePersonal = false */
  var KEEP = F.savePersonal ? SAFE.concat(PERSONAL) : SAFE;
  KEEP.forEach(function(k){ if(st.data && st.data[k]!=null) A[k] = st.data[k]; });
  function safeData(){ var o = {}; KEEP.forEach(function(k){ if(A[k]!=null) o[k] = A[k]; }); return o; }

  /* ---------- options (from the /simple/ form) ---------- */
  var CATS = ["Business details","Profile information","Documents"];
  var USES = ["Cash flow","Inventory","Payroll","Repairs or equipment","Expansion or new hires","Emergency"];
  var INDUSTRY = ["Construction","Business / IT","Health Care","Personal Services","Transportation","Education","Automotive","Real Estate","Food / Hospitality"];
  var ENTITY = ["Professional LLC","S Corporation / C Corporation","Professional Corporation (PC)","Sole Proprietorship"];
  var OWN = ["Less than 25%","25% to 50%","51% to 99%","100%"];
  var REV = ["$0 to $100K","$100K to $250K","$250K to $500K","$500K to $750K","$750K to $1M","$1M to $3M","$3M+"];
  var BAL = ["Below $10K","$10K to $50K","$50K to $100K","$100K to $500K","$500K+"];
  var CREDIT = ["599 and below","600 to 649","650 to 679","680 to 699","700 to 719","720 to 739","740 and above"];
  var REFERRAL = ["Internet search","ChatGPT or similar","Radio or Podcast","Social Media","Digital ads","TV or Streaming","Direct Mail","Referral / word of mouth","Other"];
  var STATES = "Alabama,Alaska,American Samoa,Arizona,Arkansas,California,Colorado,Connecticut,Delaware,District of Columbia,Florida,Georgia,Hawaii,Idaho,Illinois,Indiana,Iowa,Kansas,Kentucky,Louisiana,Maine,Maryland,Massachusetts,Michigan,Minnesota,Mississippi,Missouri,Montana,Nebraska,Nevada,New Hampshire,New Jersey,New Mexico,New York,North Carolina,North Dakota,Ohio,Oklahoma,Oregon,Pennsylvania,Puerto Rico,Rhode Island,South Carolina,South Dakota,Tennessee,Texas,Utah,Vermont,Virginia,Washington,West Virginia,Wisconsin,Wyoming".split(",");
  var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  function opt(list){ return list.map(function(x){ return {v:x, t:x}; }); }
  var NOW = new Date(), CY = NOW.getFullYear(), CM = NOW.getMonth()+1;
  function range(from, to){ var o = [], i; if(from<=to){ for(i=from;i<=to;i++) o.push({v:String(i),t:String(i)}); } else { for(i=from;i>=to;i--) o.push({v:String(i),t:String(i)}); } return o; }
  var MONTH_OPTS = MONTHS.map(function(m,i){ return {v:String(i+1), t:m}; });

  /* ---------- masks and validators ---------- */
  function fmtPhone(d){ if(d.length > 10 && d.charAt(0) === "1") d = d.slice(1); d = d.slice(0,10); if(d.length<4) return d ? "("+d : ""; if(d.length<7) return "("+d.slice(0,3)+") "+d.slice(3); return "("+d.slice(0,3)+") "+d.slice(3,6)+"-"+d.slice(6); }
  function fmtEIN(d){ d = d.slice(0,9); return d.length<3 ? d : d.slice(0,2)+"-"+d.slice(2); }
  function fmtSSN(d){ d = d.slice(0,9); if(d.length<4) return d; if(d.length<6) return d.slice(0,3)+"-"+d.slice(3); return d.slice(0,3)+"-"+d.slice(3,5)+"-"+d.slice(5); }
  function attachMask(input, fmtFn){
    var prev = input.value;
    input.addEventListener("input", function(e){
      var d = K.digits(input.value);
      if(e.inputType==="deleteContentBackward" && fmtFn(d)===prev) d = d.slice(0,-1);   /* deleting a separator removes the digit before it */
      var out = fmtFn(d); input.value = out; prev = out;
    });
  }
  var vName = function(label){ return function(v){ return (v.length>=2 && /^[A-Za-z][A-Za-z\s'.-]*$/.test(v)) ? "" : "Enter your " + label + "."; }; };
  var vText = function(msg){ return function(v){ return v.length>=2 ? "" : msg; }; };
  /* US phone: 10 digits (a leading +1 is ignored), area code and exchange start with 2-9, no N11 codes, no repeated digits, no 555-01xx */
  function vPhone(v){
    var d = K.digits(v), bad = "Please enter a valid US phone number.";
    if(d.length === 11 && d.charAt(0) === "1") d = d.slice(1);
    if(d.length !== 10) return bad;
    var area = d.slice(0,3), ex = d.slice(3,6), line = d.slice(6);
    if(!/^[2-9]/.test(area) || !/^[2-9]/.test(ex)) return bad;
    if(/^.11$/.test(area) || /^.11$/.test(ex)) return bad;
    if(/^(\d)\1{9}$/.test(d) || d === "2345678901" || d === "1234567890") return bad;
    if(ex === "555" && /^01\d\d$/.test(line)) return bad;
    return "";
  }
  function vEmail(v){ return (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && !/\.\./.test(v) && !/(^\.|\.@)/.test(v)) ? "" : "Please enter a valid email address."; }
  /* "Did you mean gmail.com?" hints for common typos. Never blocks. */
  var MAIL_DOMAINS = ["gmail.com","yahoo.com","outlook.com","hotmail.com","icloud.com","aol.com","comcast.net","msn.com","live.com","me.com","att.net","verizon.net","sbcglobal.net","protonmail.com"];
  var MAIL_FIX = {"gmial.com":"gmail.com","gmai.com":"gmail.com","gamil.com":"gmail.com","gnail.com":"gmail.com","gmail.co":"gmail.com","gmail.con":"gmail.com","gmail.cm":"gmail.com","yaho.com":"yahoo.com","yahooo.com":"yahoo.com","yahoo.con":"yahoo.com","hotmial.com":"hotmail.com","hotmail.con":"hotmail.com","outlok.com":"outlook.com","outlook.con":"outlook.com","icloud.con":"icloud.com","iclould.com":"icloud.com"};
  function lev(a, b){ var p = [], i, j; for(j = 0; j <= b.length; j++) p[j] = j; for(i = 1; i <= a.length; i++){ var prev = p[0]; p[0] = i; for(j = 1; j <= b.length; j++){ var t = p[j]; p[j] = Math.min(p[j] + 1, p[j-1] + 1, prev + (a.charAt(i-1) === b.charAt(j-1) ? 0 : 1)); prev = t; } } return p[b.length]; }
  function suggestEmail(v){
    var m = v.match(/^([^\s@]+)@([^\s@]+)$/); if(!m) return "";
    var dom = m[2].toLowerCase(); if(MAIL_DOMAINS.indexOf(dom) > -1) return "";
    var fix = MAIL_FIX[dom];
    if(!fix && dom.length >= 8){ for(var i = 0; i < MAIL_DOMAINS.length; i++){ if(lev(dom, MAIL_DOMAINS[i]) === 1){ fix = MAIL_DOMAINS[i]; break; } } }
    return fix ? m[1] + "@" + fix : "";
  }
  /* Date of birth: type it your way. 08/14/1996, 08-14-96, 08141996, Aug 14 1996, 14 Aug 1996 or 1996-08-14. Month first (USA). */
  var MON = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12}, MON_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function ageOn(y, m, d){ var a = CY - y; if(CM < m || (CM === m && NOW.getDate() < d)) a--; return a; }
  function parseDOB(raw){
    var s = String(raw || "").trim().toLowerCase().replace(/[,.]/g," ").replace(/\s+/g," "), m, d, yr, mt;
    var hint = "Enter your date of birth like 08/14/1996 or Aug 14 1996.";
    if(!s) return {error:hint};
    if((mt = s.match(/^([a-z]{3,9})\s*(\d{1,2})(?:st|nd|rd|th)?\s+(\d{2,4})$/))){ m = MON[mt[1].slice(0,3)]; d = +mt[2]; yr = mt[3]; }
    else if((mt = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})\s+(\d{2,4})$/))){ d = +mt[1]; m = MON[mt[2].slice(0,3)]; yr = mt[3]; }
    else if((mt = s.match(/^(\d{4})[\/\- ](\d{1,2})[\/\- ](\d{1,2})$/))){ yr = mt[1]; m = +mt[2]; d = +mt[3]; }
    else if((mt = s.match(/^(\d{1,2})[\/\- ](\d{1,2})[\/\- ](\d{2}|\d{4})$/))){ m = +mt[1]; d = +mt[2]; yr = mt[3]; }
    else if((mt = s.match(/^(\d{2})(\d{2})(\d{2}|\d{4})$/))){ m = +mt[1]; d = +mt[2]; yr = mt[3]; }
    else return {error:hint};
    if(!m || m < 1 || m > 12) return {error:"Please check the month."};
    var y;
    if(yr.length === 4){ y = +yr; }
    else {   /* two-digit year: pick the century that gives an age between 18 and 100, otherwise ask for 4 digits */
      var c1 = 2000 + (+yr), c2 = 1900 + (+yr);
      var ok1 = ageOn(c1,m,d) >= 18 && ageOn(c1,m,d) <= 100, ok2 = ageOn(c2,m,d) >= 18 && ageOn(c2,m,d) <= 100;
      y = ok2 ? c2 : (ok1 ? c1 : 0);
      if(!y) return {error:"Please type the 4-digit year, like 1996."};
    }
    if(d < 1 || d > new Date(y, m, 0).getDate()) return {error:"That date doesn’t exist. Please check the day."};
    var age = ageOn(y, m, d);
    if(age < 0 || age > 110) return {error:"Please check the year."};
    if(age < 18) return {error:"You must be at least 18 to apply.", age:age};
    return {y:y, m:m, d:d, age:age, iso: y + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d, echo: MON_SHORT[m-1] + " " + d + ", " + y + ", age " + age};
  }
  function vZip(v){ return (/^\d{5}$/.test(v) && !/^(\d)\1{4}$/.test(v)) ? "" : "Please enter a valid 5-digit ZIP code."; }
  function vEIN(v){ return K.digits(v).length===9 ? "" : "Please enter your business’s 9-digit EIN."; }
  function vSSN(v){ return K.digits(v).length===9 ? "" : "Please enter a valid Social Security Number."; }
  function vStreet(v){ return v.length>=3 ? "" : "Please enter a valid street address."; }
  function vCity(v){ return (v.length>=2 && !/\d/.test(v)) ? "" : "Please enter a valid city."; }
  function vState(v){ return v ? "" : "Select your state."; }
  function vWeb(v){ return (!v || /^(https?:\/\/)?[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(\/\S*)?$/.test(v)) ? "" : "Please enter a valid website, or leave this blank."; }

  /* ---------- small UI helpers ---------- */
  function icon(kind){
    return kind==="lock"
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.500 1 2.500h6c0-1 .2-1.700 1-2.500A6 6 0 0 0 12 3z"/></svg>';
  }
  function hintPill(text, kind){ var d = el("div","hintpill"); d.innerHTML = icon(kind); d.appendChild(el("span",null,text)); return d; }
  function field(def){
    var id = "f_" + def.key, w = el("div","ff"), l = el("label",null,def.label); l.setAttribute("for", id); w.appendChild(l);
    var i;
    if(def.options){
      i = document.createElement("select");
      var ph = document.createElement("option"); ph.value = ""; ph.textContent = def.placeholder || "Select"; i.appendChild(ph);
      def.options.forEach(function(o){ var op = document.createElement("option"); op.value = o.v; op.textContent = o.t; i.appendChild(op); });
    } else {
      i = document.createElement("input"); i.type = def.type || "text";
      if(def.inputmode) i.setAttribute("inputmode", def.inputmode);
      if(def.maxlength) i.maxLength = def.maxlength;
      if(def.placeholder) i.placeholder = def.placeholder;
    }
    i.id = id; i.name = def.key; i.setAttribute("autocomplete", def.autocomplete || "off");
    if(def.value!=null) i.value = def.value;
    if(def.prefix){ var pw = el("div","pfx"); pw.appendChild(el("span","pfx-s",def.prefix)); pw.appendChild(i); w.appendChild(pw); } else { w.appendChild(i); }
    var h = null; if(def.help){ h = el("div","ft",def.help); h.id = id+"_h"; w.appendChild(h); }
    var e = el("div","ferr"); e.id = id+"_e"; w.appendChild(e);
    i.setAttribute("aria-describedby", (h ? id+"_h " : "") + id+"_e");
    if(def.mask) attachMask(i, def.mask);
    var api = {wrap:w, el:i,
      get:function(){ return i.value.trim(); }, set:function(v){ i.value = v==null ? "" : v; },
      show:function(m){ e.textContent = m || ""; i.setAttribute("aria-invalid", m ? "true" : "false"); w.classList.toggle("bad", !!m); },
      check:function(){ var m = def.validate ? def.validate(api.get()) : ""; api.show(m); return !m; }};
    i.addEventListener("blur", function(){ if(api.get()) api.check(); });
    i.addEventListener(def.options ? "change" : "input", function(){ if(w.classList.contains("bad")) api.check(); });
    return api;
  }
  function validateAll(list, stepId){
    var ok = true, firstBad = null;
    list.forEach(function(f){ if(!f.check()){ ok = false; if(!firstBad) firstBad = f; } });
    if(!ok){ firstBad.el.focus(); K.track("form_error", {step:stepId}); }
    return ok;
  }
  function setNext(show){ nextBtn.hidden = !show; }
  function nice(n){   /* "karen" or "KAREN" > "Karen"; mixed case such as "McDonald" is left alone */
    n = String(n || "").trim();
    return (n === n.toLowerCase() || n === n.toUpperCase()) ? n.toLowerCase().replace(/(^|[\s-])([a-z])/g, function(m,a,b){ return a + b.toUpperCase(); }) : n;
  }

  /* ---------- screen builders: each returns {next(): validate + save, hideNext?} ---------- */
  var builders = {};

  builders.amount = function(s, box){
    var intro = !formMode;
    if(intro) box.appendChild(el("p","sub","Enter an amount to start. You can change it anytime."));
    var f = el("div","field"); f.id = "amountField";
    f.appendChild(el("span","cur","$")).setAttribute("aria-hidden","true");
    var inp = document.createElement("input"); inp.id = "amount"; inp.setAttribute("inputmode","numeric"); inp.setAttribute("autocomplete","off");
    inp.setAttribute("aria-label","Funding amount in US dollars"); inp.setAttribute("aria-describedby","amountErr");
    inp.value = K.fmt(A.amount || cfg.defaultAmount); f.appendChild(inp);
    var err = el("div","err"); err.id = "amountErr"; err.setAttribute("role","alert");
    box.appendChild(f); box.appendChild(err);
    inp.addEventListener("input", function(){ inp.value = K.fmt(K.digits(inp.value)); f.dataset.invalid = "false"; err.textContent = ""; });
    inp.addEventListener("focus", function(){ setTimeout(function(){ inp.select(); }, 0); });
    function commit(){
      var n = Number(K.digits(inp.value));
      if(!n || n < cfg.amountMin || n > cfg.amountMax){
        f.dataset.invalid = "true"; err.textContent = "Enter an amount between $" + K.fmt(cfg.amountMin) + " and $" + K.fmt(cfg.amountMax) + ".";
        inp.focus(); return false;
      }
      A.amount = n; return true;
    }
    if(intro){
      var b = el("button","btn btn-primary","Get started"); b.type = "button"; b.id = "start"; box.appendChild(b);
      var rn = el("p","range-note"); rn.innerHTML = "We provide <b>$5K to $5M</b> in financing. The amount depends on your business profile."; box.appendChild(rn);
      var go = function(){
        if(!commit()) return;
        K.track("amount_submit", {amount:A.amount});
        idx = 1; K.set({started:true}); persist(); enter();
      };
      b.addEventListener("click", go);
      inp.addEventListener("keydown", function(e){ if(e.key==="Enter"){ e.preventDefault(); go(); } });
    } else {
      inp.addEventListener("keydown", function(e){ if(e.key==="Enter"){ e.preventDefault(); next(); } });
    }
    return {next:commit, hideNext:intro, focus:function(){ inp.focus(); }};
  };

  /* single choice as chips; optional "Other" with a text field; auto-advance after a tap */
  builders.single = function(s, box){
    var val = A[s.key] || "", err = el("div","ferr"), chips = [];
    var grid = el("div","opts" + (s.cols ? " "+s.cols : "")); grid.setAttribute("role","group"); grid.setAttribute("aria-label", s.title);
    function mk(label){ var b = el("button","chip",label); b.type = "button"; b.setAttribute("aria-pressed", String(val===label)); b.addEventListener("click", function(){ choose(label); }); chips.push(b); grid.appendChild(b); }
    s.options.forEach(mk);
    if(s.other) mk("Other");
    box.appendChild(grid);
    var oi = null;
    if(s.other){
      oi = field({key:s.key+"_other", label:"Please specify", autocomplete:"off", validate:vText("Please describe your answer.")});
      oi.wrap.hidden = val !== "Other"; oi.set(A[s.key+"Other"] || ""); box.appendChild(oi.wrap);
    }
    box.appendChild(err);
    function choose(v){
      val = v; err.textContent = "";
      chips.forEach(function(b){ b.setAttribute("aria-pressed", String(b.textContent===v)); });
      if(oi) oi.wrap.hidden = (v !== "Other");
      if(v === "Other"){ setNext(true); oi.el.focus(); return; }
      A[s.key] = v; delete A[s.key+"Other"];
      if(s.auto && F.autoAdvance){
        setNext(false); clearTimeout(advTimer);
        advTimer = setTimeout(function(){ if(STEPS[idx]===s) next(); }, reduce ? 0 : F.autoAdvanceDelay);
      } else { setNext(true); }
    }
    return {
      next:function(){
        if(!val){ err.textContent = "Please select an option."; return false; }
        if(val==="Other"){ if(!oi.check()){ oi.el.focus(); return false; } A[s.key] = "Other"; A[s.key+"Other"] = oi.get(); }
        else { A[s.key] = val; }
        return true;
      },
      hideNext: !!(s.auto && F.autoAdvance && !A[s.key])
    };
  };

  builders.multi = function(s, box){
    box.appendChild(el("p","sub2","Select all that apply."));
    var vals = (A[s.key] || []).slice(), err = el("div","ferr"), chips = [];
    var grid = el("div","opts"); grid.setAttribute("role","group"); grid.setAttribute("aria-label", s.title);
    function mk(label){ var b = el("button","chip",label); b.type = "button"; b.setAttribute("aria-pressed", String(vals.indexOf(label)>-1)); b.addEventListener("click", function(){ toggle(label); }); chips.push(b); grid.appendChild(b); }
    s.options.forEach(mk); if(s.other) mk("Other");
    box.appendChild(grid);
    var oi = null;
    if(s.other){ oi = field({key:s.key+"_other", label:"Please specify", validate:vText("Please describe your answer.")}); oi.wrap.hidden = vals.indexOf("Other")<0; oi.set(A[s.key+"Other"] || ""); box.appendChild(oi.wrap); }
    box.appendChild(err);
    function toggle(label){
      var i = vals.indexOf(label); if(i>-1) vals.splice(i,1); else vals.push(label);
      chips.forEach(function(b){ if(b.textContent===label) b.setAttribute("aria-pressed", String(vals.indexOf(label)>-1)); });
      if(oi){ oi.wrap.hidden = vals.indexOf("Other")<0; if(label==="Other" && !oi.wrap.hidden) oi.el.focus(); }
      err.textContent = "";
    }
    return {next:function(){
      if(!vals.length){ err.textContent = "Select at least one option."; return false; }
      if(vals.indexOf("Other")>-1){ if(!oi.check()){ oi.el.focus(); return false; } A[s.key+"Other"] = oi.get(); } else { delete A[s.key+"Other"]; }
      A[s.key] = vals.slice(); return true;
    }};
  };

  builders.monthyear = function(s, box){
    var m = field({key:"startMonth", label:"Month", options:MONTH_OPTS, value:A.startMonth, validate:function(v){ return v ? "" : "Please select a month."; }});
    var y = field({key:"startYear", label:"Year", options:range(CY,1920), value:A.startYear, validate:function(v){ return v ? "" : "Please select a year."; }});
    var row = el("div","row2"); row.appendChild(m.wrap); row.appendChild(y.wrap); box.appendChild(row);
    return {next:function(){
      if(!validateAll([m,y], s.id)) return false;
      if(Number(y.get())===CY && Number(m.get())>CM){ m.show("Please choose a date in the past."); m.el.focus(); return false; }
      A.startMonth = m.get(); A.startYear = y.get(); return true;
    }};
  };

  builders.loans = function(s, box){
    var val = A.loans || "", err = el("div","ferr");
    var grid = el("div","opts one"); var chips = [];
    [["No","No, I don’t have existing loans"],["Yes","Yes, I have existing loans"]].forEach(function(o){
      var b = el("button","chip",o[1]); b.type = "button"; b.dataset.v = o[0]; b.setAttribute("aria-pressed", String(val===o[0])); chips.push(b); grid.appendChild(b);
      b.addEventListener("click", function(){ choose(o[0]); });
    });
    box.appendChild(grid);
    var more = el("div","fbox"); more.hidden = val !== "Yes";
    var lender = field({key:"lender", label:"Lender name", autocomplete:"organization", value:A.lender, validate:vText("Please enter your lender’s name.")});
    var balWrap = el("div"); balWrap.appendChild(el("div","sub2","Loan balance"));
    var bal = el("div","opts"); bal.setAttribute("role","group"); bal.setAttribute("aria-label","Loan balance"); var balChips = [];
    var balVal = A.loanBalance || "";
    BAL.forEach(function(x){ var b = el("button","chip",x); b.type = "button"; b.setAttribute("aria-pressed", String(balVal===x)); b.addEventListener("click", function(){ balVal = x; balChips.forEach(function(c){ c.setAttribute("aria-pressed", String(c.textContent===x)); }); err.textContent = ""; }); balChips.push(b); bal.appendChild(b); });
    balWrap.appendChild(bal); more.appendChild(lender.wrap); more.appendChild(balWrap); box.appendChild(more); box.appendChild(err);
    function choose(v){
      val = v; err.textContent = "";
      chips.forEach(function(b){ b.setAttribute("aria-pressed", String(b.dataset.v===v)); });
      more.hidden = (v !== "Yes");
      if(v==="No"){ A.loans = "No"; delete A.lender; delete A.loanBalance;
        if(F.autoAdvance){ setNext(false); clearTimeout(advTimer); advTimer = setTimeout(function(){ if(STEPS[idx]===s) next(); }, reduce ? 0 : F.autoAdvanceDelay); } else setNext(true);
      } else { setNext(true); lender.el.focus(); }
    }
    return {next:function(){
      if(!val){ err.textContent = "Please select an option."; return false; }
      if(val==="Yes"){
        if(!lender.check()){ lender.el.focus(); return false; }
        if(!balVal){ err.textContent = "Please select your loan balance."; return false; }
        A.lender = lender.get(); A.loanBalance = balVal;
      }
      A.loans = val; return true;
    }, hideNext: !!(F.autoAdvance && val !== "Yes")};
  };

  builders.bizname = function(s, box){
    var dba = field({key:"dba", label:"DBA (business name)", autocomplete:"organization", value:A.dba,
      help:"DBA means “doing business as”. It’s the name your customers know you by. If it’s the same as your legal name, enter it again.", validate:vText("Please enter your business name.")});
    var legal = field({key:"legal", label:"Legal business name", autocomplete:"organization", value:A.legal,
      help:"The name your business is registered under. It’s on your tax return and business license.", validate:vText("Please enter your legal business name.")});
    box.appendChild(dba.wrap); box.appendChild(legal.wrap);
    var q = el("div"); q.appendChild(el("div","sub2","Do you own multiple locations or businesses?"));
    var grid = el("div","opts two"), mv = A.multi || "", chips = [], err = el("div","ferr");
    ["Yes","No"].forEach(function(x){
      var b = el("button","chip",x); b.type = "button"; b.setAttribute("aria-pressed", String(mv===x));
      b.addEventListener("click", function(){ mv = x; chips.forEach(function(c){ c.setAttribute("aria-pressed", String(c.textContent===x)); }); err.textContent = ""; });
      chips.push(b); grid.appendChild(b);
    });
    q.appendChild(grid); q.appendChild(err); box.appendChild(q);
    return {next:function(){
      var ok = validateAll([dba, legal], s.id);
      if(!mv){ err.textContent = "Please select an option."; ok = false; }
      if(!ok) return false;
      A.dba = dba.get(); A.legal = legal.get(); A.multi = mv; return true;
    }};
  };

  builders.ein = function(s, box){
    var ein = field({key:"ein", label:"EIN / Tax ID", inputmode:"numeric", maxlength:10, mask:fmtEIN, value:A.ein, placeholder:"00-0000000",
      help:"EIN stands for Employer Identification Number. It’s also called your Tax ID, and it has 9 digits. We use it to verify your business.", validate:vEIN});
    box.appendChild(ein.wrap);
    var d = el("details","finder"); d.appendChild(el("summary",null,"Where do I find my EIN?"));
    var ul = el("ul");
    ["Your latest business tax return.","The IRS letter you received when you registered your business (CP 575 or 147C).","Some banks print it on business statements or account paperwork, usually near the business name at the top."].forEach(function(t){ ul.appendChild(el("li",null,t)); });
    d.appendChild(ul); box.appendChild(d);
    return {next:function(){ if(!validateAll([ein], s.id)) return false; A.ein = ein.get(); return true; }};
  };

  builders.address = function(s, box){
    var p = s.prefix, fs = {};
    var same = null;
    if(s.sameAs){
      var lab = el("label","chk"); same = document.createElement("input"); same.type = "checkbox"; same.checked = !!A.homeSame;
      lab.appendChild(same); lab.appendChild(el("span",null,"Same as business address")); box.appendChild(lab);
    }
    /* order: ZIP first. City and state fill themselves from the ZIP and stay editable, so only ZIP and street are typed. */
    fs.zip = field({key:p+"Zip", label:"ZIP code", inputmode:"numeric", maxlength:5, mask:function(d){ return d.slice(0,5); }, autocomplete:"postal-code", value:A[p+"Zip"], validate:vZip});
    fs.city = field({key:p+"City", label:"City", autocomplete:"address-level2", value:A[p+"City"], validate:vCity});
    fs.state = field({key:p+"State", label:"State", options:opt(STATES), placeholder:"Select state", autocomplete:"address-level1", value:A[p+"State"], validate:vState});
    fs.street = field({key:p+"Street", label:"Street address", autocomplete:"address-line1", value:A[p+"Street"], validate:vStreet});
    var zst = el("div","ft"); zst.setAttribute("aria-live","polite"); fs.zip.wrap.appendChild(zst);
    box.appendChild(fs.zip.wrap);
    var row = el("div","row2"); row.appendChild(fs.city.wrap); row.appendChild(fs.state.wrap); box.appendChild(row);
    box.appendChild(fs.street.wrap);
    var web = null;
    if(s.website){ web = field({key:"bizWeb", label:"Website (optional)", inputmode:"url", autocomplete:"url", value:A.bizWeb, validate:vWeb}); box.appendChild(web.wrap); }

    var touched = {city:false, state:false}, lastZip = "", ac = null;
    fs.city.el.addEventListener("input", function(){ touched.city = true; });
    fs.state.el.addEventListener("change", function(){ touched.state = true; });
    function stateName(n){ var i; n = String(n || "").toLowerCase(); for(i = 0; i < STATES.length; i++){ if(STATES[i].toLowerCase() === n) return STATES[i]; } return ""; }
    function fillFrom(z, res){
      [["city",res.city],["state",res.state]].forEach(function(x){
        var k = x[0], v = x[1], cur = k==="state" ? fs.state.el.value : fs.city.get();
        if(v && (!cur || !touched[k] || (lastZip && lastZip !== z))){ fs[k].set(v); fs[k].show(""); touched[k] = false; }
      });
      lastZip = z;
      zst.textContent = "City and state filled in from your ZIP. You can edit them.";
      if(document.activeElement === fs.zip.el && !fs.street.get()){ fs.street.el.focus(); }   /* next thing to type is the street */
      K.track("zip_lookup", {ok:true});
    }
    function lookup(z){
      if(!F.zipLookupUrl || !window.fetch) return;
      if(ac){ try{ ac.abort(); }catch(e){} }
      ac = window.AbortController ? new AbortController() : null;
      var t = setTimeout(function(){ if(ac){ try{ ac.abort(); }catch(e){} } }, 4000);
      zst.textContent = "Looking up your ZIP...";
      fetch(F.zipLookupUrl + z, ac ? {signal:ac.signal} : {})
        .then(function(r){ if(!r.ok) throw new Error("none"); return r.json(); })
        .then(function(j){
          var pl = j && j.places && j.places[0]; if(!pl) throw new Error("none");
          if(fs.zip.get() === z) fillFrom(z, {city:pl["place name"], state:stateName(pl["state"])});
        })
        .catch(function(){ if(fs.zip.get() === z){ zst.textContent = "We couldn’t find that ZIP. Please enter your city and state."; K.track("zip_lookup", {ok:false}); } })
        .then(function(){ clearTimeout(t); });
    }
    fs.zip.el.addEventListener("input", function(){
      var z = K.digits(fs.zip.el.value);
      if(z.length === 5) lookup(z); else { zst.textContent = ""; if(ac){ try{ ac.abort(); }catch(e){} } }
    });

    function lock(on){
      ["street","city","state","zip"].forEach(function(k){
        var f = fs[k], map = {street:"bizStreet",city:"bizCity",state:"bizState",zip:"bizZip"};
        if(on){ f.set(A[map[k]] || ""); }
        if(k==="state") f.el.disabled = on; else f.el.readOnly = on;
        f.show("");
      });
      zst.textContent = "";
    }
    if(same){ lock(same.checked); same.addEventListener("change", function(){ lock(same.checked); if(!same.checked){ ["street","city","state","zip"].forEach(function(k){ fs[k].set(""); }); touched = {city:false, state:false}; lastZip = ""; } }); }
    return {next:function(){
      var list = [fs.zip,fs.city,fs.state,fs.street]; if(web) list.push(web);
      if(!validateAll(list, s.id)) return false;
      A[p+"Street"] = fs.street.get(); A[p+"City"] = fs.city.get(); A[p+"State"] = fs.state.el.value; A[p+"Zip"] = fs.zip.get();
      if(web) A.bizWeb = web.get(); if(same) A.homeSame = same.checked;
      return true;
    }};
  };

  /* fields-only screens (name, contact) */
  builders.fields = function(s, box){
    var list = s.fields.map(function(d){ var o = Object.assign({}, d); o.value = A[d.key]; return field(o); });
    var grid = el(list.length===2 ? "row2" : "fbox");
    list.forEach(function(f){ grid.appendChild(f.wrap); }); box.appendChild(grid);
    if(s.note) box.appendChild(el("p","ft",s.note));
    return {next:function(){ if(!validateAll(list, s.id)) return false; list.forEach(function(f, i){ A[s.fields[i].key] = f.get(); }); return true; }};
  };

  builders.contact = function(s, box){
    var first = field({key:"first", label:"First name", autocomplete:"given-name", value:A.first, validate:vName("first name")});
    var last = field({key:"last", label:"Last name", autocomplete:"family-name", value:A.last, validate:vName("last name")});
    var phone = field({key:"phone", label:"Mobile phone number", type:"tel", inputmode:"tel", autocomplete:"tel", mask:fmtPhone, maxlength:17, placeholder:"(555) 234-5678", value:A.phone, validate:vPhone});
    var email = field({key:"email", label:"Email address", type:"email", inputmode:"email", autocomplete:"email", value:A.email, validate:vEmail});
    var row = el("div","row2"); row.appendChild(first.wrap); row.appendChild(last.wrap);
    box.appendChild(row); box.appendChild(phone.wrap); box.appendChild(email.wrap);
    var sug = el("div","suggest"); sug.hidden = true; email.wrap.appendChild(sug);
    email.el.addEventListener("input", function(){ sug.hidden = true; });
    email.el.addEventListener("blur", function(){
      var v = email.get(), fix = (v && !vEmail(v)) ? suggestEmail(v) : "";
      if(!fix){ sug.hidden = true; return; }
      sug.innerHTML = ""; sug.appendChild(document.createTextNode("Did you mean "));
      var b = el("button","linkbtn",fix); b.type = "button";
      b.addEventListener("click", function(){ email.set(fix); email.show(""); sug.hidden = true; });
      sug.appendChild(b); sug.appendChild(document.createTextNode("?")); sug.hidden = false;
    });
    var dob = dobControl(box);
    if(s.note) box.appendChild(el("p","ft",s.note));
    return {next:function(){
      if(!validateAll([first, last, phone, email, dob], s.id)) return false;
      A.first = first.get(); A.last = last.get(); A.phone = phone.get(); A.email = email.get();
      var r = parseDOB(dob.get()); A.dob = r.iso; A.dobText = dob.get(); return true;
    }};
  };

  /* date of birth: one box that takes 08/14/1996, 08-14-96, 081496 or Aug 14 1996, with a live echo of what we understood */
  function dobControl(box){
    var f = field({key:"dob", label:"Date of birth", autocomplete:"bday", placeholder:"08/14/1996", maxlength:20, value:A.dobText || "",
      help:"Type it your way: 08/14/1996, 08-14-96 or Aug 14 1996.", validate:function(v){ return parseDOB(v).error || ""; }});
    box.appendChild(f.wrap);
    var echo = el("div","echo"); echo.setAttribute("aria-live","polite"); box.appendChild(echo);
    function paint(){ var r = f.get() ? parseDOB(f.get()) : {}; echo.textContent = r.echo || ""; echo.classList.toggle("on", !!r.echo); }
    f.el.addEventListener("input", function(e){
      var v = f.el.value;
      if(/^\d+$/.test(v) && e.inputType !== "deleteContentBackward"){   /* digits only: add the slashes for them */
        var dg = v.slice(0,8);
        f.el.value = dg.length < 3 ? dg : (dg.length < 5 ? dg.slice(0,2) + "/" + dg.slice(2) : dg.slice(0,2) + "/" + dg.slice(2,4) + "/" + dg.slice(4));
      }
      paint();
    });
    paint();
    return f;
  }

  var EYE_ON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 5.2A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a10.5 10.5 0 0 0 5.2-1.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/></svg>';
  builders.ssn = function(s, box){
    var f = field({key:"ssn", label:"Social Security Number", type:"password", inputmode:"numeric", maxlength:11, mask:fmtSSN, autocomplete:"off", value:A.ssn, placeholder:"000-00-0000", validate:vSSN});
    box.appendChild(f.wrap);
    f.el.setAttribute("spellcheck","false"); f.el.setAttribute("autocapitalize","off"); f.el.setAttribute("autocorrect","off");
    /* the eye sits inside the right edge of the box; the field always starts hidden */
    var wrap = el("div","eyewrap"); f.el.parentNode.insertBefore(wrap, f.el); wrap.appendChild(f.el);
    var t = el("button","eyebtn"); t.type = "button";
    function setShown(on){
      f.el.type = on ? "text" : "password";
      t.innerHTML = on ? EYE_OFF : EYE_ON;
      t.setAttribute("aria-pressed", String(on));
      t.setAttribute("aria-label", on ? "Hide Social Security number" : "Show Social Security number");
    }
    setShown(false);
    t.addEventListener("click", function(){ setShown(f.el.type === "password"); f.el.focus(); });
    wrap.appendChild(t);
    function onVis(){   /* hide again if the tab is switched away; stop listening once this screen is gone */
      if(!document.body.contains(f.el)){ document.removeEventListener("visibilitychange", onVis); return; }
      if(document.hidden) setShown(false);
    }
    document.addEventListener("visibilitychange", onVis);
    return {next:function(){ if(!validateAll([f], s.id)) return false; A.ssn = f.get(); setShown(false); return true; }};
  };

  /* documents: drag and drop or select, with visible errors (type, size, count) */
  builders.upload = function(s, box){
    var need = (A.bizState==="California" || A.bizState==="New York") ? 4 : 3;
    A.files = A.files || [];
    box.appendChild(el("p","sub2","Please upload your " + need + " most recent, complete bank statements for your business."));
    box.appendChild(el("p","sub2","You can download recent statements from your online banking portal. PDF format preferred."));
    var drop = el("div","drop");
    drop.appendChild(el("p",null,"Choose a file or drag & drop it here"));
    drop.appendChild(el("small",null,"JPEG, PNG and PDF, up to " + F.maxFileMB + " MB each"));
    var pick = el("button","btn btn-ghost btn-sm","Select files"); pick.type = "button";
    var fi = document.createElement("input"); fi.type = "file"; fi.multiple = true; fi.hidden = true;
    fi.accept = ".pdf,.jpg,.jpeg,.png,image/jpeg,image/png,application/pdf";
    drop.appendChild(pick); drop.appendChild(fi); box.appendChild(drop);
    var err = el("div","ferr"); err.setAttribute("role","alert"); box.appendChild(err);
    var list = el("ul","flist"); box.appendChild(list);
    var count = el("div","fcount2"); box.appendChild(count);
    var later = null;
    if(F.allowUploadLater){
      var lab = el("label","chk"); later = document.createElement("input"); later.type = "checkbox"; later.checked = !!A.uploadLater;
      lab.appendChild(later); lab.appendChild(el("span",null,"I don’t have these handy. Email me a secure link to upload them later.")); box.appendChild(lab);
      later.addEventListener("change", function(){ A.uploadLater = later.checked; err.textContent = ""; });
    }
    function size(n){ return n < 1048576 ? Math.max(1,Math.round(n/1024)) + " KB" : (n/1048576).toFixed(1) + " MB"; }
    function paint(){
      list.innerHTML = "";
      A.files.forEach(function(f, i){
        var li = el("li"); var left = el("span","nm",f.name); left.appendChild(el("span","sz",size(f.size)));
        var rm = el("button",null,"Remove"); rm.type = "button"; rm.setAttribute("aria-label","Remove " + f.name);
        rm.addEventListener("click", function(){ A.files.splice(i,1); err.textContent = ""; paint(); });
        li.appendChild(left); li.appendChild(rm); list.appendChild(li);
      });
      count.textContent = A.files.length + " of " + need + " files added";
    }
    function add(fl){
      var msgs = [];
      Array.prototype.forEach.call(fl, function(f){
        var ext = (f.name.split(".").pop() || "").toLowerCase();
        if(["pdf","jpg","jpeg","png"].indexOf(ext) < 0){ msgs.push(f.name + " isn’t a supported type. Use PDF, JPG or PNG."); return; }
        if(f.size > F.maxFileMB * 1048576){ msgs.push(f.name + " is " + size(f.size) + ". The limit is " + F.maxFileMB + " MB per file."); return; }
        if(A.files.some(function(x){ return x.name===f.name && x.size===f.size; })){ return; }
        if(A.files.length >= need){ msgs.push("You can add up to " + need + " files."); return; }
        A.files.push(f);
      });
      err.textContent = msgs.join(" "); paint();
    }
    pick.addEventListener("click", function(){ fi.click(); });
    fi.addEventListener("change", function(){ add(fi.files); fi.value = ""; });
    ["dragenter","dragover"].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.add("over"); }); });
    ["dragleave","drop"].forEach(function(ev){ drop.addEventListener(ev, function(e){ e.preventDefault(); drop.classList.remove("over"); }); });
    drop.addEventListener("drop", function(e){ if(e.dataTransfer && e.dataTransfer.files) add(e.dataTransfer.files); });
    paint();
    return {next:function(){
      if(A.files.length >= F.minFiles || (later && later.checked)){ return true; }
      err.textContent = "Add at least " + F.minFiles + " statement" + (F.minFiles>1 ? "s" : "") + (later ? ", or choose to upload them later." : "."); return false;
    }};
  };

  /* acknowledgement: terms must be scrolled before the checkbox works */
  var TERMS_HTML = `
<p>The Business and Owner(s) identified above (collectively, the “Applicant”) each represent, acknowledge and agree to the Representations and Acknowledgments set forth below. In processing this application, Kapitus may request credit reports from one or more credit bureaus on the Business and Owner(s) (the Owners(s)’ personal credit score will not be affected by Kapitus’s request). Applicant further represents, acknowledges and agrees to the Consents Relating to the Referral of Application to Third-Parties, the Consent to Use Electronic Records and Signatures, and the Promotions and the Services Notice set forth below. Please note that you are not required to consent to be contacted for marketing or promotional purposes in order to qualify for financing or obtain products or services from Kapitus.</p>
<p><u>Representations and Acknowledgments of Applicant</u></p>
<p>1. All information and documents provided by the Applicant directly or indirectly, in connection with or as part of this application are true, accurate and complete;<br>
2. Applicant will immediately notify Kapitus and/or its subsidiaries, affiliates or agents (collectively, “Kapitus”) of any error or change in such information or in the Applicant’s financial condition;<br>
3. Kapitus is authorized to request and receive consumer or personal, and business or entity, credit reports from one or more credit bureaus, such as TransUnion, Experian or Equifax, investigative reports about the Applicant from third party data aggregators, and other financial information about Applicant, including credit card processor statements and bank statements, directly from credit bureaus, banks, creditors or other third parties, and to verify through third-party sources all information contained, provided, or obtained in connection with the Application;<br>
4. Applicant waives and releases any claims against Kapitus arising from any act or omission relating to Kapitus’s request for, receipt of or release of information as authorized by this Application;<br>
5. Each Owner represents that they are authorized to execute any documents on behalf of the Business and to bind the Business;<br>
6. Applicant agrees to conduct business by electronic means, including without limitation the receipt by email of agreements, communications, notices, authorizations, disclosures (including any and all disclosures and/or notices required to be given by applicable law), and any other records we provide (collectively, “Communications”). Applicant understands and acknowledges that electronic signatures shall have the same legal effect as if signed in ink and will be deemed valid, enforceable, and binding.</p>
<p><u>Consents Relating to the Referral of the Application to Third-Parties for Purposes of Securing Financing</u></p>
<p>1. Applicant authorizes Kapitus to provide the Application, including all information and documents obtained (such as, without limitation, information obtained from credit reports) to third-party financial institutions, lenders, loan servicers, purchasers of accounts receivable, factoring companies, equipment finance or leasing companies, brokers or other similar sources of commercial financing (collectively, “Third-Parties”) in connection with or following the processing of this Application for financing by Kapitus.<br>
2. Applicant authorizes the Third-Parties to whom the Application is provided to, separately and on their own behalf, request and receive consumer or personal, and business or entity, credit reports from one or more credit bureaus, such as TransUnion, Experian or Equifax, investigative reports about the Applicant from third party data aggregators, and other financial information about Applicant, including credit card processor statements and bank statements, directly from credit bureaus, banks, creditors or other third parties, and to verify through third-party sources all information contained, provided, or obtained in connection with the Application. Such inquiries by Third Parties may be “hard credit pulls” that may impact the credit score of the Business and/or the Owner(s).</p>
<p><u>Consent to Use Electronic Records and Signatures</u></p>
<p>Applicant’s consent to use electronic records and signatures. Applicant agrees that Kapitus may provide any Communications electronically (“Electronic Records”) and to the use of electronic signatures. Applicant’s consent applies to all Communications that may be provided during Applicant’s business relationship with Kapitus. For example, this ESIGN Consent and Disclosure, applications, agreements, and notices or disclosures required to be provided by law or that Kapitus chooses to provide in its discretion. Electronic Records shall be delivered to Applicant by email or other electronic means. Even with Applicant’s consent to Electronic Records, Kapitus may, in its sole discretion, provide any Communication on paper. Applicant acknowledges and agrees that all Electronic Records delivered to Applicant by Kapitus (i) shall be given the same legal effect as signed paper Communications, (ii) shall be considered a “writing” or “in writing” and (iii) shall be deemed for all purposes to have been "signed" and to constitute an "original" when printed from electronic files or records established and maintained in the normal course of business. Any notice Applicant is required to provide to Kapitus by law, agreement, or otherwise must be provided to us on paper, unless we specifically communicate in another Communication that it may be delivered to us electronically.</p>
<p>Applicant’s option to receive paper copies. Applicant may request a paper copy of an Electronic Record Kapitus provided at no charge to Applicant by contacting us at (800) 780-7133 or support@kapitus.com.</p>
<p>Changing Applicant’s consent. Applicant may withdraw Applicant’s consent at any time. To withdraw consent, Applicant must contact us at (800) 780-7133 or support@kapitus.com. Applicant’s withdrawal of consent will be effective after Kapitus has a reasonable opportunity to act upon it.</p>
<p>Maintaining Current Email Information on File. It is Applicant’s responsibility to keep Applicant’s primary email address current so Kapitus can communicate with Applicant electronically. Applicant must promptly contact us at (800) 780-7133 or support@kapitus.com to notify us of any changes to Applicant’s email address on file with Kapitus. If Applicant uses a spam filter or similar software that blocks or re-routes emails from senders not listed in Applicant’s email address book, consider adding Kapitus to the email address book.</p>
<p>Necessary Hardware and Software Requirements. For access to and retention of Electronic Records, Applicant must have:</p>
<p>1. A valid email address;<br>2. Sufficient electronic storage capacity;<br>3. An internet browser, with software for viewing documents such as Portable Document Format (PDF);<br>4. Internet connectivity capable of sending, receiving and accessing data, information and communications from us;<br>5. Either a printer, a hard drive, or other storage capabilities.</p>
<p>If Kapitus’s hardware or software requirements change and that change would create a material risk that Applicant would not be able to access or retain Electronic Records, Kapitus will provide notice of the revised hardware or software requirements and a reminder of Applicant’s right to withdraw consent to Electronic Records.<br>By providing consent, Applicant confirms that Applicant has the hardware and software described above, that Applicant is able to receive and review Electronic Records, and that Applicant has provided a valid email account.<br>Applicant’s Acknowledgment and Confirmation of Consent. By signing below, Applicant acknowledges and agrees, among other things that (1) Applicant affirmatively consents to do business electronically and that Applicant and Kapitus both intend that the Electronic Signatures in Global and National Commerce Act apply to the fullest extent possible to validate our ability to conduct business by electronic means; (3) Applicant can access and read the terms and notices set forth herein; (4) Applicant can print on paper this disclosure or save or send the disclosure to a place where Applicant can print it, for future reference and access; and (3) until or unless Applicant notifies Kapitus per instructions above, Applicant consents to receipt of Communications through electronic means.</p>
<p><u>Promotions and Servicing Notice</u></p>
<p>Kapitus may, from time to time, notify Applicant of various promotional offers and other marketing information, or contact Applicant in connection with the servicing of any financing, or in connection with any default under any financing. Applicant expressly consents and authorizes Kapitus to call, e-mail, send text messages, and/or send other electronic messages (including prerecorded or artificial voice messages) using an automatic telephone dialing system to any telephone number provided by Applicant, and any telephone number included in any and all documents or forms submitted, including cellular phone numbers and landlines, regardless of their inclusion on any do not call list, for purposes of servicing, collections, marketing or promoting any product offered by Kapitus. Please note that you are not required to consent to be contacted for marketing or promotional purposes in order to qualify for financing or obtain any other products or services from Kapitus. If you do not agree to be called for marketing or promotional purposes, please call <a href="tel:844-547-9396">(844) 547-9396</a> or email <a href="mailto:DNC@kapitus.com">DNC@kapitus.com</a></p>
<p>IF YOUR APPLICATION FOR BUSINESS CREDIT IS DENIED, YOU HAVE THE RIGHT TO A WRITTEN STATEMENT OF THE SPECIFIC REASONS FOR THE DENIAL. TO OBTAIN THE STATEMENT, PLEASE CONTACT KAPITUS LLC AT 2500 WILSON BOULEVARD, SUITE 350, ARLINGTON, VIRGINIA 22201 OR (844) 547-9396 WITHIN 60 DAYS FROM THE DATE YOU ARE NOTIFIED OF THE CREDIT DECISION. YOU HAVE THE RIGHT TO OBTAIN A WRITTEN STATEMENT OF REASONS FOR THE DENIAL WITHIN 30 DAYS OF RECEIVING YOUR REQUEST FOR THE STATEMENT.</p>
<p><em>The notice below applies to applications processed by Kapitus. If the Application is referred to Third-Parties, they may separately contact you or provide information about your rights in the event your application is denied to the extent required by law.</em></p>
<p>Copyright 2026 • Kapitus • All Rights Reserved. Loans made in California by Strategic Funding Source, Inc. dba Kapitus are issued pursuant to California Finance Lenders License No. 603-G807. By signing below, you agree that you have read and agree to the above terms and notices and our <a href="https://kapitus.com/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a> and our website Terms of Use Agreement (available at <a href="https://kapitus.com" target="_blank" rel="noopener">www.kapitus.com</a>).</p>`;

  builders.terms = function(s, box, onAgree){
    box.appendChild(el("p","sub2","Scroll and review all terms to enable the checkbox."));
    var t = el("div","terms"); t.tabIndex = 0; t.setAttribute("role","region"); t.setAttribute("aria-label","Terms and notices"); t.innerHTML = TERMS_HTML; box.appendChild(t);
    var scrolled = !!A.termsRead;
    var lab = el("label","chk"); var cb = document.createElement("input"); cb.type = "checkbox"; cb.disabled = !scrolled; cb.checked = !!A.agreed;
    lab.appendChild(cb); lab.appendChild(el("span",null,"By checking here, I certify that I have read and agree to the above terms and notices, Kapitus’s Privacy Policy and Terms of Use.")); box.appendChild(lab);
    var err = el("div","ferr"); err.setAttribute("role","alert"); box.appendChild(err);
    function check(){ if(!scrolled && t.scrollTop + t.clientHeight >= t.scrollHeight - 24){ scrolled = true; A.termsRead = true; cb.disabled = false; err.textContent = ""; } }
    t.addEventListener("scroll", check, {passive:true});
    setTimeout(check, 50);
    lab.addEventListener("click", function(e){ if(!scrolled){ e.preventDefault(); err.textContent = "Please review the terms before accepting."; t.focus(); } });
    cb.addEventListener("change", function(){ A.agreed = cb.checked; if(cb.checked) err.textContent = ""; if(onAgree) onAgree(cb.checked); });
    var x = el("div"); x.appendChild(el("div","sub2","I’m also interested in learning about (optional):"));
    [["Exclusive savings on business insurance","insurance"],["Personal and business credit reports","reports"]].forEach(function(o){
      var l2 = el("label","chk"); var c2 = document.createElement("input"); c2.type = "checkbox"; c2.checked = !!A["opt_"+o[1]];
      c2.addEventListener("change", function(){ A["opt_"+o[1]] = c2.checked; }); l2.appendChild(c2); l2.appendChild(el("span",null,o[0])); x.appendChild(l2);
    });
    box.appendChild(x);
    return {next:function(){
      if(!scrolled){ err.textContent = "Please review the terms before accepting."; t.focus(); return false; }
      if(!cb.checked){ err.textContent = "Please check the box to continue."; cb.focus(); return false; }
      A.agreed = true; return true;
    }};
  };

  /* signature (draw or type) + security check + submit */
  builders.sign = function(s, box){
    var wrap = el("div","sigbox"); var mode = "draw", dirty = !!A.signature, canvas = document.createElement("canvas"), ctx = null, drawing = false;
    canvas.className = "sigcanvas"; canvas.setAttribute("aria-label","Signature pad. Draw your signature here, or choose Type instead.");
    var typed = document.createElement("input"); typed.type = "text"; typed.className = "sigtype"; typed.hidden = true; typed.maxLength = 60; typed.setAttribute("aria-label","Type your full name as your signature"); typed.autocomplete = "off";
    var lblSig = el("div","sub2","Signature");
    var tools = el("div","sigtools"); var clr = el("button","tgl","Clear"); clr.type = "button"; var sw = el("button","tgl","Type instead"); sw.type = "button";
    tools.appendChild(clr); tools.appendChild(sw);
    wrap.appendChild(lblSig); wrap.appendChild(canvas); wrap.appendChild(typed); wrap.appendChild(tools); box.appendChild(wrap);
    function fit(){
      var r = canvas.getBoundingClientRect(); if(!r.width) return; var d = window.devicePixelRatio || 1;
      canvas.width = Math.round(r.width*d); canvas.height = Math.round(r.height*d); ctx = canvas.getContext("2d");
      ctx.scale(d,d); ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111";
    }
    setTimeout(fit, 0);
    function pos(e){ var r = canvas.getBoundingClientRect(); return {x:e.clientX - r.left, y:e.clientY - r.top}; }
    canvas.addEventListener("pointerdown", function(e){ if(!ctx) fit(); drawing = true; var p = pos(e); ctx.beginPath(); ctx.moveTo(p.x,p.y); try{ canvas.setPointerCapture(e.pointerId); }catch(x){} e.preventDefault(); });
    canvas.addEventListener("pointermove", function(e){ if(!drawing) return; var p = pos(e); ctx.lineTo(p.x,p.y); ctx.stroke(); dirty = true; err.textContent = ""; });
    ["pointerup","pointercancel","pointerleave"].forEach(function(ev){ canvas.addEventListener(ev, function(){ drawing = false; }); });
    clr.addEventListener("click", function(){ if(mode==="draw"){ if(ctx) ctx.clearRect(0,0,canvas.width,canvas.height); dirty = false; } else { typed.value = ""; } });
    sw.addEventListener("click", function(){
      mode = mode==="draw" ? "type" : "draw";
      canvas.hidden = mode==="type"; typed.hidden = mode==="draw"; sw.textContent = mode==="draw" ? "Type instead" : "Draw instead";
      if(mode==="draw") setTimeout(fit, 0); else typed.focus();
    });
    var cap = el("label","captcha"); var cc = document.createElement("input"); cc.type = "checkbox";
    /* WIRE-UP: replace this block with the real hCaptcha widget (sitekey) when the form is connected. */
    cap.appendChild(cc); cap.appendChild(el("span",null,"I’m not a robot")); cap.appendChild(el("small",null,"Security check"));
    box.appendChild(cap);
    var err = el("div","ferr"); err.setAttribute("role","alert"); box.appendChild(err);
    return {next:function(){
      var has = mode==="draw" ? dirty : typed.value.trim().length >= 2;
      if(!has){ err.textContent = mode==="draw" ? "Please sign in the box, or choose Type instead." : "Please type your full name."; return false; }
      if(!cc.checked){ err.textContent = "Please complete the security check."; cc.focus(); return false; }
      A.signatureMode = mode; A.signature = mode==="draw" ? "(drawn)" : typed.value.trim(); return true;
    }, nextLabel:"Submit", show:function(){ setTimeout(fit, 0); }};
  };

  /* merged screen: terms first, the signature appears once the terms are read and accepted */
  builders.review = function(s, box){
    var sigBox = el("div","sigreveal"); sigBox.hidden = true;
    var sig = builders.sign(s, sigBox);
    var terms = builders.terms(s, box, function(on){ sigBox.hidden = !on; if(on) sig.show(); });
    box.appendChild(sigBox);
    if(A.agreed){ sigBox.hidden = false; sig.show(); }
    return {next:function(){ return terms.next() && sig.next(); }, nextLabel:"Submit"};
  };

  /* ---------- the screens (every count in the UI is read from this list) ---------- */
  var STEPS = [
    /* ---- Business details (11) ---- */
    {id:"amount",   cat:0, build:"amount",    title:"How much funding do you need?"},
    {id:"uses",     cat:0, build:"multi",     key:"uses", title:"What will this funding help with?", hint:"This helps us match you to the right funding options.", options:USES, other:true},
    {id:"industry", cat:0, build:"single",    key:"industry", title:"What industry is your business in?", hint:"This helps us better match you with available financing options.", options:INDUSTRY, other:true, auto:true},
    {id:"entity",   cat:0, build:"single",    key:"entity", title:"What’s your business entity type?", hint:"This helps us identify financing options that fit your business structure.", options:ENTITY, other:true, auto:true, cols:"one"},
    {id:"start",    cat:0, build:"monthyear", title:"When did you start your business?", hint:"This helps us understand your business maturity level."},
    {id:"ownership",cat:0, build:"single",    key:"ownership", title:"What percentage of the business do you own?", hint:"This helps determine whether co-owner information is required.", options:OWN, auto:true},
    {id:"revenue",  cat:0, build:"single",    key:"revenue", title:"What’s your annual revenue?", hint:"We use this to match you with the most relevant financing options.", options:REV, auto:true},
    {id:"loans",    cat:0, build:"loans",     title:"Do you have any business loans currently?", hint:"This helps us calculate financing amounts."},
    {id:"bizname",  cat:0, build:"bizname",   title:"What is your business name?", hint:"Your business name stays private and protected."},
    {id:"ein",      cat:0, build:"ein",       title:"What’s your business’s EIN?", hint:"Your EIN is also called your Tax ID."},
    {id:"bizaddr",  cat:0, build:"address",   prefix:"biz", website:true, title:"What is your business address?", hint:"This is the address where your business receives mail."},
    /* ---- Profile information (4) ---- */
    {id:"contact",  cat:1, build:"contact",   title:"Tell us about yourself", hint:"We’ll only contact you with relevant updates. We take seriously protecting the privacy of personal information.",
      note: F.savePersonal ? "We keep your name and contact details in this browser for " + cfg.resumeDays + " days so you don’t have to type them again. We never save your SSN, date of birth or documents. Choose Start over to clear them." : ""},
    {id:"home",     cat:1, build:"address",   prefix:"home", sameAs:true, title:"What’s your home address?", hint:"This is used to verify your identity and assess eligibility."},
    {id:"credit",   cat:1, build:"single",    key:"credit", title:"What’s your credit score?", hint:"This helps us find the best financing options for you.", options:CREDIT, auto:true},
    {id:"ssn",      cat:1, build:"ssn",       title:"What’s your Social Security Number?", hint:"Your SSN is encrypted and securely protected.", lock:true},
    /* ---- Documents (2) ---- */
    {id:"docs",     cat:2, build:"upload",    title:"Important documents"}
  ].concat(F.mergeReviewAndSign
    ? [{id:"review", cat:2, build:"review", title:"Review and sign", last:true}]
    : [{id:"terms", cat:2, build:"terms", title:"Acknowledgement"}, {id:"sign", cat:2, build:"sign", title:"Signature", last:true}]);

  function catCount(c){ return STEPS.filter(function(x){ return x.cat === c; }).length; }
  function catFirst(c){ for(var i = 0; i < STEPS.length; i++){ if(STEPS[i].cat === c) return i; } return 0; }
  var CAP = STEPS.map(function(x){ return x.id; }).indexOf("ein");   /* progress is restored up to the first screen whose answer is not remembered (EIN). Saved screens after it come back prefilled. */
  if(st.started) idx = Math.min(st.step || 0, CAP);
  function persist(){ if(st.started) K.set({step:Math.min(idx, CAP), data:safeData()}); }

  /* ---------- rendering ---------- */
  var CHECK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="ck" d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var doneSegs = 0;
  function swap(){ body.classList.remove("step-in"); void body.offsetWidth; if(!reduce) body.classList.add("step-in"); }
  /* one pill per screen, built from STEPS, so a category is as wide as the number of screens it has. Done pills are green, the current one is purple. */
  var psegs = [];
  prog.innerHTML = "";
  STEPS.forEach(function(st2, k){
    var sg = el("span", "pseg" + (k && st2.cat !== STEPS[k-1].cat ? " gap" : "")); sg.appendChild(document.createElement("i"));
    sg.style.setProperty("--i", String(k)); prog.appendChild(sg); psegs.push(sg);
  });
  function paintProgress(){
    var cur = finished ? STEPS.length : idx;
    psegs.forEach(function(sg, k){
      var done = (finished || k < cur), here = (!finished && k === cur);
      sg.firstChild.style.width = (done || here) ? "100%" : "0%";
      if(done && !sg.classList.contains("done") && !reduce){ sg.classList.add("pop"); setTimeout(function(){ sg.classList.remove("pop"); }, 800); }
      sg.classList.toggle("done", done);
    });
    prog.classList.toggle("all", finished);
    var pct = finished ? 100 : Math.round(((idx + 1) / STEPS.length) * 100);
    prog.setAttribute("aria-valuenow", String(pct));
  }
  /* a finished category: its pills ripple once. The message is a small pop-up (see ARRIVE in section 10), so nothing takes space inside the form. */
  function celebrate(cat){
    if(reduce) return;
    var n = 0, hit = [];
    STEPS.forEach(function(x, k){ if(x.cat === cat){ psegs[k].style.setProperty("--w", String(n++)); psegs[k].classList.add("wave"); hit.push(psegs[k]); } });
    setTimeout(function(){ hit.forEach(function(sg){ sg.classList.remove("wave"); }); }, 1400);
  }
  function render(focusTitle, fromCat){
    clearTimeout(advTimer); ctrl = null; body.innerHTML = ""; body.classList.remove("thanks"); card.classList.remove("wide"); swap();
    if(K.nudges) K.nudges.hide();
    if(finished){ return renderThanks(); }
    paintProgress();
    if(!formMode && st.started){ return renderResume(); }
    var s = STEPS[idx];
    if(formMode && fromCat != null && s.cat > fromCat){ celebrate(fromCat); }
    var h = el("h2",null,s.title); h.id = "ftitle"; h.tabIndex = -1; body.appendChild(h);
    if(s.hint) body.appendChild(hintPill(s.hint, s.lock ? "lock" : "bulb"));
    var box = el("div","fbox"); body.appendChild(box);
    ctrl = builders[s.build](s, box) || {};
    meta.hidden = !formMode; nav.hidden = !formMode;
    if(formMode){
      catEl.textContent = CATS[s.cat]; cntEl.textContent = "Step " + (idx - catFirst(s.cat) + 1) + " of " + catCount(s.cat);
      backBtn.hidden = idx === 0; nav.classList.toggle("one", idx === 0);
      nextBtn.textContent = ctrl.nextLabel || (s.last ? "Submit" : "Continue"); nextBtn.disabled = false;
      setNext(!ctrl.hideNext);
      K.track("form_step", {step:s.id, index:idx + 1, category:CATS[s.cat]});
      if(focusTitle){ h.focus({preventScroll:true}); }
    }
  }
  function renderResume(){
    meta.hidden = true; nav.hidden = true;
    var h = el("h2",null, A.first ? "Welcome back, " + nice(A.first) : "Pick up where you left off"); body.appendChild(h);
    var s = STEPS[idx];
    body.appendChild(el("p","sub","Your $" + K.fmt(A.amount || cfg.defaultAmount) + " request is saved. You’re on " + CATS[s.cat].toLowerCase() + ", step " + (idx - catFirst(s.cat) + 1) + " of " + catCount(s.cat) + (F.savePersonal ? ". Your name and contact details are saved in this browser. We never save your SSN, date of birth or documents." : ". Personal details stay only while this page is open.")));
    var box = el("div","resume");
    var go = el("button","btn btn-primary"); go.type = "button"; go.setAttribute("data-cta",""); go.dataset.loc = "resume"; go.dataset.start = "Get started"; go.dataset["continue"] = "Continue your application"; go.textContent = "Continue your application";
    var so = el("button","back", F.savePersonal ? "Start over and clear saved info" : "Start over"); so.type = "button";
    so.addEventListener("click", function(){ resetAll(); render(false); });
    box.appendChild(go); box.appendChild(so); body.appendChild(box);
  }
  /* thank-you: side by side on desktop, stacked on mobile; every progress pill fills green; the next steps appear one by one */
  function renderThanks(){
    meta.hidden = true; nav.hidden = true; paintProgress();
    card.classList.add("wide"); body.classList.add("thanks");
    var first = nice(A.first), biz = A.dba || A.legal || "";
    var need = (A.bizState === "California" || A.bizState === "New York") ? 4 : 3, nf = A.files ? A.files.length : 0;
    var grid = el("div","thanks-grid"); body.appendChild(grid);

    var L = el("div","thanks-main");
    var tick = el("div","tick"); tick.innerHTML = CHECK.replace('width="22" height="22"','width="30" height="30"'); L.appendChild(tick);
    var h = el("h2",null,"Thank you" + (first ? ", " + first : "")); h.id = "ftitle"; h.tabIndex = -1; L.appendChild(h);
    L.appendChild(el("p","sub","We’ve received your application. Here’s a quick summary."));
    var rows = [["Requested amount","$" + K.fmt(A.amount || 0)]];
    if(biz) rows.push(["Business", biz]);
    if(A.phone) rows.push(["We’ll reach you at", A.phone]);
    rows.push(["Application status","Received"]);
    var ul = el("ul","summary");
    rows.forEach(function(r){ var li = el("li"); li.appendChild(el("span",null,r[0])); li.appendChild(el("span",null,r[1])); ul.appendChild(li); });
    L.appendChild(ul);
    if(A.email){ L.appendChild(el("p","sub","A confirmation email will be sent to " + A.email + ".")); }
    var note = null;
    if(A.uploadLater){ note = ["One more thing", "We’ll email you a secure link" + (A.email ? " at " + A.email : "") + " to upload your " + need + " most recent bank statements."]; }
    else if(nf && nf < need){ note = ["Bank statements", "We received " + nf + " of " + need + ". Your specialist may ask for the rest."]; }
    else if(nf){ note = ["Bank statements", "We received your " + nf + " statements."]; }
    if(note){ var nb = el("div","notice"); nb.appendChild(el("strong",null,note[0])); nb.appendChild(el("span",null,note[1])); L.appendChild(nb); }
    if(!F.submitUrl){ L.appendChild(el("p","preview-note","Preview only: nothing was submitted or stored.")); }
    var acts = el("div","thanks-actions");
    var call = el("a","btn btn-ghost","Call a specialist: " + cfg.phoneSales); call.href = "tel:" + cfg.phoneSalesTel;
    var done = el("button","btn btn-primary","Done"); done.type = "button"; done.addEventListener("click", function(){ resetAll(); leave(); });
    acts.appendChild(call); acts.appendChild(done); L.appendChild(acts);
    grid.appendChild(L);

    var R = el("div","thanks-side");
    R.appendChild(el("h3","nexth","What happens next"));
    var ol = el("ol","nexts");
    [["A financing specialist reviews your application", A.phone ? "They may call you at " + A.phone + (A.email ? " or email you at " + A.email : "") + "." : "They’ll reach out to you soon."],
     ["They walk you through your options", "Your specialist explains what may be available for your business and answers your questions."],
     ["You choose what fits", "Take your time. You decide whether and how to move forward."]].forEach(function(r, i){
      var li = el("li"), d = el("div"); li.style.setProperty("--d", (0.35 + i * 0.35) + "s");
      d.appendChild(el("strong",null,r[0])); d.appendChild(el("span",null,r[1])); li.appendChild(d); ol.appendChild(li);
    });
    R.appendChild(ol);
    var ref = el("div","ref"); ref.appendChild(el("h3","nexth","How did you hear about us? (optional)"));
    var rg = el("div","opts refopts"), okRow = el("div","ref-ok"), pickT = null;
    okRow.hidden = true; okRow.setAttribute("role","status");
    var chg = el("button","linkbtn","Change"); chg.type = "button";
    okRow.appendChild(el("span",null,"Thanks, that helps us.")); okRow.appendChild(chg);
    var oth = el("div","ref-other"); oth.hidden = true;
    var oi = el("input"); oi.type = "text"; oi.maxLength = 60; oi.placeholder = "Where? (optional)"; oi.setAttribute("aria-label","Where did you hear about us?");
    var os = el("button","btn btn-primary","Submit"); os.type = "button";
    oth.appendChild(oi); oth.appendChild(os);
    function mark(r){ $$(".chip", rg).forEach(function(x){ x.setAttribute("aria-pressed", String(x.textContent === r)); }); }
    function sendRef(v){
      A.referral = v; ref.classList.add("done"); oth.hidden = true; okRow.hidden = false;
      K.track("referral", {value: v.indexOf("Other") === 0 ? "Other" : v}); if(typeof K.onReferral === "function") K.onReferral(v);   /* WIRE-UP: send to your system */
    }
    chg.addEventListener("click", function(){ ref.classList.remove("done"); okRow.hidden = true; mark(""); });
    os.addEventListener("click", function(){ var t = oi.value.trim(); sendRef(t ? "Other: " + t : "Other"); });
    oi.addEventListener("keydown", function(e){ if(e.key === "Enter"){ e.preventDefault(); os.click(); } });
    REFERRAL.forEach(function(r){
      var b = el("button","chip",r); b.type = "button"; b.setAttribute("aria-pressed","false");
      b.addEventListener("click", function(){
        clearTimeout(pickT); mark(r);
        if(r === "Other"){ oth.hidden = false; oi.focus(); }
        else { oth.hidden = true; pickT = setTimeout(function(){ sendRef(r); }, 500); }   /* closes half a second after a tap */
      });
      rg.appendChild(b);
    });
    ref.appendChild(rg); ref.appendChild(oth); ref.appendChild(okRow); R.appendChild(ref);
    grid.appendChild(R);
    h.focus({preventScroll:true});
  }

  /* ---------- navigation ---------- */
  function next(){
    if(!ctrl) return;
    if(ctrl.next && !ctrl.next()) return;
    var s = STEPS[idx];
    if(s.last){ return finish(); }
    var fromCat = s.cat;
    idx++; persist(); render(true, fromCat); toTop();
    if(K.nudges) K.nudges.afterStep(s.id, A, STEPS[idx].id);   /* motivating pop-up after a fresh answer (section 10) */
  }
  function prev(){
    if(idx===0){ exitForm(); return; }
    idx--; persist(); K.track("form_back", {step:STEPS[idx].id}); render(true); toTop();
  }
  function toTop(){ var r = card.getBoundingClientRect(); if(r.top < 0 || r.top > 120){ window.scrollTo({top: Math.max(0, window.scrollY + r.top - 70), behavior: "auto"}); } }
  nextBtn.addEventListener("click", next);
  backBtn.addEventListener("click", prev);
  closeBtn.addEventListener("click", function(){     /* close at any step to read more; everything entered so far is kept */
    K.track("form_close", {step:STEPS[idx].id, index:idx+1});
    persist(); exitForm();
  });
  card.addEventListener("keydown", function(e){
    if(e.key!=="Enter" || !formMode) return;
    var t = e.target; if(!t || t.tagName!=="INPUT" || t.type==="checkbox" || t.type==="file") return;
    if(t.id==="amount") return; e.preventDefault(); next();
  });

  function buildPayload(){
    var p = {}; Object.keys(A).forEach(function(k){ if(k==="files") p.files = A.files.map(function(f){ return {name:f.name, size:f.size}; }); else if(k!=="signature" && k!=="dobText") p[k] = A[k]; });
    p.signature = A.signatureMode; return p;
  }
  function finish(){
    var payload = buildPayload();
    K.track("form_submit", {amount:A.amount});
    function ok(){ finished = true; K.clear(); if(typeof K.onSubmit==="function") K.onSubmit(payload); render(true); }
    if(F.submitUrl){
      nextBtn.disabled = true;
      fetch(F.submitUrl, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)})
        .then(function(r){ if(!r.ok) throw new Error("bad status"); ok(); })
        .catch(function(){ nextBtn.disabled = false; var m = el("div","ferr","We couldn’t submit your application. Please try again, or call " + cfg.phoneSales + "."); m.setAttribute("role","alert"); body.appendChild(m); });
    } else { ok(); }
  }
  function resetAll(){ A = {}; finished = false; idx = 0; K.clear(); if(K.nudges) K.nudges.reset(); }

  /* ---------- focus mode ---------- */
  function enter(){
    formMode = true; document.body.classList.add("form-mode");
    if(location.hash !== "#application") location.hash = "application";
    window.scrollTo(0,0); render(true);
  }
  function leave(){
    formMode = false; document.body.classList.remove("form-mode");
    if(finished){ finished = false; }
    render(false); window.scrollTo(0,0);
  }
  function exitForm(){
    if(location.hash === "#application"){ leaving = true; location.hash = ""; }
    leave();
  }
  window.addEventListener("hashchange", function(){
    if(leaving){ leaving = false; return; }
    if(formMode && location.hash !== "#application"){ leave(); }
    else if(!formMode && location.hash === "#application"){ enter(); }
  });
  K.openForm = function(){ if(!formMode){ if(!st.started) idx = 0; enter(); } };

  /* first paint: intro (amount) or the "welcome back" card; open straight into the form if the URL says so */
  render(false);
  if(location.hash === "#application"){ enter(); }
})();

/* ============ NUDGES (part of form.js): small motivating pop-ups while filling the form ============
   WHEN: only right after a fresh answer, on the next screen. Never when going back, never twice for the same answer.
   LOOK: one at a time, bottom-right on desktop, top of the screen on mobile. Auto-closes (pauses on hover, focus, touch), has a close button, Esc closes it.
   EDIT HERE: the copy, the industry table, and the rules below. Numbers must be verified by the client before launch. */
(function(){
  "use strict";
  var K = window.KAP, el = K.el;
  var N = K.cfg.nudges = Object.assign({enabled:true, autoCloseMs:5200, delayMs:380}, K.cfg.nudges || {});
  if(!N.enabled) return;

  /* industry proof: "count" is shown only when filled in. 120+ for Health Care is the example from the brief, replace with the verified number. */
  var INDUSTRY = {
    "Construction":       {label:"construction",         count:""},
    "Business / IT":      {label:"business and IT",      count:""},
    "Health Care":        {label:"healthcare",           count:"120+"},
    "Personal Services":  {label:"personal services",    count:""},
    "Transportation":     {label:"transportation",       count:""},
    "Education":          {label:"education",            count:""},
    "Automotive":         {label:"automotive",           count:""},
    "Real Estate":        {label:"real estate",          count:""},
    "Food / Hospitality": {label:"food and hospitality", count:""}
  };
  var COPY = {
    industryCount: function(c, l){ return "We’ve helped " + c + " " + l + " businesses. You’re in good company."; },
    industryPlain: function(l){ return "Got it. We work with " + l + " businesses."; },
    yearsStrong:   function(y){ return y + " years in business. That’s a strong foundation."; },
    yearsMid:      "Over a year in business. Your revenue and credit will fill in the picture.",
    yearsNew:      "Newer businesses can apply too. Keep going.",
    revenueStrong: "Your revenue is in a strong range.",
    creditStrong:  "You have a strong credit score. That’s a real advantage.",
    creditOk:      "Your credit score meets our " + K.cfg.typical.credit + " minimum.",
    creditLow:     "Thanks for sharing. A financing specialist will review your full profile."
  };
  var REV_STRONG = ["$250K to $500K","$500K to $750K","$750K to $1M","$1M to $3M","$3M+"];
  var CREDIT_STRONG = ["700 to 719","720 to 739","740 and above"], CREDIT_OK = ["650 to 679","680 to 699"];

  function yearsIn(A){ var n = new Date(); return (n.getFullYear() - Number(A.startYear)) + ((n.getMonth()+1) - Number(A.startMonth)) / 12; }
  var RULES = {   /* the answer just given (prevId) decides the message; return null for no message */
    industry: function(A){ var m = INDUSTRY[A.industry]; if(!m) return null; return {key:"industry:" + A.industry, tone:"good", text: m.count ? COPY.industryCount(m.count, m.label) : COPY.industryPlain(m.label)}; },
    start: function(A){
      var y = yearsIn(A); if(isNaN(y)) return null;
      if(y >= 2) return {key:"start:" + Math.floor(y), tone:"good", text:COPY.yearsStrong(Math.floor(y))};
      if(y >= 1) return {key:"start:mid", tone:"info", text:COPY.yearsMid};
      return {key:"start:new", tone:"info", text:COPY.yearsNew};
    },
    revenue: function(A){ return REV_STRONG.indexOf(A.revenue) > -1 ? {key:"revenue:strong", tone:"good", text:COPY.revenueStrong} : null; },
    credit: function(A){
      if(CREDIT_STRONG.indexOf(A.credit) > -1) return {key:"credit:strong", tone:"good", text:COPY.creditStrong};
      if(CREDIT_OK.indexOf(A.credit) > -1) return {key:"credit:ok", tone:"good", text:COPY.creditOk};
      if(A.credit) return {key:"credit:low", tone:"info", text:COPY.creditLow};
      return null;
    }
  };
  var ARRIVE = {   /* category milestones: a short pop-up on the first screen of the next category */
    contact: function(){ return {key:"cat:business", tone:"good", text:"Business details done. You’re past halfway!"}; },
    docs: function(){ return {key:"cat:profile", tone:"good", text:"Profile done. Last step: have your 3 most recent bank statements ready" + (K.cfg.form && K.cfg.form.allowUploadLater ? ", or upload them later." : ".")}; }
  };

  var ICON_GOOD = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var ICON_INFO = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/></svg>';
  var node = null, ico, txt, timer = null, delayT = null, startedAt = 0, remaining = 0, current = null, shown = {};

  function build(){
    if(node) return;
    node = el("div","nudge"); node.setAttribute("role","status"); node.setAttribute("aria-live","polite");
    ico = el("span","ni"); txt = el("p");
    var x = el("button","nclose"); x.type = "button"; x.setAttribute("aria-label","Close message");
    x.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';
    x.addEventListener("click", function(){ close("user"); });
    node.appendChild(ico); node.appendChild(txt); node.appendChild(x); node.appendChild(el("span","nbar"));
    node.addEventListener("mouseenter", pause); node.addEventListener("focusin", pause); node.addEventListener("touchstart", pause, {passive:true});
    node.addEventListener("mouseleave", resume); node.addEventListener("focusout", resume); node.addEventListener("touchend", resume, {passive:true});
    document.body.appendChild(node);
  }
  function pause(){ if(!current) return; clearTimeout(timer); remaining -= Date.now() - startedAt; node.classList.add("hold"); }
  function resume(){ if(!current) return; node.classList.remove("hold"); startedAt = Date.now(); remaining = Math.max(1800, remaining); timer = setTimeout(function(){ close("auto"); }, remaining); }
  function show(n){
    build(); clearTimeout(timer); current = n;
    node.className = "nudge" + (n.tone==="good" ? " good" : "");
    ico.innerHTML = n.tone==="good" ? ICON_GOOD : ICON_INFO; txt.textContent = n.text;
    node.style.setProperty("--nms", N.autoCloseMs + "ms");
    void node.offsetWidth; node.classList.add("show","run");
    remaining = N.autoCloseMs; startedAt = Date.now(); timer = setTimeout(function(){ close("auto"); }, remaining);
    K.track("nudge_show", {key:n.key});
  }
  function close(by){
    if(!node || !current) return;
    clearTimeout(timer); node.classList.remove("show","run","hold");
    K.track("nudge_close", {key:current.key, by:by}); current = null;
  }
  function hide(){ clearTimeout(delayT); if(node && current){ clearTimeout(timer); node.classList.remove("show","run","hold"); current = null; } }
  document.addEventListener("keydown", function(e){ if(e.key==="Escape") close("user"); });

  K.nudges = {
    hide: hide,
    reset: function(){ shown = {}; hide(); },
    afterStep: function(prevId, A, nextId){
      if(!document.body.classList.contains("form-mode")) return;
      var n = (RULES[prevId] && RULES[prevId](A)) || (ARRIVE[nextId] && ARRIVE[nextId](A));
      if(!n || shown[n.key]) return;
      shown[n.key] = true;
      clearTimeout(delayT);
      delayT = setTimeout(function(){ if(document.body.classList.contains("form-mode")) show(n); }, N.delayMs);
    }
  };
})();
