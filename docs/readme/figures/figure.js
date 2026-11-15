// Shared figure helper: fills texts from a dictionary by language (#en / #ko) and draws connectors.
// Connector: {from,to (or endY/endYd: a stub straight down to that y),fromSide,toSide,ft,tt,via:[{x|y:ref,d}],dashed,label,lseg,w}
// ref: number, or 'top:id' 'bottom:id' 'left:id' 'right:id' 'cx:id' 'cy:id'; d adds an offset.
function fill(dict){
  const lang = (location.hash||'#en').slice(1)==='ko' ? 'ko' : 'en';
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-t]').forEach(el=>{
    const e = dict[el.dataset.t]; if(!e) throw new Error('missing text '+el.dataset.t);
    el.innerHTML = e[lang];
  });
  return lang;
}
function draw(wires){
  const fig = document.getElementById('fig'), fr = fig.getBoundingClientRect();
  const R = id => { const el=document.getElementById(id); if(!el) throw new Error('no id '+id);
    const r=el.getBoundingClientRect(); return {l:r.left-fr.left,t:r.top-fr.top,r:r.right-fr.left,b:r.bottom-fr.top,cx:(r.left+r.right)/2-fr.left,cy:(r.top+r.bottom)/2-fr.top}; };
  const ref = (v,d=0) => { if(typeof v==='number') return v+d; const [k,id]=v.split(':'); const r=R(id);
    return ({top:r.t,bottom:r.b,left:r.l,right:r.r,cx:r.cx,cy:r.cy})[k]+d; };
  const anchor = (id,side,f=.5) => { const r=R(id);
    if(side==='left') return [r.l, r.t+(r.b-r.t)*f]; if(side==='right') return [r.r, r.t+(r.b-r.t)*f];
    if(side==='top') return [r.l+(r.r-r.l)*f, r.t]; return [r.l+(r.r-r.l)*f, r.b]; };
  const NS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(NS,'svg'); svg.id='wires';
  svg.setAttribute('width',fr.width); svg.setAttribute('height',fr.height);
  svg.innerHTML='<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#101826"/></marker></defs>';
  const labels=[];
  for(const w of wires){
    const s=anchor(w.from,w.fromSide,w.ft), e=w.endY!=null?[s[0],ref(w.endY,w.endYd)]:anchor(w.to,w.toSide,w.tt);
    const pts=[s]; let [x,y]=s;
    for(const v of (w.via||[])){ if('x' in v){x=ref(v.x,v.d);} else {y=ref(v.y,v.d);} pts.push([x,y]); }
    if(w.toSide==='left'||w.toSide==='right'){ if(y!==e[1]) pts.push([x,e[1]]); } else { if(x!==e[0]) pts.push([e[0],y]); }
    pts.push(e);
    const p=document.createElementNS(NS,'polyline');
    p.setAttribute('points',pts.map(q=>q.join(',')).join(' '));
    p.setAttribute('fill','none'); p.setAttribute('stroke','#101826'); p.setAttribute('stroke-width',w.w||2.5);
    p.setAttribute('stroke-linejoin','round');
    if(w.dashed) p.setAttribute('stroke-dasharray','10 8');
    if(!w.nohead) p.setAttribute('marker-end','url(#ah)');
    svg.appendChild(p);
    if(w.label){ let best=0,bi=0; for(let i=1;i<pts.length;i++){const L=Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]); if(L>best){best=L;bi=i;}}
      if(w.lseg!=null) bi=w.lseg; const a=pts[bi-1],b=pts[bi];
      labels.push({x:(a[0]+b[0])/2+(w.lx||0), y:(a[1]+b[1])/2+(w.ly||0), t:w.label}); }
  }
  for(const L of labels){
    const d=document.createElement('div'); d.className='lbl'; d.id='lbl-'+Math.random().toString(36).slice(2,7);
    d.innerHTML=L.t; Object.assign(d.style,{zIndex:6,position:'absolute',background:'var(--paper)',border:'2px solid var(--ink)',borderRadius:'999px',padding:'2px 12px',whiteSpace:'nowrap',lineHeight:'1.3'});
    fig.appendChild(d); const r=d.getBoundingClientRect();
    d.style.left=(L.x-r.width/2)+'px'; d.style.top=(L.y-r.height/2)+'px';
  }
  svg.style.zIndex=5; fig.appendChild(svg);
}
async function run(dict, wires){
  fill(dict); await document.fonts.ready; await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  draw(typeof wires==='function'?wires():wires);
}
window.Fig = { fill, draw, run };
