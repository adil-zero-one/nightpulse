import React, { useState, useEffect, useRef } from "react";
import Auth from "./Auth";
import { apiRequest } from "./api";

// ═══════════════════════════════════════════════════════════
//  NIGHT-PULSE · LIVE DEMO
//  Authentication and profiles are backed by the API; social activity is simulated.
// ═══════════════════════════════════════════════════════════

const C = {
  bg:     "#070811",
  card:   "#10121e",
  el:     "#171a29",
  border: "#30354c",
  cyan:   "#00edff",
  purple: "#b44dff",
  pink:   "#ff2060",
  gold:   "#ffcc00",
  green:  "#00ff88",
  text:   "#f0f3ff",
  muted:  "#aab2c9",
  dim:    "#292d42",
};

// ── Mock users ───────────────────────────────────────────────
const INIT_USERS = [
  { id:1, name:"LUNA",   ig:"luna.vibes",  emoji:"🦋", dist:42,  pulsing:true,  ghost:false, liked:false, matched:false },
  { id:2, name:"AXEL",   ig:"axel_dark",   emoji:"🌙", dist:118, pulsing:false, ghost:false, liked:false, matched:false },
  { id:3, name:"ZARA",   ig:"zara.fx",     emoji:"⚡", dist:67,  pulsing:false, ghost:false, liked:false, matched:false },
  { id:4, name:"NIKO",   ig:"niko_d",      emoji:"🔮", dist:205, pulsing:true,  ghost:false, liked:true,  matched:true  },
  { id:5, name:"EVA",    ig:"eva.ctrl",    emoji:"🌊", dist:89,  pulsing:false, ghost:true,  liked:false, matched:false },
  { id:6, name:"MARCO",  ig:"marco_b",     emoji:"🎭", dist:310, pulsing:false, ghost:false, liked:false, matched:false },
  { id:7, name:"SOFIA",  ig:"sofiawave",   emoji:"🌸", dist:155, pulsing:false, ghost:false, liked:false, matched:false },
  { id:8, name:"DANTE",  ig:"dantevibe",   emoji:"🐍", dist:78,  pulsing:false, ghost:false, liked:false, matched:false },
];

const MOCK_MESSAGES = [
  { id:1, from:4, text:"Hey are you near the bar?",     time:"22:14", read:true  },
  { id:2, from:1, text:"Love the vibe tonight 🌙",      time:"22:31", read:false },
];

const VENUES = [
  { id:1, name:"Downtown Barcelona", crowd:97, vibe:"Techno" },
  { id:2, name:"FABRIC LONDON", crowd:312, vibe:"Techno" },
  { id:3, name:"DC-10 IBIZA", crowd:489, vibe:"House" },
  { id:4, name:"BERGHAIN BERLIN", crowd:201, vibe:"Dark" },
];

// ── Helpers ──────────────────────────────────────────────────
function randomBetween(a, b) { return Math.floor(Math.random() * (b - a) + a); }

function useInterval(cb, ms) {
  const ref = useRef(cb);
  useEffect(() => { ref.current = cb; }, [cb]);
  useEffect(() => {
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

// ── Particle canvas ──────────────────────────────────────────
function Particles() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d");
    let W, H, raf;
    const resize = () => {
      W = c.width  = c.offsetWidth;
      H = c.height = c.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const pts = Array.from({length:70}, () => ({
      x: Math.random()*1400, y: Math.random()*900,
      vx:(Math.random()-.5)*.22, vy:(Math.random()-.5)*.22,
      r: Math.random()*1.4+.3,  a: Math.random()*.6+.1,
      col: Math.random()>.5 ? C.cyan : C.purple,
    }));
    const draw = () => {
      ctx.clearRect(0,0,W,H);
      for(let i=0;i<pts.length;i++){
        for(let j=i+1;j<pts.length;j++){
          const dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y;
          const d=Math.sqrt(dx*dx+dy*dy);
          if(d<110){ ctx.beginPath(); ctx.strokeStyle=`rgba(0,237,255,${(1-d/110)*.1})`; ctx.lineWidth=.5; ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y); ctx.stroke(); }
        }
      }
      pts.forEach(p=>{
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle=p.col+Math.floor(p.a*180).toString(16).padStart(2,"0");
        ctx.fill();
        p.x+=p.vx; p.y+=p.vy;
        if(p.x<0)p.x=W; if(p.x>W)p.x=0;
        if(p.y<0)p.y=H; if(p.y>H)p.y=0;
      });
      raf=requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize",resize); };
  },[]);
  return <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:0,opacity:.35}} />;
}

