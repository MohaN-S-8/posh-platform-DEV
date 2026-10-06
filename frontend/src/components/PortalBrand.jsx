import { useBrandingStore } from "../store/brandingStore";

export function PortalBrand() {
  const name = useBrandingStore((state) => state.portalName);
  return <div className="dynamic-portal-brand">
    <span className="dynamic-portal-box" aria-hidden="true">{Array.from(name.trim())[0]?.toUpperCase()}</span>
    <strong>{name}</strong>
  </div>;
}
