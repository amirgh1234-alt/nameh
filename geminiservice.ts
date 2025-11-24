import { GoogleGenAI, Type } from "@google/genai";
import { DocumentType, DocumentInputs } from "../types";

const apiKey = process.env.API_KEY;

// Initialize the client once
const ai = new GoogleGenAI({ apiKey: apiKey });

const LETTER_SYSTEM_INSTRUCTION = `
شما یک "دبیرخانه هوشمند" و متخصص مکاتبات اداری سطح بالا هستید.
دستورالعمل اصلی: کاربر اطلاعاتی شامل گیرنده، موضوع و متن اصلی می‌دهد. شما باید **دو نسخه متفاوت** از یک نامه اداری استاندارد تولید کنید.

قوانین حیاتی:
1. **ممنوعیت تکرار:** متن کاربر را عیناً تکرار نکنید. بازنویسی کنید.
2. **قالب اجباری:**
   - [تاریخ: ...]، [شماره: ...]، [پیوست: ...]
   - **جناب آقای/سرکار خانم [نام گیرنده]**
   - **[سمت گیرنده]**
   - **موضوع: [موضوع نامه]**
   - **با سلام و احترام،**
   - **متن اصلی:** (شامل مقدمه، شرح موضوع با ادبیات فاخر، و درخواست مشخص).
   - **بخش پایانی:** (مثلاً: خواهشمند است دستور فرمایید اقدام لازم مبذول گردد.)
   - **با تشکر / ارادتمند**

3. **خروجی JSON:** خروجی شما باید حتماً یک آرایه JSON شامل دو رشته باشد.
`;

const MINUTES_SYSTEM_INSTRUCTION = `
شما مسئول دبیرخانه و تنظیم صورتجلسات هستید.
دستورالعمل اصلی: تبدیل ورودی کاربر به **دو نسخه متفاوت** از یک صورتجلسه رسمی.

قوانین حیاتی:
1. **قالب اجباری:**
   - **عنوان:** صورتجلسه
   - **مشخصات:** شماره، تاریخ، ساعت، مکان.
   - **حاضرین:**
   - **دستور جلسه:**
   - **خلاصه مذاکرات:**
   - **مصوبات:**
   - **محل امضا:**

2. **خروجی JSON:** خروجی شما باید حتماً یک آرایه JSON شامل دو رشته باشد.
`;

export const generateDocument = async (
  inputs: DocumentInputs,
  type: DocumentType
): Promise<string[]> => {
  if (!apiKey) {
    throw new Error("تنظیمات API Key یافت نشد.");
  }

  const modelId = 'gemini-2.5-flash'; 
  const systemInstruction = type === DocumentType.LETTER 
    ? LETTER_SYSTEM_INSTRUCTION 
    : MINUTES_SYSTEM_INSTRUCTION;

  try {
    // Construct a structured prompt
    let inputContext = '';
    if (type === DocumentType.LETTER) {
      inputContext = `
نام گیرنده: ${inputs.recipientName || '---'}
سمت گیرنده: ${inputs.recipientRole || '---'}
موضوع: ${inputs.subject || '---'}
متن/توضیحات کاربر: "${inputs.body}"
      `;
    } else {
      inputContext = `
موضوع جلسه/توضیحات: "${inputs.body}"
      `;
    }

    const prompt = `
وظیفه: بر اساس اطلاعات زیر، دقیقاً 2 نمونه متن کامل و رسمی تهیه کن.
نوع سند: ${type === DocumentType.LETTER ? 'نامه اداری' : 'صورتجلسه'}

اطلاعات ورودی:
${inputContext}

دستورالعمل تنوع:
- نمونه اول: بسیار رسمی، مختصر و قاطع.
- نمونه دوم: کمی مشروح‌تر، با ادبیات نرم‌تر و توضیحات تکمیلی محترمانه.

فرمت خروجی (بسیار مهم):
فقط و فقط یک آرایه JSON برگردان که شامل دو متن باشد. مثال:
["متن نمونه اول...", "متن نمونه دوم..."]
    `.trim();

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });

    if (response.text) {
      try {
        const parsed = JSON.parse(response.text);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
        // Fallback if structure is wrong but text exists
        return [response.text];
      } catch (e) {
        // If JSON parse fails, return raw text as one option
        return [response.text];
      }
    } else {
      throw new Error("پاسخی از مدل دریافت نشد. لطفاً مجدد تلاش کنید.");
    }

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "خطایی در برقراری ارتباط با هوش مصنوعی رخ داد.");
  }
};

export const reviseDocument = async (
  currentDraft: string,
  feedback: string,
  type: DocumentType
): Promise<string> => {
  if (!apiKey) {
    throw new Error("تنظیمات API Key یافت نشد.");
  }

  const modelId = 'gemini-2.5-flash';
  const systemInstruction = type === DocumentType.LETTER 
    ? LETTER_SYSTEM_INSTRUCTION 
    : MINUTES_SYSTEM_INSTRUCTION;

  try {
    const prompt = `
وظیفه: ویرایش سند زیر بر اساس بازخورد کاربر.
نوع سند: ${type === DocumentType.LETTER ? 'نامه اداری' : 'صورتجلسه'}

سند فعلی:
"""
${currentDraft}
"""

بازخورد و درخواست اصلاح کاربر:
"${feedback}"

دستورالعمل:
1. سند را با توجه به خواسته‌ی کاربر بازنویسی کن.
2. ساختار رسمی و قالب استاندارد (هدر، امضا، موضوع و ...) را حتماً حفظ کن.
3. فقط متن اصلاح شده نهایی را به صورت رشته متنی ساده (نه JSON) برگردان.
    `.trim();

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.5,
      }
    });

    if (response.text) {
      return response.text;
    } else {
      throw new Error("پاسخی از مدل دریافت نشد.");
    }
  } catch (error: any) {
    console.error("Gemini Revision Error:", error);
    throw new Error(error.message || "خطایی در ویرایش متن رخ داد.");
  }
};