// ── Radar map ────────────────────────────────────────────────
function Radar({ users, newUserId }) {
  const ref = useRef(null);
  const blipsRef = useRef([]);
  const sweepRef = useRef(0);

  useEffect(() => {
    const c = ref.current; if(!c) return;
    const ctx = c.getContext("2d");
    let W = c.width = c.offsetWidth;
    let H = c.height = c.offsetHeight;
    let raf;
    const cx = W/2, cy = H/2;

    blipsRef.current = users.filter(u=>!u.ghost).map((u,i) => {
      const angle = (i/Math.max(users.filter(u=>!u.ghost).length,1))*Math.PI*2 - Math.PI/2;
      const r = 38 + (i%4)*22;
      return { ...u, x:cx+Math.cos(angle)*r, y:cy+Math.sin(angle)*r, tx:cx+Math.cos(angle)*r, ty:cy+Math.sin(angle)*r, spawn: u.id === newUserId };
    });

    const draw = () => {
      ctx.clearRect(0,0,W,H);
      // Grid lines
      ctx.strokeStyle="rgba(0,237,255,0.04)"; ctx.lineWidth=.5;
      for(let x=0;x<W;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for(let y=0;y<H;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
      // Rings
      [38,68,100,132].forEach(r=>{
        ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
        ctx.strokeStyle="rgba(0,237,255,0.09)"; ctx.lineWidth=1; ctx.setLineDash([4,6]); ctx.stroke(); ctx.setLineDash([]);
      });
      // Sweep fill
      ctx.save(); ctx.beginPath(); ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,132,sweepRef.current,sweepRef.current+.5); ctx.closePath();
      ctx.fillStyle="rgba(0,237,255,0.04)"; ctx.fill(); ctx.restore();
      // Sweep line
      ctx.beginPath(); ctx.moveTo(cx,cy);
      ctx.lineTo(cx+Math.cos(sweepRef.current)*132, cy+Math.sin(sweepRef.current)*132);
      ctx.strokeStyle="rgba(0,237,255,0.55)"; ctx.lineWidth=1.5; ctx.stroke();
      sweepRef.current += .018;
      // Center
      ctx.beginPath(); ctx.arc(cx,cy,5,0,Math.PI*2);
      ctx.fillStyle=C.cyan; ctx.shadowColor=C.cyan; ctx.shadowBlur=14; ctx.fill(); ctx.shadowBlur=0;

      blipsRef.current.forEach(b=>{
        b.x+=(b.tx-b.x)*.06; b.y+=(b.ty-b.y)*.06;
        const col = b.pulsing ? C.cyan : b.matched ? C.green : C.purple;
        // Outer ring
        ctx.beginPath(); ctx.arc(b.x,b.y,b.pulsing?11:8,0,Math.PI*2);
        ctx.fillStyle=col+"28"; ctx.fill();
        // Core
        ctx.beginPath(); ctx.arc(b.x,b.y,b.pulsing?5:3.5,0,Math.PI*2);
        ctx.fillStyle=col; ctx.shadowColor=col; ctx.shadowBlur=b.pulsing?16:8; ctx.fill(); ctx.shadowBlur=0;
        // Name tag
        ctx.fillStyle=b.pulsing?C.cyan:"rgba(200,200,255,0.5)";
        ctx.font=`${b.pulsing?10:9}px 'Space Mono', monospace`;
        ctx.fillText(b.name, b.x+10, b.y+4);
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [users, newUserId]);

  return <canvas ref={ref} style={{width:"100%",height:"100%",display:"block"}} />;
}

// ── User card ─────────────────────────────────────────────────
function UserCard({ user, onLike, onMessage, onPulse, isNew }) {
  const [hov, setHov] = useState(false);
  const [pop, setPop] = useState(isNew);
  useEffect(()=>{ if(isNew){const t=setTimeout(()=>setPop(false),600);return()=>clearTimeout(t);} },[isNew]);
  const col = user.pulsing ? C.cyan : user.matched ? C.green : C.purple;
  return (
    <div
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{
        background: C.card,
        border:`1px solid ${col}${user.pulsing?"44":"22"}`,
        borderRadius:10, padding:14, position:"relative", overflow:"hidden",
        transform: pop ? "scale(1.06)" : hov ? "translateY(-3px)" : "none",
        transition:"all 0.3s cubic-bezier(.34,1.56,.64,1)",
        boxShadow: user.pulsing ? `0 0 24px ${C.cyan}33, inset 0 0 24px ${C.cyan}0a`
                 : hov ? `0 8px 24px ${C.purple}22` : "none",
        cursor:"pointer",
      }}
    >
      {/* Pulse bar */}
      {user.pulsing && <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${C.cyan},transparent)`,animation:"shimmer 2s ease-in-out infinite"}} />}
      {/* New badge */}
      {isNew && <div style={{position:"absolute",top:8,right:8,fontSize:9,color:C.green,border:`1px solid ${C.green}44`,borderRadius:3,padding:"2px 6px",letterSpacing:1}}>NEW</div>}

      <div style={{width:52,height:52,borderRadius:"50%",margin:"0 auto 10px",
        background:`linear-gradient(135deg,${C.purple}88,${C.cyan}88)`,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,
        border:`2px solid ${col}44`,
        boxShadow: user.pulsing?`0 0 14px ${C.cyan}88`:"none",
      }}>{user.emoji}</div>

      <div style={{textAlign:"center",fontSize:12,color:C.text,letterSpacing:1,marginBottom:2}}>{user.name}</div>
      <div style={{textAlign:"center",fontSize:10,color:C.muted,marginBottom:8}}>@{user.ig}</div>
      <div style={{textAlign:"center",fontSize:10,color:C.muted,marginBottom:10}}>
        <span style={{color:col}}>◉</span> {user.dist}m away
      </div>

      {/* Tags */}
      <div style={{display:"flex",gap:4,justifyContent:"center",flexWrap:"wrap",marginBottom:10}}>
        {user.pulsing  && <span style={{fontSize:9,color:C.cyan,  border:`1px solid ${C.cyan}44`,  borderRadius:3,padding:"2px 7px",letterSpacing:1}}>PULSING</span>}
        {user.matched  && <span style={{fontSize:9,color:C.green, border:`1px solid ${C.green}44`, borderRadius:3,padding:"2px 7px",letterSpacing:1}}>MATCHED</span>}
        {user.ghost    && <span style={{fontSize:9,color:C.purple,border:`1px solid ${C.purple}44`,borderRadius:3,padding:"2px 7px",letterSpacing:1}}>GHOST</span>}
      </div>

      {/* Action buttons */}
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>onLike(user.id)} style={{
          flex:1, minHeight:38, background:user.liked?`${C.pink}22`:"transparent",
          border:`1px solid ${user.liked?C.pink:C.muted}55`, borderRadius:5,
          color:user.liked?C.pink:C.muted, fontSize:14, cursor:"pointer",
          transition:"all 0.2s",
        }}>{user.liked?"❤️":"🤍"}</button>
        {user.matched && (
          <button onClick={()=>onMessage(user)} style={{
            flex:1, minHeight:38, background:`${C.green}15`,
            border:`1px solid ${C.green}44`, borderRadius:5,
            color:C.green, fontSize:14, cursor:"pointer",
          }}>💬</button>
        )}
      </div>
    </div>
  );
}

// ── Toast notification ────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div
      aria-live="polite"
      style={{
        position:"fixed",top:76,left:"50%",transform:"translateX(-50%)",
        width:"min(330px, calc(100vw - 24px))",maxHeight:"28dvh",
        overflow:"hidden",zIndex:200,display:"flex",flexDirection:"column",
        gap:7,pointerEvents:"none",
      }}
    >
      {toasts.slice(-3).map(t=>(
        <div key={t.id} style={{
          background:C.card, border:`1px solid ${t.color||C.cyan}44`,
          borderRadius:8, padding:"11px 14px",
          fontSize:12, color:C.text, letterSpacing:.3,
          boxShadow:`0 4px 20px ${t.color||C.cyan}22`,
          animation:"toastIn 0.35s cubic-bezier(.34,1.56,.64,1)",
          width:"100%",lineHeight:1.45,
        }}>
          <span style={{color:t.color||C.cyan,marginRight:6}}>{t.icon||"⚡"}</span>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── Payment modal ─────────────────────────────────────────────
function PayModal({ product, onClose, onSuccess }) {
  const [step,setStep]=useState(0); // 0=details, 1=fake card, 2=done
  const [cardNum,setCardNum]=useState("");
  const [loading,setLoading]=useState(false);
  const products = {
    pulse:         {name:"THE PULSE",       price:"€1.99", color:C.cyan,   icon:"⚡", desc:"Your profile glows & floats to the top for 30 minutes."},
    direct_signal: {name:"DIRECT SIGNAL",   price:"€2.49", color:C.purple, icon:"🎯", desc:"Bypass the mutual match — send one encrypted message now."},
    ghost_pack:    {name:"GHOST PACK",      price:"€9.99/mo",color:"#00ff88",icon:"👻",desc:"See everyone. Stay completely invisible on map & grid."},
  };
  const p = products[product];
  if(!p) return null;

  const pay = () => {
    if(cardNum.replace(/\s/g,"").length<16) return;
    setLoading(true);
    setTimeout(()=>{ setLoading(false); setStep(2); setTimeout(()=>{ onSuccess(product); onClose(); },1200); },1600);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(4,4,10,.92)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:16}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:`1px solid ${p.color}33`,borderRadius:14,padding:28,width:"100%",maxWidth:360,animation:"fadeUp .3s ease"}}>
        {step===0 && <>
          <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:16}}>
            <span style={{fontSize:32}}>{p.icon}</span>
            <div>
              <div style={{color:p.color,fontSize:14,letterSpacing:2}}>{p.name}</div>
              <div style={{color:p.color,fontSize:20,fontWeight:700}}>{p.price}</div>
            </div>
          </div>
          <div style={{color:C.muted,fontSize:11,lineHeight:1.7,marginBottom:20}}>{p.desc}</div>
          <button onClick={()=>setStep(1)} style={{width:"100%",minHeight:48,background:`${p.color}18`,border:`1px solid ${p.color}55`,borderRadius:8,color:p.color,fontSize:12,letterSpacing:2,cursor:"pointer",fontFamily:"'Space Mono',monospace"}}>
            PAY {p.price} →
          </button>
          <div style={{textAlign:"center",fontSize:9,color:C.muted,marginTop:10,letterSpacing:1}}>SIMULATED STRIPE · NO REAL CHARGE</div>
        </>}
        {step===1 && <>
          <div style={{color:p.color,fontSize:13,letterSpacing:2,marginBottom:16}}>CARD DETAILS</div>
          <input
            value={cardNum}
            onChange={e=>{const v=e.target.value.replace(/\D/g,"").slice(0,16);setCardNum(v.replace(/(.{4})/g,"$1 ").trim());}}
            placeholder="4242 4242 4242 4242"
            style={{width:"100%",boxSizing:"border-box",background:C.el,border:`1px solid ${p.color}44`,borderRadius:7,padding:"13px 14px",color:C.text,fontSize:14,fontFamily:"'Space Mono',monospace",outline:"none",marginBottom:10,letterSpacing:2}}
          />
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            <input placeholder="MM/YY" style={{flex:1,background:C.el,border:`1px solid ${p.color}44`,borderRadius:7,padding:"13px 14px",color:C.text,fontSize:13,fontFamily:"'Space Mono',monospace",outline:"none"}} />
            <input placeholder="CVC" style={{width:70,background:C.el,border:`1px solid ${p.color}44`,borderRadius:7,padding:"13px 14px",color:C.text,fontSize:13,fontFamily:"'Space Mono',monospace",outline:"none"}} />
          </div>
          <button onClick={pay} disabled={loading} style={{width:"100%",minHeight:48,background:loading?C.dim:`${p.color}18`,border:`1px solid ${loading?C.muted:p.color}55`,borderRadius:8,color:loading?C.muted:p.color,fontSize:12,letterSpacing:2,cursor:loading?"not-allowed":"pointer",fontFamily:"'Space Mono',monospace",transition:"all .2s"}}>
            {loading?"PROCESSING...":"CONFIRM PAYMENT"}
          </button>
          <div style={{textAlign:"center",fontSize:9,color:C.muted,marginTop:8,letterSpacing:1}}>🔒 DEMO · NO REAL CHARGE</div>
        </>}
        {step===2 && (
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:48,marginBottom:12}}>✅</div>
            <div style={{color:p.color,fontSize:16,letterSpacing:2}}>PAYMENT COMPLETE</div>
            <div style={{color:C.muted,fontSize:11,marginTop:8}}>{p.name} activated!</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chat modal ────────────────────────────────────────────────
function ChatModal({ user, messages, onClose, onSend }) {
  const [txt,setTxt]=useState("");
  const [msgs,setMsgs]=useState(messages.filter(m=>m.from===user.id));
  const endRef=useRef(null);
  useEffect(()=>{
    endRef.current?.scrollIntoView?.({behavior:"smooth"});
  },[msgs]);

  const send=()=>{
    if(!txt.trim())return;
    setMsgs(prev=>[...prev,{id:Date.now(),from:"me",text:txt,time:new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}),read:true}]);
    setTxt("");
    // Simulate reply
    setTimeout(()=>{
      const replies=["🌙 see you on the dancefloor","near the bar rn","come find me ⚡","🔮"];
      setMsgs(prev=>[...prev,{id:Date.now()+1,from:user.id,text:replies[Math.floor(Math.random()*replies.length)],time:new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}),read:true}]);
    },1200+Math.random()*800);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(4,4,10,.9)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:300,padding:"0 0 0 0"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:`1px solid ${C.green}33`,borderRadius:"14px 14px 0 0",width:"100%",maxWidth:430,height:"70vh",display:"flex",flexDirection:"column",animation:"slideUp .35s ease"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{width:38,height:38,borderRadius:"50%",background:`linear-gradient(135deg,${C.purple}88,${C.cyan}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{user.emoji}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,color:C.text,letterSpacing:1}}>{user.name}</div>
            <div style={{fontSize:10,color:C.muted}}>@{user.ig} · AES-256 encrypted</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,fontSize:18,cursor:"pointer"}}>✕</button>
        </div>
        {/* Messages */}
        <div style={{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{textAlign:"center",fontSize:9,color:C.muted,letterSpacing:1,marginBottom:4}}>
            🔒 MESSAGES AUTO-DELETE IN 24H
          </div>
          {msgs.map(m=>(
            <div key={m.id} style={{display:"flex",justifyContent:m.from==="me"?"flex-end":"flex-start"}}>
              <div style={{
                background:m.from==="me"?`${C.cyan}18`:`${C.purple}18`,
                border:`1px solid ${m.from==="me"?C.cyan:C.purple}33`,
                borderRadius:m.from==="me"?"12px 12px 2px 12px":"12px 12px 12px 2px",
                padding:"8px 12px", maxWidth:"70%",
              }}>
                <div style={{fontSize:12,color:C.text,lineHeight:1.5}}>{m.text}</div>
                <div style={{fontSize:9,color:C.muted,marginTop:4,textAlign:"right"}}>{m.time}</div>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        {/* Input */}
        <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`,display:"flex",gap:10}}>
          <input
            value={txt} onChange={e=>setTxt(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&send()}
            placeholder="Type a message..."
            style={{flex:1,background:C.el,border:`1px solid ${C.border}`,borderRadius:8,padding:"11px 14px",color:C.text,fontSize:13,fontFamily:"'Space Mono',monospace",outline:"none"}}
          />
          <button onClick={send} style={{minWidth:48,minHeight:48,background:`${C.cyan}18`,border:`1px solid ${C.cyan}44`,borderRadius:8,color:C.cyan,fontSize:18,cursor:"pointer"}}>↑</button>
        </div>
      </div>
    </div>
  );
}

// ── Onboarding flow ───────────────────────────────────────────
function Onboarding({ onDone }) {
  const [step,setStep]=useState(0);
  const [name,setName]=useState("");
  const [ig,setIg]=useState("");
  const [venue,setVenue]=useState(null);
  const [saving,setSaving]=useState(false);
  const [saveError,setSaveError]=useState("");

  const steps=["VENUE","ACCOUNT","YOUR HANDLE","SELFIE","CHECK IN"];

  const finishOnboarding=async()=>{
    setSaving(true);
    setSaveError("");
    try {
      const result=await apiRequest("/api/profile",{
        method:"PUT",
        body:JSON.stringify({name,ig,venueName:venue?.name}),
      });
      onDone(result.profile);
    } catch(error) {
      setSaveError(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{minHeight:"100dvh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,position:"relative",overflow:"hidden"}}>
      <Particles />
      <div style={{position:"relative",zIndex:10,width:"100%",maxWidth:380}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:28,fontWeight:700,letterSpacing:"0.3em",color:C.cyan,textShadow:`0 0 20px ${C.cyan}88`}}>
            NIGHT<span style={{color:C.purple}}>⚡</span>PULSE
          </div>
          <div style={{fontSize:9,color:C.muted,letterSpacing:"0.2em",marginTop:4}}>EPHEMERAL SOCIAL LAYER</div>
        </div>
        {/* Step dots */}
        <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:28}}>
          {steps.map((_,i)=>(
            <div key={i} style={{width:i===step?20:7,height:7,borderRadius:4,background:i<step?C.green:i===step?C.cyan:C.muted,transition:"all .3s",boxShadow:i===step?`0 0 8px ${C.cyan}`:""}} />
          ))}
        </div>

        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:28,animation:"fadeUp .4s ease"}}>

          {/* Step 0 — Venue */}
          {step===0 && (
            <div>
              <div style={{color:C.cyan,fontSize:14,letterSpacing:2,marginBottom:6}}>SCAN QR · CHOOSE VENUE</div>
              <div style={{color:C.muted,fontSize:11,marginBottom:18,lineHeight:1.7}}>Choose a venue to finish setting up your profile:</div>
              {VENUES.map(v=>(
                <div key={v.id} onClick={()=>{setVenue(v);setStep(1);}} style={{
                  background:venue?.id===v.id?`${C.cyan}15`:C.el,
                  border:`1px solid ${venue?.id===v.id?C.cyan:C.border}`,
                  borderRadius:8,padding:"14px 16px",marginBottom:10,cursor:"pointer",
                  transition:"all .2s",
                  display:"flex",justifyContent:"space-between",alignItems:"center",
                }}>
                  <div>
                    <div style={{color:C.text,fontSize:12,letterSpacing:1}}>{v.name}</div>
                    <div style={{color:C.muted,fontSize:10,marginTop:2}}>{v.vibe} · {v.crowd} inside</div>
                  </div>
                  <span style={{color:C.cyan}}>→</span>
                </div>
              ))}
            </div>
          )}

          {/* Step 1 — Account */}
          {step===1 && (
            <div style={{textAlign:"center"}}>
              <div style={{color:C.purple,fontSize:14,letterSpacing:2,marginBottom:6}}>ACCOUNT READY</div>
              <div style={{color:C.muted,fontSize:11,marginBottom:20,lineHeight:1.7}}>Your account is registered.<br/>Now set up your Night Pulse profile.</div>
              <div onClick={()=>setStep(2)} style={{display:"flex",alignItems:"center",gap:10,background:"#fff",borderRadius:8,padding:"13px 20px",cursor:"pointer",justifyContent:"center",fontFamily:"sans-serif",fontSize:13,fontWeight:600,color:"#000",marginBottom:12}}>
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue to profile setup
              </div>
              <div style={{fontSize:9,color:C.muted,letterSpacing:1}}>YOUR ACCOUNT IS SECURELY REGISTERED</div>
            </div>
          )}

          {/* Step 2 — Handle */}
          {step===2 && (
            <div>
              <div style={{color:C.cyan,fontSize:14,letterSpacing:2,marginBottom:6}}>YOUR HANDLE</div>
              <div style={{color:C.muted,fontSize:11,marginBottom:16}}>Display name + Instagram handle.</div>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Display name" style={{width:"100%",boxSizing:"border-box",background:C.el,border:`1px solid ${C.border}`,borderRadius:7,padding:"12px 14px",color:C.text,fontSize:13,fontFamily:"'Space Mono',monospace",outline:"none",marginBottom:10}} />
              <div style={{position:"relative",marginBottom:16}}>
                <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:C.muted}}>@</span>
                <input value={ig} onChange={e=>setIg(e.target.value.replace(/[^a-z0-9._]/gi,""))} placeholder="yourhandle" style={{width:"100%",boxSizing:"border-box",background:C.el,border:`1px solid ${C.border}`,borderRadius:7,padding:"12px 14px 12px 28px",color:C.text,fontSize:13,fontFamily:"'Space Mono',monospace",outline:"none"}} />
              </div>
              <button onClick={()=>name&&ig&&setStep(3)} style={{width:"100%",minHeight:48,background:name&&ig?`${C.cyan}18`:"transparent",border:`1px solid ${name&&ig?C.cyan:C.muted}55`,borderRadius:8,color:name&&ig?C.cyan:C.muted,fontSize:12,letterSpacing:2,cursor:name&&ig?"pointer":"not-allowed",fontFamily:"'Space Mono',monospace"}}>
                NEXT →
              </button>
            </div>
          )}

          {/* Step 3 — Selfie */}
          {step===3 && (
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:44,marginBottom:10}}>📸</div>
              <div style={{color:C.purple,fontSize:14,letterSpacing:2,marginBottom:6}}>LIVE SELFIE</div>
              <div style={{color:C.muted,fontSize:11,marginBottom:14,lineHeight:1.7}}>
                Anti-catfish verification.<br/>Front camera only — gallery uploads blocked.
              </div>
              <div style={{background:`${C.purple}0f`,border:`1px solid ${C.purple}22`,borderRadius:8,padding:12,marginBottom:16,fontSize:10,color:C.muted,lineHeight:1.8}}>
                ⏱ Timestamp overlay applied automatically<br/>
                📁 Cloudinary stores it for 6 hours only<br/>
                🚫 Profile goes dark after 6h if not re-selfied
              </div>
              <button onClick={()=>setStep(4)} style={{width:"100%",minHeight:48,background:`${C.purple}18`,border:`1px solid ${C.purple}55`,borderRadius:8,color:C.purple,fontSize:12,letterSpacing:2,cursor:"pointer",fontFamily:"'Space Mono',monospace"}}>
                📷 TAKE SELFIE (SIMULATED)
              </button>
            </div>
          )}

          {/* Step 4 — Check in */}
          {step===4 && (
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:44,marginBottom:10}}>📍</div>
              <div style={{color:C.green,fontSize:14,letterSpacing:2,marginBottom:6}}>CHECK IN</div>
              <div style={{color:C.muted,fontSize:11,marginBottom:14,lineHeight:1.7}}>
                Verifying you're within 1km of<br/>
                <span style={{color:C.text}}>{venue?.name}</span>
              </div>
              <div style={{background:`${C.green}0f`,border:`1px solid ${C.green}22`,borderRadius:8,padding:12,marginBottom:16,fontSize:10,color:C.muted,lineHeight:1.8,textAlign:"left"}}>
                <div style={{color:C.green,letterSpacing:2,marginBottom:6}}>POSTGIS FUNCTION</div>
                check_in_user(user_id, lat, lng, venue_id)<br/>
                → ST_Distance(venue, you) = <span style={{color:C.green}}>342m ✓</span><br/>
                → Applying 20m privacy jitter...<br/>
                → Presence upserted. No history logged.
              </div>
              {saveError&&<div role="alert" style={{color:C.pink,fontSize:10,marginBottom:12}}>{saveError}</div>}
              <button onClick={finishOnboarding} disabled={saving} style={{width:"100%",minHeight:52,background:`${C.green}18`,border:`1px solid ${C.green}55`,borderRadius:8,color:C.green,fontSize:13,letterSpacing:2,cursor:saving?"wait":"pointer",fontFamily:"'Space Mono',monospace",fontWeight:700}}>
                {saving?"SAVING PROFILE...":"✓ I'M IN — ENTER THE APP"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════
export default function App() {
  const [screen,setScreen]=useState("onboarding"); // onboarding | map | presence | signals | shop
  const [account,setAccount]=useState(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [authError,setAuthError]=useState("");
  const [me,setMe]=useState(null);
  const [users,setUsers]=useState(INIT_USERS);
  const [toasts,setToasts]=useState([]);
  const [newUserId,setNewUserId]=useState(null);
  const [payModal,setPayModal]=useState(null);
  const [chatUser,setChatUser]=useState(null);
  const [pulseActive,setPulseActive]=useState(false);
  const toastId=useRef(0);
  const toastTimers=useRef(new Map());

  useEffect(()=>{
    let active=true;
    apiRequest("/api/auth/me")
      .then(result=>{
        if(!active)return;
        setAccount(result);
        if(result.profile){
          setMe(result.profile);
          setScreen("map");
        }
      })
      .catch(error=>{
        if(active&&error.message!=="Please sign in to continue."&&
           error.message!=="Your session expired. Please sign in again."){
          setAuthError(error.message);
        }
      })
      .finally(()=>{if(active)setAuthLoading(false);});
    return ()=>{active=false;};
  },[]);

  useEffect(()=>()=>toastTimers.current.forEach(timer=>clearTimeout(timer)),[]);

  const addToast=(msg,icon,color)=>{
    const id=++toastId.current;
    setToasts(t=>[...t,{id,msg,icon,color}]);
    const timer=setTimeout(()=>{
      setToasts(t=>t.filter(x=>x.id!==id));
      toastTimers.current.delete(id);
    },3200);
    toastTimers.current.set(id,timer);
  };

  // Simulate users arriving
  useInterval(()=>{
    const extras=[
      {id:101,name:"REMI",  ig:"remi.night",emoji:"🦊",dist:randomBetween(30,900),pulsing:false,ghost:false,liked:false,matched:false},
      {id:102,name:"KEIKO", ig:"keiko_x",   emoji:"🌺",dist:randomBetween(30,900),pulsing:false,ghost:false,liked:false,matched:false},
      {id:103,name:"OMAR",  ig:"omar.pulse",emoji:"🎸",dist:randomBetween(30,900),pulsing:false,ghost:false,liked:false,matched:false},
    ];
    if(users.length<12){
      const newUser={...extras[Math.floor(Math.random()*extras.length)],id:Date.now()};
      setUsers(u=>[newUser,...u]);
      setNewUserId(newUser.id);
      addToast(`${newUser.name} just entered the venue`,"📍",C.cyan);
      setTimeout(()=>setNewUserId(null),800);
    }
  }, 8000);

  // Simulate random pulse events
  useInterval(()=>{
    const eligible=users.filter(x=>!x.pulsing);
    if(!eligible.length)return;
    const target=eligible[Math.floor(Math.random()*eligible.length)];
    setUsers(u=>u.map(x=>x.id===target.id?{...x,pulsing:true}:x));
    addToast(`${target.name} activated PULSE ⚡`,"⚡",C.cyan);
    // Reset after 30s (simulated)
    setTimeout(()=>{
      setUsers(u=>u.map(x=>x.id===target.id?{...x,pulsing:false}:x));
    },30000);
  },18000);

  const handleLike=(uid)=>{
    const target=users.find(x=>x.id===uid);
    if(!target)return;
    const nowLiked=!target.liked;
    const nowMatched=nowLiked&&Math.random()>.45;
    setUsers(u=>u.map(x=>x.id===uid
      ?{...x,liked:nowLiked,matched:nowLiked&&(x.matched||nowMatched)}
      :x));
    if(nowMatched)addToast(`You matched with ${target.name}! 🎉`,"🎉",C.green);
    else if(nowLiked)addToast(`Liked ${target.name}`,"❤️",C.pink);
  };

  const handlePaySuccess=(product)=>{
    if(product==="pulse"){
      setPulseActive(true);
      addToast("PULSE active! Your profile is glowing ⚡","⚡",C.cyan);
      setTimeout(()=>setPulseActive(false),30*60*1000);
    }
    if(product==="ghost_pack") addToast("Ghost Pack active. You're invisible 👻","👻",C.purple);
    if(product==="direct_signal") addToast("Direct Signal unlocked 🎯","🎯",C.purple);
  };

  const handleAuthenticated=(result)=>{
    setAccount(result);
    setAuthError("");
    if(result.profile){
      setMe(result.profile);
      setScreen("map");
    }else{
      setScreen("onboarding");
    }
  };

  const handleLogout=async()=>{
    try{
      await apiRequest("/api/auth/logout",{method:"POST"});
      setAccount(null);
      setMe(null);
      setScreen("onboarding");
    }catch(error){
      addToast(error.message,"⚠️",C.pink);
    }
  };

  const NAV=[
    {id:"map",      icon:"🗺️", label:"MAP"},
    {id:"presence", icon:"👥", label:"NEARBY"},
    {id:"signals",  icon:"💬", label:"SIGNALS"},
    {id:"shop",     icon:"⚡", label:"SHOP"},
  ];

  if(authLoading) return (
    <div style={{minHeight:"100dvh",width:"min(100%, 430px)",margin:"0 auto",background:C.bg,color:C.cyan,display:"grid",placeItems:"center",fontFamily:"'Space Mono','Courier New',monospace"}}>
      Checking your session...
    </div>
  );

  if(!account) return (
    <div style={{minHeight:"100dvh",background:C.bg}}>
      {authError&&<div role="alert" style={{position:"fixed",top:12,left:"50%",transform:"translateX(-50%)",width:"min(390px, calc(100vw - 24px))",zIndex:10,textAlign:"center",color:C.pink,fontSize:12}}>{authError}</div>}
      <Auth onAuthenticated={handleAuthenticated} />
    </div>
  );

  if(screen==="onboarding") return (
    <div style={{width:"min(100%, 430px)",minHeight:"100dvh",margin:"0 auto",background:C.bg,fontFamily:"'Space Mono','Courier New',monospace"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;} ::-webkit-scrollbar-thumb{background:#b44dff55;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:none;}}
        @keyframes shimmer{0%,100%{opacity:.5;}50%{opacity:1;}}
        @keyframes toastIn{from{opacity:0;transform:translateX(20px);}to{opacity:1;transform:none;}}
        @keyframes slideUp{from{transform:translateY(100%);}to{transform:none;}}
      `}</style>
      <Onboarding onDone={(profile)=>{setMe(profile);setScreen("map");}} />
    </div>
  );

  return (
    <div style={{width:"min(100%, 430px)",minHeight:"100dvh",margin:"0 auto",background:C.bg,color:C.text,fontFamily:"'Space Mono','Courier New',monospace",display:"flex",flexDirection:"column",position:"relative",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;} ::-webkit-scrollbar-thumb{background:#b44dff55;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:none;}}
        @keyframes shimmer{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
        @keyframes toastIn{from{opacity:0;transform:translateX(20px);}to{opacity:1;transform:none;}}
        @keyframes slideUp{from{transform:translateY(100%);}to{transform:none;}}
        @keyframes pulseRing{0%{transform:scale(1);opacity:.8;}100%{transform:scale(2.5);opacity:0;}}
      `}</style>

      <Particles />
      <Toast toasts={toasts} />

      {/* Header */}
      <header style={{position:"sticky",top:0,zIndex:50,background:`${C.bg}dd`,backdropFilter:"blur(20px)",borderBottom:`1px solid ${C.border}`,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,letterSpacing:"0.25em",color:C.cyan,textShadow:`0 0 12px ${C.cyan}77`}}>
            NIGHT<span style={{color:C.purple}}>⚡</span>PULSE
          </div>
          <div style={{fontSize:9,color:C.muted,letterSpacing:"0.2em",marginTop:1}}>
            {me?.venue?.name} · {users.filter(u=>!u.ghost).length} LIVE
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          {pulseActive&&<div style={{fontSize:9,color:C.cyan,border:`1px solid ${C.cyan}44`,borderRadius:3,padding:"3px 8px",letterSpacing:1,animation:"shimmer 2s ease-in-out infinite"}}>⚡ PULSING</div>}
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:C.green}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:C.green,display:"inline-block",boxShadow:`0 0 6px ${C.green}`,animation:"shimmer 2s ease-in-out infinite"}} />
            LIVE
          </div>
          <button onClick={handleLogout} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,color:C.muted,padding:"7px 9px",fontFamily:"inherit",fontSize:9,cursor:"pointer"}}>
            SIGN OUT
          </button>
        </div>
      </header>

      {/* Content */}
      <div style={{flex:1,overflow:"auto",paddingBottom:70}}>

        {/* MAP */}
        {screen==="map" && (
          <div style={{padding:"16px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.muted,marginBottom:10}}>
              <span style={{color:C.cyan,letterSpacing:2}}>◆ {me?.venue?.name}</span>
              <span>±20M JITTER ACTIVE</span>
            </div>
            <div style={{borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}`,background:"#07070e",height:300,marginBottom:14,position:"relative"}}>
              <Radar users={users} newUserId={newUserId} />
              <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,rgba(4,4,10,.8))",padding:"24px 14px 12px",display:"flex",gap:16,fontSize:10,color:C.muted}}>
                <span style={{color:C.cyan}}>⬤ {users.filter(u=>!u.ghost).length} visible</span>
                <span style={{color:C.purple}}>⬤ {users.filter(u=>u.pulsing).length} pulsing</span>
                <span style={{marginLeft:"auto",color:C.purple}}>⬤ {users.filter(u=>u.ghost).length} ghost</span>
              </div>
            </div>
            {/* Quick stats */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              {[
                {label:"MATCHED",    val:users.filter(u=>u.matched).length, col:C.green},
                {label:"PULSING",    val:users.filter(u=>u.pulsing).length, col:C.cyan},
                {label:"GHOST PACK", val:users.filter(u=>u.ghost).length,   col:C.purple},
              ].map(s=>(
                <div key={s.label} style={{background:C.card,border:`1px solid ${s.col}22`,borderRadius:8,padding:"12px 8px",textAlign:"center"}}>
                  <div style={{fontSize:20,color:s.col,textShadow:`0 0 10px ${s.col}88`,fontWeight:700}}>{s.val}</div>
                  <div style={{fontSize:8,color:C.muted,letterSpacing:1,marginTop:3}}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PRESENCE GRID */}
        {screen==="presence" && (
          <div style={{padding:"14px"}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:2,marginBottom:14}}>
              {users.filter(u=>!u.ghost).length} PEOPLE NEARBY · TAP TO LIKE OR MESSAGE
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
              {users.map(u=>(
                <UserCard key={u.id} user={u} isNew={u.id===newUserId}
                  onLike={handleLike}
                  onMessage={(user)=>setChatUser(user)}
                  onPulse={()=>setPayModal("pulse")}
                />
              ))}
            </div>
          </div>
        )}

        {/* SIGNALS */}
        {screen==="signals" && (
          <div style={{padding:"14px"}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:2,marginBottom:14}}>
              AES-256 ENCRYPTED · AUTO-DELETE 24H
            </div>
            {users.filter(u=>u.matched).length===0 && (
              <div style={{textAlign:"center",padding:40,color:C.muted,fontSize:11,lineHeight:2}}>
                No matches yet.<br/>Go to NEARBY and like some profiles.<br/>
                <span style={{color:C.purple}}>~50% chance they like you back</span>
              </div>
            )}
            {users.filter(u=>u.matched).map(u=>(
              <div key={u.id} onClick={()=>setChatUser(u)} style={{
                background:C.card,border:`1px solid ${C.green}22`,borderRadius:10,
                padding:"14px 16px",marginBottom:10,cursor:"pointer",
                display:"flex",gap:12,alignItems:"center",
                transition:"all .2s",
              }}>
                <div style={{width:44,height:44,borderRadius:"50%",background:`linear-gradient(135deg,${C.purple}88,${C.cyan}88)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{u.emoji}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,color:C.text,letterSpacing:1,marginBottom:2}}>{u.name}</div>
                  <div style={{fontSize:10,color:C.muted}}>Tap to open encrypted chat →</div>
                </div>
                <div style={{fontSize:9,color:C.green,border:`1px solid ${C.green}33`,borderRadius:3,padding:"3px 7px",letterSpacing:1}}>MATCHED</div>
              </div>
            ))}
            {/* Unmatched — show Direct Signal upsell */}
            {users.filter(u=>!u.matched&&!u.ghost).slice(0,3).map(u=>(
              <div key={u.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",marginBottom:10,display:"flex",gap:12,alignItems:"center",opacity:.6}}>
                <div style={{width:44,height:44,borderRadius:"50%",background:`linear-gradient(135deg,${C.purple}44,${C.cyan}44)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{u.emoji}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,color:C.muted,letterSpacing:1,marginBottom:2}}>{u.name}</div>
                  <div style={{fontSize:10,color:C.muted}}>No match yet</div>
                </div>
                <button onClick={()=>setPayModal("direct_signal")} style={{fontSize:9,color:C.purple,border:`1px solid ${C.purple}44`,borderRadius:4,padding:"6px 10px",background:"transparent",cursor:"pointer",fontFamily:"'Space Mono',monospace",letterSpacing:1,minHeight:36}}>
                  SIGNAL €2.49
                </button>
              </div>
            ))}
          </div>
        )}

        {/* SHOP */}
        {screen==="shop" && (
          <div style={{padding:"14px"}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:2,marginBottom:16}}>STRIPE PAYMENTS · EUROS · 0% APP TAX</div>
            {[
              {key:"pulse",         icon:"⚡", name:"THE PULSE",       price:"€1.99",    color:C.cyan,   sub:"Profile glows & floats to top for 30 min",   desc:"High-priority WebSocket broadcast. Everyone nearby sees your card pulse in real-time."},
              {key:"direct_signal", icon:"🎯", name:"DIRECT SIGNAL",   price:"€2.49",    color:C.purple, sub:"Bypass mutual match — send 1 encrypted msg",  desc:"Skip the like queue. One AES-256 encrypted message, auto-deleted in 24h. Zero paper trail."},
              {key:"ghost_pack",    icon:"👻", name:"GHOST PACK",      price:"€9.99/mo", color:C.green,  sub:"See everyone · Stay completely invisible",    desc:"You see all users on the map and grid — including other Ghost Pack users. Nobody sees you."},
            ].map(p=>(
              <div key={p.key} style={{background:C.card,border:`1px solid ${p.color}28`,borderRadius:12,padding:20,marginBottom:12}}>
                <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:12}}>
                  <span style={{fontSize:32,lineHeight:1}}>{p.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{color:p.color,fontSize:13,letterSpacing:2,textShadow:`0 0 8px ${p.color}66`}}>{p.name}</span>
                      <span style={{color:p.color,fontSize:18,fontWeight:700}}>{p.price}</span>
                    </div>
                    <div style={{fontSize:10,color:C.muted,marginTop:2}}>{p.sub}</div>
                  </div>
                </div>
                <div style={{fontSize:11,color:C.muted,lineHeight:1.7,marginBottom:14}}>{p.desc}</div>
                <button onClick={()=>setPayModal(p.key)} style={{width:"100%",minHeight:48,background:`${p.color}15`,border:`1px solid ${p.color}44`,borderRadius:8,color:p.color,fontSize:12,letterSpacing:2,cursor:"pointer",fontFamily:"'Space Mono',monospace",transition:"all .2s"}}>
                  BUY · {p.price}
                </button>
              </div>
            ))}
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:14,fontSize:10,color:C.muted,lineHeight:1.8}}>
              <div style={{color:C.cyan,letterSpacing:2,marginBottom:6}}>WHY NO APP STORE?</div>
              Apple & Google charge 30% on in-app purchases.<br/>
              PWA home screen shortcut = browser payment = <span style={{color:C.green}}>0% tax</span>.<br/>
              You keep 100% minus ~1.4% + €0.25 Stripe fee (EU cards).
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"min(100%, 430px)",zIndex:50,background:`${C.bg}ee`,backdropFilter:"blur(20px)",borderTop:`1px solid ${C.border}`,display:"flex"}}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>setScreen(n.id)} style={{
            flex:1, minHeight:58, background:"none", border:"none",
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4,
            color: screen===n.id ? C.cyan : C.muted,
            cursor:"pointer", transition:"all .2s",
            borderTop:`2px solid ${screen===n.id?C.cyan:"transparent"}`,
          }}>
            <span style={{fontSize:18}}>{n.icon}</span>
            <span style={{fontSize:8,letterSpacing:2,fontFamily:"'Space Mono',monospace"}}>{n.label}</span>
          </button>
        ))}
      </nav>

      {/* Modals */}
      {payModal && <PayModal product={payModal} onClose={()=>setPayModal(null)} onSuccess={handlePaySuccess} />}
      {chatUser && <ChatModal user={chatUser} messages={MOCK_MESSAGES} onClose={()=>setChatUser(null)} onSend={()=>{}} />}
    </div>
  );
}
