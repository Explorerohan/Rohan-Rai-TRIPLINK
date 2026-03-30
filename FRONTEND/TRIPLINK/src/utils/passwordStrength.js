export const getPasswordStrength = (value) => {
  const password = String(value || "");
  if (!password) {
    return { level: "none", score: 0, progress: 0 };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) {
    return { level: "basic", score, progress: 0.33 };
  }
  if (score <= 4) {
    return { level: "good", score, progress: 0.66 };
  }
  return { level: "strong", score, progress: 1 };
};
