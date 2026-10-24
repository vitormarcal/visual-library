const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
export function semanticReport(results, metrics) {
  const byId = new Map(results.images.map(image => [image.id, image]))
  const card = (id, queryId, judge = false) => {
    const image = byId.get(id)
    return `<figure><img loading="lazy" src="thumbs/${escape(image.sha256)}.webp" alt="${escape(image.originalName ?? 'Imagem salva')}"><figcaption>${escape(image.originalName ?? 'Imagem salva')}${judge ? `<label>Relevância <select data-query="${escape(queryId)}" data-image="${escape(id)}"><option value="">Não avaliada</option><option value="0">0 · Irrelevante</option><option value="1">1 · Parcial</option><option value="2">2 · Relevante</option></select></label>` : ''}</figcaption></figure>`
  }
  const base = { version: 1, fingerprint: results.fingerprint, datasetHash: results.datasetHash, queriesHash: results.queriesHash, grades: {} }
  const safeJson = JSON.stringify(base).replaceAll('<', '\\u003c')
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Avaliação semântica privada</title>
<style>body{font:16px system-ui;margin:24px;background:#fafafa;color:#222}h1{font-size:28px}h2{margin-top:40px}.compare{display:grid;grid-template-columns:1fr 1fr;gap:20px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}figure{margin:0;min-width:0;background:white;border-radius:12px;overflow:hidden}img{width:100%;height:160px;object-fit:contain}figcaption{padding:8px;font-size:12px;overflow-wrap:anywhere}label,select{display:block;width:100%;margin-top:8px}button{min-height:44px;padding:8px 16px}summary{padding:16px;cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:750px){.compare{grid-template-columns:1fr}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>
<h1>Busca por conteúdo · experimento privado</h1><p>Somente esta amostra fixa. O ranking semântico não é confiança. Nada foi integrado à aplicação.</p><p>Revisar todos os candidatos de uma consulta permite medir qualidade. Sem julgamentos completos, não há aprovação nem nDCG/Recall conclusivos. Resultados irrelevantes também precisam receber nota 0.</p><button id="export">Exportar julgamentos JSON</button> <label>Retomar julgamentos <input id="import" type="file" accept="application/json,.json"></label><p id="import-status" role="status"></p><p id="progress" role="status"></p>
${results.queries.map(query => `<section><h2>${escape(query.text)}</h2><p>${escape(query.language)} · ${escape(query.source)} · ${escape(query.tags?.join(', ') || 'sem filtros')}</p><div class="compare"><div><h3>Busca lexical atual</h3><div class="grid">${query.lexical.length ? query.lexical.slice(0,10).map(item => card(item.id,query.id)).join('') : '<p>Sem correspondências em nome/tags.</p>'}</div></div><div><h3>Busca semântica · top 10</h3><div class="grid">${query.semantic.slice(0,10).map(item => card(item.id,query.id)).join('')}</div></div></div><details><summary>Avaliar todos os ${query.candidates.length} candidatos desta consulta</summary><div class="grid">${query.candidates.map(id => card(id,query.id,true)).join('')}</div></details></section>`).join('')}
<details><summary>Medições e rastreabilidade</summary><pre>${escape(JSON.stringify(metrics,null,2))}</pre></details>
<script>
const result=${safeJson};
const selects=[...document.querySelectorAll('select')];
function collect(){
  result.grades=Object.create(null);let count=0;
  for(const s of selects){if(s.value==='')continue;(result.grades[s.dataset.query]??=Object.create(null))[s.dataset.image]=Number(s.value);count++}
  document.getElementById('progress').textContent=count+' de '+selects.length+' julgamentos preenchidos.';return result;
}
document.addEventListener('change',collect);
document.getElementById('export').onclick=()=>{
  const blob=new Blob([JSON.stringify(collect(),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='judgments.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
document.getElementById('import').onchange=async event=>{
  const status=document.getElementById('import-status');
  try{
    const file=event.target.files[0];if(!file)return;if(file.size>2000000)throw new Error();
    const saved=JSON.parse(await file.text());
    if(saved.version!==1||['fingerprint','datasetHash','queriesHash'].some(key=>saved[key]!==result[key]))throw new Error();
    const restored=selects.map(s=>saved.grades?.[s.dataset.query]?.[s.dataset.image]);
    if(restored.some(value=>value!==undefined&&![0,1,2].includes(value)))throw new Error();
    selects.forEach((s,i)=>{s.value=restored[i]===undefined?'':String(restored[i])});collect();status.textContent='Julgamentos retomados.';
  }catch{status.textContent='Não foi possível retomar: confira se o arquivo pertence a este experimento.'}
};
collect();
</script></html>`
}
