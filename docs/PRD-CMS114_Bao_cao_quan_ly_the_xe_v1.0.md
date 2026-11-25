# PRD – TÀI LIỆU YÊU CẦU SẢN PHẨM
## BÁO CÁO QUẢN LÝ THẺ XE
**HỆ THỐNG CMS PARKING – VCR**  
`PRD-CMS114` · Version 1.0 (cập nhật theo giao diện và nghiệp vụ mới)  
VSF – KHỐI QTVH SMART CITY  
Technopark, Vinhomes Ocean Park, Gia Lâm, Hà Nội  
25/11/2026

---

## MỤC LỤC
1. THÔNG TIN TÀI LIỆU
2. BUSINESS CONTEXT
   - 2.1 Vấn đề hiện tại
   - 2.2 Mục tiêu nghiệp vụ và nhu cầu thông tin
   - 2.3 Thuật ngữ
3. PHẠM VI
   - 3.1 Phụ thuộc – dữ liệu nguồn cần có trước
4. DESCRIPTION
   - 4.1 Hiện trạng quản lý thẻ
   - 4.2 Vòng đời thẻ cần có
   - 4.3 Phân cấp đơn vị và kho thẻ theo bãi
   - 4.4 Mối liên kết với các màn hình danh mục (ngoài phạm vi mô tả chi tiết)
5. PRE-CONDITION
6. POST-CONDITION
7. USE CASE
   - 7.1 Xem Dashboard Báo cáo quản lý thẻ và Biến động kho thẻ (M1)
   - 7.2 Xem cơ cấu thẻ lưu hành (M2)
   - 7.3 Theo dõi và rà soát cảnh báo thẻ (M3)
   - 7.4 Tra cứu thẻ theo số liệu báo cáo (O5)
   - 7.5 Xuất Excel
   - 7.6 Cấu hình tham số cảnh báo (M5)
   - 7.7 Theo dõi kho thẻ theo bãi (O1)
   - 7.8 Nhập kho thẻ (O2)
   - 7.9 Quản lý danh sách thuê bao (O3)
   - 7.10 Giao thẻ vãng lai cho bàn thẻ (O4)
   - 7.11 Tra cứu thẻ vận hành, Chỉnh sửa, Khóa / Mở khóa và Thu hồi kiểm tra (O5)
   - 7.12 Lập và theo dõi biên bản mất / hỏng (O6)
8. BUSINESS RULES
9. FUNCTIONAL REQUIREMENTS
10. CHỈ TIÊU VÀ THAM SỐ
    - 10.1 Chỉ tiêu và cách tính
    - 10.2 Tham số cảnh báo

---

## 1. THÔNG TIN TÀI LIỆU

| Hạng mục | Nội dung |
| :--- | :--- |
| **Tên tài liệu** | PRD-CMS114 – Báo cáo và Quản lý vòng đời thẻ xe |
| **Khách hàng** | VCR |
| **Phạm vi** | • Dashboard Báo cáo quản lý thẻ hợp nhất: Biến động trong kỳ (M1), Cơ cấu thẻ lưu hành (M2), Cảnh báo cần rà soát (M3).<br>• Liên kết tra cứu danh sách thẻ từ mọi con số trên báo cáo sang màn Tra cứu thẻ (O5).<br>• Xuất Excel (`.xlsx`) báo cáo tổng hợp và danh sách dữ liệu.<br>• Cấu hình Tham số báo cáo thẻ xe theo khu đô thị (M5).<br>• 6 màn hình vận hành Quản lý thẻ & Thuê bao: Kho thẻ theo bãi (O1), Nhập kho thẻ (O2), Danh sách thuê bao (O3), Giao thẻ vãng lai (O4), Tra cứu thẻ (O5), Biên bản mất / hỏng (O6). |
| **Ngoài phạm vi** | • Doanh thu cấp thẻ và hạch toán phí mất thẻ (thuộc Báo cáo doanh thu – BC3; khoản thu tại biên bản mất / hỏng chỉ phục vụ ghi nhận biên bản).<br>• Kho vé giấy; luồng phê duyệt cấp thẻ VIP trên hệ thống.<br>• Thiết kế chi tiết các màn hình danh mục dùng chung (*Khách hàng*, *Danh sách xe*, *Danh sách dịch vụ* — chỉ đề cập tóm tắt tại §4.4 để làm rõ luồng đăng ký thuê bao). |
| **Nguồn yêu cầu** | File "Phân tích báo cáo TGX" của VCR (sheet 4.1, Master Data, danh sách tính năng B4); biên bản họp VSF – VCR ngày 21/09/2026 và góp ý vòng 1; phản hồi của VCR về quy trình hiện hành (10/2026) và cập nhật giao diện vận hành (11/2026). |

---

## 2. BUSINESS CONTEXT

### 2.1 Vấn đề hiện tại
- Chưa có dữ liệu tập trung về nhập kho, cấp phát, thu hồi và mất / hỏng thẻ; mỗi Ban quản lý (BQL) tự theo dõi rời rạc bằng Excel hoặc sổ tay.
- Hệ thống cũ chỉ lưu trạng thái thẻ có bị khóa hay không, chưa phân biệt thẻ đang nằm trong kho, đã cấp cho khách hay đã mất / hỏng. Do đó không thể xác định chính xác tồn kho thẻ tại một thời điểm (ví dụ đầu tháng).
- Khó phát hiện các bất thường và gian lận: thẻ đã khóa hoặc báo mất nhưng vẫn quẹt qua làn; một thẻ thuê bao dùng cho nhiều xe; thẻ gian hàng đã hết hợp đồng nhưng vẫn hoạt động.
- Chưa kiểm soát được thẻ đã cấp nhưng không phát sinh lượt sử dụng gây lãng phí; tỷ lệ mất / hỏng thẻ chưa được đối chiếu với định mức cho phép của từng khu đô thị.

### 2.2 Mục tiêu nghiệp vụ và nhu cầu thông tin

| Nhu cầu | Câu hỏi nghiệp vụ cần trả lời | Người dùng | Màn hình |
| :--- | :--- | :--- | :--- |
| **Biến động kho thẻ** | Trong kỳ báo cáo, mỗi khu đô thị và từng kho bãi xe nhập mới, cấp ra, thu hồi, mất / hỏng bao nhiêu thẻ? Tồn đầu kỳ cộng phát sinh có khớp tồn cuối kỳ không? Tỷ lệ mất / hỏng của khu đô thị có vượt định mức không? | BQL, Kế toán, Ban Vận hành VCR | M1 |
| **Cơ cấu thẻ lưu hành** | Tại ngày chốt, thẻ đang lưu hành phân bổ theo loại thẻ, loại phương tiện, nhóm khách hàng ra sao? Tỷ trọng từng nhóm và tình trạng sử dụng (*Đang hoạt động*, *Khóa*, *Hết hạn*) như thế nào? | Ban Vận hành VCR, BQL | M2 |
| **Cảnh báo cần rà soát** | Có bao nhiêu thẻ mắc ít nhất một cảnh báo (*Sắp hết hạn*, *Không khớp thông tin*, *Cấp nhưng không sử dụng*) cần xử lý? | BQL, Bộ phận hậu kiểm | M3 |
| **Tra cứu thẻ theo số liệu báo cáo** | Những thẻ (hoặc lượt phát sinh) nào tạo nên một con số trên báo cáo? Thông tin chi tiết, trạng thái, cảnh báo tại ngày chốt và lịch sử thay đổi của thẻ ra sao? | BQL, Bộ phận hậu kiểm | O5 |
| **Lưu trữ, báo cáo cấp trên** | Xuất file Excel báo cáo tổng hợp theo mẫu 4.1 VCR và xuất danh sách thẻ / danh sách vận hành theo bộ lọc đang chọn. | BQL, Ban Vận hành VCR | M1 – M3, O1 – O6 |
| **Ngưỡng cảnh báo riêng** | Mỗi khu đô thị thiết lập ngưỡng sắp hết hạn (P-01), định mức mất / hỏng (P-02) và số ngày không sử dụng (P-03) theo ngày bắt đầu áp dụng. | IT VCR, Quản trị viên | M5 |
| **Vận hành vòng đời thẻ & thuê bao** | Theo dõi tồn kho tức thời từng bãi; nhập kho thẻ (nhập trực tiếp hoặc từ Excel); đăng ký / quản lý thuê bao tháng & VIP và cấp thẻ; giao thẻ vãng lai cho bàn thẻ; chỉnh sửa thông tin thẻ, khóa / mở khóa, thu hồi kiểm tra vật lý và lập biên bản mất / hỏng. | BQL, CSKH, Bộ phận An ninh (BPAN) | O1 – O6 |

### 2.3 Thuật ngữ

**Quy ước ký hiệu:** `M1 – M3, M5` (màn hình báo cáo & cấu hình) · `O1 – O6` (màn hình vận hành Quản lý thẻ & Thuê bao) · `BR` (quy tắc nghiệp vụ, §8) · `FR` (yêu cầu chức năng, §9) · `C-xx` (chỉ tiêu), `P-xx` (tham số) (§10) · `D-xx` (dữ liệu nguồn, §3.1) · `AC` (trường hợp nghiệm thu, §7).

| Thuật ngữ | Định nghĩa |
| :--- | :--- |
| **Khu đô thị** | Cấp đơn vị quản lý trên CMS, quản lý trực tiếp các bãi xe trực thuộc (*Khu đô thị → Bãi xe*, xem §4.3). |
| **Kỳ báo cáo, ngày chốt** | Kỳ báo cáo tính từ `00:00:00` ngày đầu kỳ đến `23:59:59` ngày cuối kỳ theo giờ Việt Nam (GMT+7). Ngày cuối kỳ gọi là **ngày chốt**. |
| **Ngày go-live** | Ngày bắt đầu áp dụng báo cáo, đồng thời là mốc dữ liệu đầu tiên (ghi nhận từ kết quả kiểm kê số dư đầu). |
| **Dữ liệu có đến (ngày chốt gần nhất)** | Ngày gần nhất đã được hệ thống tổng hợp số liệu đầy đủ, thông thường là ngày hôm trước (do hệ thống chạy tổng hợp dữ liệu định kỳ vào ban đêm). |
| **Tồn kho** | Các thẻ đang ở trạng thái *Trong kho*, bao gồm thẻ mới nhập chưa cấp và thẻ đã thu hồi đạt kiểm tra vật lý về lại kho. |
| **Đang lưu hành** | Các thẻ đã cấp phát ra ngoài và chưa thu hồi, gồm trạng thái *Đang hoạt động* và *Khóa*. Theo hiệu lực tại ngày chốt, thẻ lưu hành được chia thành 3 tình trạng sử dụng: *Đang hoạt động* (còn hiệu lực), *Hết hạn* (đã quá ngày hết hiệu lực) và *Khóa*. |
| **Mất / hỏng** | Trạng thái kết thúc vòng đời của thẻ khi có biên bản sự cố; phân biệt *Mất* hay *Hỏng* theo loại biên bản. |
| **Phát sinh trong kỳ** | Các lượt *Nhập mới*, *Cấp ra* (gồm cả cấp lại), *Thu hồi*, *Mất / hỏng* xảy ra trong kỳ báo cáo, được đếm theo **số lần thẻ chuyển trạng thái**. |
| **Kho bãi (Bãi quản lý thẻ)** | Kho thẻ riêng của từng bãi xe thuộc một khu đô thị. Thẻ nhập vào kho bãi nào thì thuộc kho bãi đó: khi cấp cho thuê bao/VIP hoặc bàn giao cho bàn thẻ vãng lai, thẻ được xuất từ kho bãi đó; khi thu hồi đạt kiểm tra vật lý, thẻ quay về đúng kho bãi đó (§4.3). |
| **Kiểu thẻ & Thẻ UHF (RFID)** | Kho thẻ quản lý 2 kiểu thẻ vật lý là **Thẻ Mifare** và **Thẻ Proximity**. **Thẻ UHF** (tem dán cố định trên xe) **không nhập kho và không quản lý tồn kho**; mã thẻ RFID của tem UHF được khai báo trực tiếp trong hồ sơ xe tại *Danh sách xe*. |

---

## 3. PHẠM VI

- **Trong phạm vi:** Dashboard Báo cáo quản lý thẻ hợp nhất (M1 – M3); liên kết từ mọi con số lớn hơn 0 trên báo cáo sang màn Tra cứu thẻ (O5); cấu hình Tham số báo cáo thẻ xe (M5); 6 màn hình vận hành vòng đời thẻ & thuê bao (O1 – O6); 3 loại thẻ (*VIP*, *Thuê bao tháng*, *Vãng lai*), 3 loại phương tiện (*Ô tô*, *Xe máy*, *Xe đạp*), 2 kiểu thẻ vật lý trong kho (*Thẻ Mifare*, *Thẻ Proximity*), 8 nhóm thuê bao; 3 nhóm cảnh báo thẻ và đối chiếu tỷ lệ mất / hỏng theo định mức; xuất Excel (`.xlsx`); phân quyền dữ liệu theo khu đô thị.
- **Ngoài phạm vi:** Doanh thu cấp thẻ và hạch toán phí mất thẻ (thuộc Báo cáo doanh thu – BC3); kho vé giấy; luồng phê duyệt cấp thẻ VIP trên hệ thống; đặc tả chi tiết các màn hình danh mục *Khách hàng*, *Danh sách xe*, *Danh sách dịch vụ*.

### 3.1 Phụ thuộc – dữ liệu nguồn cần có trước

| Mã | Dữ liệu cần có | Hiện trạng → Cách xử lý |
| :--- | :--- | :--- |
| **D-01** | Thông tin nhập kho thẻ (mã thẻ, mã hai mặt, kiểu thẻ Mifare/Proximity, mã lô, nhà cung cấp, ngày nhập), kho bãi nhận, loại thẻ, loại phương tiện | Đã thiết kế tại màn **Nhập kho thẻ** (O2, §7.8) |
| **D-02** | Trạng thái thẻ và lịch sử thay đổi trạng thái / chỉnh sửa thông tin | Đã thiết kế 4 trạng thái và ghi lịch sử bất biến tại O2 – O6 |
| **D-03** | Hồ sơ thuê bao và liên kết khách hàng, xe (kèm mã RFID nếu có), gói dịch vụ, bãi áp dụng, hiệu lực, thời điểm gắn thẻ | Đã thiết kế tại màn **Danh sách thuê bao** (O3, §7.9) và các danh mục liên kết (§4.4) |
| **D-04** | Dữ liệu lượt xe qua làn kèm số thẻ, biển số camera đọc, thời điểm quẹt thực tế | Đã có tại hệ thống làn xe → dùng lại |
| **D-05** | Biên bản mất / hỏng: số biên bản, loại, ngày lập, khoản thu ghi nhận, lý do | Đã thiết kế tại màn **Biên bản mất / hỏng** (O6, §7.12) |
| **D-06** | Danh mục khu đô thị, bãi xe, loại thẻ, nhóm thuê bao, loại phương tiện | Cần chuẩn hóa thống nhất toàn hệ thống |
| **D-07** | Thông tin hợp đồng gian hàng, căn hộ cư dân | Quản lý tại hồ sơ Khách hàng (nhập tay hoặc đồng bộ từ SAP) và tự động kế thừa sang thuê bao |
| **D-08** | Số dư đầu kỳ tại ngày go-live: trạng thái hiện tại của từng thẻ từ kết quả kiểm kê kho thẻ | Cần thực hiện kiểm kê và nhập dữ liệu đầu kỳ trước khi go-live |

---

## 4. DESCRIPTION

| Mã | Menu trên CMS Portal | Chức năng chính | Mốc dữ liệu | UC |
| :--- | :--- | :--- | :--- | :--- |
| **M1** | Báo cáo › Báo cáo quản lý thẻ *(Khối KPI, 01 / BIẾN ĐỘNG & Modal chi tiết)* | Theo dõi tồn đầu kỳ, nhập mới, cấp ra, thu hồi, mất / hỏng, tồn & lưu hành cuối kỳ theo khu đô thị và từng kho bãi; đối chiếu định mức | Theo kỳ (≤ 31 ngày) | 7.1 |
| **M2** | Báo cáo › Báo cáo quản lý thẻ *(Khối 02 / CƠ CẤU & Modal chi tiết)* | Phân tích cơ cấu thẻ lưu hành theo Loại thẻ / Loại phương tiện / Nhóm khách hàng và Tình trạng sử dụng (*Đang hoạt động*, *Khóa*, *Hết hạn*) | Ngày chốt cuối kỳ | 7.2 |
| **M3** | Báo cáo › Báo cáo quản lý thẻ *(Khối 03 / CẢNH BÁO & Modal chi tiết)* | Tổng hợp số thẻ có cảnh báo theo 3 nhóm bất thường và mở nhanh màn Tra cứu thẻ (O5) để rà soát | Ngày chốt cuối kỳ | 7.3 |
| **M5** | Cấu hình › Tham số báo cáo thẻ xe | Cấu hình ngưỡng P-01, P-02, P-03 riêng cho từng khu đô thị theo ngày bắt đầu áp dụng và xem lịch sử thay đổi | Theo ngày hiệu lực | 7.6 |
| **O1** | Quản lý thẻ › Kho thẻ theo bãi | Theo dõi số lượng thẻ tức thời theo 4 trạng thái tại từng kho bãi xe | Tức thời (Vận hành) | 7.7 |
| **O2** | Quản lý thẻ › Nhập kho thẻ | Nhập kho thẻ 2 bước bằng 2 cách (*Nhập trực tiếp* hoặc *Nhập từ Excel*), khai báo mã hai mặt & kiểu thẻ, kiểm tra trùng mã và tải danh sách lỗi | Tức thời (Vận hành) | 7.8 |
| **O3** | Quản lý thuê bao › Danh sách thuê bao | Quản lý thuê bao tháng & VIP liên kết với Khách hàng, Xe và Dịch vụ theo nhiều bãi; cấp / cấp lại thẻ từ kho và thay đổi trạng thái thuê bao | Tức thời (Vận hành) | 7.9 |
| **O4** | Quản lý thẻ › Giao thẻ vãng lai | Tạo phiếu bàn giao thẻ vãng lai từ kho bãi cho người nhận tại bàn thẻ làn xe | Tức thời (Vận hành) | 7.10 |
| **O5** | Quản lý thẻ › Tra cứu thẻ | Tra cứu thẻ theo trạng thái hiện tại, tại ngày chốt hoặc theo biến động trong kỳ; mở từ số liệu báo cáo M1 – M3; chỉnh sửa thông tin thẻ, khóa / mở khóa và thu hồi kèm kiểm tra vật lý | Tức thời (Vận hành) / Theo kỳ | 7.4, 7.11 |
| **O6** | Quản lý thẻ › Biên bản mất / hỏng | Lập và tra cứu biên bản mất / hỏng thẻ, gợi ý khoản thu tự động và kết thúc vòng đời thẻ | Tức thời (Vận hành) | 7.12 |

