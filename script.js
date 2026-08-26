/* ============================================================
   FAKE INTERNSHIP OFFER DETECTOR — Core Engine v2
   TCS Tech Day @ D J Sanghvi College of Engineering
   Primary:  Gemini 1.5 Flash (AI classification)
   Fallback: Rule-based NLP scoring (offline, instant)
   ============================================================ */

'use strict';

// ── State ──────────────────────────────────────────────────
const state = {
  channel: 'email',
  cellChannel: 'email',
  reports: [],
  broadcasts: [],
  reportCounter: 1,
  isAnalyzing: false,
  isCellAnalyzing: false,
  lastVerdict: null,
  lastScore: 0,
  lastFlags: [],
  lastOffer: { text: '', sender: '' },
  cellLastVerdict: null,
  cellLastScore: 0,
  cellLastFlags: [],
  cellLastOffer: { text: '', sender: '' },
  usedAI: false,
  currentRole: null  // 'student' | 'placement'
};

// ── Credentials ────────────────────────────────────────────
const CREDENTIALS = {
  student:   { username: 'student',  password: 'student@123' },
  placement: { username: 'admin',    password: 'cell@123' }
};

const $ = (sel) => document.querySelector(sel);

// ══════════════════════════════════════════════════════════
//  FEW-SHOT DATASET  (from dataset.csv — 25 labelled offers)
// ══════════════════════════════════════════════════════════
const DATASET = [
  { channel:'Email', sender:'hr@nimbustech-solutions.com', text:'Dear Candidate, Congratulations! Following your interview on 12th Aug with our engineering panel, we are pleased to offer you the Software Intern position at Nimbus Tech Solutions starting 1st Sept. Please find the formal offer letter attached. Kindly confirm acceptance by replying to this email. Regards, HR Team, Nimbus Tech Solutions.', verdict:'Safe', score:0, flags:'None - matching corporate domain, formal interview stage referenced', action:'No action needed, proceed with onboarding' },
  { channel:'SMS', sender:'TC-CAREER', text:'Dear Applicant, this confirms your Data Analyst Intern interview with Trical Corp on 15-Aug at 11 AM via Google Meet. Link will follow via official email. - Trical Corp HR', verdict:'Safe', score:0, flags:'None - registered business sender ID, standard interview confirmation', action:'No action needed, attend scheduled interview' },
  { channel:'Email', sender:'careers.brightfuture2024@gmail.com', text:'Congratulations!! You are SELECTED for Marketing Intern at BrightFuture Global Pvt Ltd. To confirm your seat you must pay a one-time registration fee of Rs.1500 via UPI within the next 2 hours or the offer will be cancelled. Reply with payment screenshot immediately.', verdict:'High Risk', score:80, flags:'Free email domain(+20); Upfront registration fee(+40); Urgency 2-hour deadline(+15); No interview mentioned(+30)', action:'Do not pay any fee; block sender and report to placement cell' },
  { channel:'SMS', sender:'+919812345670', text:'Congrats you are DIRECTLY SELECTED for Internship no interview needed. Send Aadhaar card copy now and pay Rs.999 processing fee to activate your offer id today only.', verdict:'High Risk', score:95, flags:'Personal mobile number(+20); Direct selection no interview(+30); Upfront fee(+40); Aadhaar before interview(+35); Urgency(+15)', action:'Do not respond, do not share ID proof, report to placement cell' },
  { channel:'Email', sender:'support@quickhire-jobs.net', text:'Dear Candidate, You have been shortlisted for Finance Intern role. To process your advance stipend of Rs.8000 we require your bank account number and IFSC code immediately, no interview required.', verdict:'High Risk', score:65, flags:'Domain mismatch(+25); Bank details before hiring(+35); No interview(+30)', action:'Never share bank details, verify company independently, report to placement cell' },
  { channel:'Email', sender:'admissions@stellarcorp-official.com', text:'Dear Selected Candidate, As part of our onboarding process, a refundable seat confirmation deposit of Rs.500 is required to reserve your internship slot. This amount will be refunded in your first stipend cycle. Please pay via the link in your onboarding portal.', verdict:'Suspicious', score:30, flags:'Refundable deposit framing(+30)', action:'Verify directly with company HR via official channels before paying any deposit' },
  { channel:'Email', sender:'hr@meridiantech.co.in', text:'Dear Candidate, Congratulations on clearing all three rounds of interviews for the Software Development Intern role at Meridian Technologies. As a final step in our verified onboarding process, please share a scanned copy of your Aadhaar/PAN card for background verification and payroll setup.', verdict:'Safe', score:5, flags:'Aadhaar/PAN requested after verified interview - standard onboarding(+5)', action:'Proceed with document submission through official company portal' },
  { channel:'Email', sender:'careers@tcs-careers.co', text:'Dear Applicant, We are pleased to inform you that TCS has selected you for the Graduate Internship Program. Kindly complete your registration on our portal within 3 days.', verdict:'Suspicious', score:25, flags:'Domain spoofing / look-alike domain(+25)', action:'Verify sender domain against official website before proceeding' },
  { channel:'SMS', sender:'INFOTECH-HR', text:'Your internship offer with Infotech Solutions is ready! Click here to accept: bit.ly/infotech-offer2024 and complete formalities within 24 hours.', verdict:'Suspicious', score:25, flags:'Shortened/obscured link(+25)', action:'Do not click shortened links; verify offer directly on official company website' },
  { channel:'SMS', sender:'+919845123456', text:'Congrats! You got the internship.', verdict:'Suspicious', score:15, flags:'Low information/short input, no verifiable details(+15)', action:'Request full offer details in writing before responding' },
  { channel:'Email', sender:'hr@aravalitech.com', text:'Dear Candidate, We are delighted to offer you the Business Analyst Intern position at Aravali Technologies. Kindly confirm your acceptance and submit signed offer letter by Friday 5 PM to complete onboarding.', verdict:'Safe', score:15, flags:'Legitimate standard business deadline urgency(+15)', action:'No action needed, respond by the stated deadline' },
  { channel:'Email', sender:'hr@primeglobalconsult.com', text:'Dear Fresher Candidate, We are excited to offer you an internship with a guaranteed stipend of Rs.1,50,000 per month for just 2 hours of work daily. Limited seats available, apply now!', verdict:'Suspicious', score:30, flags:'Unrealistic high stipend(+15); Vague company details(+15)', action:'Independently verify company legitimacy and role details before proceeding' },
  { channel:'SMS', sender:'+917712345678', text:'Congrats you are hired for Data Entry Internship. Join our Telegram group t.me/taskkit_jobs and purchase the starter task kit for Rs.1200 to begin earning daily payouts.', verdict:'High Risk', score:65, flags:'Third-party platform redirect(+25); Upfront task-kit fee(+40)', action:'Do not join external groups or pay for task kits, report to placement cell' },
  { channel:'Email', sender:'recruiter@synergystaffing-partners.com', text:'Hello, I am a recruiter with Synergy Staffing Partners. We are hiring interns on behalf of one of our reputed clients in the IT sector for a Software Intern role. Further client details will be shared after initial screening call.', verdict:'Suspicious', score:25, flags:'Third-party/generic staffing domain(+15); Vague company details(+15)', action:'Ask recruiter to disclose end client name and verify staffing agency credentials' },
  { channel:'Email', sender:'volunteer@greenearthfoundation.org', text:'Dear Candidate, Green Earth Foundation is a non-profit working on sustainability projects. We would like to offer you an unpaid Volunteer Intern position (no stipend, no fee) subject to a short video interview next week. Please share your availability.', verdict:'Safe', score:15, flags:'Vague non-profit details(+15) but zero fee, genuine interview, transparent unpaid framing', action:'No action needed, proceed with scheduled interview' },
  { channel:'Email', sender:'hr@globalremoteworks.io', text:'Congratulations! You are selected for our Remote International Internship. Stipend will be paid in USDT crypto. To activate your payment wallet and receive your first stipend, a one-time wallet activation fee of $50 is required.', verdict:'High Risk', score:75, flags:'Unrealistic crypto stipend(+15); Upfront wallet activation fee(+40); Vague company(+15)', action:'Do not send any cryptocurrency or fees, report to placement cell' },
  { channel:'SMS', sender:'+919900112233', text:'URGENT: This is your official college placement desk. Your internship interview slot has been confirmed. Send Aadhaar number immediately for verification before 5 PM today or slot will be cancelled.', verdict:'High Risk', score:60, flags:'Impersonation from personal number(+20); Aadhaar before interview(+35); High urgency(+15)', action:'Verify with actual placement cell office, do not share ID proof, report as impersonation' },
  { channel:'Email', sender:'hrteam2024@outlook.com', text:'Dear Candidate, HR Team is pleased to offer you an internship position with immediate joining. Kindly revert with your documents to proceed further.', verdict:'Suspicious', score:35, flags:'Free/generic email domain(+20); Missing company identification(+15)', action:'Ask sender to identify the hiring company by name before sharing any documents' },
  { channel:'SMS', sender:'+918811223344', text:'Sorry, you did not qualify for the regular internship program. However, you can still get a GUARANTEED internship certificate by enrolling in our paid training program for Rs.3000.', verdict:'High Risk', score:55, flags:'Rejection-to-paid-training pivot scam with upfront fee(+40); Vague offer(+15)', action:'Do not pay for guaranteed placement training, report to placement cell' },
  { channel:'Email', sender:'talent.acquisition@novacore-systems.com', text:'hii candidate, we is pleased to inform u that your profile is shortlist for internship role at our esteem organisation. plz confirm ur interest asap within today itself as seats is limited.', verdict:'Suspicious', score:50, flags:'Poor grammar(+10); High urgency(+15); Vague role details(+15); Informal domain pattern(+10)', action:'Request formal written offer with complete role details before responding' },
  { channel:'Email', sender:'careers@finwise-startup.com', text:'Dear Candidate, FinWise is a fintech startup based in Bengaluru. Please find attached the complete Job Description for the Product Intern role along with a link to our technical assessment: finwise-startup.com/assessment. No fee is required at any stage.', verdict:'Safe', score:10, flags:'Minor informal startup domain(+10) but full JD, genuine assessment link, explicit no-fee statement', action:'No action needed, proceed with assessment on official domain link' },
  { channel:'Email', sender:'logistics@apexcorp-hr.com', text:'Dear Selected Intern, To ship your company laptop and starter kit to your address, kindly pay a refundable courier and handling deposit of Rs.799. This will be adjusted in your first salary.', verdict:'Suspicious', score:30, flags:'Refundable equipment/courier deposit framing(+30)', action:'Verify equipment dispatch policy directly with company HR before paying any deposit' },
  { channel:'SMS', sender:'+919123456780', text:'This is HDFC Bank HR. You have been selected for our Summer Internship Program. Please reply with your details to proceed.', verdict:'Suspicious', score:25, flags:'Major bank identity claimed from personal number, sender mismatch(+20); Vague details(+5)', action:'Verify claim directly through the bank official careers portal or helpline before replying' },
  { channel:'SMS', sender:'NOVACR-HR', text:'Your technical assessment originally scheduled for 20-Aug has been rescheduled to 22-Aug, 10 AM due to a system upgrade. Please check your email for the updated link. - NovaCore Systems HR', verdict:'Safe', score:0, flags:'None - registered business sender ID, standard corporate rescheduling notice', action:'No action needed, check email for updated assessment link' },
  { channel:'Email', sender:'admissions@elitecareerpath.org', text:'CONGRATULATIONS! You are guaranteed 100% placement in a top MNC after completing our certified internship program. Registration fee of Rs.5000 is mandatory to lock your guaranteed placement seat today.', verdict:'High Risk', score:70, flags:'Guaranteed placement scam framing(+15); Mandatory registration fee(+40); Urgency today(+15)', action:'Do not pay any registration fee, guaranteed placement claims are a major red flag, report to placement cell' }
];

