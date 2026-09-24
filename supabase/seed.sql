-- =====================================================================
-- LanceNest — development seed data. Run AFTER 0001_schema.sql.
-- All companies and jobs here are FICTIONAL. Safe to re-run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Military occupation -> civilian translation starter set.
-- A starting point, not exhaustive coverage. To expand, the O*NET
-- Military Crosswalk (onetonline.org/crosswalk/MOC) is a good source.
-- ---------------------------------------------------------------------
insert into public.military_occupations (code, branch, title, civilian_categories, civilian_skills) values
  ('11B', 'Army', 'Infantryman',
    array['Operations Manager','Security Manager','Project Manager','Logistics Manager','Emergency Management','Program Manager'],
    array['Leadership','Team Operations','Mission Planning','Risk Management','Personnel Management']),
  ('25B', 'Army', 'Information Technology Specialist',
    array['IT Support','Systems Administrator','Network Administrator','Technical Support','Cybersecurity','IT Project Management'],
    array['Systems Administration','Network Troubleshooting','Help Desk Operations','IT Infrastructure']),
  ('68W', 'Army', 'Combat Medic Specialist',
    array['EMT / Paramedic','Medical Assistant','Clinical Operations','Healthcare Administration','Emergency Management'],
    array['Emergency Medical Care','Triage','Patient Care','Calm Under Pressure']),
  ('92Y', 'Army', 'Unit Supply Specialist',
    array['Logistics Manager','Supply Chain Analyst','Inventory Manager','Procurement Specialist'],
    array['Inventory Control','Supply Chain Operations','Property Accountability','Records Management']),
  ('88M', 'Army', 'Motor Transport Operator',
    array['Fleet Manager','Transportation Coordinator','Logistics Coordinator','Commercial Driver'],
    array['Fleet Operations','Route Planning','Vehicle Maintenance Oversight','Safety Compliance']),
  ('31B', 'Army', 'Military Police',
    array['Security Manager','Law Enforcement','Loss Prevention','Corporate Security','Emergency Management'],
    array['Physical Security','Incident Response','Investigations','Conflict De-escalation']),
  ('35F', 'Army', 'Intelligence Analyst',
    array['Intelligence Analyst','Business Analyst','Threat Analyst','Data Analyst','Risk Analyst'],
    array['Analysis & Reporting','Research','Threat Assessment','Briefing Senior Leaders']),
  ('42A', 'Army', 'Human Resources Specialist',
    array['HR Generalist','HR Coordinator','Recruiter','Payroll Specialist'],
    array['Personnel Administration','Records Management','Onboarding','Policy Compliance']),
  ('0311', 'Marine Corps', 'Rifleman',
    array['Operations Manager','Security Manager','Field Operations','Program Manager','Project Manager'],
    array['Leadership','Small-Unit Leadership','Team Operations','Adaptability','Mission Planning']),
  ('3531', 'Marine Corps', 'Motor Vehicle Operator',
    array['Fleet Manager','Transportation Coordinator','Logistics Coordinator'],
    array['Fleet Operations','Route Planning','Safety Compliance']),
  ('5811', 'Marine Corps', 'Military Police',
    array['Security Manager','Law Enforcement','Corporate Security','Loss Prevention'],
    array['Physical Security','Incident Response','Access Control','Conflict De-escalation']),
  ('HM', 'Navy', 'Hospital Corpsman',
    array['Medical Assistant','EMT / Paramedic','Clinical Operations','Healthcare Administration'],
    array['Patient Care','Emergency Medical Care','Clinical Documentation','Triage']),
  ('LS', 'Navy', 'Logistics Specialist',
    array['Logistics Manager','Supply Chain Analyst','Procurement Specialist','Warehouse Manager'],
    array['Inventory Control','Procurement','Supply Chain Operations','Financial Recordkeeping']),
  ('MA', 'Navy', 'Master-at-Arms',
    array['Security Manager','Law Enforcement','Corporate Security','Emergency Management'],
    array['Physical Security','Force Protection','Investigations','Incident Response']),
  ('IT', 'Navy', 'Information Systems Technician',
    array['Systems Administrator','Network Administrator','IT Support','Cybersecurity'],
    array['Network Administration','Systems Maintenance','Information Security','Help Desk Operations']),
  ('2T2X1', 'Air Force', 'Air Transportation',
    array['Logistics Manager','Supply Chain Analyst','Operations Coordinator','Warehouse Manager'],
    array['Cargo Operations','Logistics Coordination','Scheduling','Regulatory Compliance']),
  ('3P0X1', 'Air Force', 'Security Forces',
    array['Security Manager','Law Enforcement','Corporate Security','Emergency Management'],
    array['Physical Security','Access Control','Incident Response','Force Protection']),
  ('4N0X1', 'Air Force', 'Aerospace Medical Service',
    array['Medical Assistant','EMT / Paramedic','Clinical Operations','Healthcare Administration'],
    array['Patient Care','Clinical Documentation','Emergency Medical Care']),
  ('2S0X1', 'Air Force', 'Materiel Management',
    array['Supply Chain Analyst','Inventory Manager','Logistics Manager','Procurement Specialist'],
    array['Inventory Control','Supply Chain Operations','Asset Accountability']),
  ('BM', 'Coast Guard', 'Boatswain''s Mate',
    array['Marine Operations','Port Operations','Operations Manager','Safety Manager'],
    array['Vessel Operations','Crew Leadership','Safety Compliance','Search & Rescue'])