### 4.1 Hiện trạng quản lý thẻ
- Thẻ từ vật lý (Mifare / Proximity) được phân màu theo loại phương tiện (ô tô, xe máy, xe đạp).
- Hệ thống cũ chỉ lưu trạng thái thẻ có bị khóa hay không; chưa phân biệt thẻ trong kho hay đã mất / hỏng; chưa lưu lô nhập, kho bãi nhận thẻ, kiểu thẻ, mã hai mặt và không có lịch sử thay đổi.
- Thẻ thuê bao: CSKH quản lý hợp đồng / căn hộ, sau đó đăng ký thuê bao và cấp thẻ theo số series gắn với phương tiện và ngày hiệu lực.
- Thẻ vãng lai: khách nhận thẻ tại làn vào và trả lại tại làn ra; nếu làm mất, khách nộp phí 50.000 đ / thẻ từ hoặc 30.000 đ / vé giấy (đã gồm VAT).
- Phân cấp đơn vị trên hệ thống: **Khu đô thị → Bãi xe** (không có cấp trung tâm thương mại).

### 4.2 Vòng đời thẻ cần có
Vòng đời của một thẻ vật lý gồm **4 trạng thái**. Mỗi lần thẻ chuyển trạng thái (hoặc chỉnh sửa thông tin), hệ thống tự động ghi nhận thời điểm, khu đô thị, kho bãi, người thực hiện và lý do; bản ghi lịch sử là bất biến (không cho sửa, xóa). Nếu thao tác ghi nhầm, bản ghi được đánh dấu *"Hủy do nhập sai"* và bị loại khỏi số liệu báo cáo.

> *(Hình 1. Vòng đời trạng thái thẻ — giữ nguyên từ tài liệu gốc)*

| Trạng thái | Thẻ vào trạng thái này khi | Có thể chuyển sang |
| :--- | :--- | :--- |
| **Trong kho** | Nhập kho mới vào kho bãi (O2); ghi nhận khi kiểm kê số dư đầu; được thu hồi về lại kho bãi sau khi xác nhận đạt kiểm tra vật lý (O5). | Đang hoạt động; Mất / hỏng |
| **Đang hoạt động** | Cấp phát khi đăng ký / cấp lại thẻ cho thuê bao hoặc VIP (O3); bàn giao thẻ vãng lai cho bàn thẻ của bãi (O4). | Khóa; Trong kho; Mất / hỏng |
| **Khóa** | BQL khóa thẻ có lý do (khách báo mất tạm thời, nghi gian lận). | Đang hoạt động; Trong kho; Mất / hỏng |
| **Mất / hỏng** | Có biên bản mất hoặc biên bản hỏng (lập trực tiếp tại O6 hoặc phát sinh khi thu hồi không đạt kiểm tra tại O5). | Không chuyển tiếp (trạng thái kết thúc) |

### 4.3 Phân cấp đơn vị và kho thẻ theo bãi
- **Kho thẻ riêng theo từng bãi xe:** Mỗi bãi xe (ví dụ: *Hầm B1 – S1*, *Hầm B2 – S2*, *Bãi ngoài trời* thuộc *Vinhomes Ocean Park*) có kho thẻ riêng để quản lý các thẻ ở trạng thái *Trong kho*.
- **Nhập – xuất – thu hồi gắn chặt với kho bãi:** Thẻ nhập vào kho bãi nào (O2) thì thuộc kho bãi đó. Khi bàn giao thẻ vãng lai (O4), chỉ xuất thẻ *Trong kho* của đúng bãi nhận. Khi cấp thẻ cho thuê bao/VIP (O3), nếu thuê bao áp dụng nhiều bãi trong cùng khu đô thị thì được chọn xuất thẻ *Trong kho* từ **một trong các bãi đang áp dụng**, và thẻ dùng chung tại các bãi đó. Khi thu hồi đạt kiểm tra vật lý (O5), thẻ luôn quay về *Trong kho* của chính kho bãi đang quản lý thẻ.
- **Tổng hợp lên Khu đô thị trên báo cáo:** Tại bảng *Chi tiết biến động kho thẻ* (M1), mỗi dòng Bãi xe hiển thị đầy đủ Đầu kỳ (Tồn kho, Lưu hành), Phát sinh (Nhập mới, Cấp ra, Thu về, Mất / hỏng) và Cuối kỳ (Tồn kho, Lưu hành); dòng Khu đô thị bằng tổng các bãi trực thuộc.
- **Phân quyền và Định mức cảnh báo:** Quyền truy cập dữ liệu và bộ 3 tham số cảnh báo (P-01, P-02, P-03 tại M5) được thiết lập ở cấp **Khu đô thị**. Do đó, cột *Tỷ lệ mất / hỏng* và *Định mức* trên bảng M1 chỉ tính ở dòng Khu đô thị và dòng Tổng cộng; dòng Bãi xe hiển thị `"—"`.

### 4.4 Mối liên kết với các màn hình danh mục (ngoài phạm vi mô tả chi tiết)
Để chuẩn hóa dữ liệu dùng chung cho luồng đăng ký và quản lý thuê bao (O3), hệ thống có 3 màn hình danh mục liên kết trực tiếp (không nằm trong phạm vi đặc tả chi tiết của PRD này):
- **Khách hàng (`Khách hàng › Khách hàng`):** Lưu hồ sơ chủ thuê bao và thành viên dùng chung (tên, SĐT, CCCD, **Nhóm thuê bao**, **Căn hộ** với nhóm Cư dân, **Số hợp đồng & Hạn hợp đồng** với nhóm Gian hàng, **ảnh khuôn mặt** phục vụ nhận diện tại cổng). Dữ liệu này được tự động kế thừa khi đăng ký thuê bao tại O3.
- **Danh sách xe (`Quản lý xe › Danh sách xe`):** Lưu hồ sơ phương tiện dùng chung (biển số, loại phương tiện kèm phân loại xăng/điện, hãng xe, màu xe và **Mã thẻ RFID** cho tem UHF dán trên xe). Một hồ sơ xe được dùng chung để gắn vào thuê bao tháng hoặc danh sách biển số VIP.
- **Danh sách dịch vụ (`Dịch vụ › Danh sách dịch vụ`):** Cấu hình gói dịch vụ theo khu đô thị, bãi xe áp dụng, loại phương tiện (gồm cả xăng/điện), biểu giá và **Chế độ kiểm soát** (Thẻ Proximity/Mifare, Biển số, Khuôn mặt, UHF/RFID, QR, Mở tay). Chế độ kiểm soát của dịch vụ quyết định thuê bao tại O3 có bắt buộc cấp thẻ vật lý, bắt buộc biển số, bắt buộc ảnh khuôn mặt hay bắt buộc mã RFID hay không.

---

## 5. PRE-CONDITION
1. Người dùng đã được phân quyền truy cập ít nhất một khu đô thị.
2. Danh mục khu đô thị, bãi xe, loại thẻ, loại phương tiện, nhóm thuê bao đã được chuẩn hóa (D-06).
3. Phân hệ Quản lý thẻ & Thuê bao đã được triển khai để ghi nhận đầy đủ vòng đời thẻ và lịch sử bất biến (D-01, D-02, D-03, D-05).
4. Trước ngày go-live, BQL đã hoàn tất kiểm kê và nhập số dư đầu kỳ (trạng thái hiện tại của từng thẻ) vào hệ thống (D-08).

---

## 6. POST-CONDITION
1. Người dùng chỉ nhìn thấy dữ liệu của các khu đô thị thuộc phạm vi phân quyền và đúng theo điều kiện lọc đã áp dụng.
2. Mọi màn hình báo cáo đều ghi rõ mốc chốt dữ liệu (`Dữ liệu có đến dd/mm/yyyy` hoặc `Chốt hết ngày dd/mm/yyyy`).
3. Số liệu trong file Excel xuất ra khớp hoàn toàn với số liệu hiển thị trên màn hình.
4. Các màn hình báo cáo (M1 – M3) và chế độ tra cứu theo kỳ trên O5 chỉ đọc, không làm thay đổi dữ liệu vận hành của thẻ.

---

## 7. USE CASE

### 7.1 Xem Dashboard Báo cáo quản lý thẻ và Biến động kho thẻ (M1)

#### 7.1.1 Business Flow
1. Người dùng mở menu **Báo cáo › Báo cáo quản lý thẻ**. Hệ thống hiển thị Dashboard báo cáo hợp nhất gồm: thanh trạng thái dữ liệu chốt, khối *Điều kiện báo cáo*, 4 thẻ KPI tổng quan và 3 phân khu trực quan (`01 / BIẾN ĐỘNG`, `02 / CƠ CẤU`, `03 / CẢNH BÁO`).
2. Người dùng chọn điều kiện lọc: *Khu đô thị*, *Bãi xe*, *Loại thẻ*, *Phương tiện*, *Kỳ báo cáo* (`Từ ngày → Đến ngày`, tối đa 31 ngày) hoặc bấm nút chọn nhanh (*Tháng này*, *Tháng trước*, *7 ngày trước*). Khi thay đổi bộ lọc nhưng chưa chạy lại, hệ thống hiển thị nhãn `Chưa áp dụng` cho đến khi người dùng bấm **Xem báo cáo**.
3. Hệ thống cập nhật đồng bộ 4 thẻ KPI (*Tồn kho đầu kỳ*, *Tồn kho cuối kỳ*, *Thẻ lưu hành cuối kỳ*, *Mất / hỏng trong kỳ*) và biểu đồ cột `01 / BIẾN ĐỘNG` (*Nhập mới*, *Cấp ra*, *Thu hồi*, *Mất / hỏng*).
4. Từ đây, người dùng có thể:
   - Bấm nút **Xem số liệu chi tiết** ở cuối khối `01 / BIẾN ĐỘNG` để mở popup rộng *Chi tiết biến động kho thẻ*, xem bảng cây `Khu đô thị → Bãi xe`, tỷ lệ mất / hỏng so với định mức và kết quả đối soát.
   - Bấm vào bất kỳ con số lớn hơn 0 nào (trên thẻ KPI, cột biểu đồ hoặc ô trong bảng chi tiết) để mở màn **Tra cứu thẻ (O5)** đã lọc sẵn đúng chỉ tiêu (§7.4).
   - Bấm **Tải báo cáo (.xlsx)** để xuất file Excel tổng hợp (§7.5).

#### 7.1.2 User Flow
> *(Hình 2. Sơ đồ tương tác – Xem biến động kho thẻ. Lưu ý: đường dẫn chuyển sang Tra cứu thẻ tương ứng mục 7.4)*

#### 7.1.3 Màn hình
> *(Hình 3a. Giao diện tổng quan Báo cáo quản lý thẻ; Hình 3b. Modal Chi tiết biến động kho thẻ – giữ nguyên từ tài liệu gốc)*

| Thành phần | Mô tả |
| :--- | :--- |
| **Thanh tiêu đề & Trạng thái dữ liệu** | Hiển thị đường dẫn `Báo cáo › Báo cáo quản lý thẻ`, nhãn `Dữ liệu có đến dd/mm/yyyy · Dữ liệu theo kỳ, tách với thao tác trong phiên`, trạng thái `Đã cập nhật` và nút `Tải báo cáo .xlsx` (chỉ hiện với tài khoản có quyền xuất file). |
| **Khối Điều kiện báo cáo** | Bộ lọc dùng chung cho cả 3 phân khu: *Khu đô thị* (mặc định tất cả khu đô thị trong quyền), *Bãi xe* (lọc theo khu đô thị đã chọn), *Loại thẻ*, *Phương tiện*, *Từ ngày – Đến ngày* (mặc định từ ngày 01 tháng hiện tại đến ngày chốt gần nhất, tối đa 31 ngày, không trước ngày go-live). Có 3 nút chọn nhanh (*Tháng này*, *Tháng trước*, *7 ngày trước*), nút *Đặt lại*, nhãn `Chưa áp dụng`, nút *Xem báo cáo* và dòng hiển thị kỳ đang áp dụng (`Kỳ dd/mm/yyyy – dd/mm/yyyy`). |
| **4 thẻ KPI tổng quan** | Gồm: *Tồn kho đầu kỳ* (thẻ), *Tồn kho cuối kỳ* (thẻ), *Thẻ lưu hành cuối kỳ* (thẻ), *Mất / hỏng trong kỳ* (lượt). Mỗi thẻ ghi rõ mốc tính: Tồn kho đầu kỳ ghi `Chốt hết ngày <ngày liền trước Từ ngày>` (hoặc `Số dư đầu ngày <ngày go-live>` nếu kỳ bắt đầu từ ngày go-live); Tồn kho cuối kỳ và Thẻ lưu hành cuối kỳ ghi `Chốt hết ngày <Đến ngày>`; Mất / hỏng trong kỳ ghi `Phát sinh <Từ ngày> – <Đến ngày>`. Bấm vào thẻ (khi giá trị > 0) để mở Tra cứu thẻ (O5). |
| **Khối 01 / BIẾN ĐỘNG** | Biểu đồ cột đứng *Biến động thẻ trong kỳ* so sánh 4 chỉ tiêu phát sinh: *Nhập mới*, *Cấp ra*, *Thu hồi*, *Mất / hỏng* (đơn vị: lượt phát sinh). Chú thích dưới biểu đồ: một thẻ có thể phát sinh nhiều lần. Bấm từng cột để tra cứu các lượt phát sinh tại O5; bấm nút **Xem số liệu chi tiết** ở cuối khối để mở bảng số liệu chi tiết. |
| **Modal Chi tiết biến động kho thẻ** | Bảng cây phân cấp: dòng *Tổng cộng* trên cùng, mỗi *Khu đô thị* một dòng cha (kèm số lượng bãi xe) và mở rộng ra từng *Bãi xe* con; có nút `Mở rộng tất cả / Thu gọn tất cả` và cho phép bấm tiêu đề cột để sắp xếp khu đô thị. Ô giá trị bằng 0 hiển thị mờ và không bấm được. |
| **Đầu kỳ / Phát sinh / Cuối kỳ theo từng bãi** | Cả dòng Khu đô thị và dòng Bãi xe đều hiển thị đầy đủ: Đầu kỳ (*Tồn kho*, *Lưu hành*), Phát sinh trong kỳ (*Nhập mới*, *Cấp ra*, *Thu về*, *Mất / hỏng*) và Cuối kỳ (*Tồn kho*, *Lưu hành*). Dòng Khu đô thị bằng tổng các bãi xe trực thuộc. |
| **Tỷ lệ mất / hỏng & Định mức** | `Tỷ lệ = Mất / hỏng ÷ (Tồn kho đầu kỳ + Lưu hành đầu kỳ)` (C-14), đối chiếu với Định mức P-02 của khu đô thị; nếu vượt định mức thì hiển thị chữ đỏ kèm ký hiệu `▲` (ví dụ Smart City `0,6% > 0,5%`). Hai cột này chỉ hiển thị ở dòng Khu đô thị và Tổng cộng; dòng Bãi xe hiển thị `"—"`. |
| **Đối soát & Ghi chú hướng dẫn** | Chân bảng hiển thị nhãn đối soát xanh `Số liệu đã được đối soát · Khớp số liệu` (hoặc cảnh báo đỏ nếu lệch công thức §10.1) cùng 2 thẻ hướng dẫn: *Cách đọc báo cáo* và *Lưu ý về định mức*. |

#### 7.1.4 Acceptance Case