// ══════════════════════════════════════════════════════════
//  GEMINI PROMPT BUILDER
// ══════════════════════════════════════════════════════════
function buildGeminiPrompt(offerText, sender, channel) {
  // Pick representative few-shot examples: mix of all 3 verdicts
  const fewShotIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 14, 15, 17, 18, 23, 24];
  const examples = fewShotIds.map(i => DATASET[i]);

  const fewShotBlock = examples.map((ex, i) => `
--- Example ${i + 1} ---
Channel: ${ex.channel}
Sender: ${ex.sender}
Offer Text: "${ex.text}"
ANSWER:
{
  "verdict": "${ex.verdict}",
  "score": ${ex.score},
  "confidence": ${ex.verdict === 'Safe' ? 92 : ex.verdict === 'High Risk' ? 95 : 78},
  "company_name": null,
  "has_interview": ${ex.text.toLowerCase().includes('interview') || ex.text.toLowerCase().includes('assessment') ? true : false},
  "flags": [{"label": "${ex.flags.split(';')[0].trim()}", "detail": "${ex.flags}", "severity": "${ex.verdict === 'High Risk' ? 'high' : ex.verdict === 'Suspicious' ? 'med' : 'low'}", "weight": ${ex.score}, "phrases": []}],
  "action": "${ex.action}"
}`).join('\n');

  return `You are an AI fraud detection system for fake internship offer detection, trained to protect college students in India.

SCORING RULES (apply these weights):
- Upfront payment / fee request: +40 points (HIGH severity)
- Aadhaar/PAN/ID requested BEFORE any interview: +35 points (HIGH severity)
- Bank details requested before hiring: +35 points (HIGH severity)
- No interview / instant/direct selection claimed: +30 points (HIGH severity)
- Refundable deposit framing: +30 points (HIGH severity)
- Domain/link mismatch with company name: +25 points (MEDIUM severity)
- Sender is personal number/Gmail/free email for company-wide offer: +20 points (MEDIUM severity)
- Urgency / pressure language (today only, limited seats, act fast): +15 points (MEDIUM severity)
- Vague / unverifiable company details: +15 points (MEDIUM severity)
- Unrealistic salary/stipend for entry-level role: +15 points (MEDIUM severity)
- Poor grammar / inconsistent formatting: +10 points (LOW severity)
- Aadhaar/PAN requested AFTER a stated interview (standard onboarding): +5 points only (LOW severity — this is NORMAL)
- Shortened/obscured links (bit.ly, tinyurl etc.): +25 points (MEDIUM severity)
- Third-party platform redirect (Telegram group, etc.): +25 points (MEDIUM severity)

VERDICT THRESHOLDS:
- Score 0-20: "Safe" (Green)
- Score 21-49: "Suspicious" (Amber)  
- Score 50+: "High Risk" (Red)

CRITICAL CONTEXT RULES:
1. If the offer clearly references a prior interview ("following your interview", "after clearing rounds", "post your interview"), and THEN asks for Aadhaar/PAN — this is NORMAL onboarding. Score it +5, NOT +35.
2. Registered Business Sender IDs (e.g. TC-CAREER, NOVACR-HR, XY-CORPHR) are LEGITIMATE for SMS. Only personal mobile numbers (+91XXXXXXXXXX) are flagged for SMS.
3. Do NOT flag "confirm by Friday" or "please respond by [date]" as urgency — only flag "today only", "2 hours", "limited seats act fast" type pressure.
4. Very short messages with insufficient information: return verdict "Suspicious" with score 15 and explain "insufficient information to fully assess".

TRAINING EXAMPLES (labelled data):
${fewShotBlock}

---

Now analyse the following offer and return ONLY a valid JSON object with no extra text, no markdown, no explanation outside the JSON:

Channel: ${channel}
Sender: ${sender || 'Not provided'}
Offer Text: "${offerText}"

Return this exact JSON structure:
{
  "verdict": "Safe" | "Suspicious" | "High Risk",
  "score": <integer 0-100>,
  "confidence": <integer 0-100>,
  "company_name": "<extracted company name or null>",
  "has_interview": <true|false>,
  "flags": [
    {
      "label": "<short flag name>",
      "detail": "<plain English explanation for a student>",
      "severity": "high" | "med" | "low",
      "weight": <points this flag contributes>,
      "phrases": ["<exact phrase from offer that triggered this flag>"]
    }
  ],
  "action": "<single paragraph plain-language recommended action for the student>"
}`;
}

