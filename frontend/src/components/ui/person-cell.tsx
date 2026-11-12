import { Link } from "react-router-dom";
export function PersonCell({
  name,
  detail,
  to,
}: {
  name: string;
  detail?: string;
  to?: string;
}) {
  const content = (
    <>
      <span className="table-person-avatar" aria-hidden="true">
        {name
          .trim()
          .split(/\s+/)
          .slice(-2)
          .map((word) => word[0])
          .join("")
          .toLocaleUpperCase("vi")}
      </span>
      <span className="person-cell-text">
        <strong>{name}</strong>
        {detail && <small>{detail}</small>}
      </span>
    </>
  );
  return to ? (
    <Link className="person-cell" to={to}>
      {content}
    </Link>
  ) : (
    <div className="person-cell">{content}</div>
  );
}