| ID | Acceptance Case |
| :--- | :--- |
| **AC-BC1-7.1-01** | Với dữ liệu minh họa (Ocean Park, Smart City, Times City), khi xem kỳ `01/10 – 28/10/2026` toàn hệ thống, 4 thẻ KPI và dòng Tổng cộng hiển thị khớp: Tồn kho đầu kỳ `162`, Lưu hành đầu kỳ `1.838`, Nhập mới `60`, Cấp ra `200`, Thu về `40`, Mất / hỏng `10`, Tồn kho cuối kỳ `60`, Lưu hành cuối kỳ `1.990`, Tỷ lệ mất / hỏng `0,5%`. |
| **AC-BC1-7.1-02** | Với Smart City có định mức `0,5%` (thực tế `0,6%`) và Ocean Park có định mức `5,0%` (thực tế `0,5%`), khi mở *Chi tiết biến động kho thẻ*, dòng Smart City hiển thị chữ đỏ `0,6% ▲`, dòng Ocean Park hiển thị bình thường; trường hợp tỷ lệ bằng đúng định mức không bị đánh dấu vượt ngưỡng. |
| **AC-BC1-7.1-03** | Khi một thẻ được cấp ra, thu hồi đạt kiểm tra rồi cấp lại trong cùng kỳ tại cùng một kho bãi, chỉ tiêu *Cấp ra* tăng `2`, *Thu về* tăng `1` và thẻ được tính vào *Lưu hành cuối kỳ* của bãi đó. |
| **AC-BC1-7.1-04** | Khi mở rộng dòng *Vinhomes Ocean Park* (3 bãi xe), dòng con *Hầm B1 – S1* hiển thị đầy đủ tồn kho và phát sinh: Tồn kho đầu kỳ `12`, Lưu hành đầu kỳ `300`, Nhập mới `20`, Cấp ra `32`, Thu về `6`, Mất / hỏng `2`, Tồn kho cuối kỳ `5`, Lưu hành cuối kỳ `325`; tổng 3 bãi khớp đúng dòng Ocean Park. |
| **AC-BC1-7.1-05** | Khi một thẻ nhập kho vào *Hầm B1 – S1* ngày `05/10` và lập biên bản hỏng ngày `10/10` khi chưa cấp ra, ở cả dòng *Hầm B1 – S1* và *Vinhomes Ocean Park*, chỉ tiêu *Nhập mới* tăng `1`, *Mất / hỏng* tăng `1`, *Tồn kho cuối kỳ* không tăng. |
| **AC-BC1-7.1-06** | Khi một lần thu hồi thẻ bị đánh dấu *"Hủy do nhập sai"*, chỉ tiêu *Thu về* không tăng và thẻ vẫn được tính là *Đang lưu hành*. |
| **AC-BC1-7.1-07** | Khi có một lượt cấp ra lúc `23:59:59` ngày cuối kỳ và một lượt lúc `00:00:00` ngày hôm sau, báo cáo kỳ đó chỉ đếm lượt thứ nhất. |
| **AC-BC1-7.1-08** | Khi lọc *Khu đô thị = Vinhomes Ocean Park* và *Bãi xe = Hầm B1 – S1* rồi bấm *Xem báo cáo*, 4 thẻ KPI hiển thị đúng số liệu của *Hầm B1 – S1* (`12`, `5`, `325`, `2`), còn cột *Tỷ lệ mất / hỏng* và *Định mức* ở dòng bãi hiển thị `"—"`. |
| **AC-BC1-7.1-09** | Khi mở modal *Chi tiết biến động kho thẻ*, mọi dòng bãi xe, khu đô thị và Tổng cộng đều khớp công thức đối chiếu §10.1 và chân bảng hiển thị nhãn `Số liệu đã được đối soát · Khớp số liệu`. |
| **AC-BC1-7.1-10** | Khi người dùng chọn khoảng thời gian dài hơn 31 ngày (ví dụ 40 ngày), hệ thống báo lỗi ngay dưới ô Kỳ báo cáo và khóa nút *Xem báo cáo*. |

---

### 7.2 Xem cơ cấu thẻ lưu hành (M2)

#### 7.2.1 Business Flow
1. Trên Dashboard Báo cáo quản lý thẻ, người dùng theo dõi phân khu `02 / CƠ CẤU – Cơ cấu thẻ lưu hành`; số liệu được tính tại thời điểm `23:59:59` của ngày cuối kỳ (ngày chốt).
2. Người dùng chọn tiêu chí phân loại tại dropdown góc phải khối `02 / CƠ CẤU`: *Loại thẻ*, *Loại phương tiện* hoặc *Nhóm khách hàng*. Biểu đồ vòng (Donut), danh sách chú giải số lượng – tỷ trọng và thanh ngang *Tình trạng sử dụng* tự động cập nhật theo tiêu chí vừa chọn.
3. Người dùng bấm nút **Xem số liệu chi tiết** ở cuối khối để mở modal *Chi tiết cơ cấu thẻ lưu hành*, có thể bật/tắt công tắc `Tách theo khu đô thị` để đối chiếu từng khu đô thị, hoặc bấm trực tiếp vào bất kỳ con số lớn hơn 0 nào để mở màn **Tra cứu thẻ (O5)** tại ngày chốt (§7.4).

#### 7.2.2 User Flow
> *(Hình 5. Sơ đồ tương tác – Xem thẻ đang lưu hành — giữ nguyên từ tài liệu gốc)*

#### 7.2.3 Màn hình
> *(Hình 6. Modal Chi tiết cơ cấu thẻ lưu hành — giữ nguyên từ tài liệu gốc)*

| Thành phần | Mô tả |
| :--- | :--- |
| **Bộ lọc & Ngày chốt** | Dùng chung bộ lọc của Dashboard; mốc tính là `23:59:59` của ngày Đến ngày (hiển thị `Chốt hết ngày dd/mm/yyyy`). |
| **Dropdown Phân loại theo** | Đặt ở góc phải tiêu đề khối `02 / CƠ CẤU` và đồng bộ với modal chi tiết, gồm 3 lựa chọn: *Loại thẻ* (VIP, Thuê bao tháng, Vãng lai), *Loại phương tiện* (Ô tô, Xe máy, Xe đạp), *Nhóm khách hàng* (8 nhóm thuê bao kèm dòng `VIP và Vãng lai`). |
| **Biểu đồ Donut & Chú giải tỷ trọng** | Tâm vòng tròn hiển thị tổng số thẻ lưu hành (bấm được để mở Tra cứu thẻ); bên phải liệt kê từng nhóm kèm màu, số lượng thẻ (bấm được) và tỷ trọng `%`. |
| **Thanh Tình trạng sử dụng** | Thanh ngang xếp chồng tách tổng thẻ lưu hành thành 3 nhóm hiệu lực tại ngày chốt: *Đang hoạt động* (xanh lá), *Khóa* (vàng cam), *Hết hạn* (đỏ/hồng), kèm số lượng từng nhóm bấm được để mở Tra cứu thẻ (O5). |
| **Modal Chi tiết cơ cấu thẻ lưu hành** | Hiển thị bảng gồm các cột: *Phân loại*, *Đang lưu hành*, *Đang hoạt động*, *Khóa*, *Hết hạn*, *Tỷ lệ hoạt động (%)* và *Tỷ trọng (%)*. Hỗ trợ công tắc `Tách theo khu đô thị` (mỗi khu đô thị một dòng cha mở rộng ra các phân loại con). |

#### 7.2.4 Acceptance Case

| ID | Acceptance Case |
| :--- | :--- |
| **AC-BC1-7.2-01** | Với dữ liệu minh họa toàn hệ thống tại ngày chốt `28/10/2026`, khối `02 / CƠ CẤU` và modal chi tiết hiển thị: Đang lưu hành `1.990`, Đang hoạt động `1.930`, Khóa `42`, Hết hạn `18`, Tỷ lệ hoạt động `97,0%`; theo Loại thẻ gồm VIP `50` (`2,5%`), Thuê bao tháng `1.240` (`62,3%`), Vãng lai `700` (`35,2%`). |
| **AC-BC1-7.2-02** | Khi mở modal *Chi tiết cơ cấu thẻ lưu hành* và bật `Tách theo khu đô thị`, dòng *Vinhomes Ocean Park* hiển thị tổng lưu hành `802` thẻ (`VIP 20 + Thuê bao tháng 500 + Vãng lai 282`); tỷ trọng Ocean Park trên toàn hệ thống là `40,3%`, tỷ trọng Thuê bao tháng trong Ocean Park là `62,3%`. |
| **AC-BC1-7.2-03** | Thẻ Đang hoạt động có ngày hết hiệu lực trước ngày chốt được xếp vào cột *Hết hạn*; thẻ hết hiệu lực đúng ngày chốt hoặc thẻ VIP/Vãng lai không giới hạn thời hạn được xếp vào *Đang hoạt động*. |
| **AC-BC1-7.2-04** | Khi đổi tiêu chí sang *Nhóm khách hàng*, hệ thống gom thẻ VIP và Vãng lai vào dòng `VIP và Vãng lai`, thẻ thuê bao chưa phân nhóm vào `Chưa phân nhóm`, và tổng lưu hành giữ nguyên `1.990`. |
| **AC-BC1-7.2-05** | Khi chọn nhiều khu đô thị và bật `Tách theo khu đô thị`, bảng chỉ tăng số dòng theo từng khu đô thị, cấu trúc cột giữ nguyên. |
| **AC-BC1-7.2-06** | Khi bấm vào số `16` thẻ Khóa của *Vinhomes Ocean Park* tại ngày `28/10/2026`, hệ thống mở màn Tra cứu thẻ (O5) với `Khu đô thị = Vinhomes Ocean Park`, `Trạng thái = Khóa`, `Kỳ báo cáo = 28/10/2026 – 28/10/2026` và hiển thị đúng 16 thẻ đó. |

---

### 7.3 Theo dõi và rà soát cảnh báo thẻ (M3)

#### 7.3.1 Business Flow
1. Trên Dashboard Báo cáo quản lý thẻ, người dùng xem phân khu `03 / CẢNH BÁO – Cảnh báo cần rà soát`. Phân khu hiển thị tổng số thẻ duy nhất có ít nhất một cảnh báo đến hết ngày chốt (`N thẻ có ít nhất một cảnh báo đến hết ngày dd/mm/yyyy`) và 3 thanh ngang tương ứng với 3 nhóm cảnh báo.
2. Người dùng có thể bấm liên kết **Cấu hình ngưỡng** ở góc phải khối để chuyển nhanh sang màn *Tham số báo cáo thẻ xe* (M5), hoặc bấm nút **Xem số liệu chi tiết** ở cuối khối để mở modal *Chi tiết cảnh báo thẻ*.
3. Người dùng bấm trực tiếp vào số tổng `N thẻ`, một thanh cảnh báo, hoặc bấm `Xem danh sách ↗` trong modal để mở màn **Tra cứu thẻ (O5)** đã lọc sẵn nhóm cảnh báo tương ứng tại ngày chốt (§7.4). Từ đó, bấm mã thẻ để xem popup *Thông tin thẻ*.
4. Để thực hiện thao tác vận hành (chỉnh sửa, khóa thẻ, thu hồi, lập biên bản), người dùng bấm nút **Xem thẻ hiện tại** ngay trong popup Thông tin thẻ hoặc đặt *Kỳ báo cáo* về `hôm nay – hôm nay` rồi bấm **Áp dụng** (§7.11).

| Nhóm cảnh báo | Điều kiện phát sinh cảnh báo | Hướng xử lý nghiệp vụ |
| :--- | :--- | :--- |
| **Sắp hết hạn** (BR10) | Thẻ *Đang hoạt động* còn từ `0` đến `P-01` ngày (mặc định `7`) là hết hiệu lực tính tại ngày chốt. | Nhắc khách gia hạn hoặc đổi thẻ. |
| **Không khớp thông tin đăng ký** (BR12) | Thẻ thuê bao *Đang hoạt động* có ít nhất một lý do: biển số camera đọc khác biển số đăng ký; thiếu biển số đăng ký; gian hàng hết hạn hợp đồng; thẻ nhóm Cư dân chưa gắn căn hộ. | Bổ sung thông tin hồ sơ; nếu nghi gian lận thì chuyển bộ phận hậu kiểm. |
| **Cấp nhưng không sử dụng** (BR13) | Thẻ thuê bao hoặc VIP *Đang hoạt động* không phát sinh lượt xe nào trong tối thiểu `P-03` ngày (mặc định `30`) tính đến ngày chốt. | Liên hệ khách xác minh nhu cầu; thu hồi thẻ nếu không còn sử dụng. |

#### 7.3.2 User Flow
> *(Hình 7. Sơ đồ tương tác – Theo dõi và xử lý cảnh báo thẻ. Lưu ý cập nhật sơ đồ: giao diện mới hiển thị 3 nhóm cảnh báo trên Dashboard, bấm mở sang Tra cứu thẻ O5 và popup Thông tin thẻ)*

#### 7.3.3 Màn hình
> *(Hình 8. Modal Chi tiết cảnh báo thẻ; Hình 9. Popup Thông tin thẻ mở từ cảnh báo — lưu ý Hình 9 cập nhật thêm các trường Mã mặt trước, Mã mặt sau, Kiểu thẻ, Đơn vị, Mô tả, thông tin tạo/cập nhật và nút Xem thẻ hiện tại)*

Khi mở từ khối `03 / CẢNH BÁO` hoặc modal *Chi tiết cảnh báo thẻ*, màn **Tra cứu thẻ (O5)** tự động đặt `Cảnh báo = <Nhóm đã chọn>`, `Kỳ báo cáo = ngày chốt – ngày chốt` và giữ nguyên bộ lọc khu đô thị, bãi xe, loại thẻ, phương tiện từ báo cáo:

| Nhóm cảnh báo | Thông tin đối chiếu mặc định trên Tra cứu thẻ (O5) | Cột nên bật thêm (Tùy chỉnh cột) |
| :--- | :--- | :--- |
| **Sắp hết hạn** | Loại thẻ · Chủ thẻ · Biển số · Hiệu lực đến · Cảnh báo `Sắp hết hạn` | Số điện thoại, Mã thuê bao |
| **Không khớp thông tin** | Loại thẻ · Chủ thẻ · Biển số · Cảnh báo `Không khớp thông tin` (popup hiển thị thêm Nhóm khách hàng, Mã thuê bao) | Nhóm khách hàng, Căn hộ / gian hàng |
| **Cấp nhưng không sử dụng** | Loại thẻ · Chủ thẻ · Trạng thái tại ngày đến · Cảnh báo `Cấp nhưng không sử dụng` | Ngày cấp gần nhất, Lượt gần nhất, Số ngày không sử dụng |

#### 7.3.4 Acceptance Case

| ID | Acceptance Case |
| :--- | :--- |
| **AC-BC1-7.3-01** | Với dữ liệu minh họa toàn hệ thống tại ngày chốt `28/10/2026`, khối `03 / CẢNH BÁO` hiển thị `5 thẻ có ít nhất một cảnh báo đến hết ngày 28/10/2026` và 3 nhóm: Sắp hết hạn `2`, Không khớp thông tin `2`, Cấp nhưng không sử dụng `1`. |
| **AC-BC1-7.3-02** | Với ngưỡng sắp hết hạn P-01 = `7` ngày (Ocean Park, Smart City) và `14` ngày (Times City), thẻ *Đang hoạt động* còn từ `0` đến `P-01` ngày bị gắn cảnh báo *Sắp hết hạn*; thẻ đã quá hạn hoặc không giới hạn thời hạn không bị gắn cảnh báo này. |
| **AC-BC1-7.3-03** | Thẻ thuê bao đăng ký biển `30A-123.45`: khi camera đọc `30A12345` (chỉ khác dấu phân cách) thì không cảnh báo; khi đọc `30A-999.99` thì bật cảnh báo *Không khớp thông tin*. Thẻ VIP không áp dụng so khớp biển số. |
| **AC-BC1-7.3-04** | Thẻ thuê bao thiếu biển số đăng ký, thuộc gian hàng hết hạn hợp đồng trước ngày chốt, hoặc thuộc nhóm Cư dân nhưng chưa có căn hộ đều được đưa vào nhóm *Không khớp thông tin*. |
| **AC-BC1-7.3-05** | Với ngưỡng P-03 = `30` ngày, thẻ thuê bao/VIP *Đang hoạt động* không phát sinh lượt xe nào trong tối thiểu 30 ngày kể từ mốc muộn hơn giữa ngày cấp gần nhất và lượt xe gần nhất thì bị cảnh báo *Cấp nhưng không sử dụng*; thẻ Vãng lai không xét. |
| **AC-BC1-7.3-06** | Khi bấm thanh `Không khớp thông tin` (`2` thẻ), hệ thống mở O5 với `Cảnh báo = Không khớp thông tin`, `Kỳ báo cáo = 28/10/2026 – 28/10/2026`, hiển thị đúng 2 thẻ (chỉ xem). Khi bấm `Xem thẻ hiện tại` trong popup hoặc đổi kỳ về `hôm nay – hôm nay` và bấm *Áp dụng*, màn hình chuyển sang trạng thái hiện tại kèm đầy đủ nút thao tác vận hành. |

---

### 7.4 Tra cứu thẻ theo số liệu báo cáo (O5)

#### 7.4.1 Business Flow
1. Người dùng bấm vào một con số lớn hơn 0 tại bất kỳ vị trí nào trên Dashboard báo cáo (4 thẻ KPI; cột biểu đồ `01 / BIẾN ĐỘNG`; tâm biểu đồ vòng, phần biểu đồ, chú giải và thanh Tình trạng sử dụng của `02 / CƠ CẤU`; số `N thẻ` và các thanh cảnh báo của `03 / CẢNH BÁO`; ô số liệu trong 3 modal chi tiết). Hệ thống mở màn **Quản lý thẻ › Tra cứu thẻ (O5)** với *Bộ lọc tra cứu* điền sẵn theo con số vừa bấm và hiển thị nút `← Quay lại báo cáo`.
2. Với chỉ tiêu tại một thời điểm (Tồn kho, Lưu hành, Cơ cấu, Cảnh báo), hệ thống đặt `Từ ngày = Đến ngày = ngày chốt` và hiển thị mỗi thẻ một dòng. Với chỉ tiêu phát sinh trong kỳ (Nhập mới, Cấp ra, Thu hồi, Mất / hỏng), hệ thống đặt `Loại biến động` tương ứng, giữ nguyên kỳ báo cáo và hiển thị mỗi lượt phát sinh một dòng.
3. Người dùng có thể tinh chỉnh điều kiện lọc rồi bấm **Áp dụng**, mở **Tùy chỉnh cột**, bấm mã thẻ để xem popup *Thông tin thẻ* (2 tab: *Thông tin thẻ*, *Lịch sử thao tác*) hoặc bấm **Xuất danh sách** (§7.5).
4. Người dùng bấm `← Quay lại báo cáo` để trở về Dashboard (giữ nguyên toàn bộ bộ lọc, kỳ báo cáo, tiêu chí *Phân loại theo* và trạng thái *Tách theo khu đô thị*), hoặc bấm `Xem thẻ hiện tại` trong popup / đổi kỳ về `hôm nay – hôm nay` để thao tác vận hành (§7.11).

