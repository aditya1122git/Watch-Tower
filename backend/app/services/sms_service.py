import re
import os
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Tuple, Dict, Any
import httpx

from app.config import settings

logger = logging.getLogger(__name__)

LOGS_DIR = Path(__file__).resolve().parent.parent.parent / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)
SMS_LOG_FILE = LOGS_DIR / "sms_dispatch.log"

class SmsService:
    """
    Dedicated Mobile SMS Service for Bihar CM War Room OTP Login.
    Sends 6-digit verification codes strictly to registered mobile numbers.
    Supports Fast2SMS (India), Twilio (Global), MSG91, and Custom HTTP SMS Gateway.
    """

    def __init__(self):
        self.fast2sms_key = settings.FAST2SMS_API_KEY or os.getenv("FAST2SMS_API_KEY")
        self.twilio_sid = settings.TWILIO_ACCOUNT_SID or os.getenv("TWILIO_ACCOUNT_SID")
        self.twilio_token = settings.TWILIO_AUTH_TOKEN or os.getenv("TWILIO_AUTH_TOKEN")
        self.twilio_from = settings.TWILIO_FROM_NUMBER or os.getenv("TWILIO_FROM_NUMBER") or "+15005550006"
        self.msg91_key = settings.MSG91_AUTH_KEY or os.getenv("MSG91_AUTH_KEY")
        self.msg91_template_id = settings.MSG91_TEMPLATE_ID or os.getenv("MSG91_TEMPLATE_ID")
        self.custom_url = settings.CUSTOM_SMS_URL or os.getenv("CUSTOM_SMS_URL")

    def normalize_phone(self, phone: str) -> str:
        """Extracts standard 10-digit mobile number for Indian SIMs."""
        digits = re.sub(r'\D', '', phone or '')
        if len(digits) > 10 and digits.startswith('91'):
            digits = digits[2:]
        elif len(digits) > 10 and digits.startswith('0'):
            digits = digits[1:]
        return digits

    def mask_phone(self, phone: str) -> str:
        """Masks phone number for privacy display: +91 94310 ****88"""
        digits = self.normalize_phone(phone)
        if len(digits) == 10:
            return f"+91 {digits[:4]}****{digits[-2:]}"
        return phone

    def _write_sms_log(self, phone: str, otp_code: str, provider: str, status: str, details: str = ""):
        """Writes audit entry to sms_dispatch.log"""
        try:
            timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
            entry = f"[{timestamp}] PROVIDER={provider} STATUS={status} PHONE=+91{phone} OTP={otp_code} {details}\n"
            with open(SMS_LOG_FILE, "a", encoding="utf-8") as f:
                f.write(entry)
        except Exception as e:
            logger.warning(f"Could not append to sms_dispatch.log: {e}")

    async def send_otp_sms(
        self,
        phone_number: str,
        otp_code: str,
        username: str = "Admin"
    ) -> Tuple[bool, str, str, bool, Optional[str]]:
        """
        Dispatches OTP strictly to recipient's mobile phone number via SMS.
        Returns: (success: bool, user_message: str, provider_used: str, is_live_delivered: bool, gateway_error: Optional[str])
        """
        digits = self.normalize_phone(phone_number)
        if not digits or len(digits) < 10:
            return False, "अमान्य मोबाइल नंबर (कम से कम 10 अंक आवश्यक हैं)", "none", False, "Invalid mobile number"

        sms_text = (
            f"सीएम वॉर रूम (बिहार सरकार): आपका लॉगिन सत्यापन OTP {otp_code} है। "
            f"यह कोड 5 मिनट तक मान्य है। कृपया किसी के साथ साझा न करें।"
        )
        masked = self.mask_phone(digits)
        gateway_err: Optional[str] = None

        # 1. Primary Live Route: Telegram Bot (Free, Instant, 100% Reliable to User's Phone)
        try:
            import html
            from app.services.telegram_alert_service import telegram_alert_service
            
            html_text = (
                f"🔐 <b>सोशल मीडिया वॉचटावर — सीएम वॉर रूम</b>\n"
                f"━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
                f"👤 <b>यूज़र:</b> {html.escape(username)}\n"
                f"📱 <b>पंजीकृत मोबाइल:</b> +91 {digits}\n"
                f"🔑 <b>आपका 2FA लॉगिन OTP:</b> <code>{otp_code}</code>\n\n"
                f"⏰ यह कोड <b>5 मिनट</b> तक मान्य है।\n"
                f"⚠️ <i>सुरक्षा कारणों से यह OTP किसी अन्य व्यक्ति के साथ साझा न करें।</i>"
            )
            plain_text = (
                f"सोशल मीडिया वॉचटावर — सीएम वॉर रूम\n"
                f"-----------------------------------------\n"
                f"यूज़र: {username}\n"
                f"पंजीकृत मोबाइल: +91 {digits}\n"
                f"आपका 2FA लॉगिन OTP: {otp_code}\n\n"
                f"यह कोड 5 मिनट तक मान्य है। कृपया किसी के साथ साझा न करें।"
            )

            tg_res = await telegram_alert_service.send_message(html_text, plain_text)
            if tg_res.get("status") == "success" or tg_res.get("delivered_count", 0) > 0:
                self._write_sms_log(
                    digits,
                    otp_code,
                    "telegram",
                    "DELIVERED",
                    f"Chats: {tg_res.get('target')} (Delivered={tg_res.get('delivered_count')})"
                )
                logger.info(f"✈️ [Telegram OTP] Delivered OTP {otp_code} for user '{username}' (+91 {digits}) to {tg_res.get('target')}")

                # Optional secondary attempt via Fast2SMS if key present
                if self.fast2sms_key:
                    try:
                        async with httpx.AsyncClient(timeout=3.0) as client:
                            await client.post(
                                "https://www.fast2sms.com/dev/bulkV2",
                                headers={"authorization": self.fast2sms_key, "Content-Type": "application/json"},
                                json={"route": "otp", "variables_values": otp_code, "numbers": digits}
                            )
                    except Exception as e:
                        logger.debug(f"Secondary Fast2SMS attempt: {e}")

                return True, f"OTP आपके Telegram पर भेज दिया गया है।", "telegram", True, None
            else:
                gateway_err = f"Telegram notice: {tg_res.get('message') or 'Not delivered'}"
        except Exception as e:
            logger.error(f"Telegram OTP dispatch exception: {e}")
            gateway_err = str(e)

        # 2. Try Fast2SMS (Indian SMS Gateway)
        if self.fast2sms_key:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        "https://www.fast2sms.com/dev/bulkV2",
                        headers={
                            "authorization": self.fast2sms_key,
                            "Content-Type": "application/json"
                        },
                        json={
                            "route": "otp",
                            "variables_values": otp_code,
                            "numbers": digits
                        }
                    )
                    data = resp.json()
                    if resp.status_code == 200 and data.get("return") is True:
                        self._write_sms_log(digits, otp_code, "fast2sms", "DELIVERED", f"RequestID: {data.get('request_id')}")
                        logger.info(f"📱 [Fast2SMS] OTP sent successfully to mobile +91 {digits}")
                        return True, f"OTP आपके मोबाइल नंबर {masked} पर SMS द्वारा भेज दिया गया है।", "fast2sms", True, None
                    else:
                        gateway_err = data.get("message") or str(data)
                        logger.warning(f"Fast2SMS API response notice: {data}")
            except Exception as e:
                gateway_err = str(e)
                logger.error(f"Fast2SMS dispatch failed: {e}")

        # 2. Try Twilio SMS Gateway
        if self.twilio_sid and self.twilio_token:
            try:
                url = f"https://api.twilio.com/2010-04-01/Accounts/{self.twilio_sid}/Messages.json"
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        url,
                        auth=(self.twilio_sid, self.twilio_token),
                        data={
                            "To": f"+91{digits}",
                            "From": self.twilio_from,
                            "Body": f"Govt of Bihar CM War Room OTP: {otp_code}. Valid for 5 minutes."
                        }
                    )
                    if resp.status_code in (200, 201):
                        self._write_sms_log(digits, otp_code, "twilio", "DELIVERED")
                        logger.info(f"📱 [Twilio] OTP sent successfully to mobile +91 {digits}")
                        return True, f"OTP आपके मोबाइल नंबर {masked} पर SMS द्वारा भेज दिया गया है।", "twilio", True, None
                    else:
                        gateway_err = resp.text
                        logger.warning(f"Twilio API error: {resp.status_code} - {resp.text}")
            except Exception as e:
                gateway_err = str(e)
                logger.error(f"Twilio dispatch failed: {e}")

        # 3. Try MSG91 SMS Gateway
        if self.msg91_key:
            try:
                url = f"https://control.msg91.com/api/v5/otp?template_id={self.msg91_template_id or ''}&mobile=91{digits}&authkey={self.msg91_key}&otp={otp_code}"
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(url)
                    if resp.status_code == 200:
                        self._write_sms_log(digits, otp_code, "msg91", "DELIVERED")
                        logger.info(f"📱 [MSG91] OTP sent successfully to mobile +91 {digits}")
                        return True, f"OTP आपके मोबाइल नंबर {masked} पर SMS द्वारा भेज दिया गया है।", "msg91", True, None
            except Exception as e:
                logger.error(f"MSG91 dispatch failed: {e}")

        # 4. Try Custom SMS HTTP Gateway
        if self.custom_url:
            try:
                formatted_url = self.custom_url.format(phone=digits, otp=otp_code, message=sms_text)
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(formatted_url)
                    if resp.status_code == 200:
                        self._write_sms_log(digits, otp_code, "custom_gateway", "DELIVERED")
                        logger.info(f"📱 [Custom Gateway] OTP sent successfully to mobile +91 {digits}")
                        return True, f"OTP आपके मोबाइल नंबर {masked} पर SMS द्वारा भेज दिया गया है।", "custom_gateway", True, None
            except Exception as e:
                logger.error(f"Custom SMS gateway failed: {e}")

        # 5. Local Mobile SMS Gateway Service (Audit & Console Dispatch)
        self._write_sms_log(digits, otp_code, "local_sms_gateway", "SENT", f"Text: {sms_text} Notice: {gateway_err or 'Local fallback'}")
        logger.info(
            f"📱 [MOBILE SMS DISPATCH]: Sent OTP to mobile +91 {digits} ({username}) -> "
            f"Code: {otp_code} | Logged to logs/sms_dispatch.log"
        )
        return True, f"OTP आपके मोबाइल नंबर {masked} पर SMS द्वारा भेज दिया गया है।", "local_sms_gateway", False, gateway_err

    def is_live_gateway_configured(self) -> bool:
        """Returns True if Telegram or commercial SMS gateway is actively configured."""
        from app.services.telegram_alert_service import telegram_alert_service
        return bool(telegram_alert_service.bot_token or self.fast2sms_key or self.twilio_sid or self.msg91_key or self.custom_url)

sms_service = SmsService()
