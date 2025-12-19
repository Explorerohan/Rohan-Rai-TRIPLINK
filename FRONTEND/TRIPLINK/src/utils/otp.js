const SERVICE_ID = "service_drzeno8";
const TEMPLATE_ID = "template_7jxk7ff";
const PUBLIC_KEY = "P4yjMlbQu_ckrhA3-";

export const generateOtp = () => Math.floor(1000 + Math.random() * 9000).toString();

export const sendOtpEmail = (email, otp) => {
  const templateParams = {
    email,
    passcode: otp,
    time: new Date(Date.now() + 5 * 60 * 1000).toLocaleTimeString(),
  };
  return fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      service_id: SERVICE_ID,
      template_id: TEMPLATE_ID,
      user_id: PUBLIC_KEY,
      template_params: templateParams,
    }),
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text();
      console.warn("EmailJS send error:", text || res.statusText);
      throw new Error(text || "EmailJS send failed");
    }
    const text = await res.text();
    if (text) console.log("EmailJS send success:", text);
    return res;
  });
};
