(() => {
  const C = window.CHUVA_MT_CONFIG;
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey);
  const $ = id => document.getElementById(id);
  const monthNames = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  const fmt = (v,d=1) => Number.isFinite(v) ? v.toLocaleString("pt-BR",{minimumFractionDigits:d,maximumFractionDigits:d}) : "—";
  const pct = v => Number.isFinite(v) ? (v>0?"+":"")+fmt(v,1)+"%" : "—";
  const mm = v => Number.isFinite(v) ? fmt(v,1)+" mm" : "—";
  let historical=[], dynamic=[], all=[], geojson=null, map=null, geoLayer=null, stateChart=null, munChart=null, advChart=null;
  let selectedYear=null, selectedMonth=null, selectedMun=null;

  function setLoading(text){ $("loadingText").textContent=text; $("loading").classList.remove("hide"); }
  function stopLoading(){ $("loading").classList.add("hide"); }
  function key(r){ return [r.ano,r.mes,r.cd_mun].join("-"); }
  function normHist(r){ return {produto:"CHIRPS",versao:"v2.0",status:"final",ano:+r.ano,mes:+r.mes,cd_mun:String(r.CD_MUN),nm_mun:r.NM_MUN,area_km2:+r.AREA_KM2,chuva_mm:+r.chuva_mm,fonte:"CHC/UCSB"}; }
  function normDyn(r){ return {...r,ano:+r.ano,mes:+r.mes,cd_mun:String(r.cd_mun),area_km2:+r.area_km2,chuva_mm:+r.chuva_mm}; }

  function combineRows(){
    const m=new Map();
    historical.forEach(r=>m.set(key(r),r));
    dynamic.forEach(r=>{
      const k=key(r), old=m.get(k);
      if(!old || r.status==="final" || old.status!=="final") m.set(k,r);
    });
    all=[...m.values()].filter(r=>Number.isFinite(r.chuva_mm));
  }

  function rowsPeriod(y,m){ return all.filter(r=>r.ano===y && r.mes===m); }
  function baselineMun(code,m){ return historical.filter(r=>r.cd_mun===code && r.mes===m && r.ano>=C.baselineStart && r.ano<=C.baselineEnd); }
  function mean(a){ return a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN; }
  function sd(a){ if(a.length<2)return NaN; const av=mean(a); return Math.sqrt(a.reduce((s,x)=>s+(x-av)**2,0)/(a.length-1)); }
  function median(a){ if(!a.length)return NaN; const x=[...a].sort((a,b)=>a-b), h=Math.floor(x.length/2); return x.length%2?x[h]:(x[h-1]+x[h])/2; }
  function quantile(a,q){ if(!a.length)return NaN; const x=[...a].sort((a,b)=>a-b), p=(x.length-1)*q, lo=Math.floor(p), hi=Math.ceil(p); return x[lo]+(x[hi]-x[lo])*(p-lo); }
  function weighted(rows){ const ok=rows.filter(r=>r.area_km2>0&&Number.isFinite(r.chuva_mm)); const w=ok.reduce((s,r)=>s+r.area_km2,0); return w?ok.reduce((s,r)=>s+r.chuva_mm*r.area_km2,0)/w:NaN; }

  function stateSeries(month){
    const out=[];
    const years=[...new Set(all.filter(r=>r.mes===month).map(r=>r.ano))].sort((a,b)=>a-b);
    years.forEach(y=>{ const rows=rowsPeriod(y,month); if(rows.length>=130) out.push({ano:y,chuva:weighted(rows),status:rows.some(r=>r.status==="final")?"final":"preliminar"}); });
    return out;
  }
  function munStats(r){
    const b=baselineMun(r.cd_mun,r.mes), vals=b.map(x=>x.chuva_mm), av=mean(vals), s=sd(vals);
    const rank=1+vals.filter(v=>v>r.chuva_mm).length;
    const per=vals.length?100*vals.filter(v=>v<=r.chuva_mm).length/vals.length:NaN;
    return {...r,media:av,dp:s,anom:r.chuva_mm-av,anomPct:av?100*(r.chuva_mm-av)/av:NaN,rank,percentil:per,p10:quantile(vals,.1),p90:quantile(vals,.9)};
  }
  function currentStats(){ return rowsPeriod(selectedYear,selectedMonth).map(munStats); }
  function stateStats(){
    const series=stateSeries(selectedMonth), current=series.find(x=>x.ano===selectedYear);
    const b=series.filter(x=>x.ano>=C.baselineStart&&x.ano<=C.baselineEnd), vals=b.map(x=>x.chuva);
    const av=mean(vals), val=current?.chuva;
    return {series,current,val,media:av,anom:val-av,anomPct:av?100*(val-av)/av:NaN,rank:Number.isFinite(val)?1+vals.filter(v=>v>val).length:NaN,n:vals.length+1};
  }

  function periodLabel(y,m){ return monthNames[m-1].replace(/^./,c=>c.toUpperCase())+" de "+y; }
  function fillPeriods(){
    const periods=[...new Set(all.map(r=>r.ano+"-"+String(r.mes).padStart(2,"0")))].sort().reverse();
    $("periodSelect").innerHTML=periods.map(p=>{const [y,m]=p.split("-").map(Number);return '<option value="'+p+'">'+periodLabel(y,m)+'</option>';}).join("");
    const latest=periods[0].split("-").map(Number); selectedYear=latest[0];selectedMonth=latest[1];
  }
  function fillMunicipios(){
    const rows=currentStats().sort((a,b)=>a.nm_mun.localeCompare(b.nm_mun,"pt-BR"));
    $("municipioSelect").innerHTML=rows.map(r=>'<option value="'+r.cd_mun+'">'+r.nm_mun+'</option>').join("");
    $("advancedScope").innerHTML='<option value="MT">Mato Grosso</option>'+rows.map(r=>'<option value="'+r.cd_mun+'">'+r.nm_mun+'</option>').join("");
    if(!selectedMun || !rows.some(r=>r.cd_mun===selectedMun)) selectedMun=rows.find(r=>r.nm_mun==="Cáceres")?.cd_mun || rows[0]?.cd_mun;
    $("municipioSelect").value=selectedMun||"";
  }

  function statusForPeriod(){
    const rows=rowsPeriod(selectedYear,selectedMonth);
    const final=rows.length && rows.every(r=>r.status==="final");
    const el=$("dataStatus"); el.innerHTML='<span class="dot '+(final?'':'prelim')+'"></span><span>'+(final?"Dado final":"Dado preliminar")+'</span>';
  }

  function storyText(s,stats){
    if(!Number.isFinite(s.val)) return "Ainda não há dados suficientes para este período.";
    const top=[...stats].sort((a,b)=>b.anomPct-a.anomPct)[0], low=[...stats].sort((a,b)=>a.anomPct-b.anomPct)[0];
    const pos=s.rank===1?"o mais chuvoso":s.rank<=3?"entre os três mais chuvosos":s.rank>Math.max(25,s.n-5)?"entre os mais secos":"próximo do centro da série histórica";
    const signal=Math.abs(s.anomPct)<10?"praticamente dentro da média histórica":s.anomPct>0?pct(s.anomPct)+" acima da média histórica":pct(s.anomPct)+" abaixo da média histórica";
    return periodLabel(selectedYear,selectedMonth)+" registrou "+mm(s.val)+" em média no estado, "+signal+", ficando "+pos+". O contraste espacial foi forte: "+top.nm_mun+" teve uma das maiores anomalias ("+pct(top.anomPct)+"), enquanto "+low.nm_mun+" ficou no extremo oposto ("+pct(low.anomPct)+").";
  }

  function renderHero(){
    const s=stateStats(), stats=currentStats();
    $("heroPeriod").textContent=periodLabel(selectedYear,selectedMonth);
    $("stateRain").textContent=mm(s.val);
    $("stateAnomaly").textContent=pct(s.anomPct);
    $("stateAnomaly").className=s.anomPct>10?"positive":s.anomPct<-10?"negative":"neutral";
    $("stateRank").textContent=Number.isFinite(s.rank)?s.rank+"º":"—";
    $("stateRankSub").textContent=Number.isFinite(s.rank)?"entre "+s.n+" anos comparados":"sem comparação";
    $("story").textContent=storyText(s,stats);
    statusForPeriod();
  }

  function anomalyColor(v){
    if(!Number.isFinite(v)) return "#50635b";
    if(v<=-50)return "#7a2d2d"; if(v<=-25)return "#a34a3f"; if(v<=-10)return "#bb7654";
    if(v<10)return "#66756e"; if(v<25)return "#4b9b7c"; if(v<50)return "#2f8bc0"; if(v<100)return "#2564a8"; return "#493a9b";
  }
  function renderMap(){
    const stats=currentStats(), by=new Map(stats.map(r=>[r.cd_mun,r]));
    if(!map){ map=L.map("map",{zoomControl:true,attributionControl:true}).setView([-13.5,-56.2],6); L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap"}).addTo(map); }
    if(geoLayer) geoLayer.remove();
    geoLayer=L.geoJSON(geojson,{
      style:f=>{const r=by.get(String(f.properties.id));return {color:"#17352a",weight:.7,fillColor:anomalyColor(r?.anomPct),fillOpacity:.82};},
      onEachFeature:(f,layer)=>{
        const r=by.get(String(f.properties.id)); if(!r)return;
        layer.bindTooltip("<strong>"+r.nm_mun+"</strong><br>"+mm(r.chuva_mm)+"<br>Anomalia: "+pct(r.anomPct),{sticky:true});
        layer.on("click",()=>{selectedMun=r.cd_mun;$("municipioSelect").value=selectedMun;showTab("municipios");renderMunicipio();});
      }
    }).addTo(map);
    const legend=L.control({position:"bottomright"}); legend.onAdd=()=>{const d=L.DomUtil.create("div","legend");d.innerHTML="<b>Anomalia</b><br><i style='background:#7a2d2d'></i>&lt; -50%<br><i style='background:#a34a3f'></i>-50 a -25%<br><i style='background:#bb7654'></i>-25 a -10%<br><i style='background:#66756e'></i>normal<br><i style='background:#4b9b7c'></i>+10 a +25%<br><i style='background:#2f8bc0'></i>+25 a +50%<br><i style='background:#2564a8'></i>&gt; +50%";return d;}; legend.addTo(map);
    setTimeout(()=>map.invalidateSize(),100);
  }

  function renderRanking(){
    let rows=currentStats(), mode=$("rankMode").value;
    rows.sort(mode==="dry"?(a,b)=>a.chuva_mm-b.chuva_mm:mode==="anom"?(a,b)=>b.anomPct-a.anomPct:(a,b)=>b.chuva_mm-a.chuva_mm);
    $("ranking").innerHTML=rows.slice(0,10).map((r,i)=>'<div class="rank-row"><div class="rank-num">'+String(i+1).padStart(2,"0")+'</div><div class="rank-name">'+r.nm_mun+'</div><div class="rank-value"><strong>'+mm(r.chuva_mm)+'</strong><small class="'+(r.anomPct>10?"positive":r.anomPct<-10?"negative":"neutral")+'">'+pct(r.anomPct)+'</small></div></div>').join("");
  }

  function renderHighlights(){
    const rows=currentStats(), wet=[...rows].sort((a,b)=>b.chuva_mm-a.chuva_mm)[0], dry=[...rows].sort((a,b)=>a.chuva_mm-b.chuva_mm)[0], pos=[...rows].sort((a,b)=>b.anomPct-a.anomPct)[0], neg=[...rows].sort((a,b)=>a.anomPct-b.anomPct)[0];
    const cards=[
      ["Maior chuva",wet?.nm_mun,wet?mm(wet.chuva_mm):"—"],
      ["Menor chuva",dry?.nm_mun,dry?mm(dry.chuva_mm):"—"],
      ["Maior excesso",pos?.nm_mun,pos?pct(pos.anomPct):"—"],
      ["Maior déficit",neg?.nm_mun,neg?pct(neg.anomPct):"—"]
    ];
    $("highlights").innerHTML=cards.map((x,i)=>'<div class="rank-row"><div class="rank-num">0'+(i+1)+'</div><div class="rank-name">'+x[0]+'<br><small style="color:var(--muted)">'+(x[1]||"—")+'</small></div><div class="rank-value"><strong>'+x[2]+'</strong></div></div>').join("");
  }

  function chartOpts(yTitle){ return {responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:"#9fb2a7"}},y:{grid:{color:"rgba(255,255,255,.07)"},ticks:{color:"#9fb2a7"},title:{display:true,text:yTitle,color:"#9fb2a7"}}}}; }
  function renderStateChart(){
    const s=stateStats().series;
    if(stateChart)stateChart.destroy();
    stateChart=new Chart($("stateChart"),{type:"line",data:{labels:s.map(x=>x.ano),datasets:[{data:s.map(x=>x.chuva),borderColor:"#64e6a6",backgroundColor:"rgba(100,230,166,.12)",pointRadius:s.map(x=>x.ano===selectedYear?5:2),borderWidth:2,tension:.22,fill:true}]},options:chartOpts("mm")});
  }

  function renderMunicipio(){
    const rows=currentStats(), r=rows.find(x=>x.cd_mun===selectedMun); if(!r)return;
    $("municipioName").textContent=r.nm_mun;$("munRain").textContent=mm(r.chuva_mm);$("munMean").textContent=mm(r.media);$("munAnom").textContent=pct(r.anomPct);$("munRank").textContent=r.rank+"º de "+(baselineMun(r.cd_mun,r.mes).length+1);
    const series=all.filter(x=>x.cd_mun===r.cd_mun&&x.mes===selectedMonth).sort((a,b)=>a.ano-b.ano);
    if(munChart)munChart.destroy();
    munChart=new Chart($("munChart"),{type:"bar",data:{labels:series.map(x=>x.ano),datasets:[{data:series.map(x=>x.chuva_mm),backgroundColor:series.map(x=>x.ano===selectedYear?"#79bfff":"rgba(121,191,255,.35)"),borderWidth:0}]},options:chartOpts("mm")});
  }

  function linearRegression(series){
    const n=series.length;if(n<3)return {slope:NaN,intercept:NaN,r2:NaN};
    const xs=series.map(x=>x.ano), ys=series.map(x=>x.chuva), xm=mean(xs),ym=mean(ys);
    const ssx=xs.reduce((s,x)=>s+(x-xm)**2,0), cov=xs.reduce((s,x,i)=>s+(x-xm)*(ys[i]-ym),0), slope=cov/ssx, intercept=ym-slope*xm;
    const pred=xs.map(x=>intercept+slope*x), sst=ys.reduce((s,y)=>s+(y-ym)**2,0), sse=ys.reduce((s,y,i)=>s+(y-pred[i])**2,0);
    return {slope,intercept,r2:sst?1-sse/sst:NaN,pred};
  }
  function erf(x){ const sign=x<0?-1:1; x=Math.abs(x); const a1=.254829592,a2=-.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=.3275911,t=1/(1+p*x); return sign*(1-(((((a5*t+a4)*t)+a3)*t+a2)*t+a1)*t*Math.exp(-x*x)); }
  function normalCDF(x){ return .5*(1+erf(x/Math.sqrt(2))); }
  function mannKendall(series){
    const y=series.map(x=>x.chuva), n=y.length; let S=0;
    for(let i=0;i<n-1;i++)for(let j=i+1;j<n;j++)S+=Math.sign(y[j]-y[i]);
    const counts={};y.forEach(v=>counts[v]=(counts[v]||0)+1);
    let tie=0;Object.values(counts).forEach(t=>{if(t>1)tie+=t*(t-1)*(2*t+5);});
    const variance=(n*(n-1)*(2*n+5)-tie)/18;
    const z=S>0?(S-1)/Math.sqrt(variance):S<0?(S+1)/Math.sqrt(variance):0;
    return {S,z,p:2*(1-normalCDF(Math.abs(z))),tau:S/(.5*n*(n-1))};
  }
  function senSlope(series){
    const slopes=[];for(let i=0;i<series.length-1;i++)for(let j=i+1;j<series.length;j++)slopes.push((series[j].chuva-series[i].chuva)/(series[j].ano-series[i].ano));
    return median(slopes);
  }
  function scopeSeries(scope){
    if(scope==="MT") return stateSeries(selectedMonth).map(x=>({ano:x.ano,chuva:x.chuva}));
    return all.filter(r=>r.cd_mun===scope&&r.mes===selectedMonth).sort((a,b)=>a.ano-b.ano).map(r=>({ano:r.ano,chuva:r.chuva_mm}));
  }
  function renderAdvanced(){
    const scope=$("advancedScope").value||"MT", series=scopeSeries(scope), lr=linearRegression(series), mk=mannKendall(series), sen=senSlope(series), vals=series.map(x=>x.chuva), cv=100*sd(vals)/mean(vals), p10=quantile(vals,.1),p90=quantile(vals,.9);
    $("trendSlope").textContent=Number.isFinite(lr.slope)?((lr.slope*10)>0?"+":"")+fmt(lr.slope*10,1)+" mm":"—";
    $("trendR2").textContent=Number.isFinite(lr.r2)?fmt(lr.r2,3):"—";
    $("mkP").textContent=Number.isFinite(mk.p)?"p = "+fmt(mk.p,3):"—";
    $("mkNote").textContent=Number.isFinite(mk.p)?(mk.p<.05?"tendência estatisticamente detectável (α=0,05)":"sem tendência significativa a 5%"):"teste não disponível";
    $("senSlope").textContent=Number.isFinite(sen)?((sen*10)>0?"+":"")+fmt(sen*10,1)+" mm":"—";
    $("cvValue").textContent=Number.isFinite(cv)?fmt(cv,1)+"%":"—";
    $("extremeCount").textContent=vals.filter(v=>v>p90).length+" / "+vals.filter(v=>v<p10).length;
    if(advChart)advChart.destroy();
    advChart=new Chart($("advancedChart"),{type:"line",data:{labels:series.map(x=>x.ano),datasets:[
      {label:"Observado",data:series.map(x=>x.chuva),borderColor:"#79bfff",backgroundColor:"rgba(121,191,255,.08)",pointRadius:2,borderWidth:2,tension:.18},
      {label:"Tendência",data:lr.pred||[],borderColor:"#ffd166",pointRadius:0,borderDash:[6,5],borderWidth:2}
    ]},options:{...chartOpts("mm"),plugins:{legend:{display:true,labels:{color:"#dce7e1"}}}}});
  }

  function renderAll(){
    renderHero(); fillMunicipios(); renderMap(); renderRanking(); renderHighlights(); renderStateChart(); renderMunicipio(); renderAdvanced();
    $("updatedAt").textContent="Série histórica 1996–2025 + atualizações publicadas no banco.";
  }

  function showTab(id){
    document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===id));
    document.querySelectorAll(".section").forEach(s=>s.classList.toggle("active",s.id===id));
    if(id==="overview"&&map)setTimeout(()=>map.invalidateSize(),100);
  }

  function downloadCurrent(){
    const rows=currentStats().map(r=>({ano:r.ano,mes:r.mes,CD_MUN:r.cd_mun,NM_MUN:r.nm_mun,chuva_mm:r.chuva_mm,media_hist_mm:r.media,anomalia_mm:r.anom,anomalia_pct:r.anomPct,ranking:r.rank,percentil:r.percentil,status:r.status,versao:r.versao}));
    const csv=Papa.unparse(rows), blob=new Blob([csv],{type:"text/csv;charset=utf-8"}), a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="CHUVA_MT_"+selectedYear+"_"+String(selectedMonth).padStart(2,"0")+".csv";a.click();URL.revokeObjectURL(a.href);
  }

  async function init(){
    try{
      setLoading("Lendo a série histórica municipal…");
      const [csvText,geo,dyn] = await Promise.all([
        fetch("data/historico.csv",{cache:"force-cache"}).then(r=>{if(!r.ok)throw new Error("Histórico não encontrado");return r.text();}),
        fetch("data/municipios_mt.geojson",{cache:"force-cache"}).then(r=>r.json()),
        sb.from("chuva_mt_observacoes").select("produto,versao,status,ano,mes,cd_mun,nm_mun,area_km2,chuva_mm,fonte,arquivo_origem").gte("ano",2026).limit(10000)
      ]);
      setLoading("Organizando municípios e períodos…");
      historical=Papa.parse(csvText,{header:true,skipEmptyLines:true}).data.map(normHist).filter(r=>Number.isFinite(r.chuva_mm));
      geojson=geo; dynamic=(dyn.data||[]).map(normDyn); combineRows(); fillPeriods(); fillMunicipios(); renderAll(); stopLoading();
    }catch(e){ console.error(e);$("loadingText").textContent="Não foi possível carregar o painel: "+e.message; }
  }

  document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.tab)));
  $("periodSelect").addEventListener("change",e=>{const [y,m]=e.target.value.split("-").map(Number);selectedYear=y;selectedMonth=m;renderAll();});
  $("rankMode").addEventListener("change",renderRanking);
  $("municipioSelect").addEventListener("change",e=>{selectedMun=e.target.value;renderMunicipio();});
  $("advancedScope").addEventListener("change",renderAdvanced);
  $("downloadBtn").addEventListener("click",downloadCurrent);
  init();
})();