#### 7.4.2 User Flow
> *(Hình 10. Sơ đồ tương tác – Tra cứu thẻ và lịch sử thẻ. Lưu ý cập nhật sơ đồ: không giới hạn tối thiểu 3 ký tự khi tìm kiếm, mặc định 20 dòng/trang và mở popup Thông tin thẻ)*

#### 7.4.3 Màn hình
> *(Hình 11 & Hình 11b. Tra cứu thẻ O5 — lưu ý cập nhật giao diện mới có thêm bộ lọc chọn nhiều `Kiểu thẻ` và đổi nhãn `Nhóm khách hàng` thành `Nhóm thuê bao`)*

| Thành phần | Mô tả |
| :--- | :--- |
| **Bộ lọc tra cứu** | Gồm ô **Tìm thẻ** (tìm theo mã thẻ, **mã thẻ mặt trước / mặt sau**, chủ thẻ, biển số, mã thuê bao, lô nhập; không phân biệt hoa thường, bỏ qua dấu `.`, `-`, khoảng trắng; tối đa 100 ký tự) và **9 bộ lọc chọn nhiều** (gắn nhãn `Chọn nhiều`):<br>• **Loại biến động:** Nhập mới, Cấp ra, Thu hồi, Mất / hỏng; mặc định `Không lọc biến động` (xem danh sách thẻ tại ngày đến); có nút chọn nhanh `Tất cả biến động`.<br>• **Khu đô thị**, **Bãi xe** (chỉ liệt kê bãi thuộc khu đô thị đã chọn, hiển thị kèm tên khu đô thị để phân biệt bãi trùng tên), **Loại thẻ** (VIP, Thuê bao tháng, Vãng lai), **Phương tiện** (Ô tô, Xe máy, Xe đạp).<br>• **Trạng thái:** Trong kho, Đang hoạt động, Khóa, Mất / hỏng, Hết hạn; mặc định chọn tất cả (`Tất cả trạng thái`), mỗi dòng có nút `Chỉ chọn`. Ghi chú: *"Đang hoạt động: còn hiệu lực. Thẻ Khóa vẫn thuộc nhóm Khóa dù đã quá hạn."* Bỏ chọn hết sẽ báo `"Chọn ít nhất một trạng thái."` và khóa nút *Áp dụng*.<br>• **Kiểu thẻ *(mới)*:** `Thẻ Mifare`, `Thẻ Proximity`, `Chưa có thông tin`.<br>• **Nhóm thuê bao *(đổi tên từ Nhóm khách hàng)*:** 8 nhóm thuê bao; chỉ áp dụng cho thẻ *Thuê bao tháng* (thẻ VIP và Vãng lai lọc tại *Loại thẻ*).<br>• **Cảnh báo:** Sắp hết hạn, Không khớp thông tin, Cấp nhưng không sử dụng; mặc định `Không giới hạn cảnh báo` (gồm cả thẻ không có cảnh báo).<br>*Quy tắc kết hợp:* Trong cùng một bộ lọc khớp một trong các lựa chọn (OR); giữa các bộ lọc đáp ứng đồng thời (AND). |
| **Ba cách xem theo Kỳ báo cáo** | Hệ thống tự xác định cách xem dựa trên *Kỳ báo cáo* và *Loại biến động*, kèm dòng gợi ý ngay dưới ô ngày:<br>• **Trạng thái hiện tại:** `Từ ngày = Đến ngày = hôm nay` và *Không lọc biến động*. Hiển thị trạng thái tức thời, có nút thao tác vận hành (§7.11). Là mặc định khi mở trực tiếp từ menu.<br>• **Tại ngày chốt:** *Không lọc biến động* và kỳ khác hôm nay. Trạng thái và cảnh báo xét tại hết ngày Đến ngày; mỗi thẻ một dòng; chỉ xem.<br>• **Theo biến động:** Chọn một hoặc nhiều *Loại biến động*. Lấy các lượt phát sinh trong kỳ; trạng thái, nhóm thuê bao và cảnh báo xét tại Đến ngày; mỗi lượt một dòng (một thẻ có thể xuất hiện nhiều dòng); chỉ xem.<br>Ngoài chế độ hiện tại, Kỳ báo cáo chỉ được chọn từ ngày go-live đến ngày đã có số liệu; nếu không hợp lệ, hệ thống báo lỗi tại ô ngày và khóa nút *Áp dụng*. |
| **Bộ đếm & Tùy chỉnh cột** | Đầu bảng hiển thị `<N> thẻ` (hoặc `<N> lượt phát sinh · <M> thẻ` khi xem theo biến động) kèm mốc tính và nút **Tùy chỉnh cột** (lưu cấu hình cột riêng cho từng cách xem).<br>• *Cột mặc định:* Mã thẻ (kèm lô nhập, cố định), Kho bãi (kèm khu đô thị), Loại thẻ, Loại phương tiện, Chủ thẻ, Biển số, Trạng thái. Khi xem tại ngày chốt: đổi tên cột trạng thái thành `Trạng thái tại ngày đến`, thêm *Hiệu lực đến*, *Cảnh báo*. Khi xem theo biến động: thêm *Thời điểm phát sinh*, *Loại biến động*, *Trạng thái trước*, *Trạng thái sau*.<br>• *Cột mở rộng trong Tùy chỉnh cột:* `Mã thẻ mặt trước`, `Mã thẻ mặt sau`, `Kiểu thẻ`, `Đơn vị`, `Mô tả`, `Người tạo`, `Ngày tạo`, `Người cập nhật`, `Cập nhật cuối`, `Khu đô thị`, `Lô nhập`, `Số điện thoại`, `Mã thuê bao`, `Nhóm khách hàng`, `Căn hộ / gian hàng`, `Ngày cấp gần nhất`, `Lượt gần nhất`, `Số ngày không sử dụng`. |
| **Ánh xạ điều kiện khi mở từ báo cáo** | • *Tồn kho đầu/cuối kỳ:* `Trạng thái = Trong kho`, Kỳ = ngày liền trước Từ ngày (hoặc ngày go-live) / Đến ngày.<br>• *Lưu hành đầu/cuối kỳ:* `Trạng thái = Đang hoạt động, Khóa, Hết hạn`, Kỳ tương ứng.<br>• *Nhập mới / Cấp ra / Thu hồi / Mất / hỏng:* `Loại biến động` tương ứng, giữ nguyên kỳ báo cáo.<br>• *Cơ cấu (M2):* Điền phân loại đã bấm (dòng `VIP và Vãng lai` chuyển thành `Loại thẻ = VIP, Vãng lai`); `Trạng thái` = cả 3 trạng thái lưu hành hoặc đúng 1 trạng thái nếu bấm thanh Tình trạng sử dụng; Kỳ = Đến ngày.<br>• *Cảnh báo (M3):* `Cảnh báo` = nhóm đã bấm (số tổng `N thẻ` chọn cả 3 nhóm), Kỳ = Đến ngày.<br>Các bộ lọc Khu đô thị, Bãi xe, Loại thẻ, Phương tiện từ báo cáo được giữ nguyên. |
| **Phân trang** | Hỗ trợ chọn `20 / 50 / 100` dòng mỗi trang (mặc định `20` dòng/trang). |
| **Popup Thông tin thẻ (khi tra cứu theo kỳ)** | Tiêu đề `Thông tin thẻ`, phụ đề `Thông tin thẻ tại ngày dd/mm/yyyy`; phần đầu hiển thị Mã thẻ, Loại thẻ · Phương tiện và badge trạng thái. Nếu mở từ dòng biến động, hiển thị thêm dải thông tin lượt phát sinh (`Loại biến động · thời điểm · kho bãi · trạng thái trước → trạng thái sau`). Gồm 2 tab:<br>• **Thông tin thẻ:** Mã thẻ, **Mã thẻ mặt trước**, **Mã thẻ mặt sau**, **Kiểu thẻ**, Loại thẻ, Loại phương tiện, **Đơn vị**, **Mô tả**, **Người tạo / Ngày tạo / Người cập nhật / Cập nhật cuối**, Trạng thái tra cứu, Kho bãi, Khu đô thị, Lô nhập, Chủ thẻ, Biển số, Số điện thoại (che theo quyền), Mã thuê bao, Hiệu lực đến, Nhóm khách hàng, Cảnh báo.<br>• **Lịch sử thao tác:** Các lần đổi trạng thái tính đến ngày tra cứu (mới nhất trên cùng), gồm tên thao tác, thời điểm, người thực hiện, trạng thái trước → sau và kho bãi.<br>Chân popup ghi *Kho quản lý*, có nút **`Xem thẻ hiện tại`** *(mới)* để chuyển nhanh sang tra cứu vận hành của đúng mã thẻ đó, và nút `Đóng` (không hiển thị nút thao tác vận hành trực tiếp). |

#### 7.4.4 Acceptance Case

| ID | Acceptance Case |
| :--- | :--- |
| **AC-BC1-7.4-01** | Với dữ liệu minh họa kỳ `01/10 – 28/10/2026`, bấm thẻ KPI *Thẻ lưu hành cuối kỳ* (`1.990`) mở O5 với `Trạng thái = Đang hoạt động, Khóa, Hết hạn`, `Kỳ = 28/10/2026 – 28/10/2026`, hiển thị `1.990 thẻ`. Bấm số *Cấp ra* (`80`) của Ocean Park trong modal M1 mở O5 với `Loại biến động = Cấp ra`, `Khu đô thị = Vinhomes Ocean Park`, `Kỳ = 01/10/2026 – 28/10/2026`, hiển thị `80 lượt phát sinh · 79 thẻ`. |
| **AC-BC1-7.4-02** | Với kỳ báo cáo `01/10 – 28/10/2026`, bấm thẻ KPI *Tồn kho đầu kỳ* (`162`) mở O5 với `Trạng thái = Trong kho`, `Kỳ = 30/09/2026 – 30/09/2026`, hiển thị đúng `162 thẻ`. |
| **AC-BC1-7.4-03** | Khi gõ `30f11122`, `30F-111.22`, ` 30F 111 22 ` hoặc mã thẻ mặt trước / mặt sau vào ô *Tìm thẻ* và bấm *Áp dụng*, hệ thống đều trả về đúng thẻ tương ứng. |
| **AC-BC1-7.4-04** | Đang xem *Cấp ra · Ocean Park* theo biến động: khi bấm `Chỉ chọn` ở dòng *Khóa* của bộ lọc Trạng thái và bấm *Áp dụng*, danh sách chỉ còn các lượt Cấp ra của thẻ đang Khóa tại Đến ngày; khi bấm `Xóa bộ lọc`, các điều kiện lọc được xóa, Trạng thái về *Tất cả trạng thái*, Kỳ báo cáo giữ nguyên và chuyển về chế độ xem tại ngày chốt. |
| **AC-BC1-7.4-05** | Tài khoản không có quyền *Xem SĐT đầy đủ* khi bật cột Số điện thoại hoặc mở popup Thông tin thẻ sẽ thấy SĐT được che dạng `0901****567`. |
| **AC-BC1-7.4-06** | Khi bật thêm cột `Kiểu thẻ`, `Mã thẻ mặt trước`, thay đổi thứ tự và bấm *Lưu* trong ngăn kéo *Tùy chỉnh cột*, bảng cập nhật ngay và ghi nhớ riêng cho cách xem hiện tại mà không ảnh hưởng các cách xem khác. |
| **AC-BC1-7.4-07** | Khi bấm `← Quay lại báo cáo`, Dashboard khôi phục nguyên vẹn bộ lọc, kỳ báo cáo, tiêu chí *Phân loại theo* và trạng thái *Tách theo khu đô thị* trước đó. |
| **AC-BC1-7.4-08** | Khi tra cứu tại ngày chốt hoặc theo biến động, bảng và popup không hiện nút Chỉnh sửa / Khóa / Mở khóa / Thu hồi / Lập biên bản; khi bấm `Xem thẻ hiện tại` trong popup (hoặc đặt kỳ = `hôm nay – hôm nay` và bấm *Áp dụng*), màn hình chuyển sang trạng thái hiện tại kèm đầy đủ nút thao tác. |
| **AC-BC1-7.4-09** | Khi chọn `Khu đô thị = Ocean Park, Smart City` và `Kiểu thẻ = Thẻ Mifare` rồi bấm *Áp dụng*, danh sách chỉ gồm các thẻ Mifare thuộc một trong hai khu đô thị đó. |
| **AC-BC1-7.4-10** | Bỏ chọn hết ở *Trạng thái* sẽ báo `"Chọn ít nhất một trạng thái."` và khóa nút *Áp dụng*; chọn `Loại thẻ = VIP` kèm `Nhóm thuê bao = Cư dân` sẽ báo `"Nhóm thuê bao chỉ áp dụng cho thẻ Thuê bao tháng. Chọn loại thẻ này hoặc bỏ lọc nhóm thuê bao."` và không cho áp dụng. |
| **AC-BC1-7.4-11** | Khi đã chọn `Bãi xe = Hầm B1 – S1 · Ocean Park` rồi đổi Khu đô thị sang chỉ *Smart City*, hệ thống tự bỏ bãi không thuộc khu đô thị mới và hiển thị thông báo nhắc kiểm tra lại bãi xe trước khi áp dụng. |
| **AC-BC1-7.4-12** | Thẻ thuê bao Đang hoạt động hết hạn ngày `20/10/2026` và thẻ Khóa hết hạn ngày `15/10/2026`: khi tra cứu tại ngày `28/10/2026`, thẻ thứ nhất mang trạng thái *Hết hạn*, còn thẻ thứ hai vẫn mang trạng thái *Khóa*. |
| **AC-BC1-7.4-13** | Tại ngày chốt `28/10/2026`, bấm số `5 thẻ` có ít nhất một cảnh báo ở M3 mở O5 với cả 3 nhóm cảnh báo và hiển thị `5 thẻ`; bấm dòng `VIP và Vãng lai` ở M2 (theo Nhóm khách hàng) mở O5 với `Loại thẻ = VIP, Vãng lai` và `Nhóm thuê bao` để trống. |

---

### 7.5 Xuất Excel

#### 7.5.1 Business Flow và User Flow
Người dùng bấm nút xuất Excel trên màn hình đang mở; hệ thống tạo file `.xlsx` theo đúng bộ lọc đang áp dụng, đảm bảo số liệu khớp hoàn toàn với màn hình.

> *(Hình 12. Sơ đồ tương tác – Xuất Excel — giữ nguyên từ tài liệu gốc)*

#### 7.5.2 Nội dung file

| Màn hình / Thao tác xuất | Nội dung file Excel (`.xlsx`) |
| :--- | :--- |
| **Dashboard Báo cáo quản lý thẻ – Tải báo cáo (`.xlsx`)** | File tổng hợp theo mẫu 4.1 của VCR gồm các sheet:<br>• `ThongTin`: điều kiện lọc, kỳ báo cáo, ngày chốt dữ liệu, người xuất, thời điểm xuất.<br>• `1-TongQuan`: 10 chỉ tiêu tổng hợp toàn phạm vi lọc.<br>• `2-BienDongKho`: chi tiết Đầu kỳ – Phát sinh – Cuối kỳ theo từng Khu đô thị và từng Kho bãi xe, kèm Tỷ lệ mất / hỏng và Định mức.<br>• `3-LuuHanh`: cơ cấu thẻ lưu hành theo Khu đô thị × Loại thẻ / Tình trạng sử dụng tại ngày cuối kỳ.<br>• `4-CanhBao`: thống kê 3 nhóm cảnh báo theo khu đô thị, tổng thẻ có cảnh báo và đối chiếu định mức mất / hỏng.<br>• `5-ChiTiet`: danh sách chi tiết thẻ trong phạm vi lọc (chỉ xuất khi tài khoản có quyền xem chi tiết thẻ). |
| **Tra cứu thẻ (O5) – Xuất danh sách** | Xuất theo Bộ lọc tra cứu đang áp dụng. Gồm các cột thông tin thẻ (`Mã thẻ`, `Mã thẻ mặt trước`, `Mã thẻ mặt sau`, `Kiểu thẻ`, `Đơn vị`, `Mô tả`, `Người tạo`, `Ngày tạo`, `Người cập nhật`, `Cập nhật cuối`, `Kho bãi`, `Loại thẻ`, `Loại phương tiện`, `Chủ thẻ`, `Biển số`, `Trạng thái`). Khi xem theo biến động: mỗi lượt phát sinh một dòng, bổ sung `Trạng thái tại ngày đến`, `Thời điểm phát sinh`, `Loại biến động`, `Trạng thái trước`, `Trạng thái sau`. Khi tra cứu theo kỳ: bổ sung `Khu đô thị`, `Mốc tính` và (khi xem tại ngày chốt) `Hiệu lực đến`, `Nhóm khách hàng`, `Cảnh báo`. Nút xuất bị khóa khi danh sách tra cứu theo kỳ rỗng. |
| **Các màn vận hành (O1, O2, O4, O6) – Xuất danh sách** | Xuất bảng dữ liệu hiện hành theo bộ lọc đang chọn (tồn kho theo bãi, danh sách phiếu nhập, phiếu giao thẻ vãng lai, danh sách biên bản mất / hỏng). Riêng Bước 2 màn Nhập kho thẻ (O2) có thêm nút **Tải danh sách lỗi** để xử lý các dòng mã thẻ không hợp lệ. |

