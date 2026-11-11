# Kịch bản demo HooSoo (5–10 phút)

HooSoo là dự án cá nhân của Bùi Đức Đăng Khoa, xây dựng độc lập bằng React, Express và Firebase. Công nghệ tiếp cận khi thực tập tại SureHCS là Angular/.NET/MySQL. Không trình bày HooSoo như sản phẩm hoặc dữ liệu nội bộ của Công ty Cổ phần Tin học Lạc Việt.

1. Chạy emulator, backend, frontend; chạy `npm run seed` và `npm run check:db -w backend`. Mở http://127.0.0.1:5173.
2. Đăng nhập `admin@hoosoo.demo` bằng mật khẩu demo trong README. Xem tổng quan và đổi khoảng ngày: biểu đồ đội ngũ phản ánh nhân viên hiện tại; số nhân viên mới và đơn phép phản ánh khoảng đã chọn.
3. Vào **Nhân viên → Thêm nhân viên**. Dùng mã/email chưa tồn tại, phòng Công nghệ, quản lý Nguyễn Duy Khang. Lưu, tải lại trang chi tiết để chứng minh dữ liệu đã lưu. Vào **Tài khoản & quyền → Cấp tài khoản**, liên kết hồ sơ vừa tạo với vai trò Employee.
4. Mở **Sơ đồ tổ chức**. Chỉ ra doanh nghiệp giả lập, năm phòng ban, người quản lý và nhãn **Bạn** ở vị trí của tài khoản hiện tại.
5. Đăng xuất và dùng `nhanvien@hoosoo.demo`. Vào **Chấm công của tôi → Vào ca**. Nút khóa sau khi ghi nhận, giờ do máy chủ xác định. Nếu đã chấm công hôm nay, xem bản ghi có sẵn; không xóa lịch sử để làm lại. Giải thích giờ hiện diện khác giờ tính công, và bản ghi chưa đủ giờ ra chưa được gán số giờ giả.
6. **Nghỉ phép của tôi → Tạo đơn**. Chọn một ngày làm việc chưa trùng đơn có sẵn trong năm hiện tại. Ghi lý do, gửi. Chỉ ra trạng thái chờ duyệt và số dư chưa bị trừ.
7. Dùng cửa sổ ẩn danh đăng nhập `quanly@hoosoo.demo`. Mở **Duyệt nghỉ phép**, xem đơn vừa gửi và duyệt. Manager chỉ thấy đội ngũ trực tiếp cùng phòng, không tự duyệt đơn của mình.
8. Trở lại nhân viên, mở lại đơn/danh sách: trạng thái và quỹ phép đã cập nhật. Dùng HR nếu cần hủy đơn đã duyệt, nhập lý do và kiểm tra hoàn phép/lịch sử đúng một lần.
9. Dùng Admin/HR mở **Báo cáo**, lọc dữ liệu và **Xuất CSV**. Phạm vi xuất là toàn bộ kết quả đã lọc (tối đa 5.000 dòng), không chỉ trang đang xem. CSV đọc được tiếng Việt trong Excel.
10. Dùng Admin mở **Nhật ký thao tác** để xem người thực hiện, thay đổi, lý do; mở **Trạng thái hệ thống → Kiểm tra lại** để thực hiện một lần đọc Firestore thật.

Ảnh minh họa tại `output/playwright/` được chụp từ ứng dụng đang chạy. Chỉ mô tả các luồng đã kiểm chứng theo báo cáo kiểm thử. Tính lương, GPS, nhận diện khuôn mặt, máy chấm công, tuyển dụng, nhiều doanh nghiệp, nửa ngày phép và tệp đính kèm chưa thuộc bản này.
