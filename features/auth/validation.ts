export const USERNAME_PATTERN = /^[A-Za-z0-9]+$/;
export const NICKNAME_PATTERN = /^[가-힣A-Za-z0-9_-]+$/;
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])[\x21-\x7E]{8,16}$/;

export function validateUsername(value: string): string {
  if (value.length < 4 || value.length > 20) return '아이디는 4~20자로 입력해 주세요.';
  if (!USERNAME_PATTERN.test(value)) return '아이디는 공백 없이 영문과 숫자만 사용할 수 있어요.';
  return '';
}

export function validateNickname(value: string): string {
  if (value.length < 2 || value.length > 16) return '닉네임은 2~16자로 입력해 주세요.';
  if (!NICKNAME_PATTERN.test(value)) return '닉네임에는 한글, 영문, 숫자, -, _만 사용할 수 있어요.';
  return '';
}

export function validatePassword(value: string): string {
  if (!PASSWORD_PATTERN.test(value)) return '비밀번호는 8~16자의 영문 대·소문자, 숫자, 특수문자를 각각 1개 이상 포함해야 해요.';
  return '';
}