on conflict (code, branch) do nothing;

-- ---------------------------------------------------------------------
-- Skills
-- ---------------------------------------------------------------------
insert into public.skills (name, category) values
  ('Leadership','leadership'), ('Team Operations','leadership'), ('Mission Planning','military'),
  ('Risk Management','civilian'), ('Personnel Management','leadership'), ('Logistics','civilian'),
  ('Supply Chain Operations','civilian'), ('Physical Security','military'), ('Incident Response','civilian'),
  ('Project Management','civilian'), ('Program Management','civilian'), ('Network Administration','software'),
  ('Systems Administration','software'), ('Cybersecurity','software'), ('Microsoft Excel','software'),
  ('ServiceNow','software'), ('Salesforce','software'), ('Data Analysis','civilian'),
  ('Patient Care','civilian'), ('Fleet Operations','civilian'), ('Customer Relationship Management','civilian'),
  ('Training & Development','leadership'), ('Emergency Management','civilian'), ('Procurement','civilian')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 10 fictional companies
-- ---------------------------------------------------------------------
insert into public.companies (name, slug, industry, headquarters, website, about, mission, benefits, veteran_commitment, is_verified) values
  ('Harborline Defense Group','harborline-defense-group','Defense','Newport, RI', null,
   'Fictional company for development. Harborline supports naval and coastal defense programs across New England.',
   'Keep the coastline safe and the mission moving.', 'Medical, dental, 401(k) match, tuition assistance.',
   'Nearly a third of our team served. We translate your record, not ignore it.', true),
  ('Meridian Federal Systems','meridian-federal-systems','Government Contracting','Arlington, VA', null,
   'Fictional company for development. Meridian delivers IT modernization for federal agencies.',
   'Modern systems for the people who serve the public.', 'Remote flexibility, clearance sponsorship, 401(k).',
   'Clearance-holding veterans are our first call on every new program.', true),
  ('Anchor & Oak Logistics','anchor-and-oak-logistics','Logistics','Charleston, SC', null,
   'Fictional company for development. Regional freight, warehousing, and port logistics.',
   'Move what matters, on time.', 'Medical, paid leave, CDL training reimbursement.',
   'We hire supply and motor transport veterans into leadership roles.', true),
  ('Sentinel Watch Security','sentinel-watch-security','Security','Boston, MA', null,
   'Fictional company for development. Corporate and physical security services.',
   'Protect people, places, and trust.', 'Medical, overtime, advancement track to site manager.',
   'Military police and security forces veterans lead most of our sites.', false),
  ('Brass Compass Consulting','brass-compass-consulting','Consulting','Washington, DC', null,
   'Fictional company for development. Operations and program management consulting.',
   'Bring discipline to complex programs.', 'Hybrid schedule, bonus program, PMP sponsorship.',
   'We recruit transitioning officers and NCOs into program leadership.', true),
  ('Liberty Coast Health','liberty-coast-health','Healthcare','Portsmouth, NH', null,
   'Fictional company for development. Community hospital and clinic network.',
   'Care for the whole community.', 'Medical, tuition support, shift differentials.',
   'Corpsmen and medics bring skills we value from day one.', true),
  ('Keel Point Manufacturing','keel-point-manufacturing','Manufacturing','Groton, CT', null,
   'Fictional company for development. Precision components for marine systems.',
   'Build it right the first time.', 'Medical, pension, apprenticeship programs.',
   'SkillBridge partner-style internships for members in their final months of service.', false),
  ('Summit Line Cyber','summit-line-cyber','Cybersecurity','Remote', null,
   'Fictional company for development. Managed security operations for mid-size companies.',
   'Stand the watch so our clients can sleep.', 'Fully remote, certification budget, equity.',
   'Cyber and signal veterans make up our SOC leadership.', true),
  ('Patriot Grid Energy','patriot-grid-energy','Energy','Pittsburgh, PA', null,
   'Fictional company for development. Utility infrastructure and field services.',
   'Keep the lights on for every town we serve.', 'Medical, union-scale wages, safety bonuses.',
   'Field operations crews led by veterans who know how to work safely under pressure.', false),
  ('Old Colony Builders','old-colony-builders','Construction','Plymouth, MA', null,
   'Fictional company for development. Commercial construction and facilities management.',
   'Build structures that outlast us.', 'Medical, vehicle allowance, profit sharing.',
   'Combat engineers and Seabees fit right into our superintendent track.', false)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- 30 fictional jobs, spread across the 10 companies
