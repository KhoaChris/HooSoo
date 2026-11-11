import { useEffect, useState } from "react";

export function Toast() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = () => {
      setVisible(true);
      clearTimeout(timer);
      timer = setTimeout(() => setVisible(false), 3500);
    };
    window.addEventListener("hoosoo:saved", show);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("hoosoo:saved", show);
    };
  }, []);
  return (
    <div className={"toast " + (visible ? "visible" : "")} role="status">
      Đã lưu thay đổi thành công
    </div>
  );
}
