"""Independent table topology and native Word evidence. No product imports."""
import copy,hashlib,re
from xml.etree import ElementTree as ET
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
CONTROLS=['drop-cell','swap-rows','swap-columns','remove-grid-span','break-vertical-merge','flatten-table']
def need(value,code):
    if not value:raise ValueError('TABLE_'+code)
def text(p):
    return ''.join(n.text or '' for n in p.iter(W+'t'))
def bounded(value,maximum):
    need(isinstance(value,int) and not isinstance(value,bool) and 0<value<=maximum,'INTEGER');return value
def span(value,maximum):
    need(isinstance(value,str) and re.fullmatch('[1-9][0-9]{0,2}',value),'SPAN');return bounded(int(value),maximum)

def expected_blocks(para):
    def cell(value,wide=1,high=1):return {'type':'tableCell','attrs':{'colspan':wide,'rowspan':high,'colwidth':None},'content':[para(value)]}
    def row(*cells):return {'type':'tableRow','content':list(cells)}
    def table(*rows):return {'type':'table','content':list(rows)}
    multiple=cell('[table-r2c1] multi');multiple['content'].append(para('[table-r2c1-p2] 日本語 e\u0301'))
    return [table(row(cell('[table-r1c1] first'),cell('repeated cell'),cell('')),
                  row(multiple,cell('repeated cell'),cell('[table-r2c3] right')),
                  row(cell('[table-r3c1] left'),cell('[table-r3c2] middle'),cell('[table-r3c3] last'))),
            para('[between-tables]'),
            table(row(cell('[merged-horizontal]',2),cell('[merged-vertical]',1,2)),
                  row(cell('[merged-r2c1]'),cell('[merged-r2c2]')),
                  row(cell('[merged-r3c1]'),cell('[merged-r3c2]'),cell('[merged-r3c3]')))]

def canonical_graphs(docs):
    result=[];offset=0
    def visit(node):
        nonlocal offset
        if node.get('type') in ['paragraph','heading','codeBlock']:offset+=1;return
        if node.get('type')!='table':
            for child in node.get('content',[]):visit(child)
            return
        rows=node.get('content',[]);bounded(len(rows),512);grid=[{} for _ in rows];cells=[];start=offset
        for y,row in enumerate(rows):
            need(row.get('type')=='tableRow','CANON_ROW');x=0
            for cell in row.get('content',[]):
                while x in grid[y]:x+=1
                need(cell.get('type') in ['tableCell','tableHeader'],'CANON_CELL')
                attrs=cell.get('attrs',{});wide=bounded(attrs.get('colspan',1),128);high=bounded(attrs.get('rowspan',1),512)
                need(x+wide<=128 and y+high<=len(rows) and attrs.get('colwidth') is None,'CANON_SPAN')
                ps=cell.get('content',[]);need(ps and len(ps)<=50000,'CANON_PARAGRAPHS');values=[]
                for p in ps:
                    need(p.get('type') in ['paragraph','heading','codeBlock'] and all(n.get('type')=='text' for n in p.get('content',[])),'CANON_CELL_CONTENT')
                    values.append(''.join(n['text'] for n in p.get('content',[])))
                record={'row':y,'column':x,'colspan':wide,'rowspan':high,'header':cell['type']=='tableHeader','paragraphs':values}
                for yy in range(y,y+high):
                    for xx in range(x,x+wide):need(xx not in grid[yy],'CANON_OVERLAP');grid[yy][xx]=record
                cells.append(record);offset+=len(ps);need(offset<=50000,'PARAGRAPH_LIMIT');x+=wide
        width=len(grid[0]);need(width and all(set(row)==set(range(width)) for row in grid),'CANON_RECTANGLE')
        result.append({'startParagraphIndex':start,'rows':len(rows),'columns':width,'cells':cells})
    for doc in docs:visit(doc)
    return result

