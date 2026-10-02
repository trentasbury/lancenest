export type Guide = { slug: string; title: string; description: string; sections: { h: string; p?: string[]; list?: string[] }[]; links: [string, string][] };

export const GUIDES: Guide[] = [
  { slug: 'how-to-use-dod-skillbridge', title: 'How to use DoD SkillBridge', description: 'A step-by-step plan for spending your final months of service training with a civilian employer while keeping your military pay.',
    sections: [
      { h: 'What SkillBridge is', p: ['DoD SkillBridge lets eligible service members train, intern, or apprentice with an authorized civilian organization during their last months of service — typically up to 180 days — while continuing to receive military pay and benefits. Your command must approve your participation.'] },
      { h: 'Step by step', list: ['Start early: talk to your transition office about 9–12 months before separation.', 'Find an authorized program on the official SkillBridge site, or on LanceNest, where only confirmed authorized organizations can post SkillBridge roles.', 'Apply to the organization and get a written offer describing the training.', 'Request command approval through your chain of command, following your branch’s process and timelines.', 'Complete your Transition Assistance Program requirements and out-processing on schedule.'] },
      { h: 'Make it count', list: ['Choose a program with a real path to a job offer.', 'Ask what certifications or skills you’ll finish with.', 'Treat it like a long interview — most placements are decided by performance.'] },
    ], links: [['Official DoD SkillBridge site', 'https://skillbridge.osd.mil'], ['Browse SkillBridge roles on LanceNest', '/jobs?type=skillbridge']] },
  { slug: 'gi-bill-vs-certifications', title: 'GI Bill vs. certifications: how to pay for training', description: 'When to use your GI Bill, when to use credentialing and tuition programs while serving, and how certification test fees work.',
    sections: [
      { h: 'While you’re serving', p: ['Most branches run credentialing programs (often called COOL) and Tuition Assistance that can pay for certifications and courses before you separate. Using them first can save your GI Bill for bigger goals.'] },
      { h: 'After you separate', p: ['The GI Bill can cover degrees, vocational and technical training, apprenticeships, and the fees for many licensing and certification tests. Test fees are reimbursed up to a limit and may use a portion of your entitlement — check the current rules with the VA before you schedule.'] },
      { h: 'How to decide', list: ['Short, industry-recognized certifications (IT, cyber, project management, trades) → use credentialing programs while serving if you can.', 'Degrees and longer programs → usually the best value for the GI Bill.', 'Confirm the school or program is approved for GI Bill benefits before enrolling.'] },
    ], links: [['VA education and training benefits', 'https://www.va.gov/education/'], ['Training & Certifications on LanceNest', '/training']] },
  { slug: 'translate-military-experience-resume', title: 'How to translate your military experience for a civilian résumé', description: 'Turn your MOS, rating, or AFSC into language civilian hiring managers understand.',
    sections: [
      { h: 'Lead with outcomes, not titles', p: ['Civilian employers hire for results. Replace unit jargon with what you did, how many people or how much equipment you were responsible for, and the result.'] },
      { h: 'A simple formula', list: ['Action + scope + result: “Led a 12-person team maintaining $4M in vehicles; raised readiness from 78% to 96%.”', 'Swap military terms for civilian ones: “NCOIC” → “team supervisor,” “CONUS” → “U.S.”', 'List certifications, clearance level, and tools by name.'] },
      { h: 'Use the whole picture', p: ['If you’ve had civilian jobs since service, lead with those. On LanceNest, your job matches weigh your full work history, and your military background counts most while you’re serving or recently out.'] },
    ], links: [['Find your military job’s civilian translation', '/careers'], ['Build your profile', '/signup?role=veteran']] },
  { slug: 'security-clearance-jobs-guide', title: 'Getting a cleared job after the military', description: 'How security clearances carry over to civilian work, and how to stand out to federal contractors.',
    sections: [
      { h: 'How clearances carry over', p: ['A clearance belongs to the government, not to you, and it is held through a sponsoring employer. Generally, a clearance can be reinstated without a new investigation if you return to a cleared position within about two years of leaving one — confirm with the hiring company’s security officer.'] },
      { h: 'Stand out to cleared employers', list: ['Clearance levels on LanceNest are self-reported — employers confirm eligibility through official government systems, so list yours accurately.', 'List your clearance level and the date of your last investigation.', 'Never share classified details — describe your role at an unclassified level.', 'Apply early: on LanceNest, Federal-plan members see jobs requiring a clearance 48 hours before everyone else.'] },
    ], links: [['Browse cleared jobs', '/jobs?clearance=secret'], ['LanceNest plans', '/plans']] },
  { slug: 'freelancing-while-transitioning', title: 'Freelancing while you transition', description: 'How to earn on the side with the skills you already have — legally, safely, and paid on time.',
    sections: [
      { h: 'Before you start', list: ['If you’re serving, get your command’s approval for off-duty employment where required, and never use government time, equipment, rank, or uniform.', 'Hold any license, certification, or insurance your trade requires where you work.', 'Freelance income is taxable: set aside a share of each payment and track expenses.'] },
      { h: 'Get paid safely', p: ['On LanceNest, employers fund each milestone before you start. The money is held until the work is approved — or released automatically 14 days after you submit — so you’re never working unpaid.'] },
    ], links: [['Offer a service', '/freelance/services/mine'], ['Freelance on LanceNest', '/freelance']] },
  { slug: 'guard-reserve-civilian-careers', title: 'Civilian careers for Guard and Reserve members', description: 'Balancing drill, deployments, and a civilian career — and the protections you have at work.',
    sections: [
      { h: 'Your rights at work', p: ['USERRA, a federal law, protects the civilian jobs of Guard and Reserve members: employers generally must let you return after military service and cannot discriminate against you because of it. ESGR offers free help if questions come up with an employer.'] },
      { h: 'Make it work', list: ['Share your drill and training schedule with your employer early.', 'Look for employers that list Guard and Reserve support on their company page.', 'Freelance and remote roles can fit around drill weekends and annual training.'] },
    ], links: [['USERRA information (U.S. Department of Labor)', 'https://www.dol.gov/agencies/vets/programs/userra'], ['Guard & Reserve group on LanceNest', '/groups/career-guard-reserve']] },
];
