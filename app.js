import {matchingParts,balanceAfter,issueBody,demoData} from './domain.js';
import {GitHubInventory} from './api.js';
const $=selector=>document.querySelector(selector);
const state={data:demoData(),api:null,user:null,view:'stock',kind:'入库',selected:null,tasks:[],busy:false};
let toastTimer;
const number=new Intl.NumberFormat('zh-CN');
function date(value) { return value ? new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'—'; }
function element(tag,text,className) { const node=document.createElement(tag); if (text!==undefined) node.textContent=text; if(className) node.className=className; return node; }
function button(text,action,className='') { const b=element('button',text,className); b.type='button'; b.addEventListener('click',action); return b; }
function toast(text) { $('#toast').textContent=text; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,6000); }
function visibleParts(query=$('#search').value) { return matchingParts(state.data.parts,query,$('#category').value,$('#only-stock').checked,!state.api || $('#show-tests').checked); }
function render() {
  const parts=matchingParts(state.data.parts,'','',false,!state.api || $('#show-tests').checked);
  $('#metric-parts').textContent=number.format(parts.length);
  $('#metric-stock').textContent=number.format(parts.reduce((n,p)=>n+p.quantity,0));
  $('#metric-empty').textContent=number.format(parts.filter(p=>p.quantity===0).length);
  const skus=new Set(parts.map(p=>p.sku));
  $('#metric-moves').textContent=number.format(state.data.movements.filter(m=>skus.has(m.sku)).length);
  const categories=[...new Set(state.data.parts.map(p=>p.category).filter(Boolean))].sort();
  const selectedCategory=$('#category').value;
  $('#category').replaceChildren(new Option('全部分类',''),...categories.map(c=>new Option(c,c)));
  $('#category').value=categories.includes(selectedCategory)?selectedCategory:'';
  const live=Boolean(state.api);
  $('#mode-tag').textContent=live?'私有库存已连接':'演示预览'; $('#mode-tag').classList.toggle('live',live);
  $('#notice').textContent=live?'已连接你的私有 GitHub 库存。出入库提交后由云端记账，确认入账后同步列表。':'当前展示演示数据，不代表实际购买或库存。连接 GitHub 后查看你的真实数据。'; $('#notice').classList.toggle('live',live);
  $('#connection-label').replaceChildren(document.createTextNode(live?state.user:'连接私有库存'),element('small',live?'已连接 · 点击管理':'首次使用，连接 GitHub'));
  $('#mode-tag').tabIndex=0; $('#mode-tag').setAttribute('role','button'); $('#mode-tag').setAttribute('aria-label',live?'管理库存连接':'连接私有库存');
  $('#sync-note').textContent=live?`最近同步：${date(state.data.generated_at)}（北京）`:'演示数据 · 仅供体验';
  $('#page-title').textContent=state.view==='stock'?'器件库存':'出入库流水'; $('#section-title').textContent=state.view==='stock'?'全部器件':'操作记录';
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));
  renderTable();
}
function renderTable() {
  const parts=visibleParts(); $('#table-body').replaceChildren(); $('#table-head').replaceChildren();
  const headers=state.view==='stock'?['器件型号','分类','封装','库存数量','存放位置','操作']:['器件型号','数量变化','提交账号 / 经手人','发生时间（北京）','用途 / 来源'];
  const head=element('tr'); headers.forEach(t=>head.append(element('th',t))); $('#table-head').append(head);
  if(state.view==='stock') {
    parts.forEach(p=>{
      const tr=element('tr'); const titleCell=element('td');
      const title=button(p.model,()=>showDetail(p),'model-button'); title.append(element('small',p.manufacturer || '厂家未填写')); titleCell.append(title); tr.append(titleCell);
      const cat=element('td'); cat.append(element('span',p.category || '未分类','category-tag')); tr.append(cat,element('td',p.package || '—'),element('td',number.format(p.quantity),'qty'+(p.quantity?'':' zero')),element('td',p.location || '—'));
      const actions=element('td'); const group=element('div',undefined,'row-actions'); group.append(button('入库',()=>openOperation('入库',p)),button('出库',()=>openOperation('出库',p)),button('详情',()=>showDetail(p))); actions.append(group); tr.append(actions); $('#table-body').append(tr);
    });
  } else {
    const map=new Map(parts.map(p=>[p.sku,p]));
    [...state.data.movements].reverse().filter(m=>map.has(m.sku)).forEach(m=>{
      const tr=element('tr'); tr.append(element('td',map.get(m.sku).model),element('td',(m.delta>0?'+':'')+m.delta,'qty'),element('td',[m.actor,m.handler].filter(Boolean).join(' / ')),element('td',date(m.occurred_at)),element('td',m.source || '—')); $('#table-body').append(tr);
    });
  }
  const count=$('#table-body').children.length; $('#empty').hidden=count>0; $('#row-count').textContent=`共 ${count} ${state.view==='stock'?'种器件':'条记录'}`;
}
function openOperation(kind,part=null) {
  state.kind=kind; state.selected=part; const register=kind==='器件建档';
  $('#operation-form').reset(); $('#extra-fields').open=false; $('#operation-error').textContent=''; $('#submit-operation').disabled=false;
  $('#operation-title').textContent=register?'新建器件':kind; $('#operation-subtitle').textContent=state.api?'直接记录，云端留痕':'演示操作 · 不会修改真实库存';
  $('#submit-operation').textContent=(state.api?'确认':'演示')+(register?'建档':kind);
  $('#picker-field').hidden=register; $('#model-field').hidden=!register; $('#model').required=register;
  $('#quantity-field').hidden=register; $('#quantity').required=!register; $('#purpose-field').hidden=register;
  document.querySelectorAll('[data-register]').forEach(n=>n.hidden=!register); document.querySelectorAll('[data-movement]').forEach(n=>n.hidden=register); $('#price-field').hidden=register || kind==='出库';
  $('#suggestions').hidden=true; $('#part-search').value=part?.model || ''; renderSelection();
  $('#operation-dialog').showModal(); (register?$('#model'):part?$('#quantity'):$('#part-search')).focus();
}
function renderSelection() {
  const p=state.selected;
  $('#selected-part').hidden=!p;
  $('#selected-part').textContent=p?`${p.model} · ${p.package || '封装未填'} · ${p.location || '位置未填'} · 当前 ${p.quantity} 件`:'';
  updateBalance();
}
function updateBalance() {
  const box=$('#balance-preview'); box.classList.remove('invalid'); box.replaceChildren();
  if(!state.selected) { box.textContent='请选择器件'; return; }
  try { const next=balanceAfter(state.selected,state.kind,$('#quantity').value); box.append(element('div',`当前 ${state.selected.quantity} 件`),element('strong',`${state.kind}后 ${next} 件`)); }
  catch(error) { box.textContent=error.message; box.classList.add('invalid'); }
}
function suggestions() {
  const list=$('#suggestions'); list.replaceChildren();
  const parts=matchingParts(state.data.parts,$('#part-search').value,'',false,!state.api || $('#show-tests').checked);
  if(!parts.length) list.append(element('div','没有匹配器件，可以先新建器件档案。','no-match'));
  parts.slice(0,30).forEach(p=>{
    const option=button(p.model,()=>{state.selected=p; $('#part-search').value=p.model; list.hidden=true; $('#part-search').setAttribute('aria-expanded','false'); renderSelection(); $('#quantity').focus();});
    option.setAttribute('role','option'); option.setAttribute('aria-selected',String(state.selected?.sku===p.sku)); option.append(element('small',`${p.package || '封装未填'} · ${p.manufacturer || '厂家未填'} · ${p.location || '位置未填'} · 库存 ${p.quantity}`)); list.append(option);
  });
  list.hidden=false; $('#part-search').setAttribute('aria-expanded','true');
}
function showDetail(part) {
  $('#detail-title').textContent=part.model; const content=$('#detail-content'); content.replaceChildren();
  const grid=element('dl',undefined,'detail-grid');
  for(const [label,value] of [['当前库存',`${part.quantity} 件`],['封装',part.package],['厂家',part.manufacturer],['分类',part.category],['存放位置',part.location],['尺寸（mm）',part.dimensions],['备注',part.notes]]) { const group=element('div'); group.append(element('dt',label),element('dd',value || '未填写')); grid.append(group); }
  content.append(grid); const table=element('table',undefined,'detail-ledger'); table.append(element('caption','最近的出入库记录')); const head=element('tr'); ['数量','提交账号 / 经手人','时间（北京）'].forEach(t=>head.append(element('th',t))); table.append(head);
  const moves=[...state.data.movements].reverse().filter(m=>m.sku===part.sku).slice(0,20);
  for(const m of moves) { const row=element('tr'); row.append(element('td',(m.delta>0?'+':'')+m.delta),element('td',[m.actor,m.handler].filter(Boolean).join(' / ')),element('td',date(m.occurred_at))); table.append(row); }
  content.append(moves.length?table:element('p','还没有出入库记录。','muted'));
  $('#detail-actions').replaceChildren(button('入库',()=>{$('#detail-dialog').close();openOperation('入库',part);},'button primary'),button('出库',()=>{$('#detail-dialog').close();openOperation('出库',part);},'button secondary'));
  $('#detail-dialog').showModal();
}
function renderTasks() {
  $('#tasks').hidden=!state.tasks.length; $('#task-list').replaceChildren();
  for(const task of [...state.tasks].reverse()) {
    const row=element('div',undefined,'task-row'); const text=element('div'); text.append(element('span',task.title),element('small',task.message,task.status)); row.append(text);
    if(task.number) { const link=element('a',`查看单据 #${task.number} ↗`,'text-link'); link.href=`https://github.com/${task.repository}/issues/${task.number}`; link.target='_blank'; link.rel='noopener noreferrer'; row.append(link); }
    $('#task-list').append(row);
  }
}
async function refresh(silent=false) {
  if(!state.api) { if(!silent) toast('正在预览演示数据；点击“演示预览”可连接真实库存。'); return; }
  const api=state.api; $('#refresh').disabled=true;
  try { const data=await api.snapshot(); if(api!==state.api)return; state.data=data; render(); if(!silent) toast('已获取最新库存快照。'); }
  finally { $('#refresh').disabled=false; }
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function followTask(task,api) {
  // A short bounded follow-up; unknown outcomes remain pending, never shown as failures.
  for(let attempt=0;attempt<8 && state.api===api;attempt++) {
    await delay(5000);
    try {
      const receipt=await api.receipt(task.number);
      if(receipt) {
        task.status=receipt.startsWith('未入账')?'rejected':'accepted'; task.message=receipt.split('\n')[0]; renderTasks();
        if(task.status==='accepted') {
          for(let i=0;i<5 && state.api===api;i++) {
            await refresh(true); const synced=task.kind==='器件建档'?state.data.parts.some(p=>p.issue_number===task.number):state.data.movements.some(m=>m.issue_number===task.number);
            if(synced) { toast('已入账，库存列表已同步。'); return; } await delay(4000);
          }
          toast('已入账。报表仍在同步，可稍后点击刷新。');
        }
        return;
      }
    } catch { /* brief network errors do not cause automatic resubmission */ }
  }
  if(state.api===api) { task.message='仍在等待云端结果，请查看原单据，勿重复提交。'; renderTasks(); }
}
$('#operation-form').addEventListener('submit',async event=>{
  event.preventDefault(); if(state.busy)return; $('#operation-error').textContent='';
  const values=Object.fromEntries(new FormData(event.currentTarget));
  try {
    const body=issueBody(state.kind,state.selected,values);
    if(!state.api) {
      if(state.kind==='器件建档') state.data.parts.push({sku:crypto.randomUUID(),model:values.model.trim(),manufacturer:values.manufacturer || '',category:values.category || '',package:values.package || '',location:values.location || '',dimensions:values.dimensions || '',notes:values.notes || '',quantity:0});
      else { const p=state.data.parts.find(p=>p.sku===state.selected.sku); const delta=state.kind==='出库'?-Number(values.quantity):Number(values.quantity); p.quantity+=delta; state.data.movements.push({sku:p.sku,delta,actor:'演示账号',handler:values.handler,occurred_at:new Date().toISOString(),source:values.purpose}); }
      $('#operation-dialog').close();render();toast('演示完成，未修改任何真实库存。');return;
    }
    state.busy=true; $('#submit-operation').disabled=true;
    const api=state.api; const kind=state.kind; const model=kind==='器件建档'?values.model.trim():state.selected.model;
    let issue;
    try { issue=await api.submit(`[库存] ${kind}：${model}`,body); }
    catch(error) { $('#operation-error').textContent=error.status?error.message:'网络中断，提交结果暂不确定。请先到 GitHub 查看是否已生成单据，避免重复提交。'; return; }
    const task={title:`${kind} · ${model}${kind==='器件建档'?'':` × ${values.quantity}`}`,kind,number:issue.number,repository:api.repository,status:'pending',message:'单据已提交，等待云端记账。'};
    state.tasks.push(task); renderTasks(); $('#operation-dialog').close(); toast('已提交，等待确认入账；库存暂不预扣。'); void followTask(task,api);
  } catch(error) { $('#operation-error').textContent=error.message; }
  finally { state.busy=false; $('#submit-operation').disabled=false; }
});
function openConnection() { $('#connect-error').textContent=''; $('#connect-dialog').showModal(); }
$('#connect-form').addEventListener('submit',async event=>{
  event.preventDefault(); $('#connect-error').textContent='';$('#connect-submit').disabled=true;
  let api;
  try {
    api=new GitHubInventory($('#repository').value.trim(),$('#token').value.trim()); $('#token').value='';
    const [user,data]=await Promise.all([api.user(),api.snapshot()]); state.api?.disconnect(); state.api=api; state.user=user.login;state.data=data;state.tasks=[];state.selected=null;
    try { localStorage.setItem('inventory-repository',api.repository); } catch { /* Storage is optional; never persist the token. */ }
    $('#connect-dialog').close();renderTasks();render();toast('已连接你的私有库存。');
  } catch(error) { api?.disconnect(); $('#connect-error').textContent=error.message; }
  finally { $('#connect-submit').disabled=false; }
});
$('#disconnect').addEventListener('click',()=>{state.api?.disconnect();state.api=null;state.user=null;state.data=demoData();state.tasks=[];$('#token').value='';$('#connect-dialog').close();renderTasks();render();toast('已断开连接，当前为演示数据。');});
$('#connection-button').addEventListener('click',openConnection); $('#mode-tag').addEventListener('click',openConnection); $('#mode-tag').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openConnection();}});
$('#refresh').addEventListener('click',()=>refresh().catch(error=>toast(error.message)));
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$('#'+b.dataset.close).close()));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.view;render();}));
$('#new-part').addEventListener('click',()=>openOperation('器件建档'));$('#empty-register').addEventListener('click',()=>openOperation('器件建档'));$('#new-inbound').addEventListener('click',()=>openOperation('入库'));$('#new-outbound').addEventListener('click',()=>openOperation('出库'));
$('#search').addEventListener('input',renderTable);$('#category').addEventListener('change',renderTable);$('#only-stock').addEventListener('change',renderTable);$('#show-tests').addEventListener('change',render);
$('#part-search').addEventListener('input',()=>{state.selected=null;renderSelection();suggestions();});$('#part-search').addEventListener('focus',suggestions);
$('#part-search').addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'){event.preventDefault();$('#suggestions button')?.focus();}
  if(event.key==='Escape'){$('#suggestions').hidden=true;$('#part-search').setAttribute('aria-expanded','false');event.preventDefault();event.stopPropagation();}
  if(event.key==='Enter'){event.preventDefault();if($('#suggestions').querySelectorAll('button').length===1)$('#suggestions button').click();}
});
$('#suggestions').addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();const next=event.key==='ArrowDown'?document.activeElement.nextElementSibling:document.activeElement.previousElementSibling;next?.focus();}});
$('#quantity').addEventListener('input',updateBalance);$('#minus').addEventListener('click',()=>{$('#quantity').value=Math.max(1,Number($('#quantity').value)-1);updateBalance();});$('#plus').addEventListener('click',()=>{$('#quantity').value=Math.min(1000000000,Number($('#quantity').value)+1);updateBalance();});
$('#export-button').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({mode:state.api?'private-inventory':'demo-only',...state.data},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=element('a');a.href=url;a.download=`${state.api?'库存导出':'演示数据'}-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
const hashRepo=new URLSearchParams(location.hash.slice(1)).get('repo');
try { $('#repository').value=hashRepo || localStorage.getItem('inventory-repository') || ''; } catch { $('#repository').value=hashRepo || ''; }
render();
