export default function Button({
  variant = "default",
  className = "",
  ...props
}) {
  const base = "btn";
  const variantClass =
    variant === "primary"
      ? "btn-primary"
      : variant === "danger"
      ? "btn-danger"
      : "";

  return (
    <button
      className={`${base} ${variantClass} ${className}`.trim()}
      {...props}
    />
  );
}
