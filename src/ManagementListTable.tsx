import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Copy, Pencil, Search, SlidersHorizontal } from "lucide-react"
import { Badge, Button } from "./ui"
import ColumnSettingsDrawer, { readColumnSelection } from "./ColumnSettingsDrawer"
import { date, estates, today } from "./data"
import type { Card } from "./data"
import type { OperationState } from "./operations-model"
import { lookupCardStatus } from "./report-model"
import {
  customerSubscriptionGroup, managementParks, profileUsesCard, managementUnits, subscriberCards, subscriberEnergies, subscriberRequiresCard,
  subscriptionCardState, subscriptionGroupWarnings, subscriptionIdentificationMissing, subscriptionPlateControlConflict,
} from "./subscription-model"
import type { ManagementScreen, SubscriptionDirectory } from "./subscription-model"
import { energyOptions, vehicleVariantLabel } from "./vehicle-energy"

const auditColumns = { createdBy: "Người tạo", createdAt: "Ngày tạo", updatedBy: "Người cập nhật", updatedAt: "Cập nhật cuối" }
const columns: Record<ManagementScreen, Record<string, string>> = {
  subscriptions: {
    id: "Mã thuê bao", owner: "Chủ thuê bao", customerId: "Mã khách hàng", phone: "Số điện thoại",
    group: "Nhóm thuê bao", vehicle: "Loại phương tiện", plate: "Biển số", estate: "Khu đô thị",
    parks: "Bãi xe", services: "Dịch vụ", lotStatus: "Trạng thái áp dụng bãi",
    from: "Hiệu lực từ", expiry: "Hiệu lực đến", status: "Trạng thái thuê bao", card: "Mã thẻ",
    cardStatus: "Trạng thái thẻ", issuance: "Tình trạng cấp thẻ", warnings: "Cảnh báo", note: "Ghi chú",
  },
  customers: {
    id: "Mã khách hàng", name: "Tên khách hàng", phone: "Số điện thoại", group: "Nhóm thuê bao", estate: "Khu đô thị",
    unit: "Đơn vị", block: "Tòa", apartment: "Căn hộ", status: "Trạng thái", linked: "Số thuê bao",
    face: "Khuôn mặt", source: "Nguồn", email: "Email", identity: "CCCD", address: "Địa chỉ", note: "Ghi chú", ...auditColumns,
  },
  vehicles: {
    id: "Mã xe", plate: "Biển số", estate: "Khu đô thị", vehicle: "Loại phương tiện", brand: "Hãng xe",
    color: "Màu xe", status: "Trạng thái", linked: "Số thuê bao", voucher: "Áp dụng voucher", note: "Ghi chú", ...auditColumns,
  },
  services: {
    id: "Mã dịch vụ", name: "Tên dịch vụ", estate: "Khu đô thị", parks: "Bãi xe áp dụng", vehicle: "Loại phương tiện",
    category: "Kiểu dịch vụ", control: "Chế độ kiểm soát", status: "Trạng thái", linked: "Số thuê bao",
    voucher: "Áp dụng voucher", note: "Ghi chú", ...auditColumns,
  },
}
const defaults: Record<ManagementScreen, string[]> = {
  subscriptions: ["id", "owner", "vehicle", "plate", "parks", "services", "expiry", "status", "card", "warnings"],
  customers: ["id", "name", "phone", "group", "estate", "block", "apartment", "status", "linked"],
  vehicles: ["id", "plate", "estate", "vehicle", "brand", "status", "linked"],
  services: ["id", "name", "estate", "parks", "vehicle", "category", "control", "status", "linked"],
}
const stateTone = (value: string) => value === "Đang hoạt động" ? "green" : value === "Đã hủy" ? "red" : value === "Hết hạn" ? "amber" : "neutral"
const variantLabel = (vehicle: string, energy?: string) => !energy || energy === "Chưa xác định" ? `${vehicle} (chưa phân loại)` : vehicleVariantLabel(vehicle, energy)
const estateName = (id: string) => estates.find(e => e.id === id)?.short || "—"
const timestamp = (value?: string) => value ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—"
const values = (items: ReactNode[]) => items.length ? <div className="sm-cell-values">{items.map((item, i) => <div key={i}>{item}</div>)}</div> : "—"

