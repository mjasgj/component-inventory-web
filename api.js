import {normalizeSnapshot} from './domain.js';
export class GitHubInventory {
  #token;
  constructor(repository,token) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error('仓库格式应为 用户名/仓库名。');
    this.repository=repository; this.#token=token;
  }
  disconnect() { this.#token=''; }
  async request(path,{method='GET',body,raw=false}={}) {
    const response=await fetch(`https://api.github.com${path}`,{method,headers:{Authorization:`Bearer ${this.#token}`,Accept:raw?'application/vnd.github.raw+json':'application/vnd.github+json','Content-Type':'application/json'},body:body ? JSON.stringify(body):undefined,credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(20000)});
    if (!response.ok) {
      const errors={401:'令牌无效或已过期，请重新连接。',403:'权限或API用量不足，请检查令牌的仓库权限与GitHub用量。',404:'没有找到库存数据，请确认仓库名称及令牌的访问范围。',422:'GitHub没有接受此单据，请稍后查看仓库中的处理情况。'};
      const error=new Error(errors[response.status] || `GitHub请求失败（${response.status}）。`); error.status=response.status; throw error;
    }
    return raw ? response.text() : response.json();
  }
  async snapshot() {
    let metadata;
    try { metadata=await this.request(`/repos/${this.repository}/contents/reports/${encodeURIComponent('网页数据.json')}`); }
    catch (error) {
      if (error.status!==404) throw error;
      metadata=await this.request(`/repos/${this.repository}/contents/reports/${encodeURIComponent('完整导出.json')}`);
    }
    let text;
    if (metadata.content && metadata.encoding==='base64') {
      text=new TextDecoder().decode(Uint8Array.from(atob(metadata.content.replace(/\s/g,'')),c=>c.charCodeAt(0)));
    } else { text=await this.request(`/repos/${this.repository}/git/blobs/${metadata.sha}`,{raw:true}); }
    const snapshot=normalizeSnapshot(JSON.parse(text));
    snapshot.generated_at ??= snapshot.exported_at;
    return snapshot;
  }
  user() { return this.request('/user'); }
  submit(title,body) { return this.request(`/repos/${this.repository}/issues`,{method:'POST',body:{title,body}}); }
  async receipt(number) {
    for (let page=1;;page++) {
      const comments=await this.request(`/repos/${this.repository}/issues/${number}/comments?per_page=100&page=${page}`);
      const receipt=comments.find(c=>c.user?.type==='Bot' && c.body?.startsWith('<!-- component-inventory-receipt-v1 -->'));
      if (receipt) return receipt.body.replace('<!-- component-inventory-receipt-v1 -->','').trim();
      if (comments.length<100) return null;
    }
  }
}
