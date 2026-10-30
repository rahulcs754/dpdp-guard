import type { Category, PiiMatch } from "./types.js";

interface Rule {
  element: string;
  label: string;
  category: Category;
  test: RegExp;
  confidence?: "medium";
  ageSignal?: boolean;
}

/**
 * Ordered: the first rule that matches wins, so specific rules
 * (emailAddress, ipAddress) come before broad ones (address).
 * Each regex runs on the normalized name: lowercase, no `_`, `-` or spaces.
 */
const RULES: Rule[] = [
  { element: "aadhaar", label: "Aadhaar number", category: "government-id", test: /aadha?a?r|uidai/ },
  { element: "pan", label: "PAN", category: "government-id", test: /^pan(no|num|number|card)?$/ },
  { element: "passport", label: "Passport number", category: "government-id", test: /passport/ },
  { element: "voter-id", label: "Voter ID", category: "government-id", test: /^(voterid|epic(no|number)?)$/ },
  { element: "driving-licence", label: "Driving licence", category: "government-id", test: /driv(ing|er)s?licen[cs]e/ },
  { element: "email", label: "Email address", category: "contact", test: /(^|[a-z])e?mail(address|id)?$/ },
  { element: "phone", label: "Phone number", category: "contact", test: /(phone|mobile|msisdn|whatsapp|cellnumber)(no|num|number)?$/ },
  { element: "ip", label: "IP address", category: "device-id", test: /^(ip|ipaddress|ipaddr|clientip|remoteaddr|remoteaddress)$/ },
  { element: "address", label: "Postal address", category: "contact", test: /(address(line)?\d?|street|landmark|pincode|postalcode|postcode|zipcode|zip)$/ },
  { element: "city", label: "City / district", category: "location", test: /^(city|district)$/, confidence: "medium" },
  { element: "geo", label: "Precise location", category: "location", test: /^(lat|lng|lon|latitude|longitude|geo|geolocation|coords|coordinates|location)$/ },
  { element: "dob", label: "Date of birth", category: "children", test: /^(dob|dateofbirth|birthdate|birthday|birthdt)$/, ageSignal: true },
  { element: "age", label: "Age", category: "children", test: /^(age|userage)$/, ageSignal: true },
  { element: "name", label: "Person name", category: "identity", test: /^(firstname|lastname|middlename|fullname|surname|givenname|familyname|fathername|fathersname|mothername|mothersname|guardianname|nominee(name)?)$/ },
  { element: "name", label: "Person name", category: "identity", test: /^(name|displayname|username)$/, confidence: "medium" },
  { element: "gender", label: "Gender", category: "identity", test: /^(gender|sex)$/ },
  { element: "photo", label: "Photo", category: "identity", test: /^(photo|avatar|selfie|profilepic|profilephoto|profileimage)(url)?$/, confidence: "medium" },
  { element: "device-id", label: "Device / advertising ID", category: "device-id", test: /(deviceid|fingerprint|advertisingid|adid|gaid|idfa|imei|fcmtoken|pushtoken)$/ },
  { element: "health", label: "Health data", category: "health", test: /(bloodgroup|bloodtype|medical|diagnos|health|disease|prescription|allerg|disabilit)/ },
  { element: "card", label: "Card number", category: "financial", test: /(cardnumber|cardno|creditcard|debitcard|cvv|cvc)$/ },
  { element: "bank", label: "Bank account", category: "financial", test: /(accountnumber|accountno|bankaccount|ifsc)/ },
  { element: "upi", label: "UPI ID", category: "financial", test: /^(upi|upiid|vpa)$/ },
  { element: "income", label: "Income / salary", category: "financial", test: /(salary|income|ctc)$/ },
];

/** Names of variables that usually hold a whole person record. */
const PERSON_OBJECT = /^(user|users|currentuser|customer|customers|patient|profile|member|student|person|applicant|employee)$/;

export function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Classify a field / variable / input name as personal data, or return null. */
export function classify(name: string): PiiMatch | null {
  const n = normalize(name);
  if (!n || n.length > 40) return null;
  for (const r of RULES) {
    if (r.test.test(n)) {
      return {
        element: r.element,
        label: r.label,
        category: r.category,
        confidence: r.confidence ?? "high",
        ...(r.ageSignal ? { ageSignal: true } : {}),
      };
    }
  }
  return null;
}

export function isPersonObject(name: string): boolean {
  return PERSON_OBJECT.test(normalize(name));
}

/** HTML autocomplete tokens that name personal data. */
const AUTOCOMPLETE: Record<string, string> = {
  name: "name",
  "given-name": "firstName",
  "family-name": "lastName",
  email: "email",
  tel: "phone",
  "tel-national": "phone",
  "street-address": "address",
  "address-line1": "address",
  "address-line2": "address",
  "postal-code": "pincode",
  bday: "dob",
  "cc-number": "cardNumber",
  sex: "gender",
};

const INPUT_TYPE: Record<string, string> = { email: "email", tel: "phone" };

export function classifyAutocomplete(value: string): PiiMatch | null {
  const key = AUTOCOMPLETE[value.trim().toLowerCase()];
  return key ? classify(key) : null;
}

export function classifyInputType(value: string): PiiMatch | null {
  const key = INPUT_TYPE[value.trim().toLowerCase()];
  return key ? classify(key) : null;
}
