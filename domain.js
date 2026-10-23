export const MAX_QUANTITY = 1000000000;
export function matchingParts(parts, text = '', category = '', onlyStock = false, showTests = true) {
  const words = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return parts.filter(p => (showTests || !/^TEST[-_]/i.test(p.sku)) && (!category || p.category === category) && (!onlyStock || p.quantity > 0) && words.every(word => [p.model,p.manufacturer,p.package,p.category,p.location,p.notes].join(' ').toLowerCase().includes(word))).sort((a,b) => a.model.localeCompare(b.model,'zh-CN') || a.package.localeCompare(b.package,'zh-CN'));
}
export function validQuantity(value) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > MAX_QUANTITY) throw new Error('请输入大于0的整数数量。');
  return n;
}
export function balanceAfter(part, kind, value) {
  const n = validQuantity(value);
  const next = part.quantity + (kind === '出库' ? -n : n);
  if (!Number.isSafeInteger(next)) throw new Error('库存数量超出可处理范围。');
  if (next < 0) throw new Error(`库存不足：当前只有 ${part.quantity} 件。`);
  return next;
}
export function issueBody(kind, part, values) {
  const fields = {'操作类别':kind};
  if (kind === '器件建档') {
    if (!values.model?.trim()) throw new Error('请填写器件型号。');
    Object.assign(fields,{'型号':values.model,'厂家':values.manufacturer,'分类':values.category,'封装':values.package,'尺寸（mm）':values.dimensions,'存放位置':values.location});
  } else {
    if (!part) throw new Error('请从候选列表中选择一个器件。');
    balanceAfter(part,kind,values.quantity);
    Object.assign(fields,{'器件编号':part.sku,'数量':String(validQuantity(values.quantity)),'采购来源或用途':values.purpose,'经手人':values.handler,'实际发生时间':(values.occurred || '').replace('T',' ')});
    if (kind === '入库') fields['采购单价（元）'] = values.price;
  }
  fields['备注'] = values.notes;
  return Object.entries(fields).filter(([,v]) => String(v ?? '').trim()).map(([label,value]) => {
    const text = String(value).trim();
    if (/[\r\n]/.test(text) || text.length > 500) throw new Error(`${label}请使用500字以内的单行内容。`);
    return `### ${label}\n\n${text}`;
  }).join('\n\n');
}
export function normalizeSnapshot(data) {
  if (!Array.isArray(data.parts) || !Array.isArray(data.movements)) throw new Error('库存数据格式不正确。');
  const balances = new Map();
  for (const movement of data.movements) balances.set(movement.sku,(balances.get(movement.sku) || 0) + Number(movement.delta));
  const parts = data.parts.map(p => ({...p,quantity: p.quantity ?? balances.get(p.sku) ?? 0}));
  if (parts.some(p => !Number.isSafeInteger(p.quantity) || p.quantity < 0)) throw new Error('库存数量数据异常，请检查数据库。');
  return {...data,parts};
}
export function demoData() {
  return {generated_at:new Date().toISOString(),parts:[
    {sku:'demo-1',model:'AD8332ARUZ',manufacturer:'Analog Devices',category:'放大器',package:'TSSOP-28',location:'A盒 · 第2格',quantity:6,notes:'演示器件，不代表真实购买',dimensions:''},
    {sku:'demo-2',model:'AD9215BRUZ-105',manufacturer:'Analog Devices',category:'ADC / DAC',package:'TSSOP-28',location:'A盒 · 第3格',quantity:2,notes:'演示器件，不代表真实购买',dimensions:''},
    {sku:'demo-3',model:'STM32F103C8T6',manufacturer:'ST',category:'微控制器',package:'LQFP-48',location:'B盒 · 第1格',quantity:12,notes:'演示器件，不代表真实购买',dimensions:''},
    {sku:'demo-4',model:'MP1584EN',manufacturer:'MPS',category:'电源管理',package:'SOIC-8',location:'C盒 · 第5格',quantity:0,notes:'演示器件，不代表真实购买',dimensions:''}
  ],movements:[]};
}
