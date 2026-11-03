/* =====================================================================================
   estimator.js: the "See how your small business lines up" widget (section 04)
   Three live inputs: time in business (slider), annual revenue (text box), credit score (slider).
   It only guides. It never blocks anyone from applying and nothing is saved or sent.
   EDIT HERE: the ranges, the thresholds and the messages. Needs site.js loaded first.
   ===================================================================================== */
(function(){
  "use strict";
  var K = window.KAP, $ = K.$, $$ = K.$$, el = K.el;
  var res = $("#fitResult"); if(!res) return;

  /* ---------- 1. RANGES (what the sliders show) ----------
     tick  = short label under the slider (the START of the range, so it stays readable on a phone)
     label = full range shown large above the slider
     key / band = what the rules below use */
  var YEARS = [
    {tick:"<1",  label:"Under 1 year",  key:"lt1"},
    {tick:"1",   label:"1 to 2 years",  key:"1to2"},
    {tick:"2",   label:"2 to 3 years",  key:"2plus"},
    {tick:"3",   label:"3 to 5 years",  key:"2plus"},
    {tick:"5",   label:"5 to 7 years",  key:"2plus"},
    {tick:"7",   label:"7 to 10 years", key:"2plus"},
    {tick:"10+", label:"10+ years",     key:"2plus"}
  ];
  var CREDIT = [   /* the same ranges as the application's credit question */
    {tick:"<600", label:"600 and below", band:0},   /* band 0: below 600 */
    {tick:"625",  label:"601 to 625",    band:1},   /* band 1: 600 to 649 (under the minimum) */
    {tick:"650",  label:"626 to 650",    band:2},   /* band 2: meets the minimum */
    {tick:"675",  label:"651 to 675",    band:2},
    {tick:"700",  label:"676 to 700",    band:3},   /* band 3: strong */
    {tick:"725",  label:"701 to 725",    band:3},
    {tick:"725+", label:"725 and above", band:3}
  ];
  var REVENUE_EDGES = [100000, 250000, 500000, 1000000];   /* revenue bands 0..4 are split at these amounts */

  /* ---------- 2. RULES ----------
     Credit follows Kapitus's published minimum (K.cfg.typical.credit). The newer-business exceptions are
     placeholders until the client confirms the real ones. */
  var MIN_CREDIT = K.cfg.typical.credit;
  var STRONG_REV = 2;            /* revenue band 2 = $250K or more */
  var NEWER_BIG_REV = 3;         /* revenue band 3 = $500K or more: lets a newer business through as "may still be a great fit" */

  function revBand(n){ for(var i = 0; i < REVENUE_EDGES.length; i++){ if(n < REVENUE_EDGES[i]) return i; } return REVENUE_EDGES.length; }

  /* full read: t = years key, r = revenue band, c = credit band */
  function verdict(t, r, c){
    if(c < 2) return ["review","Let’s take a closer look","Our minimum credit score requirement is " + MIN_CREDIT + ". If your score is close or has recently improved, a financing specialist can talk through where you stand."];
    if(t === "2plus" && r >= STRONG_REV) return ["strong","You look like a strong fit","Your time in business, revenue and credit line up well with our qualifications. Start your application whenever you’re ready."];
    var why = null;
    if(t !== "2plus" && r >= NEWER_BIG_REV) why = "Newer businesses with strong revenue and solid credit are often a good fit. Your revenue carries a lot of weight here.";
    else if(t === "1to2" && r >= STRONG_REV && c >= 3) why = "Strong credit and healthy revenue can offset a shorter time in business.";
    if(why) return ["likely","You may still be a great fit", why + " A specialist will review your application individually."];
    return ["review","Let’s take a closer look","A few details fall outside our usual range, but you can still apply. A specialist will walk through what may be possible and what to work toward."];
  }
  /* encouragement while only some inputs are filled */
  function partial(has, t, r, c){
    var body = "Keep going. Your next answer fills in the picture.";
    if(has.c && c < 2) return "Our minimum credit score requirement is " + MIN_CREDIT + ".";
    if(has.t && !has.r && !has.c) body = t === "2plus" ? "Over two years in business is a strong start." : (t === "1to2" ? "Under 2 years can still work. Your next answers matter." : "Newer businesses can still apply. Revenue tells us a lot.");
    else if(has.t && has.r && !has.c){
      if(t !== "2plus" && r >= NEWER_BIG_REV) body = "Strong revenue carries real weight for a newer business.";
      else if(t === "2plus" && r >= STRONG_REV) body = "Steady revenue and time in business is a solid combination.";
      else if(r >= STRONG_REV) body = "Healthy revenue helps balance a shorter time in business.";
      else body = "Revenue is under our usual range. One more answer to go.";
    }
    else if(!has.t && has.r && !has.c) body = r >= STRONG_REV ? "Your revenue is in a strong range. Tell us how long you’ve been in business." : "Revenue is under our usual range. Your other answers matter.";
    else if(!has.t && !has.r && has.c) body = "Your credit score meets our " + MIN_CREDIT + " minimum.";
    else if(has.t && !has.r && has.c) body = "Add your revenue to complete the picture.";
    else if(!has.t && has.r && has.c) body = "One more: slide to show how long you’ve been in business.";
    return body;
  }

  /* ---------- 3. UI ---------- */
  var segs = $$(".seg i", res), fTitle = $("#fTitle"), fBody = $("#fBody");
  var pick = {t:null, rev:null, c:null}, lastState = null;

  function setRes(state, title, body){ res.dataset.state = state; fTitle.textContent = title; fBody.textContent = body; }
  function update(){
    var has = {t: pick.t !== null, r: pick.rev !== null && pick.rev > 0, c: pick.c !== null};
    var n = (has.t ? 1 : 0) + (has.r ? 1 : 0) + (has.c ? 1 : 0);
    segs.forEach(function(s, i){ s.classList.toggle("on", i < n); });
    if(!n){ setRes("idle","Let’s see where you stand","Slide the two sliders and enter your revenue."); return; }
    var t = has.t ? YEARS[pick.t].key : null, r = has.r ? revBand(pick.rev) : null, c = has.c ? CREDIT[pick.c].band : null;
    if(n === 3){
      var v = verdict(t, r, c); setRes(v[0], v[1], v[2]);
      if(v[0] !== lastState){ lastState = v[0]; K.track("fit_result", {state:v[0]}); }
    } else { setRes("idle","Keep going", partial(has, t, r, c)); }
  }

  /* one slider helper for both sliders: shows the chosen range large, ticks underneath, and reports changes */
  function slider(name, items, key, onPick){
    var input = $("#" + name + "Range"), wrap = $("#" + name + "Wrap"), val = $("#" + name + "Val"), ticks = $("#" + name + "Ticks");
    if(!input) return;
    input.min = "0"; input.max = String(items.length - 1); input.step = "1"; ticks.style.setProperty("--n", String(items.length - 1));   /* any number of stops works */
    items.forEach(function(it, i){ var t = el("span", null, it.tick); t.style.setProperty("--i", String(i)); ticks.appendChild(t); });
    function set(i){
      input.value = i; wrap.style.setProperty("--p", String(i / (items.length - 1)));
      val.textContent = items[i].label; val.classList.remove("idle"); input.setAttribute("aria-valuetext", items[i].label);
      pick[key] = i; update();
    }
    wrap.style.setProperty("--p", "0");
    input.addEventListener("input", function(){ set(Number(input.value)); });
    input.addEventListener("change", function(){ K.track("fit_" + name, {value: items[Number(input.value)].label}); });
  }
  slider("t", YEARS, "t");
  slider("c", CREDIT, "c");

  var revIn = $("#revIn"), rVal = $("#rVal");
  revIn.addEventListener("input", function(){
    revIn.value = K.fmt(K.digits(revIn.value));
    var n = Number(K.digits(revIn.value));
    pick.rev = n > 0 ? n : null;
    rVal.textContent = n > 0 ? "$" + revIn.value : "Enter an amount";
    rVal.classList.toggle("idle", !(n > 0));
    update();
  });
  revIn.addEventListener("change", function(){ if(pick.rev) K.track("fit_revenue", {band: revBand(pick.rev)}); });
  update();
})();
