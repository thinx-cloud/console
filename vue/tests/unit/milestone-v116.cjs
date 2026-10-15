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
  const deps = { mapGetters: () => ({}), mapActions: () => ({}), mapState: () => ({}), List: {}, BuildLogDialog: {}, Notifications: {}, codemirror: {}, moment: () => ({}), PAGE_SIZE: 100, normPaging: x => x, pagedPath: x => x, parseEnvironmentJSON: () => ({ok:true}), buildStatusVariant: status => logModule.exports.buildStatusVariant(status), ...extra };
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
new Function('module', fs.readFileSync(path.join(root,'utils/buildLog.js'),'utf8').replace(/export function (\w+)/g,'module.exports.$1 = function $1'))(logModule);
const statusVariant = logModule.exports.buildStatusVariant;
assert.equal(statusVariant('OK'), 'success', 'OK builds are green');
assert.equal(statusVariant('TIMEOUT'), 'warning', 'TIMEOUT has its own colour, not FAILED red');
assert.equal(statusVariant('running'), 'info', 'RUNNING has its own colour');
assert.equal(statusVariant('FAILED'), 'danger', 'FAILED stays red');
assert.equal(statusVariant(undefined), 'danger', 'a missing status is not shown as success');
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
const dialog = load('components/BuildLogDialog/BuildLogDialog.vue',{buildLogText:text,buildLogSearch:logModule.exports.buildLogSearch,IconButton:{}});
// Phase 45: the page imports the client key-name check; load the real module.
const keyNamesModule = {exports:{}};
new Function('module', fs.readFileSync(path.join(root,'utils/keyNames.js'),'utf8').replace(/export function (\w+)/g,'module.exports.$1 = function $1').replace(/export const (\w+) =/g,'const $1 = module.exports.$1 ='))(keyNamesModule);
const keyPage = load('pages/Rsakeys/Rsakeys.vue', { IconButton: {}, validateKeyName: keyNamesModule.exports.validateKeyName, keyNameMessage: keyNamesModule.exports.keyNameMessage, isReservedKeyName: keyNamesModule.exports.isReservedKeyName });
load('components/Header/Header.vue'); load('components/Notifications/Notifications.vue');
const history = load('pages/History/History.vue'); load('pages/Transformers/Transformers.vue', { IconButton: {} });
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
// G-36-3: render the whole real DeviceDetail page after the real loadDevice().
async function renderDeviceDetail(builds, dev, transformerItems = []) {
  const sfc = compiler.parseComponent(fs.readFileSync(path.join(root, 'pages/Devices/DeviceDetail.vue'), 'utf8'));
  const compiled = compiler.compileToFunctions(sfc.template.content);
  const opened = [];
  const noop = async () => {};
  const overrides = { openBuildLog: b => opened.push(b), fetchItems: noop, loadDevices: noop, fetchBuildLog: noop, fetchTransformers: noop, fetchRepositories: noop,
    getByUdid: () => udid => (udid === dev.udid ? dev : null), getBuildItems: () => builds, getTransformers: () => transformerItems, getRepositories: () => [] };
  const vm = new Vue({ render: compiled.render, staticRenderFns: compiled.staticRenderFns, data: device.data, computed: device.computed,
    filters: { fromNow: v => (v ? String(v) : '—') }, components: { BuildLogDialog: { render: h => h('div') } },
    methods: Object.assign({}, device.methods, overrides) });
  vm.$route = { params: { udid: dev.udid } };
  await vm.loadDevice();
  renderError = null;
  const warnings = [], prevWarn = Vue.config.warnHandler;
  Vue.config.warnHandler = msg => warnings.push(msg);
  const vnode = vm._render();
  Vue.config.warnHandler = prevWarn;
  assert.equal(renderError, null, 'DeviceDetail page renders without error');
  assert.deepEqual(warnings, [], 'DeviceDetail page renders without Vue warnings');
  const nodes = [];
  (function walk(node) { if (!node) return; nodes.push(node); (node.children || []).forEach(walk); })(vnode);
  const cy = node => (node.data && node.data.attrs && node.data.attrs['data-cy']) || null;
  const under = (top, keep) => { const out = []; (function walk(n) { if (!n) return; if (keep(n)) out.push(n); (n.children || []).forEach(walk); })(top); return out; };
  const card = nodes.find(n => cy(n) === 'card-build-history') || null;
  const tbody = card ? under(card, n => n.tag === 'tbody')[0] : null;
  const rows = tbody ? (tbody.children || []).filter(n => n.tag === 'tr') : [];
  const buttons = card ? under(card, n => cy(n) === 'build-open-log') : [];
  const textOf = top => under(top, n => !n.tag && n.text).map(n => n.text).join(' ').replace(/\s+/g, ' ').trim();
  return { vm, opened, nodes, card, rows, buttons, text: textOf(vnode), textOf, under };
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
  // 35 WR-04: Profile saves send only their own info keys, never a full snapshot.
  const profileWrites=[];
  const profileVm=Object.assign(profile.data(),{
    profile:{info:{first_name:'Old',email:'a@b.c',transformers:[{utid:'stale'}],timezone:'CET',notifications:{all:true}}},
    updateProfile:async info=>{profileWrites.push(info);return {success:true};},getProfile:()=>({info:{}})});
  Object.assign(profileVm.form,{first_name:'New',last_name:'L',mobile_phone:'1',timezone_abbr:'Europe/Prague'});
  await profile.methods.saveProfile.call(profileVm);
  assert.deepEqual(profileWrites[0],{first_name:'New',last_name:'L',mobile_phone:'1',timezone_abbr:'Europe/Prague',timezone:null},'saveProfile sends only form keys');
  Object.assign(profileVm.notifForm,{all:false,important:true,info:false});
  await profile.methods.saveNotifications.call(profileVm);
  assert.deepEqual(profileWrites[1],{notifications:{all:false,important:true,info:false}},'saveNotifications sends only notifications');
  const legacyApi=fs.readFileSync(path.join(root,'../../src/app/js/thinx-api.js'),'utf8');
  const legacySubmit=(legacyApi.match(/function submitProfile\( profile \) \{[\s\S]*?\n\}/)||[])[0];
  assert.ok(legacySubmit,'legacy submitProfile found');
  assert.ok(!/transformers/.test(legacySubmit),'legacy submitProfile never sends the session-old transformers');
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
  // 35 WR-05: a failed deploy-key list request is an error, not an empty list.
  await assert.rejects(()=>keys.actions.fetchItems.call({$api:{$get:async()=>({success:false})}},{state:{items:[]},commit:()=>{throw new Error('must not commit');}}),/Could not load deploy keys/);
  const created=await keys.actions.createItem.call({$api:{$put:async()=>({success:true,response:{pubkey:'k'}})}},{dispatch:async()=>{throw new Error('refresh failed');}},'X');
  assert.equal(created.success,true,'a failed refresh after create still reports the created key');
  const failedPage=Object.assign(keyPage.data(),{fetchItems:async()=>{throw new Error('offline');},getItems:()=>[]});
  await keyPage.methods.loadData.call(failedPage);
  assert.equal(failedPage.loadFailed,true); assert.equal(failedPage.error,null,'the load alert is the only message (45 UI-K12)'); assert.deepEqual(failedPage.items,[]); assert.equal(failedPage.loading,false);
  // 35 WR-06: deleting deploy keys asks first, and Cancel deletes nothing.
  const deleted=[]; let confirmText='';
  const delPage=Object.assign(keyPage.data(),{items:[{id:'f1',filename:'f1',name:'A'},{id:'f2',filename:'f2',name:'B'}],selectedIds:['f1','f2'],
    deleteItems:async f=>{deleted.push(f);return {success:true};},loadData:async()=>{},isDeleting:keyPage.methods.isDeleting,keysGone:keyPage.methods.keysGone,reloadGone:keyPage.methods.reloadGone,
    $bvModal:{msgBoxConfirm:async text=>{confirmText=text;return false;}}});
  await keyPage.methods.deleteSelected.call(delPage);
  assert.equal(deleted.length,0,'cancelled confirmation deletes nothing'); assert.ok(/2 deploy keys/.test(confirmText),'confirmation names the count');
  delPage.$bvModal.msgBoxConfirm=async()=>true; await keyPage.methods.deleteSelected.call(delPage);
  assert.deepEqual(deleted,[['f1','f2']],'confirmed delete sends the selected filenames'); assert.deepEqual(delPage.selectedIds,[]);
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
  // 35 WR-02: assignment comes from the stored device list, not the unsaved checkbox state.
  const dev=Object.assign(device.data(),{device:{udid:'d',transformers:['existing']},editForm:{transformers:['unsaved']},transformerForm:{alias:'New',body:'return status;'},getTransformers:()=>[],createTransformerItem:async()=>({success:true,utid:'new'}),updateDevice:async x=>{update=x;return {success:true};},loadDevice:async()=>{},$bvModal:{hide:()=>{}}});
  await device.methods.createTransformer.call(dev,{preventDefault(){}});
  assert.deepEqual(update.changes.transformers,['existing','new'],'unsaved selection is not written'); assert.equal(dev.transformerSaving,false);
  assert.deepEqual(dev.editForm.transformers,['unsaved','new'],'unsaved selection stays pending after reload');
  dev.device={udid:'d'}; dev.editForm={transformers:[]}; dev.transformerForm.alias='Another';
  await device.methods.createTransformer.call(dev,{preventDefault(){}});
  assert.deepEqual(update.changes.transformers,['new'],'device with no stored transformers gets only the new one');
  // 35 WR-03: the Actions-card Environment button never reloads an open draft.
  let detailFetches=0, focused=0;
  const envVm=Object.assign(device.data(),{device:{udid:'d'},envEditing:true,envDraft:'{"draft":1}',
    fetchDeviceDetail:async()=>{detailFetches++;return {udid:'d',environment:{stored:1}};},
    $nextTick:fn=>fn(),$el:{querySelector:()=>({scrollIntoView(){},focus(){focused++;}})}});
  envVm.editEnvironment=device.methods.editEnvironment; envVm.focusEnvironmentDraft=device.methods.focusEnvironmentDraft;
  await device.methods.openEnvironmentEditor.call(envVm);
  assert.equal(envVm.envDraft,'{"draft":1}','open draft is kept'); assert.equal(detailFetches,0,'open draft is not re-fetched'); assert.equal(focused,1,'open editor is focused');
  await device.methods.editEnvironment.call(envVm); assert.equal(detailFetches,0,'editEnvironment refuses while editing');
  envVm.envEditing=false; await device.methods.openEnvironmentEditor.call(envVm);
  assert.equal(detailFetches,1); assert.equal(envVm.envEditing,true); assert.equal(envVm.envDraft,JSON.stringify({stored:1},null,2)); assert.equal(focused,2,'newly opened editor is focused');
  const page=Object.assign(keyPage.data(),{keyName:'Firmware',createItem:async name=>{assert.equal(name,'Firmware');return {success:true,response:{name,pubkey:'public-key'}};},showKey:keyPage.methods.showKey,loadData:async()=>{},$bvModal:{show:()=>{}}});
  await keyPage.methods.create.call(page); assert.equal(page.createdPubkey,'public-key'); assert.equal(page.creating,false);
  page.keyName='retry'; page.createItem=async()=>{throw new Error('offline');}; await keyPage.methods.create.call(page);
  assert.equal(page.creating,false); assert.ok(page.error);
  page.keyName='a'+String.fromCharCode(9)+'b'; page.error=null; page.createItem=async()=>{throw new Error('a refused name must not be sent');};
  await keyPage.methods.create.call(page); assert.equal(page.error,null,'a name the client check refuses sends nothing');
  // G-36-3: device Build History is summary-only; the full log opens only from the row's button.
  const zDev = { udid: 'udid-z', alias: 'zephyr-01', last_build_id: 'build-1', environment: {} };
  const zLogs = ['compiling module 1 of 12', 'linking firmware', 'error: missing header', 'other device output'];
  const zBuilds = [
    { build_id: 'build-1', udid: 'udid-z', status: 'OK', date: NOW, log: zLogs.slice(0, 2) },
    { build_id: 'build-2', udid: 'udid-z', status: 'FAILED', date: NOW - 60000, log: [zLogs[2]] },
    { build_id: 'other', udid: 'udid-o', status: 'OK', date: NOW, log: [zLogs[3]] },
  ];
  const devPage = await renderDeviceDetail(zBuilds, zDev);
  const attrsOf = n => (n.data && n.data.attrs) || {};
  assert.ok(!devPage.nodes.some(n => attrsOf(n)['data-cy'] === 'card-device-logs' || String(attrsOf(n).title || '').startsWith('Device Logs')), 'device page has no inline last-build log card');
  assert.ok(!devPage.nodes.some(n => n.tag === 'pre'), 'device page renders no pre block');
  for (const line of zLogs) assert.ok(!devPage.text.includes(line), 'device page shows no build log text: ' + line);
  assert.ok(devPage.card, 'device page has a Build History card');
  assert.equal(devPage.rows.length, 2, 'Build History lists only this device\'s builds');
  const rowText = devPage.rows.map(devPage.textOf);
  assert.ok(rowText[0].includes('build-1') && rowText[0].includes('OK'), 'first row shows build-1 and OK');
  assert.ok(rowText[1].includes('build-2') && rowText[1].includes('FAILED'), 'second row shows build-2 and FAILED');
  for (const row of devPage.rows) {
    assert.ok(!('role' in attrsOf(row)), 'Build History row has no role');
    assert.ok(!('tabindex' in attrsOf(row)), 'Build History row has no tabindex');
    const on = (row.data && row.data.on) || {};
    for (const ev of ['click', 'keydown', 'keyup']) assert.ok(!(ev in on), 'Build History row has no ' + ev + ' listener');
  }
  assert.deepEqual(devPage.opened, [], 'page load opens no build log');
  assert.equal(devPage.buttons.length, 2, 'each Build History row has one Open build log button');
  devPage.buttons.forEach((btn, i) => {
    assert.equal(btn.tag, 'b-button', 'Open build log control is a b-button');
    assert.equal(attrsOf(btn)['aria-label'], 'Open build log build-' + (i + 1), 'Open build log button names its build');
    assert.equal(devPage.textOf(btn), 'View', 'Open build log button reads View');
    assert.ok(devPage.under(btn, n => n.tag === 'i' && /\bla-eye\b/.test((n.data && n.data.staticClass) || '')).length === 1, 'View button has an eye icon');
    assert.ok(/^Open build log /.test((btn.data && btn.data.attrs && btn.data.attrs['aria-label']) || ''), 'View button keeps a descriptive aria-label');
    assert.equal(typeof ((btn.data && btn.data.on) || {}).click, 'function', 'Open build log button has a click handler');
  });
  devPage.buttons[1].data.on.click({ stopPropagation() {}, preventDefault() {} });
  assert.equal(devPage.opened.length, 1, 'second Open build log button opens exactly one log');
  assert.equal(devPage.opened[0], devPage.vm.buildHistory[1], 'second Open build log button opens its own row\'s build');
  const idlessPage = await renderDeviceDetail([
    { build_id: 'build-1', udid: 'udid-z', status: 'TIMEOUT', date: NOW, log: [] },
    { build_id: '', udid: 'udid-z', status: 'FAILED', date: NOW - 60000, log: [] },
  ], zDev);
  assert.equal(idlessPage.rows.length, 2, 'both builds are listed');
  assert.equal(idlessPage.buttons.length, 1, 'a build without build_id gets no View button');
  assert.ok(idlessPage.textOf(idlessPage.rows[1]).includes('—'), 'a build without build_id shows a dash instead');
  const badges = idlessPage.under(idlessPage.card, n => n.tag === 'b-badge');
  assert.equal(badges[0].data.attrs.variant, 'warning', 'TIMEOUT badge is not FAILED red on the device page');
  assert.equal(devPage.opened[0].build_id, 'build-2');
  const dialogOpened = [];
  device.methods.openBuildLog.call({ $refs: { buildLogDialog: { open: b => dialogOpened.push(b) } } }, devPage.vm.buildHistory[1]);
  assert.equal(dialogOpened.length, 1, 'openBuildLog hands the build to BuildLogDialog.open');
  assert.equal(dialogOpened[0], devPage.vm.buildHistory[1], 'BuildLogDialog.open receives the same build object');
  // G-37-5: transformer assignment is one checkbox per transformer; Manage Transformers is a filled orange button (operator 2026-10-12).
  const tDev = { udid: 'udid-t', alias: 'tango-01', transformers: ['t2'], environment: {} };
  const tItems = [{ utid: 't1', alias: 'Alpha' }, { utid: 't2', alias: 'passthrough' }, { utid: 't3' }];
  const tPage = await renderDeviceDetail([], tDev, tItems);
  const tCard = tPage.nodes.find(n => attrsOf(n)['data-cy'] === 'card-transformers');
  assert.ok(tCard, 'device page has a Transformer Assignment card');
  const groups = tPage.under(tCard, n => n.tag === 'b-form-checkbox-group');
  assert.equal(groups.length, 1, 'Transformer Assignment card renders exactly one checkbox group');
  assert.equal(tPage.under(tCard, n => n.tag === 'b-form-select' || n.tag === 'select').length, 0, 'Transformer Assignment card has no select');
  assert.equal(tPage.under(tCard, n => 'multiple' in attrsOf(n)).length, 0, 'Transformer Assignment card has no multiple attribute');
  const group = groups[0];
  assert.ok('stacked' in attrsOf(group), 'transformer checkboxes are stacked');
  assert.equal(attrsOf(group)['data-cy'], 'transformer-checkboxes', 'checkbox group has data-cy transformer-checkboxes');
  assert.deepEqual(attrsOf(group).options, [{ value: 't1', text: 'Alpha' }, { value: 't2', text: 'passthrough' }, { value: 't3', text: 't3' }], 'one checkbox per transformer, value utid, label alias or utid');
  assert.deepEqual(attrsOf(group).options, tPage.vm.assignmentOptions, 'checkbox options are assignmentOptions');
  const model = group.data && group.data.model;
  assert.ok(model, 'checkbox group is bound with v-model');
  assert.equal(model.expression, 'editForm.transformers', 'checkbox group is bound to editForm.transformers');
  assert.equal(model.value, tPage.vm.editForm.transformers, 'checkbox group value is the editForm.transformers array');
  assert.deepEqual(model.value, ['t2'], 'only the assigned transformer is checked');
  model.callback(['t1', 't3']);
  assert.deepEqual(tPage.vm.editForm.transformers, ['t1', 't3'], 'ticking checkboxes updates editForm.transformers');
  let tSaved = null;
  await device.methods.saveTransformers.call({ device: { udid: 'udid-t' }, editForm: tPage.vm.editForm,
    transformersSaving: false, transformersMessage: null, transformersError: null,
    updateDevice: async x => { tSaved = x; return { success: true }; }, loadDevice: async () => {} });
  assert.deepEqual(tSaved, { udid: 'udid-t', changes: { transformers: ['t1', 't3'] } }, 'Save Transformers sends the checkbox state');
  const cardButton = (page, card, label) => page.under(card, n => n.tag === 'b-button' && page.textOf(n) === label)[0];
  const checkCardButtons = (page, card) => {
    for (const label of ['Save Transformers', 'Create & Assign']) {
      const btn = cardButton(page, card, label);
      assert.ok(btn, label + ' button renders');
      assert.equal(typeof ((btn.data && btn.data.on) || {}).click, 'function', label + ' button has a click handler');
    }
    const manage = cardButton(page, card, 'Manage Transformers');
    assert.ok(manage, 'Manage Transformers button renders');
    assert.equal(attrsOf(manage).variant, 'warning', 'Manage Transformers is a filled orange (warning) button, not a link');
    assert.equal(attrsOf(manage).to, '/app/transformers', 'Manage Transformers routes to /app/transformers');
    assert.equal(attrsOf(manage)['data-cy'], 'manage-transformers', 'Manage Transformers has data-cy manage-transformers');
    // 46-04 UI-T15: the card buttons sit in .transformer-card-actions (gap 8px) instead of carrying ml-2.
    const actions = page.under(card, n => /\btransformer-card-actions\b/.test((n.data && n.data.staticClass) || ''));
    assert.equal(actions.length, 1, 'the card has one .transformer-card-actions row');
    assert.equal(page.under(actions[0], n => n === manage).length, 1, 'Manage Transformers is inside .transformer-card-actions');
  };
  checkCardButtons(tPage, tCard);
  const ePage = await renderDeviceDetail([], { udid: 'udid-t', alias: 'tango-01', environment: {} }, []);
  const eCard = ePage.nodes.find(n => attrsOf(n)['data-cy'] === 'card-transformers');
  assert.ok(eCard, 'empty profile still renders the Transformer Assignment card');
  assert.equal(ePage.under(eCard, n => n.tag === 'b-form-checkbox-group').length, 0, 'no checkbox group without transformers');
  const empty = ePage.under(eCard, n => attrsOf(n)['data-cy'] === 'transformers-empty');
  assert.equal(empty.length, 1, 'empty profile shows one empty-state line');
  assert.equal(ePage.textOf(empty[0]), 'No transformers yet. Use Create & Assign to add one.', 'empty-state line points to Create & Assign');
  checkCardButtons(ePage, eCard);
  // 37 WR-01: an assigned utid with no transformer behind it is shown as a (missing) checkbox and can be unticked.
  const oPage = await renderDeviceDetail([], { udid: 'udid-t', alias: 'tango-01', transformers: ['t2', 'gone'], environment: {} }, tItems);
  const oCard = oPage.nodes.find(n => attrsOf(n)['data-cy'] === 'card-transformers');
  const oGroup = oPage.under(oCard, n => n.tag === 'b-form-checkbox-group')[0];
  assert.deepEqual(attrsOf(oGroup).options.slice(-1), [{ value: 'gone', text: '(missing) gone' }], 'orphaned assignment gets a (missing) checkbox');
  assert.deepEqual(oGroup.data.model.value, ['t2', 'gone'], 'orphaned assignment is shown as checked');
  oGroup.data.model.callback(['t2']);
  assert.ok(oPage.vm.assignmentOptions.some(o => o.value === 'gone'), 'an unticked orphan stays visible until saved');
  const gPage = await renderDeviceDetail([], { udid: 'udid-t', alias: 'tango-01', transformers: ['gone'], environment: {} }, []);
  const gCard = gPage.nodes.find(n => attrsOf(n)['data-cy'] === 'card-transformers');
  assert.equal(gPage.under(gCard, n => attrsOf(n)['data-cy'] === 'transformers-empty').length, 0, 'no empty-state line while an orphan is still assigned');
  assert.equal(gPage.under(gCard, n => n.tag === 'b-form-checkbox-group').length, 1, 'orphan-only device still renders the checkbox group');
  console.log('v1.16 regression checks passed: logs, API envelopes, notifications, transformers, deploy keys, linked repository links, device build history without inline logs, transformer assignment checkboxes, and all changed Vue templates.');
})().catch(err=>{console.error(err); process.exitCode=1;});
