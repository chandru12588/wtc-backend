import axios from "axios";

export async function sendSMS(phone, message) {
  try {
    const apiKey = process.env.SMS_API_KEY;

    await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      {
        route: "v3",
        sender_id: "TXTIND",
        message: message,
        language: "english",
        flash: 0,
        numbers: phone,
      },
      {
        headers: {
          authorization: apiKey,
        },
      }
    );

    console.log("📱 SMS sent to →", phone);
  } catch (err) {
    console.error("SMS error:", err.response?.data || err);
  }
}
