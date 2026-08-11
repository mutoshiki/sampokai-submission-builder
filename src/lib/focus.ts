import type { ValidationTarget } from "../types";

export const focusValidationTarget = (target: ValidationTarget) => {
  const element = document.getElementById(target.fieldId);
  if (!element) return false;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  if (element instanceof HTMLElement) element.focus();
  return true;
};
