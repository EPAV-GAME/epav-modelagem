const $ = id => document.getElementById(id);
const meta = {
  records: ['Dados operacionais', 'Registros ativos usados pela API, pelo painel e pelo robô. A revisão identifica conflitos entre edições simultâneas.'],
  record_fields: ['Valores operacionais', 'Campos tipados dos registros ativos. Preservam mapas, listas e todos os tipos da origem sem colunas JSON ou TEXT.'],
  ranking: ['Resultados dos jogadores', 'Uma publicação por usuário do Firebase Authentication. Colunas próprias e limites para pontuação, satisfação e tempo.'],
  products: ['Catálogo público', 'View com os campos públicos do produto: nome, código, categorias, marca, formato, unidade e foto. Dados comerciais ficam fora da resposta do jogo.'],
  snapshots: ['Histórico de cópias', 'Uma linha por leitura confirmada do Firestore. Guarda o horário da leitura, o horário da importação e a contagem de documentos.'],
  documents: ['Documentos copiados', 'Uma linha por documento em cada cópia. O caminho completo distingue documentos com o mesmo ID em coleções diferentes.'],
  document_fields: ['Campos e valores tipados', 'Uma linha por campo ou item de lista. A coluna kind indica o tipo do valor. parent_no liga os itens aos seus mapas e listas, e array_index preserva a ordem.'],
  current_documents: ['Cópia mais recente', 'A view consulta documents e escolhe, para cada banco de origem, a cópia com o horário de leitura mais recente. Não guarda outra cópia dos documentos.'],
};
const fmt = new Intl.NumberFormat('pt-BR');
const date = new Intl.DateTimeFormat('pt-BR', {dateStyle:'medium',timeStyle:'short',timeZone:'America/Sao_Paulo'});
const sections = ['esquema', 'colecoes', 'scripts'];
const kinds = { p:'Chave primária', f:'Chave estrangeira', u:'Única', c:'Validação' };
let model, selected = 'snapshots';

function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}

function select(name) {
  if (location.hash === '#'+name) route();
  else location.hash = name;
}

function objectButton(obj, graph=false) {
  const button = node('button', undefined, graph ? 'entity' : 'object');
  button.type = 'button';
  button.dataset.object = obj.name;
  button.setAttribute('aria-pressed', String(obj.name === selected));
  if (graph) {
    const title = node('span', obj.kind === 'view' ? 'VIEW' : 'TABELA', 'type-label');
    button.append(title, node('code', obj.name), node('span', meta[obj.name][0], 'entity-caption'));
  } else button.append(node('span', obj.kind === 'view' ? 'V' : 'T', 'object-letter'), node('code',obj.name));
  button.addEventListener('click', () => select(obj.name));
  return button;
}

function graph() {
  const [snapshots, documents, fields, view] = model.objects;
  const connector = (label, tip, dashed=false) => {
    const el = node('div',undefined,'connector'+(dashed?' dashed':''));
    el.append(node('span',label),node('div',undefined,'arrow'),node('small',tip));
    return el;
  };
  const viewBranch = node('div',undefined,'view-branch');
  viewBranch.append(connector('Consulta','cópia mais recente',true),objectButton(view,true));
  $('graph').replaceChildren(objectButton(snapshots,true), connector('1 → N','snapshot_id'),
    objectButton(documents,true), connector('1 → N','document_row_id'), objectButton(fields,true), viewBranch);
  const runtime = node('div',undefined,'runtime-graph');
  runtime.append(node('h3','Aplicação · epav_data'));
  const cards=node('div',undefined,'runtime-cards');
  for(const name of ['records','record_fields','products','ranking']) {
    const obj=model.objects.find(o=>o.name===name);if(obj)cards.append(objectButton(obj,true));
  }
  runtime.append(node('p','records 1 → N record_fields · products consulta os campos públicos · ranking guarda os resultados'),cards);
  $('graph').append(runtime);
}

function sidebar() {
  const term = $('search').value.trim().toLowerCase();
  const filtered = model.objects.filter(o => [o.name, meta[o.name][0], ...o.columns.map(c=>c.name)]
    .some(value => value.toLowerCase().includes(term)));
  $('objects').replaceChildren(...(filtered.length ? filtered.map(o=>objectButton(o)) :
    [node('p','Nenhum objeto ou coluna encontrado.','muted')]));
}

