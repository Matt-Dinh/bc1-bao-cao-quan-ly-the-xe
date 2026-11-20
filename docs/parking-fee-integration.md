# Kết nối tính phí cho lượt xe bổ sung

Giao diện đã sẵn sàng cho kết quả tính phí thật. Chưa cấu hình endpoint, thông tin xác thực, bảng giá hoặc cổng thanh toán thật.

Bản mẫu hiện dùng `parking-fees-demo.ts` khi chưa đăng ký đầu nối thật. Nó chỉ xử lý dữ liệu cục bộ và hiển thị nhãn mô phỏng. Giá mẫu: ô tô 10.000 đ/giờ, xe máy 5.000 đ/giờ, xe đạp 2.000 đ/giờ, làm tròn giờ. Voucher thử: `DEMO10K` và `DEMO20`. Đây không phải bảng giá nghiệp vụ đã được xác nhận.

Mã QR mô phỏng chỉ là hình minh họa, không chứa tài khoản ngân hàng hoặc thông tin chuyển tiền. Phải bấm “Mô phỏng thanh toán thành công” thì giao dịch giả mới được ghi nhận; không có kết nối mạng. Thay đổi dữ liệu tính phí sẽ làm yêu cầu thanh toán mô phỏng cũ hết hiệu lực. Sổ doanh thu minh họa chỉ cập nhật khi lưu bổ sung thành công.

Để thử chiều ra, dùng các biển số mẫu được gợi ý như `18E-112239`, `30A-123.45`, `30G-246.80`. Các lượt này đang thiếu giờ ra; dữ liệu không kết luận xe đã thực tế ra khỏi bãi. Với chiều vào, các lượt chờ đối soát có biển số minh họa và giao dịch đã thu/chờ xác nhận để thử việc đối soát phần chênh lệch.

## Đăng ký đầu nối

Triển khai interface `ParkingFeeService` trong `src/parking-fees.ts`, rồi gọi `configureParkingFeeService(adapter)` trước khi mount ứng dụng. Có thể truyền `feeService` qua `RevenueTripActions` khi tích hợp hoặc kiểm thử. Thông tin xác thực đặc quyền phải nằm phía máy chủ, không đưa vào mã giao diện.

- `quote`: nhận bãi, mã lượt/thẻ, biển số, loại xe, nhóm khách, thời điểm vào/ra, voucher và chính sách đề nghị áp dụng. Trả kết quả có mã đối soát và thời hạn hiệu lực.
- `createPayment`: tạo yêu cầu thu đúng phần còn thiếu, sử dụng `quoteId` và `idempotencyKey`. QR phải do hệ thống thanh toán cung cấp.
- `getPayment`: đọc trạng thái giao dịch. Chỉ trạng thái được hệ thống xác nhận mới dẫn đến việc lấy lại kết quả tính phí và cập nhật khoản đã thanh toán.
- `completeSupplement`: kiểm tra quyền, kết quả tính phí, giao dịch, bằng chứng, biên bản và đồng thời lưu lượt bổ sung. Trả lượt xe và bản đối soát chính thức. Thiếu phương thức này thì giao diện chưa cho lưu.

Đầu nối phải tuân theo `AbortSignal`; phản hồi cũ sau khi đổi ngày giờ, bãi, loại xe, biển số, chính sách hoặc voucher sẽ bị bỏ qua.

## Tiền và thời gian

Tất cả số tiền là số nguyên VND. `discounts` phân biệt miễn giảm chính sách và voucher giảm phí. `voucherFunding` là khoản bên thứ ba thanh toán, được giữ riêng để không làm giảm nhầm doanh thu.

Theo mô hình doanh thu hiện tại, `voucherFunding.negative = true` là vé âm bao phủ toàn bộ doanh thu sau miễn giảm; không dùng cờ này cho khoản tài trợ một phần. Đầu nối phải cung cấp đúng `source` khi cần phân loại nguồn thu riêng.

`customerPayable = gross - tổng discounts - voucherFunding.amount`.

`collected` là tổng giao dịch thành công và các khoản hoàn đã xác nhận. Khoản hoàn dùng số âm; giao dịch chờ xác nhận hoặc thất bại không được cộng vào số đã thu. `amountDue` là phần khách còn thiếu; `overpaid` là phần thu thừa. Giao diện không tự hoàn tiền.

Yêu cầu dùng ISO 8601 với múi giờ `+07:00`. Dữ liệu minh họa `Trip.entered`, `Trip.exited`, `Transaction.at` dùng phút theo đồng hồ Việt Nam nội bộ. Khi chuyển từ ISO của hệ thống thật sang cấu trúc này, dùng `feeTripMinute`; chiều ngược lại dùng `feeLocalTime`.

Các chính sách trong giao diện chỉ là đề nghị áp dụng. Hệ thống thật phải kiểm tra điều kiện, hiệu lực, loại xe và bằng chứng liên quan trước khi trả số tiền.

## Tránh ghi nhận trùng

Máy chủ phải khóa và kiểm tra mã lượt cùng phiên bản dữ liệu khi tính phí, tạo giao dịch và lưu bổ sung. `quoteId` phải gắn với chính xác yêu cầu, bảng giá và phiên bản thanh toán. Nếu có thay đổi thì từ chối kết quả cũ và yêu cầu tính lại.

Phải xử lý `idempotencyKey` ở máy chủ, đồng thời chống tạo hai khoản thu đang chờ cho cùng một nghĩa vụ thanh toán, kể cả khi người dùng đóng/mở lại hộp thoại hoặc đổi phương thức. Việc tính lại phí không được tạo giao dịch mới. Khoản đã thu phải được tải từ sổ giao dịch hiện tại, không cộng lại khi lưu giờ vào/ra.

Nếu đã có yêu cầu thanh toán đang chờ, `quote` cần trả `pendingPayment` với mã phiên, `quoteId` hiện tại, số tiền và QR hiện có để giao diện tiếp tục kiểm tra. Không cấp QR mới chỉ vì hộp thoại được mở lại. Khi không có mã phiên nhưng sổ giao dịch còn khoản chờ xác nhận, giao diện cũng chặn tạo khoản thu mới.

Kết quả `completeSupplement` được lưu vào `Trip.supplementalBilling`. Báo cáo dùng nguyên phí gốc, miễn giảm, tài trợ voucher và mã giao dịch do hệ thống trả về; không sinh giao dịch minh họa mới cho lượt này. Luồng điều chỉnh sau chốt hiện tại vẫn được áp dụng.

Nếu máy chủ đã lưu nhưng bộ nhớ hiển thị chưa cập nhật, cần tải lại kết quả theo cùng mã lượt. Không thực hiện thêm giao dịch thu tiền. Khi lưu lại cùng yêu cầu, trả cùng kết quả theo khóa idempotency.

Ảnh xác minh chỉ được chuyển cho đầu nối khi người dùng lưu. Việc tải ảnh, lưu trữ và kiểm tra tệp thuộc phương thức `completeSupplement` phía máy chủ.
