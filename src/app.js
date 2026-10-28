"use strict";
/* Rückwärts-Rätsel / Backwords – App-Logik (lokal + online) */

const CFG = Object.assign({
  supabaseUrl: "", supabaseKey: "", vapidPublicKey: "", emailDomain: "spieler.rueckwaerts-raetsel.app",
  appUrl: "", onlineDisabled: false, serviceWorker: true, notifyFunction: "notify",
  ttsBases: ["vendor/mespeak/"]
}, window.RR_CONFIG || {});
const WORDS = window.RR_WORDS;
const ONLINE = !!(CFG.supabaseUrl && CFG.supabaseKey) && !CFG.onlineDisabled;
const $ = id => document.getElementById(id);
const MODE_LABEL = {easy:"Easy Mode", hard:"Hard Mode", extreme:"Extreme Mode"};
const MODE_LVL = {easy:1, hard:2, extreme:3};
const IN_APP = /; wv\)/.test(navigator.userAgent);
const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const STANDALONE = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
const LOCAL_WORDS = 12; // 6 Runden je Spieler

/* ======================================================================= Texte */
const TXT = {
de:{
  tagline:"Ein Partyspiel für zwei", title:'Rückwärts-<br><span class="mir">Rätsel</span>',
  intro:"Sprich ein Wort ein. Dein Gegenüber hört es rückwärts, spricht es rückwärts nach und hört sich dann selbst umgedreht. Was kommt dabei raus?",
  onlineTitle:"Online-Duelle", onlineSub:"Gegen Freunde, mit Benachrichtigungen", onlineSubTurn:"{c} Duelle warten auf dich", onlineSubTurn1:"Ein Duell wartet auf dich",
  onlineSubApp:"In der Web-App spielen", localTitle:"Auf einem Handy", localSub:"Abwechselnd, Handy weitergeben", localSubRun:"Runde {r}/6 · {a}:{b}",
  settings:"Einstellungen", language:"Sprache", localSec:"Spiel auf einem Handy", account:"Konto", loggedInAs:"Angemeldet als {n}", logout:"Abmelden",
  exEasy:"Kurze, klare Wörter: Hund, Banane, Kerze", exHard:"Länger und kniffliger: Eichhörnchen, Seepferdchen",
  exExtreme:"Wortmonster: Donaudampfschifffahrts­gesellschafts­kapitän",
  p1:"Spieler 1", p2:"Spieler 2", reset:"Neues Spiel starten (0:0)", resetDone:"Erledigt, neues Spiel", back:"Zurück",
  menu:"Menü", round:"Runde", words:"Wörter", showWord:"Wort zeigen", speaks:" spricht ein", lookAway:"{n}, bitte wegschauen und nicht mitlesen.",
  sideA:"Seite A · geheim", skip:"Kenne ich nicht, anderes Wort", recStartA:"Tippen und das Wort deutlich vorwärts sprechen",
  yourRec:"deine Aufnahme", testRev:"Rückwärts probehören", doneA:"Fertig, Handy weitergeben", saved:"Gespeichert. Nochmal tippen zum Neu-Aufnehmen.",
  passPhone:"Handy weitergeben", turn:" ist dran", hand2lead:"Du hörst gleich ein Wort rückwärts. Sprich genau das nach, was du hörst, egal wie komisch es klingt.", go:"Los geht's",
  step1:"1 · Anhören, so oft du willst", sideB:"Seite B · rückwärts", sideBai:"KI-Stimme · rückwärts", playRev:"Rückwärts abspielen", speed:"Tempo",
  step2:"2 · Genau so nachsprechen", recStartB:"Tippen zum Aufnehmen", savedB:"Gespeichert ({d}). Nochmal tippen zum Neu-Aufnehmen.", flip:"Meine Aufnahme umdrehen",
  step3:"3 · Deine Stimme, umgedreht", youRev:"du, rückwärts", again:"Nochmal abspielen", reRec:"Neu nachsprechen",
  whichWord:"Welches Wort war es?", placeholder:"Wort eintippen", check:"Prüfen", giveUp:"Weiß ich nicht",
  correct:"Richtig! +1 für {n}", correctYou:"Richtig! +1 Punkt für dich", wrong:"Leider daneben", gaveUp:"Nicht erraten", counts:"Zählt! +1 für {n}",
  typed:"Getippt: „{g}“ · Das Wort war", wordWas:"Das Wort war", override:"Zählt trotzdem (Punkt geben)", origFwd:"Original vorwärts anhören", next:"Nächste Runde", toFinal:"Zum Endstand",
  recRunning:"● {t} · tippen zum Stoppen", recStart:"Aufnahme starten", recStop:"Aufnahme stoppen",
  unreadable:"Die Aufnahme ließ sich nicht lesen. Bitte nochmal versuchen.", badFile:"Diese Audiodatei konnte nicht gelesen werden.",
  noMicApp:"Kein Mikrofon-Zugriff. Erlaube das Mikrofon in den Android-Einstellungen unter Apps › Rückwärts-Rätsel › Berechtigungen und tippe dann nochmal.",
  noMicWeb:"Mikrofon ist hier gesperrt. Tippe nochmal, dann öffnet sich die Sprachaufnahme deines Handys.",
  noMicPwa:"Kein Mikrofon-Zugriff. Erlaube das Mikrofon für diese Seite in den Browser-Einstellungen und tippe nochmal.", dec:",",
  jokersTitle:"Joker · jeder 1× pro Spiel", jAi:"KI spricht", jAgain:"Nochmal einsprechen", jLetters:"Buchstaben",
  aiNote:"Du hörst jetzt die KI-Stimme rückwärts statt der Aufnahme.", aiLoading:"KI-Stimme wird geladen…", aiFail:"Die KI-Stimme ist gerade nicht verfügbar. Der Joker wurde nicht verbraucht.",
  aiOnlyApp:"Die KI-Stimme gibt es nur in der App.",
  giveBack:"Handy zurückgeben", giveBackLead:"{n} hat den Nochmal-Joker gezogen. Sprich dein Wort bitte noch einmal deutlich ein.",
  rerecordNote:"{n} hat den Nochmal-Joker gezogen. Sprich dein Wort bitte noch einmal deutlich ein.",
  matchOver:"Spiel vorbei", winnerIs:"{n} gewinnt!", drawBig:"Unentschieden!", newMatch:"Neues Spiel",
  authTitle:"Online spielen", authLead:"Leg dir in 10 Sekunden ein Konto an. Du brauchst keine E-Mail.", register:"Registrieren", login:"Anmelden",
  username:"Benutzername", password:"Passwort", userHint:"3–16 Zeichen: Buchstaben, Zahlen, _ . -",
  pwHint:"Mindestens 6 Zeichen. Gut merken, ohne E-Mail kann man es nicht zurücksetzen.", createAcc:"Konto erstellen", doLogin:"Anmelden",
  e_user_taken:"Den Namen gibt es schon. Nimm einen anderen oder melde dich an.", e_login:"Name oder Passwort stimmt nicht.",
  e_name:"Name: 3–16 Zeichen, nur Buchstaben, Zahlen, _ . -", e_pw:"Passwort: mindestens 6 Zeichen.", e_offline:"Keine Verbindung. Prüf dein Internet.",
  e_user_not_found:"Diesen Spieler gibt es nicht.", e_cannot_play_self:"Gegen dich selbst geht leider nicht.", e_not_your_turn:"Gerade ist dein Gegner dran.",
  e_joker_used:"Diesen Joker hast du in diesem Spiel schon benutzt.", e_game_not_found:"Dieses Duell gibt es nicht mehr.", e_game_finished:"Das Duell ist schon vorbei.",
  e_confirm:"Im Server ist „Confirm email“ noch eingeschaltet. Bitte in Supabase ausschalten.", e_rate:"Zu viele Versuche. Warte kurz und probier es nochmal.",
  e_upload:"Die Aufnahme konnte nicht hochgeladen werden.", e_session:"Bitte melde dich neu an.", e_generic:"Das hat nicht geklappt: {m}",
  hello:"Hallo", statsLine:"{w} Siege · {l} Niederlagen · {d} Unentschieden", newDuel:"Neues Duell",
  secTurn:"Du bist dran", secWait:"Warten auf Gegner", secDone:"Beendet", emptyLobby:"Noch keine Duelle. Fordere jemanden heraus!",
  st_guess:"Rate {n}s Wort", st_speak:"Sprich ein Wort ein", st_rerecord:"Nochmal einsprechen", st_wait:"{n} ist dran", st_waitRe:"{n} spricht nochmal ein",
  st_search:"Suche zufälligen Gegner…", st_won:"Gewonnen", st_lost:"Verloren", st_draw:"Unentschieden", st_gaveupMe:"Du hast aufgegeben",
  st_gaveupOpp:"{n} hat aufgegeben", st_timeout:"Zeit abgelaufen", st_claim:"{n} spielt nicht mehr: Sieg einfordern", randomOpp:"Zufälliger Gegner",
  pushAsk:"Lass dich benachrichtigen, wenn du dran bist.", pushOn:"Einschalten", pushIsOn:"Benachrichtigungen sind an.", pushOff:"Benachrichtigungen sind aus.",
  pushIOS:"Für Benachrichtigungen auf dem iPhone: erst über Teilen › „Zum Home-Bildschirm“ installieren.", pushDenied:"Benachrichtigungen sind blockiert. Erlaube sie in den Einstellungen deines Browsers.",
  pushUnsupported:"Dieser Browser kann keine Benachrichtigungen.", pushDone:"Benachrichtigungen sind an.", pushFail:"Benachrichtigungen ließen sich nicht einschalten.",
  installAsk:"Als App installieren: schneller Start und Benachrichtigungen.", installBtn:"Installieren", installIOS:"Installieren: tippe auf Teilen und dann „Zum Home-Bildschirm“.",
  newTitle:"Neues Duell", vsFriend:"Gegen einen Freund (Benutzername)", challenge:"Herausfordern", orText:"oder", randomBtn:"Zufälligen Gegner suchen",
  you:"Du", legendMe:"Du rätst", legendOpp:"{n} rät", tapToHear:"Tippe auf ein erledigtes Wort, um die Aufnahme vorwärts zu hören.",
  g_guess:"Du bist dran: Rate {n}s Wort", g_speak:"Du bist dran: Sprich ein Wort für {n} ein", g_rerecord:"{n} möchte dein Wort nochmal hören",
  g_wait:"{n} ist dran", g_waitRe:"{n} spricht das Wort nochmal ein", g_search:"Wir suchen einen Gegner für dich. Du bekommst Bescheid.",
  g_won:"Du hast gewonnen!", g_lost:"{n} hat gewonnen", g_draw:"Unentschieden!", g_gaveupMe:"Du hast aufgegeben", g_gaveupOpp:"{n} hat aufgegeben. Du gewinnst!",
  g_timeoutWon:"{n} hat zu lange nicht gespielt. Du gewinnst!", g_timeoutLost:"Zu lange nicht gespielt. {n} gewinnt.",
  play_guess:"Wort raten", play_speak:"Wort einsprechen", play_rerecord:"Nochmal einsprechen", claimBtn:"Sieg einfordern", rematch:"Revanche",
  giveUpDuel:"Aufgeben", cancelSearch:"Suche abbrechen", giveUpQ:"Wirklich aufgeben? {n} gewinnt dann das Duell.", giveUpYes:"Ja, aufgeben", cancel:"Abbrechen",
  sendTo:"An {n} senden", sendRandom:"Wort abschicken", sent:"Gesendet!", sentLead:"{n} ist jetzt dran. Du bekommst Bescheid, sobald {n} gespielt hat.",
  sentLeadRandom:"Sobald ein zufälliger Gegner gefunden ist, geht's los. Du bekommst Bescheid.", sentAgain:"{n} spricht das Wort nochmal ein. Du bekommst Bescheid.",
  toLobby:"Zur Übersicht", nextSpeak:"Weiter: dein Wort einsprechen", finalWin:"Duell gewonnen! {a}:{b}", finalLose:"Duell verloren. {a}:{b}", finalDraw:"Unentschieden! {a}:{b}",
  loading:"Lädt…", uploading:"Wird gesendet…"
},
en:{
  tagline:"A party game for two", title:'Back<br><span class="mir">words</span>',
  intro:"Record a word. Your partner hears it backwards, copies the backwards sound and then hears their own voice flipped. What comes out?",
  onlineTitle:"Online duels", onlineSub:"Play friends, get notified", onlineSubTurn:"{c} duels are waiting for you", onlineSubTurn1:"A duel is waiting for you",
  onlineSubApp:"Play in the web app", localTitle:"On one phone", localSub:"Take turns, pass the phone", localSubRun:"Round {r}/6 · {a}:{b}",
  settings:"Settings", language:"Language", localSec:"Game on one phone", account:"Account", loggedInAs:"Signed in as {n}", logout:"Sign out",
  exEasy:"Short, clear words: dog, banana, candle", exHard:"Longer and trickier: caterpillar, refrigerator",
  exExtreme:"Word monsters: supercalifragilistic­expialidocious",
  p1:"Player 1", p2:"Player 2", reset:"Start a new game (0:0)", resetDone:"Done, new game", back:"Back",
  menu:"Menu", round:"Round", words:"words", showWord:"Show word", speaks:" records", lookAway:"{n}, look away and no peeking.",
  sideA:"Side A · secret", skip:"Don't know it, new word", recStartA:"Tap and say the word clearly, forwards",
  yourRec:"your recording", testRev:"Preview backwards", doneA:"Done, pass the phone", saved:"Saved. Tap again to re-record.",
  passPhone:"Pass the phone", turn:"'s turn", hand2lead:"You're about to hear a word backwards. Copy exactly what you hear, no matter how weird it sounds.", go:"Let's go",
  step1:"1 · Listen as often as you like", sideB:"Side B · backwards", sideBai:"AI voice · backwards", playRev:"Play backwards", speed:"Speed",
  step2:"2 · Copy it exactly", recStartB:"Tap to record", savedB:"Saved ({d}). Tap again to re-record.", flip:"Flip my recording",
  step3:"3 · Your voice, flipped", youRev:"you, backwards", again:"Play again", reRec:"Record again",
  whichWord:"Which word was it?", placeholder:"Type the word", check:"Check", giveUp:"No idea",
  correct:"Correct! +1 for {n}", correctYou:"Correct! +1 point for you", wrong:"Not quite", gaveUp:"Not guessed", counts:"Counts! +1 for {n}",
  typed:"You typed: “{g}” · The word was", wordWas:"The word was", override:"Count it anyway (give point)", origFwd:"Play original forwards", next:"Next round", toFinal:"See final score",
  recRunning:"● {t} · tap to stop", recStart:"Start recording", recStop:"Stop recording",
  unreadable:"Couldn't read the recording. Please try again.", badFile:"This audio file couldn't be read.",
  noMicApp:"No microphone access. Allow the microphone in Android settings under Apps › Rückwärts-Rätsel › Permissions, then tap again.",
  noMicWeb:"The microphone is blocked here. Tap again to open your phone's voice recorder.",
  noMicPwa:"No microphone access. Allow the microphone for this site in your browser settings, then tap again.", dec:".",
  jokersTitle:"Jokers · each once per game", jAi:"AI speaks", jAgain:"Record again", jLetters:"Letters",
  aiNote:"You're now hearing the AI voice backwards instead of the recording.", aiLoading:"Loading AI voice…", aiFail:"The AI voice isn't available right now. Your joker wasn't used.",
  aiOnlyApp:"The AI voice is only available in the app.",
  giveBack:"Hand the phone back", giveBackLead:"{n} played the record-again joker. Please say your word again, clearly.",
  rerecordNote:"{n} played the record-again joker. Please say your word again, clearly.",
  matchOver:"Game over", winnerIs:"{n} wins!", drawBig:"It's a draw!", newMatch:"New game",
  authTitle:"Play online", authLead:"Create an account in 10 seconds. No email needed.", register:"Sign up", login:"Sign in",
  username:"Username", password:"Password", userHint:"3–16 characters: letters, numbers, _ . -",
  pwHint:"At least 6 characters. Remember it, without email it can't be reset.", createAcc:"Create account", doLogin:"Sign in",
  e_user_taken:"That name is taken. Pick another one or sign in.", e_login:"Wrong username or password.",
  e_name:"Name: 3–16 characters, only letters, numbers, _ . -", e_pw:"Password: at least 6 characters.", e_offline:"No connection. Check your internet.",
  e_user_not_found:"There's no player with that name.", e_cannot_play_self:"You can't play against yourself.", e_not_your_turn:"It's your opponent's turn.",
  e_joker_used:"You already used this joker in this game.", e_game_not_found:"This duel doesn't exist anymore.", e_game_finished:"This duel is already over.",
  e_confirm:"“Confirm email” is still on in the server. Please turn it off in Supabase.", e_rate:"Too many attempts. Wait a moment and try again.",
  e_upload:"The recording couldn't be uploaded.", e_session:"Please sign in again.", e_generic:"That didn't work: {m}",
  hello:"Hi", statsLine:"{w} wins · {l} losses · {d} draws", newDuel:"New duel",
  secTurn:"Your turn", secWait:"Waiting for opponent", secDone:"Finished", emptyLobby:"No duels yet. Challenge someone!",
  st_guess:"Guess {n}'s word", st_speak:"Record a word", st_rerecord:"Record again", st_wait:"{n}'s turn", st_waitRe:"{n} is recording again",
  st_search:"Looking for a random opponent…", st_won:"Won", st_lost:"Lost", st_draw:"Draw", st_gaveupMe:"You gave up",
  st_gaveupOpp:"{n} gave up", st_timeout:"Timed out", st_claim:"{n} stopped playing: claim the win", randomOpp:"Random opponent",
  pushAsk:"Get notified when it's your turn.", pushOn:"Turn on", pushIsOn:"Notifications are on.", pushOff:"Notifications are off.",
  pushIOS:"For notifications on iPhone, first install via Share › “Add to Home Screen”.", pushDenied:"Notifications are blocked. Allow them in your browser settings.",
  pushUnsupported:"This browser can't show notifications.", pushDone:"Notifications are on.", pushFail:"Couldn't turn on notifications.",
  installAsk:"Install as an app: quick start and notifications.", installBtn:"Install", installIOS:"To install: tap Share, then “Add to Home Screen”.",
  newTitle:"New duel", vsFriend:"Play a friend (username)", challenge:"Challenge", orText:"or", randomBtn:"Find a random opponent",
  you:"You", legendMe:"You guess", legendOpp:"{n} guesses", tapToHear:"Tap a finished word to hear the recording forwards.",
  g_guess:"Your turn: guess {n}'s word", g_speak:"Your turn: record a word for {n}", g_rerecord:"{n} wants to hear your word again",
  g_wait:"{n}'s turn", g_waitRe:"{n} is recording the word again", g_search:"We're finding an opponent for you. You'll get notified.",
  g_won:"You won!", g_lost:"{n} won", g_draw:"It's a draw!", g_gaveupMe:"You gave up", g_gaveupOpp:"{n} gave up. You win!",
  g_timeoutWon:"{n} took too long. You win!", g_timeoutLost:"You took too long. {n} wins.",
  play_guess:"Guess the word", play_speak:"Record a word", play_rerecord:"Record again", claimBtn:"Claim the win", rematch:"Rematch",
  giveUpDuel:"Give up", cancelSearch:"Cancel search", giveUpQ:"Really give up? {n} will win the duel.", giveUpYes:"Yes, give up", cancel:"Cancel",
  sendTo:"Send to {n}", sendRandom:"Send word", sent:"Sent!", sentLead:"It's {n}'s turn now. You'll get notified when {n} has played.",
  sentLeadRandom:"As soon as a random opponent is found, the game starts. You'll get notified.", sentAgain:"{n} is recording the word again. You'll get notified.",
  toLobby:"Back to overview", nextSpeak:"Next: record your word", finalWin:"Duel won! {a}:{b}", finalLose:"Duel lost. {a}:{b}", finalDraw:"Draw! {a}:{b}",
  loading:"Loading…", uploading:"Sending…"
}};

