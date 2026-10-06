(() => {
  const C=window.CHUVA_MT_CONFIG, sb=window.supabase.createClient(C.supabaseUrl,C.supabaseKey), $=id=>document.getElementById(id);
  let selectedFile=null, geojson=null, munMeta=new Map(), results=[];
  const log=s=>{ $("log").textContent += (new Date().toLocaleTimeString("pt-BR")+"  "+s+"\n"); $("log").scrollTop=$("log").scrollHeight; };
  const msg=(id,text,show=true)=>{ const e=$(id);e.textContent=text;e.classList.toggle("hidden",!show); };
  const pct=n=>Math.max(0,Math.min(100,n));
  function progress(v,stage){ $("progressBar").style.width=pct(v)+"%";$("counter").textContent=Math.round(pct(v))+"%";if(stage)$("stage").textContent=stage; }

  async function bootstrap(){
    const {data:{session}}=await sb.auth.getSession();
    if(session) showUploader(); else showLogin();
    sb.auth.onAuthStateChange((_e,s)=>s?showUploader():showLogin());
  }
  function showLogin(){ $("loginBox").classList.remove("hidden");$("uploadBox").classList.add("hidden"); }
  async function showUploader(){
    $("loginBox").classList.add("hidden");$("uploadBox").classList.remove("hidden");
    if(!geojson){
      const [g,h]=await Promise.all([fetch("data/municipios_mt.geojson").then(r=>r.json()),fetch("data/historico.csv").then(r=>r.text())]);
      geojson=g;
      const rows=Papa.parse(h,{header:true,skipEmptyLines:true}).data;
      rows.forEach(r=>{const code=String(r.CD_MUN||"");if(code&&!munMeta.has(code))munMeta.set(code,{name:r.NM_MUN,area:+r.AREA_KM2});});
      log("Malha municipal e metadados carregados: "+geojson.features.length+" municípios.");
    }
  }
  async function login(){
    msg("loginMsg","",false);
    const email=$("email").value.trim(), password=$("password").value;
    if(!email||!password){msg("loginMsg","Informe e-mail e senha.");return;}
    $("loginBtn").disabled=true;
    const {error}=await sb.auth.signInWithPassword({email,password});
    $("loginBtn").disabled=false;
    if(error)msg("loginMsg","Não foi possível entrar: "+error.message);
  }
  async function magic(){
    const email=$("email").value.trim();if(!email){msg("loginMsg","Informe seu e-mail primeiro.");return;}
    const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.href,shouldCreateUser:false}});
    msg("loginMsg",error?"Falha ao enviar: "+error.message:"Link enviado. Abra o e-mail neste mesmo navegador.");
  }

  function inferMeta(file){
    selectedFile=file;$("filename").value=file.name;
    const ym=[...file.name.matchAll(/(20\d{2})[._-](0?[1-9]|1[0-2])/g)].pop();
    if(ym){$("year").value=ym[1];$("month").value=+ym[2];}
    const ver=file.name.match(/v(\d+(?:\.\d+)?)/i);if(ver)$("version").value="v"+ver[1];
    $("product").value=/chirps/i.test(file.name)?"CHIRPS":"SATÉLITE";
    $("status").value=/final/i.test(file.name)?"final":"preliminar";
    $("metaBox").classList.remove("hidden");$("workBox").classList.add("hidden");$("previewBox").classList.add("hidden");
  }

  function geometryBBox(g){
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    const walk=a=>{if(typeof a[0]==="number"){const [x,y]=a;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}else a.forEach(walk);};walk(g.coordinates);
    return [minX,minY,maxX,maxY];
  }
  function inRing(x,y,ring){
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];
      if(((yi>y)!=(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi)+xi)) inside=!inside;
    }
    return inside;
  }
  function inGeom(x,y,g){
    const polys=g.type==="Polygon"?[g.coordinates]:g.type==="MultiPolygon"?g.coordinates:[];
    for(const poly of polys){if(!poly.length)continue;if(inRing(x,y,poly[0])){let hole=false;for(let h=1;h<poly.length;h++)if(inRing(x,y,poly[h])){hole=true;break;}if(!hole)return true;}}
    return false;
  }

  async function zonalMean(image,feature,rasterBBox,width,height,nodata){
    const [rMinX,rMinY,rMaxX,rMaxY]=rasterBBox,[minX,minY,maxX,maxY]=geometryBBox(feature.geometry);
    const px=(rMaxX-rMinX)/width, py=(rMaxY-rMinY)/height;
    const c0=Math.max(0,Math.floor((minX-rMinX)/px)), c1=Math.min(width,Math.ceil((maxX-rMinX)/px));
    const r0=Math.max(0,Math.floor((rMaxY-maxY)/py)), r1=Math.min(height,Math.ceil((rMaxY-minY)/py));
    if(c1<=c0||r1<=r0)return {mean:NaN,n:0};
    const rasters=await image.readRasters({window:[c0,r0,c1,r1],samples:[0]});
    const band=rasters[0], localW=c1-c0; let sum=0,n=0;
    const nd=nodata==null?null:Number(nodata);
    for(let rr=0;rr<r1-r0;rr++){
      const lat=rMaxY-(r0+rr+.5)*py;
      for(let cc=0;cc<c1-c0;cc++){
        const lon=rMinX+(c0+cc+.5)*px;
        if(!inGeom(lon,lat,feature.geometry))continue;
        const v=Number(band[rr*localW+cc]);
        if(!Number.isFinite(v)||(nd!==null&&Math.abs(v-nd)<1e-7)||v<0||v>10000)continue;
        sum+=v;n++;
      }
    }
    return {mean:n?sum/n:NaN,n};
  }

  async function processAndPublish(){
    if(!selectedFile)return;
    const year=+$("year").value,month=+$("month").value,product=$("product").value.trim(),version=$("version").value.trim(),status=$("status").value;
    if(!year||month<1||month>12||!product){alert("Confira ano, mês e produto.");return;}
    $("processBtn").disabled=true;$("workBox").classList.remove("hidden");$("previewBox").classList.add("hidden");$("log").textContent="";progress(1,"Abrindo GeoTIFF");log("Arquivo: "+selectedFile.name+" ("+(selectedFile.size/1024/1024).toFixed(1)+" MB)");

    try{
      const tiff=await GeoTIFF.fromArrayBuffer(await selectedFile.arrayBuffer()), image=await tiff.getImage();
      const width=image.getWidth(),height=image.getHeight(),bbox=image.getBoundingBox(),nodata=image.getGDALNoData();
      log("Raster: "+width+" × "+height+" pixels | bbox "+bbox.map(x=>x.toFixed(3)).join(", "));
      progress(5,"Cruzando raster com municípios");
      const features=geojson.features.filter(f=>munMeta.has(String(f.properties.id)));
      results=[];
      for(let i=0;i<features.length;i++){
        const f=features[i],code=String(f.properties.id),meta=munMeta.get(code),z=await zonalMean(image,f,bbox,width,height,nodata);
        if(Number.isFinite(z.mean))results.push({produto:product,versao:version,status,ano:year,mes:month,cd_mun:code,nm_mun:meta.name,area_km2:meta.area,chuva_mm:z.mean,fonte:"Climate Hazards Center / UCSB",arquivo_origem:selectedFile.name});
        if(i%5===0||i===features.length-1){progress(5+75*(i+1)/features.length,"Calculando "+meta.name);await new Promise(r=>setTimeout(r,0));}
      }
      log("Municípios calculados: "+results.length+" de "+features.length+".");
      if(results.length<140)throw new Error("Apenas "+results.length+" municípios tiveram pixels válidos. Não publiquei para evitar uma base incompleta.");

      const sorted=[...results].sort((a,b)=>b.chuva_mm-a.chuva_mm);
      $("previewRows").innerHTML=[...sorted.slice(0,5),...sorted.slice(-5).reverse()].map(r=>"<tr><td>"+r.nm_mun+"</td><td>"+r.chuva_mm.toFixed(1)+" mm</td></tr>").join("");
      $("previewBox").classList.remove("hidden");
      const w=results.reduce((s,r)=>s+r.area_km2,0),state=results.reduce((s,r)=>s+r.chuva_mm*r.area_km2,0)/w;
      log("Média estadual ponderada: "+state.toFixed(1)+" mm.");
      progress(84,"Publicando resultados");

      const {error:upErr}=await sb.from("chuva_mt_observacoes").upsert(results,{onConflict:"produto,status,ano,mes,cd_mun"});
      if(upErr)throw upErr;
      progress(94,"Registrando atualização");
      const {error:logErr}=await sb.from("chuva_mt_uploads").insert({arquivo:selectedFile.name,produto:product,versao:version,status,ano:year,mes:month,tamanho_bytes:selectedFile.size,n_municipios:results.length});
      if(logErr)throw logErr;
      progress(100,"Publicado");
      log("PUBLICADO. O painel público já pode ler o novo período.");
      msg("summary","✓ "+results.length+" municípios publicados • média estadual "+state.toFixed(1)+" mm • "+(status==="preliminar"?"dado preliminar":"dado final"));
      setTimeout(()=>{ if(confirm("Atualização concluída. Abrir o painel público agora?")) location.href="index.html"; },250);
    }catch(e){
      console.error(e);log("ERRO: "+(e.message||e));msg("summary","Não publiquei os dados: "+(e.message||e));progress(0,"Falha no processamento");
    }finally{$("processBtn").disabled=false;}
  }

  $("loginBtn").addEventListener("click",login);$("magicBtn").addEventListener("click",magic);$("logoutBtn").addEventListener("click",()=>sb.auth.signOut());
  $("fileInput").addEventListener("change",e=>e.target.files[0]&&inferMeta(e.target.files[0]));
  const dz=$("dropzone");
  ["dragenter","dragover"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add("drag");}));
  ["dragleave","drop"].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove("drag");}));
  dz.addEventListener("drop",e=>e.dataTransfer.files[0]&&inferMeta(e.dataTransfer.files[0]));
  $("processBtn").addEventListener("click",processAndPublish);
  bootstrap();
})();