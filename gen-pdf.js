const PDFDocument = require('pdfkit');
const fs = require('fs');
const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
const out = fs.createWriteStream('/home/runner/workspace/guardian-scalability-costs.pdf');
doc.pipe(out);
const W=595.28,H=841.89,ML=50,CW=495.28,FOOTER=26,BOT=H-FOOTER-10;
const B='#1e3a5f',A='#2563eb',G='#374151',LB='#f8fafc',AL='#eef2f7',BD='#d1d5db',WH='#ffffff';
function need(n){if(doc.y+n>BOT)doc.addPage();}
function skip(n){doc.y+=(n||5);}
function h1(t){need(40);skip(10);const y=doc.y;doc.rect(ML,y,CW,26).fill(B);doc.fillColor(WH).fontSize(11).font('Helvetica-Bold').text(t,ML+10,y+7,{width:CW-20,lineBreak:false});doc.y=y+34;}
function h2(t){need(22);skip(6);doc.fontSize(10).font('Helvetica-Bold').fillColor(A).text(t,ML,doc.y,{width:CW});skip(4);}
function p(t){need(20);doc.fontSize(9.5).font('Helvetica').fillColor(G).text(t,ML,doc.y,{width:CW,lineGap:2});skip(6);}
function bl(t){need(14);doc.fontSize(9.5).font('Helvetica').fillColor(G).text('\u2022  '+t,ML+14,doc.y,{width:CW-14,lineGap:2});skip(2);}
function tbl(cols,rows,rh){
  rh=rh||24;const tw=cols.reduce((s,c)=>s+c.w,0),hh=22;
  need(hh+rh+10);let x=ML,top=doc.y;
  doc.rect(ML,top,tw,hh).fill(B);
  cols.forEach(c=>{doc.fillColor(WH).fontSize(8.5).font('Helvetica-Bold').text(c.h,x+5,top+6,{width:c.w-10,lineBreak:false});x+=c.w;});
  doc.y=top+hh;
  rows.forEach((row,ri)=>{
    need(rh+2);const ry=doc.y;
    doc.rect(ML,ry,tw,rh).fill(ri%2===0?WH:AL).stroke(BD).lineWidth(0.3);
    x=ML;row.forEach((cell,ci)=>{doc.fillColor(G).fontSize(8.5).font('Helvetica').text(cell,x+5,ry+6,{width:cols[ci].w-10,lineGap:1.5});x+=cols[ci].w;});
    doc.y=ry+rh;
  });
  skip(10);
}
function box(label,detail){
  need(58);const y=doc.y;
  doc.rect(ML,y,CW,52).fill(LB).stroke(BD).lineWidth(0.5);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(B).text(label,ML+12,y+10,{width:CW-24,lineBreak:false});
  doc.fontSize(8.5).font('Helvetica').fillColor(G).text(detail,ML+12,y+27,{width:CW-24,lineGap:2});
  doc.y=y+60;
}
// HEADER
doc.rect(0,0,W,88).fill(B);
doc.fillColor(WH).fontSize(19).font('Helvetica-Bold').text('Guardian Group Compliance Portal',ML,18,{width:CW});
doc.fontSize(10).font('Helvetica').text('Full Cost Projection \u2014 Portal, App & AI Layer',ML,48,{width:CW});
doc.fontSize(9).fillColor('#93c5fd').text('HR  \u2022  Health & Safety  \u2022  Employment Law',ML,70,{width:CW});
doc.y=106;
// CONTENT
h1('Overview');
p('This document covers the full monthly cost picture across four growth stages: server infrastructure, Replit platform (seats, Agent, and deployment), in-house team employment, the Guardian mobile app, and an AI layer. All figures are estimates based on mid-2026 pricing.');
p('Assumptions: 5 client users per company; 100 consultants and 200 admin users (fixed); 3 sites per company; 20 documents per site per year. Currently: 1 part-time (PT) developer.');
h1('Scale Reference');
tbl([{h:'Stage',w:56},{h:'Companies',w:76},{h:'Client Users',w:76},{h:'Total Users',w:75},{h:'Sites',w:60},{h:'Docs/year',w:152.28}],
  [['Stage 1','100','500','800','300','6,000'],['Stage 2','1,000','5,000','5,300','3,000','60,000'],['Stage 3','5,000','25,000','25,300','15,000','300,000'],['Stage 4','10,000','50,000','50,300','30,000','600,000']],22);
h1('1. Server & Infrastructure');
p('Covers the server running the portal, the database, and file storage. Grows with companies and usage volume.');
tbl([{h:'Stage',w:55},{h:'Companies',w:72},{h:'Server (Hosting)',w:108},{h:'Database',w:88},{h:'Storage',w:80},{h:'Total/mo',w:92.28}],
  [['Stage 1','100','\u00a350\u2013100','\u00a330\u201350','\u00a35','\u00a385\u2013155'],['Stage 2','1,000','\u00a3200\u2013350','\u00a3100\u2013180','\u00a320\u201335','\u00a3320\u2013565'],['Stage 3','5,000','\u00a3800\u20131,400','\u00a3350\u2013700','\u00a380\u2013150','\u00a31,230\u20132,250'],['Stage 4','10,000','\u00a32,000\u20133,500','\u00a3700\u20131,400','\u00a3150\u2013280','\u00a32,850\u20135,180']],22);