export default function ManagementListTable({ screen, state, directory, ids, heading, onDetail, onEdit, onIssue, onCopyService, onRelated, onCard }: {
  screen: ManagementScreen
  state: OperationState
  directory: SubscriptionDirectory
  ids: string[]
  heading?: ReactNode
  onDetail: (id: string) => void
  onEdit: (id: string) => void
  onIssue: (id: string) => void
  onCopyService: (id: string) => void
  onRelated: (kind: "customer" | "vehicle" | "service", id: string) => void
  onCard: (card: Card, subscriberId: string) => void
}) {
  const storageKey = `vparking:management-columns:${screen === "customers" ? "v2" : "v1"}:${screen}:Admin Local`
  const [shown, setShown] = useState(() => {
    let saved = readColumnSelection(storageKey)
    if (!saved && screen === "customers") {
      const legacy = readColumnSelection("vparking:management-columns:v1:customers:Admin Local")
      if (legacy) { saved = [...legacy]; if (!saved.includes("group")) saved.splice(Math.max(1, saved.indexOf("phone") + 1), 0, "group") }
    }
    const valid = saved?.filter(key => Object.keys(columns[screen]).includes(key))
    return valid ? [...new Set([...(valid.includes("id") ? [] : ["id"]), ...valid])] : defaults[screen]
  })
  const [showColumns, setShowColumns] = useState(false)
  const customers = useMemo(() => new Map(directory.customers.map(row => [row.id, row])), [directory])
  const vehicles = useMemo(() => new Map(directory.vehicles.map(row => [row.id, row])), [directory])
  const services = useMemo(() => new Map(directory.services.map(row => [row.id, row])), [directory])
  const profiles = useMemo(() => new Map(directory.profiles.map(row => [row.id, row])), [directory])
  const subscriptions = useMemo(() => new Map(state.subscriptions.map(row => [row.id, row])), [state.subscriptions])
  const cards = useMemo(() => subscriberCards(state), [state.cards, state.subscriptions])
  const relatedCount = (kind: "customer" | "vehicle" | "service", id: string) => directory.profiles.filter(profile =>
    kind === "customer" ? profile.customerId === id || profile.members.includes(id)
      : kind === "vehicle" ? profile.vehicleIds.includes(id) : profile.lots.some(lot => lot.serviceId === id)).length
  const link = (id: string, label = id) => <Button variant="link" onClick={() => onDetail(id)}>{label}</Button>
  const linked = (kind: "customer" | "vehicle" | "service", id: string) => <Button variant="link" onClick={() => onRelated(kind, id)}>{relatedCount(kind, id)}</Button>
  const activeBadge = (active: boolean) => <Badge tone={active ? "green" : "neutral"}>{active ? "Đang hoạt động" : "Ngừng hoạt động"}</Badge>

  function list(id: string, items: ReactNode[], noun: string) {
    return values([...items.slice(0, 2), ...(items.length > 2 ? [<Button variant="link" onClick={() => onDetail(id)}>+{items.length - 2} {noun} khác</Button>] : [])])
  }

  function rowCells(id: string): Record<string, ReactNode> {
    if (screen === "subscriptions") {
      const sub = subscriptions.get(id)!, profile = profiles.get(id)!, owner = customers.get(profile.customerId), card = cards.get(id)
      const data: Record<string, ReactNode> = {
        id: link(id), owner: owner?.name, customerId: profile.customerId, phone: owner?.phone,
        group: sub.group,
        vehicle: profile.anyPlate ? `${profile.vehicle} · mọi xe (VIP)` : values(subscriberEnergies(directory, profile).map(energy => variantLabel(profile.vehicle, energy))),
        plate: profile.anyPlate ? "Không giới hạn biển số" : profile.noPlate ? "Xe không có biển số" : list(id,profile.vehicleIds.map(vehicleId => vehicles.get(vehicleId)?.plate || "—"),"biển số"),
        estate: estateName(profile.estate),
        parks: list(id,profile.lots.map(lot => managementParks.find(park => park.id === lot.parkId)?.park || "—"),"bãi"),
        services: list(id,profile.lots.map(lot => services.get(lot.serviceId)?.name || "—"),"dịch vụ"),
        lotStatus: values(profile.lots.map(lot => lot.active ? "Đang áp dụng" : "Tạm ngừng")),
        from: date(sub.effectiveFrom), expiry: sub.expiry ? date(sub.expiry) : "Không giới hạn",
        status: <Badge tone={stateTone(profile.status)}>{profile.status}</Badge>,
        card: card ? <Button variant="link" onClick={() => onCard(card, id)}>{card.id}</Button> : "Chưa cấp thẻ",
        cardStatus: card ? <Badge tone={stateTone(lookupCardStatus(card, today))}>{lookupCardStatus(card, today)}</Badge> : "—",
        issuance: subscriptionCardState(sub, card, subscriberRequiresCard(directory, profile)),
        warnings: values([
          ...subscriptionGroupWarnings(state, id).map(warning=><Badge tone="amber">{warning}</Badge>),
          ...(subscriptionIdentificationMissing(state, id) ? [<Badge tone="amber">Thiếu nhận diện</Badge>] : []),
          ...(subscriptionPlateControlConflict(state, id) ? [<Badge tone="amber">Gói chưa phù hợp</Badge>] : []),
        ]), note: profile.note,
      }
      return data
    }
    const row = screen === "customers" ? customers.get(id)! : screen === "vehicles" ? vehicles.get(id)! : services.get(id)!
    const common: Record<string, ReactNode> = {
      id: link(id), status: activeBadge(row.active), note: row.note,
      createdAt: timestamp(row.createdAt), updatedAt: timestamp(row.updatedAt), createdBy: row.createdBy, updatedBy: row.updatedBy,
    }
    if (screen === "customers") {
      const customer = customers.get(id)!
      const data: Record<string, ReactNode> = {
        name: link(id, customer.name), phone: customer.phone, group: customerSubscriptionGroup(customer), estate: estateName(customer.estate),
        unit: managementUnits.find(unit => unit.id === customer.unitId)?.name, block: customer.block, apartment: customer.apartment,
        linked: linked("customer", id), face: customer.faces?.length ? `${customer.faces.length}/5 ảnh` : "Chưa có ảnh",
        source: customer.source, email: customer.email, identity: customer.identity, address: customer.address,
      }
      return {...common,...data}
    }
    if (screen === "vehicles") {
      const vehicle = vehicles.get(id)!
      const data: Record<string, ReactNode> = {
        plate: link(id, vehicle.plate), estate: estateName(vehicle.estate), vehicle: variantLabel(vehicle.vehicle, vehicle.energy),
        brand: vehicle.brand, color: vehicle.color, voucher: vehicle.useVoucher ? "Có" : "Không", linked: linked("vehicle", id),
      }
      return {...common,...data}
    }
    const service = services.get(id)!, parks = service.parkIds.map(parkId => managementParks.find(park => park.id === parkId)).filter(park => !!park)
    const data: Record<string, ReactNode> = {
      name: link(id, service.name), estate: values([...new Set(parks.map(park => estateName(park.estate)))]),
      parks: list(id,parks.map(park => park.park),"bãi"),
      vehicle: service.energy ? vehicleVariantLabel(service.vehicle, service.energy) : values(energyOptions(service.vehicle).map(energy => vehicleVariantLabel(service.vehicle, energy))),
      category: service.category, control: service.control, voucher: service.voucher ? "Có" : "Không", linked: linked("service", id),
    }
    return {...common,...data}
  }

  function actions(id: string) {
    if (screen === "subscriptions") {
      const sub = subscriptions.get(id)!, disabled = profiles.get(id)?.status === "Đã hủy"
      return <div className="sm-actions">
        <Button variant="ghost" aria-label={`Xem thuê bao ${id}`} onClick={() => onDetail(id)}>Chi tiết</Button>
        <Button variant="ghost" aria-label={`Chỉnh sửa thuê bao ${id}`} disabled={disabled} onClick={() => onEdit(id)}><Pencil size={14}/>Chỉnh sửa</Button>
        {profileUsesCard(directory, profiles.get(id)!) && <Button variant="ghost" disabled={disabled} onClick={() => onIssue(id)}>{sub.cardId ? "Cấp lại thẻ" : "Cấp thẻ"}</Button>}
      </div>
    }
    const label = screen === "customers" ? "khách hàng" : screen === "vehicles" ? "xe" : "dịch vụ"
    return <div className="sm-actions"><Button variant="ghost" aria-label={`Sửa ${label} ${id}`} onClick={() => onEdit(id)}><Pencil size={14}/></Button>
      {screen === "services" && <Button variant="ghost" aria-label={`Sao chép dịch vụ ${id}`} onClick={() => onCopyService(id)}><Copy size={14}/></Button>}
    </div>
  }

  return <>
    <div className="sm-list-heading"><div className="sm-list-summary">{heading}</div><Button onClick={() => setShowColumns(true)}><SlidersHorizontal size={15}/>Tùy chỉnh cột</Button></div>
    <div className="table-scroll"><table className="data-table sm-separated-table">
      <thead><tr>{shown.map(key => <th key={key} scope="col">{columns[screen][key]}</th>)}<th scope="col">Thao tác</th></tr></thead>
      <tbody>{ids.map(id => {const cells=rowCells(id);return <tr key={id}>{shown.map(key => <td key={key} className={key === "note" || key === "control" ? "sm-cell-wrap" : undefined}>{cells[key] || "—"}</td>)}<td>{actions(id)}</td></tr>})}
        {!ids.length && <tr><td colSpan={shown.length + 1}><div className="sm-empty"><Search size={24}/><strong>Không có dữ liệu phù hợp</strong><span>Kiểm tra lại bộ lọc hoặc thêm hồ sơ mới.</span></div></td></tr>}
      </tbody>
    </table></div>
    {showColumns && <ColumnSettingsDrawer columns={columns[screen]} selected={shown} defaults={defaults[screen]} required="id"
      onClose={() => setShowColumns(false)} onSave={selection => {
        setShown(selection)
        try { localStorage.setItem(storageKey, JSON.stringify(selection)) } catch {}
        setShowColumns(false)
      }}/>}
  </>
}