def parse_body(document):
    body=document.find(W+'body');need(body is not None,'BODY');paragraphs=[];tables=[]
    for node in body:
        if node.tag==W+'p':paragraphs.append(node);continue
        if node.tag!=W+'tbl':continue
        need(len(tables)<512 and all(c.tag in [W+'tblPr',W+'tblGrid',W+'tr'] for c in node),'OWNER')
        grids=node.findall(W+'tblGrid');need(len(grids)==1 and all(c.tag==W+'gridCol' for c in grids[0]),'GRID')
        width=bounded(len(grids[0]),128);rows=node.findall(W+'tr');bounded(len(rows),512);need(width*len(rows)<=65536,'GRID_LIMIT')
        need(len(node.findall('.//'+W+'tbl'))==0,'NESTED')
        graph={'startParagraphIndex':len(paragraphs),'rows':len(rows),'columns':width,'cells':[]};previous={}
        for y,row in enumerate(rows):
            need(all(c.tag in [W+'trPr',W+'tc'] for c in row),'ROW_OWNER')
            headers=row.findall('./'+W+'trPr/'+W+'tblHeader');need(len(headers)<=1,'HEADER')
            header=bool(headers) and headers[0].get(W+'val','1') not in ['0','false','off']
            need(not row.findall('.//'+W+'gridBefore') and not row.findall('.//'+W+'gridAfter'),'ROW_SKIP')
            current={};x=0
            for cell in row.findall(W+'tc'):
                need(all(c.tag in [W+'tcPr',W+'p'] for c in cell) and len(cell.findall(W+'tcPr'))<=1,'CELL_OWNER')
                wide_nodes=cell.findall('./'+W+'tcPr/'+W+'gridSpan');merge_nodes=cell.findall('./'+W+'tcPr/'+W+'vMerge')
                need(len(wide_nodes)<=1 and len(merge_nodes)<=1 and not cell.findall('.//'+W+'hMerge'),'CELL_PROPERTIES')
                wide=span(wide_nodes[0].get(W+'val',''),128) if wide_nodes else 1
                merge=merge_nodes[0].get(W+'val','continue') if merge_nodes else ''
                need(merge in ['','restart','continue'] and x+wide<=width,'MERGE_VALUE')
                ps=cell.findall(W+'p');need(ps,'CELL_PARAGRAPHS')
                if merge=='continue':
                    old=previous.get(x);need(old and old[0]['column']==x and old[0]['colspan']==wide and old[1]
                        and all(previous.get(xx)==old for xx in range(x,x+wide)) and old[0]['header']==header,'ORPHAN_MERGE')
                    need(len(ps)==1 and text(ps[0])=='' and all(n.tag not in {W+t for t in ['ins','del','bookmarkStart','bookmarkEnd','commentReference','commentRangeStart','commentRangeEnd','footnoteReference','endnoteReference','drawing','object','pict','tab','br','cr']} for n in ps[0].iter()),'CONTINUATION_CONTENT')
                    record=old[0];record['rowspan']+=1
                else:
                    record={'row':y,'column':x,'colspan':wide,'rowspan':1,'header':header,'paragraphs':[text(p) for p in ps]}
                    graph['cells'].append(record);paragraphs.extend(ps)
                for xx in range(x,x+wide):current[xx]=(record,merge in ['restart','continue'])
                x+=wide
            need(x==width,'RECTANGLE');previous=current
        tables.append(graph)
    need(len(paragraphs)<=50000,'PARAGRAPH_LIMIT');return paragraphs,tables