box('Cost per company (infrastructure only):','Stage 1: \u00a30.85\u20131.55  \u2022  Stage 2: \u00a30.32\u20130.57  \u2022  Stage 3: \u00a30.25\u20130.45  \u2022  Stage 4: \u00a30.29\u20130.52');
h1('2. Replit Platform \u2014 Seats, Agent & Deployment');
h2('Developer seats (~\u00a320\u201330/person/month)');
p('Each developer needs a Replit Core or Teams subscription covering the development environment and basic AI assistance.');
h2('Replit Agent (AI-assisted coding)');
p('Replit Agent writes, edits, and debugs code on instruction. Charged on usage above the plan allowance \u2014 scales with development activity, not with the number of portal users.');
bl('Light usage (maintenance only): \u00a320\u201350/month');
bl('Moderate (regular feature work): \u00a360\u2013150/month');
bl('Heavy (active build sprints): \u00a3150\u2013400/month');
skip(4);
h2('Replit deployment');
p('Stages 1\u20132: Replit hosts the portal application. Stages 3\u20134: app migrates to dedicated cloud (GCP/AWS) and Replit is used for development only.');
tbl([{h:'Stage',w:55},{h:'Companies',w:68},{h:'Seats',w:85},{h:'Agent (typical)',w:110},{h:'Deployment',w:95},{h:'Replit Total/mo',w:82.28}],
  [['Stage 1','100','\u00a320\u201330','\u00a330\u201380','\u00a315\u201330 (basic VM)','\u00a365\u2013140'],['Stage 2','1,000','\u00a340\u201360','\u00a360\u2013150','\u00a330\u201360 (std VM)','\u00a3130\u2013270'],['Stage 3','5,000','\u00a360\u201390','\u00a380\u2013200','Migrated to cloud','\u00a3140\u2013290'],['Stage 4','10,000','\u00a380\u2013150','\u00a3100\u2013250','Migrated to cloud','\u00a3180\u2013400']],30);
h1('3. In-House Development Team');
p('Total employment cost = gross salary x ~1.30 (employer NI ~13.8%, pension ~5%, equipment/training ~10%). UK 2026 benchmarks: PT \u00a322k\u201328k | Junior FT \u00a328k\u201336k | Mid FT \u00a342k\u201355k | Senior FT \u00a362k\u201380k.');
tbl([{h:'Stage',w:52},{h:'Companies',w:65},{h:'Team Composition',w:168},{h:'Gross Salaries/yr',w:105},{h:'Employment Cost/mo',w:105.28}],
  [['Stage 1','100','1x PT Developer (current)','~\u00a322,000\u201328,000','~\u00a32,400\u20133,000'],['Stage 2','1,000','1x FT Mid-level Developer','~\u00a345,000\u201355,000','~\u00a34,900\u20135,900'],['Stage 3','5,000','1x FT Senior + 1x FT Mid','~\u00a3115,000\u2013135,000','~\u00a312,500\u201314,600'],['Stage 4','10,000','1x Senior + 2x Mid + 1x Junior','~\u00a3175,000\u2013210,000','~\u00a318,900\u201322,700']],36);
h1('4. Guardian Mobile App');
p('The Guardian app extends the portal to iOS and Android using the existing backend. No new server needed \u2014 mobile traffic adds a small uplift to existing infrastructure at higher stages.');
bl('Apple Developer Programme: \u00a379/year (~\u00a37/month)');
bl('Google Play account: \u00a320 one-off');
bl('Expo EAS build pipeline: free at Stage 1, \u00a325\u201399/month at Stages 2\u20134');
bl('App development covered by existing team at Stages 1\u20132; a dedicated mobile developer may be added at Stage 4');
skip(4);
tbl([{h:'Stage',w:55},{h:'Companies',w:68},{h:'Build Pipeline (Expo EAS)',w:155},{h:'App Store Fees/mo',w:108},{h:'App Total/mo',w:109.28}],
  [['Stage 1','100','Free tier','\u00a37','\u00a37\u201315'],['Stage 2','1,000','\u00a325\u201360/mo','\u00a37','\u00a332\u201367'],['Stage 3','5,000','\u00a360\u201399/mo','\u00a37','\u00a367\u2013106'],['Stage 4','10,000','\u00a399/mo','\u00a37','\u00a3106\u2013120']],28);