-- ---------------------------------------------------------------------
with cos as (
  select id, name, industry, headquarters, row_number() over (order by slug) - 1 as idx
  from public.companies
  where slug in ('harborline-defense-group','meridian-federal-systems','anchor-and-oak-logistics',
    'sentinel-watch-security','brass-compass-consulting','liberty-coast-health','keel-point-manufacturing',
    'summit-line-cyber','patriot-grid-energy','old-colony-builders')
),
catalog as (
  select
    array['Operations Manager','Program Manager','Logistics Coordinator','Security Operations Supervisor',
      'IT Support Specialist','Systems Administrator','Network Engineer','Cybersecurity Analyst',
      'Project Coordinator','Field Service Technician','Emergency Management Specialist','Supply Chain Analyst',
      'Facilities Manager','Training & Development Specialist','HR Generalist','Medical Assistant',
      'Fleet Manager','Quality Assurance Inspector','Construction Superintendent','Intelligence Analyst',
      'Customer Success Manager','Military Talent Recruiter','Warehouse Operations Lead','Safety Manager',
      'Electrical Technician','Data Analyst','Procurement Specialist','Physical Security Specialist',
      'Federal Account Manager','SkillBridge Operations Intern'] as titles,
    array['entry','mid','senior','mid','entry','mid','senior','mid','entry','mid',
      'mid','mid','senior','mid','mid','entry','mid','mid','senior','mid',
      'mid','mid','mid','senior','mid','mid','mid','mid','senior','entry'] as levels,
    -- Realistic pay bands per title (the SkillBridge role has none: the member keeps military pay).
    array[75000,95000,50000,58000,48000,75000,90000,85000,52000,55000,
      62000,65000,80000,60000,58000,38000,70000,50000,95000,80000,
      70000,60000,50000,80000,55000,70000,58000,55000,110000,0] as pay_min,
    array[105000,135000,68000,78000,65000,100000,125000,120000,70000,75000,
      85000,88000,110000,82000,78000,50000,95000,68000,130000,115000,
      98000,85000,66000,110000,78000,98000,80000,75000,150000,0] as pay_max
)
insert into public.jobs (company_id, slug, title, location, work_arrangement, employment_type, experience_level,
  industry, salary_min, salary_max, description, responsibilities, qualifications, benefits,
  veteran_preferred, military_transferable, clearance_required, clearance_eligible, status, posted_at)
select
  c.id,
  regexp_replace(lower(cat.titles[g.n + 1] || '-' || c.headquarters), '[^a-z0-9]+', '-', 'g') || '-' || (g.n + 1),
  cat.titles[g.n + 1],
  c.headquarters,
  case when c.headquarters = 'Remote' then 'remote' else (array['onsite','hybrid','remote'])[(g.n % 3) + 1] end,
  case when g.n = 29 then 'skillbridge' when g.n % 11 = 4 then 'contract' else 'full_time' end,
  cat.levels[g.n + 1],
  c.industry,
  nullif(cat.pay_min[g.n + 1], 0),
  nullif(cat.pay_max[g.n + 1], 0),
  'Fictional listing for development. ' || c.name || ' is hiring a ' || cat.titles[g.n + 1]
    || ' to lead day-to-day execution with a team that values service experience.',
  'Plan and execute daily operations.' || chr(10) || 'Lead and develop a small team.' || chr(10)
    || 'Report progress and risks to leadership.',
  'Experience leading people or processes (military experience counts).' || chr(10)
    || 'Strong written and verbal communication.',
  'Medical, dental, and paid time off.',
  g.n % 2 = 0,
  true,
  case when c.industry in ('Defense','Government Contracting') then 'secret' else 'none' end,
  c.industry in ('Defense','Government Contracting','Consulting'),
  'open',
  now() - (g.n || ' days')::interval
from generate_series(0, 29) as g(n)
join cos c on c.idx = g.n % 10
cross join catalog cat
on conflict (slug) do nothing;