**Quy tắc file xuất:**
- Giá trị số lưu định dạng số, ngày tháng lưu định dạng ngày để tính toán và lọc trực tiếp trên Excel.
- Số điện thoại được che theo phân quyền của người xuất.
- Chuỗi bắt đầu bằng `=`, `+`, `-`, `@` được xử lý lưu dạng văn bản thuần để tránh Excel thực thi công thức.
- Danh sách ≤ 10.000 dòng tải trực tiếp; từ 10.001 đến 100.000 dòng tạo ngầm và gửi thông báo qua chuông thông báo (chỉ người tạo được tải, hết hạn sau 24 giờ); vượt 100.000 dòng từ chối và yêu cầu thu hẹp bộ lọc. Mỗi người dùng tạo tối đa 2 file ngầm đồng thời.

#### 7.5.3 Acceptance Case

| ID | Acceptance Case |
| :--- | :--- |
| **AC-BC1-7.5-01** | Với dữ liệu minh họa kỳ `01/10 – 28/10/2026`, khi mở file báo cáo tổng hợp, sheet `2-BienDongKho` khớp hoàn toàn bảng M1 và sheet `1-TongQuan` hiển thị: Tổng thẻ `2.050`, Tồn kho `60`, Lưu hành `1.990`, Đang hoạt động `1.930`, Khóa / Hết hạn `60`, Cấp ra `200`, Thu về `40`, Mất / hỏng `10`, Tỷ lệ sử dụng `94,1%`, Tỷ lệ mất / hỏng `0,5%`. |
| **AC-BC1-7.5-02** | Với danh sách trên `10.000` thẻ, khi bấm xuất, hệ thống chạy ngầm và gửi thông báo kèm đường dẫn khi hoàn tất; tài khoản khác mở đường dẫn, hoặc mở sau `24 giờ`, đều bị từ chối. |
| **AC-BC1-7.5-03** | Tài khoản không có quyền xem SĐT đầy đủ, đang ẩn bớt cột trên màn hình và có tên chủ xe bắt đầu bằng `"="`: file xuất ra vẫn đủ các cột tiêu chuẩn, SĐT bị che và tên chủ xe hiển thị đúng dạng văn bản thuần. |

---

### 7.6 Cấu hình tham số cảnh báo (M5)

#### 7.6.1 Business Flow và User Flow
Người dùng có quyền cấu hình mở menu **Cấu hình › Tham số báo cáo thẻ xe** (hoặc bấm liên kết *Cấu hình ngưỡng* tại khối `03 / CẢNH BÁO` trên Dashboard). Tại dòng khu đô thị cần cập nhật, người dùng bấm **Sửa**, điều chỉnh 3 tham số cảnh báo, chọn **Ngày bắt đầu áp dụng** (mặc định là ngày mai, bắt buộc lớn hơn ngày hiện tại) và bấm **Lưu thay đổi**. Giá trị mới chỉ có hiệu lực từ ngày áp dụng trở đi, không làm thay đổi số liệu cảnh báo hay đánh dấu vượt định mức của các kỳ báo cáo đã chốt trước đó.

> *(Hình 13. Sơ đồ tương tác – Cấu hình tham số cảnh báo — giữ nguyên từ tài liệu gốc)*

#### 7.6.2 Màn hình
> *(Hình 14. M5 – Tham số báo cáo thẻ xe — giữ nguyên từ tài liệu gốc)*

- **Banner quy tắc áp dụng:** Thông báo rõ thay đổi tham số chỉ áp dụng từ ngày hiệu lực trở đi; dữ liệu đã chốt trước đó giữ nguyên ngưỡng lịch sử.
- **Tab `Tham số đang áp dụng`:** Mỗi khu đô thị trong phạm vi quyền hiển thị một dòng gồm *Ngưỡng sắp hết hạn (P-01)*, *Định mức mất / hỏng (P-02)*, *Số ngày không sử dụng (P-03)*, *Ngày áp dụng* (kèm nhãn `Chờ áp dụng` nếu lớn hơn ngày chốt hiện tại) và nút `Sửa` (ẩn nếu tài khoản chỉ có quyền xem).
- **Khối 3 thẻ tra cứu nhanh cuối trang:** Ghi rõ giá trị mặc định và giới hạn cho phép của P-01 (`7 ngày` · `1–90 ngày`), P-02 (`5%` · `0–100%`), P-03 (`30 ngày` · `1–365 ngày`).
- **Tab `Lịch sử thay đổi`:** Kèm số đếm tổng lượt sửa, ghi nhận *Thời điểm sửa*, *Người sửa*, *Khu đô thị*, *Tham số*, *Giá trị cũ → Giá trị mới* và *Ngày áp dụng*.
- **Popup `Sửa tham số · <Khu đô thị>`:** Kiểm tra trực tiếp giới hạn P-01..P-03 và ngày áp dụng > hôm nay; nếu có thay đổi chưa lưu khi đóng popup, hệ thống hiển thị hộp thoại xác nhận `Bạn có thay đổi chưa lưu`.

#### 7.6.3 Acceptance Case

| ID | Acceptance Case |
| :--- | :--- |
| **AC-BC1-7.6-01** | Khi sửa ngưỡng sắp hết hạn của Khu đô thị A từ `7` thành `14` ngày, áp dụng từ `28/10`: xem cảnh báo ngày chốt `28/10` thì A dùng `14` ngày (khu đô thị khác giữ ngưỡng cũ); xem ngày chốt `27/10` thì A vẫn dùng `7` ngày. |
| **AC-BC1-7.6-02** | Khi sửa định mức mất / hỏng vào tháng 10, trạng thái đánh dấu vượt định mức của kỳ báo cáo tháng 8 đã qua không bị thay đổi. |
| **AC-BC1-7.6-03** | Người dùng chỉ được phân quyền Khu đô thị A và không có quyền sửa tham số: khi mở M5 chỉ thấy dòng của A và không có nút *Sửa*. |
| **AC-BC1-7.6-04** | Khi nhập định mức `120%` hoặc số ngày `0`, hệ thống báo lỗi trực tiếp tại ô nhập và không cho lưu. |

---

### 7.7 Theo dõi kho thẻ theo bãi (O1)

#### 7.7.1 Business Flow
1. Người dùng mở menu **Quản lý thẻ › Kho thẻ theo bãi**; hệ thống hiển thị số lượng thẻ theo 4 trạng thái vận hành tức thời của tất cả bãi xe trong phạm vi quyền.
2. Người dùng kết hợp ô tìm kiếm (mã thẻ, chủ thẻ, biển số, mã thuê bao) với 4 bộ lọc (*Kho bãi*, *Trạng thái*, *Loại thẻ*, *Phương tiện*) để thu hẹp phạm vi kiểm tra.
3. Hệ thống cập nhật tức thời 4 thẻ tổng hợp trạng thái (*Trong kho*, *Đang hoạt động*, *Khóa*, *Mất / hỏng*) và bảng *Tổng quan theo kho bãi*.
4. Người dùng bấm **Xem thẻ →** ở một dòng bãi xe để mở màn **Tra cứu thẻ (O5)** ở chế độ trạng thái hiện tại, lọc sẵn Khu đô thị, Bãi xe của dòng đó và giữ nguyên từ khóa, Trạng thái, Loại thẻ, Phương tiện đang chọn (riêng trạng thái *Đang hoạt động* ở O1 ánh xạ sang cả *Đang hoạt động* và *Hết hạn* tại O5). Người dùng cũng có thể bấm **Xuất danh sách** để tải bảng tồn kho ra Excel.

#### 7.7.2 Màn hình
> *(Hình 15. O1 – Kho thẻ theo bãi — giữ nguyên từ tài liệu gốc)*

| Thành phần | Mô tả |
| :--- | :--- |
| **Thanh tìm kiếm & Bộ lọc** | Đặt ở đầu trang, gồm ô tìm kiếm từ khóa và 4 dropdown: *Tất cả kho bãi*, *Tất cả trạng thái*, *Tất cả loại thẻ*, *Tất cả phương tiện*. |
| **Banner lưu ý nghiệp vụ** | Phân biệt rõ đây là trạng thái vận hành tức thời (không phải số chốt cuối kỳ báo cáo); chỉ thẻ *Trong kho* mới sẵn sàng cấp phát. |
| **4 thẻ tổng hợp trạng thái** | Hiển thị tổng số thẻ theo bộ lọc: *Trong kho* (Sẵn sàng cấp từ kho bãi), *Đang hoạt động* (Thẻ đã cấp, đang hoạt động), *Khóa* (Tạm ngừng sử dụng), *Mất / hỏng* (Có biên bản, không tái sử dụng). |
| **Bảng Tổng quan theo kho bãi** | Mỗi bãi xe một dòng (kèm tên rút gọn Khu đô thị), gồm các cột: *Kho bãi*, *Tổng số thẻ*, *Trong kho* (tô nổi bật), *Đang hoạt động*, *Khóa*, *Mất / hỏng* và *Thao tác* (`Xem thẻ →`). Hiển thị cả bãi chưa có thẻ (giá trị `0`). |

**Quy tắc kiểm tra hợp lệ:**
- `Tổng số thẻ` của mỗi dòng luôn bằng `Trong kho + Đang hoạt động + Khóa + Mất / hỏng`.
- Mọi thao tác nhập kho (O2), cấp thẻ thuê bao (O3), giao thẻ vãng lai (O4), khóa / mở khóa / thu hồi (O5) và lập biên bản (O6) trong phiên đều phản ánh tức thời vào số liệu trên O1.

#### 7.7.3 Acceptance Case

| ID | Acceptance Case |
| :--- | :--- |
| **AC-BC1-7.7-01** | Khi mở màn *Kho thẻ theo bãi* ở trạng thái chưa lọc, hệ thống hiển thị đủ 9 bãi xe của 3 khu đô thị và tổng 4 thẻ trạng thái phía trên khớp đúng tổng các dòng bảng bên dưới. |
| **AC-BC1-7.7-02** | Khi chọn `Loại thẻ = Vãng lai`, cả 4 thẻ trạng thái và toàn bộ bảng *Tổng quan theo kho bãi* chỉ đếm thẻ Vãng lai. |
| **AC-BC1-7.7-03** | Khi bấm `Xem thẻ →` tại dòng *Hầm B1 – S1 (Ocean Park)*, hệ thống chuyển sang O5 với `Khu đô thị = Vinhomes Ocean Park`, `Bãi xe = Hầm B1 – S1` và `Kỳ báo cáo = hôm nay – hôm nay` (trạng thái hiện tại). |

---

### 7.8 Nhập kho thẻ (O2)

#### 7.8.1 Business Flow
1. Người dùng mở menu **Quản lý thẻ › Nhập kho thẻ** để xem lịch sử các phiếu nhập kho (*Mã lô nhập*, *Kho bãi nhận*, *Nhà cung cấp*, *Số thẻ*, *Ngày nhập*, *Người nhập*) hoặc bấm một dòng để xem popup *Chi tiết lô nhập*.
2. Để nhập thẻ mới, người dùng bấm **+ Nhập kho** mở luồng nhập kho 2 bước:
   - **Bước 1 – Thông tin & danh sách thẻ:** Người dùng khai báo *Thông tin phiếu nhập* (Kho bãi nhận, Nhà cung cấp, Loại thẻ, Loại phương tiện, **Kiểu thẻ chung**), sau đó chọn một trong 2 cách nhập danh sách mã thẻ:
     - **Nhập trực tiếp** *(mặc định, dùng cho nhập thẻ lẻ hoặc số lượng ít)*: nhập trực tiếp từng dòng mã thẻ (tối đa 100 dòng, giữ nguyên số 0 đầu mã), tùy chọn nhập *Mã mặt trước*, *Mã mặt sau* và chọn *Kiểu thẻ* riêng cho từng dòng.
     - **Nhập từ Excel** *(dùng cho nhập lô lớn)*: tải tệp mẫu nếu cần và kéo-thả tệp `.xlsx`/`.xls` (tối đa 10 MB, 10.000 dòng) gồm cột `Mã thẻ` (bắt buộc) và các cột tùy chọn `Mã thẻ mặt trước`, `Mã thẻ mặt sau`, `Kiểu thẻ`.
3. Người dùng bấm **Kiểm tra dữ liệu →** để chuyển sang **Bước 2 – Kiểm tra & xác nhận**. Hệ thống kiểm tra định dạng, tính duy nhất của mã thẻ và kiểu thẻ hợp lệ (`Thẻ Mifare` / `Thẻ Proximity`), thống kê *Tổng số dòng* / *Hợp lệ · Sẵn sàng nhập* / *Lỗi dữ liệu · Không nhập*, cho phép lọc theo tab, tải file danh sách lỗi (`.xlsx`) hoặc bấm `← Sửa danh sách` để quay lại chỉnh sửa.
4. Người dùng bấm **Nhập N thẻ hợp lệ** (hoặc **Lưu và thêm tiếp** khi nhập trực tiếp để tạo liên tiếp phiếu nhập mới). Hệ thống sinh mã lô, đưa toàn bộ thẻ hợp lệ vào trạng thái *Trong kho* của đúng kho bãi nhận và ghi lịch sử nhập kho cho từng thẻ.

#### 7.8.2 Màn hình
> *(Hình 16a & 16b. O2 – Nhập kho thẻ 2 bước — lưu ý cập nhật ảnh chụp màn hình mới gồm trường `Kiểu thẻ chung`, 2 tab `Nhập trực tiếp` / `Nhập từ Excel`, các cột `Mã mặt trước`, `Mã mặt sau`, `Kiểu thẻ` và nút `Lưu và thêm tiếp`)*

| Thành phần | Mô tả |
| :--- | :--- |
| **Danh sách lô nhập & Chi tiết lô** | Hiển thị lịch sử các phiếu nhập kho kèm ô tìm kiếm (mã lô, nhà cung cấp, kho bãi) và bộ lọc *Kho bãi*; bấm một dòng mở popup liệt kê thông tin lô và danh sách mã thẻ trong lô. |
| **Bước 1 – Thông tin phiếu nhập** | Gồm: `Kho bãi nhận *`, `Nhà cung cấp` (tối đa 255 ký tự; **bắt buộc** khi *Nhập từ Excel*, có thể để trống khi *Nhập trực tiếp*), `Loại thẻ` (VIP / Thuê bao tháng / Vãng lai), `Loại phương tiện` (Ô tô / Xe máy / Xe đạp), và **`Kiểu thẻ chung`** (`Thẻ Mifare` / `Thẻ Proximity`, áp dụng cho các dòng không chỉ định kiểu thẻ riêng). |
| **Bước 1 – Tab `Nhập trực tiếp` *(mới)*** | Bảng nhập từng dòng (tối đa 100 dòng, giữ nguyên số 0 đầu mã) gồm các cột: `Mã thẻ *` (≤ 50 ký tự, không khoảng trắng), `Mã mặt trước` (≤ 50 ký tự), `Mã mặt sau` (≤ 50 ký tự), `Kiểu thẻ` (`Theo kiểu thẻ chung` / `Thẻ Mifare` / `Thẻ Proximity`), nút xóa dòng và nút `+ Thêm dòng`. Báo lỗi trực tiếp ngay dưới ô mã thẻ nếu dữ liệu không hợp lệ. |
| **Bước 1 – Tab `Nhập từ Excel`** | Vùng kéo-thả hoặc chọn tệp `.xlsx`/`.xls` kèm nút `Tải tệp mẫu` (gồm 4 cột: `Mã thẻ`, `Mã thẻ mặt trước`, `Mã thẻ mặt sau`, `Kiểu thẻ`). Kiểm tra định dạng nhị phân thực tế (magic bytes ZIP/OLE), dung lượng ≤ 10 MB và số dòng ≤ 10.000. |
| **Bước 2 – Kiểm tra & xác nhận** | 3 thẻ thống kê (*Tổng số dòng*, *Hợp lệ · Sẵn sàng nhập*, *Lỗi dữ liệu · Không nhập*), 3 tab lọc (*Tất cả*, *Hợp lệ*, *Lỗi dữ liệu*), bảng đối chiếu gồm `STT`, `Mã thẻ`, `Mã mặt trước`, `Mã mặt sau`, `Kiểu thẻ`, `Kiểm tra`, `Chi tiết phân tích`, nút `Tải danh sách lỗi` (`.xlsx`) và nút `← Sửa danh sách`. Chân trang có nút `Nhập N thẻ hợp lệ` (chỉ bật khi có ≥ 1 dòng hợp lệ) và nút `Lưu và thêm tiếp` (khi nhập trực tiếp). |