function makeTable(headers, rows, label) {
  const wrapper = node('div',undefined,'table-wrap');
  const table = node('table');
  table.setAttribute('aria-label',label);
  const header = table.createTHead().insertRow();
  for(const name of headers) {
    const th = node('th',name); th.scope = 'col'; header.append(th);
  }
  const body = table.createTBody();
  for(const values of rows) {
    const row = body.insertRow();
    for(const value of values) {
      const cell = row.insertCell();
      cell.append(value instanceof Node ? value : document.createTextNode(value));
    }
  }
  wrapper.append(table);
  return wrapper;
}

function definition(label, sql) {
  const card = node('details',undefined,'definition');
  card.append(node('summary', label));
  const box = node('pre');
  box.append(node('code',sql));
  card.append(box);
  return card;
}

function openObject(name) {
  const obj = model.objects.find(o=>o.name===name);
  if (!obj) return;
  selected = name;
  document.querySelectorAll('[data-object]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.object===name)));
  const heading = node('div',undefined,'detail-head');
  const type = node('span',obj.kind==='view'?'View':'Tabela','pill');
  heading.append(node('h3',obj.name),type);
  const columns = makeTable(['Coluna','Tipo','Aceita NULL','Padrão'],
    obj.columns.map(c=>[node('code',c.name),node('code',c.type),obj.kind==='view'?'—':c.nullable?'Sim':'Não',c.default??'—']),
    'Colunas de '+obj.name);
  const children = [heading,node('p',meta[name][1],'description'),columns];
  if (obj.constraints.length) {
    const items = node('ul',undefined,'key-list');
    for(const k of obj.constraints) {
      const item = node('li');
      item.append(node('span',kinds[k.kind],'key-tag'),node('code',k.definition)); items.append(item);
    }
    children.push(node('h4','Chaves e restrições'), items);
  }
  if (obj.indexes.length) {
    const list = obj.indexes.map(i=>definition(i.name,i.definition+';'));
    children.push(node('h4','Índices'),...list);
  }
  if (obj.definition) children.push(definition('Ver SQL da view',obj.definition));
  $('detail').replaceChildren(...children);
}

function route() {
  const hash = location.hash.slice(1);
  const section = sections.includes(hash)?hash:'esquema';
  for(const id of sections) $(id).hidden = id !== section;
  document.querySelectorAll('[data-section]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.section===section)));
  if (section === 'esquema' && model) openObject(model.objects.some(o=>o.name===hash)?hash:selected);
}

function showCollections() {
  const { snapshot } = model;
  const largest = Math.max(1,...snapshot.collections.map(c=>c.count));
  $('doc-total').textContent = fmt.format(snapshot.total)+' documentos';
  $('snapshot-date').textContent = 'Cópia de '+date.format(new Date(snapshot.readTime))+' (horário de São Paulo).';
  const rows = snapshot.collections.map(({name,count})=>{
    const countCell = node('div',undefined,'count-cell');
    const bar = node('span',undefined,'bar');
    const fill = node('span');
    fill.style.width = count/largest*100+'%'; bar.setAttribute('aria-hidden','true'); bar.append(fill);
    countCell.append(node('strong',fmt.format(count)),bar);
    return [node('code',name),countCell];
  });
  $('collections').replaceChildren(makeTable(['Coleção','Documentos na cópia'],rows,'Coleções do Firestore'));
}

document.querySelectorAll('[data-section]').forEach(button=>button.addEventListener('click',()=>select(button.dataset.section)));
$('search').addEventListener('input',()=>{if(model)sidebar();});
window.addEventListener('hashchange',route);
route();

try {
  const request = await fetch('./schema.json?v=20261117-postgres');
  if(!request.ok) throw new Error('Inventário indisponível.');
  model = await request.json();
  $('branch').textContent = model.branch;
  $('freshness').textContent = 'Esquema verificado em '+date.format(new Date(model.capturedAt));
  const tables = model.objects.filter(o=>o.kind==='table').length;
  $('object-total').textContent = tables+' tabelas · '+(model.objects.length-tables)+' view';
  graph(); sidebar(); showCollections(); route();
} catch {
  $('error').hidden = false;
  $('error').textContent = 'Não foi possível carregar o inventário. Atualize a página ou consulte os scripts no GitHub.';
  $('freshness').textContent = 'Inventário indisponível';
}