h1('5. AI Layer');
p('Adding AI features \u2014 document analysis, risk scoring, compliance chatbot, automated reporting \u2014 introduces API costs that scale with how many users trigger AI features and how intensively they use them.');
p('AI providers charge per token (roughly per word). One interaction uses ~1,000\u20135,000 tokens. Lighter models cost ~10x less than flagship models and handle most everyday tasks well.');
tbl([{h:'Usage Level',w:105},{h:'What it covers',w:200},{h:'Stage 1\u20132/mo',w:80},{h:'Stage 3/mo',w:75},{h:'Stage 4/mo',w:CW-460}],
  [['Light','Document tagging, basic summaries','\u00a320\u201380','\u00a3150\u2013400','\u00a3400\u2013900'],['Medium','Compliance chatbot, risk scoring, auto-drafting','\u00a3100\u2013400','\u00a3600\u20132,000','\u00a32,000\u20136,000'],['Heavy','Full AI assistant, bulk document analysis','\u00a3400\u20131,200','\u00a32,500\u20136,000','\u00a36,000\u201320,000']],36);
box('Recommendation: start light, measure, then expand.','Begin with a cheaper model (e.g. GPT-4o Mini) for everyday tasks \u2014 keeps early AI costs under \u00a3100/month while features mature. Scale up only where it creates clear client value.');
h1('Full Monthly Cost Summary');
p('All costs combined. App and AI are optional \u2014 the portal runs without them. Core Total = infrastructure + Replit + team only.');
tbl([{h:'Stage',w:50},{h:'Co.',w:52},{h:'Infra',w:82},{h:'Replit',w:72},{h:'Team',w:88},{h:'App (+opt)',w:72},{h:'AI (+opt)',w:72},{h:'Core Total',w:CW-488}],
  [['Stage 1','100','\u00a385\u2013155','\u00a365\u2013140','\u00a32,400\u20133,000','+\u00a37\u201315','+\u00a3100\u2013400','\u00a32,550\u20133,295'],['Stage 2','1,000','\u00a3320\u2013565','\u00a3130\u2013270','\u00a34,900\u20135,900','+\u00a332\u201367','+\u00a3400\u20132,000','\u00a35,350\u20136,735'],['Stage 3','5,000','\u00a31,230\u20132,250','\u00a3140\u2013290','\u00a312,500\u201314,600','+\u00a367\u2013106','+\u00a32,000\u20136,000','\u00a313,870\u201317,140'],['Stage 4','10,000','\u00a32,850\u20135,180','\u00a3180\u2013400','\u00a318,900\u201322,700','+\u00a3106\u2013120','+\u00a36,000\u201320,000','\u00a321,930\u201328,280']],32);
h1('Key Takeaways');
h2('Team is the dominant cost \u2014 and the right investment');
bl('At every stage, people cost more than servers, platform, and all tools combined');
bl('An owned team builds institutional knowledge and moves faster than contractors over the medium term');
h2('Replit Agent is a sprint cost, not a fixed overhead');
bl('Heavy agent use adds \u00a3150\u2013400/month during build sprints, dropping sharply in quieter periods');
bl('Budget it per sprint rather than as a fixed monthly line item');
h2('The Guardian app adds modest ongoing costs');
bl('App store and build pipeline: \u00a37\u2013120/month \u2014 developer time is covered by the existing team budget at Stages 1\u20132');
h2('AI scales with usage, not company count');
bl('Start light (under \u00a3100/month) while features are proven; factor heavy AI usage into client pricing at scale');
h2('No rebuild needed at any stage');
bl('The same codebase carries the business from Stage 1 to Stage 4 \u2014 each step is additive, not disruptive');
h1('Summary');
need(112);
const st=doc.y;
doc.rect(ML,st,CW,100).fill(LB).stroke(BD).lineWidth(0.5);
doc.fontSize(9.5).font('Helvetica').fillColor(G).text('The full monthly cost ranges from approximately \u00a32,500\u20133,300 at 100 companies (1 PT developer + infrastructure + Replit) to \u00a322,000\u201328,000 at 10,000 companies (4-person team, full infrastructure). Adding the Guardian app and a medium AI layer extends the upper range but remains commercially viable at each stage. Team employment dominates costs throughout, reinforcing that building an owned team is the right long-term decision. Infrastructure, Replit, and platform costs are a small and predictable fraction of the total at every stage.',ML+12,st+12,{width:CW-24,lineGap:3});
doc.y=st+108;skip(6);
doc.fontSize(7.5).font('Helvetica').fillColor('#9ca3af').text('Disclaimer: Indicative estimates based on mid-2026 pricing. Salaries reflect UK market benchmarks. AI costs based on current OpenAI/Anthropic API pricing. Infrastructure based on cloud provider list rates. Actual costs will vary. A formal financial assessment is recommended.',ML,doc.y,{width:CW,lineGap:2});
// Footers
const rng=doc.bufferedPageRange(),total=rng.count;
for(let i=0;i<total;i++){
  doc.switchToPage(rng.start+i);
  doc.rect(0,H-FOOTER,W,FOOTER).fill(B);
  doc.fillColor('#93c5fd').fontSize(7.5).font('Helvetica').text('Guardian Group Compliance Portal  \u2014  Full Cost Projection  \u2014  Confidential  \u2014  Page '+(i+1)+' of '+total,0,H-FOOTER+9,{align:'center',width:W});
}
doc.end();
out.on('finish',()=>console.log('Pages:'+total));
