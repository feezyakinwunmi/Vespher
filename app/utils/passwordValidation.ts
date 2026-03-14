// app/utils/passwordValidation.ts
export interface PasswordStrength {
  score: number; // 0-4
  feedback: string[];
  isValid: boolean;
}

export function validatePassword(password: string): PasswordStrength {
  const feedback: string[] = [];
  let score = 0;

  // Length check (minimum 8 characters)
  if (password.length >= 8) {
    score += 1;
  } else {
    feedback.push('At least 8 characters');
  }

  // Uppercase letter check
  if (/[A-Z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('One uppercase letter');
  }

  // Lowercase letter check
  if (/[a-z]/.test(password)) {
    score += 1;
  } else {
    feedback.push('One lowercase letter');
  }

  // Number check
  if (/[0-9]/.test(password)) {
    score += 1;
  } else {
    feedback.push('One number');
  }

  // Special character check
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    score += 1;
  } else {
    feedback.push('One special character');
  }

  return {
    score,
    feedback,
    isValid: score >= 4, // At least 4 criteria met
  };
}

export function getPasswordStrengthColor(score: number): string {
  if (score <= 2) return '#ef4444'; // Weak - Red
  if (score <= 3) return '#f59e0b'; // Medium - Orange
  return '#10b981'; // Strong - Green
}

export function getPasswordStrengthLabel(score: number): string {
  if (score <= 2) return 'Weak';
  if (score <= 3) return 'Medium';
  return 'Strong';
}