**Quy tắc kiểm tra hợp lệ:**
- Mã thẻ bắt buộc, ≤ 50 ký tự, không chứa khoảng trắng, duy nhất trong toàn hệ thống và không trùng lặp trong danh sách đang nhập.
- Mã mặt trước, mã mặt sau (nếu có) ≤ 50 ký tự.
- Mỗi dòng sau khi kết hợp với *Kiểu thẻ chung* bắt buộc có kiểu thẻ là `Thẻ Mifare` hoặc `Thẻ Proximity`. Thẻ UHF dán trên xe **không được nhập kho** (khai báo bằng mã thẻ RFID trong hồ sơ xe tại *Danh sách xe*).

#### 7.8.3 Acceptance Case

| ID | Acceptance Case |
| :--- | :--- |
| **AC-BC1-7.8-01** | Khi tải tệp Excel gồm 4 dòng (2 mã mới hợp lệ, 1 mã đã tồn tại trong hệ thống, 1 mã trùng trong tệp), Bước 2 hiển thị Tổng số dòng `4`, Hợp lệ `2`, Lỗi dữ liệu `2` kèm lý do chi tiết từng dòng. |
| **AC-BC1-7.8-02** | Từ kết quả AC-BC1-7.8-01, khi bấm `Nhập 2 thẻ hợp lệ` vào kho *Hầm B1 – S1 · Ocean Park*, hệ thống tạo lô nhập mới gồm `2` thẻ, tồn *Trong kho* của *Hầm B1 – S1* tăng `2` và 2 dòng lỗi không được tạo. |
| **AC-BC1-7.8-03** | Khi đổi đuôi tệp văn bản thành `.xlsx` hoặc tải tệp vượt quá `10 MB` / `10.000` dòng, hệ thống từ chối ngay tại Bước 1 kèm thông báo lỗi rõ ràng. |
| **AC-BC1-7.8-04** | Khi chọn tab `Nhập trực tiếp`, để trống Nhà cung cấp, chọn `Kiểu thẻ chung = Thẻ Mifare`, nhập 2 dòng mã thẻ (trong đó 1 dòng giữ số `0` đầu mã và đổi kiểu thẻ riêng thành `Thẻ Proximity`), hệ thống kiểm tra hợp lệ, giữ nguyên số `0` đầu mã và cho phép bấm `Lưu và thêm tiếp` để nhập ngay phiếu kế tiếp. |
| **AC-BC1-7.8-05** | Khi để trống *Kiểu thẻ chung* và dòng thẻ cũng không chọn *Kiểu thẻ* (hoặc khai báo `Thẻ UHF` trong tệp Excel), Bước 2 đánh dấu dòng đó là `Lỗi dữ liệu` và nhắc chỉ nhận thẻ Mifare/Proximity. |

---

### 7.9 Quản lý danh sách thuê bao (O3)

#### 7.9.1 Business Flow
1. Người dùng mở menu **Quản lý thuê bao › Danh sách thuê bao** để theo dõi toàn bộ thuê bao tháng và thuê bao VIP, xem 4 thẻ tổng quan đầu trang và lọc theo *Khu đô thị*, *Trạng thái thuê bao*, *Loại phương tiện*, *Bãi xe*, *Tình trạng cấp thẻ* hoặc tìm theo mã thuê bao / tên khách / SĐT / biển số / mã thẻ / mã RFID.
2. **Đăng ký thuê bao mới:** Người dùng bấm **+ Đăng ký thuê bao** để mở form gồm 6 phần tuần tự:
   - *(1) Phạm vi sử dụng:* chọn Khu đô thị và tích chọn một hoặc nhiều Bãi xe áp dụng.
   - *(2) Thông tin thuê bao:* chọn Chủ thuê bao từ danh mục *Khách hàng* (hoặc bấm tạo mới / sửa nhanh ngay trong form để bổ sung căn hộ, hợp đồng, ảnh khuôn mặt), nhập thời gian hiệu lực.
   - *(3) Dịch vụ áp dụng:* chọn gói dịch vụ dùng chung cho các bãi hoặc chọn riêng theo từng bãi; có bộ lọc nhanh theo loại xe và cách nhận diện. Gói dịch vụ quyết định loại phương tiện và chế độ kiểm soát (thẻ Proximity/Mifare, biển số, khuôn mặt, RFID/UHF).
   - *(4) Thẻ đăng ký:* tùy theo chế độ kiểm soát của dịch vụ, hệ thống yêu cầu bắt buộc cấp thẻ Proximity/Mifare từ kho của một trong các bãi đang áp dụng, cho phép cấp tùy chọn, hoặc thông báo dịch vụ không dùng thẻ vật lý. Chọn thẻ `VIP` tự động áp dụng quy tắc thuê bao VIP; chọn thẻ `Thuê bao tháng` (hoặc dịch vụ dùng UHF) áp dụng quy tắc thuê bao tháng.
   - *(5) Phương tiện sử dụng:* với Thuê bao tháng chọn đúng 1 xe từ *Danh sách xe* (hoặc chọn *Xe không có biển số* nếu dịch vụ hỗ trợ); với Thuê bao VIP chọn 1–10 biển số hoặc để trống (*Không giới hạn biển số* nếu dịch vụ hỗ trợ). Có thể tạo mới / sửa xe (ví dụ bổ sung mã thẻ RFID) ngay trong form.
   - *(6) Hoàn tất:* nhập ghi chú, rà soát tóm tắt và bấm **Lưu thông tin** (đăng ký thuê bao và cấp thẻ từ kho được lưu đồng thời trong một giao dịch).
3. **Xem chi tiết & Chỉnh sửa thuê bao:** Bấm mã thuê bao hoặc nút `Chi tiết` để mở popup *Chi tiết thuê bao* (xem thông tin đầy đủ, mở nhanh hồ sơ Khách hàng / Xe / Dịch vụ / Quản lý thẻ liên kết). Bấm `Chỉnh sửa` để cập nhật thuê bao (không áp dụng cho thuê bao *Đã hủy*; nếu đang có thẻ lưu hành, phải thu hồi thẻ trước khi đổi loại thuê bao, đổi loại phương tiện hoặc bỏ bãi đang quản lý thẻ).
4. **Cấp thẻ / Cấp lại thẻ:** Với thuê bao có dịch vụ sử dụng thẻ Proximity/Mifare và đang hoạt động, người dùng bấm `Cấp thẻ` hoặc `Cấp lại thẻ`. Nếu thuê bao vẫn còn thẻ cũ đang lưu hành (*Đang hoạt động* hoặc *Khóa*), hệ thống chặn cấp lại và cung cấp nút `Mở quản lý thẻ cũ →` sang O5 để thu hồi kiểm tra vật lý hoặc lập biên bản mất / hỏng trước.
5. **Thay đổi trạng thái thuê bao:** Trong popup *Chi tiết thuê bao*, người dùng bấm `Thay đổi trạng thái thuê bao` để chuyển giữa *Đang hoạt động* ↔ *Tạm ngừng*, hoặc chuyển sang *Đã hủy* (trạng thái cuối, không thể kích hoạt lại) kèm lý do bắt buộc. Việc tạm ngừng hoặc hủy thuê bao **không tự động đưa thẻ về kho** — thẻ đang lưu hành phải được thu hồi và kiểm tra vật lý riêng tại Quản lý thẻ (O5).

#### 7.9.2 Màn hình
> *(Hình 17a & 17b. O3 – Danh sách thuê bao và Form Đăng ký thuê bao 6 phần — cần cập nhật ảnh chụp màn hình mới theo giao diện Danh sách thuê bao)*

| Thành phần | Mô tả |
| :--- | :--- |
| **4 thẻ tổng quan đầu trang** | Hiển thị tức thời: *Tổng thuê bao*, *Thuê bao tháng*, *Thuê bao VIP*, *Đang có thẻ lưu hành*. |
| **Khối Bộ lọc thuê bao** | Gồm ô `Tìm kiếm` (mã thuê bao, tên chủ thuê bao, SĐT, biển số, mã thẻ, mã RFID), 5 bộ lọc chọn nhiều (*Khu đô thị*, *Trạng thái thuê bao*: Đang hoạt động / Tạm ngừng / Đã hủy, *Loại phương tiện* chi tiết theo năng lượng xăng/điện, *Bãi xe* theo khu đô thị, *Tình trạng cấp thẻ*: Chưa được cấp thẻ / Đang có thẻ lưu hành / Chờ cấp lại thẻ / Không yêu cầu thẻ), nhãn `Chưa áp dụng`, nút `Xóa bộ lọc` và `Áp dụng`. Nếu mở từ liên kết của Khách hàng / Xe / Dịch vụ, hiển thị thêm dải lọc `Thuê bao liên quan đến: <Tên>` kèm nút bỏ điều kiện. |
| **Bảng Danh sách thuê bao & Tùy chỉnh cột** | Phân trang `20` dòng/trang, hỗ trợ **Tùy chỉnh cột** lưu theo tài khoản.<br>• *10 cột mặc định:* `Mã thuê bao` (cố định), `Chủ thuê bao`, `Loại phương tiện`, `Biển số`, `Bãi xe`, `Dịch vụ`, `Hiệu lực đến`, `Trạng thái thuê bao`, `Mã thẻ` (bấm mở nhanh quản lý thẻ tại O5), `Cảnh báo` (như *Thiếu nhận diện*, *Gói chưa phù hợp*, thiếu căn hộ / hết hạn hợp đồng).<br>• *Cột mở rộng:* `Mã khách hàng`, `Số điện thoại`, `Nhóm thuê bao`, `Khu đô thị`, `Trạng thái áp dụng bãi`, `Hiệu lực từ`, `Trạng thái thẻ`, `Tình trạng cấp thẻ`, `Ghi chú`.<br>• *Cột Thao tác:* `Chi tiết`, `Chỉnh sửa`, `Cấp thẻ` / `Cấp lại thẻ` (chỉ hiển thị khi dịch vụ sử dụng thẻ Proximity/Mifare; vô hiệu hóa khi thuê bao *Đã hủy*). |
| **Form Đăng ký / Sửa thuê bao (6 phần)** | **1. Phạm vi sử dụng:** `Khu đô thị *` (khóa khi sửa), danh sách checkbox `Bãi xe áp dụng *` (chọn nhiều; khi sửa khóa bỏ chọn bãi đang quản lý thẻ đã cấp).<br>**2. Thông tin thuê bao:** `Chủ thuê bao *` (tìm chọn từ *Khách hàng* kèm nút `+ Tạo khách hàng mới`, `Sửa hồ sơ khách hàng`; tự động hiển thị Nhóm thuê bao, Căn hộ, Hợp đồng gian hàng, số ảnh khuôn mặt `N/5`), `Hiệu lực từ *`, `Hiệu lực đến` (bắt buộc với Thuê bao tháng, tùy chọn với VIP).<br>**3. Dịch vụ áp dụng:** Tùy chọn `Xe không có biển số` (cho Thuê bao tháng); khi chọn ≥ 2 bãi có radio `Dùng chung dịch vụ` / `Chọn theo từng bãi` (khi sửa có checkbox bật/tắt `Đang áp dụng` từng bãi); thanh lọc gói theo tab `Ô tô / Xe máy / Xe đạp`, `Cách nhận diện` (`Thẻ`, `Biển số`, `Khuôn mặt`, `RFID (UHF)`, `Mở tay`) và ô tìm tên gói. Hiển thị rõ mô tả cách nhận diện, đơn giá và điều kiện đi kèm của từng gói.<br>**4. Thẻ đăng ký:** Tự động điều chỉnh theo chế độ kiểm soát của gói dịch vụ. Khi cần/hỗ trợ thẻ Proximity/Mifare: chọn `Kho lấy thẻ` (trong các bãi đang áp dụng) và `Mã thẻ đăng ký` đang *Trong kho* (hiển thị kèm loại thẻ, phương tiện, kiểu thẻ, mã hai mặt); có mục xem nhanh `Thông tin thẻ đã chọn`. Khi dịch vụ dùng UHF: ghi chú quy tắc thuê bao tháng (1 xe) và không cho chọn thẻ VIP.<br>**5. Phương tiện sử dụng:** Thuê bao tháng chọn đúng 1 xe (hoặc chọn phân loại xăng/điện nếu `Xe không có biển số`); VIP chọn `1–10` biển số hoặc để trống (*Không giới hạn biển số* nếu dịch vụ hỗ trợ). Kèm nút `+ Tạo xe mới` và cảnh báo / liên kết bổ sung `Mã thẻ RFID` nếu dịch vụ dùng UHF.<br>**6. Hoàn tất:** `Ghi chú` (≤ 500 ký tự) và dòng tóm tắt thuê bao. |
| **Popup Chi tiết thuê bao** | Hiển thị đầy đủ thông tin thuê bao (liên kết bấm mở nhanh sang Khách hàng, Thành viên, Xe, Dịch vụ), danh sách *Bãi xe và dịch vụ áp dụng*, khối *Thẻ cấp cho thuê bao* (hiển thị cả Thẻ UHF/RFID dán trên xe nếu có và Thẻ Proximity/Mifare lưu hành kèm nút `Quản lý thẻ →`, `Cấp thẻ / Cấp lại thẻ`), cảnh báo nếu thiếu nhận diện / xung đột gói và nút `Thay đổi trạng thái thuê bao`. |
| **Popup Cấp thẻ / Cấp lại thẻ** | Nếu thuê bao còn thẻ cũ lưu hành (*Đang hoạt động* hoặc *Khóa*): chặn cấp lại, hiển thị cảnh báo (nhắc rõ khóa thẻ đơn thuần chưa giải phóng thẻ cũ) và nút `Mở quản lý thẻ cũ →` sang O5. Khi đã giải phóng thẻ cũ: chọn `Bãi cấp thẻ *`, tìm và chọn thẻ *Trong kho* khớp bãi / loại thuê bao / phương tiện, nhập `Ghi chú cấp thẻ` / `Lý do cấp lại *` (≤ 500 ký tự) và bấm `Xác nhận cấp thẻ`. |
| **Popup Thay đổi trạng thái thuê bao** | Chọn `Trạng thái thuê bao` (*Đang hoạt động*, *Tạm ngừng*, *Đã hủy*) và nhập `Lý do thay đổi *` (≤ 500 ký tự). Cảnh báo *Đã hủy* là trạng thái cuối và không tự thu hồi thẻ về kho. |

**Quy tắc kiểm tra hợp lệ chính của thuê bao:**
- Khách hàng nhóm *Cư dân* bắt buộc có `Căn hộ` trong hồ sơ khách hàng; nhóm *Gian hàng* bắt buộc có `Số hợp đồng` và `Hạn hợp đồng` còn hiệu lực (≥ hôm nay và ≥ ngày hiệu lực thuê bao).
- **Chống trùng thuê bao theo xe:** Tại một thời điểm, một xe đang hoạt động chỉ được thuộc tối đa **1 thuê bao đang hoạt động** (không được vừa thuộc Thuê bao tháng vừa thuộc Thuê bao VIP, và không được thuộc 2 thuê bao cùng loại — nếu cần gửi thêm bãi thì chỉnh sửa bổ sung bãi trên thuê bao đang có).
- Biểu giá của gói dịch vụ phải bao phủ thời gian hiệu lực thuê bao; loại năng lượng (xăng/điện) của xe phải phù hợp gói dịch vụ (VIP có cả xe điện và xe xăng cần chọn gói áp dụng chung cả hai).
- Nếu chế độ kiểm soát của dịch vụ bắt buộc biển số thì không được đăng ký `Xe không có biển số` hoặc `VIP không giới hạn biển số`; nếu bắt buộc thẻ Proximity/Mifare thì bắt buộc cấp thẻ; nếu bắt buộc UHF thì xe phải có `Mã thẻ RFID` (không dùng cho xe không biển số); nếu bắt buộc khuôn mặt thì chủ thuê bao phải có ảnh khuôn mặt.
- Có hộp thoại xác nhận `Bỏ thay đổi chưa lưu?` khi đóng form đang nhập dở.

#### 7.9.3 Acceptance Case

| ID | Acceptance Case |
| :--- | :--- |
| **AC-BC1-7.9-01** | Khi chọn chủ thuê bao nhóm *Cư dân* chưa có căn hộ (hoặc nhóm *Gian hàng* chưa có hợp đồng / hợp đồng đã hết hạn), hệ thống hiển thị cảnh báo kèm liên kết `Sửa hồ sơ khách hàng` và từ chối lưu thuê bao cho đến khi hồ sơ khách hàng được bổ sung hợp lệ. |
| **AC-BC1-7.9-02** | Khi đăng ký thuê bao tháng cho 2 bãi trong *Vinhomes Ocean Park*, chọn gói dịch vụ bắt buộc thẻ Proximity/Mifare, chọn thẻ `A-NEW-1201` đang *Trong kho* của *Hầm B1 – S1* và chọn 1 xe hợp lệ rồi bấm *Lưu thông tin*, hệ thống đồng thời tạo mã thuê bao mới, chuyển thẻ `A-NEW-1201` sang *Đang hoạt động* và giảm tồn *Trong kho* của *Hầm B1 – S1* đi `1`. |
| **AC-BC1-7.9-03** | Khi thuê bao đang có thẻ cũ ở trạng thái *Khóa* (hoặc *Đang hoạt động*), bấm `Cấp lại thẻ` sẽ bị chặn kèm cảnh báo yêu cầu thu hồi kiểm tra vật lý hoặc lập biên bản mất / hỏng trước; sau khi xử lý xong thẻ cũ tại O5, người dùng chọn thẻ mới *Trong kho* và cấp lại thành công. |
| **AC-BC1-7.9-04** | Khi chọn một xe đang thuộc Thuê bao tháng để đăng ký thêm Thuê bao VIP (hoặc ngược lại, hoặc đăng ký trùng Thuê bao tháng thứ hai), hệ thống chặn lưu và thông báo rõ mã thuê bao hiện hành của xe đó. |
| **AC-BC1-7.9-05** | Khi chọn gói dịch vụ có chế độ kiểm soát chỉ dùng `Biển số` (không dùng thẻ Proximity/Mifare), phần *Thẻ đăng ký* thông báo không cấp thẻ và nút `Cấp thẻ` không hiển thị ở danh sách thuê bao; khi chọn gói bắt buộc `UHF`, hệ thống kiểm tra `Mã thẻ RFID` trên hồ sơ xe và không cho phép chọn thẻ VIP. |
| **AC-BC1-7.9-06** | Khi chuyển trạng thái thuê bao sang *Đã hủy*, trạng thái thuê bao khóa vĩnh viễn (không sửa / không kích hoạt lại / không cấp thẻ được nữa), đồng thời thẻ vật lý đang gắn (nếu có) vẫn giữ nguyên trạng thái lưu hành cho đến khi được thu hồi riêng tại O5. |

