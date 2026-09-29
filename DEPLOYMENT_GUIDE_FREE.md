# 🚀 बिहार सीएम वॉर रूम — 100% मुफ़्त डिप्लॉयमेंट गाइड (FREE DEPLOYMENT GUIDE)

यह गाइड आपको बिना ₹1 खर्च किए इस पूरे सिस्टम (Frontend + Backend + Database + 2FA SMS Login) को इंटरनेट पर लाइव करने के आसान चरण बताता है।

---

## 📋 क्या-क्या मुफ़्त मिलेगा?
- **बैकएंड (FastAPI Python):** [Render.com](https://render.com) पर मुफ़्त वेब सर्विस (Free SSL/HTTPS)।
- **फ्रंटएंड (React + Vite):** Render Static Site या [Vercel](https://vercel.com) पर मुफ़्त ग्लोबल CDN।
- **डेटाबेस:** इनबिल्ट SQLite या Render मुफ़्त PostgreSQL।
- **2FA SMS OTP:** [Fast2SMS](https://www.fast2sms.com) (भारत में मुफ़्त टेस्टिंग क्रेडिट्स)।
- **टेलीग्राम अलर्ट्स:** 100% मुफ़्त टेलीग्राम बॉट API।

---

## 🛠️ तरीका 1: Render.com पर 1-क्लिक डिप्लॉय (सबसे आसान)

हमने प्रोजेक्ट में `render.yaml` ऑटोमेशन फ़ाइल तैयार कर दी है, जिससे बैकएंड और फ्रंटएंड दोनों एक साथ डिप्लॉय हो जाते हैं।

### चरण 1: कोड को GitHub पर डालें
यदि आपके पास GitHub खाता है:
1. [github.com](https://github.com) पर नया प्राइवेट/पब्लिक रिपॉजिटरी बनाएं (उदा. `bihar-watchtower`).
2. अपने टर्मिनल में यह कमांड चलाएं:
```bash
git init
git add .
git commit -m "Bihar CM War Room v1.0 Production"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/bihar-watchtower.git
git push -u origin main
```

---

### चरण 2: Render.com पर कनेक्ट करें
1. [https://render.com](https://render.com) पर जाएं और **"Get Started for Free"** (GitHub से लॉगिन) करें।
2. डैशबोर्ड पर ऊपर दाईं ओर **"New +"** बटन दबाएं और **"Blueprint"** चुनें।
3. अपनी `bihar-watchtower` रिपॉजिटरी को सेलेक्ट करें।
4. Render स्वतः `render.yaml` को पढ़ लेगा और 2 सेवाएं तैयार करेगा:
   - **`bihar-watchtower-backend`** (Python 3.12 Web Service)
   - **`bihar-watchtower-frontend`** (React Vite Web App)

---

### चरण 3: पर्यावरण चर (Environment Variables) भरें
Render आपसे ये ज़रूरी कुंजियां मांगेगा (ये आपकी मौजूदा `.env` से ली गई हैं):

| वेरिएबल का नाम | वैल्यू | विवरण |
|---|---|---|
| `ENV` | `production` | प्रोडक्शन मोड |
| `DEBUG` | `False` | डिबग बंद |
| `SECRET_KEY` | `bihar-samrat-choudhary-watchtower-prod-secret-2026` | टोकन एन्क्रिप्शन |
| `DATABASE_URL` | `sqlite+aiosqlite:///./social_watchtower.db` | डेटाबेस |
| `GEMINI_API_KEY` | *(आपकी Gemini Key)* | AI विश्लेषण |
| `TELEGRAM_BOT_TOKEN` | `8753269181:AAHuxWWzf8OfyVAjAtoLE4d_daEAUgh0c-M` | टेलीग्राम बॉट |
| `TELEGRAM_CHAT_ID` | `7566579670, 7574720019` | अलर्ट्स चैट आईडी |
| `FAST2SMS_API_KEY` | *(वैकल्पिक Fast2SMS API Key)* | लाइव मोबाइल SMS के लिए |

---

### चरण 4: "Apply" दबाएं
- 2-3 मिनट में बैकएंड और फ्रंटएंड दोनों बिल्ड हो जाएंगे।
- आपको 2 लाइव लिंक्स मिलेंगे:
  - **वेबसाइट लिंक:** `https://bihar-watchtower-frontend.onrender.com`
  - **API लिंक:** `https://bihar-watchtower-backend.onrender.com`

---

## 📱 Fast2SMS से मुफ़्त लाइव SMS कैसे चालू करें?
यदि आप चाहते हैं कि लॉगिन OTP आपके भौतिक मोबाइल `9140407471` के SMS इनबॉक्स में तुरंत आए:
1. [https://www.fast2sms.com](https://www.fast2sms.com) पर जाएं और 1 मिनट में मुफ़्त साइनअप करें।
2. लॉगिन के बाद बाएँ मेनू में **"Dev API"** पर क्लिक करें।
3. वहां से अपनी **API Authorization Key** कॉपी करें।
4. Render में `FAST2SMS_API_KEY` में वह की पेस्ट कर दें।
5. अब जब भी आप पासवर्ड डालेंगे, Fast2SMS आपके मोबाइल पर तुरंत SMS भेज देगा!

---

## 🔑 लॉगिन क्रेडेंशियल्स व सुरक्षा सेटिंग्स

- **एडमिन यूज़रनेम:** `admin`
- **पासवर्ड:** `Bihar2026@CM`
- **पंजीकृत 2FA मोबाइल नंबर:** `+91 9140407471`
- **सत्र सीमा:** कड़ाई से अधिकतम **5 समवर्ती सत्र (Floating Slots)**।

### 🛡️ 2-स्टेप सुरक्षा लॉगिन प्रक्रिया:
1. ऑपरेटर या एडमिन अपना आईडी और पासवर्ड दर्ज करता है।
2. पासवर्ड सही होने पर सिस्टम तुरंत पंजीकृत मोबाइल `+91 9140407471` पर 6-अंकों का SMS OTP भेजता है।
3. 6-अंकों का OTP सत्यापित होते ही वॉर रूम खुल जाता है।