def native_readback(raw_body,index_bytes,read_cell,graphs,paragraph_count,expected_breaks):
    body=raw_body.decode('utf8');index=index_bytes.decode('utf8');need(index.endswith('\n'),'NATIVE_INDEX')
    lines=index[:-1].split('\n');line_index=0;offset=0;out=[];breaks=[]
    by_start={t['startParagraphIndex']:(i,t) for i,t in enumerate(graphs)}
    def line(expected):
        nonlocal line_index
        need(line_index<len(lines) and lines[line_index].split('\t')==[str(x) for x in expected],'NATIVE_INDEX');line_index+=1
    while len(out)<paragraph_count:
        entry=by_start.get(len(out))
        if entry is None:
            match=re.search('[\r\f]',body[offset:]);need(match is not None,'NATIVE_PARAGRAPH')
            end=offset+match.start();value=body[offset:end];need('\x07' not in value,'NATIVE_UNDECLARED_CELL');out.append(value)
            if body[end]=='\f':breaks.append(len(out))
            offset=end+1;continue
        ti,table=entry;line(['TABLE',ti+1,table['rows'],table['columns'],len(table['cells'])]);grid={}
        for ci,cell in enumerate(table['cells']):
            for y in range(cell['row'],cell['row']+cell['rowspan']):
                for x in range(cell['column'],cell['column']+cell['colspan']):grid[y,x]=(ci,cell)
        for y in range(table['rows']):
            x=0;physical_column=0
            while x<table['columns']:
                ci,cell=grid[y,x];end=body.find('\x07',offset);need(end>=offset and end>0 and body[end-1]=='\r','NATIVE_CELL_MARKER')
                native=body[offset:end+1];offset=end+1
                if cell['row']==y:
                    physical_column+=1;line(['CELL',ti+1,ci+1,y+1,physical_column])
                    need(read_cell(f'word-native-table-{ti+1}-cell-{ci+1}.txt')==native.encode('utf8'),'NATIVE_CELL_BODY_BINDING')
                    values=native[:-2].split('\r');need(len(values)==len(cell['paragraphs']),'NATIVE_CELL_PARAGRAPHS');out.extend(values)
                else:need(native=='\r\x07','NATIVE_CONTINUATION')
                x+=cell['colspan']
            need(body[offset:offset+2]=='\r\x07','NATIVE_ROW_MARKER');offset+=2
    need(len(out)==paragraph_count and offset==len(body) and line_index==len(lines) and breaks==expected_breaks,'NATIVE_COMPLETE')
    return out

def negative_controls(document,expected_graphs):
    results=[]
    for kind in CONTROLS:
        changed=copy.deepcopy(document);body=changed.find(W+'body');tables=body.findall(W+'tbl');need(len(tables)>=2,'CONTROL_FIXTURE')
        rows=tables[0].findall(W+'tr');cells=rows[0].findall(W+'tc')
        if kind=='drop-cell':rows[0].remove(cells[0])
        elif kind=='swap-rows':a=list(tables[0]).index(rows[0]);tables[0].remove(rows[1]);tables[0].insert(a,rows[1])
        elif kind=='swap-columns':a=list(rows[0]).index(cells[0]);rows[0].remove(cells[1]);rows[0].insert(a,cells[1])
        elif kind=='remove-grid-span':
            prop=tables[1].find('.//'+W+'tcPr');prop.remove(prop.find(W+'gridSpan'))
        elif kind=='break-vertical-merge':
            table=tables[1]
            for prop in table.findall('.//'+W+'tcPr'):
                merge=prop.find(W+'vMerge')
                if merge is not None and merge.get(W+'val')=='restart':prop.remove(merge);break
        elif kind=='flatten-table':
            at=list(body).index(tables[0]);ps,_=parse_body(ET.fromstring(ET.tostring(document)))
            owned=list(tables[0].iter(W+'p'));body.remove(tables[0])
            for i,p in enumerate(owned):body.insert(at+i,p)
        try:rejected=parse_body(changed)[1]!=expected_graphs
        except ValueError:rejected=True
        need(rejected,'CONTROL_SURVIVED_'+kind)
        results.append({'id':kind,'rejected':True,'sha256':hashlib.sha256(ET.tostring(changed)).hexdigest()})
    return results
