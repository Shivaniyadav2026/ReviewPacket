from pathlib import Path
from openpyxl import Workbook

project_root = Path(__file__).resolve().parents[1]
xlsx_path = project_root / 'sample' / 'ReviewPackets_Sample.xlsx'

columns = [
    'Issue Key','Summary','Affects Version/s','Components/s','Priority','Status','Fix Version/s','Labels',
    'Description','Category of Task','Affected Subsystem/s','Epic Link','Acceptance Criteria','Solution',
    'Review Info','Issue Links','Summary','Review Info'
]
rows = [
    ['RP-101','Login fails','1.0','Auth','High','Open','1.1','login,auth','User cannot login','Bug','Auth','EP-1','Must accept terms','','','REL-9','Alt summary','Extra review'],
    ['RP-102','Export CSV','1.0','UI','Medium','In Progress','1.1','export','Add export button','Feature','UI','EP-1','CSV format','Implemented','Reviewed','REL-8','',''],
    ['RP-103','Filter issue keys','1.1','API','High','Open','','filter','Allow key upload','Task','API','EP-2','','','','','', ''],
    ['RP-104','Blank review info','1.1','Core','Low','Done','1.2','review','Need review info','Bug','Core','EP-2','Provide text','Solution text','','REL-5','Alt summary 2',''],
    ['RP-105','Large file support','2.0','Core','High','Open','2.1','perf','Handle 1000+ rows','Task','Core','EP-3','Performance','','','REL-3','',''],
    ['RP-106','Duplicate headers','2.0','ETL','Medium','Open','2.0','headers','Merge dup headers','Bug','ETL','EP-3','Merge correctly','Done','Reviewed','REL-4','Dup summary','Dup review'],
    ['RP-107','Missing solution','2.1','API','Medium','In Review','2.2','solution','Add solution field','Bug','API','EP-4','Needs details','','','REL-1','',''],
    ['RP-108','Completed review','2.2','UI','Low','Done','2.3','review','Finalize review','Task','UI','EP-4','Ok','Done','Complete','REL-2','','']
]

wb = Workbook()
ws = wb.active
ws.title = 'Issues'
ws.append(columns)
for row in rows:
    ws.append(row)

xlsx_path.parent.mkdir(parents=True, exist_ok=True)
if xlsx_path.exists():
    xlsx_path.unlink()
wb.save(xlsx_path)
print(f'Wrote {xlsx_path}')
