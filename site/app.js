const $ = id => document.getElementById(id);
const meta = {
  importacoes_catalogo: ['Importações', 'Origem do catálogo, arquivo, aba, hash de verificação, campos originais e totais. É referenciada pelos produtos e pelas versões históricas.'],
  produtos_swift: ['Produtos ativos', 'Catálogo com código, nome, disponibilidade, tipos, ocasiões, importação de origem e autoria das alterações. Fotos e dados comerciais ficam em tabelas relacionadas.'],
  produtos_swift_versoes: ['Versões históricas de produtos', 'Preserva os produtos arquivados e os estados antes/depois das edições. Cada versão tem dados de origem e foto próprios, sem colunas JSON.'],
  produtos_swift_dados_originais: ['Dados de origem dos produtos', 'Colunas próprias para os 36 campos da planilha. Valores numéricos e observações de preço/margem são separados para conservar os valores ausentes da origem.'],
  produtos_swift_imagens: ['Fotos dos produtos', 'Foto do R2, dimensões, tamanho, hashes, origem, correspondência e identificação das fotos manuais. Relacionada ao produto por chave estrangeira.'],
  versoes_produtos_dados_originais: ['Dados das versões históricas', 'Preserva os dados comerciais e classificações de cada versão antes/depois ou arquivada.'],
  versoes_produtos_imagens: ['Fotos históricas', 'Metadados da foto vinculada a cada versão histórica de um produto.'],
  arquivo_produtos_swift: ['Produtos arquivados', 'Motivo, momento do arquivamento, versão original e referência à cópia completa do produto. O identificador de origem é mantido mesmo após sua remoção do catálogo.'],
  auditoria_catalogo: ['Histórico de alterações', 'Administrador, data e produto alterado, com referências às versões completas antes e depois. O histórico permanece após arquivar o produto.'],
  sincronizacao_imagens_swift: ['Sincronização de fotos', 'Última verificação, ETag, Last-Modified, hash e URL de origem. Preserva verificações históricas mesmo quando o produto já não está ativo.'],
  ranking: ['Resultados dos jogadores', 'Uma publicação por usuário do Firebase Authentication. Colunas próprias e limites para pontuação, satisfação e tempo.'],
  products: ['Catálogo público', 'View com os campos públicos do produto: nome, código, categorias, marca, formato, unidade e foto. Dados comerciais ficam fora da resposta do jogo.'],
};
const fmt = new Intl.NumberFormat('pt-BR');
const date = new Intl.DateTimeFormat('pt-BR', {dateStyle:'medium',timeStyle:'short',timeZone:'America/Sao_Paulo'});
const sections = ['esquema', 'colecoes', 'scripts'];
const kinds = { p:'Chave primária', f:'Chave estrangeira', u:'Única', c:'Validação' };
let model, selected = 'produtos_swift';

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
  const cards=node('div',undefined,'business-cards');
  const names=model.application.tables.map(t=>t.name);
  for(const name of names)cards.append(objectButton(model.objects.find(o=>o.name===name),true));
  const links=node('ul',undefined,'business-relations');
  for(const obj of model.objects.filter(o=>o.schema==='epav_data')) {
    for(const constraint of obj.constraints.filter(c=>c.kind==='f')) {
      const target=constraint.definition.match(/REFERENCES (?:epav_data\.)?(\w+)\(([^)]+)\)/);
      const local=constraint.definition.match(/FOREIGN KEY \(([^)]+)\)/);
      if(!target || target[1]==='records' || target[1]==='record_fields')continue;
      const item=node('li');const button=node('button',obj.name+'.'+local[1]+' → '+target[1]+'.'+target[2],'relation-link');
      button.type='button';button.onclick=()=>select(obj.name);item.append(button);links.append(item);
    }
  }
  $('graph').replaceChildren(cards,node('h3','Relacionamentos'),links);
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
  const tables=model.application.tables;
  const total=tables.reduce((sum,t)=>sum+t.count,0);
  const largest=Math.max(1,...tables.map(t=>t.count));
  $('doc-total').textContent=fmt.format(total)+' registros';
  $('snapshot-date').textContent='Tabelas verificadas em '+date.format(new Date(model.capturedAt))+' (horário de São Paulo).';
  const rows=tables.map(({name,count})=>{
    const link=node('a',name);link.href='#'+name;link.className='table-link';
    const countCell=node('div',undefined,'count-cell');
    const bar=node('span',undefined,'bar');const fill=node('span');fill.style.width=count/largest*100+'%';
    bar.setAttribute('aria-hidden','true');bar.append(fill);countCell.append(node('strong',fmt.format(count)),bar);
    return [link,node('code','epav_data'),countCell];
  });
  $('collections').replaceChildren(makeTable(['Tabela PostgreSQL','Esquema','Registros'],rows,'Tabelas da aplicação'));
}

document.querySelectorAll('[data-section]').forEach(button=>button.addEventListener('click',()=>select(button.dataset.section)));
$('search').addEventListener('input',()=>{if(model)sidebar();});
window.addEventListener('hashchange',route);
route();

try {
  const request = await fetch('./schema.json?v=20261117-clean');
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
