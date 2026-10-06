import { useLayoutEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { apiErrorMessage } from "../api/errors";
import { inputValidationMessage } from "../utils/inputValidation";

function fieldLabel(control, index) {
  const label = control.labels?.[0] || Array.from(control.parentElement?.children || []).find((node) => node.tagName === "LABEL");
  if (label) {
    const copy = label.cloneNode(true);
    copy.querySelectorAll("input, select, textarea, button, svg, option, .MuiAutocomplete-root").forEach((node) => node.remove());
    const text = copy.textContent.replace(/\s+/g, " ").replace(/\s*\*\s*$/, "").trim();
    if (text) return text;
  }
  return control.getAttribute("aria-label") || control.name?.replaceAll("_", " ") || control.placeholder || `Field ${index + 1}`;
}

function validate(form) {
  return Array.from(form.elements).flatMap((control, index) => {
    if (!control.willValidate || !control.validity) return [];
    const label = fieldLabel(control, index);
    const value = control.value || "";
    let message = "";
    if (control.required && !value.trim() && !["checkbox", "radio"].includes(control.type)) message = `${label} is required.`;
    else if (!control.validity.valid) message = `${label}: ${control.validationMessage}`;
    else if (value && control.minLength > 0 && value.length < control.minLength) message = `${label} must contain at least ${control.minLength} characters.`;
    else if (value && control.maxLength > 0 && value.length > control.maxLength) message = `${label} must contain no more than ${control.maxLength} characters.`;
    if (!message) message = inputValidationMessage(control, label);
    if (message) return [{ message, control }];
    return [];
  });
}

function schemaMessages(errors) {
  if (!errors || typeof errors !== "object") return [];
  if (typeof errors.message === "string") return [errors.message];
  return Object.entries(errors).filter(([key]) => key !== "ref").flatMap(([, value]) => schemaMessages(value));
}

export function ValidatedForm({ children, onSubmit, error = "", fieldErrors, validate: validateExtra, ...props }) {
  const [issues, setIssues] = useState([]);
  const [attempted, setAttempted] = useState(false);
  const [requestError, setRequestError] = useState("");
  const summary = useRef(null);
  const latestValidator = useRef(validateExtra);
  useLayoutEffect(() => { latestValidator.current = validateExtra; }, [validateExtra]);
  const focusSummary = () => window.requestAnimationFrame(() => {
    summary.current?.focus({ preventScroll: true });
    summary.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  });
  const submit = async (event) => {
    event.preventDefault();
    const next = [...validate(event.currentTarget), ...(validateExtra?.() || []).map((message) => ({ message }))];
    setRequestError("");
    setAttempted(true);
    setIssues(next);
    if (next.length) { focusSummary(); return; }
    try { await onSubmit?.(event); }
    catch (err) { setRequestError(apiErrorMessage(err, "Unable to submit. Please try again.")); }
    focusSummary();
  };
  const messages = attempted ? [...issues, ...schemaMessages(fieldErrors).map((message) => ({ message })), ...([error, requestError].filter(Boolean).map((message) => ({ message })))] : [];
  const recheck = (form) => {
    if (attempted) window.setTimeout(() => {
      if (form.isConnected) setIssues([...validate(form), ...(latestValidator.current?.() || []).map((message) => ({ message }))]);
    }, 0);
  };
  return <form {...props} noValidate onSubmit={submit} onInput={(event) => {
    props.onInput?.(event);
    recheck(event.currentTarget);
  }} onChange={(event) => {
    props.onChange?.(event);
    recheck(event.currentTarget);
  }}>
    {children}
    {messages.length > 0 && <div ref={summary} role="alert" tabIndex={-1} style={{ gridColumn: "1 / -1", flexBasis: "100%", marginTop: 12, padding: 14, border: "1px solid #fca5a5", borderRadius: 6, background: "#fef2f2", color: "#991b1b", overflowWrap: "anywhere" }}>
      <strong>Please correct the following before submitting:</strong>
      <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>{messages.map((issue, index) => <li key={`${index}-${issue.message}`}>
        {issue.control ? <button type="button" onClick={() => { issue.control.focus(); issue.control.scrollIntoView?.({ behavior: "smooth", block: "center" }); }} style={{ border: 0, padding: "3px 0", background: "none", color: "inherit", cursor: "pointer", textAlign: "left", textDecoration: "underline", font: "inherit" }}>{issue.message}</button> : issue.message}
      </li>)}</ul>
    </div>}
  </form>;
}

ValidatedForm.propTypes = {
  children: PropTypes.node,
  onSubmit: PropTypes.func,
  error: PropTypes.string,
  fieldErrors: PropTypes.object,
  validate: PropTypes.func,
  noValidate: PropTypes.bool,
  onInput: PropTypes.func,
  onChange: PropTypes.func,
};
