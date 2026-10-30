"""Offline, dictionary-only candidates for buildVocabularyEnrichment.mjs.

Install the pinned generator requirements, then run this against the saved public
word_bank snapshot. This is a content preparation tool, not an app dependency.
"""
import argparse
import json
import re
from pathlib import Path
from lemminflect import getAllInflections
from wordfreq import zipf_frequency

parser=argparse.ArgumentParser()
parser.add_argument('--snapshot',type=Path,default=Path('.superpowers/qa/vocabulary-enrichment/word-bank-before.json'))
parser.add_argument('--output',type=Path,default=Path('.superpowers/qa/vocabulary-enrichment/lexical-candidates.json'))
args=parser.parse_args()
records=[]
for row in json.loads(args.snapshot.read_text(encoding='utf8')):
    word=row['word'].strip().lower()
    tags=set(re.findall(r'[a-z]+',row.get('pos','').lower()))
    upos=[]
    if tags.intersection({'v','vt','vi','verb'}):upos.append('VERB')
    if tags.intersection({'n','noun'}) and not tags.intersection({'pl','plural'}):upos.append('NOUN')
    if tags.intersection({'adj','adjective'}):upos.append('ADJ')
    records.append({'id':row['id'],'level':row['level'],'word':row['word'],'pos':row['pos'],
                    'meaning':row['meaning'],'zipf':zipf_frequency(word,'en'),
                    'inflections':{pos:getAllInflections(word,upos=pos) for pos in upos}})
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'records':len(records),'output':str(args.output)}))