// ══════════════════════════════════════════════════════════
//  GEMINI API CALL
// ══════════════════════════════════════════════════════════
async function callGroqAPI(offerText, sender, channel) {
  const prompt = buildGeminiPrompt(offerText, sender, channel); // reuse same prompt builder

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);

  try {
    const response = await fetch(CONFIG.GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.GROQ_API_KEY}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: CONFIG.GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a fraud detection AI for fake internship offers. You always respond with valid JSON only — no markdown, no explanation outside the JSON object.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1024,
        response_format: { type: 'json_object' }
      })
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text();
      console.warn('Groq API error:', response.status, errBody);
      return null;
    }

    const data = await response.json();
    const rawText = data?.choices?.[0]?.message?.content;
    if (!rawText) return null;

    // Strip markdown code fences if model wrapped it anyway
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);

  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') console.warn('Groq API timed out — using rule-based fallback.');
    else console.warn('Groq API failed:', err.message);
    return null;
  }
}

// ══════════════════════════════════════════════════════════
//  MAP GEMINI RESPONSE → INTERNAL RESULT FORMAT
// ══════════════════════════════════════════════════════════
function mapGeminiToResult(gemini, offerText, sender) {
  const verdictMap = {
    'Safe': 'safe',
    'Suspicious': 'suspicious',
    'High Risk': 'high-risk',
    'High risk': 'high-risk'
  };

  const verdict = verdictMap[gemini.verdict] || 'suspicious';

  const flags = (gemini.flags || []).map(f => ({
    id: f.label.toLowerCase().replace(/\s+/g, '-').substring(0, 20),
    weight: f.weight || 0,
    severity: f.severity || 'med',
    label: f.label,
    detail: f.detail,
    phrases: f.phrases || []
  }));

  const entities = {
    companyName: gemini.company_name || null,
    domain: extractDomain(offerText),
    senderDomain: extractSenderDomain(sender),
    senderType: classifySender(sender),
    hasInterview: gemini.has_interview || false,
    postInterviewId: false
  };

  return {
    score:      gemini.score  || 0,
    confidence: gemini.confidence || 85,
    verdict,
    flags,
    entities,
    action:     gemini.action || '',
    source:     'ai'
  };
}

