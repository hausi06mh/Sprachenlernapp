'use strict';
const D=window.LUMI_DATA; const LUMI_IMG='assets/lumi-lynx.png?v=13'; const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)]; const IS_IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const DEFAULT={xp:0,gems:100,streak:0,lastDate:'',minutes:0,answers:0,correct:0,completed:{},wordStats:{},reviewQueue:[],voiceName:'',dark:false};
let S;try{S={...DEFAULT,...JSON.parse(localStorage.getItem('lumiV7')||localStorage.getItem('lumiV3')||'{}')}}catch{S={...DEFAULT}}
let run=null, voices=[],roVoice=null, recognition=null;
const X=window.LUMI_EXTRA||{grammar:[],dialogues:[],stories:[]};
const G=window.LUMI_GLOSSARY||[];
const GLOSSARY_MAP=new Map(G.map(([ro,de])=>[norm(ro),de]));
const COURSE_SECTIONS=D.categories.map((c,idx)=>({
  ...c, from:idx*15+1, to:idx*15+15,
  code: idx<2?'A1.1':idx<4?'A1.2':idx<7?'A2':idx<10?'B1':idx===10?'B2':'B2+',
  color:['#31b875','#ed9b3a','#e76f51','#5b8def','#4776c9','#7161c5','#9761c7','#dd6375','#dc7b45','#3da9a0','#6c8d36','#b88722'][idx%12]
}));
function makeLessons(){return COURSE_SECTIONS.flatMap((cat,ci)=>Array.from({length:15},(_,j)=>{
  const n=ci*15+j+1;
  const base=D.words.filter(w=>w.cat===cat.id);
  const count=n<=30?4:n<=90?5:6;
  const start=(j*3)%Math.max(1,base.length);
  const wordIds=Array.from({length:count},(_,k)=>(base[(start+k)%base.length]||D.words[(n+k)%D.words.length]).id);
  const phase=j===14?'Kapiteltest':j%5===0?'Neue Wörter':j%5===1?'Hören & verstehen':j%5===2?'Sätze bilden':j%5===3?'Sprechen': 'Alltag anwenden';
  return {id:`L${String(n).padStart(3,'0')}`,index:n-1,number:n,level:cat.code,section:cat.id,title:`${cat.title} ${j+1}`,subtitle:`${phase} · ${cat.code}`,icon:j===14?'🏆':cat.icon,wordIds,checkpoint:j===14};
}))}
const LESSONS=makeLessons();
function save(){try{localStorage.setItem('lumiV7',JSON.stringify(S))}catch{}renderStats()}
function norm(t){return String(t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9ăâîșşțţ\s]/gi,' ').replace(/\s+/g,' ').trim()}
function similarity(a,b){a=norm(a);b=norm(b);if(a===b)return 1;const aw=a.split(' '),bw=b.split(' ');const hit=aw.filter(x=>bw.includes(x)).length;return hit/Math.max(aw.length,bw.length,1)}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function today(){return new Date().toISOString().slice(0,10)}
function touchStreak(){const t=today();if(S.lastDate===t)return;const y=new Date(Date.now()-864e5).toISOString().slice(0,10);S.streak=S.lastDate===y?S.streak+1:1;S.lastDate=t}
function renderStats(){$('#xp').textContent=S.xp;$('#gems').textContent=S.gems;$('#streak').textContent=S.streak;const p=Math.min(100,Math.round(S.minutes/15*100));$('#goalText').textContent=`${S.minutes} / 15 Minuten`;$('#goalBar').style.width=p+'%';$('#courseProgress').textContent=`${Object.keys(S.completed).filter(k=>k.startsWith('L')).length} von ${LESSONS.length}`; const next=LESSONS.find(l=>!S.completed[l.id])||LESSONS.at(-1); if($('#continueText'))$('#continueText').textContent=`${next.level} · ${next.title}`}
function lessonUnlocked(i){return i===0||!!S.completed[LESSONS[i-1].id]}
function show(id){$$('.screen').forEach(s=>s.classList.add('hidden'));$(id).classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'})}
function renderCourse(){const root=$('#course');root.innerHTML='';COURSE_SECTIONS.forEach(level=>{const sec=document.createElement('section');sec.className='section';const doneCount=LESSONS.filter(l=>l.section===level.id&&S.completed[l.id]).length;sec.innerHTML=`<div class="sectionHead" style="background:${level.color}"><div class="icon">${level.icon}</div><div><span class="levelPill">${level.code} · ${doneCount}/15</span><h2>${esc(level.title)}</h2><p>${esc(level.desc||'Wortschatz, Hören, Sprechen und Alltag')}</p></div></div><div class="path"></div>`;const path=sec.querySelector('.path');LESSONS.filter(l=>l.section===level.id).forEach(l=>{const unlocked=lessonUnlocked(l.index),done=S.completed[l.id],current=unlocked&&!done&&LESSONS.findIndex(x=>!S.completed[x.id])===l.index;const row=document.createElement('div');row.className='nodeWrap';row.innerHTML=`<button class="node ${done?'done':unlocked?'unlocked':''} ${current?'current':''} ${l.checkpoint?'checkpoint':''}" data-id="${l.id}" aria-label="${esc(l.title)}">${done?'★':unlocked?l.icon:'🔒'}${done?'<span class="check">✓</span>':''}</button><div class="nodeLabel ${unlocked?'':'lockedLabel'}"><b><span class="lessonNo">${l.number}</span> ${esc(l.title)}</b><span>${unlocked?esc(l.subtitle):'Vorherigen Lernpunkt abschließen'}</span></div>`;path.append(row)});root.append(sec)});$$('.node').forEach(b=>b.onclick=()=>{const l=LESSONS.find(x=>x.id===b.dataset.id);if(!lessonUnlocked(l.index))return toast('Dieser Lernpunkt ist noch gesperrt.');startLesson(l)})}
function voiceScore(v){const n=(v.name||'').toLowerCase();let score=0;if(/^ro(?:[-_]|$)/i.test(v.lang||''))score+=100;if(v.localService)score+=20;if(/ioana|alina|carmen|romanian|română|romana/.test(n))score+=40;if(/compact|espeak|festival/.test(n))score-=80;return score}
function loadVoices(){voices=window.speechSynthesis?.getVoices?.()||[];const romanian=voices.filter(v=>/^ro(?:[-_]|$)/i.test(v.lang||''));roVoice=romanian.find(v=>v.name===S.voiceName)||romanian.sort((a,b)=>voiceScore(b)-voiceScore(a))[0]||null;renderVoiceBanner()}
function renderVoiceBanner(){const el=$('#voiceBanner');if(!el)return;if(!('speechSynthesis'in window)){el.className='voiceBanner bad';el.innerHTML='<b>🔇 Keine Sprachausgabe verfügbar</b><span>Dieser Browser unterstützt die Sprachfunktion nicht.</span>';return}if(roVoice){el.className='voiceBanner good';el.innerHTML=`<b>🔊 Rumänische Stimme aktiv</b><span>${esc(roVoice.name)} · ${esc(roVoice.lang)}</span>`}else{el.className='voiceBanner warn';el.innerHTML='<b>⚠️ Keine rumänische Stimme geladen</b><span>Die App spricht absichtlich nicht mit einer deutschen Ersatzstimme. Lade in den iPhone-Einstellungen eine rumänische Stimme.</span>'}}
async function ensureRomanianVoice(){loadVoices();if(roVoice)return roVoice;for(const delay of [120,250,500]){await new Promise(r=>setTimeout(r,delay));loadVoices();if(roVoice)return roVoice}return null}
async function speak(text,slow=false){if(!('speechSynthesis'in window))return toast('Sprachausgabe ist auf diesem Gerät nicht verfügbar.');const value=String(text||'').trim().replace(/\s+/g,' ');if(!value)return;const voice=await ensureRomanianVoice();if(!voice){renderVoiceBanner();return toast('Keine richtige rumänische Stimme gefunden. Bitte in den iPhone-Einstellungen eine rumänische Stimme laden.')}speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(value.toLocaleLowerCase('ro-RO'));u.lang='ro-RO';u.voice=voice;u.rate=slow?.64:.86;u.pitch=1;u.volume=1;u.onerror=()=>toast('Die rumänische Aussprache konnte gerade nicht gestartet werden. Tippe bitte noch einmal.');setTimeout(()=>speechSynthesis.speak(u),80)}
function voiceSettings(){const options=voices.filter(v=>/^ro/i.test(v.lang)).map(v=>`<option value="${esc(v.name)}" ${v.name===roVoice?.name?'selected':''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('');openModal(`<h1>Rumänische Aussprache</h1><p>Die App nutzt die rumänische Stimme deines Geräts. Eine echte Muttersprachler-Aufnahme ist dadurch nicht garantiert, aber eine falsche deutsche Stimme wird nicht verwendet.</p>${options?`<label class="fieldLabel">Rumänische Stimme<select id="voiceSelect">${options}</select></label><div class="voiceTest"><button class="primary" id="testVoice">▶ Beispielsatz anhören</button><button class="secondary" id="slowVoice">🐢 Langsam anhören</button></div>`:'<div class="notice bad"><b>Keine rumänische Stimme vorhanden.</b><p>Auf iPhone: Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Rumänisch. Danach die App vollständig schließen und neu öffnen.</p></div>'}<hr><h2>Mikrofonprüfung</h2><p>Die Browser-Spracherkennung prüft, ob dein Satz als richtiges Rumänisch erkannt wird. Sie ersetzt keine exakte phonetische Bewertung durch einen Sprachlehrer.</p>`);if($('#voiceSelect'))$('#voiceSelect').onchange=e=>{S.voiceName=e.target.value;save();loadVoices()};if($('#testVoice'))$('#testVoice').onclick=()=>speak('Bună seara! Mă bucur să te cunosc.');if($('#slowVoice'))$('#slowVoice').onclick=()=>speak('Bună seara! Mă bucur să te cunosc.',true)}
function wordsFor(l){
  const base=l.wordIds.map(id=>D.words.find(w=>w.id===id)).filter(Boolean);
  const weak=(S.reviewQueue||[]).map(id=>D.words.find(w=>w.id===id)).filter(w=>w&&w.cat===l.section);
  return [...weak.slice(0,2),...base.filter(w=>!weak.some(x=>x.id===w.id))];
}
function shuffle(a){return [...a].sort(()=>Math.random()-.5)}
function difficulty(l){return l.number<=30?1:l.number<=60?2:l.number<=90?3:l.number<=120?4:l.number<=140?5:6}
const SECTION_TEXTS={
 basics:{level:'A1',ro:'Bună! Eu sunt Ana. Locuiesc în România. Dimineața spun „bună dimineața”, iar seara spun „bună seara”. Când primesc ajutor, spun „mulțumesc”.',de:'Hallo! Ich bin Ana. Ich wohne in Rumänien. Morgens sage ich „Guten Morgen“, abends sage ich „Guten Abend“. Wenn ich Hilfe bekomme, sage ich „Danke“.',q:'Was sagt Ana, wenn sie Hilfe bekommt?',answers:['mulțumesc','la revedere','nu'],correct:0},
 family:{level:'A1',ro:'Familia mea este mică. Am o mamă, un tată și o soră. Sora mea se numește Elena. Duminică mâncăm împreună.',de:'Meine Familie ist klein. Ich habe eine Mutter, einen Vater und eine Schwester. Meine Schwester heißt Elena. Am Sonntag essen wir zusammen.',q:'Wie heißt die Schwester?',answers:['Elena','Maria','Ana'],correct:0},
 food:{level:'A1',ro:'Dimineața beau cafea și mănânc pâine. La prânz comand o supă. Seara gătesc paste cu legume.',de:'Morgens trinke ich Kaffee und esse Brot. Mittags bestelle ich eine Suppe. Abends koche ich Nudeln mit Gemüse.',q:'Was bestellt die Person mittags?',answers:['o supă','o cafea','un bilet'],correct:0},
 home:{level:'A1',ro:'Locuiesc într-un apartament mic. Bucătăria este lângă sufragerie. În dormitor am un pat și un dulap.',de:'Ich wohne in einer kleinen Wohnung. Die Küche ist neben dem Wohnzimmer. Im Schlafzimmer habe ich ein Bett und einen Schrank.',q:'Was steht im Schlafzimmer?',answers:['un pat','un autobuz','o masă la restaurant'],correct:0},
 transport:{level:'A2',ro:'Merg la gară cu autobuzul. Cumpăr un bilet și întreb de la ce peron pleacă trenul. Trenul are zece minute întârziere.',de:'Ich fahre mit dem Bus zum Bahnhof. Ich kaufe eine Fahrkarte und frage, von welchem Bahnsteig der Zug abfährt. Der Zug hat zehn Minuten Verspätung.',q:'Wie viel Verspätung hat der Zug?',answers:['zece minute','o oră','două zile'],correct:0},
 city:{level:'A2',ro:'În centru caut o farmacie și un bancomat. Întreb un trecător, iar el îmi arată drumul. Farmacia este vizavi de bancă.',de:'Im Zentrum suche ich eine Apotheke und einen Geldautomaten. Ich frage einen Passanten und er zeigt mir den Weg. Die Apotheke liegt gegenüber der Bank.',q:'Wo ist die Apotheke?',answers:['vizavi de bancă','lângă gară','în hotel'],correct:0},
 work:{level:'B1',ro:'Lucrez într-un birou și încep la ora opt. Dimineața răspund la e-mailuri, iar după-amiaza particip la o ședință. Uneori lucrez de acasă.',de:'Ich arbeite in einem Büro und beginne um acht Uhr. Morgens beantworte ich E-Mails, nachmittags nehme ich an einer Besprechung teil. Manchmal arbeite ich von zu Hause.',q:'Was macht die Person nachmittags?',answers:['participă la o ședință','merge la medic','cumpără un bilet'],correct:0},
 health:{level:'A2',ro:'Nu mă simt bine. Mă doare gâtul și am febră. Sun la medic și primesc o programare pentru după-amiază.',de:'Ich fühle mich nicht gut. Mein Hals tut weh und ich habe Fieber. Ich rufe beim Arzt an und bekomme einen Termin für den Nachmittag.',q:'Welche Beschwerden hat die Person?',answers:['durere în gât și febră','foame și sete','o întârziere'],correct:0},
 travel:{level:'A2',ro:'La hotel am o rezervare pentru două nopți. Camera este liniștită, dar prosopul lipsește. Sun la recepție și cer un prosop nou.',de:'Im Hotel habe ich eine Reservierung für zwei Nächte. Das Zimmer ist ruhig, aber das Handtuch fehlt. Ich rufe die Rezeption an und bitte um ein neues Handtuch.',q:'Was fehlt im Zimmer?',answers:['prosopul','patul','ușa'],correct:0},
 feelings:{level:'B1',ro:'Astăzi sunt fericit, pentru că mă întâlnesc cu prietena mea. Vorbim despre ziua noastră și facem planuri pentru weekend.',de:'Heute bin ich glücklich, weil ich meine Freundin treffe. Wir sprechen über unseren Tag und machen Pläne für das Wochenende.',q:'Warum ist die Person glücklich?',answers:['Se întâlnește cu prietena lui.','Trebuie să lucreze.','A pierdut trenul.'],correct:0},
 leisure:{level:'B1',ro:'Sâmbătă merg cu prietenii la un meci de fotbal. Echipa noastră câștigă cu doi la unu. După meci mâncăm împreună.',de:'Am Samstag gehe ich mit Freunden zu einem Fußballspiel. Unsere Mannschaft gewinnt zwei zu eins. Nach dem Spiel essen wir gemeinsam.',q:'Wie endet das Spiel?',answers:['doi la unu','zero la zero','trei la patru'],correct:0},
 conversation:{level:'B2',ro:'Într-o conversație nu înțeleg un cuvânt. Îl rog pe interlocutor să vorbească mai încet și să repete propoziția. Apoi pot continua discuția.',de:'In einem Gespräch verstehe ich ein Wort nicht. Ich bitte meinen Gesprächspartner, langsamer zu sprechen und den Satz zu wiederholen. Danach kann ich das Gespräch fortsetzen.',q:'Was bittet die Person den Gesprächspartner zu tun?',answers:['să vorbească mai încet și să repete','să plece imediat','să scrie un bilet'],correct:0}
};
const STORY_ANSWER_DE={
 basics:['Danke','Auf Wiedersehen','Nein'],family:['Elena','Maria','Ana'],food:['eine Suppe','einen Kaffee','eine Fahrkarte'],
 home:['ein Bett','einen Bus','einen Restauranttisch'],transport:['zehn Minuten','eine Stunde','zwei Tage'],
 city:['gegenüber der Bank','neben dem Bahnhof','im Hotel'],work:['Sie nimmt an einer Besprechung teil.','Sie geht zum Arzt.','Sie kauft eine Fahrkarte.'],
 health:['Halsschmerzen und Fieber','Hunger und Durst','eine Verspätung'],travel:['das Handtuch','das Bett','die Tür'],
 feelings:['Er trifft seine Freundin.','Er muss arbeiten.','Er hat den Zug verpasst.'],leisure:['zwei zu eins','null zu null','drei zu vier'],
 conversation:['langsamer zu sprechen und zu wiederholen','sofort zu gehen','eine Fahrkarte zu schreiben']
};
function exerciseSolution(e,w){
  if(['arrange','speak','translateSentence','dictation','sentenceChoice','listenSentence'].includes(e.type)) return {ro:w.roEx.replace(/[.!?]+$/,''),de:w.deEx.replace(/[.!?]+$/,'')};
  if(e.type==='story') return {ro:e.story.answers[e.story.correct],de:(STORY_ANSWER_DE[run?.lesson?.section]||[])[e.story.correct]||'Richtige Antwort'};
  return {ro:w.ro,de:w.de};
}
function makeExercises(l){
 const ws=wordsFor(l),d=difficulty(l),items=[];
 // Von Anfang an: Wort, Satz, Hören, Schreiben, Sprechen und Textverständnis.
 const a=ws[0],b=ws[1]||a,c=ws[2]||a,dw=ws[3]||a;
 items.push({type:'choice',w:a});
 items.push({type:'sentenceChoice',w:b});
 items.push({type:'listenSentence',w:c});
 items.push({type:'type',w:dw});
 items.push({type:'arrange',w:a});
 items.push({type:'speak',w:b});
 if(d>=2) items.push({type:'translateSentence',w:c});
 if(d>=3) items.push({type:'dictation',w:dw});
 if(l.number%3===0||l.checkpoint) items.push({type:'story',w:a,story:SECTION_TEXTS[l.section]});
 if(d>=4) items.push({type:'freeSpeak',w:a});
 return items.slice(0,l.checkpoint?10:8);
}
function startLesson(l){run={lesson:l,items:makeExercises(l),i:0,score:0,hearts:5,start:Date.now(),answered:false};show('#screenLesson');renderExercise()}
function distract(w,field){let pool=D.words.filter(x=>x.id!==w.id&&x.cat===w.cat).map(x=>x[field]);if(pool.length<3)pool=D.words.filter(x=>x.id!==w.id).map(x=>x[field]);return shuffle([...new Set(pool)]).slice(0,3)}
const BASIC_WORD_MEANINGS={
 'eu':'ich','tu':'du','el':'er','ea':'sie','noi':'wir','voi':'ihr / Sie','ei':'sie','ele':'sie',
 'sunt':'bin / sind','este':'ist','e':'ist','am':'habe','ai':'hast','are':'hat','avem':'haben','au':'haben',
 'mă':'mich / mir','te':'dich / dir','se':'sich','îmi':'mir','mea':'mein / meine','meu':'mein','mei':'meine',
 'și':'und','sau':'oder','dar':'aber','pentru':'für','cu':'mit','fără':'ohne','la':'zu / an / bei',
 'în':'in','din':'aus / von','de':'von / zu','pe':'auf / an','un':'ein','o':'eine',
 'nu':'nicht / nein','da':'ja','ce':'was','cine':'wer','unde':'wo','când':'wann','cum':'wie','cât':'wie viel',
 'mai':'noch / mehr','foarte':'sehr','bine':'gut','rău':'schlecht','azi':'heute','astăzi':'heute','mâine':'morgen',
 'rog':'bitte','mulțumesc':'danke','salut':'hallo','bună':'hallo / gut','seara':'Abend','dimineața':'Morgen',
 'faci':'du machst / du tust','face':'macht / tut','fac':'ich mache / sie machen','numesc':'nenne','merge':'geht / fährt',
 'mergi':'du gehst / fährst','ți':'dir','îți':'dir','vă':'Ihnen / euch','ne':'uns','acum':'jetzt','aici':'hier','acolo':'dort',
 'mă numesc':'ich heiße','îmi pare bine':'freut mich','ce mai faci':'wie geht es dir?','la revedere':'auf Wiedersehen',
 'cu plăcere':'gern geschehen','bună seara':'guten Abend','bună dimineața':'guten Morgen','te rog':'bitte'
};
function tokenMeaning(tok){
  const clean=norm(tok);
  const exact=D.words.find(w=>norm(w.ro)===clean); if(exact)return exact.de;
  if(BASIC_WORD_MEANINGS[clean])return BASIC_WORD_MEANINGS[clean];
  const gloss=GLOSSARY_MAP.get(clean); if(gloss)return gloss;
  return '';
}
// Contextual chunks are intentional: idioms are not translated word-for-word.
const SENTENCE_CHUNKS={
 'salut ce mai faci':[['Salut','Hallo'],['Ce mai faci','Wie geht es dir?']],
 'buna ce mai faci':[['Bună','Hallo'],['Ce mai faci','Wie geht es dir?']],
 'buna ma numesc sebastian':[['Bună','Hallo'],['mă numesc','ich heiße'],['Sebastian','Sebastian']],
 'buna dimineata tuturor':[['Bună dimineața','Guten Morgen'],['tuturor','zusammen / an alle']],
 'buna seara':[['Bună seara','Guten Abend']],
 'buna seara bine ati venit':[['Bună seara','Guten Abend'],['bine ați venit','herzlich willkommen']],
 'multumesc':[['Mulțumesc','Danke']],
 'cu placere':[['Cu plăcere','Gern geschehen']],
 'te rog':[['Te rog','Bitte']],
 'la revedere':[['La revedere','Auf Wiedersehen']],
 'imi pare bine':[['Îmi pare bine','Freut mich']],
 'cum te numesti':[['Cum te numești','Wie heißt du?']],
 'ma numesc sebastian':[['Mă numesc','Ich heiße'],['Sebastian','Sebastian']]
};
function tapChunk(ro,de){return `<button class="tapWord" data-ro="${esc(ro)}" data-de="${esc(de)}" aria-expanded="false"><span class="tapWordRo">${esc(ro)}</span><span class="tapWordDe">${esc(de)}</span></button>`}
function clickableRomanian(text,translation){
  const raw=String(text).trim(); const key=norm(raw); const curated=SENTENCE_CHUNKS[key];
  if(curated){
    const punctuation=/[!?…]$/.test(raw)?raw.match(/[!?…]+$/)[0]:'';
    return `<span class="clickSentence contextual">${curated.map(x=>tapChunk(x[0],x[1])).join(' ')}${punctuation}</span>`;
  }
  const words=raw.replace(/[.!?…]+$/,'').trim().split(/\s+/).filter(Boolean);
  if(words.length===1)return `<span class="clickSentence">${tapChunk(words[0],tokenMeaning(words[0])||translation)}</span>`;
  // Unknown/non-curated sentences stay one meaningful chunk instead of showing misleading literal fragments.
  return `<span class="clickSentence contextual">${tapChunk(raw,translation)}</span>`;
}
function hintPairs(de,ro){
  const special={
    'guten abend':['bună','seara'], 'guten morgen':['bună','dimineața'],
    'auf wiedersehen':['la','revedere'], 'bis bald':['pe','curând'],
    'gern geschehen':['cu','plăcere'], 'entschuldigen sie':['scuzați-mă','scuzați-mă']
  };
  const deWords=String(de).trim().split(/\s+/), key=norm(de), roWords=special[key]||String(ro).trim().split(/\s+/);
  return deWords.map((word,i)=>({de:word,ro:roWords[i]||String(ro)}));
}
function germanHintPrompt(de,ro){return `<div class="germanHintPrompt">${hintPairs(de,ro).map((x,i)=>`<button class="germanHintWord" data-ro="${esc(x.ro)}" aria-expanded="false"><strong>${esc(x.de)}</strong><span class="hiddenHint">${esc(x.ro)}</span><small>Antippen für Hilfe</small></button>`).join('')}</div><p class="tapHelp">💡 Tippe nur dann auf ein deutsches Wort, wenn du Hilfe brauchst. Beim Antippen hörst du sofort die rumänische Lösung.</p>`}
function bindGermanHints(){ $$('.germanHintWord').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const open=b.classList.toggle('revealed');b.setAttribute('aria-expanded',String(open));if(open)speak(b.dataset.ro)}); }
function bindWordTips(){ $$('.tapWord').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const open=b.classList.toggle('revealed');b.setAttribute('aria-expanded',String(open));speak(b.dataset.ro)});}
document.addEventListener('click',e=>{if(!e.target.closest('.tapWord'))$$('.tapWord.revealed').forEach(b=>{b.classList.remove('revealed');b.setAttribute('aria-expanded','false')})});
function exerciseHeader(text){return `<div class="questionMascot"><img src="${LUMI_IMG}" alt="Lumi"><div class="bubble">${text}</div></div>`}
function renderExercise(){document.querySelector('.feedback')?.remove();if(run.i>=run.items.length||run.hearts<=0)return finishLesson();const e=run.items[run.i],w=e.w,p=Math.round(run.i/run.items.length*100);$('#lessonProgress').style.width=p+'%';$('#hearts').textContent='❤ '+run.hearts;run.answered=false;let h=`<div class="question">${exerciseHeader(promptFor(e.type))}`;
if(e.type==='choice'){const opts=shuffle([w.de,...distract(w,'de')]);h+=`<h1>Was bedeutet das Wort?</h1><div class="romanianPrompt">${clickableRomanian(w.ro,w.de)} <button class="miniAudio" id="play">🔊</button></div><p class="hint">Tippe das rumänische Wort an, um nur seine deutsche Bedeutung zu sehen.</p><div class="answers">${opts.map(o=>`<button class="answer" data-value="${esc(o)}">${esc(o)}</button>`).join('')}</div>`}
if(e.type==='sentenceChoice'){const opts=shuffle([w.deEx,...distract(w,'deEx')]);h+=`<h1>Was bedeutet der ganze Satz?</h1><div class="romanianPrompt">${clickableRomanian(w.roEx,w.deEx)} <button class="miniAudio" id="play">🔊</button></div><div class="answers">${opts.map(o=>`<button class="answer" data-value="${esc(o)}">${esc(o)}</button>`).join('')}</div>`}
if(e.type==='listenSentence'||e.type==='dictation'){h+=`<h1>${e.type==='listenSentence'?'Welchen Satz hörst du?':'Schreibe den gehörten Satz'}</h1><div class="audioPanel"><button class="audioBtn" id="play">🔊</button><button class="secondary" id="playSlow">🐢 Langsam</button></div>${e.type==='listenSentence'?`<div class="answers">${shuffle([w.deEx,...distract(w,'deEx')]).map(o=>`<button class="answer" data-value="${esc(o)}">${esc(o)}</button>`).join('')}</div>`:`<input class="typed" id="typed" autocomplete="off" placeholder="Rumänischen Satz schreiben …"><button class="primary wide" id="check">Prüfen</button>`}`}
if(e.type==='type'){h+=`<h1>Übersetze das Wort ins Rumänische</h1>${germanHintPrompt(w.de,w.ro)}<input class="typed" id="typed" autocomplete="off" placeholder="Auf Rumänisch schreiben …"><button class="primary wide" id="check">Prüfen</button>`}
if(e.type==='arrange'){const target=w.roEx.replace(/[.!?]/g,'');const pieces=shuffle(target.split(' '));h+=`<h1>Bilde den rumänischen Satz</h1><div class="germanPrompt">${esc(w.deEx)}</div><div class="arrangeTarget" id="target"></div><div class="chips">${pieces.map((x,i)=>`<button class="wordChip" data-word="${esc(x)}" data-n="${i}">${esc(x)}</button>`).join('')}</div><button class="primary wide" id="checkArrange">Prüfen</button>`}
if(e.type==='speak'||e.type==='freeSpeak'){h+=`<h1>${e.type==='speak'?'Sprich den Satz nach':'Sprich frei auf Rumänisch'}</h1><div class="romanianPrompt">${clickableRomanian(w.roEx,w.deEx)}</div><div class="translationLine"><b>Deutsch:</b> ${esc(w.deEx)}</div><div class="speakControls"><button class="secondary" id="modelAudio">🔊 Vorhören</button><button class="micBtn" id="recordVoice">🎙️ Aufnahme starten</button></div><div id="speechResult" class="speechResult"><b>So funktioniert es auf dem iPhone:</b><span>Tippe auf „Aufnahme starten“, sprich den Satz und tippe anschließend auf „Aufnahme beenden“. Danach kannst du dich direkt anhören und mit Lumi vergleichen.</span></div><audio id="voicePlayback" class="hidden voicePlayback" controls playsinline></audio><div class="recordActions hidden" id="recordActions"><button class="secondary" id="recordAgain">↻ Noch einmal aufnehmen</button><button class="primary" id="acceptRecording">Weiter</button></div>${!IS_IOS?`<button class="secondary wide" id="autoCheck">✨ Automatisch erkennen</button>`:''}`}
if(e.type==='translateSentence'){h+=`<h1>Übersetze den ganzen Satz</h1>${germanHintPrompt(w.deEx,w.roEx.replace(/[.!?]/g,''))}<textarea class="typed area" id="typed" placeholder="Rumänischer Satz …"></textarea><button class="primary wide" id="check">Prüfen</button>`}
if(e.type==='story'){const st=e.story;h+=`<h1>Mini-Text: ${esc(D.categories.find(c=>c.id===run.lesson.section)?.title||'Alltag')}</h1><div class="storyCard"><div class="romanianPrompt">${clickableRomanian(st.ro,st.de)} <button class="miniAudio" id="play">🔊</button></div><details><summary>Deutsche Übersetzung anzeigen</summary><p>${esc(st.de)}</p></details></div><h2>${esc(st.q)}</h2><div class="answers">${st.answers.map((o,i)=>`<button class="answer" data-value="${i}">${esc(o)}</button>`).join('')}</div>`}
h+='</div>';$('#exercise').innerHTML=h;bindWordTips();bindGermanHints();
const audioText=e.type==='choice'||e.type==='type'?w.ro:e.type==='story'?e.story.ro:w.roEx;
if($('#play')){$('#play').onclick=()=>speak(audioText)}if($('#playSlow'))$('#playSlow').onclick=()=>speak(audioText,true);if($('#modelAudio'))$('#modelAudio').onclick=()=>speak(w.roEx);
$$('.answer').forEach(b=>b.onclick=()=>{let correct,sol;if(e.type==='story'){correct=String(e.story.correct);sol=exerciseSolution(e,w)}else if(e.type==='choice'){correct=w.de;sol={ro:w.ro,de:w.de}}else if(e.type==='sentenceChoice'||e.type==='listenSentence'){correct=w.deEx;sol={ro:w.roEx,de:w.deEx}}else{correct=w.ro;sol=exerciseSolution(e,w)}checkAnswer(b,b.dataset.value,correct,w,1,sol)});
if($('#check')){$('#check').onclick=()=>{const sol=exerciseSolution(e,w);checkAnswer($('#typed'),$('#typed').value,sol.ro,w,answerThreshold(e,sol.ro),sol)};$('#typed').onkeydown=x=>{if(x.key==='Enter'&&!x.shiftKey){x.preventDefault();$('#check').click()}}}
$$('.wordChip').forEach(b=>b.onclick=()=>{if(b.classList.contains('used'))return;b.classList.add('used');const c=document.createElement('button');c.className='wordChip';c.textContent=b.dataset.word;c.onclick=()=>{b.classList.remove('used');c.remove()};$('#target').append(c)});if($('#checkArrange'))$('#checkArrange').onclick=()=>{const sol=exerciseSolution(e,w);checkAnswer($('#target'),[...$('#target').children].map(x=>x.textContent).join(' '),sol.ro,w,.9,sol)};if($('#recordVoice'))$('#recordVoice').onclick=()=>toggleVoiceRecording(w);if($('#recordAgain'))$('#recordAgain').onclick=()=>resetVoiceRecording();if($('#acceptRecording'))$('#acceptRecording').onclick=()=>checkAnswer($('#acceptRecording'),w.roEx,w.roEx,w,.72,{ro:w.roEx,de:w.deEx});if($('#autoCheck'))$('#autoCheck').onclick=()=>startRecognition(w);}
function promptFor(t){return {choice:'Bedeutung erkennen',listen:'Hör genau hin',type:'Schreibe auf Rumänisch',arrange:'Baue den Satz',speak:'Sprich Lumi nach',translateSentence:'Übersetze den Satz',dictation:'Hördiktat',freeSpeak:'Flüssigkeitstraining',sentenceChoice:'Satz verstehen',listenSentence:'Hörverständnis',story:'Lesen & verstehen'}[t]}
let mediaRecorder=null, recordedChunks=[], lastRecordingUrl='', recordingStream=null, recordingTimer=null, recordingStartedAt=0;
function supportedAudioMime(){
  const candidates=['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'];
  return candidates.find(t=>window.MediaRecorder&&MediaRecorder.isTypeSupported?.(t))||'';
}
function stopRecordingTracks(){
  if(recordingStream){recordingStream.getTracks().forEach(t=>t.stop());recordingStream=null}
  if(recordingTimer){clearInterval(recordingTimer);recordingTimer=null}
}
function resetVoiceRecording(){
  if(mediaRecorder?.state==='recording'){try{mediaRecorder.stop()}catch{}}
  stopRecordingTracks();
  if(lastRecordingUrl){URL.revokeObjectURL(lastRecordingUrl);lastRecordingUrl=''}
  const audio=$('#voicePlayback'), actions=$('#recordActions'), btn=$('#recordVoice'), result=$('#speechResult');
  if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio.classList.add('hidden')}
  actions?.classList.add('hidden');
  if(btn){btn.textContent='🎙️ Aufnahme starten';btn.classList.remove('recording');btn.disabled=false}
  if(result)result.innerHTML='<b>Bereit für einen neuen Versuch.</b><span>Tippe auf „Aufnahme starten“, sprich den Satz und beende die Aufnahme danach selbst.</span>';
}
async function toggleVoiceRecording(w){
  const btn=$('#recordVoice'), audio=$('#voicePlayback'), result=$('#speechResult'), actions=$('#recordActions');
  if(mediaRecorder?.state==='recording'){
    try{mediaRecorder.stop()}catch(e){result.innerHTML='<b>Aufnahme konnte nicht beendet werden.</b><span>Bitte erneut versuchen.</span>'}
    return;
  }
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){
    result.innerHTML='<b>Audioaufnahme wird von diesem Browser nicht unterstützt.</b><span>Öffne die Seite direkt in Safari und nicht innerhalb einer anderen App.</span>';
    return;
  }
  try{
    speechSynthesis?.cancel();
    if(lastRecordingUrl){URL.revokeObjectURL(lastRecordingUrl);lastRecordingUrl=''}
    audio.classList.add('hidden');actions.classList.add('hidden');recordedChunks=[];
    recordingStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    const mime=supportedAudioMime();
    mediaRecorder=mime?new MediaRecorder(recordingStream,{mimeType:mime}):new MediaRecorder(recordingStream);
    mediaRecorder.ondataavailable=e=>{if(e.data&&e.data.size>0)recordedChunks.push(e.data)};
    mediaRecorder.onerror=()=>{stopRecordingTracks();btn.classList.remove('recording');btn.textContent='🎙️ Aufnahme starten';result.innerHTML='<b>Die Aufnahme wurde unterbrochen.</b><span>Bitte noch einmal versuchen.</span>'};
    mediaRecorder.onstop=()=>{
      stopRecordingTracks();btn.classList.remove('recording');btn.textContent='🎙️ Aufnahme starten';btn.disabled=false;
      if(!recordedChunks.length){result.innerHTML='<b>Es wurde keine Aufnahme gespeichert.</b><span>Bitte noch einmal aufnehmen und etwa eine Sekunde sprechen.</span>';return}
      const blob=new Blob(recordedChunks,{type:mediaRecorder.mimeType||mime||'audio/mp4'});
      lastRecordingUrl=URL.createObjectURL(blob);audio.src=lastRecordingUrl;audio.classList.remove('hidden');actions.classList.remove('hidden');
      result.innerHTML='<b>Aufnahme fertig.</b><span>Höre zuerst deine Aufnahme an, dann tippe auf „Vorhören“ und vergleiche Aussprache, Rhythmus und Satzmelodie.</span>';
      audio.play().catch(()=>{});
    };
    mediaRecorder.start(250);recordingStartedAt=Date.now();btn.classList.add('recording');btn.textContent='⏹ Aufnahme beenden';
    result.innerHTML='<b>Aufnahme läuft …</b><span>Sprich jetzt den vollständigen rumänischen Satz. Tippe danach auf „Aufnahme beenden“.</span>';
    recordingTimer=setInterval(()=>{const sec=Math.floor((Date.now()-recordingStartedAt)/1000);btn.textContent=`⏹ Aufnahme beenden · ${sec}s`;if(sec>=30&&mediaRecorder?.state==='recording')mediaRecorder.stop()},1000);
  }catch(e){
    stopRecordingTracks();btn.classList.remove('recording');btn.textContent='🎙️ Aufnahme starten';
    const msg=e?.name==='NotAllowedError'?'Der Mikrofonzugriff ist nicht erlaubt. Tippe in Safari auf das Mikrofon-Symbol in der Adressleiste und erlaube den Zugriff.':'Das Mikrofon konnte nicht geöffnet werden. Schließe andere Apps, die gerade das Mikrofon verwenden, und versuche es erneut.';
    result.innerHTML=`<b>Mikrofon konnte nicht gestartet werden.</b><span>${esc(msg)}</span>`;
  }
}
let recognitionRunId=0, recognitionStarting=false;
function speechFallbackHtml(message){return `<b>${esc(message)}</b><span>Safari hat die automatische Erkennung beendet. Du kannst es erneut versuchen oder deine Stimme aufnehmen und selbst mit der Vorlage vergleichen.</span><div class="fallbackRecord"><button class="secondary" id="recordOwn">🎙️ Eigene Stimme aufnehmen</button><audio id="ownPlayback" class="hidden" controls></audio></div>`}
async function primeMicrophone(){
  if(!navigator.mediaDevices?.getUserMedia)return;
  const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  stream.getTracks().forEach(t=>t.stop());
}
async function startRecognition(w,retry=0){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  const result=$('#speechResult'), mic=$('#mic');
  if(!SR){result.innerHTML=speechFallbackHtml('Automatische Spracherkennung ist auf diesem Gerät nicht verfügbar.');$('#recordOwn')?.addEventListener('click',recordOwnVoice);return}
  if(recognitionStarting)return;
  recognitionStarting=true; const runId=++recognitionRunId;
  try{
    speechSynthesis?.cancel();
    if(recognition){try{recognition.onend=null;recognition.onerror=null;recognition.abort()}catch{} recognition=null}
    await primeMicrophone();
    await new Promise(r=>setTimeout(r,retry?850:500));
    if(runId!==recognitionRunId)return;
    const r=new SR(); recognition=r;
    r.lang='ro-RO'; r.interimResults=false; r.continuous=false; r.maxAlternatives=5;
    let gotResult=false, started=false;
    mic.classList.add('recording');mic.textContent='● Höre zu …';mic.disabled=true;
    result.innerHTML='<b>Ich höre zu …</b><span>Sprich den vollständigen Satz in normalem Tempo. Safari benötigt manchmal einen kurzen Moment.</span>';
    r.onstart=()=>{started=true;mic.disabled=false};
    r.onspeechstart=()=>{result.innerHTML='<b>Sprache erkannt …</b><span>Sprich den Satz fertig.</span>'};
    r.onresult=ev=>{
      if(runId!==recognitionRunId)return; gotResult=true;
      const alternatives=[...ev.results[0]].map(x=>({text:x.transcript,confidence:x.confidence||0}));
      const best=alternatives.sort((a,b)=>similarity(b.text,w.roEx)-similarity(a.text,w.roEx))[0];
      const sim=similarity(best.text,w.roEx), ok=sim>=.72;
      result.innerHTML=`<b>${ok?'Gut erkannt!':'Noch einmal üben'}</b><span>Erkannt: „${esc(best.text)}“</span><span>Zielsatz: ${clickableRomanian(w.roEx,w.deEx)}</span><span>Deutsch: ${esc(w.deEx)}</span><span>Verständlichkeit: ${Math.round(sim*100)} %</span>`;
      bindWordTips();mic.classList.remove('recording');mic.textContent='🎙️ Noch einmal';mic.disabled=false;
      const next=$('#acceptSpeech');next.classList.remove('hidden');next.textContent=ok?'Als richtig werten':'Weiter mit Fehler';next.onclick=()=>checkAnswer(next,best.text,w.roEx,w,.72,{ro:w.roEx,de:w.deEx});
    };
    r.onerror=ev=>{
      if(runId!==recognitionRunId||gotResult)return;
      const code=ev.error||'unknown';
      mic.classList.remove('recording');mic.textContent='🎙️ Noch einmal';mic.disabled=false;
      if(code==='aborted'&&retry<1){
        result.innerHTML='<b>Safari startet das Mikrofon neu …</b><span>Bitte einen Moment warten und danach direkt sprechen.</span>';
        recognitionStarting=false;setTimeout(()=>startRecognition(w,1),650);return;
      }
      const msg=code==='not-allowed'||code==='service-not-allowed'?'Mikrofonzugriff wurde nicht erlaubt.':code==='no-speech'?'Es wurde keine Sprache erkannt. Bitte näher am Mikrofon und etwas deutlicher sprechen.':code==='audio-capture'?'Das Mikrofon konnte nicht geöffnet werden.':'Die automatische Erkennung wurde von Safari beendet.';
      result.innerHTML=speechFallbackHtml(msg);$('#recordOwn')?.addEventListener('click',recordOwnVoice);
    };
    r.onend=()=>{
      if(runId!==recognitionRunId)return;
      mic.classList.remove('recording');mic.disabled=false;
      if(!gotResult&&mic.textContent.includes('Höre'))mic.textContent='🎙️ Noch einmal';
    };
    r.start();
    setTimeout(()=>{if(runId===recognitionRunId&&!started&&!gotResult){try{r.abort()}catch{}}},5000);
  }catch(err){
    mic.classList.remove('recording');mic.textContent='🎙️ Noch einmal';mic.disabled=false;
    result.innerHTML=speechFallbackHtml(err?.name==='NotAllowedError'?'Mikrofonzugriff wurde nicht erlaubt.':'Das Mikrofon konnte nicht gestartet werden.');$('#recordOwn')?.addEventListener('click',recordOwnVoice);
  }finally{recognitionStarting=false}
}
function charSimilarity(a,b){a=norm(a);b=norm(b);if(a===b)return 1;if(!a||!b)return 0;const m=a.length,n=b.length,dp=Array.from({length:m+1},()=>Array(n+1).fill(0));for(let i=0;i<=m;i++)dp[i][0]=i;for(let j=0;j<=n;j++)dp[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return 1-dp[m][n]/Math.max(m,n);}
function answerThreshold(e,correct){const words=norm(correct).split(' ').length;if(e.type==='type'&&words===1)return .84;if(['dictation','translateSentence'].includes(e.type))return .78;return .86;}
function grammarNote(ro,de){const r=norm(ro);if(r.includes('buna seara'))return '„bună“ steht hier feminin, weil „seară“ (Abend) im Rumänischen feminin ist.';if(r.includes('buna dimineata'))return '„bună“ passt sich an das feminine Wort „dimineață“ an.';if(r.includes('te rog'))return '„te rog“ ist die übliche höfliche Wendung für „bitte“, wörtlich etwa „ich bitte dich“.';if(/(un|o)/.test(r))return '„un“ ist meist der unbestimmte Artikel für männliche/neutrale Wörter, „o“ für weibliche Wörter.';return '';}
function checkAnswer(el,given,correct,w,threshold=1,solution=null){if(run.answered)return;run.answered=true;const score=Math.max(similarity(given,correct),charSimilarity(given,correct)),ok=score>=threshold;const sol=solution||{ro:correct,de:w.de};S.answers++;if(ok){S.correct++;S.xp+=10;run.score++;S.wordStats[w.id]=(S.wordStats[w.id]||0)+1;S.reviewQueue=(S.reviewQueue||[]).filter(id=>id!==w.id)}else{run.hearts--;S.wordStats[w.id]=Math.max(0,(S.wordStats[w.id]||0)-1);S.reviewQueue=[w.id,...(S.reviewQueue||[]).filter(id=>id!==w.id)].slice(0,40)}save();if(el.classList)el.classList.add(ok?'correct':'wrong');const box=document.createElement('div');box.className='feedback '+(ok?'':'wrong');box.innerHTML=`<div class="feedbackRow"><div><b>${ok?'Richtig! Foarte bine!':'Noch nicht ganz richtig.'}</b><small><strong>Rumänisch:</strong> ${clickableRomanian(sol.ro,sol.de)}</small><small><strong>Deutsch:</strong> ${esc(sol.de)}</small>${!ok?`<small><strong>Deine Antwort:</strong> ${esc(given||'–')}</small>`:''}${grammarNote(sol.ro,sol.de)?`<small class="grammarTip"><strong>Warum?</strong> ${esc(grammarNote(sol.ro,sol.de))}</small>`:''}<button class="feedbackAudio" id="feedbackAudio">🔊 Lösung anhören</button></div><button class="primary" id="next">Weiter</button></div>`;document.body.append(box);bindWordTips();$('#feedbackAudio').onclick=()=>speak(sol.ro);$('#next').onclick=()=>{box.remove();run.i++;renderExercise()}}
function continueCourse(){const next=LESSONS.find(l=>!S.completed[l.id])||LESSONS.at(-1);startLesson(next)}
function exportProgress(){const blob=new Blob([JSON.stringify(S,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='lumi-fortschritt.json';a.click();URL.revokeObjectURL(a.href)}
$('#continueCourse').onclick=continueCourse;if($('#dialoguesNav'))$('#dialoguesNav').onclick=showDialogues;$('#dialoguesBtn').onclick=showDialogues;$('#storiesBtn').onclick=showStories;$('#grammarBtn').onclick=showGrammar;$('#reviewBtn').onclick=()=>$('#practiceBtn').click();


function runSelfTest(){
  const results=[];const check=(name,ok)=>results.push({name,ok:!!ok});
  try{check('Daten geladen',D.words.length>=240);check('Lernpfad erzeugt',LESSONS.length===180);check('Grammatik vorhanden',X.grammar.length>=10);check('Dialoge vorhanden',X.dialogues.length>=10);check('Geschichten vorhanden',X.stories.length>=5);check('Glossar geladen',G.length>=5000);check('Erste Lektion frei',lessonUnlocked(0));startLesson(LESSONS[0]);check('Übung startet',!!run&&run.items.length>=8);show('#screenPath');renderCourse();check('Lernpunkte gerendert',$$('.node').length===180)}catch(e){results.push({name:'Laufzeit',ok:false,error:String(e)})}
  const box=document.createElement('pre');box.id='selftest';box.textContent=JSON.stringify(results);document.body.append(box);
}

renderStats();renderCourse();show('#screenPath');if('speechSynthesis'in window){loadVoices();speechSynthesis.onvoiceschanged=loadVoices}if(new URLSearchParams(location.search).has('selftest'))setTimeout(runSelfTest,150);if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js?v=12').catch(()=>{});