---

### 7.10 Giao thẻ vãng lai cho bàn thẻ (O4)

#### 7.10.1 Business Flow
1. Người dùng mở menu **Quản lý thẻ › Giao thẻ vãng lai** để theo dõi danh sách các phiếu bàn giao thẻ vãng lai từ kho bãi ra bàn thẻ làn xe (*Mã phiếu giao*, *Bãi nhận*, *Người nhận tại bàn thẻ*, *Số thẻ*, *Ngày giao*, *Người giao*).
2. Người dùng bấm **+ Tạo phiếu giao**, chọn *Kho bãi nhận*, nhập họ tên *Người nhận tại bàn thẻ* (ví dụ ca trưởng bảo vệ / nhân viên làn) và *Ghi chú* (nếu có).
3. Người dùng thêm thẻ vào danh sách bàn giao bằng 2 cách: quét / dán hàng loạt mã thẻ (mỗi mã một dòng rồi bấm *Thêm mã thẻ*) hoặc bấm **+ Chọn từ kho** để tích chọn các thẻ *Vãng lai* đang *Trong kho* của bãi đã chọn.
4. Người dùng bấm **Xác nhận giao N thẻ**; hệ thống tạo phiếu giao mới (`BG-yyyymmdd-xxx`), chuyển đồng loạt N thẻ từ *Trong kho* sang *Đang hoạt động* tại bãi nhận và ghi lịch sử bàn giao cho từng thẻ.

#### 7.10.2 Màn hình
> *(Hình 18. O4 – Giao thẻ cho bàn thẻ — giữ nguyên từ tài liệu gốc)*

| Thành phần | Mô tả |
| :--- | :--- |
| **Danh sách phiếu giao & Chi tiết phiếu** | Banner đầu trang ghi rõ: giao thẻ cho bàn thẻ là xuất kho phát hành; việc phát thẻ cho khách ở làn vào và nhận lại ở làn ra không làm thay đổi trạng thái thẻ. Bảng hỗ trợ lọc theo *Kho bãi*, tìm theo mã phiếu / người nhận / bãi xe; bấm dòng phiếu mở popup *Chi tiết phiếu giao*. |
| **Khối Thông tin bàn giao** | Gồm: `Kho bãi nhận *` (chỉ giao thẻ thuộc kho của chính bãi đó), `Người nhận tại bàn thẻ *` (tối đa 120 ký tự), `Ghi chú` (tối đa 500 ký tự). |
| **Khối Danh sách thẻ bàn giao & Chọn từ kho** | Cho phép quét đầu đọc / dán nhiều dòng mã thẻ cùng lúc hoặc chọn từ popup *Chọn thẻ vãng lai trong kho* (chỉ liệt kê thẻ loại *Vãng lai*, trạng thái *Trong kho* tại đúng bãi nhận). Có nút `×` để gỡ từng thẻ khỏi danh sách tạm. |

#### 7.10.3 Acceptance Case

| ID | Acceptance Case |
| :--- | :--- |
| **AC-BC1-7.10-01** | Khi chọn *Hầm B1 – S1 · Ocean Park*, nhập người nhận và chọn `3` thẻ Vãng lai đang *Trong kho* rồi bấm `Xác nhận giao 3 thẻ`, cả 3 thẻ chuyển sang *Đang hoạt động*, tồn *Trong kho* của *Hầm B1 – S1* giảm `3` và phiếu giao mới xuất hiện đầu danh sách. |
| **AC-BC1-7.10-02** | Đang lập phiếu giao cho *Hầm B1 – S1*, nếu quét một thẻ loại *Thuê bao tháng* hoặc thẻ *Vãng lai* thuộc *Hầm B2 – S2*, hệ thống từ chối ngay kèm thông báo lỗi và không thêm thẻ nào vào danh sách. |

---

### 7.11 Tra cứu thẻ vận hành, Chỉnh sửa, Khóa / Mở khóa và Thu hồi kiểm tra (O5)

#### 7.11.1 Business Flow
1. Người dùng mở menu **Quản lý thẻ › Tra cứu thẻ** (hoặc bấm `Xem thẻ →` từ O1, hoặc bấm `Quản lý thẻ →` từ O3); màn hình mặc định hiển thị trạng thái hiện tại (`Kỳ báo cáo = hôm nay – hôm nay`). Người dùng lọc thẻ bằng *Bộ lọc tra cứu* (§7.4.3) và bấm **Áp dụng**.
2. Bấm vào mã thẻ hoặc biểu tượng chi tiết để mở popup **Thông tin & thao tác thẻ** gồm 2 tab (*Thông tin thẻ* và *Lịch sử thao tác*).
3. **Chỉnh sửa thông tin thẻ *(mới)*:** Người dùng bấm biểu tượng bút chì trên dòng bảng hoặc nút **Chỉnh sửa** ở chân popup để mở popup *Chỉnh sửa thông tin thẻ*, cập nhật mã hai mặt, kiểu thẻ, đơn vị, mô tả (hoặc loại thẻ / loại phương tiện nếu thẻ đang *Trong kho* và chưa gắn thuê bao) rồi bấm **Lưu thay đổi**.
4. **Khóa / Mở khóa thẻ:** Với thẻ *Đang hoạt động* cần tạm ngừng sử dụng, bấm biểu tượng **Khóa** và nhập lý do bắt buộc; với thẻ đang *Khóa* được xác minh hợp lệ, bấm biểu tượng **Mở khóa** và nhập lý do.
5. **Thu hồi & kiểm tra vật lý:** Khi nhận lại thẻ vật lý từ khách thuê bao/VIP hoặc rút thẻ vãng lai từ bàn thẻ về kho, bấm **Thu hồi** để mở popup *Thu hồi & kiểm tra thẻ*, bắt buộc tích xác nhận đã kiểm tra vật lý và chọn kết quả:
   - *Thẻ đạt kiểm tra:* đưa thẻ về lại *Trong kho* của đúng kho bãi và gỡ liên kết thuê bao (nếu có).
   - *Thẻ không đạt / bị hỏng:* nhập số biên bản hỏng và ngày lập để tự động tạo biên bản Hỏng (khoản thu `0 đ`) và chuyển thẻ sang *Mất / hỏng*.

#### 7.11.2 Màn hình
> *(Hình 19a & 19b. O5 – Tra cứu thẻ vận hành và Popup Thu hồi & kiểm tra thẻ — cần bổ sung ảnh chụp popup `Chỉnh sửa thông tin thẻ` và nút bút chì trên dòng bảng)*

| Thành phần | Mô tả |
| :--- | :--- |
| **Bảng Tra cứu thẻ vận hành** | Hiển thị các cột mặc định như §7.4.3 (tùy chỉnh được cột) và cột **Thao tác** hiển thị động theo trạng thái thẻ: *Chi tiết*, *Chỉnh sửa* (biểu tượng bút chì), *Khóa* (thẻ Đang hoạt động), *Mở khóa* (thẻ Khóa), *Thu hồi* (thẻ Đang hoạt động hoặc Khóa). Dưới bảng có ghi chú nhắc việc thu hồi bắt buộc kèm kiểm tra vật lý. |
| **Popup Thông tin & thao tác thẻ** | Tiêu đề `Thông tin & thao tác thẻ`, phụ đề `Dữ liệu vận hành trong phiên hiện tại`. Gồm 2 tab: *Thông tin thẻ* (đầy đủ các trường như §7.4.3 gồm mã hai mặt, kiểu thẻ, đơn vị, mô tả, thông tin tạo/cập nhật) và *Lịch sử thao tác* (toàn bộ lịch sử vòng đời, gồm cả thao tác trong phiên). Chân popup ghi *Kho quản lý* và các nút phù hợp trạng thái: `Chỉnh sửa`, `Khóa` / `Mở khóa`, `Lập biên bản`, `Thu hồi & kiểm tra`, `Đóng`. |
| **Popup Chỉnh sửa thông tin thẻ *(mới)*** | • *Không cho sửa:* `Mã thẻ`, `Kho bãi quản lý`.<br>• *Cho sửa:* `Mã thẻ mặt trước` (≤ 50 ký tự), `Mã thẻ mặt sau` (≤ 50 ký tự), `Kiểu thẻ` (`Thẻ Mifare` / `Thẻ Proximity`; không cho bỏ trống nếu thẻ đã có kiểu thẻ), `Đơn vị` (thuộc cùng khu đô thị), `Mô tả` (≤ 500 ký tự).<br>• *Sửa có điều kiện:* `Loại thẻ *` và `Loại phương tiện *` **chỉ cho phép đổi khi thẻ đang `Trong kho` và chưa gắn thuê bao**; nếu thẻ đang lưu hành hoặc gắn thuê bao thì bị khóa kèm ghi chú yêu cầu thu hồi & kiểm tra trước.<br>• Mọi thay đổi được ghi vào *Lịch sử thao tác* (`Chỉnh sửa thông tin thẻ`) kèm giá trị `cũ → mới`; có hộp thoại xác nhận `Bỏ thay đổi thông tin thẻ?` khi đóng lúc chưa lưu. |
| **Popup Khóa thẻ / Mở khóa thẻ** | Hiển thị tóm tắt thẻ và ô `Lý do *` (bắt buộc, ≤ 500 ký tự). Khóa chuyển `Đang hoạt động → Khóa`; Mở khóa chuyển `Khóa → Đang hoạt động`. |
| **Popup Thu hồi & kiểm tra thẻ** | Áp dụng cho thẻ *Đang hoạt động* hoặc *Khóa*. Gồm 2 lựa chọn radio `Kết quả kiểm tra vật lý *`:<br>• *Thẻ đạt kiểm tra:* thu hồi về đúng kho bãi quản lý, gỡ liên kết thuê bao để sẵn sàng cấp lại.<br>• *Thẻ không đạt / bị hỏng:* hiển thị thêm 2 trường bắt buộc `Số biên bản hỏng *` và `Ngày lập *`, đồng thời sinh biên bản Hỏng (khoản thu `0 đ`) và chuyển thẻ sang *Mất / hỏng*.<br>Bắt buộc tích checkbox `Tôi đã nhận thẻ và kiểm tra tình trạng vật lý` và nhập `Lý do thu hồi / ghi nhận kiểm tra *`. |

#### 7.11.3 Acceptance Case

| ID | Acceptance Case |
| :--- | :--- |
| **AC-BC1-7.11-01** | Với thẻ `A-XM-00017` đang *Đang hoạt động* tại *Hầm B1 – S1*, khi bấm *Thu hồi*, chọn `Thẻ đạt kiểm tra`, tích xác nhận kiểm tra vật lý và nhập lý do, thẻ chuyển về *Trong kho* tại đúng *Hầm B1 – S1* và gỡ liên kết với thuê bao cũ. |
| **AC-BC1-7.11-02** | Khi thu hồi thẻ mà chọn `Thẻ không đạt / bị hỏng` và nhập số biên bản hỏng hợp lệ, thẻ chuyển thẳng sang *Mất / hỏng* (tồn *Trong kho* không tăng) và sinh biên bản tương ứng tại O6. |
| **AC-BC1-7.11-03** | Khi mở popup *Thu hồi & kiểm tra thẻ* nhưng chưa tích xác nhận kiểm tra vật lý hoặc để trống Lý do, nút `Xác nhận thu hồi` bị vô hiệu hóa. |
| **AC-BC1-7.11-04** | Với thẻ đang *Trong kho* chưa gắn thuê bao, khi mở *Chỉnh sửa thông tin thẻ*, người dùng sửa được `Mã thẻ mặt trước`, `Kiểu thẻ`, `Loại thẻ`, `Loại phương tiện`, `Mô tả`; sau khi lưu, tab *Lịch sử thao tác* ghi nhận dòng `Chỉnh sửa thông tin thẻ` với chi tiết giá trị cũ → mới. |
| **AC-BC1-7.11-05** | Với thẻ đang *Đang hoạt động* (hoặc đang gắn thuê bao), khi mở *Chỉnh sửa thông tin thẻ*, 2 trường `Loại thẻ` và `Loại phương tiện` bị khóa không cho sửa, các trường mã hai mặt / kiểu thẻ / đơn vị / mô tả vẫn chỉnh sửa được bình thường. |

---

### 7.12 Lập và theo dõi biên bản mất / hỏng (O6)

#### 7.12.1 Business Flow
1. Người dùng mở menu **Quản lý thẻ › Biên bản mất / hỏng** để tra cứu toàn bộ biên bản sự cố thẻ (*Số biên bản*, *Mã thẻ*, *Kho bãi*, *Loại biên bản: Thẻ mất / Thẻ hỏng*, *Khoản thu*, *Ngày lập*, *Người lập*) hoặc bấm một dòng để xem popup *Chi tiết biên bản*.
2. Khi phát sinh mất thẻ hoặc phát hiện thẻ hỏng (trong kho hoặc khi đang lưu hành), người dùng bấm **+ Lập biên bản** mở popup *Lập biên bản mất / hỏng*.
3. Người dùng nhập hoặc quét *Mã thẻ*, chọn *Loại biên bản* (*Mất* / *Hỏng*), kiểm tra *Số biên bản* (hệ thống gợi ý mã duy nhất `BB-yyyymmdd-xxx`), *Ngày lập* (≤ hôm nay), *Khoản thu ghi nhận (đ)* và *Lý do \**, sau đó bấm **Lập biên bản**.
4. Hệ thống lưu biên bản, chuyển vĩnh viễn thẻ sang trạng thái kết thúc *Mất / hỏng* và ghi lịch sử thẻ.

#### 7.12.2 Màn hình
> *(Hình 20. O6 – Danh sách Biên bản mất / hỏng và popup Lập biên bản — giữ nguyên từ tài liệu gốc)*

| Thành phần | Mô tả |
| :--- | :--- |
| **Banner quy tắc kết thúc vòng đời** | Nhấn mạnh *Biên bản mất / hỏng là kết thúc vòng đời thẻ* (không thể quay lại *Trong kho* hay cấp lại) và quy tắc an toàn: thẻ *Thuê bao tháng / VIP* đang hoạt động bắt buộc phải **Khóa** trước khi lập biên bản báo mất. |
| **Bảng Danh sách biên bản & Chi tiết** | Hỗ trợ tìm kiếm theo số biên bản, mã thẻ, lý do và lọc theo *Kho bãi*; popup *Chi tiết biên bản* hiển thị đầy đủ thông tin biên bản và liên kết mở nhanh hồ sơ thẻ. |
| **Popup Lập biên bản mất / hỏng** | Gồm: `Mã thẻ *` (nhập/quét, tự nhận diện loại thẻ và trạng thái hiện tại), `Loại biên bản *` (*Mất* / *Hỏng*), `Số biên bản *` (≤ 50 ký tự, không trùng lặp), `Ngày lập *` (≤ hôm nay), `Khoản thu ghi nhận (đ) *` (số nguyên từ `0` đến `1.000.000.000 đ`) và `Lý do *` (≤ 500 ký tự). |
| **Tự động gợi ý Khoản thu** | Khi nhập thẻ loại *Vãng lai* và chọn `Loại biên bản = Mất`, hệ thống tự động điền mặc định `50.000 đ`; trường hợp thẻ *Hỏng* hoặc loại thẻ khác mặc định `0 đ` (người lập có thể điều chỉnh trong giới hạn). Lưu ý khoản thu chỉ phục vụ ghi nhận biên bản, việc hạch toán doanh thu thực hiện tại Báo cáo doanh thu (BC3). |

#### 7.12.3 Acceptance Case

| ID | Acceptance Case |
| :--- | :--- |
| **AC-BC1-7.12-01** | Khi nhập mã thẻ *Vãng lai* đang hoạt động và chọn `Loại biên bản = Mất`, hệ thống tự gợi ý `Khoản thu = 50.000 đ`; sau khi bấm *Lập biên bản*, thẻ chuyển sang *Mất / hỏng* và biên bản mới xuất hiện đầu danh sách. |
| **AC-BC1-7.12-02** | Khi nhập mã thẻ *Thuê bao tháng* đang ở trạng thái *Đang hoạt động* và chọn `Loại biên bản = Mất`, hệ thống báo lỗi yêu cầu khóa thẻ trước và từ chối lưu biên bản cho đến khi thẻ đã chuyển sang *Khóa*. |
| **AC-BC1-7.12-03** | Khi nhập *Số biên bản* trùng lặp, chọn *Ngày lập* ở tương lai, hoặc chọn thẻ đã ở trạng thái *Mất / hỏng*, hệ thống báo lỗi tương ứng và không tạo biên bản. |

---