// ══════════════════════════════════════════════════════════
//  RULE-BASED FALLBACK ENGINE
// ══════════════════════════════════════════════════════════
const KEYWORDS = {
  payment:     [/pay\s*₹?\s*\d+/i, /registration fee/i, /processing fee/i, /security deposit/i, /refundable deposit/i, /pay.*confirm/i, /fee.*required/i, /deposit.*seat/i, /payment.*internship/i, /activation fee/i, /wallet.*fee/i, /task\s*kit/i, /starter\s*kit.*pay/i, /courier.*deposit/i],
  aadhaarPre:  [/aadhaar\s*card/i, /aadhar\s*card/i, /aadhaar\s*number/i, /share.*id.*proof/i, /id.*copy/i, /pan\s*card/i, /government.*id/i],
  bankDetails: [/bank\s*details/i, /account\s*number/i, /ifsc/i, /share.*bank/i, /bank.*account/i],
  noInterview: [/directly\s*selected/i, /no\s*interview/i, /without\s*interview/i, /instant\s*selection/i, /direct\s*selection/i, /selected\s*without/i, /skip.*interview/i],
  urgency:     [/offer\s*(valid|expires)\s*(only\s*)?(today|24\s*hours)/i, /limited\s*seats/i, /act\s*fast/i, /respond\s*(immediately|urgently|asap)/i, /hurry/i, /expires?\s*(soon|today)/i, /within.*\d+\s*hours?/i, /today\s*only/i],
  interviewMentioned: [/interview/i, /assessment/i, /shortlisted/i, /selection\s*process/i, /following.*interview/i, /after.*interview/i, /cleared.*round/i, /cleared.*interview/i, /all.*rounds/i],
  shortenedLink: [/bit\.ly\//i, /tinyurl\.com\//i, /goo\.gl\//i, /t\.co\//i, /ow\.ly\//i, /rb\.gy\//i, /cutt\.ly\//i, /t\.me\//i],
  badGrammar:  [/congratualtion/i, /congratulaiton/i, /internhsip/i, /offfered/i, /oppurtunity/i, /recieved/i, /hii candidate/i, /we is pleased/i, /shortlist for/i],
  unrealisticStipend: [/₹\s*[1-9]\d{4,}\s*per\s*month/i, /guaranteed.*stipend/i, /earn.*daily.*payout/i],
  refundable:  [/refundable.*deposit/i, /refundable.*fee/i, /will be refunded/i, /adjusted in.*salary/i, /adjusted in.*stipend/i],
  vague:       [/further.*details.*after/i, /client.*details.*shared.*after/i]
};

function extractEntities(text, sender) {
  const entities = {
    companyName: extractCompany(text),
    domain: extractDomain(text),
    senderDomain: extractSenderDomain(sender),
    senderType: classifySender(sender),
    hasInterview: false,
    postInterviewId: false
  };
  entities.hasInterview = KEYWORDS.interviewMentioned.some(r => r.test(text));
  if (entities.hasInterview && KEYWORDS.aadhaarPre.some(r => r.test(text))) {
    const idIdx  = Math.min(...KEYWORDS.aadhaarPre.map(r => { const m = text.search(r); return m === -1 ? 9999 : m; }));
    const ivIdx  = Math.min(...KEYWORDS.interviewMentioned.map(r => { const m = text.search(r); return m === -1 ? 9999 : m; }));
    entities.postInterviewId = ivIdx < idIdx;
  }
  return entities;
}

function extractCompany(text) {
  const patterns = [
    /internship\s+at\s+([A-Z][A-Za-z\s&.]{2,30})/i,
    /offer\s+from\s+([A-Z][A-Za-z\s&.]{2,30})/i,
    /(?:from|at|by|with)\s+([A-Z][A-Za-z\s&.]{2,30}(?:Ltd|Pvt|Inc|Corp|Solutions|Technologies|Tech|Systems|Services)?)/,
    /([A-Z][A-Za-z\s&.]{2,25}(?:Ltd|Pvt|Inc|Corp|Solutions|Technologies|Tech|Systems|Services))/
  ];
  for (const p of patterns) { const m = text.match(p); if (m) return m[1].trim(); }
  return null;
}

function extractDomain(text) {
  const u = text.match(/https?:\/\/([a-zA-Z0-9.-]+)/);
  if (u) return u[1].toLowerCase();
  const w = text.match(/www\.([a-zA-Z0-9.-]+)/);
  if (w) return 'www.' + w[1].toLowerCase();
  return null;
}

function extractSenderDomain(sender) {
  if (!sender) return null;
  const m = sender.match(/@([a-zA-Z0-9.-]+)/);
  return m ? m[1].toLowerCase() : null;
}

function classifySender(sender) {
  if (!sender) return 'unknown';
  if (sender.includes('@')) {
    const d = extractSenderDomain(sender) || '';
    return ['gmail.com','yahoo.com','hotmail.com','outlook.com','rediffmail.com','ymail.com'].includes(d) ? 'personal-email' : 'corporate-email';
  }
  const c = sender.replace(/[\s-]/g, '');
  if (/^[A-Z]{2}-[A-Z0-9]+$/.test(sender) || /^[A-Z]{6,}$/.test(c)) return 'business-id';
  if (/^(\+91)?[6-9]\d{9}$/.test(c)) return 'personal-phone';
  return 'unknown';
}

function checkDomainMismatch(company, domain, senderDomain) {
  if (!company) return false;
  const cSlug = company.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (domain && KEYWORDS.shortenedLink.some(r => r.test('http://' + domain))) return 'shortened';
  if (domain) {
    const dBase = domain.split('.')[0].replace(/[^a-z0-9]/g, '');
    if (!dBase.includes(cSlug.substring(0,4)) && !cSlug.includes(dBase.substring(0,4))) return 'mismatch';
    if (domain.includes('-careers') || domain.includes('-hr') || domain.includes('-jobs')) return 'lookalike';
  }
  if (senderDomain && company) {
    const sBase = senderDomain.split('.')[0].replace(/[^a-z0-9]/g, '');
    if (!sBase.includes(cSlug.substring(0,3)) && !cSlug.includes(sBase.substring(0,3))) return 'sender-mismatch';
  }
  return false;
}

function scoreOffer(text, sender) {
  const entities = extractEntities(text, sender);
  let score = 0;
  const flags = [];
  const match = (patterns) => patterns.filter(r => r.test(text)).map(r => { const m = text.match(r); return m ? m[0] : ''; }).filter(Boolean);

  // Payment
  const pay = match(KEYWORDS.payment);
  if (pay.length) { score += 40; flags.push({ id:'payment', weight:40, severity:'high', label:'Payment or fee requested', detail:'Legitimate companies never ask for fees before hiring.', phrases:pay }); }

  // Refundable deposit (only if no payment already flagged at +40)
  const ref = match(KEYWORDS.refundable);
  if (ref.length && !pay.length) { score += 30; flags.push({ id:'refundable', weight:30, severity:'high', label:'Refundable deposit framing', detail:'Scammers often frame fees as "refundable" — legitimate employers never require any upfront deposit.', phrases:ref }); }

  // Aadhaar/ID
  const hasId = KEYWORDS.aadhaarPre.some(r => r.test(text));
  if (hasId) {
    if (entities.postInterviewId) { score += 5; flags.push({ id:'id-post', weight:5, severity:'low', label:'ID document requested after interview', detail:'Standard onboarding verification — low risk since an interview was already clearly mentioned.', phrases:[] }); }
    else { const m2 = match(KEYWORDS.aadhaarPre); score += 35; flags.push({ id:'id-pre', weight:35, severity:'high', label:'ID document requested before any interview', detail:'Requesting Aadhaar/PAN before any interview is a strong indicator of fraud.', phrases:m2 }); }
  }

  // Bank details
  const bank = match(KEYWORDS.bankDetails);
  if (bank.length) { score += 35; flags.push({ id:'bank', weight:35, severity:'high', label:'Bank details requested before hiring', detail:'No legitimate employer requests bank details before issuing a formal offer letter.', phrases:bank }); }

  // No interview
  const noIv = match(KEYWORDS.noInterview);
  if (noIv.length) { score += 30; flags.push({ id:'no-interview', weight:30, severity:'high', label:'No interview / instant selection claimed', detail:'Real companies always have a selection process — instant selection claims are a classic fraud tactic.', phrases:noIv }); }

  // Shortened link
  const shortened = match(KEYWORDS.shortenedLink);
  if (shortened.length) { score += 25; flags.push({ id:'domain', weight:25, severity:'med', label:'Shortened or obscured link detected', detail:'The link destination cannot be verified from the text — a common scam tactic.', phrases:shortened }); }

  // Domain mismatch (only if no shortened link)
  if (!shortened.length) {
    const domIssue = checkDomainMismatch(entities.companyName, entities.domain, entities.senderDomain);
    if (domIssue) { score += 25; flags.push({ id:'domain', weight:25, severity:'med', label:'Domain/link mismatch detected', detail:'The sender domain or link does not match the claimed company name — possible typo-squatting or impersonation.', phrases:[entities.domain || entities.senderDomain || ''] }); }
  }

  // Sender
  const st = entities.senderType;
  if (st === 'personal-email') { score += 20; flags.push({ id:'sender', weight:20, severity:'med', label:'Personal email address used for company offer', detail:'Company-wide internship offers sent from Gmail/Yahoo/Outlook personal accounts are suspicious.', phrases:[sender] }); }
  else if (st === 'personal-phone' && state.channel === 'sms') { score += 20; flags.push({ id:'sender', weight:20, severity:'med', label:'SMS from a personal mobile number', detail:'Legitimate companies use registered Business Sender IDs for SMS — not random personal numbers.', phrases:[sender] }); }

  // Urgency
  const urg = match(KEYWORDS.urgency);
  if (urg.length) { score += 15; flags.push({ id:'urgency', weight:15, severity:'med', label:'Urgency or pressure language detected', detail:'Creating panic to force a fast decision is a manipulation tactic used by scammers.', phrases:urg }); }

  // Vague company
  const vague = match(KEYWORDS.vague);
  if (vague.length || (!entities.companyName && text.length > 50)) { score += 15; flags.push({ id:'vague', weight:15, severity:'med', label:'Vague or unverifiable company details', detail:'The offer lacks a verifiable company name, website, or address.', phrases:[] }); }

  // Unrealistic stipend
  const stip = match(KEYWORDS.unrealisticStipend);
  if (stip.length) { score += 15; flags.push({ id:'stipend', weight:15, severity:'med', label:'Unrealistically high stipend or guaranteed earnings', detail:'Very high or "guaranteed" stipends for no-experience roles are used to attract victims.', phrases:stip }); }

  // Grammar
  const gram = match(KEYWORDS.badGrammar);
  if (gram.length) { score += 10; flags.push({ id:'grammar', weight:10, severity:'low', label:'Poor grammar / spelling errors detected', detail:'Multiple errors suggest an unprofessional or fraudulent sender.', phrases:[] }); }

  let verdict;
  if (score >= 50) verdict = 'high-risk';
  else if (score >= 21) verdict = 'suspicious';
  else verdict = 'safe';

  return { score, verdict, flags, entities, source: 'rule-based' };
}

// ══════════════════════════════════════════════════════════
//  INPUT VALIDATION
// ══════════════════════════════════════════════════════════
function validateInput(text) {
  const t = text.trim();
  if (!t || t.length < 10) return 'empty';
  if (t.split(/\s+/).length < 5) return 'too-short';
  return 'ok';
}

// ══════════════════════════════════════════════════════════
//  CONFIDENCE CALC (rule-based fallback)
// ══════════════════════════════════════════════════════════
function calcConfidence(score, flags) {
  if (flags.length === 0 && score === 0) return 95;
  if (score >= 70) return 97;
  if (score >= 50) return Math.round(85 + (score - 50) * 0.4);
  if (score >= 21) return Math.round(65 + (score - 21) * 0.7);
  return Math.round(80 + (20 - score) * 0.75);
}

// ══════════════════════════════════════════════════════════
//  CHECKLIST CONFIG
// ══════════════════════════════════════════════════════════
const CHECKS = [
  { id:'company',   label:'Checking company name plausibility…',                passLabel:'Company name identified',              failLabel:'Unverifiable or absent company name' },
  { id:'domain',    label:'Verifying domain / link…',                            passLabel:'Domain looks consistent',              failLabel:'Domain mismatch or suspicious link' },
  { id:'sender',    label:'Checking sender identity…',                           passLabel:'Sender looks legitimate',              failLabel:'Personal number or free email used' },
  { id:'interview', label:'Checking for interview or selection process…',        passLabel:'Interview / process mentioned',        failLabel:'No interview — instant offer claimed' },
  { id:'id',        label:'Scanning for ID document requests (Aadhaar / PAN)…', passLabel:'No problematic ID request',            failLabel:'ID requested before any interview' },
  { id:'payment',   label:'Scanning for payment or fee requests…',               passLabel:'No fees or payments requested',        failLabel:'Payment / deposit demand detected' },
  { id:'urgency',   label:'Checking for urgency or pressure language…',          passLabel:'Normal, professional tone',            failLabel:'High-pressure phrasing detected' },
  { id:'verdict',   label:'Compiling final verdict…',                            passLabel:'',                                     failLabel:'' }
];

// ══════════════════════════════════════════════════════════
//  ANIMATED CHECKLIST RUNNER
// ══════════════════════════════════════════════════════════
async function runChecklistInPanel(result, panelId) {
  const panel = document.getElementById(panelId);
  const progressId  = panelId + 'Progress';
  const fillId      = panelId + 'ProgressFill';

  panel.innerHTML = `
    <div class="checklist-header">
      <span style="font-size:16px;">🔍</span>
      <span class="checklist-title">Live Verification Checklist</span>
      <span class="checklist-progress" id="${progressId}">0 / ${CHECKS.length}</span>
    </div>
    <div class="checklist-progress-bar visible">
      <div class="checklist-progress-fill" id="${fillId}"></div>
    </div>
  `;
  panel.classList.add('visible');

  for (let i = 0; i < CHECKS.length; i++) {
    const check = CHECKS[i];
    const item = document.createElement('div');
    item.className = 'check-item visible running';
    item.innerHTML = `
      <span class="check-status-icon spinning">⟳</span>
      <div class="check-content">
        <div class="check-label">${check.label}</div>
        <div class="check-detail"></div>
      </div>
    `;
    panel.appendChild(item);
    await delay(230 + Math.random() * 100);

    if (check.id === 'verdict') {
      const cls = result.verdict === 'safe' ? 'pass' : result.verdict === 'suspicious' ? 'warn' : 'fail';
      item.className = `check-item visible ${cls}`;
      item.querySelector('.check-label').textContent = getVerdictLabel(result.verdict);
      item.querySelector('.check-status-icon').textContent = getVerdictIcon(result.verdict);
      item.querySelector('.check-status-icon').classList.remove('spinning');
    } else {
      const relatedFlag = result.flags.find(f => flagMatchesCheck(f.id, check.id));
      let itemState = 'pass', labelText = check.passLabel, detailText = '', phrases = [];

      if (relatedFlag) {
        itemState = relatedFlag.severity === 'low' ? 'warn' : 'fail';
        labelText = check.failLabel;
        detailText = relatedFlag.detail;
        phrases = relatedFlag.phrases || [];
      } else if (check.id === 'interview' && !result.entities?.hasInterview) {
        const noIvFlag = result.flags.find(f => f.id === 'no-interview');
        if (!noIvFlag) { itemState = 'warn'; labelText = 'No interview process mentioned'; detailText = 'The offer does not reference any interview or selection process.'; }
      } else if (check.id === 'company' && !result.entities?.companyName) {
        itemState = 'warn'; labelText = 'Company name not clearly identified'; detailText = 'No clearly identifiable company name was found in the offer.';
      }

      item.className = `check-item visible ${itemState}`;
      item.querySelector('.check-label').textContent = labelText;
      item.querySelector('.check-status-icon').textContent = itemState === 'pass' ? '✅' : itemState === 'warn' ? '⚠️' : '🚩';
      item.querySelector('.check-status-icon').classList.remove('spinning');
      if (detailText) {
        item.querySelector('.check-detail').innerHTML = detailText +
          (phrases.length ? '<br>' + phrases.slice(0,2).map(p => `<span class="check-phrase ${itemState === 'warn' ? 'warn-phrase' : ''}">${escHtml(p)}</span>`).join(' ') : '');
      }
    }

    document.getElementById(progressId).textContent = `${i + 1} / ${CHECKS.length}`;
    document.getElementById(fillId).style.width = `${((i + 1) / CHECKS.length) * 100}%`;
  }
}

// Convenience wrappers
async function runChecklist(result) { return runChecklistInPanel(result, 'checklistPanel'); }

function flagMatchesCheck(flagId, checkId) {
  const map = { payment:'payment', refundable:'payment', 'id-pre':'id', 'id-post':'id', bank:'payment', 'no-interview':'interview', domain:'domain', sender:'sender', urgency:'urgency', vague:'company', stipend:'company', grammar:'company' };
  return map[flagId] === checkId || flagId.startsWith(checkId);
}

function getVerdictLabel(v) {
  return v === 'safe' ? '✅ VERDICT: SAFE' : v === 'suspicious' ? '⚠️ VERDICT: SUSPICIOUS' : '🚨 VERDICT: HIGH RISK';
}

function getVerdictIcon(v) {
  return v === 'safe' ? '✅' : v === 'suspicious' ? '⚠️' : '🚨';
}

// ══════════════════════════════════════════════════════════
//  VERDICT RENDERER
// ══════════════════════════════════════════════════════════
function renderVerdictInPanel(result, panelId, isCell = false) {
  const panel = document.getElementById(panelId);
  const { score, verdict, flags } = result;
  const confidence = result.confidence || calcConfidence(score, flags);
  const isAI = result.source === 'ai' || result.usedAI;

  const verdictConfig = {
    'safe':       { label:'✅ SAFE',       icon:'🛡️', headline:'This offer appears legitimate.', summary:'No significant fraud indicators were detected. The offer shows signs of a genuine recruitment process.' },
    'suspicious': { label:'⚠️ SUSPICIOUS', icon:'🔍', headline:'Proceed with caution — verify independently.', summary:'One or more moderate red flags were detected. Verify the company independently before responding.' },
    'high-risk':  { label:'🚨 HIGH RISK',  icon:'🔴', headline:'Do NOT proceed — serious fraud indicators detected.', summary:'Multiple serious red flags were found. This offer matches common patterns of fake internship scams. Do not pay any fees or share personal documents.' }
  };

  const cfg = verdictConfig[verdict] || verdictConfig['suspicious'];
  const actionText = result.action || getActionText(verdict, flags);
  const maxScore = 140;
  const riskPct = Math.min((score / maxScore) * 100, 100);

  let flagsHtml = '';
  if (!flags.length) {
    flagsHtml = '<div class="flag-item flag-low"><span class="flag-icon">✅</span><div class="flag-text">No fraud indicators detected — this offer passed all checks.</div></div>';
  } else {
    flagsHtml = flags.map(f => `
      <div class="flag-item flag-${f.severity === 'high' ? 'high' : f.severity === 'med' ? 'med' : 'low'}">
        <span class="flag-icon">${f.severity === 'high' ? '🚩' : f.severity === 'med' ? '⚠️' : 'ℹ️'}</span>
        <div class="flag-text">
          <strong>${escHtml(f.label)}</strong>${f.phrases.length ? ` — "<em>${escHtml(f.phrases[0])}</em>"` : ''}
          <br><small style="color:var(--text-secondary)">${escHtml(f.detail)}</small>
        </div>
      </div>`).join('');
  }

  const aiBadge = isAI
    ? `<span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;background:rgba(139,92,246,0.15);border:1px solid rgba(139,92,246,0.3);border-radius:4px;padding:2px 8px;color:var(--accent-purple);margin-left:10px;">🦙 Groq · LLaMA 3.1</span>`
    : `<span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.25);border-radius:4px;padding:2px 8px;color:var(--accent-blue);margin-left:10px;">⚙️ Rule-Based</span>`;

  // Bottom action buttons — differ for student vs placement cell
  const companyName = result.entities?.companyName || 'Unknown Company';
  let bottomButtons = '';
  if (isCell) {
    // Placement Cell: direct broadcast if High Risk
    if (verdict === 'high-risk') {
      bottomButtons = `<button class="btn-cell-broadcast" id="cellDirectBroadcastBtn" onclick="openCellBroadcastModal('${escHtml(companyName)}', [])">📢 Broadcast Warning to All Students</button>`;
    }
  } else {
    // Student: report button
    if (verdict === 'high-risk') {
      bottomButtons = `
        <div id="reportButtonWrap">
          <button class="btn-report" id="btnReport" onclick="openReportModal()">🚨 Report to Placement Cell — Flag This Offer</button>
        </div>
        <div class="report-submitted" id="reportSubmitted">
          <span class="report-submitted-icon">✅</span>
          <div class="report-submitted-text">Report submitted to the Placement Cell for review. They will verify and broadcast a warning if confirmed.</div>
        </div>`;
    }
  }

  panel.innerHTML = `
    <div class="verdict-card ${verdict}">
      <div class="verdict-top">
        <div>
          <div class="verdict-badge ${verdict}">
            <span class="verdict-icon">${cfg.icon}</span>
            ${cfg.label}
          </div>
          ${aiBadge}
        </div>
        <div class="confidence-meter">
          <div class="confidence-label">Confidence</div>
          <div class="confidence-value ${verdict}" id="${panelId}ConfVal">0%</div>
          <div class="confidence-bar-wrap">
            <div class="confidence-bar-fill ${verdict}" id="${panelId}ConfBar" style="width:0%"></div>
          </div>
          <div class="verdict-score-label">Risk Score: ${score}</div>
        </div>
      </div>
      <div class="risk-score-row">
        <div class="risk-score-bar-wrap">
          <div class="risk-score-bar-fill ${verdict}" id="${panelId}RiskBar" style="width:0%"></div>
        </div>
        <div class="risk-score-text">${score} pts</div>
      </div>
      <div class="verdict-headline">${cfg.headline}</div>
      <div class="verdict-summary">${cfg.summary}</div>
      ${flags.length ? '<div style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:12px;">⚡ Red Flags Detected</div>' : ''}
      <div class="flags-list">${flagsHtml}</div>
      <div class="action-box">
        <span class="action-icon">💡</span>
        <div class="action-box-content">
          <div class="action-label">Recommended Action</div>
          <div class="action-text">${escHtml(actionText)}</div>
        </div>
      </div>
      ${bottomButtons}
    </div>`;

  panel.classList.add('visible');
  setTimeout(() => {
    const cv = document.getElementById(`${panelId}ConfVal`);
    const cb = document.getElementById(`${panelId}ConfBar`);
    const rb = document.getElementById(`${panelId}RiskBar`);
    if (cv) cv.textContent = confidence + '%';
    if (cb) cb.style.width = confidence + '%';
    if (rb) rb.style.width = riskPct + '%';
  }, 200);
}

// Convenience wrapper for student view
function renderVerdict(result) { renderVerdictInPanel(result, 'verdictPanel', false); }

function getActionText(verdict, flags) {
  if (verdict === 'safe') return "This offer looks genuine. If you decide to proceed, confirm all details directly through the company's official website. Never pay any fee or share personal documents without verifying the recruiter's identity first.";
  if (verdict === 'high-risk') {
    const parts = [];
    if (flags.some(f => f.id === 'payment' || f.id === 'refundable')) parts.push('Do not pay any fees or deposits');
    if (flags.some(f => f.id === 'id-pre')) parts.push('Do not share your Aadhaar card or PAN card');
    if (flags.some(f => f.id === 'bank')) parts.push('Do not share bank details or IFSC code');
    parts.push('Report this to your Placement Cell using the button below');
    parts.push('Verify the company via its official website or call their published number directly');
    return parts.map((a, i) => `${i + 1}. ${a}.`).join(' ');
  }
  return "Verify the company independently — search for their official website, check LinkedIn for the recruiter, and confirm the offer details with the company directly before responding. If you are still unsure, contact your Placement Cell.";
}

// ══════════════════════════════════════════════════════════
//  MAIN ANALYSE FLOW
// ══════════════════════════════════════════════════════════
async function analyzeOffer() {
  if (state.isAnalyzing) return;

  const offerText = $('#offerText').value;
  const senderVal = $('#senderField').value.trim();
  const validation = validateInput(offerText);

  // Reset panels
  $('#verdictPanel').classList.remove('visible');
  $('#verdictPanel').innerHTML = '';
  $('#checklistPanel').innerHTML = '';
  $('#checklistPanel').classList.remove('visible');
  $('#insufficientPanel').classList.remove('visible');

  if (validation === 'empty') { showInsufficientPanel('Please enter the offer text to analyse.', 'The offer text field is empty. Paste the full message you received.'); return; }
  if (validation === 'too-short') { showInsufficientPanel('Not enough information to assess.', 'The message is too short. Please paste the complete offer message for an accurate analysis.'); return; }

  state.isAnalyzing = true;
  state.lastOffer = { text: offerText, sender: senderVal };

  const btn = $('#btnAnalyze');
  btn.disabled = true;
  btn.innerHTML = `<span class="btn-icon">✨</span><span class="btn-text">Analysing with AI…</span>`;

  try {
    let result;
    state.usedAI = false;

    if (CONFIG.USE_AI) {
      // Try Groq (LLaMA 3.1 70B) first
      const groqRaw = await callGroqAPI(offerText, senderVal, state.channel);
      if (groqRaw) {
        result = mapGeminiToResult(groqRaw, offerText, senderVal); // mapper works for both
        result.entities = result.entities || extractEntities(offerText, senderVal);
        state.usedAI = true;
      }
    }

    // Fallback to rule-based
    if (!result) {
      btn.innerHTML = `<span class="btn-icon">⚙️</span><span class="btn-text">Analysing (offline mode)…</span>`;
      result = scoreOffer(offerText, senderVal);
    }

    state.lastVerdict = result;
    state.lastScore   = result.score;
    state.lastFlags   = result.flags;

    await runChecklist(result);
    await delay(200);
    renderVerdict(result);
    $('#btnReset').classList.add('visible');

  } finally {
    state.isAnalyzing = false;
    btn.disabled = false;
    btn.innerHTML = `<span class="btn-icon">🔍</span><span class="btn-text">Analyse This Offer</span>`;
  }
}

// ══════════════════════════════════════════════════════════
//  REPORT & PLACEMENT CELL
// ══════════════════════════════════════════════════════════
function openReportModal() { $('#reportModal').classList.add('open'); setTimeout(() => $('#reportModalPassword').focus(), 200); }
function closeReportModal() { $('#reportModal').classList.remove('open'); }

function submitReport() {
  const report = {
    id: `RPT-${String(state.reportCounter++).padStart(4,'0')}`,
    channel: state.channel,
    sender: state.lastOffer.sender,
    companyName: state.lastVerdict?.entities?.companyName || 'Unknown Company',
    domain: state.lastVerdict?.entities?.domain || state.lastVerdict?.entities?.senderDomain || 'N/A',
    score: state.lastScore,
    flags: [...state.lastFlags],
    offerSnippet: state.lastOffer.text.substring(0, 200) + (state.lastOffer.text.length > 200 ? '…' : ''),
    timestamp: new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }),
    status: 'pending'
  };
  state.reports.push(report);
  closeReportModal();
  if (document.getElementById('reportButtonWrap')) document.getElementById('reportButtonWrap').style.display = 'none';
  const rs = document.getElementById('reportSubmitted');
  if (rs) rs.classList.add('visible');
  updateCellStats();
}

