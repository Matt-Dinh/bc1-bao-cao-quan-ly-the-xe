import { cardTypes, demoCardMetadata, today, vehicles } from "./data"
import { applyOperation } from "./operations-model"
import type { OperationState } from "./operations-model"
import {
  changeSubscriberState, directoryOf, managementParks, saveManagedCustomer, saveManagedService, saveManagedVehicle, saveSubscriberRegistration,
} from "./subscription-model"
import type { ManagedService, SubscriberInput } from "./subscription-model"
import { cardTechnologies, energyOptions, vehicleVariantLabel } from "./vehicle-energy"

/**
 * Demo records for the prototype screens (Danh sách thuê bao / xe / dịch vụ / khách hàng).
 * Every record is created through the same model functions the forms use, so it obeys every
 * current rule. Kept out of seedOperations() so model tests keep their fixed seed.
 */
const FACE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
const PARK = { s1: "A:0", s2: "A:1", out: "A:2" } as const

export function withDemoScenarios(seed: OperationState): OperationState {
  try {
    return addDemoScenarios(seed)
  } catch (error) {
    // Demo data must never block the app; the console names the rule that rejected it.
    console.warn("Không tạo được dữ liệu mẫu bổ sung:", error)
    return seed
  }
}

export function addDemoScenarios(seed: OperationState): OperationState {
  let state = seed
  // 1. Stock for the demo: Proximity/Mifare cards only (UHF tags are never stocked).
  const lots: [string, string, string, string[]][] = [
    ["PN-DEMO-OTO-TB", "Thuê bao tháng", "Ô tô", ["DM-OT-01", "DM-OT-02", "DM-OT-03", "DM-OT-04"]],
    ["PN-DEMO-OTO-VIP", "VIP", "Ô tô", ["DM-VIP-01", "DM-VIP-02"]],
    ["PN-DEMO-XM-TB", "Thuê bao tháng", "Xe máy", ["DM-XM-01", "DM-XM-02", "DM-XM-03", "DM-XM-04", "DM-XM-05"]],
    ["PN-DEMO-XD-TB", "Thuê bao tháng", "Xe đạp", ["DM-XD-01", "DM-XD-02"]],
  ]
  let code = 0
  for (const [id, type, vehicle, ids] of lots)
    state = applyOperation(state, {
      kind: "import", type, vehicle,
      lot: { id, estate: "A", park: "Hầm B1 – S1", supplier: "Dữ liệu mẫu", date: today, ids },
      details: ids.map((cardId) => ({ id: cardId, frontCode: `DM${String(++code).padStart(4, "0")}F`, rearCode: `DM${String(code).padStart(4, "0")}R`, technology: code % 2 ? "Thẻ Mifare" : "Thẻ Proximity" })),
    })

  // 2. Share the complete demo service catalog across all nine parking lots.
  const base = directoryOf(state).services.find((s) => s.id === "DV-TB-1")!
  const all = managementParks.map(park => park.id)
  const service = (name: string, vehicle: string, control: string, extra: Partial<ManagedService> = {}) => {
    state = saveManagedService(state, { ...base, prices: undefined, id: "", name, vehicle, control, parkIds: all, note: "Dữ liệu mẫu", ...extra })
    return directoryOf(state).services[0].id
  }
  const svc = {
    vipFlex: service("Ô tô VIP linh hoạt", "Ô tô", "Biển số hoặc Thẻ", { price: 3000000 }),
    eBike: service("Xe đạp điện không biển", "Xe đạp", "Biển số hoặc Thẻ", { energy: "Điện", price: 80000 }),
    eMotoNoPlate: service("Xe máy điện không biển", "Xe máy", "Biển số hoặc Thẻ", { energy: "Điện", price: 100000 }),
    staffFace: service("Ô tô CBNV khuôn mặt", "Ô tô", "Biển số và Khuôn mặt", { price: 0, pricing: "Miễn phí" }),
    residentFace: service("Ô tô cư dân khuôn mặt", "Ô tô", "Biển số và Khuôn mặt", { price: 1200000 }),
    uhfPlate: service("Ô tô UHF dán xe", "Ô tô", "Biển số và Thẻ UHF", { price: 1300000 }),
    uhfOnly: service("Ô tô UHF tự động", "Ô tô", "UHF", { price: 1000000 }),
    bikeUhf: service("Xe máy UHF hoặc biển số", "Xe máy", "UHF hoặc Biển số", { price: 150000 }),
    bikeFace: service("Xe máy thẻ + khuôn mặt", "Xe máy", "Biển số và Thẻ và Khuôn mặt", { price: 130000 }),
    carFaceOrUhf: service("Ô tô khuôn mặt hoặc UHF", "Ô tô", "(Biển số và Khuôn mặt) hoặc (Biển số và UHF)", { price: 1250000 }),
    carUhfOrFace: service("Ô tô UHF hoặc biển số + khuôn mặt", "Ô tô", "UHF hoặc (Biển số và Khuôn mặt)", { price: 1100000 }),
    carUhfFace: service("Ô tô UHF + khuôn mặt", "Ô tô", "UHF và Khuôn mặt", { price: 1400000 }),
    bikeCardOrFace: service("Xe máy thẻ hoặc khuôn mặt", "Xe máy", "(Biển số và Thẻ) hoặc (Biển số và Khuôn mặt)", { price: 140000 }),
    bikePlate: service("Xe máy chỉ biển số", "Xe máy", "Biển số", { price: 100000 }),
    eventPlate: service("Xe sự kiện chỉ biển số", "Ô tô", "Biển số", { pricing: "Miễn phí", price: 0, note: "Xe bus/xe khách phục vụ sự kiện, đăng ký trước biển số" }),
  }
  service("Xe đạp nhận diện khuôn mặt", "Xe đạp", "Khuôn mặt", { price: 50000 })
  service("Ô tô mở tay (sự cố đầu đọc)", "Ô tô", "Mở tay", { price: 0, pricing: "Miễn phí", active: false })
  service("Vãng lai QR + khuôn mặt", "Ô tô", "QRCODE và Khuôn mặt", { category: "Vãng lai", pricing: "Theo lượt", price: 30000 })
  service("Vãng lai xe máy biển số", "Xe máy", "Biển số", { category: "Vãng lai", pricing: "Theo lượt", price: 5000 })
  service("Xe đạp miễn kiểm soát", "Xe đạp", "Không", { category: "Vãng lai", pricing: "Miễn phí", price: 0 })

  // Keep the stopped-service example, plus an active manual-control package.
  service("Ô tô mở tay", "Ô tô", "Mở tay", { price: 0, pricing: "Miễn phí" })
  // Specific normal/electric packages let every lot demonstrate separate vehicle pricing.
  for (const vehicle of ["Ô tô", "Xe máy", "Xe đạp"]) {
    for (const energy of energyOptions(vehicle)) {
      const label = vehicleVariantLabel(vehicle, energy).toLocaleLowerCase("vi")
      const electric = energy === "Điện"
      const monthlyPrice = vehicle === "Ô tô" ? (electric ? 1000000 : 1200000)
        : vehicle === "Xe máy" ? (electric ? 100000 : 120000) : (electric ? 80000 : 60000)
      const visitorPrice = vehicle === "Ô tô" ? (electric ? 20000 : 30000)
        : vehicle === "Xe máy" ? (electric ? 4000 : 5000) : (electric ? 3000 : 2000)
      service(`Gói thuê bao ${label}`, vehicle, vehicle === "Xe đạp" ? "Biển số hoặc Thẻ" : "Biển số và Thẻ",
        { energy, price: monthlyPrice })
      service(`Vãng lai ${label}`, vehicle, "Biển số hoặc Thẻ",
        { energy, category: "Vãng lai", pricing: "Theo lượt", price: visitorPrice })
    }
  }

  // 3. Customers and vehicles.
  const customer = (name: string, apartment: string, phone: string, extra: Record<string, unknown> = {}) => {
    state = saveManagedCustomer(state, {
      id: "", estate: "A", name, group: "Cư dân", unitId: "BQL-A", block: apartment.split("-")[0], phone, email: "", identity: "", apartment, address: "",
      active: true, source: "Hệ thống", note: "Dữ liệu mẫu", ...extra,
    })
    return directoryOf(state).customers[0].id
  }
  const vehicle = (plate: string, kind: string, energy: string, brand: string, color: string, extra: Record<string, unknown> = {}) => {
    state = saveManagedVehicle(state, { id: "", estate: "A", plate, vehicle: kind, energy, brand, color, active: true, note: "Dữ liệu mẫu", ...extra })
    return directoryOf(state).vehicles[0].id
  }
  const face = [{ angle: "CENTER", src: FACE }]
  const c = {
    vip: customer("Nguyễn Văn An", "S1.01-2501", "0901000001"),
    vipSpouse: customer("Trịnh Mai Anh", "S1.01-2501", "0901000011"),
    vipAny: customer("Trần Thị Bích", "S1.02-1802", "0901000002"),
    eBike: customer("Lê Minh Châu", "S1.03-0903", "0901000003"),
    staff: customer("Phạm Quốc Dũng", "S1.05-0101", "0901000004", { faces: face, group: "CBNV BQL", note: "CBNV BQL tòa S1.05" }),
    twoCars: customer("Hoàng Thu Hà", "S1.06-1206", "0901000005"),
    bike: customer("Vũ Đức Em", "S1.07-0707", "0901000006"),
    uhf: customer("Đặng Văn Phúc", "S1.08-1508", "0901000007"),
    both: customer("Bùi Thị Giang", "S1.09-2009", "0901000008"),
    bikeUhf: customer("Ngô Thanh Hải", "S2.01-0611", "0901000009"),
    bikeFace: customer("Đỗ Thị Hương", "S2.02-1012", "0901000010", { faces: face }),
    residentFace: customer("Mai Thanh Tùng", "S1.1-1508", "0901000013", { faces: face }),
    eventOrganizer: customer("Công ty Sự kiện Ánh Dương", "S1.1", "0243999888", { apartment: "", group: "Nhà cung cấp dịch vụ", address: "Hà Nội", note: "Đơn vị tổ chức sự kiện" }),
    carAndMoto: customer("Đinh Công Minh", "S1.2-1212", "0935777888"),
    shopStaff: customer("Lương Thị Thu", "S1.2", "0912333444", { apartment: "", group: "Gian hàng", note: "Nhân viên gian hàng S1.2-SH03" }),
    eMoto: customer("Hồ Thị Phương", "S1.3-1103", "0988555666"),
    moved: customer("Lý Văn Khánh", "S2.03-0313", "0901000012", { active: false, note: "Đã chuyển đi" }),
  }
  const v = {
    vip1: vehicle("30A-246.80", "Ô tô", "Xăng/dầu", "Mercedes-Benz", "Đen"),
    vip2: vehicle("30A-678.90", "Ô tô", "Điện", "VinFast", "Trắng"),
    staff: vehicle("29A-456.78", "Ô tô", "Xăng/dầu", "Toyota", "Bạc"),
    car: vehicle("35A-147.86", "Ô tô", "Xăng/dầu", "Mazda", "Đỏ"),
    moto: vehicle("14B1-478.56", "Xe máy", "Xăng/dầu", "Honda", "Đen"),
    uhf: vehicle("30H-777.77", "Ô tô", "Xăng/dầu", "Toyota", "Trắng"),
    both: vehicle("30K-888.88", "Ô tô", "Điện", "VinFast", "Xanh"),
    bikeUhf: vehicle("29B1-234.56", "Xe máy", "Điện", "VinFast", "Xám"),
    bikeFace: vehicle("29C1-345.67", "Xe máy", "Xăng/dầu", "Yamaha", "Xanh"),
    residentFace: vehicle("30G-246.13", "Ô tô", "Xăng/dầu", "Kia", "Xám"),
    bus1: vehicle("29B-123.45", "Ô tô", "Xăng/dầu", "Hyundai", "Trắng", { note: "Xe bus sự kiện, có dán tem UHF" }),
    bus2: vehicle("29B-123.46", "Ô tô", "Xăng/dầu", "Hyundai", "Trắng", { note: "Xe bus sự kiện, có dán tem UHF" }),
    bus3: vehicle("29B-123.47", "Ô tô", "Xăng/dầu", "Thaco", "Xanh", { note: "Xe bus sự kiện, có dán tem UHF" }),
    minhCar: vehicle("30L-135.79", "Ô tô", "Xăng/dầu", "Toyota", "Trắng"),
    minhMoto: vehicle("29H1-246.80", "Xe máy", "Xăng/dầu", "Honda", "Đen"),
    shopMoto: vehicle("29K1-357.91", "Xe máy", "Xăng/dầu", "Yamaha", "Đỏ"),
    moved: vehicle("30E-111.22", "Ô tô", "Xăng/dầu", "Hyundai", "Bạc", { active: false, note: "Xe đã bán" }),
  }

  // 4. Subscriptions, one per case.
  const reg = (input: Partial<SubscriberInput> & Pick<SubscriberInput, "customerId" | "vehicle" | "lots">) => {
    state = saveSubscriberRegistration(state, {
      id: "", estate: "A", members: [], vehicleIds: [], noPlate: false, anyPlate: false, status: "Đang hoạt động",
      type: "Thuê bao tháng", group: "Cư dân", contract: "", contractEnd: "", from: today, to: "2026-12-31", note: "Dữ liệu mẫu",
      cardId: "", cardParkId: PARK.s1, cardReason: "", ...input,
    })
    return state.subscriptions[0].id
  }
  const lot = (parkId: string, serviceId: string) => ({ parkId, serviceId, active: true })
  // VIP, two cars, three parks, a family member.
  reg({ customerId: c.vip, members: [c.vipSpouse], vehicle: "Ô tô", vehicleIds: [v.vip1, v.vip2], type: "VIP", to: "", contract: "HĐ-VIP-2026-01",
    lots: [lot(PARK.s1, svc.vipFlex), lot(PARK.s2, svc.vipFlex), lot(PARK.out, svc.vipFlex)], cardId: "DM-VIP-01" })
  // VIP without plate restriction: identified by the VIP card.
  reg({ customerId: c.vipAny, vehicle: "Ô tô", anyPlate: true, type: "VIP", to: "", lots: [lot(PARK.s1, svc.vipFlex), lot(PARK.s2, svc.vipFlex)], cardId: "DM-VIP-02" })
  // Electric bicycle without plate, monthly card.
  reg({ customerId: c.eBike, vehicle: "Xe đạp", noPlate: true, energy: "Điện", lots: [lot(PARK.s1, svc.eBike)], cardId: "DM-XD-01" })
  // Staff: plate + face, no card required.
  reg({ customerId: c.staff, vehicle: "Ô tô", vehicleIds: [v.staff], group: "CBNV BQL", lots: [lot(PARK.s1, svc.staffFace)] })
  // Resident: plate + owner's face, the package uses no card.
  reg({ customerId: c.residentFace, vehicle: "Ô tô", vehicleIds: [v.residentFace], lots: [lot(PARK.s1, svc.residentFace), lot(PARK.s2, svc.residentFace)] })
  // Event buses: plate only, one short subscription per bus, no card.
  for (const bus of [v.bus1, v.bus2, v.bus3])
    reg({ customerId: c.eventOrganizer, vehicle: "Ô tô", vehicleIds: [bus], from: "2026-11-05", to: "2026-11-06", note: "Dữ liệu mẫu", lots: [lot(PARK.out, svc.eventPlate)] })
  // Case 12: a resident with a plate-only car and a card + plate motorbike, two subscriptions.
  reg({ customerId: c.carAndMoto, vehicle: "Ô tô", vehicleIds: [v.minhCar], lots: [lot(PARK.s1, svc.eventPlate)] })
  reg({ customerId: c.carAndMoto, vehicle: "Xe máy", vehicleIds: [v.minhMoto], lots: [lot(PARK.s1, "DV-TB-2")], cardId: "DM-XM-03" })
  // Shop employee: motorbike with card + plate, the shop contract is required.
  reg({ customerId: c.shopStaff, vehicle: "Xe máy", vehicleIds: [v.shopMoto], group: "Gian hàng", contract: "HĐ-GH-S1.2-03", contractEnd: "2027-06-30",
    lots: [lot(PARK.s1, "DV-TB-2")], cardId: "DM-XM-04" })
  // Resident electric motorbike without a plate: identified by the card only.
  reg({ customerId: c.eMoto, vehicle: "Xe máy", noPlate: true, energy: "Điện", lots: [lot(PARK.s1, svc.eMotoNoPlate)], cardId: "DM-XM-05" })
  // One customer, a car and a motorbike: two separate subscriptions.
  reg({ customerId: c.twoCars, vehicle: "Ô tô", vehicleIds: [v.car], lots: [lot(PARK.s1, "DV-TB-1")], cardId: "DM-OT-01" })
  reg({ customerId: c.twoCars, vehicle: "Xe máy", vehicleIds: [v.moto], lots: [lot(PARK.s1, "DV-TB-2")], cardId: "DM-XM-01" })
  // Bicycle without plate, Mifare card.
  reg({ customerId: c.bike, vehicle: "Xe đạp", noPlate: true, energy: "Không động cơ", lots: [lot(PARK.s1, "DV-TB-3")], cardId: "DM-XD-02" })
  // Car with a UHF tag stuck on the windscreen.
  reg({ customerId: c.uhf, vehicle: "Ô tô", vehicleIds: [v.uhf], lots: [lot(PARK.s1, svc.uhfPlate), lot(PARK.s2, svc.uhfPlate)], uhfCode: "E28011606000020777", uhfLabel: "UHF-30H77777" })
  // Mifare card in B1-S1 plus UHF tag outdoors.
  reg({ customerId: c.both, vehicle: "Ô tô", vehicleIds: [v.both], lots: [lot(PARK.s1, "DV-TB-1"), lot(PARK.out, svc.uhfOnly)], cardId: "DM-OT-02", uhfCode: "E28011606000020888", uhfLabel: "UHF-30K88888" })
  // Motorbike: UHF or plate, the tag is optional.
  reg({ customerId: c.bikeUhf, vehicle: "Xe máy", vehicleIds: [v.bikeUhf], lots: [lot(PARK.s2, svc.bikeUhf)], uhfCode: "E28011606000023456" })
  // Motorbike: plate + card + face.
  reg({ customerId: c.bikeFace, vehicle: "Xe máy", vehicleIds: [v.bikeFace], lots: [lot(PARK.s1, svc.bikeFace)], cardId: "DM-XM-02" })
  // Cancelled subscription of a customer who moved out (vehicle kept for history).
  state = saveManagedVehicle(state, { ...directoryOf(state).vehicles.find((x) => x.id === v.moved)!, active: true })
  state = saveManagedCustomer(state, { ...directoryOf(state).customers.find((x) => x.id === c.moved)!, active: true })
  const moved = reg({ customerId: c.moved, vehicle: "Ô tô", vehicleIds: [v.moved], lots: [lot(PARK.s1, "DV-TB-1")], cardId: "DM-OT-03" })
  state = applyOperation(state, { kind: "return", cardId: "DM-OT-03", checked: true, result: "pass", reason: "Khách chuyển đi, thu hồi thẻ" })
  state = changeSubscriberState(state, moved, "Đã hủy", "Khách chuyển đi, đã thu hồi thẻ")
  state = saveManagedVehicle(state, { ...directoryOf(state).vehicles.find((x) => x.id === v.moved)!, active: false })
  state = saveManagedCustomer(state, { ...directoryOf(state).customers.find((x) => x.id === c.moved)!, active: false })
  // 5. Reserve stock at every park, for every card kind and main vehicle group.
  // Two cards of each stock technology keep the demo usable after several allocations.
  const stockMetadata = new Map<string, ReturnType<typeof demoCardMetadata>>()
  let stockSerial = 200000
  const typeCodes: Record<string, string> = { "VIP": "VIP", "Thuê bao tháng": "TB", "Vãng lai": "VL" }
  const vehicleCodes: Record<string, string> = { "Ô tô": "OT", "Xe máy": "XM", "Xe đạp": "XD" }
  for (const park of managementParks) {
    for (const type of cardTypes) {
      for (const vehicle of vehicles) {
        const suffix = `${park.id.replace(":", "")}-${vehicleCodes[vehicle]}-${typeCodes[type]}`
        const details = Array.from({ length: cardTechnologies.length * 2 }, (_, index) => {
          const id = `DM-${suffix}-${String(index + 1).padStart(2, "0")}`
          const metadata = demoCardMetadata(id, park.estate, ++stockSerial, today, today, index % cardTechnologies.length)
          stockMetadata.set(id, metadata)
          return { id, frontCode: metadata.frontCode, rearCode: metadata.rearCode, technology: metadata.technology }
        })
        state = applyOperation(state, {
          kind: "import", type, vehicle, details,
          lot: { id: `PN-DEMO-${suffix}`, estate: park.estate, park: park.park, supplier: "Dữ liệu mẫu", date: today, ids: details.map(card => card.id) },
        })
      }
    }
  }
  // Enrich only the generated demo records; normal imports retain their own entered metadata.
  state = { ...state, cards: state.cards.map(card => stockMetadata.has(card.id) ? { ...card, ...stockMetadata.get(card.id) } : card) }

  return state
}