/* ======================================================================= Zustand */
const store = {
  get(k){ try{ return JSON.parse(localStorage.getItem(k)||"null"); }catch(e){ return null; } },
  set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};
const navLang = (navigator.language||"de").toLowerCase().startsWith("de") ? "de" : "en";
const S = Object.assign({lang:navLang, mode:"easy", names:null, scores:[0,0], round:1, speaker:0, slow:false, lj:[[],[]]}, store.get("rr-state")||{});
if(!S.names) S.names=[TXT[S.lang].p1, TXT[S.lang].p2];
if(!(S.round>=1 && S.round<=LOCAL_WORDS+1)) { S.round=1; S.scores=[0,0]; S.speaker=0; }
if(!Array.isArray(S.lj)) S.lj=[[],[]];
const save = () => store.set("rr-state", {lang:S.lang,mode:S.mode,names:S.names,scores:S.scores,round:S.round,speaker:S.speaker,slow:S.slow,lj:S.lj});
const t = (k, vars={}) => (TXT[S.lang][k] ?? TXT.de[k] ?? k).replace(/\{(\w)\}/g,(_,v)=>vars[v]??"");
const used = {};
let R = {};            // aktuelle Runde
let CTX = {kind:"local"}; // {kind:'online', game:view}
let LOBBY = null;