function openCellLoginModal() { $('#cellLoginModal').classList.add('open'); $('#cellPassword').value = ''; $('#cellLoginError').classList.remove('visible'); setTimeout(() => $('#cellPassword').focus(), 200); }
function closeCellLoginModal() { $('#cellLoginModal').classList.remove('open'); }

function loginToCell() {
  if ($('#cellPassword').value.trim() !== 'placementcell') {
    $('#cellLoginError').textContent = 'Incorrect password. Hint: placementcell';
    $('#cellLoginError').classList.add('visible');
    return;
  }
  closeCellLoginModal();
  $('#mainView').style.display = 'none';
  $('#cellDashboard').classList.add('visible');
  renderReportQueue();
  updateCellStats();
}

function logoutCell() { $('#cellDashboard').classList.remove('visible'); $('#mainView').style.display = 'block'; }

function renderReportQueue() {
  const container = $('#reportQueueContainer');
  const broadcastSection = $('#broadcastHistorySection');
  const pending = state.reports.filter(r => r.status === 'pending');

  if (!pending.length && !state.broadcasts.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>No fraud reports yet</p><span>Reports submitted by students will appear here for your review.</span></div>`;
    if (broadcastSection) broadcastSection.style.display = 'none';
    return;
  }

  container.innerHTML = '<div class="report-queue">' + pending.map(r => `
    <div class="report-card" id="report-${r.id}">
      <div class="report-card-header">
        <div class="report-card-meta">
          <span class="report-id">${r.id}</span>
          <span class="report-channel-tag ${r.channel}">${r.channel.toUpperCase()}</span>
        </div>
        <span class="report-time">Received at ${r.timestamp}</span>
      </div>
      <div class="report-card-body">
        <div class="report-info-grid">
          <div class="report-info-item"><div class="ri-label">Company Claimed</div><div class="ri-value">${escHtml(r.companyName)}</div></div>
          <div class="report-info-item"><div class="ri-label">Sender / Domain</div><div class="ri-value">${escHtml(r.sender || r.domain)}</div></div>
          <div class="report-info-item"><div class="ri-label">Risk Score</div><div class="ri-value" style="color:var(--danger-text);font-family:'JetBrains Mono',monospace;">${r.score} pts</div></div>
          <div class="report-info-item"><div class="ri-label">Flags Raised</div><div class="ri-value">${r.flags.length} indicator${r.flags.length !== 1 ? 's' : ''}</div></div>
        </div>
        <div class="report-flags-mini">${r.flags.map(f => `<span class="mini-flag">🚩 ${escHtml(f.label)}</span>`).join('')}</div>
        <div class="report-card-actions">
          <button class="btn-broadcast" onclick="broadcastAlert('${r.id}')">📢 Broadcast Warning to All Students</button>
          <button class="btn-dismiss" onclick="dismissReport('${r.id}')">🗑 Dismiss</button>
        </div>
      </div>
    </div>`).join('') + '</div>';

  if (state.broadcasts.length && broadcastSection) {
    broadcastSection.style.display = 'block';
    $('#broadcastHistoryList').innerHTML = state.broadcasts.map(b => `
      <div class="broadcast-item">
        <span class="bi-icon">📢</span>
        <div><div class="bi-text">${escHtml(b.message)}</div><div class="bi-time">Broadcast at ${b.timestamp}</div></div>
      </div>`).join('');
  }
}

function broadcastAlert(reportId) {
  const r = state.reports.find(x => x.id === reportId);
  if (!r) return;
  r.status = 'broadcast';
  const msg = `⚠️ FRAUD ALERT — A fake internship offer claiming to be from "${r.companyName}" is circulating via ${r.channel.toUpperCase()}. Do NOT pay any fees or share personal documents. Report similar messages to the Placement Cell immediately.`;
  state.broadcasts.push({ reportId, message: msg, timestamp: new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) });
  showBroadcastToast(r.companyName);
  renderReportQueue();
  updateCellStats();
}

function dismissReport(reportId) {
  const r = state.reports.find(x => x.id === reportId);
  if (r) r.status = 'dismissed';
  renderReportQueue();
  updateCellStats();
}

function showBroadcastToast(company) {
  const toast = $('#broadcastToast');
  $('#toastText').textContent = `Warning broadcast to all students: Fake offer from "${company}" — do not pay or share documents.`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 6000);
}

function closeBroadcastToast() { $('#broadcastToast').classList.remove('show'); }

function updateCellStats() {
  const p = state.reports.filter(r => r.status === 'pending').length;
  const b = state.broadcasts.length;
  const d = state.reports.filter(r => r.status === 'dismissed').length;
  if ($('#statPending'))   $('#statPending').textContent   = p;
  if ($('#statBroadcast')) $('#statBroadcast').textContent = b;
  if ($('#statDismissed')) $('#statDismissed').textContent = d;
}

// ══════════════════════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════════════════════
function showInsufficientPanel(title, desc) {
  $('#insufficientPanel').classList.add('visible');
  $('#insufficientPanel').innerHTML = `<div class="ins-icon">💬</div><div class="ins-title">${title}</div><div class="ins-desc">${desc}</div>`;
}

function resetApp() {
  $('#offerText').value = '';
  $('#senderField').value = '';
  $('#verdictPanel').classList.remove('visible');
  $('#verdictPanel').innerHTML = '';
  $('#checklistPanel').innerHTML = '';
  $('#checklistPanel').classList.remove('visible');
  $('#insufficientPanel').classList.remove('visible');
  $('#btnReset').classList.remove('visible');
  state.lastVerdict = null; state.lastScore = 0; state.lastFlags = [];
}

// ── Theme ──────────────────────────────────────────────────
let darkMode = true;
function toggleTheme() {
  darkMode = !darkMode;
  document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  $('#themeToggle').innerHTML = darkMode ? '<span class="toggle-icon">🌙</span> Dark' : '<span class="toggle-icon">☀️</span> Light';
}

// ── Channel (student) ──────────────────────────────────────
function selectChannel(ch) {
  state.channel = ch;
  document.querySelectorAll('#mainView .channel-btn').forEach(b => b.classList.remove('active'));
  $(`#btn-${ch}`).classList.add('active');
  const hint = $('#senderHint');
  if (!hint) return;
  if (ch === 'email') hint.innerHTML = '💡 e.g. "HR Team" &lt;careers@xyz-corp.com&gt; — the domain is checked against the company name';
  else hint.innerHTML = '💡 e.g. +91-98XXXXXXXX or XY-CORPHR (registered Sender ID) — personal mobile numbers are flagged';
}

// ── Login System ───────────────────────────────────────────
let selectedRole = null;

function selectRole(role) {
  selectedRole = role;
  document.querySelectorAll('.login-role-card').forEach(c => c.classList.remove('selected','placement-selected'));
  const card = role === 'student' ? $('#roleStudent') : $('#rolePlacement');
  card.classList.add(role === 'student' ? 'selected' : 'placement-selected');

  const formWrap = $('#loginFormWrap');
  const header   = $('#loginFormHeader');
  const hint     = $('#loginHint');

  formWrap.classList.add('visible');

  if (role === 'student') {
    header.innerHTML  = '🎓 Student / Parent Login';
    hint.innerHTML    = `Demo credentials: <strong>student</strong> / <strong>student@123</strong>`;
  } else {
    header.innerHTML  = '🏫 Placement Cell Login';
    hint.innerHTML    = `Demo credentials: <strong>admin</strong> / <strong>cell@123</strong>`;
  }

  $('#loginUsername').value = '';
  $('#loginPassword').value = '';
  $('#loginError').classList.remove('visible');
  setTimeout(() => $('#loginUsername').focus(), 150);
}

function doLogin() {
  if (!selectedRole) { showLoginError('Please select your role first.'); return; }
  const u = $('#loginUsername').value.trim();
  const p = $('#loginPassword').value.trim();
  const creds = CREDENTIALS[selectedRole];

  if (u !== creds.username || p !== creds.password) {
    showLoginError('Incorrect username or password. Please try again.');
    return;
  }

  // Login success
  state.currentRole = selectedRole;
  $('#loginPage').style.display    = 'none';
  $('#appPage').style.display      = 'block';

  if (selectedRole === 'student') {
    $('#mainView').style.display      = 'block';
    $('#cellDashboard').style.display = 'none';
    $('#userPillIcon').textContent    = '🎓';
    $('#userPillName').textContent    = 'Student';
    selectChannel('email');
  } else {
    $('#mainView').style.display      = 'none';
    $('#cellDashboard').style.display = 'block';
    $('#userPillIcon').textContent    = '🏫';
    $('#userPillName').textContent    = 'Placement Cell';
    selectCellChannel('email');
    updateCellStats();
    renderReportQueue();
  }
}

function showLoginError(msg) {
  const el = $('#loginError');
  el.textContent = msg;
  el.classList.add('visible');
}

function logoutToLogin() {
  state.currentRole = null;
  $('#appPage').style.display       = 'none';
  $('#loginPage').style.display     = 'flex';
  $('#mainView').style.display      = 'none';
  $('#cellDashboard').style.display = 'none';
  // Reset role selection
  document.querySelectorAll('.login-role-card').forEach(c => c.classList.remove('selected','placement-selected'));
  $('#loginFormWrap').classList.remove('visible');
  selectedRole = null;
  resetApp();
  resetCellAnalyse();
}

// ── Cell Tab Switching ─────────────────────────────────────
function switchCellTab(tab) {
  document.querySelectorAll('.cell-tab').forEach(t => t.classList.remove('active'));
  $(`#tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');
  $('#cellAnalyseTab').style.display  = tab === 'analyse'  ? 'block' : 'none';
  $('#cellReportsTab').style.display  = tab === 'reports'  ? 'block' : 'none';
  if (tab === 'reports') { renderReportQueue(); updateCellStats(); }
}

// ── Cell Channel ───────────────────────────────────────────
function selectCellChannel(ch) {
  state.cellChannel = ch;
  document.querySelectorAll('#cellAnalyseTab .channel-btn').forEach(b => b.classList.remove('active'));
  $(`#cell-btn-${ch}`).classList.add('active');
  const hint = $('#cellSenderHint');
  if (ch === 'email') hint.innerHTML = '💡 The sender email domain is checked against the company name';
  else hint.innerHTML = '💡 Personal mobile numbers are flagged; registered Business Sender IDs are safe';
}

// ── Cell Analyse ───────────────────────────────────────────
async function analyseCellOffer() {
  if (state.isCellAnalyzing) return;
  const text   = $('#cellOfferText').value;
  const sender = $('#cellSenderField').value.trim();
  const validation = validateInput(text);

  $('#cellVerdictPanel').classList.remove('visible');
  $('#cellVerdictPanel').innerHTML = '';
  $('#cellChecklistPanel').innerHTML = '';
  $('#cellChecklistPanel').classList.remove('visible');
  $('#cellInsufficientPanel').classList.remove('visible');

  if (validation === 'empty')     { showCellInsufficientPanel('Please enter the offer text to analyse.', 'The offer text field is empty.'); return; }
  if (validation === 'too-short') { showCellInsufficientPanel('Not enough information to assess.', 'Please paste the complete offer message.'); return; }

  state.isCellAnalyzing = true;
  state.cellLastOffer = { text, sender };

  const btn = $('#cellBtnAnalyze');
  btn.disabled = true;
  btn.innerHTML = `<span class="btn-icon">✨</span><span class="btn-text">Analysing with AI…</span>`;

  try {
    let result;
    if (CONFIG.USE_AI) {
      const groqRaw = await callGroqAPI(text, sender, state.cellChannel);
      if (groqRaw) {
        result = mapGeminiToResult(groqRaw, text, sender);
        result.entities = result.entities || extractEntities(text, sender);
        result.usedAI = true;
      }
    }
    if (!result) result = scoreOffer(text, sender);

    state.cellLastVerdict = result;
    state.cellLastScore   = result.score;
    state.cellLastFlags   = result.flags;

    // Run checklist in cell panel
    await runChecklistInPanel(result, 'cellChecklistPanel');
    await delay(200);
    renderVerdictInPanel(result, 'cellVerdictPanel', true /* isCell */);
    $('#cellBtnReset').style.display = 'block';
  } finally {
    state.isCellAnalyzing = false;
    btn.disabled = false;
    btn.innerHTML = `<span class="btn-icon">🔍</span><span class="btn-text">Analyse This Offer</span>`;
  }
}

function showCellInsufficientPanel(title, desc) {
  $('#cellInsufficientPanel').classList.add('visible');
  $('#cellInsufficientPanel').innerHTML = `<div class="ins-icon">💬</div><div class="ins-title">${title}</div><div class="ins-desc">${desc}</div>`;
}

function resetCellAnalyse() {
  $('#cellOfferText').value   = '';
  $('#cellSenderField').value = '';
  $('#cellVerdictPanel').classList.remove('visible');
  $('#cellVerdictPanel').innerHTML = '';
  $('#cellChecklistPanel').innerHTML = '';
  $('#cellChecklistPanel').classList.remove('visible');
  $('#cellInsufficientPanel').classList.remove('visible');
  $('#cellBtnReset').style.display = 'none';
  state.cellLastVerdict = null;
}

// ── Cell Direct Broadcast ──────────────────────────────────
let pendingCellBroadcast = null;

function openCellBroadcastModal(company, flags) {
  pendingCellBroadcast = { company, flags };
  const msg = `⚠️ FRAUD ALERT — A fake internship offer claiming to be from "${company}" is circulating. Do NOT pay any fees or share personal documents. Report similar messages to the Placement Cell immediately.`;
  $('#broadcastPreviewText').textContent = msg;
  $('#broadcastConfirmModal').classList.add('open');
}

function closeBroadcastConfirmModal() {
  $('#broadcastConfirmModal').classList.remove('open');
  pendingCellBroadcast = null;
}

function confirmCellBroadcast() {
  if (!pendingCellBroadcast) return;
  const { company } = pendingCellBroadcast;
  const msg = `⚠️ FRAUD ALERT — A fake internship offer claiming to be from "${company}" is circulating. Do NOT pay any fees or share personal documents. Report similar messages to the Placement Cell immediately.`;
  state.broadcasts.push({ reportId: 'DIRECT', message: msg, timestamp: new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' }) });
  closeBroadcastConfirmModal();
  showBroadcastToast(company);
  updateCellStats();
  // Update badge on reports tab
  updateReportsBadge();
  // Show success in cell verdict panel
  const broadcastBtn = $('#cellDirectBroadcastBtn');
  if (broadcastBtn) {
    broadcastBtn.textContent = '✅ Warning Broadcast Sent!';
    broadcastBtn.disabled = true;
    broadcastBtn.style.background = 'var(--safe-bg)';
    broadcastBtn.style.color = 'var(--safe-text)';
    broadcastBtn.style.boxShadow = 'none';
    broadcastBtn.style.border = '1px solid var(--safe-border)';
  }
}

function updateReportsBadge() {
  const pending = state.reports.filter(r => r.status === 'pending').length;
  const badge = $('#reportsBadge');
  if (badge) {
    if (pending > 0) { badge.textContent = pending; badge.style.display = 'inline-block'; }
    else badge.style.display = 'none';
  }
}


// ── Utilities ──────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