## 8. BUSINESS RULES

| ID | Quy tắc nghiệp vụ |
| :--- | :--- |
| **BR01** | **Phân loại thẻ & kiểu thẻ:** Có 3 loại thẻ (*VIP*, *Thuê bao tháng*, *Vãng lai*); mỗi thẻ gắn một loại phương tiện (*Ô tô*, *Xe máy*, *Xe đạp*). *Nhóm thuê bao* bắt buộc với thẻ Thuê bao tháng, không áp dụng cho VIP và Vãng lai. Kho thẻ chỉ quản lý 2 kiểu thẻ vật lý là *Thẻ Mifare* và *Thẻ Proximity*; *Thẻ UHF* dán trên xe không nhập kho mà khai báo bằng `Mã thẻ RFID` trong hồ sơ xe (*Danh sách xe*). |
| **BR02** | **Trạng thái thẻ:** Có 4 trạng thái lưu trữ: *Trong kho*, *Đang hoạt động*, *Khóa*, *Mất / hỏng*. *"Hết hạn"* không phải trạng thái lưu trữ mà là tình trạng tính toán tại ngày chốt: thẻ *Đang hoạt động* có ngày hết hiệu lực nhỏ hơn ngày chốt. Thẻ *Khóa* vẫn giữ trạng thái *Khóa* dù đã quá hạn. |
| **BR03** | **Phân nhóm tồn kho & lưu hành:** `Tồn kho = thẻ Trong kho`. `Đang lưu hành = thẻ Đang hoạt động + thẻ Khóa`. Thẻ *Mất / hỏng* không thuộc hai nhóm này. |
| **BR04** | **Lịch sử bất biến:** Mọi lần chuyển trạng thái hoặc chỉnh sửa thông tin thẻ đều được ghi lại kèm người thực hiện, thời điểm, kho bãi và lý do; không cho sửa hay xóa. Bản ghi nhập nhầm được đánh dấu *"Hủy do nhập sai"* và bị loại khỏi mọi số liệu báo cáo. |
| **BR05** | **Cách đếm phát sinh:** Các chỉ tiêu *Nhập mới*, *Cấp ra*, *Thu hồi*, *Mất / hỏng* trong kỳ báo cáo được đếm theo **số lần thẻ chuyển trạng thái** (một thẻ có thể phát sinh nhiều lượt trong cùng kỳ). |
| **BR06** | **Quản lý thẻ theo kho bãi:** Thẻ nhập vào kho bãi nào thì thuộc kho bãi đó; tồn kho và phát sinh được theo dõi tại từng kho bãi và tự động cộng gộp lên khu đô thị (§4.3). Không điều chuyển thẻ chéo giữa các khu đô thị. Với thuê bao áp dụng nhiều bãi trong cùng khu đô thị, thẻ được xuất từ kho của một trong các bãi đang áp dụng và dùng chung tại các bãi đó; khi thu hồi đạt kiểm tra, thẻ quay về đúng kho bãi đã xuất. |
| **BR07** | **Đổi loại thẻ / loại phương tiện:** Chỉ cho phép đổi *Loại thẻ* hoặc *Loại phương tiện* khi thẻ đang ở trạng thái *Trong kho* và chưa gắn thuê bao. Trên báo cáo, số liệu của thẻ được tính theo phân loại tại ngày chốt; việc đổi phân loại trong kho không tính là cấp ra hay thu về. |
| **BR08** | **Quy tắc gắn phương tiện cho thuê bao:** *Thuê bao tháng* gắn đúng 1 xe (hoặc chọn *Xe không có biển số* nếu dịch vụ hỗ trợ). *Thuê bao VIP* đăng ký 1–10 biển số cùng loại phương tiện hoặc *Không giới hạn biển số* (nếu dịch vụ hỗ trợ); mỗi lượt qua làn sử dụng 1 xe và làn không cảnh báo sai biển số cho thẻ VIP. Tại một thời điểm, một xe đang hoạt động chỉ thuộc tối đa **1 thuê bao đang hoạt động** (không đồng thời thuộc Thuê bao tháng và VIP, không trùng 2 thuê bao cùng loại). |
| **BR09** | **Điều kiện hồ sơ khi đăng ký thuê bao:** Nhóm *Cư dân* bắt buộc có Căn hộ trong hồ sơ Khách hàng; nhóm *Gian hàng* bắt buộc có Số hợp đồng và Hạn hợp đồng còn hiệu lực trong hồ sơ Khách hàng; dịch vụ bắt buộc thẻ / khuôn mặt / RFID phải có đủ phương tiện nhận diện tương ứng. |
| **BR10** | **Cảnh báo Sắp hết hạn:** Thẻ *Đang hoạt động* còn từ `0` đến `P-01` ngày là hết hiệu lực tính tại ngày chốt (thẻ hết hạn đúng ngày chốt vẫn bị cảnh báo; thẻ không giới hạn thời hạn không bao giờ bị cảnh báo). |
| **BR11** | **Vượt định mức mất / hỏng:** Khu đô thị bị đánh dấu vượt định mức khi tỷ lệ mất / hỏng (`C-14`) **lớn hơn** `P-02`; bằng đúng định mức vẫn được coi là đạt định mức. |
| **BR12** | **Cảnh báo Không khớp thông tin:** Thẻ thuê bao *Đang hoạt động* có ít nhất một lý do: (a) biển số camera đọc khác biển số đăng ký (so sánh sau khi viết hoa và bỏ dấu `.`, `-`, khoảng trắng; bỏ qua lượt camera không đọc được); (b) thiếu biển số đăng ký; (c) gian hàng hết hạn hợp đồng tại ngày chốt; (d) thẻ nhóm Cư dân chưa gắn căn hộ. |
| **BR13** | **Cảnh báo Cấp nhưng không sử dụng:** Thẻ thuê bao hoặc VIP *Đang hoạt động* mà khoảng thời gian từ mốc muộn hơn giữa *(lượt xe gần nhất; ngày cấp / cấp lại gần nhất)* đến ngày chốt đạt từ `P-03` ngày trở lên. Không áp dụng cho thẻ Vãng lai. |
| **BR14** | **Quy tắc đếm cảnh báo:** Một thẻ có thể đồng thời mắc nhiều cảnh báo; mỗi nhóm cảnh báo đếm số thẻ duy nhất; ngưỡng cảnh báo áp dụng theo cấu hình của khu đô thị quản lý thẻ tại ngày chốt. |
| **BR15** | **Tổng hợp số liệu báo cáo:** Hệ thống tổng hợp số liệu định kỳ mỗi đêm cho ngày hôm trước và tính lại 7 ngày gần nhất theo thời điểm quẹt thẻ thực tế. |
| **BR16** | **Múi giờ & giới hạn kỳ báo cáo:** Dùng giờ Việt Nam (GMT+7); kỳ báo cáo tính từ `00:00:00` ngày đầu đến `23:59:59` ngày cuối, tối đa `31` ngày (01 tháng). |
| **BR17** | **Tính tỷ lệ dòng tổng & phân quyền:** Tỷ lệ ở dòng tổng được tính lại từ tổng tử số chia tổng mẫu số (không lấy trung bình cộng các tỷ lệ); nếu mẫu số bằng `0` thì hiển thị `"—"`. Nếu người dùng chỉ có quyền xem một số khu đô thị, dòng tổng ghi *"Tổng trong phạm vi quyền"*. |
| **BR18** | **Kiểm soát cấp lại & kết thúc vòng đời thẻ:** Trước khi cấp lại thẻ mới cho thuê bao đang có thẻ lưu hành (hoặc chuyển thẻ sang thuê bao khác), bắt buộc phải thu hồi thẻ cũ (kèm xác nhận kiểm tra vật lý tại O5) hoặc lập biên bản mất / hỏng trước; khóa thẻ đơn thuần chưa giải phóng thẻ cũ. Tạm ngừng hoặc hủy thuê bao không tự động thu hồi thẻ về kho. Thẻ *Mất / hỏng* là trạng thái kết thúc, không thể khôi phục. |
| **BR19** | **Quy ước cấp phát thẻ vãng lai:** Với thẻ Vãng lai, lượt *Cấp ra* được ghi nhận khi BQL bàn giao thẻ từ kho cho bàn thẻ của bãi (O4). Việc phát thẻ cho khách tại làn vào và thu lại tại làn ra không làm thay đổi trạng thái thẻ. Nếu khách làm mất thẻ, BPAN lập biên bản (O6) để chuyển thẻ sang *Mất / hỏng*. |

---

## 9. FUNCTIONAL REQUIREMENTS

| ID | Yêu cầu chức năng | Phân hệ | Ưu tiên |
| :--- | :--- | :--- | :--- |
| **FR01** | Dashboard Báo cáo quản lý thẻ – khối `01 / BIẾN ĐỘNG` & modal *Chi tiết biến động kho thẻ* (M1); số liệu mọi dòng kho bãi, khu đô thị và Tổng cộng khớp công thức đối chiếu (§7.1). | Báo cáo | Must |
| **FR02** | Khối `02 / CƠ CẤU` & modal *Chi tiết cơ cấu thẻ lưu hành* (M2); tổng lưu hành khớp chỉ tiêu *Thẻ lưu hành cuối kỳ* của M1 (§7.2). | Báo cáo | Must |
| **FR03** | Khối `03 / CẢNH BÁO` & modal *Chi tiết cảnh báo thẻ* (M3) với 3 nhóm cảnh báo theo BR10, BR12, BR13 (§7.3). | Báo cáo | Must |
| **FR04** | Tra cứu thẻ theo số liệu báo cáo (O5): hỗ trợ 3 chế độ xem (*Trạng thái hiện tại*, *Tại ngày chốt*, *Theo biến động*), 9 bộ lọc chọn nhiều (gồm *Kiểu thẻ*, *Nhóm thuê bao*), tùy chỉnh cột theo từng chế độ và popup *Thông tin thẻ* 2 tab kèm nút *Xem thẻ hiện tại* (§7.4). | Báo cáo | Must |
| **FR05** | Mọi con số lớn hơn 0 trên thẻ KPI, biểu đồ và modal chi tiết của M1 – M3 đều liên kết mở đúng danh sách tại O5; nút *Quay lại báo cáo* khôi phục nguyên bộ lọc Dashboard. | Báo cáo | Must |
| **FR06** | Xuất Excel (`.xlsx`): báo cáo tổng hợp mẫu 4.1 từ Dashboard; danh sách thẻ từ O5 (đầy đủ cột mở rộng) và danh sách vận hành từ O1, O2, O4, O6 (§7.5). | Báo cáo | Must |
| **FR07** | Phân quyền theo khu đô thị; tách riêng các quyền: xem chi tiết thẻ, xem số điện thoại đầy đủ, xuất Excel và sửa tham số cảnh báo. | Báo cáo | Must |
| **FR08** | Ghi nhật ký truy vết mọi lần xem báo cáo, xuất file và sửa tham số (người thực hiện, thời điểm, bộ lọc hoặc giá trị cũ – mới). | Báo cáo | Must |
| **FR09** | Màn *Tham số báo cáo thẻ xe* (M5) hỗ trợ ngày bắt đầu áp dụng và lịch sử thay đổi theo từng khu đô thị (§7.6). | Báo cáo | Should |
| **FR10** | Tổng hợp số liệu tự động mỗi đêm (sẵn sàng trước `06:00`), tính lại 7 ngày gần nhất, tự đối chiếu công thức và cảnh báo IT nếu phát hiện sai lệch. | Báo cáo | Must |
| **FR11** | Hiển thị rõ ràng các trạng thái màn hình (đang tải, chưa áp dụng bộ lọc, không có dữ liệu, thông báo lỗi) trên toàn bộ màn hình báo cáo và vận hành. | Báo cáo | Must |
| **FR12** | Theo dõi tồn kho tức thời theo bãi (O1); tra cứu vận hành, **chỉnh sửa thông tin thẻ** (mã hai mặt, kiểu thẻ, đơn vị, mô tả; đổi loại thẻ / phương tiện khi Trong kho), khóa / mở khóa và ghi lịch sử bất biến (O5, §7.7, §7.11). | Quản lý thẻ | Must |
| **FR13** | Nhập kho thẻ 2 bước hỗ trợ cả **Nhập trực tiếp** (≤ 100 dòng) và **Nhập từ Excel** (`.xlsx`/`.xls`, ≤ 10.000 dòng), khai báo mã hai mặt & kiểu thẻ Mifare/Proximity, kiểm tra trùng mã và tải danh sách lỗi (O2, §7.8). | Quản lý thẻ | Must |
| **FR14** | Quản lý **Danh sách thuê bao** (O3) liên kết với Khách hàng, Danh sách xe, Danh sách dịch vụ: đăng ký nhiều bãi, kiểm tra chế độ kiểm soát (thẻ Proximity/Mifare, UHF/RFID, khuôn mặt, biển số), cấp / cấp lại thẻ, thay đổi trạng thái thuê bao; giao thẻ vãng lai (O4) và thu hồi kèm kiểm tra vật lý bắt buộc (O5) (§7.9 – §7.11). | Quản lý thẻ & Thuê bao | Must |
| **FR15** | Dữ liệu lượt xe qua làn lưu đầy đủ số thẻ, biển số camera đọc và thời điểm quẹt thực tế (D-04). | Làn xe / App | Must |
| **FR16** | Nhập số dư đầu kỳ của từng thẻ theo kết quả kiểm kê trước ngày go-live (D-08). | Quản lý thẻ | Must |
| **FR17** | Lập và quản lý biên bản mất / hỏng (O6): số biên bản, loại, ngày lập, gợi ý khoản thu tự động và chặn báo mất thẻ thuê bao/VIP chưa khóa (§7.12). | Quản lý thẻ | Must |

---

## 10. CHỈ TIÊU VÀ THAM SỐ

### 10.1 Chỉ tiêu và cách tính

| Mã | Chỉ tiêu | Cách tính |
| :--- | :--- | :--- |
| **C-01 / C-07** | Tồn kho đầu kỳ / cuối kỳ | Số thẻ ở trạng thái *Trong kho* tại `00:00:00` ngày đầu kỳ / `23:59:59` ngày cuối kỳ. |
| **C-02 / C-08** | Lưu hành đầu kỳ / cuối kỳ (Đang lưu hành) | Số thẻ ở trạng thái *Đang hoạt động* hoặc *Khóa* tại các mốc trên hoặc tại ngày chốt. |
| **C-03, C-04, C-05** | Nhập mới, Cấp ra, Thu về | Số lượt nhập kho; số lượt chuyển `Trong kho → Đang hoạt động`; số lượt chuyển `Đang hoạt động / Khóa → Trong kho` trong kỳ. |
| **C-06** | Mất / hỏng | Số lượt chuyển sang *Mất / hỏng* trong kỳ (tách theo Mất / Hỏng và phát sinh trong kho / khi đang lưu hành). |
| **C-09** | Tổng số thẻ | `C-07 + C-08` |
| **C-10, C-11, C-12** | Đang hoạt động, Khóa, Hết hạn | Thẻ *Đang hoạt động* còn hiệu lực (hoặc không giới hạn thời hạn); thẻ *Khóa*; thẻ *Đang hoạt động* đã quá ngày hết hiệu lực. |
| **C-13, C-14** | Tỷ lệ sử dụng, Tỷ lệ mất / hỏng | `C-10 ÷ C-09` ; `C-06 ÷ (C-01 + C-02)` |
| **C-15, C-16** | Tỷ lệ hoạt động, Tỷ trọng | `C-10 ÷ C-08` ; `C-08 của dòng ÷ C-08 của dòng cấp trên` |

**Công thức đối chiếu số liệu (hệ thống tự kiểm tra mỗi đêm):**
- **Tồn kho** *(từng bãi xe và toàn khu đô thị)*:  
  `Tồn kho cuối kỳ = Tồn kho đầu kỳ + Nhập mới + Thu về − Cấp ra − Mất / hỏng trong kho`
- **Thẻ lưu hành** *(từng bãi xe và toàn khu đô thị)*:  
  `Lưu hành cuối kỳ = Lưu hành đầu kỳ + Cấp ra − Thu về − Mất / hỏng khi đang lưu hành`

*Ví dụ minh họa (Vinhomes Ocean Park):* Tồn kho `60 + 20 + 15 − 80 − 1 = 14`; Lưu hành `740 + 80 − 15 − 3 = 802` (riêng *Hầm B1 – S1*: tồn kho `12 + 20 + 6 − 32 − 1 = 5`; lưu hành `300 + 32 − 6 − 1 = 325`).  
*Lưu ý:* Công thức đối chiếu chỉ đảm bảo chính xác trong mọi trường hợp khi phát sinh được đếm theo **số lần chuyển trạng thái** (BR05). Nếu đếm theo số thẻ duy nhất, một thẻ được cấp – thu – cấp lại trong cùng kỳ sẽ làm kết quả lệch 1 thẻ.

### 10.2 Tham số cảnh báo

| Mã | Tham số | Mặc định | Giới hạn | Áp dụng cho |
| :--- | :--- | :--- | :--- | :--- |
| **P-01** | Ngưỡng sắp hết hạn | `7` ngày | `1 – 90` ngày | Cảnh báo Sắp hết hạn (BR10) |
| **P-02** | Định mức mất / hỏng | `5%` | `0 – 100%` (tối đa 2 chữ số thập phân) | Đánh dấu vượt định mức tại M1 (BR11) |
| **P-03** | Số ngày không sử dụng | `30` ngày | `1 – 365` ngày | Cảnh báo Cấp nhưng không sử dụng (BR13) |