/* ======================================================================= Hilfen */
function toast(msg, ms=3200){ const el=$("toast"); el.textContent=msg; el.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>el.hidden=true, ms); }
function busy(btn, on, label){
  if(!btn) return;
  if(on){ btn.dataset.html = btn.innerHTML; btn.classList.add("busy"); btn.innerHTML = '<span class="spin"></span>' + (label ? " "+esc(label) : ""); }
  else if(btn.dataset.html!==undefined){ btn.classList.remove("busy"); btn.innerHTML = btn.dataset.html; delete btn.dataset.html; }
}
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function hue(name){ let h=0; for(const c of String(name||"?")) h=(h*31+c.charCodeAt(0))>>>0; return h%360; }
function avatar(el, name){ el.textContent=(name||"?").trim().charAt(0)||"?"; el.style.background=`hsl(${hue(name)} 80% 72%)`; }
function vib(p){ if(navigator.vibrate) try{ navigator.vibrate(p); }catch(e){} }
function uuid(){ if(crypto.randomUUID) return crypto.randomUUID(); const b=crypto.getRandomValues(new Uint8Array(16)); b[6]=(b[6]&15)|64; b[8]=(b[8]&63)|128; const h=[...b].map(x=>x.toString(16).padStart(2,"0")).join(""); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`; }
function pattern(word){ const out=[]; let first=true; for(const ch of word){ if(/\p{L}/u.test(ch)){ out.push(first?ch.toUpperCase():"_"); first=false; } else if(ch===" "){ out.push("/"); first=true; } else out.push(ch); } return out.join(" "); }

class AppErr extends Error{ constructor(code, msg){ super(msg||code); this.code=code; } }
function errText(e){
  const c = String(e && (e.code||e.message) || "");
  const m = String(e && e.message || "");
  const map = {user_already_exists:"e_user_taken","User already registered":"e_user_taken",invalid_credentials:"e_login",invalid_grant:"e_login",
    "Invalid login credentials":"e_login",weak_password:"e_pw",offline:"e_offline",user_not_found:"e_user_not_found",cannot_play_self:"e_cannot_play_self",
    not_your_turn:"e_not_your_turn",joker_used:"e_joker_used",game_not_found:"e_game_not_found",game_finished:"e_game_finished",confirm:"e_confirm",
    over_request_rate_limit:"e_rate",http_429:"e_rate",upload:"e_upload",session:"e_session",refresh_token_not_found:"e_session"};
  const k = map[c] || map[m];
  return k ? t(k) : t("e_generic",{m: m || c});
}

/* ======================================================================= Supabase (schlanker REST-Client) */
const SB = {
  session: store.get("rr-session"),
  user(){ return this.session && this.session.user; },
  name(){ const u=this.user(); return u ? ((u.user_metadata && u.user_metadata.username) || (u.email||"").split("@")[0]) : ""; },
  setSession(j){ this.session = {access_token:j.access_token, refresh_token:j.refresh_token, expires_at: j.expires_at || (Math.floor(Date.now()/1000)+(j.expires_in||3600)), user:j.user || (this.session&&this.session.user)}; store.set("rr-session", this.session); },
  clear(){ this.session=null; store.set("rr-session", null); },
  async raw(path, {method="GET", body, headers={}, auth=true}={}){
    const h = {apikey: CFG.supabaseKey, ...headers};
    if(auth && this.session) h.Authorization = "Bearer " + this.session.access_token;
    let b = body;
    if(body!==undefined && !(body instanceof Blob)){ h["Content-Type"]="application/json"; b=JSON.stringify(body); }
    try{ return await fetch(CFG.supabaseUrl.replace(/\/$/,"") + path, {method, headers:h, body:b}); }
    catch(e){ throw new AppErr("offline"); }
  },
  async req(path, opts={}){
    const auth = opts.auth!==false;
    if(auth && this.session && Date.now()/1000 > this.session.expires_at - 60) await this.refresh();
    let r = await this.raw(path, opts);
    if(r.status===401 && auth && this.session && !opts._retried){ await this.refresh(); r = await this.raw(path, {...opts, _retried:true}); }
    if(!r.ok){
      let j={}; try{ j=await r.json(); }catch(e){}
      const code = j.error_code || (typeof j.code==="string" && !/^(P0001|PGRST|\d)/.test(j.code) ? j.code : "") || (j.code==="P0001" ? j.message : "") || j.error || ("http_"+r.status);
      throw new AppErr(code, j.message || j.msg || j.error_description || j.error || ("HTTP "+r.status));
    }
    if(opts.blob) return await r.blob();
    const txt = await r.text(); return txt ? JSON.parse(txt) : null;
  },
  async refresh(){
    if(!this.session) throw new AppErr("session");
    const r = await this.raw("/auth/v1/token?grant_type=refresh_token", {method:"POST", auth:false, body:{refresh_token:this.session.refresh_token}});
    if(!r.ok){ this.clear(); throw new AppErr("session"); }
    this.setSession(await r.json());
  },
  email(name){ return name.trim().toLowerCase() + "@" + CFG.emailDomain; },
  async signUp(name, pw){
    const j = await this.req("/auth/v1/signup", {method:"POST", auth:false, body:{email:this.email(name), password:pw, data:{username:name.trim()}}});
    if(!j || !j.access_token) throw new AppErr("confirm");
    this.setSession(j);
  },
  async signIn(name, pw){ this.setSession(await this.req("/auth/v1/token?grant_type=password", {method:"POST", auth:false, body:{email:this.email(name), password:pw}})); },
  async signOut(){ try{ await this.raw("/auth/v1/logout", {method:"POST"}); }catch(e){} this.clear(); },
  rpc(fn, args={}){ return this.req("/rest/v1/rpc/"+fn, {method:"POST", body:args}); },
  async upload(path, blob){
    try{ return await this.req("/storage/v1/object/audio/"+path, {method:"POST", body:blob, headers:{"Content-Type":"audio/wav","x-upsert":"false"}}); }
    catch(e){ if(e.code==="offline") throw e; throw new AppErr("upload", e.message); }
  },
  download(path){ return this.req("/storage/v1/object/authenticated/audio/"+path, {blob:true}); },
  notify(gameId){ return this.req("/functions/v1/"+CFG.notifyFunction, {method:"POST", body:{game_id:gameId}}).catch(()=>null); }
};

/* ======================================================================= Texte anwenden */
function applyLang(){
  document.documentElement.lang = S.lang;
  document.querySelectorAll("[data-t]").forEach(el=>{ el.textContent = t(el.dataset.t); });
  $("title").innerHTML = t("title");
  $("guess").placeholder = t("placeholder");
  document.title = S.lang==="de" ? "Rückwärts-Rätsel" : "Backwords";
  document.querySelectorAll(".caslbl").forEach(x=>x.textContent = S.lang==="de" ? "RÜCKWÄRTS-RÄTSEL" : "BACKWORDS");
  ["recA","recB"].forEach(id=>$(id).setAttribute("aria-label", t("recStart")));
  ["bSettings","bSettings2"].forEach(id=>$(id).setAttribute("aria-label", t("settings")));
  document.querySelectorAll("[data-home].iconbtn").forEach(b=>b.setAttribute("aria-label", t("back")));
  setAuthMode(document.querySelector('input[name=authmode]:checked').value);
}

/* ======================================================================= Wörter */
function pickWord(lang, mode){
  const key = lang+mode, list = WORDS[lang][mode];
  const u = used[key] || (used[key] = new Set());
  if(u.size >= list.length) u.clear();
  let w; do{ w = list[Math.floor(Math.random()*list.length)]; }while(u.has(w));
  u.add(w); return w;
}

/* ======================================================================= Bildschirme */
const screens = ["home","settings","auth","lobby","new","game","hand","speak","imitate","guess","result","sent","final"];
let current = "home";
function show(name){
  stopPlayback(); stopRecording(true);
  current = name;
  screens.forEach(s => $("s-"+s).hidden = s!==name);
  window.scrollTo(0,0);
  reels(name==="home" ? "fwd" : null);
  paintMeta();
  if(name==="home") paintHome();
}
function paintMeta(){
  let txt;
  if(CTX.kind==="online" && CTX.game){
    const g=CTX.game; const r = Math.min(g.rounds, Math.max(1, Math.ceil((g.history.filter(h=>h.state==="done").length+1)/2)));
    txt = [`${t("round")} ${r}/${g.rounds}`, ` · ${g.my_score}:${g.opp_score} · ${g.opponent_name||t("randomOpp")}`];
  } else {
    txt = [`${t("round")} ${Math.min(6,Math.ceil(S.round/2))}/6`, ` · ${S.scores[0]}:${S.scores[1]} · ${MODE_LABEL[S.mode]}`];
  }
  document.querySelectorAll(".mb").forEach(el=>{ el.innerHTML=""; const b=document.createElement("b"); b.textContent=txt[0]; el.append(b, txt[1]); });
}
function paintHome(){
  if(!ONLINE){ $("onlineSub").textContent = CFG.appUrl ? t("onlineSubApp") : t("onlineSub"); $("turnBadge").hidden=true; }
  else {
    const c = LOBBY ? LOBBY.filter(g=>g.my_turn).length : 0;
    $("onlineSub").textContent = c>1 ? t("onlineSubTurn",{c}) : c===1 ? t("onlineSubTurn1") : t("onlineSub");
    $("turnBadge").hidden = !c; $("turnBadge").textContent = c;
  }
  $("localSub").textContent = S.round>1 && S.round<=LOCAL_WORDS ? t("localSubRun",{r:Math.ceil(S.round/2), a:S.scores[0], b:S.scores[1]}) : t("localSub");
}
function reels(dir, rate=1){ document.querySelectorAll("[data-cas]").forEach(c=>{ c.classList.remove("fwd","rev"); c.style.setProperty("--spin", (1.6/rate)+"s"); if(dir) c.classList.add(dir); }); }
function renderScore(el, names, scores, turnIdx){
  el.innerHTML = "";
  [0,1].forEach((i,k)=>{
    const d=document.createElement("div"); d.className="p"+(i===turnIdx?" turn":"");
    const n=document.createElement("div"); n.className="n"; n.textContent=names[i];
    const p=document.createElement("div"); p.className="pts"; p.textContent=scores[i];
    d.append(n,p); el.append(d);
    if(k===0){ const v=document.createElement("span"); v.className="vs"; v.textContent=":"; el.append(v); }
  });
}
function showHand({eyebrow, name, rest, lead, btn, go}){
  $("hEyebrow").textContent = eyebrow; const b=$("hBig"); b.innerHTML=""; const e=document.createElement("em"); e.textContent=name; b.append(e, rest);
  $("hLead").textContent = lead; $("bHandGo").textContent = btn; $("bHandGo").onclick = go; show("hand");
}

/* ======================================================================= Audio */
let ctx;
function audio(){ if(!ctx) ctx = new (window.AudioContext||window.webkitAudioContext)(); if(ctx.state==="suspended") ctx.resume(); return ctx; }
function trimSilence(buf){
  const d = buf.getChannelData(0); let peak=0;
  for(let i=0;i<d.length;i++){ const a=Math.abs(d[i]); if(a>peak) peak=a; }
  const th = Math.max(0.01, peak*0.08);
  let s=0, e=d.length-1;
  while(s<d.length && Math.abs(d[s])<th) s++;
  while(e>s && Math.abs(d[e])<th) e--;
  const pad = Math.floor(buf.sampleRate*0.12);
  s=Math.max(0,s-pad); e=Math.min(d.length-1,e+pad);
  if(e-s < buf.sampleRate*0.15) return buf;
  const out = audio().createBuffer(buf.numberOfChannels, e-s+1, buf.sampleRate);
  for(let c=0;c<buf.numberOfChannels;c++) out.getChannelData(c).set(buf.getChannelData(c).subarray(s,e+1));
  return out;
}
function reverseBuffer(buf){
  const out = audio().createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for(let c=0;c<buf.numberOfChannels;c++){ const src=buf.getChannelData(c), dst=out.getChannelData(c);
    for(let i=0,n=src.length;i<n;i++) dst[i]=src[n-1-i]; }
  return out;
}
async function decode(ab){ return await new Promise((res,rej)=>{ const p = audio().decodeAudioData(ab,res,rej); if(p&&p.then) p.then(res,rej); }); }
async function blobToBuffer(blob){ return decode(await blob.arrayBuffer()); }
async function toWav(buf){
  const sr = 16000, len = Math.max(1, Math.ceil(buf.duration*sr));
  const oc = new (window.OfflineAudioContext||window.webkitOfflineAudioContext)(1, len, sr);
  const s = oc.createBufferSource(); s.buffer = buf; s.connect(oc.destination); s.start();
  const r = await oc.startRendering(); const d = r.getChannelData(0);
  let peak=0; for(let i=0;i<d.length;i++){ const a=Math.abs(d[i]); if(a>peak) peak=a; }
  const gain = peak>0.001 ? Math.min(4, 0.9/peak) : 1;
  const ab = new ArrayBuffer(44 + d.length*2), v = new DataView(ab);
  const str=(o,s)=>{ for(let i=0;i<s.length;i++) v.setUint8(o+i, s.charCodeAt(i)); };
  str(0,"RIFF"); v.setUint32(4, 36+d.length*2, true); str(8,"WAVE"); str(12,"fmt "); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,sr,true); v.setUint32(28,sr*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true); str(36,"data"); v.setUint32(40, d.length*2, true);
  for(let i=0;i<d.length;i++){ const x=Math.max(-1,Math.min(1,d[i]*gain)); v.setInt16(44+i*2, x<0?x*0x8000:x*0x7FFF, true); }
  return new Blob([ab], {type:"audio/wav"});
}
const audioCache = new Map();
async function fetchAudio(path){
  if(audioCache.has(path)) return audioCache.get(path);
  const buf = await blobToBuffer(await SB.download(path));
  audioCache.set(path, buf); return buf;
}

/* Wellenform */
function drawWave(canvas, buf, progress=-1){
  const dpr = window.devicePixelRatio||1, w = canvas.clientWidth, h = canvas.clientHeight;
  if(!w) return;
  canvas.width = w*dpr; canvas.height = h*dpr;
  const g = canvas.getContext("2d"); g.scale(dpr,dpr); g.clearRect(0,0,w,h);
  const grad = g.createLinearGradient(0,0,w,0); grad.addColorStop(0,"#FF4F7B"); grad.addColorStop(1,"#FFB547");
  if(!buf){ g.fillStyle="#3B3480"; g.fillRect(0,h/2-1,w,2); return; }
  const d = buf.getChannelData(0), bars = Math.max(24, Math.floor(w/5)), step = Math.floor(d.length/bars)||1;
  let peak=0.0001; const vals=[];
  for(let b=0;b<bars;b++){ let m=0; for(let i=b*step;i<(b+1)*step && i<d.length;i+=4){ const a=Math.abs(d[i]); if(a>m) m=a; } vals.push(m); if(m>peak) peak=m; }
  const bw = w/bars;
  vals.forEach((v,b)=>{ const bh = Math.max(3,(v/peak)*(h-10));
    g.fillStyle = (progress<0 || b/bars <= progress) ? grad : "#3B3480";
    roundBar(g, b*bw+1.5, (h-bh)/2, Math.max(1.5,bw-3), bh); });
  if(progress>=0 && progress<1){ g.fillStyle="#F5F2FF"; g.fillRect(progress*w-1,2,2,h-4); }
}
function roundBar(g,x,y,w,h){ const r=Math.min(w/2,3); g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.fill(); }
const fmt = s => s.toFixed(1).replace(".",t("dec"))+" s";

let playing=null, raf=0;
function stopPlayback(){ if(playing){ try{playing.src.stop();}catch(e){} if(playing.canvas) drawWave(playing.canvas,playing.buf); playing=null; reels(null); } cancelAnimationFrame(raf); }
function play(buf, canvas, dir="rev", rate=1){
  stopPlayback(); if(!buf) return;
  const c = audio(), src = c.createBufferSource(); src.buffer=buf; src.playbackRate.value=rate; src.connect(c.destination);
  const t0 = c.currentTime, dur = buf.duration/rate; src.start();
  playing = {src,buf,canvas}; reels(dir, rate); vib(15);
  src.onended = ()=>{ if(playing && playing.src===src){ if(canvas) drawWave(canvas,buf); playing=null; reels(null); cancelAnimationFrame(raf);} };
  if(canvas){ const tick=()=>{ if(!playing||playing.src!==src) return; drawWave(canvas,buf,Math.min(1,(c.currentTime-t0)/dur)); raf=requestAnimationFrame(tick); }; tick(); }
}

/* Aufnahme */
let micBlocked=false, rec=null, recTimer=0, fileTarget=null;
async function startRecording(btn, label, onDone){
  audio();
  if(micBlocked && !IN_APP && !ONLINE){ openFilePicker(onDone); return; }
  try{
    const stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
    micBlocked=false;
    const chunks=[]; const mr = new MediaRecorder(stream);
    const an = audio().createAnalyser(); an.fftSize=512; audio().createMediaStreamSource(stream).connect(an);
    const data = new Uint8Array(an.fftSize);
    mr.ondataavailable = e=>{ if(e.data.size) chunks.push(e.data); };
    mr.onstop = async ()=>{
      stream.getTracks().forEach(tr=>tr.stop());
      const cancelled = rec && rec.cancel; rec=null; reels(null);
      if(cancelled) return;
      try{ onDone(await blobToBuffer(new Blob(chunks,{type:mr.mimeType||"audio/webm"}))); }
      catch(e){ label.textContent=t("unreadable"); }
    };
    rec = {mr,btn,label,cancel:false}; mr.start(); reels("fwd"); vib(30);
    btn.classList.add("on"); btn.setAttribute("aria-label",t("recStop")); label.classList.add("live");
    const t0=Date.now();
    const lvl=()=>{ if(!rec) { btn.style.setProperty("--lvl",1); return; } an.getByteTimeDomainData(data); let m=0; for(const v of data){ const a=Math.abs(v-128); if(a>m) m=a; } btn.style.setProperty("--lvl", (1+m/128*0.5).toFixed(3)); requestAnimationFrame(lvl); }; lvl();
    label.textContent=t("recRunning",{t:fmt(0)});
    recTimer = setInterval(()=>{ label.textContent=t("recRunning",{t:fmt((Date.now()-t0)/1000)}); if(Date.now()-t0>15000) stopRecording(); },100);
  }catch(e){
    micBlocked = true;
    if(IN_APP) label.textContent = t("noMicApp");
    else if(ONLINE) label.textContent = t("noMicPwa");
    else { label.textContent = t("noMicWeb"); openFilePicker(onDone); }
  }
}
function stopRecording(cancel=false){
  clearInterval(recTimer);
  if(!rec) return;
  rec.cancel = cancel; rec.btn.classList.remove("on"); rec.btn.setAttribute("aria-label",t("recStart")); rec.label.classList.remove("live");
  if(rec.mr.state!=="inactive") rec.mr.stop(); else rec=null;
}
function openFilePicker(onDone){ fileTarget=onDone; $("fileIn").value=""; $("fileIn").click(); }
$("fileIn").addEventListener("change", async e=>{
  const f=e.target.files[0]; if(!f||!fileTarget) return;
  try{ fileTarget(await blobToBuffer(f)); }catch(err){ const x=$("s-speak").hidden?$("tB"):$("tA"); x.textContent=t("badFile"); }
});
function recToggle(btn,label,onDone){ if(rec && rec.btn===btn){ stopRecording(); } else { stopPlayback(); startRecording(btn,label,onDone); } }

/* ======================================================================= KI-Stimme (meSpeak, lädt bei Bedarf) */
const TTS = {
  ready:null, base:"", voices:{},
  available(){ return CFG.ttsBases && CFG.ttsBases.length>0; },
  loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement("script"); s.src=src; s.async=true; const to=setTimeout(()=>rej(new Error("timeout")),20000); s.onload=()=>{clearTimeout(to);res();}; s.onerror=()=>{clearTimeout(to);s.remove();rej(new Error("load"));}; document.head.append(s); }); },
  load(){
    if(this.ready) return this.ready;
    this.ready = (async()=>{
      let last;
      for(const base of CFG.ttsBases){
        try{
          if(!window.meSpeak) await this.loadScript(base+"mespeak.js");
          if(!window.meSpeak) throw new Error("no meSpeak");
          this.base = base;
          if(typeof meSpeak.isConfigLoaded==="function" && !meSpeak.isConfigLoaded() && typeof meSpeak.loadConfig==="function"){
            meSpeak.loadConfig(base+"mespeak_config.json");
            const t0=Date.now();
            while(!meSpeak.isConfigLoaded()){ if(Date.now()-t0>20000) throw new Error("config"); await new Promise(r=>setTimeout(r,100)); }
          }
          return;
        }catch(e){ last=e; }
      }
      throw last || new Error("tts");
    })();
    this.ready.catch(()=>{ this.ready=null; });
    return this.ready;
  },
  async voice(lang){
    await this.load();
    if(this.voices[lang]) return this.voices[lang];
    const url = this.base + (lang==="de" ? "voices/de.json" : "voices/en/en.json");
    const id = await new Promise((res,rej)=>{
      const to=setTimeout(()=>rej(new Error("timeout")),20000);
      meSpeak.loadVoice(url, (ok, msg)=>{ clearTimeout(to); ok ? res((typeof msg==="string" && msg) || (lang==="de"?"de":"en/en")) : rej(new Error(String(msg))); });
    });
    this.voices[lang]=id; return id;
  },
  async speak(text, lang){
    const v = await this.voice(lang);
    const data = meSpeak.speak(text, {voice:v, rawdata:"array", speed:135, pitch:45, wordgap:3});
    if(!data || !data.length && !data.byteLength) throw new Error("synth");
    const u8 = data instanceof ArrayBuffer ? new Uint8Array(data) : Uint8Array.from(data);
    return trimSilence(await decode(u8.buffer));
  }
};

/* ======================================================================= Startseite + Einstellungen */
$("bOnline").onclick = ()=>{
  if(!ONLINE){ if(CFG.appUrl){ const a=document.createElement("a"); a.href=CFG.appUrl; a.target="_blank"; a.rel="noopener"; document.body.append(a); a.click(); a.remove(); } else toast(t("onlineSubApp")); return; }
  audio(); SB.session ? openLobby() : show("auth");
};
$("bLocal").onclick = ()=>{ audio(); CTX={kind:"local"}; startLocal(); };
function openSettings(){
  $("m-"+S.mode).checked = true; $("l-"+S.lang).checked = true; $("n1").value=S.names[0]; $("n2").value=S.names[1];
  $("accountBox").hidden = !(ONLINE && SB.session);
  if(ONLINE && SB.session){ $("accName").textContent = t("loggedInAs",{n:SB.name()}); paintPushRow(); }
  settingsReturn = current; show("settings");
}
let settingsReturn = "home";
$("bSettings").onclick = openSettings; $("bSettings2").onclick = openSettings;
document.querySelectorAll('input[name=mode]').forEach(r=>r.onchange=()=>{ S.mode=r.value; save(); });
document.querySelectorAll('input[name=lang]').forEach(r=>r.onchange=()=>{
  const old=S.lang; S.lang=r.value;
  S.names = S.names.map((n,i)=> n===TXT[old]["p"+(i+1)] ? TXT[S.lang]["p"+(i+1)] : n);
  $("n1").value=S.names[0]; $("n2").value=S.names[1]; save(); applyLang();
  if(ONLINE && SB.session){ $("accName").textContent = t("loggedInAs",{n:SB.name()}); paintPushRow(); resavePush(); }
});
["n1","n2"].forEach((id,i)=>$(id).oninput=()=>{ S.names[i]=$(id).value.trim()||TXT[S.lang]["p"+(i+1)]; save(); });
$("bReset").onclick = ()=>{ resetLocal(); $("bReset").textContent=t("resetDone"); setTimeout(()=>$("bReset").textContent=t("reset"),1800); };
$("bBack").onclick = ()=> settingsReturn==="lobby" ? openLobby() : show("home");
$("bLogout").onclick = async ()=>{ await disablePush(); await SB.signOut(); LOBBY=null; show("home"); };
document.querySelectorAll("[data-home]").forEach(b=>b.onclick=()=>show("home"));
document.querySelectorAll("[data-lobby]").forEach(b=>b.onclick=()=>openLobby());
document.querySelectorAll("[data-quit]").forEach(b=>b.onclick=()=> CTX.kind==="online" ? openGame(CTX.game.id) : show("home"));

/* ======================================================================= Lokales Spiel */
function resetLocal(){ S.scores=[0,0]; S.round=1; S.speaker=0; S.lj=[[],[]]; save(); }
function startLocal(){
  CTX={kind:"local"};
  if(S.round>LOCAL_WORDS){ showFinal(); return; }
  R = {};
  const sp=S.names[S.speaker], gu=S.names[1-S.speaker];
  showHand({eyebrow:`${t("round")} ${Math.ceil(S.round/2)}/6`, name:sp, rest:t("speaks"), lead:t("lookAway",{n:gu}), btn:t("showWord"),
    go:()=>{ newWord(); openSpeak("local"); }});
}
function showFinal(){
  const [a,b]=S.scores;
  $("finalBig").textContent = a===b ? t("drawBig") : t("winnerIs",{n:S.names[a>b?0:1]});
  renderScore($("finalScore"), S.names, S.scores, -1);
  show("final"); if(a!==b) confetti();
}
$("bNewMatch").onclick = ()=>{ resetLocal(); startLocal(); };

/* ======================================================================= Einsprechen (lokal + online) */
function newWord(){
  const lang = CTX.kind==="online" ? CTX.game.lang : S.lang, mode = CTX.kind==="online" ? CTX.game.mode : S.mode;
  R.word = pickWord(lang, mode); R.orig=null; R.revA=null;
}
function openSpeak(kind){
  R.speakKind = kind; // local | local-re | online | online-re
  const re = kind.endsWith("-re");
  $("theWord").textContent = R.word; $("theWord").classList.toggle("long", R.word.length>18);
  $("tapeA").hidden = true; $("afterA").hidden = true; $("bSkip").hidden = re; $("tA").textContent=t("recStartA");
  const note = $("speakNote");
  if(re){ const n = kind==="online-re" ? CTX.game.opponent_name : S.names[1-S.speaker]; note.textContent = t("rerecordNote",{n}); note.hidden=false; }
  else note.hidden = true;
  $("bDoneA").textContent = kind.startsWith("online") ? (CTX.game.opponent_name ? t("sendTo",{n:CTX.game.opponent_name}) : t("sendRandom")) : t("doneA");
  show("speak");
}
$("bSkip").onclick = ()=>{ stopRecording(true); newWord(); openSpeak(R.speakKind); };
$("recA").onclick = ()=> recToggle($("recA"), $("tA"), buf=>{
  R.orig = trimSilence(buf); R.revA = reverseBuffer(R.orig);
  $("tapeA").hidden=false; drawWave($("cA"),R.orig); $("dA").textContent=fmt(R.orig.duration);
  $("tA").textContent=t("saved"); $("afterA").hidden=false; $("bSkip").hidden=true;
});
$("bTestA").onclick = ()=> play(R.revA, $("cA"));
$("bDoneA").onclick = async ()=>{
  const k = R.speakKind;
  if(k==="local"){
    showHand({eyebrow:t("passPhone"), name:S.names[1-S.speaker], rest:t("turn"), lead:t("hand2lead"), btn:t("go"), go:()=>openImitate()});
    return;
  }
  if(k==="local-re"){
    R.ai=false;
    showHand({eyebrow:t("passPhone"), name:S.names[1-S.speaker], rest:t("turn"), lead:t("hand2lead"), btn:t("go"), go:()=>openImitate()});
    return;
  }
  // online
  const btn=$("bDoneA"); busy(btn,true,t("uploading"));
  try{
    const g = CTX.game, path = `${g.id}/${uuid()}.wav`;
    await SB.upload(path, await toWav(R.orig));
    let view;
    if(k==="online") view = await SB.rpc("submit_word", {p_game:g.id, p_word:R.word, p_path:path});
    else view = await SB.rpc("rerecord", {p_game:g.id, p_path:path});
    CTX.game = view; SB.notify(g.id); vib(30);
    showSent(view.status==="open" ? t("sentLeadRandom") : t("sentLead",{n:view.opponent_name}));
  }catch(e){ busy(btn,false); toast(errText(e)); }
};
function showSent(lead){
  $("sentEyebrow").textContent = CTX.game && CTX.game.opponent_name ? CTX.game.opponent_name : t("randomOpp");
  $("sentLead").textContent = lead;
  $("sentPush").hidden = !(ONLINE && pushState()==="off");
  show("sent");
}

/* ======================================================================= Raten: anhören + nachsprechen */
function jokerUsed(kind){
  return CTX.kind==="online" ? (CTX.game.my_jokers||[]).includes(kind) : (S.lj[1-S.speaker]||[]).includes(kind);
}
function paintJokers(){
  document.querySelectorAll("#jokers .joker").forEach(b=>{
    const k=b.dataset.j, usedNow = jokerUsed(k);
    b.disabled = usedNow || (k==="ai" && !TTS.available());
    b.classList.toggle("active", (k==="letters" && !!R.hint) || (k==="ai" && !!R.ai));
    b.title = (k==="ai" && !TTS.available()) ? t("aiOnlyApp") : "";
  });
  $("hintBox").hidden = !R.hint; $("hintBox").textContent = R.hint||"";
  $("hintBox2").hidden = !R.hint; $("hintBox2").textContent = R.hint||"";
  $("aiNote").hidden = !R.ai; $("aiNoteText").textContent = t("aiNote");
  $("sideBLabel").textContent = R.ai ? t("sideBai") : t("sideB");
}
function paintSpeed(){ $("bSpeed").setAttribute("aria-pressed", S.slow?"true":"false"); $("bSpeed").querySelector(".sv").textContent = S.slow ? "0"+t("dec")+"75×" : "1×"; }
function openImitate(){
  R.imit=null; R.revB=null; $("bFlipB").hidden=true; $("tB").textContent=t("recStartB"); paintSpeed();
  show("imitate"); paintJokers(); drawWave($("cRA"),R.revA); $("dRA").textContent=fmt(R.revA.duration);
}
$("bSpeed").onclick = ()=>{ S.slow=!S.slow; save(); paintSpeed(); if(playing && playing.canvas===$("cRA")) play(R.revA,$("cRA"),"rev",S.slow?0.75:1); };
$("bPlayRA").onclick = ()=> play(R.revA, $("cRA"), "rev", S.slow?0.75:1);
$("recB").onclick = ()=> recToggle($("recB"), $("tB"), buf=>{
  R.imit = trimSilence(buf); R.revB = reverseBuffer(R.imit);
  $("tB").textContent=t("savedB",{d:fmt(R.imit.duration)}); $("bFlipB").hidden=false;
});
$("bFlipB").onclick = ()=>{
  $("guess").value=""; show("guess"); paintJokers(); drawWave($("cRB"),R.revB); $("dRB").textContent=fmt(R.revB.duration);
  play(R.revB,$("cRB"));
};
$("bPlayRB").onclick = ()=> play(R.revB, $("cRB"));
$("bReRec").onclick = ()=> openImitate();

/* Joker */
document.querySelectorAll("#jokers .joker").forEach(b=> b.onclick = ()=> useJoker(b.dataset.j, b));
async function useJoker(kind, btn){
  if(jokerUsed(kind) || btn.classList.contains("busy")) return;
  stopPlayback(); stopRecording(true);
  const online = CTX.kind==="online", g = CTX.game;
  if(kind==="letters"){
    if(online){ busy(btn,true); try{ const r = await SB.rpc("use_joker",{p_game:g.id,p_kind:"letters"}); g.my_jokers=[...(g.my_jokers||[]),"letters"]; R.hint=r.pattern; }catch(e){ toast(errText(e)); } busy(btn,false); }
    else { S.lj[1-S.speaker].push("letters"); save(); R.hint = pattern(R.word); }
    paintJokers(); vib(20); return;
  }
  if(kind==="ai"){
    busy(btn,true); toast(t("aiLoading"), 20000);
    try{
      await TTS.voice(online ? g.lang : S.lang);
      let word = R.word;
      if(online){ const r = await SB.rpc("use_joker",{p_game:g.id,p_kind:"ai"}); word=r.word; g.my_jokers=[...(g.my_jokers||[]),"ai"]; }
      else { S.lj[1-S.speaker].push("ai"); save(); }
      const buf = await TTS.speak(word, online ? g.lang : S.lang);
      R.aiBuf = buf; R.revA = reverseBuffer(buf); R.ai = true;
      $("toast").hidden = true;
      drawWave($("cRA"),R.revA); $("dRA").textContent=fmt(R.revA.duration);
      busy(btn,false); paintJokers(); play(R.revA,$("cRA"),"rev",S.slow?0.75:1);
    }catch(e){
      busy(btn,false); toast(e instanceof AppErr ? errText(e) : t("aiFail"), 4500); paintJokers();
    }
    return;
  }
  if(kind==="again"){
    if(online){
      busy(btn,true);
      try{ await SB.rpc("use_joker",{p_game:g.id,p_kind:"again"}); CTX.game = await SB.rpc("get_game",{p_game:g.id}); SB.notify(g.id); showSent(t("sentAgain",{n:g.opponent_name})); }
      catch(e){ busy(btn,false); toast(errText(e)); }
      return;
    }
    S.lj[1-S.speaker].push("again"); save();
    const sp=S.names[S.speaker];
    showHand({eyebrow:t("giveBack"), name:sp, rest:t("speaks"), lead:t("giveBackLead",{n:S.names[1-S.speaker]}), btn:t("showWord"), go:()=>openSpeak("local-re")});
  }
}

/* ======================================================================= Raten: Ergebnis */
$("guessForm").addEventListener("submit", e=>{ e.preventDefault(); $("guess").blur(); finishGuess($("guess").value); });
$("bGiveUp").onclick = ()=> finishGuess("");

function norm(s){ return s.toLowerCase().replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^a-z]/g,""); }
function lev(a,b){ const m=a.length,n=b.length; let p=Array.from({length:n+1},(_,j)=>j);
  for(let i=1;i<=m;i++){ const c=[i]; for(let j=1;j<=n;j++) c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1)); p=c; } return p[n]; }
function isCorrect(guess, word){ const g=norm(guess), w=norm(word); if(!g) return false; return g===w || lev(g,w) <= Math.floor(w.length/8); }

async function finishGuess(guess){
  R.guess = guess.trim();
  if(CTX.kind==="online"){
    const btn=$("bCheck"); busy(btn,true);
    try{
      const r = await SB.rpc("submit_guess",{p_game:CTX.game.id, p_guess:R.guess});
      CTX.game = r.game; R.word = r.word; R.ok = r.correct;
      if(CTX.game.status==="finished" || CTX.game.next_action!=="speak") SB.notify(CTX.game.id);
      busy(btn,false); showResult();
    }catch(e){ busy(btn,false); toast(errText(e)); }
    return;
  }
  const guesser = 1-S.speaker;
  R.ok = isCorrect(guess, R.word); R.guesser = guesser; R.overridden=false;
  if(R.ok) S.scores[guesser]++;
  save(); showResult();
}
function showResult(){
  const online = CTX.kind==="online";
  const n = online ? t("you") : S.names[R.guesser];
  $("resBox").className = "result "+(R.ok?"ok":"bad");
  $("resVerdict").textContent = R.overridden ? t("counts",{n}) : R.ok ? (online ? t("correctYou") : t("correct",{n})) : (R.guess ? t("wrong") : t("gaveUp"));
  $("resGuess").textContent = R.guess ? t("typed",{g:R.guess}) : t("wordWas");
  $("resWord").textContent = R.word;
  $("bOverride").hidden = online || R.ok;
  if(online){
    const g=CTX.game;
    renderScore($("resScore"), [t("you"), g.opponent_name], [g.my_score, g.opp_score], -1);
    if(g.status==="finished"){
      const a=g.my_score, b=g.opp_score;
      $("bNext").textContent = t("toLobby");
      toast(a>b ? t("finalWin",{a,b}) : a<b ? t("finalLose",{a,b}) : t("finalDraw",{a,b}), 5000);
    } else $("bNext").textContent = g.next_action==="speak" ? t("nextSpeak") : t("toLobby");
  } else {
    renderScore($("resScore"), S.names, S.scores, -1);
    $("bNext").textContent = S.round>=LOCAL_WORDS ? t("toFinal") : t("next");
  }
  show("result");
  if(R.ok){ confetti(); vib([40,60,40]); }
}
$("bOverride").onclick = ()=>{
  if(R.ok) return; R.ok=true; R.overridden=true; S.scores[R.guesser]++; save(); showResult();
};
$("bPlayOrig").onclick = ()=> play(R.orig || R.aiBuf, null, "fwd");
$("bNext").onclick = ()=>{
  if(CTX.kind==="online"){
    const g=CTX.game;
    if(g.status!=="finished" && g.next_action==="speak"){ R={}; newWord(); openSpeak("online"); }
    else openGame(g.id);
    return;
  }
  S.round++; S.speaker = 1-S.speaker; save(); R={};
  if(S.round>LOCAL_WORDS) showFinal(); else startLocal();
};

/* ======================================================================= Online: Anmelden */
let authMode = "register";
function setAuthMode(m){
  authMode = m;
  $("bAuth").textContent = m==="register" ? t("createAcc") : t("doLogin");
  $("uHint").hidden = m!=="register"; $("pwHint").hidden = m!=="register";
  $("uPw").autocomplete = m==="register" ? "new-password" : "current-password";
  $("authErr").textContent = "";
}
document.querySelectorAll('input[name=authmode]').forEach(r=>r.onchange=()=>setAuthMode(r.value));
const NAME_RE = /^(?!.*\.\.)(?!\.)(?!.*\.$)[A-Za-z0-9_.-]{3,16}$/;
$("authForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const name=$("uName").value.trim(), pw=$("uPw").value;
  if(!NAME_RE.test(name)){ $("authErr").textContent=t("e_name"); return; }
  if(pw.length<6){ $("authErr").textContent=t("e_pw"); return; }
  const btn=$("bAuth"); busy(btn,true); $("authErr").textContent="";
  try{
    if(authMode==="register") await SB.signUp(name,pw); else await SB.signIn(name,pw);
    $("uPw").value=""; busy(btn,false);
    resavePush(); await openLobby(); routeHash();
  }catch(err){ busy(btn,false); $("authErr").textContent = errText(err); }
});

/* ======================================================================= Online: Lobby */
let lobbyTimer=0, gameTimer=0;
async function openLobby(){
  if(!SB.session){ show("auth"); return; }
  CTX={kind:"online"}; clearInterval(gameTimer);
  avatar($("meAvatar"), SB.name()); $("meName").textContent = SB.name();
  paintBanners();
  if(current!=="lobby"){ show("lobby"); if(!LOBBY) $("lobbyList").innerHTML = `<div class="empty"><span class="spin"></span></div>`; else renderLobby(); }
  await loadLobby();
  clearInterval(lobbyTimer);
  lobbyTimer = setInterval(()=>{ if(current==="lobby" && !document.hidden) loadLobby(); }, 20000);
}
async function loadLobby(){
  try{
    const [games, stats] = await Promise.all([SB.rpc("my_games"), SB.rpc("my_stats")]);
    LOBBY = games || [];
    $("meStats").textContent = t("statsLine",{w:stats.won, l:stats.lost, d:stats.draw});
    if(current==="lobby") renderLobby();
    if(current==="home") paintHome();
  }catch(e){
    if(e.code==="session"){ SB.clear(); show("auth"); return; }
    if(current==="lobby" && !LOBBY) $("lobbyList").innerHTML = `<div class="empty">${esc(errText(e))}</div>`;
  }
}
function statusLine(g){
  const n = g.opponent_name;
  if(g.status==="open") return t("st_search");
  if(g.status==="finished"){
    if(g.end_reason==="gave_up") return g.gave_up_by_me ? t("st_gaveupMe") : t("st_gaveupOpp",{n});
    if(g.end_reason==="timeout") return t("st_timeout");
    return g.draw ? t("st_draw") : g.won ? t("st_won") : t("st_lost");
  }
  if(g.my_turn) return g.next_action==="guess" ? t("st_guess",{n}) : g.next_action==="rerecord" ? t("st_rerecord") : t("st_speak");
  if(g.can_claim_timeout) return t("st_claim",{n});
  return g.opp_action==="rerecord" ? t("st_waitRe",{n}) : t("st_wait",{n});
}
function renderLobby(){
  const list=$("lobbyList"); list.innerHTML="";
  const groups = [["secTurn", LOBBY.filter(g=>g.status!=="finished" && g.my_turn)],
                  ["secWait", LOBBY.filter(g=>g.status!=="finished" && !g.my_turn)],
                  ["secDone", LOBBY.filter(g=>g.status==="finished")]];
  if(!LOBBY.length){ list.innerHTML = `<div class="empty">${esc(t("emptyLobby"))}</div>`; return; }
  for(const [title, arr] of groups){
    if(!arr.length) continue;
    const sec=document.createElement("div"); sec.className="sect";
    const h=document.createElement("h3"); h.textContent=t(title);
    if(title==="secTurn"){ const b=document.createElement("span"); b.className="badge"; b.textContent=arr.length; h.append(b); }
    sec.append(h);
    for(const g of arr){
      const c=document.createElement("button"); c.className="gcard"+(g.my_turn && g.status!=="finished" ? " turn":"");
      const av=document.createElement("span"); av.className="avatar"; avatar(av, g.opponent_name || "?");
      const mid=document.createElement("span"); mid.className="mid";
      const b=document.createElement("b"); b.textContent=(g.opponent_name || t("randomOpp")) + " "; const lt=document.createElement("span"); lt.className="ltag"; lt.textContent=g.lang.toUpperCase()+" · "+g.mode; b.append(lt);
      const st=document.createElement("span"); st.className="st"; st.textContent=statusLine(g);
      mid.append(b,st);
      const sc=document.createElement("span"); sc.className="sc"+(g.status==="finished" && !g.draw ? (g.won?" won":" lost") : "");
      sc.textContent = `${g.my_score}:${g.opp_score}`;
      c.append(av, mid, sc);
      c.onclick = ()=> openGame(g.id);
      sec.append(c);
    }
    list.append(sec);
  }
}
$("bNew").onclick = ()=> openNew();

/* Banner: Benachrichtigungen + Installieren */
let installEvt=null;
window.addEventListener("beforeinstallprompt", e=>{ e.preventDefault(); installEvt=e; paintBanners(); });
function paintBanners(){
  const ps = pushState();
  const showPush = ONLINE && SB.session && (ps==="off" || ps==="ios");
  $("pushBanner").hidden = !showPush;
  $("pushText").textContent = ps==="ios" ? t("pushIOS") : t("pushAsk");
  $("bPush").hidden = ps==="ios";
  const showInstall = !STANDALONE && !IN_APP && (installEvt || IS_IOS) && ps!=="ios";
  $("installBanner").hidden = !showInstall;
  $("installText").textContent = installEvt ? t("installAsk") : t("installIOS");
  $("bInstall").hidden = !installEvt;
}
$("bInstall").onclick = async ()=>{ if(!installEvt) return; installEvt.prompt(); try{ await installEvt.userChoice; }catch(e){} installEvt=null; paintBanners(); };

/* ======================================================================= Online: neues Duell */
function openNew(){
  $("nl-"+S.lang).checked=true; $("nm-"+S.mode).checked=true; $("friendName").value=""; $("newErr").textContent="";
  renderSugg((LOBBY||[]).map(g=>g.opponent_name).filter(Boolean).filter((n,i,a)=>a.indexOf(n)===i).slice(0,6));
  show("new");
}
function renderSugg(names){
  const box=$("sugg"); box.innerHTML="";
  for(const n of names){ const b=document.createElement("button"); b.type="button"; const av=document.createElement("span"); av.className="avatar"; avatar(av,n); b.append(av, n); b.onclick=()=>{ $("friendName").value=n; }; box.append(b); }
}
let suggT=0;
$("friendName").addEventListener("input", ()=>{
  clearTimeout(suggT); const q=$("friendName").value.trim();
  if(!q){ openNewSugg(); return; }
  suggT=setTimeout(async()=>{ try{ renderSugg(await SB.rpc("search_users",{p_q:q})); }catch(e){} }, 250);
});
function openNewSugg(){ renderSugg((LOBBY||[]).map(g=>g.opponent_name).filter(Boolean).filter((n,i,a)=>a.indexOf(n)===i).slice(0,6)); }
const newChoice = ()=>({lang: document.querySelector('input[name=nlang]:checked').value, mode: document.querySelector('input[name=nmode]:checked').value});
$("friendForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const n=$("friendName").value.trim(); if(!n){ $("friendName").focus(); return; }
  const btn=$("bChallenge"); busy(btn,true); $("newErr").textContent="";
  try{
    const {lang,mode}=newChoice();
    const id = await SB.rpc("create_game",{p_opponent:n, p_lang:lang, p_mode:mode});
    busy(btn,false); await startOnlineTurn(id);
  }catch(err){ busy(btn,false); $("newErr").textContent=errText(err); }
});
$("bRandom").onclick = async ()=>{
  const btn=$("bRandom"); busy(btn,true); $("newErr").textContent="";
  try{
    const {lang,mode}=newChoice();
    const r = await SB.rpc("random_game",{p_lang:lang, p_mode:mode});
    busy(btn,false);
    const v = await SB.rpc("get_game",{p_game:r.id});
    if(v.my_turn) await startOnlineTurn(r.id, v); else openGame(r.id, v);
  }catch(err){ busy(btn,false); $("newErr").textContent=errText(err); }
};

/* ======================================================================= Online: Duell-Ansicht */
async function openGame(id, view){
  CTX={kind:"online", game:view||CTX.game}; clearInterval(gameTimer); clearInterval(lobbyTimer);
  if(!view){
    if(!CTX.game || CTX.game.id!==id){ $("gRounds").innerHTML=`<div class="empty"><span class="spin"></span></div>`; }
    try{ view = await SB.rpc("get_game",{p_game:id}); }
    catch(e){ toast(errText(e)); openLobby(); return; }
  }
  CTX.game=view; renderGame(); if(current!=="game") show("game");
  gameTimer = setInterval(async()=>{
    if(current!=="game" || document.hidden || !CTX.game || CTX.game.my_turn || CTX.game.status==="finished") return;
    try{ const v = await SB.rpc("get_game",{p_game:CTX.game.id}); const changed = JSON.stringify(v)!==JSON.stringify(CTX.game); CTX.game=v; if(changed){ renderGame(); if(v.my_turn) vib(40); } }catch(e){}
  }, 12000);
}
function renderGame(){
  const g=CTX.game, opp=g.opponent_name || t("randomOpp");
  $("gMeta").textContent = `${g.lang.toUpperCase()} · ${MODE_LABEL[g.mode]}`;
  avatar($("gMeAv"), g.my_name); $("gMeName").textContent = g.my_name;
  avatar($("gOppAv"), g.opponent_name || "?"); $("gOppName").textContent = opp;
  $("gScore").innerHTML = `${g.my_score}<i>:</i>${g.opp_score}`;
  const st=$("gStatus"); st.classList.toggle("done", g.status==="finished");
  if(g.status==="open") st.textContent = g.my_turn ? t("g_speak",{n:t("randomOpp")}) : t("g_search");
  else if(g.status==="finished"){
    if(g.end_reason==="gave_up") st.textContent = g.gave_up_by_me ? t("g_gaveupMe") : t("g_gaveupOpp",{n:opp});
    else if(g.end_reason==="timeout") st.textContent = g.won ? t("g_timeoutWon",{n:opp}) : t("g_timeoutLost",{n:opp});
    else st.textContent = g.draw ? t("g_draw") : g.won ? t("g_won") : t("g_lost",{n:opp});
  }
  else if(g.my_turn) st.textContent = t("g_"+g.next_action,{n:opp});
  else st.textContent = g.opp_action==="rerecord" ? t("g_waitRe",{n:opp}) : t("g_wait",{n:opp});
  $("lgMe").textContent = t("legendMe"); $("lgOpp").textContent = t("legendOpp",{n:opp});

  const box=$("gRounds"); box.innerHTML="";
  for(let r=1;r<=g.rounds;r++){
    const row=document.createElement("div"); row.className="rrow";
    const mine = g.history.find(h=>!h.by_me && h.round===r);   // ich rate
    const theirs = g.history.find(h=>h.by_me && h.round===r);  // Gegner rät mein Wort
    const n=document.createElement("span"); n.className="n"; n.textContent=r;
    row.append(cell(mine, false, g), n, cell(theirs, true, g));
    box.append(row);
  }
  $("bPlay").hidden = !g.my_turn || g.status==="finished";
  if(g.my_turn) $("bPlay").textContent = t("play_"+g.next_action);
  $("bClaim").hidden = !g.can_claim_timeout;
  $("bRematch").hidden = !(g.status==="finished" && g.opponent_name);
  $("bGiveUpDuel").hidden = g.status==="finished";
  $("bGiveUpDuel").textContent = g.status==="open" ? t("cancelSearch") : t("giveUpDuel");
  $("giveUpBox").hidden = true;
}
function cell(h, right, g){
  const c=document.createElement("button"); c.type="button"; c.className="cell"+(right?" right":"");
  const mk=document.createElement("span"); mk.className="mk"; const w=document.createElement("span"); w.className="w";
  if(!h){ c.disabled=true; w.textContent=""; mk.textContent=""; c.style.opacity=".55"; }
  else if(h.state==="done"){
    c.classList.add(h.correct?"ok":"bad"); mk.textContent = h.correct ? "✓" : "✗"; w.textContent = h.word || "";
    if(h.audio_path){ c.classList.add("playable"); c.onclick = async ()=>{ try{ play(await fetchAudio(h.audio_path), null, "fwd"); }catch(e){ toast(errText(e)); } }; }
    else c.disabled=true;
  } else {
    const now = !right && g.my_turn && g.next_action==="guess";
    c.classList.add(now ? "now" : "wait"); mk.textContent = now ? "?" : "…";
    w.textContent = right ? (h.word || "") : "";
    if(right && h.audio_path){ c.classList.add("playable"); c.onclick = async ()=>{ try{ play(await fetchAudio(h.audio_path), null, "fwd"); }catch(e){ toast(errText(e)); } }; }
    else if(now){ c.onclick = ()=> $("bPlay").click(); }
    else c.disabled=true;
  }
  c.append(mk, w); return c;
}
$("bPlay").onclick = ()=> startOnlineTurn(CTX.game.id, CTX.game);
$("bClaim").onclick = async ()=>{ try{ CTX.game = await SB.rpc("claim_timeout",{p_game:CTX.game.id}); renderGame(); confetti(); }catch(e){ toast(errText(e)); } };
$("bRematch").onclick = async ()=>{
  const g=CTX.game, btn=$("bRematch"); busy(btn,true);
  try{ const id = await SB.rpc("create_game",{p_opponent:g.opponent_name, p_lang:g.lang, p_mode:g.mode}); busy(btn,false); await startOnlineTurn(id); }
  catch(e){ busy(btn,false); toast(errText(e)); }
};
$("bGiveUpDuel").onclick = ()=>{
  if(CTX.game.status==="open"){ doGiveUp(); return; }
  $("giveUpQ").textContent = t("giveUpQ",{n:CTX.game.opponent_name}); $("giveUpBox").hidden=false; $("bGiveUpDuel").hidden=true;
};
$("bGiveUpNo").onclick = ()=>{ $("giveUpBox").hidden=true; $("bGiveUpDuel").hidden=false; };
$("bGiveUpYes").onclick = ()=> doGiveUp();
async function doGiveUp(){
  try{
    const r = await SB.rpc("give_up",{p_game:CTX.game.id});
    if(r && r.deleted){ openLobby(); return; }
    SB.notify(CTX.game.id); CTX.game=r; renderGame();
  }catch(e){ toast(errText(e)); }
}

/* Einen Online-Zug beginnen */
async function startOnlineTurn(id, view){
  try{
    if(!view) view = await SB.rpc("get_game",{p_game:id});
    CTX={kind:"online", game:view}; R={};
    if(!view.my_turn){ openGame(id, view); return; }
    if(view.next_action==="speak"){ newWord(); openSpeak("online"); return; }
    if(view.next_action==="rerecord"){ R.word = view.pending.word; openSpeak("online-re"); return; }
    // raten
    const p=view.pending; toast(t("loading"), 15000);
    R.orig = await fetchAudio(p.audio_path); R.revA = reverseBuffer(R.orig);
    R.hint = p.pattern || null;
    if(p.ai_word){ try{ const buf = await TTS.speak(p.ai_word, view.lang); R.aiBuf=buf; R.revA=reverseBuffer(buf); R.ai=true; }catch(e){} }
    $("toast").hidden=true;
    openImitate();
  }catch(e){ $("toast").hidden=true; toast(errText(e)); openLobby(); }
}

/* ======================================================================= Push-Benachrichtigungen */
function b64uToBytes(s){ const p="=".repeat((4-s.length%4)%4); const b=atob((s+p).replace(/-/g,"+").replace(/_/g,"/")); return Uint8Array.from(b, c=>c.charCodeAt(0)); }
function pushState(){
  if(!ONLINE || !CFG.vapidPublicKey) return "unsupported";
  if(IS_IOS && !STANDALONE) return "ios";
  if(!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if(Notification.permission==="denied") return "denied";
  if(Notification.permission==="granted" && store.get("rr-push")) return "on";
  return "off";
}
function paintPushRow(){
  const ps=pushState();
  $("notifText").textContent = ps==="on" ? t("pushIsOn") : ps==="ios" ? t("pushIOS") : ps==="denied" ? t("pushDenied") : ps==="unsupported" ? t("pushUnsupported") : t("pushOff");
  $("bNotif").hidden = ps!=="off";
}
async function enablePush(btn){
  busy(btn,true);
  try{
    const perm = await Notification.requestPermission();
    if(perm!=="granted"){ busy(btn,false); toast(t("pushDenied")); paintBanners(); return; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if(!sub) sub = await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:b64uToBytes(CFG.vapidPublicKey)});
    const j = sub.toJSON();
    await SB.rpc("save_push",{p_endpoint:j.endpoint, p_p256dh:j.keys.p256dh, p_auth:j.keys.auth, p_lang:S.lang});
    store.set("rr-push", j.endpoint); busy(btn,false); toast(t("pushDone")); vib(30);
  }catch(e){ busy(btn,false); toast(t("pushFail")+" "+(e.message||"")); }
  paintBanners(); $("sentPush").hidden=true; if(current==="settings") paintPushRow();
}
async function resavePush(){
  try{
    if(pushState()!=="on" && !(("Notification" in window) && Notification.permission==="granted")) return;
    const reg = await navigator.serviceWorker.getRegistration(); if(!reg) return;
    const sub = await reg.pushManager.getSubscription(); if(!sub) return;
    const j=sub.toJSON(); await SB.rpc("save_push",{p_endpoint:j.endpoint, p_p256dh:j.keys.p256dh, p_auth:j.keys.auth, p_lang:S.lang});
    store.set("rr-push", j.endpoint);
  }catch(e){}
}
async function disablePush(){
  try{
    const reg = "serviceWorker" in navigator && await navigator.serviceWorker.getRegistration(); if(!reg) return;
    const sub = await reg.pushManager.getSubscription(); if(!sub) return;
    await SB.rpc("delete_push",{p_endpoint:sub.endpoint}); await sub.unsubscribe(); store.set("rr-push", null);
  }catch(e){}
}
$("bPush").onclick = ()=> enablePush($("bPush"));
$("bPush2").onclick = ()=> enablePush($("bPush2"));
$("bNotif").onclick = ()=> enablePush($("bNotif"));

/* ======================================================================= Konfetti */
function confetti(){
  if(matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv=$("confetti"), g=cv.getContext("2d"), dpr=window.devicePixelRatio||1;
  cv.width=innerWidth*dpr; cv.height=innerHeight*dpr; g.scale(dpr,dpr);
  const cols=["#FF4F7B","#FFB547","#34D399","#F5F2FF","#8B7BFF"];
  const P=Array.from({length:110},()=>({x:innerWidth/2,y:innerHeight*0.32,vx:(Math.random()-.5)*11,vy:-Math.random()*11-3,r:Math.random()*6+3,a:Math.random()*6,va:(Math.random()-.5)*.3,c:cols[Math.floor(Math.random()*cols.length)]}));
  const t0=performance.now();
  (function f(tt){ g.clearRect(0,0,innerWidth,innerHeight);
    P.forEach(p=>{ p.vy+=0.32; p.x+=p.vx; p.y+=p.vy; p.vx*=.99; p.a+=p.va; g.save(); g.translate(p.x,p.y); g.rotate(p.a); g.fillStyle=p.c; g.fillRect(-p.r/2,-p.r/4,p.r,p.r/2); g.restore(); });
    if(tt-t0<2600) requestAnimationFrame(f); else g.clearRect(0,0,innerWidth,innerHeight); })(t0);
}

/* ======================================================================= Start */
function routeHash(){
  const m = location.hash.match(/^#g=([0-9a-f-]{36})$/i);
  if(m && ONLINE && SB.session){ history.replaceState(null,"",location.pathname+location.search); openGame(m[1]); return true; }
  return false;
}
window.addEventListener("hashchange", routeHash);
document.addEventListener("visibilitychange", ()=>{
  if(document.hidden || !ONLINE || !SB.session) return;
  if(current==="lobby" || current==="home") loadLobby();
});
if(ONLINE && CFG.serviceWorker && "serviceWorker" in navigator && (location.protocol==="https:" || location.hostname==="localhost")){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
  navigator.serviceWorker.addEventListener("message", e=>{
    const d=e.data||{};
    if(d.type==="open" && d.game && SB.session) openGame(d.game);
    else if(d.type==="push" && SB.session){ if(current==="lobby"||current==="home") loadLobby(); else if(current==="game" && CTX.game && d.game===CTX.game.id) openGame(d.game); }
  });
}
window.addEventListener("resize", ()=>{ if(R.orig && !$("tapeA").hidden && current==="speak") drawWave($("cA"),R.orig); });
applyLang();
show("home");
if(ONLINE && SB.session){ if(!routeHash()) loadLobby(); resavePush(); }
