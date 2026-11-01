import{m as e}from"./validate-CLwWOfj_.js";import{C as t,E as n,S as r,b as i,s as a}from"./index-B-QxGHHV.js";var o={name:`file-up`,size:24,node:[[`path`,{d:`M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z`,key:`1oefj6`}],[`path`,{d:`M14 2v5a1 1 0 0 0 1 1h5`,key:`wfsgrz`}],[`path`,{d:`M12 12v6`,key:`3ahymv`}],[`path`,{d:`m15 15-3-3-3 3`,key:`15xj92`}]]};o.node;var s=i(o),c=n(t(),1),l=r();function u({id:t,accept:n,multiple:r,maxFiles:i=1,maxMB:o=5,files:u,onChange:d,label:f}){let p=(0,c.useRef)(null),[m,h]=(0,c.useState)(!1),[g,_]=(0,c.useState)(``),v=e=>{if(!e)return;_(``);let t=r?[...u]:[];for(let r of Array.from(e)){let e=`.`+(r.name.split(`.`).pop()??``).toLowerCase();if(!n.includes(e))_(`"${r.name}" is not allowed. Use ${n.join(`, `)}`);else if(r.size>o*1024*1024)_(`"${r.name}" is larger than ${o} MB`);else if(r.size===0)_(`"${r.name}" is empty`);else if(t.some(e=>e.name===r.name))_(`"${r.name}" is already added`);else{if(t.length>=i){_(`Maximum ${i} file${i>1?`s`:``}`);break}t.push(r)}}d(t),p.current&&(p.current.value=``)};return(0,l.jsxs)(`div`,{children:[(0,l.jsxs)(`button`,{type:`button`,onClick:()=>p.current?.click(),onDragOver:e=>{e.preventDefault(),h(!0)},onDragLeave:()=>h(!1),onDrop:e=>{e.preventDefault(),h(!1),v(e.dataTransfer.files)},className:`group flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-center transition ${m?`border-[var(--accent,var(--violet))] bg-surface-2`:`border-line-strong bg-surface hover:border-[var(--accent,var(--violet))]`}`,children:[(0,l.jsx)(`span`,{className:`grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-[var(--accent,var(--violet))] transition group-hover:scale-110`,children:(0,l.jsx)(s,{size:20})}),(0,l.jsx)(`span`,{className:`text-sm font-medium text-ink`,children:f??(r?`Drop files here or click to browse`:`Drop a file here or click to browse`)}),(0,l.jsxs)(`span`,{className:`text-xs text-muted`,children:[n.join(`, `),` · up to `,o,` MB`,r?` · max ${i} files`:``]})]}),(0,l.jsx)(`input`,{ref:p,id:t,type:`file`,className:`sr-only`,accept:n.join(`,`),multiple:r,onChange:e=>v(e.target.files)}),g&&(0,l.jsx)(`p`,{className:`mt-2 text-xs font-medium text-bad`,children:g}),u.length>0&&(0,l.jsx)(`ul`,{className:`mt-3 space-y-2`,children:u.map(t=>(0,l.jsxs)(`li`,{className:`flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2 text-sm`,children:[(0,l.jsx)(e,{size:16,className:`shrink-0 text-[var(--accent,var(--violet))]`}),(0,l.jsx)(`span`,{className:`min-w-0 flex-1 truncate text-ink`,children:t.name}),(0,l.jsxs)(`span`,{className:`font-mono text-[11px] text-muted`,children:[(t.size/1024).toFixed(1),` KB`]}),(0,l.jsx)(`button`,{type:`button`,"aria-label":`Remove ${t.name}`,onClick:()=>d(u.filter(e=>e!==t)),className:`rounded-md p-1 text-muted hover:bg-surface-2 hover:text-bad`,children:(0,l.jsx)(a,{size:14})})]},t.name))})]})}var d=`Product Sync - 28 October 2026
Attendees: Anita (Product Manager), Ravi (Backend Lead), Sana (Designer), Karthik (QA)

Anita: Thanks everyone. Main agenda is the mobile app launch date and the payment bug. Ravi, where are we on the payment bug?
Ravi: We found the root cause. The retry logic was charging twice when the bank timed out. The fix is ready and in review.
Anita: Great. Karthik, can you test the fix on staging?
Karthik: Yes, I will finish regression testing on staging by Thursday, 30 October.
Anita: Good. Now the launch. Marketing wants 15 November. Is that realistic?
Ravi: Backend is fine for 15 November if the payment fix ships this week.
Sana: The onboarding screens still need one round of user testing. I can run it with five users on Monday 3 November.
Anita: OK, so we agree: launch date is 15 November, as long as the payment fix passes QA. Everyone agrees?
Ravi: Agreed.
Sana: Agreed.
Anita: Decision made then. Also, we decided to drop the dark mode feature from version 1 and move it to version 1.1, because we don't have design time.
Sana: Yes, I prefer that. I will share the updated onboarding designs with the team by Friday.
Anita: I will update the launch plan and send it to marketing by tomorrow. Ravi, please write the release notes for the payment fix.
Ravi: Sure, I'll have them ready before the fix ships.
Anita: One open question is whether we support Android 10. Let's look at the analytics next week before deciding.
Karthik: I can pull the Android version stats, no deadline needed.
Anita: Thanks all, meeting closed.`,f=`order_id,date,product,region,units,unit_price,revenue
ORD-1035,2026-07-01,SmartMug,West,18,899,16182
ORD-1118,2026-07-02,EcoBottle,East,14,499,6986
ORD-1112,2026-07-03,TravelFlask,North,1,699,699
ORD-1113,2026-07-03,SmartMug,West,8,899,7192
ORD-1044,2026-07-04,EcoBottle,South,20,499,9980
ORD-1052,2026-07-04,TravelFlask,North,9,699,6291
ORD-1057,2026-07-04,TravelFlask,West,9,699,6291
ORD-1007,2026-07-06,SmartMug,East,14,899,12586
ORD-1042,2026-07-07,EcoBottle,North,19,499,9481
ORD-1002,2026-07-08,SmartMug,North,3,899,2697
ORD-1026,2026-07-08,SmartMug,East,5,899,4495
ORD-1074,2026-07-08,TravelFlask,West,19,699,13281
ORD-1079,2026-07-08,TravelFlask,West,4,699,2796
ORD-1097,2026-07-09,EcoBottle,South,4,499,1996
ORD-1001,2026-07-10,EcoBottle,East,19,499,9481
ORD-1088,2026-07-10,SmartMug,East,4,899,3596
ORD-1103,2026-07-10,TravelFlask,North,3,699,2097
ORD-1028,2026-07-11,SmartMug,West,13,899,11687
ORD-1032,2026-07-11,SmartMug,South,8,899,7192
ORD-1098,2026-07-11,TravelFlask,East,2,699,1398
ORD-1004,2026-07-12,KidsSipper,North,19,349,6631
ORD-1094,2026-07-12,TravelFlask,North,11,699,7689
ORD-1039,2026-07-14,KidsSipper,West,2,349,698
ORD-1049,2026-07-14,TravelFlask,East,16,699,11184
ORD-1047,2026-07-15,KidsSipper,West,16,349,5584
ORD-1005,2026-07-16,SmartMug,North,19,899,17081
ORD-1107,2026-07-17,EcoBottle,South,4,499,1996
ORD-1090,2026-07-18,KidsSipper,South,4,349,1396
ORD-1008,2026-07-19,EcoBottle,East,18,499,8982
ORD-1078,2026-07-19,KidsSipper,North,18,349,6282
ORD-1018,2026-07-20,KidsSipper,West,2,349,698
ORD-1043,2026-07-20,EcoBottle,East,20,499,9980
ORD-1076,2026-07-20,EcoBottle,West,6,499,2994
ORD-1089,2026-07-20,TravelFlask,South,9,699,6291
ORD-1041,2026-07-21,EcoBottle,East,20,499,9980
ORD-1092,2026-07-21,KidsSipper,West,11,349,3839
ORD-1108,2026-07-21,TravelFlask,North,6,699,4194
ORD-1119,2026-07-21,EcoBottle,North,13,499,6487
ORD-1066,2026-07-22,SmartMug,North,5,899,4495
ORD-1099,2026-07-24,TravelFlask,South,14,699,9786
ORD-1040,2026-07-25,EcoBottle,South,15,499,7485
ORD-1055,2026-07-25,SmartMug,West,8,899,7192
ORD-1058,2026-07-25,TravelFlask,West,12,699,8388
ORD-1071,2026-07-25,SmartMug,North,9,899,8091
ORD-1056,2026-07-26,KidsSipper,East,1,349,349
ORD-1109,2026-07-26,TravelFlask,East,17,699,11883
ORD-1012,2026-07-27,KidsSipper,West,11,349,3839
ORD-1061,2026-07-27,KidsSipper,North,16,349,5584
ORD-1110,2026-07-27,TravelFlask,West,17,699,11883
ORD-1072,2026-07-28,TravelFlask,South,19,699,13281
ORD-1054,2026-07-29,TravelFlask,South,20,699,13980
ORD-1060,2026-07-30,KidsSipper,South,11,349,3839
ORD-1116,2026-07-30,TravelFlask,South,5,699,3495
ORD-1014,2026-08-01,SmartMug,South,3,899,2697
ORD-1027,2026-08-01,KidsSipper,West,16,349,5584
ORD-1085,2026-08-03,SmartMug,West,5,899,4495
ORD-1104,2026-08-03,EcoBottle,South,3,499,1497
ORD-1105,2026-08-03,EcoBottle,West,1,499,499
ORD-1081,2026-08-05,EcoBottle,North,17,499,8483
ORD-1102,2026-08-05,EcoBottle,South,14,499,6986
ORD-1087,2026-08-10,EcoBottle,South,14,499,6986
ORD-1000,2026-08-11,SmartMug,West,2,899,1798
ORD-1073,2026-08-11,TravelFlask,West,5,699,3495
ORD-1083,2026-08-11,SmartMug,East,15,899,13485
ORD-1106,2026-08-13,KidsSipper,East,20,349,6980
ORD-1025,2026-08-15,SmartMug,North,16,899,14384
ORD-1059,2026-08-16,EcoBottle,South,4,499,1996
ORD-1036,2026-08-17,TravelFlask,South,17,699,11883
ORD-1045,2026-08-18,SmartMug,East,12,899,10788
ORD-1063,2026-08-19,SmartMug,West,6,899,5394
ORD-1096,2026-08-19,TravelFlask,East,17,699,11883
ORD-1038,2026-08-20,KidsSipper,West,13,349,4537
ORD-1091,2026-08-20,KidsSipper,South,8,349,2792
ORD-1117,2026-08-21,TravelFlask,North,5,699,3495
ORD-1086,2026-08-23,EcoBottle,West,15,499,7485
ORD-1093,2026-08-23,SmartMug,East,11,899,9889
ORD-1003,2026-08-25,KidsSipper,North,8,349,2792
ORD-1064,2026-08-25,TravelFlask,North,13,699,9087
ORD-1016,2026-08-27,TravelFlask,North,4,699,2796
ORD-1082,2026-08-27,EcoBottle,North,15,499,7485
ORD-1114,2026-08-27,EcoBottle,West,16,499,7984
ORD-1021,2026-08-28,EcoBottle,North,9,499,4491
ORD-1013,2026-08-29,KidsSipper,East,10,349,3490
ORD-1065,2026-08-29,KidsSipper,North,6,349,2094
ORD-1022,2026-08-30,EcoBottle,North,10,499,4990
ORD-1048,2026-08-31,TravelFlask,North,5,699,3495
ORD-1017,2026-09-04,KidsSipper,South,11,349,3839
ORD-1084,2026-09-04,KidsSipper,South,17,349,5933
ORD-1053,2026-09-05,TravelFlask,South,12,699,8388
ORD-1075,2026-09-05,KidsSipper,South,18,349,6282
ORD-1051,2026-09-06,TravelFlask,South,18,699,12582
ORD-1101,2026-09-07,KidsSipper,East,3,349,1047
ORD-1115,2026-09-08,KidsSipper,East,7,349,2443
ORD-1011,2026-09-09,EcoBottle,North,28,499,13972
ORD-1029,2026-09-09,TravelFlask,South,14,699,9786
ORD-1030,2026-09-09,TravelFlask,West,12,699,8388
ORD-1069,2026-09-09,SmartMug,North,1,899,899
ORD-1095,2026-09-09,KidsSipper,West,1,349,349
ORD-1080,2026-09-10,EcoBottle,South,15,499,7485
ORD-1010,2026-09-12,SmartMug,East,4,899,3596
ORD-1015,2026-09-12,TravelFlask,West,11,699,7689
ORD-1006,2026-09-13,KidsSipper,North,8,349,2792
ORD-1034,2026-09-14,SmartMug,East,10,899,8990
ORD-1067,2026-09-14,KidsSipper,South,20,349,6980
ORD-1068,2026-09-15,KidsSipper,East,5,349,1745
ORD-1046,2026-09-16,TravelFlask,West,4,699,2796
ORD-1077,2026-09-16,EcoBottle,South,14,499,6986
ORD-1037,2026-09-18,EcoBottle,West,26,499,12974
ORD-1023,2026-09-21,KidsSipper,East,13,349,4537
ORD-1062,2026-09-22,TravelFlask,North,4,699,2796
ORD-1070,2026-09-22,EcoBottle,South,22,499,10978
ORD-1033,2026-09-23,SmartMug,North,16,899,14384
ORD-1019,2026-09-24,EcoBottle,East,19,499,9481
ORD-1024,2026-09-24,TravelFlask,North,15,699,10485
ORD-1100,2026-09-25,TravelFlask,West,5,699,3495
ORD-1111,2026-09-25,SmartMug,East,12,899,10788
ORD-1009,2026-09-26,SmartMug,North,19,899,17081
ORD-1031,2026-09-26,KidsSipper,South,5,349,1745
ORD-1020,2026-09-27,TravelFlask,West,19,699,13281
ORD-1050,2026-09-27,SmartMug,North,7,899,6293`,p=`Why Small Farms Are Turning to AI

For decades, precision agriculture was something only large farms could afford. Satellite imagery, soil sensors and yield-mapping combines cost tens of thousands of dollars. That is changing fast. Cheap smartphones, free weather data and low-cost sensors now let small farmers use the same kind of artificial intelligence that big agribusinesses rely on.

The first big win is pest and disease detection. Farmers can take a photo of a leaf with a phone app, and a computer vision model identifies the problem in seconds. Catching a fungal infection a week earlier can save a large part of the harvest, and the farmer sprays only the plants that need it, which cuts chemical costs.

The second win is water. AI-driven irrigation systems combine soil moisture readings with weather forecasts and water the field only when the crop actually needs it. Farmers using these systems commonly report water savings of 20 to 30 percent, which matters more every year as droughts become more frequent.

Third, AI helps with selling, not just growing. Price-forecasting tools look at market data and tell farmers the best week to sell. Instead of selling everything at harvest, when prices are lowest, farmers can store and sell when demand is higher.

There are real challenges. Many rural areas still have poor internet connectivity. Some farmers do not trust recommendations they cannot understand, and the apps are often not available in local languages. Data ownership is another concern: farmers want to know who controls the data collected from their fields.

The lesson from early adopters is to start small. Pick one problem, such as pest detection or irrigation, measure the results for a season, and expand from there. Cooperatives can share the cost of sensors and training, so no single farmer carries all the risk.

AI will not replace the knowledge farmers have built over generations. But used well, it can turn that knowledge into better decisions, higher yields and more sustainable farming.`,m=`Backend Python Developer (2+ years)
Must have: Python, FastAPI or Django, REST API design, SQL (PostgreSQL), Git.
Nice to have: Docker, AWS, experience with LLMs / AI agents (CrewAI, LangChain), unit testing with pytest.
You will build and maintain APIs for our AI products.`,h=`Rohit Kumar
rohit.k@example.com

Objective: Looking for a role in graphic design.

Experience:
Graphic Designer, PixelPoint Studio (2021 - present)
- Designed social media creatives and brand logos using Photoshop and Illustrator.
- Created marketing brochures for 30+ clients.

Skills: Adobe Photoshop, Illustrator, Figma, basic HTML/CSS
Education: B.Des, NIFT Bengaluru, 2021`,g=`Ananya Reddy
Hyderabad | ananya.reddy@example.com

Summary: Backend developer with 3 years of experience building Python REST APIs.

Experience
Software Engineer, FinTrack Solutions (2023 - present)
- Built 25+ REST endpoints with FastAPI and PostgreSQL serving 50k daily users.
- Containerized services with Docker and deployed on AWS ECS.
- Wrote pytest suites raising coverage from 40% to 85%.
- Built an internal support chatbot using LangChain and CrewAI agents.

Junior Developer, CodeNest (2022 - 2023)
- Django REST Framework APIs, Git, code reviews.

Skills: Python, FastAPI, Django, PostgreSQL, SQLAlchemy, Docker, AWS, Git, pytest, CrewAI, LangChain
Education: B.Tech Computer Science, JNTU Hyderabad, 2022`;export{f as a,h as i,m as n,d as o,g as r,u as s,p as t};