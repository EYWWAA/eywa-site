import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
import {createProspects} from '../src/lib/crm-prospects.mjs';
test('prospect: suppression de la fiche, de son historique et de ses rendez-vous',async()=>{
 const raw=new DatabaseSync(':memory:');for(const f of ['0012_crm_prospects.sql','0014_crm_meetings.sql','0017_prospect_call_sheet.sql','0022_prospect_company.sql','0023_prospect_idea.sql','0024_prospect_budget.sql'])raw.exec(fs.readFileSync(new URL('../migrations/'+f,import.meta.url),'utf8'));
 const DB={prepare(s){return{bind(...a){const q=raw.prepare(s);return{first:async()=>q.get(...a)||null,all:async()=>({results:q.all(...a)}),run:async()=>q.run(...a),_run:()=>q.run(...a)}}}},async batch(r){return r.map(x=>({meta:x._run()}))}};
 const pr=createProspects({DB});
 const {id}=await pr.mutate('prospect',{name:'Personne Fictive',source:'linkedin',status:'a-contacter',companyAbout:'Entreprise fictive'});
 assert.equal((await pr.details(id)).company_about,'Entreprise fictive');
 await pr.mutate('prospect-log',{prospectId:id,kind:'linkedin',date:'2026-11-24',summary:'Message envoyé'});
 await pr.mutate('prospect-delete',{id});
 assert.equal(raw.prepare('SELECT COUNT(*) n FROM eywa_crm_prospects').get().n,0);
 assert.equal(raw.prepare('SELECT COUNT(*) n FROM eywa_crm_prospect_events').get().n,0);
 await assert.rejects(pr.mutate('prospect-delete',{id}),/introuvable/);
});
