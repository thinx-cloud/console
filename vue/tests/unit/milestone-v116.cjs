const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const compiler = require('vue-template-compiler');
const Vue = require('vue/dist/vue.runtime.common.js');
Vue.config.productionTip = false; Vue.config.devtools = false; Vue.config.ignoredElements = [/^b-/];
let renderError = null;
Vue.config.errorHandler = err => { renderError = err; };
const root = path.resolve(__dirname, '../../src');
function load(file, extra = {}) {
  const full = path.join(root, file);
  const source = fs.readFileSync(full, 'utf8');
  const sfc = file.endsWith('.vue') ? compiler.parseComponent(source) : null;
  if (sfc) {
    const compiled = compiler.compile(sfc.template.content);
    assert.deepEqual(compiled.errors, [], file + ' template compiles');
  }
  const code = (sfc ? sfc.script.content : source)
    .replace(/^import .*;?$/gm, '')
    .replace(/export default /g, 'module.exports.default = ')
    .replace(/export function (\w+)/g, 'function $1');
  const mod = { exports: {} };
  const deps = { mapGetters: () => ({}), mapActions: () => ({}), mapState: () => ({}), List: {}, BuildLogDialog: {}, Notifications: {}, codemirror: {}, moment: () => ({}), PAGE_SIZE: 100, normPaging: x => x, pagedPath: x => x, parseEnvironmentJSON: () => ({ok:true}), ...extra };
  new Function('module', ...Object.keys(deps), code + '\n' + (file === 'store/buildlog.js' ? 'module.exports.normalizeStatus = normalizeStatus; module.exports.normalizeBuildItems = normalizeBuildItems;' : ''))(mod, ...Object.values(deps));
  return mod.exports.default || mod.exports;
}
const buildlog = load('store/buildlog.js');
const buildSource = fs.readFileSync(path.join(root, 'store/buildlog.js'), 'utf8');
const normalize = new Function('PAGE_SIZE','normPaging','pagedPath', buildSource.replace(/^import .*;$/gm,'').replace('export default','const store =').replace(/export function /g,'function ') + '\nreturn {normalizeStatus, normalizeBuildItems};')(100,x=>x,x=>x);
const NOW = Date.UTC(2026,9,9,12);
assert.equal(normalize.normalizeStatus('created', NOW - 21*60000, NOW), 'TIMEOUT');
assert.equal(normalize.normalizeStatus('started', NOW - 5*60000, NOW), 'RUNNING');
assert.equal(normalize.normalizeStatus('success', NOW - 21*60000, NOW), 'OK');
assert.equal(normalize.normalizeStatus('timed out', NOW, NOW), 'TIMEOUT');
assert.equal(normalize.normalizeStatus('building', 'invalid', NOW), 'RUNNING');
assert.equal(normalize.normalizeStatus('failed', NOW - 21*60000, NOW), 'FAILED');
const flat = normalize.normalizeBuildItems([{build_id:'build-1',udid:'device-1',state:'created',date:NOW}])[0];
assert.equal(flat.build_id, 'build-1');
assert.equal(flat.udid, 'device-1');
assert.deepEqual(normalize.normalizeBuildItems([{_id:'nested', log:[{build_id:'b2',udid:'d2',log:[{message:'output'}]}]}])[0].log, ['output']);
const logModule = {exports:{}};
new Function('module', fs.readFileSync(path.join(root,'utils/buildLog.js'),'utf8').replace('export function','module.exports.buildLogText = function'))(logModule);
const text = logModule.exports.buildLogText;
assert.equal(text({contents:Buffer.from('Český log').toJSON(),log:[{message:'short'}]}),'Český log');
assert.equal(text({log:[{log:[{contents:'full'}, {message:'line'}]}]}),'full\nline');
assert.equal(text({}), '');
assert.equal(text([{message:'retained log'}]), 'retained log');
assert.equal(text('full file contents'), 'full file contents');
const api = load('core/api.js');
const client = Object.create(api.prototype);
assert.deepEqual(client.parseResult({success:true,contents:Buffer.from('log').toJSON(),log:[{message:'hi'}]}).response, {contents:Buffer.from('log').toJSON(),log:[{message:'hi'}]});
assert.deepEqual(client.parseResult({success:true,response:[1],paging:{has_more:true}}),{success:true,response:[1],paging:{has_more:true}});
const profile = load('pages/Profile/Profile.vue');
const preferences = {notifForm:{all:true,important:true,info:true}};
profile.methods.notificationChanged.call(preferences,'important',true);
assert.equal(preferences.notifForm.all,false);
profile.methods.notificationChanged.call(preferences,'all',true);
assert.equal(preferences.notifForm.important,false);
assert.equal(preferences.notifForm.info,false);
const transformers = load('store/transformers.js');
const keys = load('store/rsakeys.js');
const device = load('pages/Devices/DeviceDetail.vue');
const dialog = load('components/BuildLogDialog/BuildLogDialog.vue',{buildLogText:text});
const keyPage = load('pages/Rsakeys/Rsakeys.vue');
load('components/Header/Header.vue'); load('components/Notifications/Notifications.vue');
const history = load('pages/History/History.vue'); load('pages/Transformers/Transformers.vue');
// 35 WR-01: build rows stay table rows; row click ignores inner controls and text selection.
{
  const historySource = fs.readFileSync(path.join(root, 'pages/History/History.vue'), 'utf8');
  const buildRow = (historySource.match(/<tr\b[^>]*data-cy="build-row"[^>]*>/) || [])[0];
  assert.ok(buildRow, 'History has a build row');
  for (const attr of ['role=', 'tabindex=', '@keydown']) assert.ok(!buildRow.includes(attr), 'build row has no ' + attr);
  const opened = [];
  const ctx = { openBuildLog: b => opened.push(b) };
  const target = hit => ({ closest: () => hit });
  const prevWindow = global.window;
  let selected = '';
  global.window = { getSelection: () => selected };
  history.methods.onBuildRowClick.call(ctx, 'b1', { target: target({ tagName: 'BUTTON' }) });
  assert.equal(opened.length, 0, 'click on an inner button does not open the dialog');
  selected = 'selected log text';
  history.methods.onBuildRowClick.call(ctx, 'b1', { target: target(null) });
  assert.equal(opened.length, 0, 'click that ends a text selection does not open the dialog');
  selected = '';
  history.methods.onBuildRowClick.call(ctx, 'b1', { target: target(null) });
  assert.deepEqual(opened, ['b1'], 'click on a plain cell opens the build log');
  global.window = prevWindow;
} load('pages/Transformers/TransformerEditor.vue');
// G-35-4: render the real Linked Repository card with the component's own computed properties.
function renderLinkedRepository(repos, source) {
  const sfc = compiler.parseComponent(fs.readFileSync(path.join(root, 'pages/Devices/DeviceDetail.vue'), 'utf8'));
  const card = (sfc.template.content.match(/<b-card\b[^>]*title="Linked Repository"[^>]*>[\s\S]*?<\/b-card>/) || [])[0];
  assert.ok(card, 'DeviceDetail.vue has a Linked Repository card');
  const compiled = compiler.compileToFunctions(card);
  const computed = {};
  for (const name of ['linkedRepository', 'linkedRepositoryHref']) if (typeof device.computed[name] === 'function') computed[name] = device.computed[name];
  renderError = null;
  const vm = new Vue({ render: compiled.render, staticRenderFns: compiled.staticRenderFns, data: () => ({ device: { source } }), computed, methods: { getRepositories: () => repos } });
  const vnode = vm._render();
  assert.equal(renderError, null, 'Linked Repository card renders without error');
  const anchors = [], hrefs = [], text = [];
  (function walk(node) {
    if (!node) return;
    const attrs = node.data && node.data.attrs;
    if (node.tag === 'a') anchors.push(attrs || {});
    if (attrs && Object.prototype.hasOwnProperty.call(attrs, 'href')) hrefs.push(node);
    if (!node.tag && node.text) text.push(node.text);
    (node.children || []).forEach(walk);
  })(vnode);
  return { anchors, hrefs, text: text.join(' ').replace(/\s+/g, ' ').trim() };
}
const httpsCard = renderLinkedRepository([{ id: 'r1', alias: 'Firmware repo', url: 'https://github.com/org/repo.git' }], 'r1');
assert.equal(httpsCard.anchors.length, 1, 'https repository URL renders exactly one link');
assert.equal(httpsCard.anchors[0].href, 'https://github.com/org/repo.git', 'https repository link points at the parsed URL');
assert.equal(httpsCard.anchors[0].target, '_blank', 'https repository link opens a new tab');
assert.equal(httpsCard.anchors[0].rel, 'noopener noreferrer', 'https repository link drops opener and referrer');
assert.ok(httpsCard.text.includes('Firmware repo') && httpsCard.text.includes('https://github.com/org/repo.git'), 'https card shows alias and URL');
const scriptCard = renderLinkedRepository([{ id: 'r1', alias: 'Bad repo', url: 'javascript:alert(document.domain)' }], 'r1');
assert.equal(scriptCard.anchors.length, 0, 'javascript: repository URL renders no link');
assert.equal(scriptCard.hrefs.length, 0, 'javascript: repository URL renders no href');
assert.ok(scriptCard.text.includes('javascript:alert(document.domain)'), 'javascript: repository URL stays visible as text');
const sshCard = renderLinkedRepository([{ id: 'r1', alias: 'SSH repo', url: 'git@github.com:org/repo.git' }], 'r1');
assert.equal(sshCard.anchors.length, 0, 'git@ SSH remote renders no link');
assert.equal(sshCard.hrefs.length, 0, 'git@ SSH remote renders no href');
assert.ok(sshCard.text.includes('git@github.com:org/repo.git'), 'git@ SSH remote stays visible as text');
const hrefFor = url => device.computed.linkedRepositoryHref.call({ linkedRepository: { url } });
for (const [input, expected] of [
  ['http://example.com/repo.git', 'http://example.com/repo.git'],
  ['HTTPS://GitHub.com/org/repo.git', 'https://github.com/org/repo.git'],
  ['  https://github.com/org/repo.git  ', 'https://github.com/org/repo.git'],
  ['JavaScript:alert(1)', null],
  [' javascript:alert(1)', null],
  ['data:text/html,<script>alert(1)</script>', null],
  ['ssh://git@github.com/org/repo.git', null],
  ['file:///etc/passwd', null],
  ['git@github.com:org/repo.git', null],
  ['github.com/org/repo', null],
  ['', null],
  [undefined, null],
  [null, null],
]) assert.equal(hrefFor(input), expected, 'linkedRepositoryHref(' + JSON.stringify(input) + ')');
assert.equal(device.computed.linkedRepositoryHref.call({ linkedRepository: null }), null, 'linkedRepositoryHref with no linked repository');
const missingCard = renderLinkedRepository([{ id: 'other', alias: 'Other', url: 'https://github.com/org/other.git' }], 'r1');
assert.ok(missingCard.text.includes('Repository unavailable'), 'unmatched source shows Repository unavailable');
assert.equal(missingCard.anchors.length + missingCard.hrefs.length, 0, 'unmatched source renders no link and no href');
const sshUrlCard = renderLinkedRepository([{ id: 'r1', alias: 'SSH URL repo', url: 'ssh://git@github.com/org/repo.git' }], 'r1');
assert.equal(sshUrlCard.anchors.length, 0, 'ssh:// repository URL renders no link');
assert.ok(sshUrlCard.text.includes('ssh://git@github.com/org/repo.git'), 'ssh:// repository URL stays visible as text');
(async () => {
  let posted;
  await transformers.actions.saveTransformers.call({$api:{$post:async (url,body)=>{posted={url,body:JSON.parse(body)};return {success:true};}}},{dispatch:async()=>{}},[{utid:'t1',body:'encoded'}]);
  assert.deepEqual(posted,{url:'/profile',body:{info:{transformers:[{utid:'t1',body:'encoded'}]}}});
  await assert.rejects(()=>transformers.actions.fetchItems.call({$api:{$get:async()=>({success:false})}},{state:{items:[]},commit:()=>{throw new Error('must not clear');}}));
  let payload;
  const state={items:[{utid:'existing',alias:'Existing',body:'keep'}]};
  await transformers.actions.createItem({state,dispatch:async(action,value)=>{if(action==='saveTransformers') {payload=value; return {success:true};}}},{alias:'New',body:'// český'});
  assert.equal(payload[0].body,'keep');
  assert.equal(decodeURIComponent(escape(atob(payload[1].body))),'// český');
  // 35 CR-01: the store refuses writes that would blank a transformer.
  const writes=[];
  const updState={items:[{utid:'t1',alias:'Live',body:'b64'}]};
  const updCtx={state:updState,dispatch:async(action,value)=>{if(action==='saveTransformers'){writes.push(value);return {success:true};}}};
  for (const alias of ['', '   ', undefined, null]) {
    const refused=await transformers.actions.updateItem(updCtx,{utid:'t1',alias,body:'x'});
    assert.equal(refused.success,false,'updateItem refuses alias '+JSON.stringify(alias));
  }
  assert.equal((await transformers.actions.updateItem(updCtx,{utid:'t1',alias:'Live',body:undefined})).success,false,'updateItem refuses a missing body');
  const gone=await transformers.actions.updateItem(updCtx,{utid:'deleted',alias:'Gone',body:'x'});
  assert.equal(gone.success,false,'updateItem reports a transformer deleted since load'); assert.equal(gone.message,'Transformer not found.');
  assert.equal(writes.length,0,'refused updates never write info.transformers');
  assert.equal((await transformers.actions.updateItem(updCtx,{utid:'t1',alias:'Renamed',body:'// ok'})).success,true);
  assert.equal(writes.length,1); assert.equal(writes[0][0].alias,'Renamed');
  // 35 CR-01: the editor refuses to save after a failed load, and Save is disabled.
  const editorDef=load('pages/Transformers/TransformerEditor.vue');
  let editorWrites=0;
  const editor=Object.assign(editorDef.data(),{$route:{params:{utid:'t1'}},$router:{push(){}},
    fetchItems:async()=>{throw new Error('offline');},getByUtid:()=>()=>({utid:'t1',alias:'Live',body:btoa('x')}),
    updateItem:async()=>{editorWrites++;return {success:true};}});
  await editorDef.methods.loadTransformer.call(editor);
  assert.equal(editor.loaded,false,'failed load leaves the editor unloaded'); assert.equal(editor.error,'Could not load transformers.');
  editor.error=null; await editorDef.methods.save.call(editor);
  assert.equal(editorWrites,0,'save after a failed load does not write'); assert.ok(editor.error,'save after a failed load reports why');
  const editorSfc=compiler.parseComponent(fs.readFileSync(path.join(root,'pages/Transformers/TransformerEditor.vue'),'utf8'));
  const editorRender=compiler.compileToFunctions(editorSfc.template.content);
  const saveDisabled=state=>{
    renderError=null;
    const vm=new Vue({render:editorRender.render,staticRenderFns:editorRender.staticRenderFns,data:()=>Object.assign(editorDef.data(),state),
      components:{codemirror:{render:h=>h('div')}},methods:{save(){},cancel(){}}});
    const vnode=vm._render(); assert.equal(renderError,null,'TransformerEditor renders');
    let found;
    (function walk(n){ if(!n) return; if(n.tag==='b-button'&&(n.data.on||{}).click&&String((n.children||[]).map(c=>c.text).join('')).includes('Save')) found=n; (n.children||[]).forEach(walk); })(vnode);
    assert.ok(found,'Save button rendered'); return !!found.data.attrs.disabled;
  };
  assert.equal(saveDisabled({loaded:false,form:{alias:'',body:''}}),true,'Save disabled before a successful load');
  assert.equal(saveDisabled({loaded:true,form:{alias:'  ',body:'x'}}),true,'Save disabled with an empty alias');
  assert.equal(saveDisabled({loaded:true,form:{alias:'Live',body:'x'}}),false,'Save enabled once loaded with an alias');
  editor.fetchItems=async()=>{}; await editorDef.methods.loadTransformer.call(editor);
  assert.equal(editor.loaded,true); assert.equal(editor.form.alias,'Live');
  editor.form.alias=' '; await editorDef.methods.save.call(editor);
  assert.equal(editorWrites,0,'save with an empty alias does not write');
  editor.form.alias='Live'; await editorDef.methods.save.call(editor);
  assert.equal(editorWrites,1,'save after a successful load writes once');
  let keyRequest;
  await keys.actions.createItem.call({$api:{$put:async(url,body)=>{keyRequest=JSON.parse(body);return {success:true};}}},{dispatch:async()=>{}},'Firmware');
  assert.deepEqual(keyRequest,{name:'Firmware'});
  const keyState={}; keys.mutations.saveItems(keyState,{items:[{name:'old',date:1},{name:'new',date:2}]});
  assert.equal(keyState.items[0].name,'new');
  let requested;
  await buildlog.actions.fetchBuildDetail.call({$api:{$get:async path=>{requested=path;return {success:true};}}},{},'build/id');
  assert.equal(requested,'/logs/build/build%2Fid');
  const modal = Object.assign(dialog.data(),{$store:{dispatch:async()=>({success:true,response:{contents:'FULL LOG'}})}});
  await dialog.methods.load.call(modal);
  assert.equal(modal.text,'FULL LOG'); assert.equal(modal.loading,false);
  modal.$store.dispatch=async()=>({success:false}); await dialog.methods.load.call(modal);
  assert.equal(modal.error,'Could not load this build log.'); assert.equal(modal.loading,false);
  let resolveOld;
  modal.$store.dispatch=()=>new Promise(resolve=>{resolveOld=resolve;});
  const old=dialog.methods.load.call(modal);
  modal.$store.dispatch=async()=>({success:true,response:{contents:'new'}}); await dialog.methods.load.call(modal);
  resolveOld({success:true,response:{contents:'old'}}); await old;
  assert.equal(modal.text,'new');
  let update;
  // 35 WR-02: assignment comes from the stored device list, not the unsaved select.
  const dev=Object.assign(device.data(),{device:{udid:'d',transformers:['existing']},editForm:{transformers:['unsaved']},transformerForm:{alias:'New',body:'return status;'},getTransformers:()=>[],createTransformerItem:async()=>({success:true,utid:'new'}),updateDevice:async x=>{update=x;return {success:true};},loadDevice:async()=>{},$bvModal:{hide:()=>{}}});
  await device.methods.createTransformer.call(dev,{preventDefault(){}});
  assert.deepEqual(update.changes.transformers,['existing','new'],'unsaved selection is not written'); assert.equal(dev.transformerSaving,false);
  assert.deepEqual(dev.editForm.transformers,['unsaved','new'],'unsaved selection stays pending after reload');
  dev.device={udid:'d'}; dev.editForm={transformers:[]}; dev.transformerForm.alias='Another';
  await device.methods.createTransformer.call(dev,{preventDefault(){}});
  assert.deepEqual(update.changes.transformers,['new'],'device with no stored transformers gets only the new one');
  const page=Object.assign(keyPage.data(),{keyName:'Firmware',createItem:async name=>{assert.equal(name,'Firmware');return {success:true,response:{name,pubkey:'public-key'}};},showKey:keyPage.methods.showKey,loadData:async()=>{},$bvModal:{show:()=>{}}});
  await keyPage.methods.create.call(page); assert.equal(page.createdPubkey,'public-key'); assert.equal(page.creating,false);
  page.keyName='retry'; page.createItem=async()=>{throw new Error('offline');}; await keyPage.methods.create.call(page);
  assert.equal(page.creating,false); assert.ok(page.error);
  console.log('v1.16 regression checks passed: logs, API envelopes, notifications, transformers, deploy keys, linked repository links, and all changed Vue templates.');
})().catch(err=>{console.error(err); process.exitCode=1;});
