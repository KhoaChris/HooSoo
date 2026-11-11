import { TriangleAlert } from "lucide-react";
import { ApiError } from "../../services/api-client";
import { Button } from "./button";

export function ErrorBox({
  error,
  retry,
}: {
  error: Error | null;
  retry?: () => void;
}) {
  if (!error) return null;
  return (
    <div className="error-box" role="alert">
      <TriangleAlert size={20} />
      <div>
        <strong>{error.message}</strong>
        {error instanceof ApiError && error.requestId && (
          <small>Mã tra cứu: {error.requestId}</small>
        )}
        {retry && (
          <Button variant="secondary" onClick={retry}>
            Thử lại
          </Button>
        )}
      </div>
    </div>
  );
}
