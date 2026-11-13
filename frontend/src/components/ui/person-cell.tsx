import { useLocale } from "../../i18n";
import { Avatar } from "./avatar";
import { Link } from "react-router-dom";
export function PersonCell({
  name,
  avatarUrl,
  detail,
  to,
}: {
  name: string;
  avatarUrl?: string | null;
  detail?: string;
  to?: string;
}) {
  useLocale();
  const content = (
    <>
      <Avatar name={name} src={avatarUrl} className="table-person-avatar" />
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
